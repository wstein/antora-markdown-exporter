export { createAntoraExtensionScaffold } from "./extension/index.js";
export { convertAssemblyToMarkdownIR } from "./exporter/convert-assembly.js";
export type { MarkdownDocument } from "./markdown/ir.js";
export { normalizeMarkdownIR } from "./markdown/normalize.js";
export { renderGfm } from "./markdown/render/index.js";

export const PACKAGE_NAME = "@wsmy/antora-markdown-exporter";

export function describePackage() {
	return "Antora Assembler based Markdown exporter scaffold with semantic IR and a first GitHub Flavored Markdown rendering path.";
}
