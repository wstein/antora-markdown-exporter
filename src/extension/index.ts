import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { configure } from "@antora/assembler";
import { extractAssemblyStructure } from "../adapter/asciidoctor-structure.js";
import { convertAssemblyStructureToMarkdownIR } from "../exporter/structured-to-ir.js";
import type { MarkdownFlavorName } from "../markdown/flavor.js";
import type {
	MarkdownBlock,
	MarkdownDocument,
	MarkdownInline,
} from "../markdown/ir.js";
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
	readonly exportedPageUrlMap?: ReadonlyMap<string, string>;
	readonly flavor: MarkdownFlavorName;
	readonly xrefFallbackLabelStyle: XrefFallbackLabelStyle;
};

type ConvertAttributes = {
	docfile: string;
	outdir: string;
	outfile: string;
	outfilesuffix: string;
} & Record<string, unknown>;

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

function extractStringAttributes(
	attributes: Record<string, unknown>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(attributes).flatMap(([key, value]) =>
			typeof value === "string" ? [[key, value]] : [],
		),
	);
}

function normalizeSiteBasePath(
	siteUrl: string | undefined,
): string | undefined {
	if (siteUrl === undefined || siteUrl.length === 0) {
		return undefined;
	}

	try {
		const pathname = new URL(siteUrl).pathname.replace(/\/$/u, "");
		return pathname.length === 0 ? undefined : pathname;
	} catch {
		return undefined;
	}
}

function resolveExportedPageUrl(
	url: string,
	exportedPageUrlMap: ReadonlyMap<string, string>,
	siteBasePath?: string,
): string | undefined {
	const mappedUrl = exportedPageUrlMap.get(url);
	if (mappedUrl !== undefined) {
		return mappedUrl;
	}

	try {
		const pathname = new URL(url).pathname;
		const normalizedPathname =
			siteBasePath !== undefined && pathname.startsWith(`${siteBasePath}/`)
				? pathname.slice(siteBasePath.length)
				: pathname;
		return (
			exportedPageUrlMap.get(pathname) ??
			exportedPageUrlMap.get(normalizedPathname)
		);
	} catch {
		return undefined;
	}
}

function rewriteExportedPageLinkInlines(
	inlines: MarkdownInline[],
	exportedPageUrlMap: ReadonlyMap<string, string>,
	siteBasePath?: string,
): MarkdownInline[] {
	return inlines.map((inline) => {
		switch (inline.type) {
			case "emphasis":
			case "strong":
				return {
					...inline,
					children: rewriteExportedPageLinkInlines(
						inline.children,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			case "link":
				return {
					...inline,
					url:
						resolveExportedPageUrl(
							inline.url,
							exportedPageUrlMap,
							siteBasePath,
						) ?? inline.url,
					children: rewriteExportedPageLinkInlines(
						inline.children,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			case "xref":
				return {
					...inline,
					url:
						resolveExportedPageUrl(
							inline.url,
							exportedPageUrlMap,
							siteBasePath,
						) ?? inline.url,
					children: rewriteExportedPageLinkInlines(
						inline.children,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			case "image":
				return {
					...inline,
					alt: rewriteExportedPageLinkInlines(
						inline.alt,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			default:
				return inline;
		}
	});
}

function rewriteExportedPageLinkBlocks(
	blocks: MarkdownBlock[],
	exportedPageUrlMap: ReadonlyMap<string, string>,
	siteBasePath?: string,
): MarkdownBlock[] {
	return blocks.map((block) => {
		switch (block.type) {
			case "paragraph":
			case "heading":
				return {
					...block,
					children: rewriteExportedPageLinkInlines(
						block.children,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			case "blockquote":
			case "admonition":
				return {
					...block,
					children: rewriteExportedPageLinkBlocks(
						block.children,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			case "list":
				return {
					...block,
					items: block.items.map((item) => ({
						...item,
						children: rewriteExportedPageLinkBlocks(
							item.children,
							exportedPageUrlMap,
							siteBasePath,
						),
					})),
				};
			case "labeledGroup":
				return {
					...block,
					label: rewriteExportedPageLinkInlines(
						block.label,
						exportedPageUrlMap,
						siteBasePath,
					),
					children: rewriteExportedPageLinkBlocks(
						block.children,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			case "table":
				return {
					...block,
					caption:
						block.caption === undefined
							? undefined
							: rewriteExportedPageLinkInlines(
									block.caption,
									exportedPageUrlMap,
									siteBasePath,
								),
					header: {
						...block.header,
						cells: block.header.cells.map((cell) => ({
							...cell,
							children: rewriteExportedPageLinkInlines(
								cell.children,
								exportedPageUrlMap,
								siteBasePath,
							),
						})),
					},
					rows: block.rows.map((row) => ({
						...row,
						cells: row.cells.map((cell) => ({
							...cell,
							children: rewriteExportedPageLinkInlines(
								cell.children,
								exportedPageUrlMap,
								siteBasePath,
							),
						})),
					})),
				};
			case "calloutList":
				return {
					...block,
					items: block.items.map((item) => ({
						...item,
						children: rewriteExportedPageLinkBlocks(
							item.children,
							exportedPageUrlMap,
							siteBasePath,
						),
					})),
				};
			case "footnoteDefinition":
				return {
					...block,
					children: rewriteExportedPageLinkBlocks(
						block.children,
						exportedPageUrlMap,
						siteBasePath,
					),
				};
			default:
				return block;
		}
	});
}

function rewriteExportedPageLinks(
	document: MarkdownDocument,
	exportedPageUrlMap: ReadonlyMap<string, string>,
	siteBasePath?: string,
): MarkdownDocument {
	if (exportedPageUrlMap.size === 0) {
		return document;
	}

	return {
		...document,
		children: rewriteExportedPageLinkBlocks(
			document.children,
			exportedPageUrlMap,
			siteBasePath,
		),
	};
}

export function renderAssemblyMarkdown(
	source: string,
	flavor: MarkdownFlavorName = defaultFlavor,
	sourcePath = "assembly.adoc",
	options: {
		attributes?: Record<string, string>;
		exportedPageUrlMap?: ReadonlyMap<string, string>;
		xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
	} = {},
): string {
	const structured = extractAssemblyStructure(source, {
		attributes: options.attributes,
		sourcePath,
		xrefFallbackLabelStyle: options.xrefFallbackLabelStyle,
	});
	return renderMarkdown(
		rewriteExportedPageLinks(
			normalizeMarkdownIR(convertAssemblyStructureToMarkdownIR(structured)),
			options.exportedPageUrlMap ?? new Map(),
			normalizeSiteBasePath(
				options.attributes?.["site-url"] ??
					options.attributes?.["primary-site-url"],
			),
		),
		flavor,
	);
}

export function createMarkdownConverter(
	config: Partial<MarkdownConverterConfig> = {},
) {
	const flavor = config.flavor ?? defaultFlavor;
	const xrefFallbackLabelStyle =
		config.xrefFallbackLabelStyle ?? "fragment-or-basename";
	let exportedPageUrlMap =
		config.exportedPageUrlMap ?? new Map<string, string>();

	return {
		backend: "markdown",
		extname: ".md",
		mediaType: "text/markdown",
		loggerName: "@wsmy/antora-markdown-exporter",
		setExportedPageUrlMap(value: ReadonlyMap<string, string>) {
			exportedPageUrlMap = value;
		},
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
					attributes: extractStringAttributes(convertAttributes),
					exportedPageUrlMap,
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
