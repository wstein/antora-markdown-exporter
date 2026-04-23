import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buffer as readStreamBuffer } from "node:stream/consumers";
import { extractAssemblyStructure } from "./adapter/asciidoctor-structure.js";
import type {
	AssemblyBlock,
	AssemblyDocument,
} from "./adapter/assembly-structure.js";
import {
	assembleAntoraModules as assembleModulesFromRuntime,
	resolveAntoraMarkdownExportDefaults as resolveDefaultsFromRuntime,
	runAntoraAssembler as runAssemblerRuntime,
} from "./antora-runtime.js";
import type {
	AntoraMarkdownExporterExtensionConfig,
	AssemblerRootLevel,
} from "./extension/index.js";
import { createMarkdownConverter } from "./extension/index.js";
import type { MarkdownFlavorName } from "./markdown/flavor.js";

export type AntoraMarkdownExportDefaults = {
	flavor?: MarkdownFlavorName;
	rootLevel?: AssemblerRootLevel;
};

export type AntoraMarkdownModuleExportOptions = {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	flavor?: MarkdownFlavorName;
	keepSource?: boolean;
	outputRoot: string;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
};

export type AntoraMarkdownModuleExportFile = {
	moduleName: string;
	outputPath: string;
	relativeOutputPath: string;
};

export type AntoraMarkdownModuleExportResult = {
	exportedFiles: AntoraMarkdownModuleExportFile[];
	flavor: MarkdownFlavorName;
	outputRoot: string;
	playbookPath: string;
	rootLevel: AssemblerRootLevel;
};

export type ExportAntoraModulesToMarkdownOptions = {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	flavor?: MarkdownFlavorName;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
};

export type AntoraMarkdownExportDiagnostic = {
	code: string;
	column?: number;
	line?: number;
	message: string;
	severity: "error" | "warning";
	sourcePath?: string;
};

export type AntoraModuleMarkdownExport = {
	component: string;
	content: string;
	diagnostics: AntoraMarkdownExportDiagnostic[];
	flavor: MarkdownFlavorName;
	mediaType: string;
	moduleName: string;
	name: string;
	path: string;
	rootLevel: AssemblerRootLevel;
	sourcePages: string[];
	version: string;
};

export type AssembledAntoraModuleFile = {
	component: string;
	contents: Buffer;
	downloadStem: string;
	mediaType: string;
	moduleName: string;
	name: string;
	relativePath: string;
	rootLevel: AssemblerRootLevel;
	sourcePages: string[];
	version: string;
};

export type AntoraAssemblerRunOptions = {
	buildDir: string;
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	converter: ReturnType<typeof createMarkdownConverter>;
	keepSource?: boolean;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
};

export type AssembleAntoraModulesOptions = {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
};

type RuntimePageRef = {
	src?: { family?: string; module?: string; relative?: string };
};

type RuntimeAssembledModuleFile = {
	assembler: {
		assembled?: {
			pages?: Map<RuntimePageRef, unknown>;
		};
		downloadStem: string;
		rootLevel: AssemblerRootLevel;
	};
	contents: Buffer;
	src: {
		component: string;
		mediaType: string;
		module: string;
		relative: string;
		stem: string;
		version: string;
	};
};

type RuntimeExportedModuleFile = {
	contents: Buffer | NodeJS.ReadableStream | string;
	src: {
		component: string;
		mediaType: string;
		module: string;
		relative: string;
		stem: string;
		version: string;
	};
};

function toSourcePagePath(page: RuntimePageRef): string | undefined {
	if (
		page.src?.family !== "page" ||
		page.src.module === undefined ||
		page.src.relative === undefined
	) {
		return undefined;
	}

	return `modules/${page.src.module}/pages/${page.src.relative}`;
}

function collectUnsupportedDiagnosticsFromBlocks(
	blocks: AssemblyBlock[],
	fallbackSourcePath: string,
): AntoraMarkdownExportDiagnostic[] {
	return blocks.flatMap((block) => {
		switch (block.type) {
			case "unsupported":
				return [
					{
						code: "unsupported-structure",
						column: block.location?.column,
						line: block.location?.line,
						message: block.reason,
						severity: "warning",
						sourcePath:
							block.location?.path === undefined ||
							block.location.path === "<stdin>"
								? fallbackSourcePath
								: block.location.path,
					},
				];
			case "blockquote":
			case "admonition":
			case "footnoteDefinition":
				return collectUnsupportedDiagnosticsFromBlocks(
					block.children,
					fallbackSourcePath,
				);
			case "list":
				return block.items.flatMap((item) =>
					collectUnsupportedDiagnosticsFromBlocks(
						item.children,
						fallbackSourcePath,
					),
				);
			case "labeledGroup":
				return collectUnsupportedDiagnosticsFromBlocks(
					block.children,
					fallbackSourcePath,
				);
			case "calloutList":
				return block.items.flatMap((item) =>
					collectUnsupportedDiagnosticsFromBlocks(
						item.children,
						fallbackSourcePath,
					),
				);
			default:
				return [];
		}
	});
}

function collectMarkdownExportDiagnostics(
	document: AssemblyDocument,
	sourcePath: string,
): AntoraMarkdownExportDiagnostic[] {
	return collectUnsupportedDiagnosticsFromBlocks(document.children, sourcePath);
}

async function readMarkdownContents(
	contents: RuntimeExportedModuleFile["contents"],
): Promise<string> {
	if (typeof contents === "string") {
		return contents;
	}

	if (Buffer.isBuffer(contents)) {
		return contents.toString("utf8");
	}

	return (await readStreamBuffer(contents)).toString("utf8");
}

async function resolveMarkdownExportOptions(options: {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	flavor?: MarkdownFlavorName;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
}): Promise<{
	flavor: MarkdownFlavorName;
	playbookPath: string;
	rootLevel: AssemblerRootLevel;
}> {
	const defaults = await resolveAntoraMarkdownExportDefaults({
		configSource: options.configSource,
		playbookPath: options.playbookPath,
	});

	return {
		flavor: options.flavor ?? defaults.flavor ?? "gfm",
		playbookPath: resolve(options.playbookPath),
		rootLevel: options.rootLevel ?? defaults.rootLevel ?? 1,
	};
}

export async function resolveAntoraMarkdownExportDefaults({
	configSource,
	playbookPath,
}: {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	playbookPath: string;
}): Promise<AntoraMarkdownExportDefaults> {
	return resolveDefaultsFromRuntime({ configSource, playbookPath });
}

export async function runAntoraAssembler(
	options: AntoraAssemblerRunOptions,
): Promise<RuntimeExportedModuleFile[]> {
	return (await runAssemblerRuntime({
		buildDir: options.buildDir,
		configSource: options.configSource,
		converter: options.converter,
		keepSource: options.keepSource,
		playbookPath: options.playbookPath,
		rootLevel: options.rootLevel,
	})) as RuntimeExportedModuleFile[];
}

export async function assembleAntoraModules(
	options: AssembleAntoraModulesOptions,
): Promise<AssembledAntoraModuleFile[]> {
	const files = (await assembleModulesFromRuntime({
		configSource: options.configSource,
		playbookPath: options.playbookPath,
		rootLevel: options.rootLevel,
	})) as RuntimeAssembledModuleFile[];

	return files.map((file) => {
		const sourcePages = [
			...new Set(
				Array.from(file.assembler?.assembled?.pages?.keys?.() ?? [])
					.map((page) => toSourcePagePath(page))
					.filter((page): page is string => page !== undefined),
			),
		];

		return {
			component: file.src.component,
			contents: Buffer.from(file.contents),
			downloadStem: file.assembler.downloadStem,
			mediaType: file.src.mediaType,
			moduleName: file.src.module,
			name: file.src.stem,
			relativePath: file.src.relative,
			rootLevel: file.assembler.rootLevel,
			sourcePages,
			version: file.src.version,
		};
	});
}

export async function exportAntoraModulesToMarkdown(
	options: ExportAntoraModulesToMarkdownOptions,
): Promise<AntoraModuleMarkdownExport[]> {
	const resolvedOptions = await resolveMarkdownExportOptions(options);
	const assembledFiles = await assembleAntoraModules({
		configSource: options.configSource,
		playbookPath: resolvedOptions.playbookPath,
		rootLevel: resolvedOptions.rootLevel,
	});
	const assembledFilesByPath = new Map(
		assembledFiles.map((file) => [file.relativePath, file]),
	);
	const buildDir = await mkdtemp(join(tmpdir(), "antora-markdown-export-"));
	const converter = createMarkdownConverter({
		flavor: resolvedOptions.flavor,
	});

	try {
		const files = await runAntoraAssembler({
			buildDir,
			configSource: options.configSource,
			converter,
			playbookPath: resolvedOptions.playbookPath,
			rootLevel: resolvedOptions.rootLevel,
		});

		return await Promise.all(
			files.map(async (file) => {
				const assembledFile = assembledFilesByPath.get(
					file.src.relative.replace(/\.md$/u, ".adoc"),
				);
				return {
					component: file.src.component,
					content: await readMarkdownContents(file.contents),
					diagnostics:
						assembledFile === undefined
							? []
							: collectMarkdownExportDiagnostics(
									extractAssemblyStructure(
										assembledFile.contents.toString("utf8"),
										{
											sourcePath: assembledFile.relativePath,
										},
									),
									assembledFile.relativePath,
								),
					flavor: resolvedOptions.flavor,
					mediaType: file.src.mediaType,
					moduleName: file.src.module,
					name: file.src.stem,
					path: file.src.relative,
					rootLevel: resolvedOptions.rootLevel,
					sourcePages: assembledFile?.sourcePages ?? [],
					version: file.src.version,
				};
			}),
		);
	} finally {
		await rm(buildDir, { force: true, recursive: true });
	}
}

export async function exportAntoraModules(
	options: AntoraMarkdownModuleExportOptions,
): Promise<AntoraMarkdownModuleExportResult> {
	const resolvedOptions = await resolveMarkdownExportOptions(options);
	const outputRoot = resolve(options.outputRoot);
	const assembledFiles = options.keepSource
		? await assembleAntoraModules({
				configSource: options.configSource,
				playbookPath: resolvedOptions.playbookPath,
				rootLevel: resolvedOptions.rootLevel,
			})
		: [];
	const exports = await exportAntoraModulesToMarkdown({
		configSource: options.configSource,
		flavor: resolvedOptions.flavor,
		playbookPath: resolvedOptions.playbookPath,
		rootLevel: resolvedOptions.rootLevel,
	});

	await mkdir(outputRoot, { recursive: true });
	await Promise.all(
		exports.map(async (file) => {
			const outputPath = resolve(outputRoot, file.path);
			await mkdir(dirname(outputPath), { recursive: true });
			await writeFile(outputPath, file.content, "utf8");
		}),
	);
	if (options.keepSource) {
		await Promise.all(
			assembledFiles.map(async (file) => {
				const outputPath = resolve(outputRoot, file.relativePath);
				await mkdir(dirname(outputPath), { recursive: true });
				await writeFile(outputPath, file.contents);
			}),
		);
	}

	return {
		flavor: resolvedOptions.flavor,
		outputRoot,
		playbookPath: resolvedOptions.playbookPath,
		rootLevel: resolvedOptions.rootLevel,
		exportedFiles: exports.map((file) => {
			const relativeOutputPath = file.path;
			return {
				moduleName: relativeOutputPath.replace(/\.md$/u, ""),
				outputPath: resolve(outputRoot, relativeOutputPath),
				relativeOutputPath,
			};
		}),
	};
}
