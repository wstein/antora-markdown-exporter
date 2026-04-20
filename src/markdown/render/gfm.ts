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
	}
}

function renderBlock(block: MarkdownBlock): string {
	switch (block.type) {
		case "heading":
			return `${"#".repeat(block.depth)} ${block.children.map(renderInline).join("")}`;
		case "paragraph":
			return block.children.map(renderInline).join("");
		case "unsupported":
			return `> Unsupported: ${block.reason}`;
	}
}

export function renderGfm(document: MarkdownDocument): string {
	return `${document.children.map(renderBlock).join("\n\n")}\n`;
}
