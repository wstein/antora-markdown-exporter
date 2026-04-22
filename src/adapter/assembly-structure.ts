export type AssemblySourceLocation = {
	column?: number;
	line?: number;
	path?: string;
};

export type AssemblyText = {
	type: "text";
	value: string;
	location?: AssemblySourceLocation;
};

export type AssemblyEmphasis = {
	type: "emphasis";
	children: AssemblyInline[];
	location?: AssemblySourceLocation;
};

export type AssemblyStrong = {
	type: "strong";
	children: AssemblyInline[];
	location?: AssemblySourceLocation;
};

export type AssemblyCode = {
	type: "code";
	value: string;
	location?: AssemblySourceLocation;
};

export type AssemblyLink = {
	type: "link";
	url: string;
	title?: string;
	attributes?: Record<string, string>;
	children: AssemblyInline[];
	location?: AssemblySourceLocation;
};

export type AssemblyXrefFamilyKind =
	| "attachment"
	| "example"
	| "image"
	| "other"
	| "page"
	| "partial";

export type AssemblyXrefFamily = {
	kind: AssemblyXrefFamilyKind;
	name: string;
};

export type AssemblyXrefTarget = {
	component?: string;
	family?: AssemblyXrefFamily;
	fragment?: string;
	module?: string;
	path: string;
	raw: string;
	version?: string;
};

export type AssemblyXref = {
	type: "xref";
	target: AssemblyXrefTarget;
	url: string;
	title?: string;
	children: AssemblyInline[];
	attributes?: Record<string, string>;
	location?: AssemblySourceLocation;
};

export type AssemblyImage = {
	type: "image";
	url: string;
	title?: string;
	alt: AssemblyInline[];
	attributes?: Record<string, string>;
	location?: AssemblySourceLocation;
};

export type AssemblyHardBreak = {
	type: "hardBreak";
	location?: AssemblySourceLocation;
};

export type AssemblySoftBreak = {
	type: "softBreak";
	location?: AssemblySourceLocation;
};

export type AssemblyHtmlInline = {
	type: "htmlInline";
	value: string;
	location?: AssemblySourceLocation;
};

export type AssemblyFootnoteReference = {
	type: "footnoteReference";
	identifier: string;
	label?: string;
	location?: AssemblySourceLocation;
};

export type AssemblyCitation = {
	type: "citation";
	identifier: string;
	label?: string;
	location?: AssemblySourceLocation;
};

export type AssemblyInline =
	| AssemblyText
	| AssemblyEmphasis
	| AssemblyStrong
	| AssemblyCode
	| AssemblyLink
	| AssemblyXref
	| AssemblyImage
	| AssemblyHardBreak
	| AssemblySoftBreak
	| AssemblyHtmlInline
	| AssemblyFootnoteReference
	| AssemblyCitation;

export type AssemblyParagraph = {
	type: "paragraph";
	children: AssemblyInline[];
	location?: AssemblySourceLocation;
};

export type AssemblyHeading = {
	type: "heading";
	depth: number;
	identifier?: string;
	children: AssemblyInline[];
	location?: AssemblySourceLocation;
};

export type AssemblyAnchor = {
	type: "anchor";
	identifier: string;
	location?: AssemblySourceLocation;
};

export type AssemblyPageAliases = {
	type: "pageAliases";
	aliases: string[];
	location?: AssemblySourceLocation;
};

export type AssemblyThematicBreak = {
	type: "thematicBreak";
	location?: AssemblySourceLocation;
};

export type AssemblyCodeBlock = {
	type: "codeBlock";
	language?: string;
	meta?: string;
	value: string;
	callouts?: number[];
	location?: AssemblySourceLocation;
};

export type AssemblyBlockQuote = {
	type: "blockquote";
	children: AssemblyBlock[];
	location?: AssemblySourceLocation;
};

export type AssemblyAdmonitionKind =
	| "note"
	| "tip"
	| "important"
	| "caution"
	| "warning";

export type AssemblyAdmonition = {
	type: "admonition";
	kind: AssemblyAdmonitionKind;
	children: AssemblyBlock[];
	location?: AssemblySourceLocation;
};

export type AssemblyListItem = {
	children: AssemblyBlock[];
	location?: AssemblySourceLocation;
};

export type AssemblyList = {
	type: "list";
	ordered: boolean;
	start?: number;
	tight?: boolean;
	items: AssemblyListItem[];
	location?: AssemblySourceLocation;
};

export type AssemblyLabeledGroup = {
	type: "labeledGroup";
	label: AssemblyInline[];
	children: AssemblyBlock[];
	location?: AssemblySourceLocation;
};

export type AssemblyTableCell = {
	children: AssemblyInline[];
	location?: AssemblySourceLocation;
};

export type AssemblyTableRow = {
	cells: AssemblyTableCell[];
	location?: AssemblySourceLocation;
};

export type AssemblyTable = {
	type: "table";
	align?: Array<"left" | "center" | "right" | null>;
	caption?: AssemblyInline[];
	header: AssemblyTableRow;
	rows: AssemblyTableRow[];
	location?: AssemblySourceLocation;
};

export type AssemblyCalloutListItem = {
	ordinal: number;
	children: AssemblyBlock[];
	location?: AssemblySourceLocation;
};

export type AssemblyCalloutList = {
	type: "calloutList";
	items: AssemblyCalloutListItem[];
	location?: AssemblySourceLocation;
};

export type AssemblyHtmlBlock = {
	type: "htmlBlock";
	value: string;
	location?: AssemblySourceLocation;
};

export type AssemblyFootnoteDefinition = {
	type: "footnoteDefinition";
	identifier: string;
	children: AssemblyBlock[];
	location?: AssemblySourceLocation;
};

export type AssemblyUnsupported = {
	type: "unsupported";
	reason: string;
	location?: AssemblySourceLocation;
};

export type AssemblyBlock =
	| AssemblyParagraph
	| AssemblyHeading
	| AssemblyAnchor
	| AssemblyPageAliases
	| AssemblyThematicBreak
	| AssemblyCodeBlock
	| AssemblyBlockQuote
	| AssemblyAdmonition
	| AssemblyList
	| AssemblyLabeledGroup
	| AssemblyTable
	| AssemblyCalloutList
	| AssemblyHtmlBlock
	| AssemblyFootnoteDefinition
	| AssemblyUnsupported;

export type AssemblyHeadingNumberingMode = "book" | "section";

export type AssemblyRenderOptions = {
	headingNumbering?: {
		mode: AssemblyHeadingNumberingMode;
	};
	tableOfContents?: {
		maxDepth?: number;
	};
};

export type AssemblyDocumentMetadata = {
	attributes?: Record<string, string>;
	component?: string;
	family?: string;
	module?: string;
	pageId?: string;
	relativeSrcPath?: string;
	version?: string;
};

export type AssemblyDocument = {
	type: "document";
	children: AssemblyBlock[];
	metadata?: AssemblyDocumentMetadata;
	renderOptions?: AssemblyRenderOptions;
	source?: {
		backend: "assembler-structure";
		path?: string;
	};
};

export type AssemblyStructureInvariant = {
	id:
		| "repository-owned-boundary"
		| "structured-loss"
		| "source-location"
		| "unsupported-nodes"
		| "inline-fallback";
	summary: string;
	requirements: string[];
};

export const assemblyStructureInvariants: AssemblyStructureInvariant[] = [
	{
		id: "repository-owned-boundary",
		summary:
			"The adapter contract is repository-owned and intentionally distinct from upstream Asciidoctor objects and the downstream Markdown IR.",
		requirements: [
			"Extractor code may depend on upstream Asciidoctor objects internally, but those objects must not escape the adapter boundary.",
			"Lowering and rendering code must consume AssemblyDocument nodes rather than reparsing assembled source text.",
			"New semantic coverage must extend this contract explicitly instead of hiding meaning in renderer-local string rewrites.",
		],
	},
	{
		id: "structured-loss",
		summary:
			"Loss at the adapter boundary must be explicit, narrow, and reviewable rather than implicit or silent.",
		requirements: [
			"When upstream structure cannot be represented faithfully yet, the extractor must emit visible unsupported or fallback nodes instead of pretending the construct was preserved.",
			"Inline fallback may preserve undecoded HTML fragments as text or htmlInline nodes only when richer semantic nodes are unavailable.",
			"Loss rules belong in the contract and support matrix so contributors can review what is intentionally preserved, degraded, or deferred.",
		],
	},
	{
		id: "source-location",
		summary:
			"Source locations are best-effort provenance metadata, not a completeness guarantee.",
		requirements: [
			"Locations may be omitted when upstream nodes do not expose stable path or line information.",
			"When present, locations must describe the assembled source position the extractor actually observed rather than guessed original include locations.",
			"Downstream stages must preserve provided locations when copying or lowering equivalent semantic nodes.",
		],
	},
	{
		id: "unsupported-nodes",
		summary:
			"Unsupported nodes are explicit contract markers for semantic gaps, not internal error placeholders.",
		requirements: [
			"Unsupported reasons should identify the missing structural coverage family clearly enough for tests, docs, and operators to review.",
			"Unsupported nodes must remain visible through lowering and fallback policy until the semantic gap is modeled explicitly.",
			"Contributors should delete unsupported cases by adding first-class semantic support, not by hiding them in lossy renderer behavior.",
		],
	},
	{
		id: "inline-fallback",
		summary:
			"Malformed or partial inline markup must fall back deterministically instead of being reparsed by ad-hoc heuristics.",
		requirements: [
			"Broken inline HTML-like fragments may survive as plain text when they cannot be mapped confidently to semantic nodes.",
			"Xref fallback labels are display policy, not meaning; the target metadata remains canonical even when the visible label changes.",
			"Inline extraction may decode safe literal entities, but it must not invent semantics that the structured source did not provide.",
		],
	},
] as const;

export function defineAssemblyDocument(
	document: AssemblyDocument,
): AssemblyDocument {
	return document;
}
