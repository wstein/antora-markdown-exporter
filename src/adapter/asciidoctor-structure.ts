import { extractBlock } from "./asciidoctor-structure/blocks.js";
import { parseInlineHtmlWithOptions } from "./asciidoctor-structure/inline.js";
import { parseRenderOptions } from "./asciidoctor-structure/render-options.js";
import { createAsciidoctor } from "./asciidoctor-structure/shared.js";
import type { ExtractAssemblyStructureOptions } from "./asciidoctor-structure/types.js";
import type {
	AssemblyBlock,
	AssemblyDocument,
	AssemblyInline,
} from "./assembly-structure.js";
import { defineAssemblyDocument } from "./assembly-structure.js";

export type { ExtractAssemblyStructureOptions } from "./asciidoctor-structure/types.js";

function collectReferencedFootnoteIdentifiers(
	children: AssemblyBlock[],
): Set<string> {
	const identifiers = new Set<string>();

	function visitBlocks(blocks: AssemblyBlock[]): void {
		for (const block of blocks) {
			switch (block.type) {
				case "paragraph":
				case "heading":
					for (const inline of block.children) {
						visitInline(inline);
					}
					break;
				case "blockquote":
				case "admonition":
					visitBlocks(block.children);
					break;
				case "list":
					for (const item of block.items) visitBlocks(item.children);
					break;
				case "labeledGroup":
					for (const inline of block.label) visitInline(inline);
					visitBlocks(block.children);
					break;
				case "table":
					if (block.caption !== undefined) {
						for (const inline of block.caption) visitInline(inline);
					}
					for (const cell of block.header.cells) {
						for (const inline of cell.children) visitInline(inline);
					}
					for (const row of block.rows) {
						for (const cell of row.cells) {
							for (const inline of cell.children) visitInline(inline);
						}
					}
					break;
				case "calloutList":
					for (const item of block.items) visitBlocks(item.children);
					break;
				case "footnoteDefinition":
				case "anchor":
				case "pageAliases":
				case "thematicBreak":
				case "codeBlock":
				case "htmlBlock":
				case "unsupported":
					break;
			}
		}
	}

	function visitInline(inline: AssemblyInline): void {
		switch (inline.type) {
			case "footnoteReference":
				identifiers.add(inline.identifier);
				break;
			case "emphasis":
			case "strong":
			case "link":
			case "xref":
				for (const child of inline.children) visitInline(child);
				break;
			case "image":
				for (const child of inline.alt) visitInline(child);
				break;
			case "text":
			case "code":
			case "hardBreak":
			case "softBreak":
			case "htmlInline":
			case "citation":
				break;
		}
	}

	visitBlocks(children);
	return identifiers;
}

export function extractAssemblyStructure(
	source: string,
	options: ExtractAssemblyStructureOptions = {},
): AssemblyDocument {
	const asciidoctor = createAsciidoctor();
	const document = asciidoctor.load(source, {
		safe: "safe",
		sourcemap: true,
		attributes: options.attributes,
		docfile: options.sourcePath,
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

	document.convert?.();
	const referencedFootnotes = collectReferencedFootnoteIdentifiers(children);

	for (const footnote of document.getFootnotes?.() ?? []) {
		const identifier = String(footnote.getIndex?.() ?? "");
		if (!referencedFootnotes.has(identifier)) {
			continue;
		}
		children.push({
			type: "footnoteDefinition",
			identifier,
			children: [
				{
					type: "paragraph",
					children: parseInlineHtmlWithOptions(
						footnote.getText?.() ?? "",
						options,
					),
				},
			],
		});
	}

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
		children,
	});
}
