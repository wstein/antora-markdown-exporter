import { resolve } from "node:path";
import {
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

export type AntoraAssemblerRunOptions = {
	buildDir: string;
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	converter: ReturnType<typeof createMarkdownConverter>;
	keepSource?: boolean;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
};

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
): Promise<
	{
		src: {
			relative: string;
		};
	}[]
> {
	return runAssemblerRuntime({
		buildDir: options.buildDir,
		configSource: options.configSource,
		converter: options.converter,
		keepSource: options.keepSource,
		playbookPath: options.playbookPath,
		rootLevel: options.rootLevel,
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
