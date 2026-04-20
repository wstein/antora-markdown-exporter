export type MarkdownText = {
	type: "text";
	value: string;
};

export type MarkdownEmphasis = {
	type: "emphasis";
	children: MarkdownInline[];
};

export type MarkdownCode = {
	type: "code";
	value: string;
};

export type MarkdownUnsupported = {
	type: "unsupported";
	reason: string;
};

export type MarkdownInline = MarkdownText | MarkdownEmphasis | MarkdownCode;

export type MarkdownParagraph = {
	type: "paragraph";
	children: MarkdownInline[];
};

export type MarkdownHeading = {
	type: "heading";
	depth: number;
	children: MarkdownInline[];
};

export type MarkdownBlock =
	| MarkdownParagraph
	| MarkdownHeading
	| MarkdownUnsupported;

export type MarkdownDocument = {
	type: "document";
	children: MarkdownBlock[];
};
