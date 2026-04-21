export type MarkdownFlavorName = "gfm" | "commonmark" | "gitlab" | "strict";
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
	supportsFootnotes: boolean;
	supportsRawHtml: boolean;
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
		supportsFootnotes: true,
		supportsRawHtml: true,
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
		supportsFootnotes: false,
		supportsRawHtml: true,
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
		supportsFootnotes: true,
		supportsRawHtml: true,
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
	strict: {
		name: "strict",
		label: "Strict Canonical Markdown",
		supportsTables: false,
		supportsFootnotes: false,
		supportsRawHtml: false,
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
