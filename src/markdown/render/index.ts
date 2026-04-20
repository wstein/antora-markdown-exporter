export { renderGfm } from "./gfm.js";
export { renderMarkdown } from "./markdown.js";

import type { MarkdownDocument } from "../ir.js";
import { renderMarkdown } from "./markdown.js";

export function renderCommonMark(document: MarkdownDocument): string {
	return renderMarkdown(document, "commonmark");
}

export function renderGitLab(document: MarkdownDocument): string {
	return renderMarkdown(document, "gitlab");
}

export function renderStrict(document: MarkdownDocument): string {
	return renderMarkdown(document, "strict");
}
