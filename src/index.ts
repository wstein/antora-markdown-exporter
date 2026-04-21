export { createAntoraExtensionScaffold } from "./extension/index.js";
export { convertAssemblyToMarkdownIR } from "./exporter/convert-assembly.js";
export {
	collectIncludeDiagnostics,
	collectIncludeDirectives,
	collectXrefs,
	collectXrefTargets,
} from "./markdown/include-diagnostics.js";
export type { MarkdownDocument } from "./markdown/ir.js";
export type {
	MarkdownFlavorName,
	MarkdownFlavorSpec,
} from "./markdown/flavor.js";
export {
	markdownFlavorSpecs,
	resolveMarkdownFlavor,
} from "./markdown/flavor.js";
export { normalizeMarkdownIR } from "./markdown/normalize.js";
export {
	renderCommonMark,
	renderGfm,
	renderGitLab,
	renderMarkdown,
	renderStrict,
} from "./markdown/render/index.js";

export const PACKAGE_NAME = "@wsmy/antora-markdown-exporter";

export function describePackage() {
	return "Antora Assembler based Markdown exporter scaffold with semantic IR and a first GitHub Flavored Markdown rendering path.";
}
