import type { MarkdownDocument } from "../ir.js";
import { renderMarkdown } from "./markdown.js";

export function renderGfm(document: MarkdownDocument): string {
	return renderMarkdown(document, "gfm");
}
