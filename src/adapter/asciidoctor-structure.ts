import { extractBlock } from "./asciidoctor-structure/blocks.js";
import { parseInlineHtmlWithOptions } from "./asciidoctor-structure/inline.js";
import { parseRenderOptions } from "./asciidoctor-structure/render-options.js";
import { createAsciidoctor } from "./asciidoctor-structure/shared.js";
import type { ExtractAssemblyStructureOptions } from "./asciidoctor-structure/types.js";
import { applyXrefFallbackLabelStyleToBlocks } from "./asciidoctor-structure/xref.js";
import type { AssemblyBlock, AssemblyDocument } from "./assembly-structure.js";
import { defineAssemblyDocument } from "./assembly-structure.js";

export type { ExtractAssemblyStructureOptions } from "./asciidoctor-structure/types.js";

export function extractAssemblyStructure(
	source: string,
	options: ExtractAssemblyStructureOptions = {},
): AssemblyDocument {
	const asciidoctor = createAsciidoctor();
	const document = asciidoctor.load(source, {
		safe: "safe",
		sourcemap: true,
		attributes: options.attributes,
	});
	const pageAliases = document.getAttribute("page-aliases");
	const hasDocumentTitle = document.hasHeader?.() === true;
	const children: AssemblyBlock[] = [];

	if (pageAliases !== undefined) {
		children.push({
			type: "pageAliases",
			aliases: pageAliases
				.split(",")
				.map((alias) => alias.trim())
				.filter(Boolean),
		});
	}

	if (hasDocumentTitle) {
		children.push({
			type: "heading",
			depth: 1,
			children: parseInlineHtmlWithOptions(
				document.getDocumentTitle?.() ?? "",
				options,
			),
		});
	}

	for (const block of document.getBlocks()) {
		children.push(...extractBlock(block, options));
	}

	const xrefFallbackLabelStyle =
		options.xrefFallbackLabelStyle ?? "fragment-or-basename";

	return defineAssemblyDocument({
		type: "document",
		source: {
			backend: "assembler-structure",
			path: options.sourcePath,
		},
		metadata: {
			attributes: document.getAttributes(),
			component: document.getAttribute("page-component-name"),
			version: document.getAttribute("page-component-version"),
			module: document.getAttribute("page-module"),
			relativeSrcPath: document.getAttribute("page-relative-src-path"),
		},
		renderOptions: parseRenderOptions(document),
		children: applyXrefFallbackLabelStyleToBlocks(
			children,
			xrefFallbackLabelStyle,
		),
	});
}
