import { resolve } from "node:path";
import {
	assembleAntoraModules as assembleModulesFromRuntime,
	resolveAntoraMarkdownExportDefaults as resolveDefaultsFromRuntime,
	runAntoraAssembler as runAssemblerRuntime,
} from "./antora-runtime.js";
import type {
	AntoraMarkdownExporterExtensionConfig,
	AssemblerRootLevel,
	XrefFallbackLabelStyle,
} from "./extension/index.js";
import { createMarkdownConverter } from "./extension/index.js";
import type { MarkdownFlavorName } from "./markdown/flavor.js";

export type AntoraMarkdownExportDefaults = {
	flavor?: MarkdownFlavorName;
	rootLevel?: AssemblerRootLevel;
	xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
};

export type AntoraMarkdownModuleExportOptions = {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	flavor?: MarkdownFlavorName;
	keepSource?: boolean;
	outputRoot: string;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
	xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
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
	xrefFallbackLabelStyle: XrefFallbackLabelStyle;
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
	src: {
		relative: string;
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

export async function exportAntoraModules(
	options: AntoraMarkdownModuleExportOptions,
): Promise<AntoraMarkdownModuleExportResult> {
	const defaults = await resolveAntoraMarkdownExportDefaults({
		configSource: options.configSource,
		playbookPath: options.playbookPath,
	});
	const flavor = options.flavor ?? defaults.flavor ?? "gfm";
	const rootLevel = options.rootLevel ?? defaults.rootLevel ?? 1;
	const xrefFallbackLabelStyle =
		options.xrefFallbackLabelStyle ??
		defaults.xrefFallbackLabelStyle ??
		"fragment-or-basename";
	const outputRoot = resolve(options.outputRoot);
	const playbookPath = resolve(options.playbookPath);
	const converter = createMarkdownConverter({
		flavor,
		xrefFallbackLabelStyle,
	});
	const files = await runAntoraAssembler({
		buildDir: outputRoot,
		configSource: options.configSource,
		converter,
		keepSource: options.keepSource,
		playbookPath,
		rootLevel,
	});

	return {
		flavor,
		outputRoot,
		playbookPath,
		rootLevel,
		xrefFallbackLabelStyle,
		exportedFiles: files.map((file) => {
			const relativeOutputPath = file.src.relative;
			return {
				moduleName: relativeOutputPath.replace(/\.md$/u, ""),
				outputPath: resolve(outputRoot, relativeOutputPath),
				relativeOutputPath,
			};
		}),
	};
}
