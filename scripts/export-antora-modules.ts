import {
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
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

function usage(): string {
	return [
		"Usage: bun scripts/export-antora-modules.ts [--modules-root <dir>] [--output-root <dir>] [--flavor <gfm|commonmark|gitlab|strict>]",
		"",
		"Export Antora module pages from docs/modules/**/pages/**/*.adoc into Markdown using the repository pipeline.",
	].join("\n");
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

async function listFilesRecursively(rootDir: string): Promise<string[]> {
	const entries = await readdir(rootDir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = resolve(rootDir, entry.name);
			if (entry.isDirectory()) {
				return listFilesRecursively(entryPath);
			}

			return [entryPath];
		}),
	);

	return nested.flat();
}

export async function collectAntoraPageFiles(
	modulesRoot: string,
): Promise<string[]> {
	const files = await listFilesRecursively(modulesRoot);

	return files
		.filter(
			(filePath) =>
				extname(filePath) === ".adoc" && filePath.split(sep).includes("pages"),
		)
		.sort();
}

export function mapAntoraPageToMarkdownPath(
	modulesRoot: string,
	outputRoot: string,
	pagePath: string,
): ExportedMarkdownFile {
	const relativeInputPath = relative(modulesRoot, pagePath);
	const relativeOutputPath = relativeInputPath.replace(/\.adoc$/u, ".md");

	return {
		inputPath: pagePath,
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

	const pageFiles = await collectAntoraPageFiles(options.modulesRoot);
	const exportedFiles: ExportedMarkdownFile[] = [];

	for (const pageFile of pageFiles) {
		const source = await readFile(pageFile, "utf8");
		const mapping = mapAntoraPageToMarkdownPath(
			options.modulesRoot,
			options.outputRoot,
			pageFile,
		);
		const document = normalizeMarkdownIR(
			convertAssemblyToMarkdownIR(source, {
				sourcePath: pageFile,
			}),
		);
		const markdown = renderMarkdown(document, options.flavor);

		await mkdir(dirname(mapping.outputPath), { recursive: true });
		await writeFile(mapping.outputPath, `${markdown}\n`);
		exportedFiles.push(mapping);
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
