export type MarkdownFlavorName =
	| "gfm"
	| "commonmark"
	| "gitlab"
	| "multimarkdown"
	| "strict";
export type MarkdownXrefSiteAssetFamily = "attachment" | "example" | "image";

export type MarkdownFlavorSpec = {
	blockFallbackLabel: string;
	citationStyle: "at" | "plain";
	hardBreakStyle: "backslash" | "spaces";
	label: string;
	name: MarkdownFlavorName;
	preserveOrderedListStart: boolean;
	softBreakStyle: "newline" | "space";
	supportsCitations: boolean;
	supportsDefinitionLists: boolean;
	supportsFootnotes: boolean;
	supportsMetadata: boolean;
	supportsImageAttributes: boolean;
	supportsRawHtml: boolean;
	supportsTableCaptions: boolean;
	supportsTables: boolean;
	xrefStyle: "site" | "source";
	xrefSiteAssetFamilies: Partial<Record<MarkdownXrefSiteAssetFamily, string>>;
	xrefSiteOmitRootModule: boolean;
};

export const markdownFlavorSpecs: Record<
	MarkdownFlavorName,
	MarkdownFlavorSpec
> = {
	gfm: {
		name: "gfm",
		label: "GitHub Flavored Markdown",
		supportsTables: true,
		supportsDefinitionLists: false,
		supportsFootnotes: true,
		supportsMetadata: false,
		supportsImageAttributes: false,
		supportsRawHtml: true,
		supportsTableCaptions: false,
		supportsCitations: false,
		hardBreakStyle: "backslash",
		softBreakStyle: "newline",
		preserveOrderedListStart: true,
		citationStyle: "plain",
		blockFallbackLabel: "Unsupported",
		xrefStyle: "source",
		xrefSiteAssetFamilies: {},
		xrefSiteOmitRootModule: false,
	},
	commonmark: {
		name: "commonmark",
		label: "CommonMark",
		supportsTables: false,
		supportsDefinitionLists: false,
		supportsFootnotes: false,
		supportsMetadata: false,
		supportsImageAttributes: false,
		supportsRawHtml: true,
		supportsTableCaptions: false,
		supportsCitations: false,
		hardBreakStyle: "spaces",
		softBreakStyle: "newline",
		preserveOrderedListStart: true,
		citationStyle: "plain",
		blockFallbackLabel: "Unsupported",
		xrefStyle: "source",
		xrefSiteAssetFamilies: {},
		xrefSiteOmitRootModule: false,
	},
	gitlab: {
		name: "gitlab",
		label: "GitLab Flavored Markdown",
		supportsTables: true,
		supportsDefinitionLists: false,
		supportsFootnotes: true,
		supportsMetadata: false,
		supportsImageAttributes: false,
		supportsRawHtml: true,
		supportsTableCaptions: false,
		supportsCitations: true,
		hardBreakStyle: "backslash",
		softBreakStyle: "newline",
		preserveOrderedListStart: true,
		citationStyle: "at",
		blockFallbackLabel: "Unsupported",
		xrefStyle: "site",
		xrefSiteAssetFamilies: {
			attachment: "_attachments",
			example: "_examples",
			image: "_images",
		},
		xrefSiteOmitRootModule: true,
	},
	multimarkdown: {
		name: "multimarkdown",
		label: "MultiMarkdown",
		supportsTables: true,
		supportsDefinitionLists: true,
		supportsFootnotes: true,
		supportsMetadata: true,
		supportsImageAttributes: true,
		supportsRawHtml: true,
		supportsTableCaptions: true,
		supportsCitations: true,
		hardBreakStyle: "backslash",
		softBreakStyle: "newline",
		preserveOrderedListStart: true,
		citationStyle: "plain",
		blockFallbackLabel: "Unsupported",
		xrefStyle: "source",
		xrefSiteAssetFamilies: {},
		xrefSiteOmitRootModule: false,
	},
	strict: {
		name: "strict",
		label: "Strict Canonical Markdown",
		supportsTables: false,
		supportsDefinitionLists: false,
		supportsFootnotes: false,
		supportsMetadata: false,
		supportsImageAttributes: false,
		supportsRawHtml: false,
		supportsTableCaptions: false,
		supportsCitations: false,
		hardBreakStyle: "backslash",
		softBreakStyle: "space",
		preserveOrderedListStart: false,
		citationStyle: "plain",
		blockFallbackLabel: "Unsupported",
		xrefStyle: "site",
		xrefSiteAssetFamilies: {
			attachment: "_attachments",
			example: "_examples",
			image: "_images",
		},
		xrefSiteOmitRootModule: true,
	},
};

export function resolveMarkdownFlavor(
	flavor: MarkdownFlavorName | MarkdownFlavorSpec,
): MarkdownFlavorSpec {
	return typeof flavor === "string" ? markdownFlavorSpecs[flavor] : flavor;
}
