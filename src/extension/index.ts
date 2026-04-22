import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { configure } from "@antora/assembler";
import { extractAssemblyStructure } from "../adapter/asciidoctor-structure.js";
import { convertAssemblyStructureToMarkdownIR } from "../exporter/structured-to-ir.js";
import type { MarkdownFlavorName } from "../markdown/flavor.js";
import { normalizeMarkdownIR } from "../markdown/normalize.js";
import { renderMarkdown } from "../markdown/render/index.js";

export type XrefFallbackLabelStyle =
	| "fragment-or-basename"
	| "fragment-or-path";

export interface AntoraMarkdownExporterExtensionConfig {
	readonly flavor?: MarkdownFlavorName;
	readonly configSource?: Record<string, unknown> | string;
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

export function renderAssemblyMarkdown(
	source: string,
	flavor: MarkdownFlavorName = defaultFlavor,
	sourcePath = "assembly.adoc",
	options: {
		xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
	} = {},
): string {
	const structured = extractAssemblyStructure(source, {
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
				{ xrefFallbackLabelStyle },
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
		xrefFallbackLabelStyle,
		...assemblerConfig
	} = config;
	configure(
		this,
		createMarkdownConverter({ flavor, xrefFallbackLabelStyle }),
		assemblerConfig,
		{
			configSource,
			navigationCatalog,
		},
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
	console.error(
		"This module is an Antora extension entrypoint and should be loaded by Antora, not executed directly.",
	);
	process.exit(1);
}
