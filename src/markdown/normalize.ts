import type {
	MarkdownBlock,
	MarkdownCalloutListItem,
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
				attributes:
					node.attributes === undefined
						? undefined
						: Object.fromEntries(
								Object.entries(node.attributes)
									.map(([key, value]) => [key.trim(), value.trim()])
									.filter(([key, value]) => key.length > 0 && value.length > 0),
							),
				children: normalizeInlineChildren(node.children),
			};
		case "xref":
			return {
				...node,
				url: node.url.trim(),
				title: node.title?.trim(),
				target: {
					...node.target,
					raw: node.target.raw.trim(),
					path: node.target.path.trim(),
					component: node.target.component?.trim(),
					version: node.target.version?.trim(),
					module: node.target.module?.trim(),
					family:
						node.target.family === undefined
							? undefined
							: {
									kind: node.target.family.kind,
									name: node.target.family.name.trim(),
								},
					fragment: node.target.fragment?.trim(),
				},
				children: normalizeInlineChildren(node.children),
			};
		case "image":
			return {
				...node,
				url: node.url.trim(),
				title: node.title?.trim(),
				attributes:
					node.attributes === undefined
						? undefined
						: Object.fromEntries(
								Object.entries(node.attributes)
									.map(([key, value]) => [key.trim(), value.trim()])
									.filter(([key, value]) => key.length > 0 && value.length > 0),
							),
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

function normalizeCalloutListItem(
	item: MarkdownCalloutListItem,
): MarkdownCalloutListItem {
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
			return {
				...block,
				children: normalizeInlineChildren(block.children),
			};
		case "heading":
			return {
				...block,
				identifier: block.identifier?.trim(),
				children: normalizeInlineChildren(block.children),
			};
		case "anchor":
			return {
				...block,
				identifier: block.identifier.trim(),
			};
		case "pageAliases":
			return {
				...block,
				aliases: block.aliases.map((alias) => alias.trim()).filter(Boolean),
			};
		case "blockquote":
		case "admonition":
			return {
				...block,
				children: block.children.map(normalizeBlock),
			};
		case "list":
			return {
				...block,
				items: block.items.map(normalizeListItem),
			};
		case "labeledGroup":
			return {
				...block,
				label: normalizeInlineChildren(block.label),
				children: block.children.map(normalizeBlock),
			};
		case "calloutList":
			return {
				...block,
				items: block.items.map(normalizeCalloutListItem),
			};
		case "table":
			return {
				...block,
				caption:
					block.caption === undefined
						? undefined
						: normalizeInlineChildren(block.caption),
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
		metadata:
			document.metadata === undefined
				? undefined
				: {
						attributes:
							document.metadata.attributes === undefined
								? undefined
								: Object.fromEntries(
										Object.entries(document.metadata.attributes)
											.map(([key, value]) => [key.trim(), String(value).trim()])
											.filter(
												([key, value]) => key.length > 0 && value.length > 0,
											),
									),
						component: document.metadata.component?.trim(),
						family: document.metadata.family?.trim(),
						module: document.metadata.module?.trim(),
						pageId: document.metadata.pageId?.trim(),
						relativeSrcPath: document.metadata.relativeSrcPath?.trim(),
						version: document.metadata.version?.trim(),
					},
		renderOptions:
			document.renderOptions === undefined
				? undefined
				: {
						headingNumbering:
							document.renderOptions.headingNumbering === undefined
								? undefined
								: {
										mode: document.renderOptions.headingNumbering.mode,
									},
						tableOfContents:
							document.renderOptions.tableOfContents === undefined
								? undefined
								: {
										maxDepth: document.renderOptions.tableOfContents.maxDepth,
									},
					},
		children: document.children.map(normalizeBlock),
	};
}
