import asciidoctorFactory from "@asciidoctor/core";
import type { AssemblySourceLocation } from "../assembly-structure.js";
import type { AsciidoctorBlock, AsciidoctorListItem } from "./types.js";

export const createAsciidoctor = asciidoctorFactory as unknown as () => {
	load: (source: string, options: Record<string, unknown>) => AsciidoctorBlock;
};

export function getSourceLocation(
	node: Pick<AsciidoctorBlock, "getSourceLocation"> | AsciidoctorListItem,
): AssemblySourceLocation | undefined {
	const location = node.getSourceLocation?.();
	if (location === undefined) {
		return undefined;
	}

	const path = location.getPath?.();
	const line = location.getLineNumber?.();
	if (path === undefined && line === undefined) {
		return undefined;
	}

	return {
		path,
		line,
	};
}

export function decodeHtmlEntities(value: string): string {
	return value
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'");
}

export function decodeLiteralCode(value: string): string {
	return decodeHtmlEntities(value)
		.replace(/<a\s[^>]*>/gu, "")
		.replaceAll("</a>", "")
		.replaceAll("<strong>", "**")
		.replaceAll("</strong>", "**")
		.replaceAll("<em>", "_")
		.replaceAll("</em>", "_")
		.replaceAll("&#8230;", "...")
		.replaceAll("&#8203;", "")
		.replaceAll("&#8201;", " ")
		.replaceAll("&#8212;", "--")
		.replaceAll("&#8594;", "->");
}

export function parseHtmlAttributes(value: string): {
	attributes: Record<string, string>;
	tagName: string;
} {
	const tagMatch = value.match(/^<([A-Za-z0-9]+)\s*([^>]*)>$/);
	if (tagMatch === null) {
		return { tagName: "", attributes: {} };
	}

	const [, tagName = "", rawAttributes = ""] = tagMatch;
	const attributes: Record<string, string> = {};
	for (const match of rawAttributes.matchAll(
		/([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g,
	)) {
		const [, name, attributeValue] = match;
		if (name !== undefined && attributeValue !== undefined) {
			attributes[name] = decodeHtmlEntities(attributeValue);
		}
	}

	return {
		tagName: tagName.toLowerCase(),
		attributes,
	};
}
