export {
	type ExtractAssemblyStructureOptions,
	extractAssemblyStructure,
} from "./adapter/asciidoctor-structure.js";
export {
	type AssemblyAdmonition,
	type AssemblyAdmonitionKind,
	type AssemblyAnchor,
	type AssemblyBlock,
	type AssemblyBlockQuote,
	type AssemblyCode,
	type AssemblyCodeBlock,
	type AssemblyDocument,
	type AssemblyDocumentMetadata,
	type AssemblyEmphasis,
	type AssemblyHardBreak,
	type AssemblyHeading,
	type AssemblyHeadingNumberingMode,
	type AssemblyHtmlBlock,
	type AssemblyHtmlInline,
	type AssemblyImage,
	type AssemblyInline,
	type AssemblyLink,
	type AssemblyList,
	type AssemblyListItem,
	type AssemblyPageAliases,
	type AssemblyParagraph,
	type AssemblyRenderOptions,
	type AssemblySoftBreak,
	type AssemblySourceLocation,
	type AssemblyStrong,
	type AssemblyTable,
	type AssemblyTableCell,
	type AssemblyTableRow,
	type AssemblyText,
	type AssemblyThematicBreak,
	type AssemblyUnsupported,
	type AssemblyXref,
	type AssemblyXrefFamily,
	type AssemblyXrefFamilyKind,
	type AssemblyXrefTarget,
	defineAssemblyDocument,
} from "./adapter/assembly-structure.js";
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
