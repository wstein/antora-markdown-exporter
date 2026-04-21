import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	convertAssemblyToMarkdownIR,
	type MarkdownFlavorName,
	normalizeMarkdownIR,
	renderMarkdown,
} from "../src/index.js";

export type ExportAntoraModulesOptions = {
	flavor: MarkdownFlavorName;
	modulesRoot: string;
	outputRoot: string;
};

export type ExportedMarkdownFile = {
	inputPath: string;
	moduleName: string;
	outputPath: string;
	relativeInputPath: string;
	relativeOutputPath: string;
};

const markdownFlavors = new Set<MarkdownFlavorName>([
	"gfm",
	"commonmark",
	"gitlab",
	"strict",
]);
const asciidocControlLinePattern =
	/^(?:\/\/|ifdef::|ifndef::|endif::|:[A-Za-z0-9_-]+:|<<<<\s*)/;
const exportableModules = ["architecture", "manual", "onboarding"] as const;

function usage(): string {
	return [
		"Usage: bun scripts/export-antora-modules.ts [--modules-root <dir>] [--output-root <dir>] [--flavor <gfm|commonmark|gitlab|strict>]",
		"",
		"Export one assembled Markdown document per Antora module using the repository pipeline.",
	].join("\n");
}

export function getExportableModuleNames(): string[] {
	return [...exportableModules];
}

export function sanitizeAntoraPageSource(source: string): string {
	const sanitizedLines: string[] = [];
	let skippingArc42Help = false;

	for (const line of source.split(/\r?\n/)) {
		if (line.startsWith("ifdef::arc42help[]")) {
			skippingArc42Help = true;
			continue;
		}

		if (line.startsWith("endif::arc42help[]")) {
			skippingArc42Help = false;
			continue;
		}

		if (skippingArc42Help || asciidocControlLinePattern.test(line)) {
			continue;
		}

		sanitizedLines.push(line);
	}

	return `${sanitizedLines.join("\n").trim()}\n`;
}

export function cleanRenderedMarkdown(markdown: string): string {
	return markdown
		.replaceAll(/\\<!-- md-ir-include .*?--\\>\s*/g, "")
		.replaceAll(
			/\n> Unsupported: include directive is not yet inlined: include::[^\n]+\n?/g,
			"\n",
		)
		.replaceAll(/ifdef::arc42help\\\[\\\].*?endif::arc42help\\\[\\\]\n*/gs, "")
		.replaceAll(/^\/\/.*$/gm, "")
		.replaceAll(/^:.*$/gm, "")
		.replaceAll(/^\\?\[(?:options|cols).*$/gm, "")
		.replaceAll(/^\*\*<[^>\n]+>\*\*$/gm, "")
		.replaceAll(/^\\?\*{2,}.*<[^>\n]+>.*$/gm, "")
		.replaceAll(/\n{3,}/g, "\n\n")
		.trim();
}

export function parseArguments(argv: string[]): ExportAntoraModulesOptions {
	let flavor: MarkdownFlavorName = "gfm";
	let modulesRoot = resolve("docs/modules");
	let outputRoot = resolve("build/markdown");

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === undefined) {
			continue;
		}

		if (argument === "--modules-root") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --modules-root");
			}

			modulesRoot = resolve(value);
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

		throw new Error(`Unknown option: ${argument}`);
	}

	return {
		flavor,
		modulesRoot,
		outputRoot,
	};
}

export function getAntoraModuleRoot(
	modulesRoot: string,
	moduleName: string,
): string {
	return resolve(modulesRoot, moduleName);
}

export function getAntoraModuleIndexPath(
	modulesRoot: string,
	moduleName: string,
): string {
	return resolve(
		getAntoraModuleRoot(modulesRoot, moduleName),
		"pages/index.adoc",
	);
}

export function mapAntoraModuleToMarkdownPath(
	outputRoot: string,
	moduleName: string,
): ExportedMarkdownFile {
	const relativeInputPath = `${moduleName}/pages/index.adoc`;
	const relativeOutputPath = `${moduleName}.md`;

	return {
		inputPath: relativeInputPath,
		moduleName,
		outputPath: resolve(outputRoot, relativeOutputPath),
		relativeInputPath,
		relativeOutputPath,
	};
}

export async function exportAntoraModulesToMarkdown(
	options: ExportAntoraModulesOptions,
): Promise<ExportedMarkdownFile[]> {
	const modulesStats = await stat(options.modulesRoot).catch(() => undefined);
	if (modulesStats === undefined || !modulesStats.isDirectory()) {
		throw new Error(
			`Antora modules root does not exist or is not a directory: ${options.modulesRoot}`,
		);
	}

	if (options.modulesRoot === options.outputRoot) {
		throw new Error("Output root must be different from the modules root");
	}

	if (!markdownFlavors.has(options.flavor)) {
		throw new Error(`Unsupported markdown flavor: ${options.flavor}`);
	}

	await rm(options.outputRoot, { force: true, recursive: true });
	await mkdir(options.outputRoot, { recursive: true });

	const exportedFiles: ExportedMarkdownFile[] = [];

	for (const moduleName of exportableModules) {
		const moduleIndexPath = getAntoraModuleIndexPath(
			options.modulesRoot,
			moduleName,
		);
		const moduleIndexStats = await stat(moduleIndexPath).catch(() => undefined);
		if (moduleIndexStats === undefined || !moduleIndexStats.isFile()) {
			throw new Error(`Module index page does not exist: ${moduleIndexPath}`);
		}

		const source = sanitizeAntoraPageSource(
			await readFile(moduleIndexPath, "utf8"),
		);
		const mapping = mapAntoraModuleToMarkdownPath(
			options.outputRoot,
			moduleName,
		);
		const document = normalizeMarkdownIR(
			convertAssemblyToMarkdownIR(source, {
				includeRootDir: getAntoraModuleRoot(options.modulesRoot, moduleName),
				sourcePath: moduleIndexPath,
			}),
		);
		const markdown = cleanRenderedMarkdown(
			renderMarkdown(document, options.flavor),
		);

		await writeFile(mapping.outputPath, `${markdown}\n`);
		exportedFiles.push({
			...mapping,
			inputPath: moduleIndexPath,
		});
	}

	return exportedFiles;
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const exportedFiles = await exportAntoraModulesToMarkdown(options);

	console.log(
		JSON.stringify(
			{
				count: exportedFiles.length,
				flavor: options.flavor,
				modulesRoot: options.modulesRoot,
				outputRoot: options.outputRoot,
				files: exportedFiles.map((entry) => ({
					inputPath: entry.relativeInputPath,
					moduleName: entry.moduleName,
					outputPath: entry.relativeOutputPath,
				})),
			},
			null,
			2,
		),
	);
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	console.error("");
	console.error(usage());
	process.exitCode = 1;
}
