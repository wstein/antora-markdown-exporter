export { convertAssemblyToMarkdownIR } from "./exporter/convert-assembly.js";
export {
	createMarkdownConverter,
	register,
	renderAssemblyMarkdown,
} from "./extension/index.js";
export type {
	MarkdownFlavorName,
	MarkdownFlavorSpec,
} from "./markdown/flavor.js";
export {
	markdownFlavorSpecs,
	resolveMarkdownFlavor,
} from "./markdown/flavor.js";
export {
	collectIncludeDiagnostics,
	collectIncludeDirectives,
	collectMarkdownInspectionReport,
	collectXrefs,
	collectXrefTargets,
} from "./markdown/include-diagnostics.js";
export type { MarkdownDocument } from "./markdown/ir.js";
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
	return "Antora Assembler based Markdown exporter with semantic IR, inspection surfaces, and explicit Markdown flavor rendering.";
}
