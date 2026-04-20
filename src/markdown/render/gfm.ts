import type { MarkdownBlock, MarkdownDocument, MarkdownInline } from "../ir.js";

function escapeMarkdownText(value: string): string {
	return value.replace(/[\\*_`[\]<>]/g, "\\$&");
}

function escapeMarkdownTitle(value: string): string {
	return value.replace(/"/g, '\\"');
}

function renderLinkDestination(url: string, title?: string): string {
	return title === undefined ? url : `${url} "${escapeMarkdownTitle(title)}"`;
}

function renderInline(node: MarkdownInline): string {
	switch (node.type) {
		case "text":
			return escapeMarkdownText(node.value);
		case "emphasis":
			return `*${node.children.map(renderInline).join("")}*`;
		case "strong":
			return `**${node.children.map(renderInline).join("")}**`;
		case "code":
			return `\`${node.value.replace(/`/g, "\\`")}\``;
		case "link":
			return `[${node.children.map(renderInline).join("")}](${renderLinkDestination(node.url, node.title)})`;
		case "image":
			return `![${node.alt.map(renderInline).join("")}](${renderLinkDestination(node.url, node.title)})`;
		case "hardBreak":
			return "\\\n";
		case "softBreak":
			return "\n";
		case "htmlInline":
			return node.value;
		case "footnoteReference":
			return `[^${node.identifier}]`;
		case "citation":
			return `[@${node.identifier}]`;
	}
}

function renderListItem(blocks: MarkdownBlock[], bullet: string): string {
	return blocks
		.map((block, index) => {
			const rendered = renderBlock(block).split("\n");
			const [firstLine, ...rest] = rendered;
			const prefix = index === 0 ? `${bullet} ` : "  ";

			return [
				`${prefix}${firstLine}`,
				...rest.map((line) => (line.length > 0 ? `  ${line}` : line)),
			].join("\n");
		})
		.join("\n");
}

function renderBlock(block: MarkdownBlock): string {
	switch (block.type) {
		case "heading":
			return `${"#".repeat(block.depth)} ${block.children.map(renderInline).join("")}`;
		case "paragraph":
			return block.children.map(renderInline).join("");
		case "thematicBreak":
			return "---";
		case "codeBlock":
			return `\`\`\`${block.language ?? ""}\n${block.value}\n\`\`\``;
		case "blockquote":
			return block.children
				.map(renderBlock)
				.join("\n\n")
				.split("\n")
				.map((line) => (line.length > 0 ? `> ${line}` : ">"))
				.join("\n");
		case "list":
			return block.items
				.map((item, index) =>
					renderListItem(
						item.children,
						block.ordered ? `${(block.start ?? 1) + index}.` : "-",
					),
				)
				.join("\n");
		case "table": {
			const header = `| ${block.header.cells.map((cell) => cell.children.map(renderInline).join("")).join(" | ")} |`;
			const alignments = block.align ?? [];
			const separator = `| ${block.header.cells
				.map((_, index) => {
					switch (alignments[index]) {
						case "left":
							return ":---";
						case "center":
							return ":---:";
						case "right":
							return "---:";
						default:
							return "---";
					}
				})
				.join(" | ")} |`;
			const rows = block.rows.map(
				(row) =>
					`| ${row.cells.map((cell) => cell.children.map(renderInline).join("")).join(" | ")} |`,
			);
			return [header, separator, ...rows].join("\n");
		}
		case "htmlBlock":
			return block.value;
		case "footnoteDefinition": {
			const [first, ...rest] = block.children;
			if (first?.type === "paragraph") {
				const lines = [
					`[^${block.identifier}]: ${first.children.map(renderInline).join("")}`,
					...rest.flatMap((child) =>
						renderBlock(child)
							.split("\n")
							.map((line) => `    ${line}`),
					),
				];
				return lines.join("\n");
			}

			return [
				`[^${block.identifier}]:`,
				...block.children.flatMap((child) =>
					renderBlock(child)
						.split("\n")
						.map((line) => `    ${line}`),
				),
			].join("\n");
		}
		case "unsupported":
			return `> Unsupported: ${block.reason}`;
	}
}

export function renderGfm(document: MarkdownDocument): string {
	return `${document.children.map(renderBlock).join("\n\n")}\n`;
}
