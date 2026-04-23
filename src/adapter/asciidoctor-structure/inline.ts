import type {
	AssemblyCitation,
	AssemblyFootnoteReference,
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
import { isStructuredXrefHref, parseXrefTarget } from "./xref.js";

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
	_options: ExtractAssemblyStructureOptions = {},
): AssemblyInline[] {
	return parseInlineHtmlWithPolicy(content);
}

function parseInlineHtmlWithPolicy(content: string): AssemblyInline[] {
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

		const footnoteOpen = content
			.slice(nextTagIndex)
			.match(/^<sup class="footnote(?:ref)?">/u)?.[0];
		if (footnoteOpen !== undefined) {
			const endIndex = content.indexOf("</sup>", nextTagIndex);
			if (endIndex === -1) {
				pushText(content.slice(nextTagIndex));
				break;
			}

			const footnoteHtml = content.slice(nextTagIndex, endIndex + 6);
			const hrefMatch = footnoteHtml.match(/href="#_footnotedef_(.+?)"/u);
			const labelMatch = footnoteHtml.match(/>([^<]+)<\/a>/u);
			const identifier = hrefMatch?.[1] ?? labelMatch?.[1] ?? "";
			nodes.push(<AssemblyFootnoteReference>{
				type: "footnoteReference",
				identifier,
				label: labelMatch?.[1],
			});
			cursor = endIndex + 6;
			continue;
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
			const linkAttributes = Object.fromEntries(
				Object.entries(attributes).filter(([key]) => key !== "href"),
			);
			const children = parseInlineHtmlWithPolicy(inner);
			if (isStructuredXrefHref(href)) {
				const target = parseXrefTarget(href);
				nodes.push(<AssemblyXref>{
					type: "xref",
					url: href,
					target,
					attributes:
						Object.keys(linkAttributes).length > 0 ? linkAttributes : undefined,
					children,
				});
			} else {
				nodes.push(<AssemblyLink>{
					type: "link",
					url: href,
					attributes:
						Object.keys(linkAttributes).length > 0 ? linkAttributes : undefined,
					children,
				});
			}
			cursor = endIndex + 4;
			continue;
		}

		const citeOpen = content
			.slice(nextTagIndex)
			.match(/^<span class="cite(?:\s[^"]*)?">/u)?.[0];
		if (citeOpen !== undefined) {
			const endIndex = content.indexOf("</span>", nextTagIndex);
			if (endIndex === -1) {
				pushText(content.slice(nextTagIndex));
				break;
			}

			const inner = content.slice(nextTagIndex + citeOpen.length, endIndex);
			const label = decodeHtmlEntities(inner);
			nodes.push(<AssemblyCitation>{
				type: "citation",
				identifier: label,
				label,
			});
			cursor = endIndex + 7;
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
			const imageAttributes = Object.fromEntries(
				Object.entries(attributes).filter(
					([key]) => !["src", "alt", "title"].includes(key),
				),
			);
			nodes.push(<AssemblyImage>{
				type: "image",
				url: attributes.src ?? "",
				title: attributes.title,
				attributes:
					Object.keys(imageAttributes).length > 0 ? imageAttributes : undefined,
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
