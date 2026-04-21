import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	createMarkdownConverter,
	type MarkdownFlavorName,
} from "../src/extension/index.ts";
import {
	createDocumentationModuleSource,
	getDocumentationModuleNames,
} from "./docs-module-sources.mjs";

export type ExportAntoraModulesOptions = {
	flavor: MarkdownFlavorName;
	format: "human" | "json";
	outputRoot: string;
	playbookPath: string;
};

export type ExportedMarkdownFile = {
	moduleName: string;
	outputPath: string;
	relativeOutputPath: string;
};

const markdownFlavors = new Set<MarkdownFlavorName>([
	"gfm",
	"commonmark",
	"gitlab",
	"strict",
]);

function usage(): string {
	return [
		"Usage: bun scripts/export-antora-modules.ts [--playbook <file>] [--output-root <dir>] [--flavor <gfm|commonmark|gitlab|strict>] [--json]",
		"",
		"Export assembled documentation modules to Markdown using the repository's Antora Markdown converter.",
	].join("\n");
}

export function parseArguments(argv: string[]): ExportAntoraModulesOptions {
	let flavor: MarkdownFlavorName = "gfm";
	let format: "human" | "json" = "human";
	let outputRoot = resolve("build/markdown");
	let playbookPath = resolve("antora-playbook.yml");

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === undefined) continue;

		if (argument === "--playbook") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --playbook");
			}
			playbookPath = resolve(value);
			index += 1;
			continue;
		}

		if (argument === "--output-root") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --output-root");
			}
			outputRoot = resolve(value);
			index += 1;
			continue;
		}

		if (argument === "--flavor") {
			const value = argv[index + 1];
			if (
				value !== "gfm" &&
				value !== "commonmark" &&
				value !== "gitlab" &&
				value !== "strict"
			) {
				throw new Error("Missing or invalid value for --flavor");
			}

			flavor = value;
			index += 1;
			continue;
		}

		if (argument === "--json") {
			format = "json";
			continue;
		}

		throw new Error(`Unknown option: ${argument}`);
	}

	return { flavor, format, outputRoot, playbookPath };
}

export async function exportAntoraModulesToMarkdown(
	options: ExportAntoraModulesOptions,
): Promise<ExportedMarkdownFile[]> {
	const playbookStats = await stat(options.playbookPath).catch(() => undefined);
	if (playbookStats === undefined || !playbookStats.isFile()) {
		throw new Error(`Antora playbook does not exist: ${options.playbookPath}`);
	}

	if (!markdownFlavors.has(options.flavor)) {
		throw new Error(`Unsupported markdown flavor: ${options.flavor}`);
	}

	const rootDir = dirname(options.playbookPath);
	const converter = createMarkdownConverter({ flavor: options.flavor });
	const exportedFiles: ExportedMarkdownFile[] = [];

	await rm(options.outputRoot, { force: true, recursive: true });
	await mkdir(options.outputRoot, { recursive: true });

	for (const moduleName of getDocumentationModuleNames()) {
		const relativeOutputPath = `${moduleName}.md`;
		const outputPath = resolve(options.outputRoot, relativeOutputPath);
		const assembledSource = createDocumentationModuleSource(
			rootDir,
			moduleName,
		);
		const docfile = resolve(rootDir, `${moduleName}.assembled.adoc`);

		await converter.convert(
			{
				contents: Buffer.from(assembledSource, "utf8"),
				path: docfile,
			},
			{
				docfile,
				outdir: options.outputRoot,
				outfile: outputPath,
				outfilesuffix: ".md",
			},
			{
				cwd: rootDir,
				dir: options.outputRoot,
			},
		);

		exportedFiles.push({
			moduleName,
			outputPath,
			relativeOutputPath,
		});
	}

	return exportedFiles;
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const exportedFiles = await exportAntoraModulesToMarkdown(options);

	if (options.format === "json") {
		console.log(
			JSON.stringify(
				{
					count: exportedFiles.length,
					flavor: options.flavor,
					outputRoot: options.outputRoot,
					playbookPath: options.playbookPath,
					files: exportedFiles.map((entry) => ({
						moduleName: entry.moduleName,
						outputPath: entry.relativeOutputPath,
					})),
				},
				null,
				2,
			),
		);
		return;
	}

	console.log(
		[
			`Exported ${exportedFiles.length} documentation modules as ${options.flavor} Markdown.`,
			`Output root: ${options.outputRoot}`,
			...exportedFiles.map(
				(entry) => `- ${entry.moduleName}: ${entry.relativeOutputPath}`,
			),
		].join("\n"),
	);
}

function isDirectExecution(): boolean {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}

	return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
	try {
		await main();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		console.error("");
		console.error(usage());
		process.exitCode = 1;
	}
}
