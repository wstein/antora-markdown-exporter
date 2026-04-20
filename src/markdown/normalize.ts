import type {
	MarkdownBlock,
	MarkdownDocument,
	MarkdownInline,
	MarkdownListItem,
	MarkdownTableCell,
	MarkdownTableRow,
} from "./ir.js";

function normalizeTextValue(value: string): string {
	return value.replace(/\s+/g, " ");
}

function normalizeInlineChildren(children: MarkdownInline[]): MarkdownInline[] {
	const normalized = children.map(normalizeInline);

	for (let index = 0; index < normalized.length; index += 1) {
		const node = normalized[index];
		if (node?.type !== "text") {
			continue;
		}

		let value = node.value;
		if (index === 0) {
			value = value.replace(/^\s+/, "");
		}
		if (index === normalized.length - 1) {
			value = value.replace(/\s+$/, "");
		}

		normalized[index] = {
			...node,
			value,
		};
	}

	return normalized;
}

function normalizeInline(node: MarkdownInline): MarkdownInline {
	switch (node.type) {
		case "text":
			return {
				...node,
				value: normalizeTextValue(node.value),
			};
		case "emphasis":
		case "strong":
			return {
				...node,
				children: normalizeInlineChildren(node.children),
			};
		case "link":
			return {
				...node,
				url: node.url.trim(),
				title: node.title?.trim(),
				children: normalizeInlineChildren(node.children),
			};
		case "image":
			return {
				...node,
				url: node.url.trim(),
				title: node.title?.trim(),
				alt: normalizeInlineChildren(node.alt),
			};
		case "htmlInline":
			return {
				...node,
				value: node.value.trim(),
			};
		case "footnoteReference":
		case "citation":
			return {
				...node,
				identifier: node.identifier.trim(),
				label: node.label?.trim(),
			};
		case "hardBreak":
		case "softBreak":
			return node;
		case "code":
			return {
				...node,
				value: node.value.replace(/\s+$/, ""),
			};
	}
}

function normalizeListItem(item: MarkdownListItem): MarkdownListItem {
	return {
		...item,
		children: item.children.map(normalizeBlock),
	};
}

function normalizeTableCell(cell: MarkdownTableCell): MarkdownTableCell {
	return {
		...cell,
		children: normalizeInlineChildren(cell.children),
	};
}

function normalizeTableRow(row: MarkdownTableRow): MarkdownTableRow {
	return {
		...row,
		cells: row.cells.map(normalizeTableCell),
	};
}

function normalizeBlock(block: MarkdownBlock): MarkdownBlock {
	switch (block.type) {
		case "paragraph":
		case "heading":
			return {
				...block,
				children: normalizeInlineChildren(block.children),
			};
		case "blockquote":
			return {
				...block,
				children: block.children.map(normalizeBlock),
			};
		case "list":
			return {
				...block,
				items: block.items.map(normalizeListItem),
			};
		case "table":
			return {
				...block,
				header: normalizeTableRow(block.header),
				rows: block.rows.map(normalizeTableRow),
			};
		case "codeBlock":
			return {
				...block,
				language: block.language?.trim(),
				meta: block.meta?.trim(),
				value: block.value.replace(/\s+$/, ""),
			};
		case "htmlBlock":
			return {
				...block,
				value: block.value.trim(),
			};
		case "footnoteDefinition":
			return {
				...block,
				identifier: block.identifier.trim(),
				children: block.children.map(normalizeBlock),
			};
		case "thematicBreak":
		case "unsupported":
			return block;
	}
}

export function normalizeMarkdownIR(
	document: MarkdownDocument,
): MarkdownDocument {
	return {
		...document,
		children: document.children.map(normalizeBlock),
	};
}
