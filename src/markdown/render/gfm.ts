import type { MarkdownBlock, MarkdownDocument, MarkdownInline } from "../ir.js";

function escapeMarkdownText(value: string): string {
	return value.replace(/[\\*_`[\]<>]/g, "\\$&");
}

function renderInline(node: MarkdownInline): string {
	switch (node.type) {
		case "text":
			return escapeMarkdownText(node.value);
		case "emphasis":
			return `*${node.children.map(renderInline).join("")}*`;
		case "code":
			return `\`${node.value.replace(/`/g, "\\`")}\``;
		case "link":
			return `[${node.children.map(renderInline).join("")}](${node.url})`;
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
					renderListItem(item.children, block.ordered ? `${index + 1}.` : "-"),
				)
				.join("\n");
		case "unsupported":
			return `> Unsupported: ${block.reason}`;
	}
}

export function renderGfm(document: MarkdownDocument): string {
	return `${document.children.map(renderBlock).join("\n\n")}\n`;
}
