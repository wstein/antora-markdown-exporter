import type {
	AssemblyImage,
	AssemblyInline,
	AssemblyLink,
	AssemblyXref,
} from "../assembly-structure.js";
import {
	decodeHtmlEntities,
	decodeLiteralCode,
	parseHtmlAttributes,
} from "./shared.js";
import type { ExtractAssemblyStructureOptions } from "./types.js";
import {
	isStructuredXrefHref,
	normalizeXrefChildren,
	parseXrefTarget,
} from "./xref.js";

export function parsePlainTextWithSoftBreaks(value: string): AssemblyInline[] {
	const lines = decodeHtmlEntities(value)
		.split("\n")
		.map((line) => line.trimEnd());
	const children: AssemblyInline[] = [];

	for (const [index, line] of lines.entries()) {
		if (index > 0) {
			children.push({ type: "softBreak" });
		}
		children.push({
			type: "text",
			value: line,
		});
	}

	return children.length === 0 ? [{ type: "text", value: "" }] : children;
}

export function parseInlineHtmlWithOptions(
	content: string,
	options: ExtractAssemblyStructureOptions = {},
): AssemblyInline[] {
	const xrefFallbackLabelStyle =
		options.xrefFallbackLabelStyle ?? "fragment-or-basename";
	return parseInlineHtmlWithPolicy(content, xrefFallbackLabelStyle);
}

function parseInlineHtmlWithPolicy(
	content: string,
	xrefFallbackLabelStyle: NonNullable<
		ExtractAssemblyStructureOptions["xrefFallbackLabelStyle"]
	>,
): AssemblyInline[] {
	const nodes: AssemblyInline[] = [];
	let cursor = 0;

	function pushText(value: string): void {
		if (value.length === 0) {
			return;
		}

		nodes.push({
			type: "text",
			value: decodeHtmlEntities(value),
		});
	}

	while (cursor < content.length) {
		const nextTagIndex = content.indexOf("<", cursor);
		if (nextTagIndex === -1) {
			pushText(content.slice(cursor));
			break;
		}

		if (nextTagIndex > cursor) {
			pushText(content.slice(cursor, nextTagIndex));
		}

		const strongOpen = content
			.slice(nextTagIndex)
			.match(/^<strong(?:\s[^>]*)?>/u)?.[0];
		if (strongOpen !== undefined) {
			const endIndex = content.indexOf("</strong>", nextTagIndex);
			if (endIndex === -1) {
				pushText(content.slice(nextTagIndex));
				break;
			}

			nodes.push({
				type: "strong",
				children: parseInlineHtmlWithPolicy(
					content.slice(nextTagIndex + strongOpen.length, endIndex),
					xrefFallbackLabelStyle,
				),
			});
			cursor = endIndex + 9;
			continue;
		}

		const emphasisOpen = content
			.slice(nextTagIndex)
			.match(/^<em(?:\s[^>]*)?>/u)?.[0];
		if (emphasisOpen !== undefined) {
			const endIndex = content.indexOf("</em>", nextTagIndex);
			if (endIndex === -1) {
				pushText(content.slice(nextTagIndex));
				break;
			}

			nodes.push({
				type: "emphasis",
				children: parseInlineHtmlWithPolicy(
					content.slice(nextTagIndex + emphasisOpen.length, endIndex),
					xrefFallbackLabelStyle,
				),
			});
			cursor = endIndex + 5;
			continue;
		}

		const codeOpen = content
			.slice(nextTagIndex)
			.match(/^<code(?:\s[^>]*)?>/u)?.[0];
		if (codeOpen !== undefined) {
			const endIndex = content.indexOf("</code>", nextTagIndex);
			if (endIndex === -1) {
				pushText(content.slice(nextTagIndex));
				break;
			}

			nodes.push({
				type: "code",
				value: decodeLiteralCode(
					content.slice(nextTagIndex + codeOpen.length, endIndex),
				),
			});
			cursor = endIndex + 7;
			continue;
		}

		if (content.startsWith("<a ", nextTagIndex)) {
			const openEndIndex = content.indexOf(">", nextTagIndex);
			const endIndex = content.indexOf("</a>", nextTagIndex);
			if (openEndIndex === -1 || endIndex === -1) {
				pushText(content.slice(nextTagIndex));
				break;
			}

			const openTag = content.slice(nextTagIndex, openEndIndex + 1);
			const inner = content.slice(openEndIndex + 1, endIndex);
			const { attributes } = parseHtmlAttributes(openTag);
			const href = attributes.href ?? "";
			const children = parseInlineHtmlWithPolicy(inner, xrefFallbackLabelStyle);
			if (isStructuredXrefHref(href)) {
				const target = parseXrefTarget(href);
				nodes.push(<AssemblyXref>{
					type: "xref",
					url: href,
					target,
					children: normalizeXrefChildren(
						href,
						target,
						children,
						xrefFallbackLabelStyle,
					),
				});
			} else {
				nodes.push(<AssemblyLink>{
					type: "link",
					url: href,
					children,
				});
			}
			cursor = endIndex + 4;
			continue;
		}

		if (content.startsWith('<span class="image">', nextTagIndex)) {
			const imgStartIndex = content.indexOf("<img ", nextTagIndex);
			const imgEndIndex = content.indexOf(">", imgStartIndex);
			const spanEndIndex = content.indexOf("</span>", nextTagIndex);
			if (imgStartIndex === -1 || imgEndIndex === -1 || spanEndIndex === -1) {
				pushText(content.slice(nextTagIndex));
				break;
			}

			const imgTag = content.slice(imgStartIndex, imgEndIndex + 1);
			const { attributes } = parseHtmlAttributes(imgTag);
			nodes.push(<AssemblyImage>{
				type: "image",
				url: attributes.src ?? "",
				title: attributes.title,
				alt: [{ type: "text", value: attributes.alt ?? "" }],
			});
			cursor = spanEndIndex + 7;
			continue;
		}

		const endIndex = content.indexOf(">", nextTagIndex);
		if (endIndex === -1) {
			pushText(content.slice(nextTagIndex));
			break;
		}
		pushText(content.slice(nextTagIndex, endIndex + 1));
		cursor = endIndex + 1;
	}

	return nodes.length === 0 ? [{ type: "text", value: "" }] : nodes;
}
