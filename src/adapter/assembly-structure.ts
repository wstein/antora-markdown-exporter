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
	| AssemblyHtmlInline;

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
	header: AssemblyTableRow;
	rows: AssemblyTableRow[];
	location?: AssemblySourceLocation;
};

export type AssemblyHtmlBlock = {
	type: "htmlBlock";
	value: string;
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
	| AssemblyHtmlBlock
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

export function defineAssemblyDocument(
	document: AssemblyDocument,
): AssemblyDocument {
	return document;
}
