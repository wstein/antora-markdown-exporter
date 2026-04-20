export { registerAntoraExtension } from "./extension/index.js";
export { convertAssemblyToMarkdownIR } from "./exporter/convert-assembly.js";
export type { MarkdownDocument } from "./markdown/ir.js";

export const PACKAGE_NAME = "@wsmy/antora-markdown-exporter";

export function describePackage() {
	return "Antora Assembler based Markdown exporter with semantic IR and multi-flavor rendering.";
}
