export type MarkdownText = {
	type: "text";
	value: string;
};

export type MarkdownEmphasis = {
	type: "emphasis";
	children: MarkdownInline[];
};

export type MarkdownStrong = {
	type: "strong";
	children: MarkdownInline[];
};

export type MarkdownCode = {
	type: "code";
	value: string;
};

export type MarkdownLink = {
	type: "link";
	url: string;
	title?: string;
	children: MarkdownInline[];
};

export type MarkdownXrefFamilyKind =
	| "attachment"
	| "example"
	| "image"
	| "other"
	| "page"
	| "partial";

export type MarkdownXrefFamily = {
	kind: MarkdownXrefFamilyKind;
	name: string;
};

export type MarkdownXrefTarget = {
	component?: string;
	family?: MarkdownXrefFamily;
	fragment?: string;
	module?: string;
	path: string;
	raw: string;
	version?: string;
};

export type MarkdownXref = {
	type: "xref";
	target: MarkdownXrefTarget;
	url: string;
	title?: string;
	children: MarkdownInline[];
};

export type MarkdownImage = {
	type: "image";
	url: string;
	title?: string;
	alt: MarkdownInline[];
};

export type MarkdownHardBreak = {
	type: "hardBreak";
};

export type MarkdownSoftBreak = {
	type: "softBreak";
};

export type MarkdownHtmlInline = {
	type: "htmlInline";
	value: string;
};

export type MarkdownFootnoteReference = {
	type: "footnoteReference";
	identifier: string;
	label?: string;
};

export type MarkdownCitation = {
	type: "citation";
	identifier: string;
	label?: string;
};

export type MarkdownUnsupported = {
	type: "unsupported";
	reason: string;
};

export type MarkdownInline =
	| MarkdownText
	| MarkdownEmphasis
	| MarkdownStrong
	| MarkdownCode
	| MarkdownLink
	| MarkdownXref
	| MarkdownImage
	| MarkdownHardBreak
	| MarkdownSoftBreak
	| MarkdownHtmlInline
	| MarkdownFootnoteReference
	| MarkdownCitation;

export type MarkdownParagraph = {
	type: "paragraph";
	children: MarkdownInline[];
};

export type MarkdownHeading = {
	type: "heading";
	depth: number;
	identifier?: string;
	children: MarkdownInline[];
};

export type MarkdownAnchor = {
	type: "anchor";
	identifier: string;
};

export type MarkdownPageAliases = {
	type: "pageAliases";
	aliases: string[];
};

export type MarkdownIncludeLineRange = {
	end?: number;
	start?: number;
	step?: number;
};

export type MarkdownIncludeTagSelection = {
	precedence: "document-order";
	tags: string[];
};

export type MarkdownIncludeDiagnosticCode =
	| "empty-tag-selection"
	| "invalid-indent"
	| "invalid-leveloffset"
	| "invalid-line-range"
	| "invalid-line-step";

export type MarkdownIncludeDiagnostic = {
	code: MarkdownIncludeDiagnosticCode;
	message: string;
	source?: string;
};

export type MarkdownIncludeSemantics = {
	indent?: number;
	levelOffset?: number;
	lineRanges?: MarkdownIncludeLineRange[];
	tagSelection?: MarkdownIncludeTagSelection;
};

export type MarkdownIncludeProvenance = {
	depth: number;
	includeRootDir: string;
	inclusionStack: string[];
	includingSourcePath: string;
	resolvedPath?: string;
};

export type MarkdownIncludeDirective = {
	type: "includeDirective";
	attributes: Record<string, string>;
	diagnostics?: MarkdownIncludeDiagnostic[];
	provenance?: MarkdownIncludeProvenance;
	semantics?: MarkdownIncludeSemantics;
	target: string;
};

export type MarkdownThematicBreak = {
	type: "thematicBreak";
};

export type MarkdownCodeBlock = {
	type: "codeBlock";
	language?: string;
	meta?: string;
	value: string;
	callouts?: number[];
};

export type MarkdownBlockQuote = {
	type: "blockquote";
	children: MarkdownBlock[];
};

export type MarkdownAdmonition = {
	type: "admonition";
	kind: "note" | "tip" | "important" | "caution" | "warning";
	children: MarkdownBlock[];
};

export type MarkdownListItem = {
	children: MarkdownBlock[];
};

export type MarkdownList = {
	type: "list";
	ordered: boolean;
	start?: number;
	tight?: boolean;
	items: MarkdownListItem[];
};

export type MarkdownLabeledGroup = {
	type: "labeledGroup";
	label: MarkdownInline[];
	children: MarkdownBlock[];
};

export type MarkdownTableCell = {
	children: MarkdownInline[];
};

export type MarkdownTableRow = {
	cells: MarkdownTableCell[];
};

export type MarkdownTable = {
	type: "table";
	align?: Array<"left" | "center" | "right" | null>;
	header: MarkdownTableRow;
	rows: MarkdownTableRow[];
};

export type MarkdownCalloutListItem = {
	ordinal: number;
	children: MarkdownBlock[];
};

export type MarkdownCalloutList = {
	type: "calloutList";
	items: MarkdownCalloutListItem[];
};

export type MarkdownHtmlBlock = {
	type: "htmlBlock";
	value: string;
};

export type MarkdownFootnoteDefinition = {
	type: "footnoteDefinition";
	identifier: string;
	children: MarkdownBlock[];
};

export type MarkdownBlock =
	| MarkdownParagraph
	| MarkdownHeading
	| MarkdownAnchor
	| MarkdownPageAliases
	| MarkdownIncludeDirective
	| MarkdownThematicBreak
	| MarkdownCodeBlock
	| MarkdownBlockQuote
	| MarkdownAdmonition
	| MarkdownList
	| MarkdownLabeledGroup
	| MarkdownTable
	| MarkdownCalloutList
	| MarkdownHtmlBlock
	| MarkdownFootnoteDefinition
	| MarkdownUnsupported;

export type MarkdownHeadingNumberingMode = "book" | "section";

export type MarkdownRenderOptions = {
	headingNumbering?: {
		mode: MarkdownHeadingNumberingMode;
	};
	tableOfContents?: {
		maxDepth?: number;
	};
};

export type MarkdownDocument = {
	type: "document";
	renderOptions?: MarkdownRenderOptions;
	children: MarkdownBlock[];
};
