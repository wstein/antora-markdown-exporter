import type { MarkdownFlavorSpec } from "./flavor.js";
import type { MarkdownHtmlBlock, MarkdownHtmlInline } from "./ir.js";

export type MarkdownRawHtmlNode = MarkdownHtmlBlock | MarkdownHtmlInline;

export type MarkdownRawHtmlFallbackContext = {
	annotate?: boolean;
	fallbackReason: string;
	unsupportedReason: string;
};

export function renderUnsupportedBlock(
	reason: string,
	flavor: MarkdownFlavorSpec,
): string {
	return `> ${flavor.blockFallbackLabel}: ${reason}`;
}

export function renderUnsupportedInline(
	reason: string,
	flavor: MarkdownFlavorSpec,
): string {
	return `[${flavor.blockFallbackLabel}: ${reason}]`;
}

export function resolveRawHtmlFallback(
	node: MarkdownRawHtmlNode,
	flavor: MarkdownFlavorSpec,
	context: MarkdownRawHtmlFallbackContext,
): string {
	if (!flavor.supportsRawHtml) {
		return node.type === "htmlBlock"
			? renderUnsupportedBlock(context.unsupportedReason, flavor)
			: renderUnsupportedInline(context.unsupportedReason, flavor);
	}

	if (node.type === "htmlBlock" && context.annotate !== false) {
		return [
			`<!-- fallback: raw_html reason=${context.fallbackReason} -->`,
			node.value,
			"<!-- /fallback: raw_html -->",
		].join("\n");
	}

	return node.value;
}
