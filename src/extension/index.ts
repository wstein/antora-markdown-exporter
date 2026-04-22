import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { configure } from "@antora/assembler";
import { extractAssemblyStructure } from "../adapter/asciidoctor-structure.js";
import { convertAssemblyStructureToMarkdownIR } from "../exporter/structured-to-ir.js";
import type { MarkdownFlavorName } from "../markdown/flavor.js";
import { normalizeMarkdownIR } from "../markdown/normalize.js";
import { renderMarkdown } from "../markdown/render/index.js";

export type XrefFallbackLabelStyle =
	| "fragment-or-basename"
	| "fragment-or-path";
export type AssemblerRootLevel = 0 | 1;

export interface AntoraMarkdownExporterExtensionConfig {
	readonly flavor?: MarkdownFlavorName;
	readonly configSource?: Record<string, unknown> | string;
	readonly rootLevel?: AssemblerRootLevel;
	readonly xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
	readonly navigationCatalog?: {
		getNavigation: (component: string, version: string) => unknown[];
	};
	readonly configFile?: string;
	readonly configFiles?: string[];
}

type MarkdownConverterConfig = {
	readonly flavor: MarkdownFlavorName;
	readonly xrefFallbackLabelStyle: XrefFallbackLabelStyle;
};

type ConvertAttributes = {
	docfile: string;
	outdir: string;
	outfile: string;
	outfilesuffix: string;
};

type BuildConfig = {
	cwd?: string;
	dir?: string;
};

type AssemblerFile = {
	contents: Buffer;
	path: string;
};

const defaultFlavor: MarkdownFlavorName = "gfm";
const defaultAssemblerRootLevel: AssemblerRootLevel = 1;

function createDefaultAssemblerConfigSource(rootLevel: AssemblerRootLevel) {
	return {
		assembly: {
			root_level: rootLevel,
		},
	};
}

export function renderAssemblyMarkdown(
	source: string,
	flavor: MarkdownFlavorName = defaultFlavor,
	sourcePath = "assembly.adoc",
	options: {
		attributes?: Record<string, unknown>;
		xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
	} = {},
): string {
	const structured = extractAssemblyStructure(source, {
		attributes: options.attributes,
		sourcePath,
		xrefFallbackLabelStyle: options.xrefFallbackLabelStyle,
	});
	return renderMarkdown(
		normalizeMarkdownIR(convertAssemblyStructureToMarkdownIR(structured)),
		flavor,
	);
}

export function createMarkdownConverter(
	config: Partial<MarkdownConverterConfig> = {},
) {
	const flavor = config.flavor ?? defaultFlavor;
	const xrefFallbackLabelStyle =
		config.xrefFallbackLabelStyle ?? "fragment-or-basename";

	return {
		backend: "markdown",
		extname: ".md",
		mediaType: "text/markdown",
		loggerName: "@wsmy/antora-markdown-exporter",
		async convert(
			file: AssemblerFile,
			convertAttributes: ConvertAttributes,
			buildConfig: BuildConfig,
		): Promise<void> {
			const outputDir = buildConfig.dir ?? buildConfig.cwd ?? process.cwd();
			const outputPath = resolve(
				outputDir,
				basename(convertAttributes.outfile),
			);
			convertAttributes.outdir = dirname(outputPath);
			convertAttributes.outfile = outputPath;
			convertAttributes.outfilesuffix = ".md";
			await mkdir(dirname(outputPath), { recursive: true });
			const markdown = renderAssemblyMarkdown(
				file.contents.toString("utf8"),
				flavor,
				convertAttributes.docfile,
				{
					attributes: convertAttributes,
					xrefFallbackLabelStyle,
				},
			);
			await writeFile(outputPath, `${markdown}\n`);
		},
	} as const;
}

export function register(
	this: unknown,
	{ config = {} }: { config?: AntoraMarkdownExporterExtensionConfig } = {},
): void {
	const {
		configSource,
		flavor,
		navigationCatalog,
		rootLevel,
		xrefFallbackLabelStyle,
		...assemblerConfig
	} = config;
	configure(
		this,
		createMarkdownConverter({ flavor, xrefFallbackLabelStyle }),
		assemblerConfig,
		{
			configSource:
				typeof configSource === "string" || configSource !== undefined
					? configSource
					: createDefaultAssemblerConfigSource(
							rootLevel ?? defaultAssemblerRootLevel,
						),
			navigationCatalog,
		},
	);
}
