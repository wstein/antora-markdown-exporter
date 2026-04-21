import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { configure } from "@antora/assembler";
import { convertAssemblyToMarkdownIR } from "../exporter/convert-assembly.js";
import type { MarkdownFlavorName } from "../markdown/flavor.js";
import type { MarkdownDocument, MarkdownInline } from "../markdown/ir.js";
import { normalizeMarkdownIR } from "../markdown/normalize.js";
import { renderMarkdown } from "../markdown/render/index.js";

export interface AntoraMarkdownExporterExtensionConfig {
	readonly flavor?: MarkdownFlavorName;
	readonly configSource?: Record<string, unknown> | string;
	readonly navigationCatalog?: {
		getNavigation: (component: string, version: string) => unknown[];
	};
	readonly configFile?: string;
	readonly configFiles?: string[];
}

type MarkdownConverterConfig = {
	readonly flavor: MarkdownFlavorName;
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

type TocEntry = {
	anchor: string;
	depth: number;
	text: string;
};

const defaultFlavor: MarkdownFlavorName = "gfm";

function inlineText(children: MarkdownInline[]): string {
	return children
		.map((child) => {
			switch (child.type) {
				case "text":
					return child.value;
				case "code":
					return child.value;
				case "emphasis":
				case "strong":
					return inlineText(child.children);
				case "link":
				case "xref":
					return inlineText(child.children);
				case "image":
					return inlineText(child.alt);
				case "hardBreak":
				case "softBreak":
					return " ";
				case "htmlInline":
					return "";
				case "footnoteReference":
					return child.label ?? child.identifier;
				case "citation":
					return child.label ?? child.identifier;
				default:
					return "";
			}
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.replace(/<\/?[a-z][^>]*>/gi, "")
		.replace(/<([^>]+)>/g, "$1")
		.replace(/[`*_~[\]()]/g, "")
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

function collectHeadingTocEntries(document: MarkdownDocument): TocEntry[] {
	const entries: TocEntry[] = [];
	let firstHeadingSeen = false;
	let pendingAnchor: string | undefined;

	for (const block of document.children) {
		if (block.type === "anchor") {
			pendingAnchor = block.identifier;
			continue;
		}

		if (block.type !== "heading") {
			pendingAnchor = undefined;
			continue;
		}

		if (!firstHeadingSeen) {
			firstHeadingSeen = true;
			pendingAnchor = undefined;
			continue;
		}

		const text = inlineText(block.children);
		if (!text) {
			pendingAnchor = undefined;
			continue;
		}

		entries.push({
			anchor: pendingAnchor ?? slugifyHeading(text),
			depth: block.depth,
			text,
		});
		pendingAnchor = undefined;
	}

	return entries;
}

export function prependMarkdownTableOfContents(
	document: MarkdownDocument,
	markdown: string,
): string {
	const entries = collectHeadingTocEntries(document);
	if (entries.length === 0) {
		return markdown;
	}

	const baseDepth = Math.min(...entries.map((entry) => entry.depth));
	const toc = [
		"## Table of Contents",
		"",
		...entries.map(
			(entry) =>
				`${"  ".repeat(entry.depth - baseDepth)}- [${entry.text}](#${entry.anchor})`,
		),
	].join("\n");

	const [firstLine, ...rest] = markdown.split("\n");
	if (firstLine === undefined) {
		return markdown;
	}

	return [firstLine, "", toc, "", ...rest]
		.join("\n")
		.replace(/\n{3,}/g, "\n\n");
}

export function renderAssemblyMarkdown(
	source: string,
	flavor: MarkdownFlavorName = defaultFlavor,
	sourcePath = "assembly.adoc",
): string {
	const document = normalizeMarkdownIR(
		convertAssemblyToMarkdownIR(source, {
			sourcePath,
			includeRootDir: dirname(sourcePath),
		}),
	);
	const markdown = renderMarkdown(document, flavor);
	return prependMarkdownTableOfContents(document, markdown);
}

export function createMarkdownConverter(
	config: Partial<MarkdownConverterConfig> = {},
) {
	const flavor = config.flavor ?? defaultFlavor;

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
			);
			await writeFile(outputPath, `${markdown}\n`);
		},
	} as const;
}

export function register(
	this: unknown,
	{ config = {} }: { config?: AntoraMarkdownExporterExtensionConfig } = {},
): void {
	const { configSource, flavor, navigationCatalog, ...assemblerConfig } =
		config;
	configure(this, createMarkdownConverter({ flavor }), assemblerConfig, {
		configSource,
		navigationCatalog,
	});
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
