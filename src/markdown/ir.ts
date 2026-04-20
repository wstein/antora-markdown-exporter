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

export type MarkdownLink = {
	type: "link";
	url: string;
	children: MarkdownInline[];
};

export type MarkdownUnsupported = {
	type: "unsupported";
	reason: string;
};

export type MarkdownInline =
	| MarkdownText
	| MarkdownEmphasis
	| MarkdownCode
	| MarkdownLink;

export type MarkdownParagraph = {
	type: "paragraph";
	children: MarkdownInline[];
};

export type MarkdownHeading = {
	type: "heading";
	depth: number;
	children: MarkdownInline[];
};

export type MarkdownCodeBlock = {
	type: "codeBlock";
	language?: string;
	value: string;
};

export type MarkdownBlockQuote = {
	type: "blockquote";
	children: MarkdownBlock[];
};

export type MarkdownListItem = {
	children: MarkdownBlock[];
};

export type MarkdownList = {
	type: "list";
	ordered: boolean;
	items: MarkdownListItem[];
};

export type MarkdownBlock =
	| MarkdownParagraph
	| MarkdownHeading
	| MarkdownCodeBlock
	| MarkdownBlockQuote
	| MarkdownList
	| MarkdownUnsupported;

export type MarkdownDocument = {
	type: "document";
	children: MarkdownBlock[];
};
