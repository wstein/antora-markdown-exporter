import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	createMarkdownConverter,
	type MarkdownFlavorName,
	type XrefFallbackLabelStyle,
} from "../src/extension/index.ts";
import { runAntoraAssembler } from "./antora-assembler.mjs";

export type ExportAntoraModulesOptions = {
	flavor: MarkdownFlavorName;
	format: "human" | "json";
	outputRoot: string;
	packageTaskMarkdown: boolean;
	playbookPath: string;
	rootLevel: 0 | 1;
	xrefFallbackLabelStyle: XrefFallbackLabelStyle;
};

export type ExportedMarkdownFile = {
	moduleName: string;
	outputPath: string;
	relativeOutputPath: string;
};

export type ReviewBundleFile = {
	outputPath: string;
	relativeOutputPath: string;
	sourcePath: string;
};

const markdownFlavors = new Set<MarkdownFlavorName>([
	"gfm",
	"commonmark",
	"gitlab",
	"multimarkdown",
	"strict",
]);

function usage(): string {
	return [
		"Usage: bun scripts/export-antora-modules.ts [--playbook <file>] [--output-root <dir>] [--flavor <gfm|commonmark|gitlab|multimarkdown|strict>] [--root-level <0|1>] [--xref-fallback-label-style <fragment-or-basename|fragment-or-path>] [--package-task-markdown] [--json]",
		"",
		"Export documentation assemblies to Markdown using the repository's Antora Markdown converter.",
	].join("\n");
}

export function parseArguments(argv: string[]): ExportAntoraModulesOptions {
	let flavor: MarkdownFlavorName = "gfm";
	let flavorExplicitlySet = false;
	let format: "human" | "json" = "human";
	let outputRoot = resolve("build/markdown");
	let packageTaskMarkdown = false;
	let playbookPath = resolve("antora-playbook.yml");
	let rootLevel: 0 | 1 = 1;
	let xrefFallbackLabelStyle: XrefFallbackLabelStyle = "fragment-or-basename";

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
				value !== "multimarkdown" &&
				value !== "strict"
			) {
				throw new Error("Missing or invalid value for --flavor");
			}

			flavor = value;
			flavorExplicitlySet = true;
			index += 1;
			continue;
		}

		if (argument === "--xref-fallback-label-style") {
			const value = argv[index + 1];
			if (value !== "fragment-or-basename" && value !== "fragment-or-path") {
				throw new Error(
					"Missing or invalid value for --xref-fallback-label-style",
				);
			}

			xrefFallbackLabelStyle = value;
			index += 1;
			continue;
		}

		if (argument === "--root-level") {
			const value = argv[index + 1];
			if (value !== "0" && value !== "1") {
				throw new Error("Missing or invalid value for --root-level");
			}

			rootLevel = Number(value) as 0 | 1;
			index += 1;
			continue;
		}

		if (argument === "--json") {
			format = "json";
			continue;
		}

		if (argument === "--package-task-markdown") {
			packageTaskMarkdown = true;
			continue;
		}

		throw new Error(`Unknown option: ${argument}`);
	}

	if (packageTaskMarkdown && !flavorExplicitlySet) {
		flavor = "multimarkdown";
	}

	return {
		flavor,
		format,
		outputRoot,
		packageTaskMarkdown,
		playbookPath,
		rootLevel,
		xrefFallbackLabelStyle,
	};
}

export async function exportAntoraModulesToMarkdown(
	options: ExportAntoraModulesOptions,
): Promise<{
	exportedFiles: ExportedMarkdownFile[];
	reviewBundleFiles: ReviewBundleFile[];
	reviewBundleRoot: string;
}> {
	const playbookStats = await stat(options.playbookPath).catch(() => undefined);
	if (playbookStats === undefined || !playbookStats.isFile()) {
		throw new Error(`Antora playbook does not exist: ${options.playbookPath}`);
	}

	if (!markdownFlavors.has(options.flavor)) {
		throw new Error(`Unsupported markdown flavor: ${options.flavor}`);
	}

	const rootDir = dirname(options.playbookPath);
	const converter = createMarkdownConverter({
		flavor: options.flavor,
		xrefFallbackLabelStyle: options.xrefFallbackLabelStyle,
	});
	const exportedFiles: ExportedMarkdownFile[] = [];
	const reviewBundleRoot = resolve(options.outputRoot, "review-bundle");
	const reviewBundleFiles: ReviewBundleFile[] = [];
	const workflowBundleEntries = [
		".github/workflows/release.yml",
		".github/workflows/pages.yml",
	];

	await rm(options.outputRoot, { force: true, recursive: true });
	await mkdir(options.outputRoot, { recursive: true });
	await mkdir(reviewBundleRoot, { recursive: true });

	const files = await runAntoraAssembler({
		buildDir: options.outputRoot,
		converter,
		playbookPath: options.playbookPath,
		rootLevel: options.rootLevel,
	});

	for (const file of files) {
		const relativeOutputPath = file.src.relative;
		const outputPath = resolve(options.outputRoot, relativeOutputPath);
		const moduleName = relativeOutputPath.replace(/\.md$/u, "");
		exportedFiles.push({
			moduleName,
			outputPath,
			relativeOutputPath,
		});
	}

	for (const relativeSourcePath of workflowBundleEntries) {
		const sourcePath = resolve(rootDir, relativeSourcePath);
		const bundledPath = resolve(reviewBundleRoot, relativeSourcePath);
		await mkdir(dirname(bundledPath), { recursive: true });
		await copyFile(sourcePath, bundledPath);
		reviewBundleFiles.push({
			sourcePath,
			outputPath: bundledPath,
			relativeOutputPath: relativeSourcePath,
		});
	}

	return {
		exportedFiles,
		reviewBundleFiles,
		reviewBundleRoot,
	};
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const { exportedFiles, reviewBundleFiles, reviewBundleRoot } =
		await exportAntoraModulesToMarkdown(options);

	if (options.format === "json") {
		console.log(
			JSON.stringify(
				{
					count: exportedFiles.length,
					flavor: options.flavor,
					outputRoot: options.outputRoot,
					playbookPath: options.playbookPath,
					rootLevel: options.rootLevel,
					reviewBundleRoot,
					reviewBundleFiles: reviewBundleFiles.map((entry) => ({
						outputPath: entry.relativeOutputPath,
					})),
					xrefFallbackLabelStyle: options.xrefFallbackLabelStyle,
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
			`Review bundle: ${reviewBundleRoot}`,
			`Assembly root level: ${options.rootLevel}`,
			`Xref fallback labels: ${options.xrefFallbackLabelStyle}`,
			...exportedFiles.map(
				(entry) => `- ${entry.moduleName}: ${entry.relativeOutputPath}`,
			),
			...reviewBundleFiles.map(
				(entry) => `- review bundle: ${entry.relativeOutputPath}`,
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
