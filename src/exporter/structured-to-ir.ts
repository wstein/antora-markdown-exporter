import type {
	AssemblyAdmonition,
	AssemblyBlock,
	AssemblyBlockQuote,
	AssemblyCalloutList,
	AssemblyCodeBlock,
	AssemblyDocument,
	AssemblyHtmlBlock,
	AssemblyInline,
	AssemblyLabeledGroup,
	AssemblyList,
	AssemblyParagraph,
	AssemblyTable,
} from "../adapter/assembly-structure.js";
import type {
	MarkdownBlock,
	MarkdownDocument,
	MarkdownHtmlBlock,
	MarkdownImage,
	MarkdownInline,
	MarkdownLink,
	MarkdownList,
	MarkdownParagraph,
	MarkdownTable,
	MarkdownXref,
} from "../markdown/ir.js";
import { resolveMarkdownSourceXrefDestination } from "../markdown/xref-resolution.js";

function convertInline(node: AssemblyInline): MarkdownInline {
	switch (node.type) {
		case "text":
			return {
				type: "text",
				value: node.value,
			};
		case "emphasis":
			return {
				type: "emphasis",
				children: node.children.map(convertInline),
			};
		case "strong":
			return {
				type: "strong",
				children: node.children.map(convertInline),
			};
		case "code":
			return {
				type: "code",
				value: node.value,
			};
		case "link":
			return <MarkdownLink>{
				type: "link",
				url: node.url,
				title: node.title,
				attributes: node.attributes,
				children: node.children.map(convertInline),
			};
		case "xref":
			return <MarkdownXref>{
				type: "xref",
				url: resolveMarkdownSourceXrefDestination(node.target, node.url),
				title: node.title,
				target: node.target,
				children: node.children.map(convertInline),
				location: node.location,
			};
		case "image":
			return <MarkdownImage>{
				type: "image",
				url: node.url,
				title: node.title,
				attributes: node.attributes,
				alt: node.alt.map(convertInline),
			};
		case "hardBreak":
			return { type: "hardBreak" };
		case "softBreak":
			return { type: "softBreak" };
		case "htmlInline":
			return {
				type: "htmlInline",
				value: node.value,
			};
		case "footnoteReference":
			return {
				type: "footnoteReference",
				identifier: node.identifier,
				label: node.label,
			};
		case "citation":
			return {
				type: "citation",
				identifier: node.identifier,
				label: node.label,
			};
	}
}

function convertParagraph(node: AssemblyParagraph): MarkdownParagraph {
	return {
		type: "paragraph",
		children: node.children.map(convertInline),
	};
}

function convertList(node: AssemblyList): MarkdownList {
	return {
		type: "list",
		ordered: node.ordered,
		start: node.start,
		tight: node.tight,
		items: node.items.map((item) => ({
			children: item.children.map(convertBlock),
		})),
	};
}

function convertLabeledGroup(node: AssemblyLabeledGroup): MarkdownBlock {
	return {
		type: "labeledGroup",
		label: node.label.map(convertInline),
		children: node.children.map(convertBlock),
	};
}

function convertAdmonition(node: AssemblyAdmonition): MarkdownBlock {
	return {
		type: "admonition",
		kind: node.kind,
		children: node.children.map(convertBlock),
	};
}

function convertTable(node: AssemblyTable): MarkdownTable {
	return {
		type: "table",
		align: node.align,
		caption: node.caption?.map(convertInline),
		header: {
			cells: node.header.cells.map((cell) => ({
				children: cell.children.map(convertInline),
			})),
		},
		rows: node.rows.map((row) => ({
			cells: row.cells.map((cell) => ({
				children: cell.children.map(convertInline),
			})),
		})),
	};
}

function convertCalloutList(node: AssemblyCalloutList): MarkdownBlock {
	return {
		type: "calloutList",
		items: node.items.map((item) => ({
			ordinal: item.ordinal,
			children: item.children.map(convertBlock),
		})),
	};
}

function convertCodeBlock(node: AssemblyCodeBlock): MarkdownBlock {
	return {
		type: "codeBlock",
		language: node.language,
		meta: node.meta,
		value: node.value,
		callouts: node.callouts,
	};
}

function convertBlockQuote(node: AssemblyBlockQuote): MarkdownBlock {
	return {
		type: "blockquote",
		children: node.children.map(convertBlock),
	};
}

function convertHtmlBlock(node: AssemblyHtmlBlock): MarkdownHtmlBlock {
	return {
		type: "htmlBlock",
		value: node.value,
	};
}

function convertBlock(node: AssemblyBlock): MarkdownBlock {
	switch (node.type) {
		case "paragraph":
			return convertParagraph(node);
		case "heading":
			return {
				type: "heading",
				depth: node.depth,
				identifier: node.identifier,
				children: node.children.map(convertInline),
				location: node.location,
			};
		case "anchor":
			return {
				type: "anchor",
				identifier: node.identifier,
				location: node.location,
			};
		case "pageAliases":
			return {
				type: "pageAliases",
				aliases: [...node.aliases],
				location: node.location,
			};
		case "thematicBreak":
			return { type: "thematicBreak" };
		case "codeBlock":
			return convertCodeBlock(node);
		case "blockquote":
			return convertBlockQuote(node);
		case "admonition":
			return convertAdmonition(node);
		case "list":
			return convertList(node);
		case "labeledGroup":
			return convertLabeledGroup(node);
		case "table":
			return convertTable(node);
		case "calloutList":
			return convertCalloutList(node);
		case "htmlBlock":
			return convertHtmlBlock(node);
		case "footnoteDefinition":
			return {
				type: "footnoteDefinition",
				identifier: node.identifier,
				children: node.children.map(convertBlock),
			};
		case "unsupported":
			return {
				type: "unsupported",
				reason: node.reason,
			};
	}
}

export function convertAssemblyStructureToMarkdownIR(
	document: AssemblyDocument,
): MarkdownDocument {
	return {
		type: "document",
		metadata: document.metadata,
		renderOptions: document.renderOptions,
		children: document.children.map(convertBlock),
	};
}
