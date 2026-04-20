import type {
	MarkdownBlock,
	MarkdownDocument,
	MarkdownInline,
	MarkdownListItem,
} from "./ir.js";

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
				value: node.value.replace(/\s+/g, " "),
			};
		case "emphasis":
			return {
				...node,
				children: normalizeInlineChildren(node.children),
			};
		case "link":
			return {
				...node,
				children: normalizeInlineChildren(node.children),
			};
		case "code":
			return node;
	}
}

function normalizeListItem(item: MarkdownListItem): MarkdownListItem {
	return {
		...item,
		children: item.children.map(normalizeBlock),
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
		case "codeBlock":
			return {
				...block,
				value: block.value.replace(/\s+$/, ""),
			};
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
