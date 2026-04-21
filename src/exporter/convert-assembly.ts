import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
	MarkdownAdmonition,
	MarkdownBlock,
	MarkdownBlockQuote,
	MarkdownCalloutList,
	MarkdownCodeBlock,
	MarkdownDocument,
	MarkdownHeading,
	MarkdownHeadingNumberingMode,
	MarkdownImage,
	MarkdownIncludeDiagnostic,
	MarkdownIncludeDirective,
	MarkdownIncludeLineRange,
	MarkdownIncludeSemantics,
	MarkdownIncludeTagSelection,
	MarkdownInline,
	MarkdownLabeledGroup,
	MarkdownList,
	MarkdownParagraph,
	MarkdownTable,
	MarkdownTableRow,
	MarkdownXrefFamily,
	MarkdownXrefTarget,
} from "../markdown/ir.js";
import {
	decodeIncludeDirectiveMarker,
	encodeIncludeDirectiveMarker,
} from "./include-metadata.js";

const listMarkerPattern = /^\s*([*.]+)\s+(.*)$/;
const labeledGroupPattern = /^(.+?)::(?:\s+(.*))?$/;
const blockLabelPattern = /^\.(.+)$/u;
const admonitionPattern = /^(NOTE|TIP|IMPORTANT|CAUTION|WARNING):\s+(.*)$/;
const calloutPattern = /^<(\d+)>\s+(.*)$/;
const includePattern = /^include::([^[]+)\[([^\]]*)\]$/;
const pageAliasesPattern = /^:page-aliases:\s+(.+)$/;
const attributeEntryPattern = /^:(!?[\p{Alpha}0-9_][^:]*):(?:\s+.*)?$/u;
const tagStartPattern = /^\s*\/\/\s*tag::([A-Za-z0-9:_-]+)\[\]\s*$/;
const tagEndPattern = /^\s*\/\/\s*end::([A-Za-z0-9:_-]+)\[\]\s*$/;

type ParsedListMarker = {
	content: string;
	depth: number;
	ordered: boolean;
};

type ParsedLabeledGroupMarker = {
	content?: string;
	label: string;
};

export type ConvertAssemblyToMarkdownIROptions = {
	includeRootDir?: string;
	includeResolver?: (
		includeTarget: string,
		context: { includeRootDir: string; sourcePath: string },
	) => string | undefined;
	sourcePath?: string;
};

type IncludeDirective = {
	attributes: Record<string, string>;
	target: string;
};

type ParsedXrefTarget = {
	label: string;
	target: MarkdownXrefTarget;
	url: string;
};

type ParsedIncludeSemantics = {
	diagnostics: MarkdownIncludeDiagnostic[];
	semantics?: MarkdownIncludeSemantics;
};

type ImageToken = {
	alt: string;
	raw: string;
	title?: string;
	type: "image";
	url: string;
};

type LinkToken = {
	label: string;
	raw: string;
	title?: string;
	type: "link";
	url: string;
};

type XrefToken = {
	label: string;
	raw: string;
	target: MarkdownXrefTarget;
	type: "xref";
	url: string;
};

type CodeToken = {
	content: string;
	raw: string;
	type: "code";
};

type StrongToken = {
	content: string;
	raw: string;
	type: "strong";
};

type EmphasisToken = {
	content: string;
	raw: string;
	type: "emphasis";
};

type InlineToken =
	| ImageToken
	| LinkToken
	| XrefToken
	| CodeToken
	| StrongToken
	| EmphasisToken;

function classifyXrefFamily(name: string | undefined): MarkdownXrefFamily {
	switch (name) {
		case undefined:
			return { kind: "page", name: "page" };
		case "attachment":
			return { kind: "attachment", name };
		case "example":
			return { kind: "example", name };
		case "image":
			return { kind: "image", name };
		case "partial":
			return { kind: "partial", name };
		case "page":
			return { kind: "page", name };
		default:
			return { kind: "other", name };
	}
}

function parseNamedAttributes(value: string): {
	title?: string;
	unnamed: string[];
} {
	const attributes = value
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	const unnamed: string[] = [];
	let title: string | undefined;

	for (const attribute of attributes) {
		if (attribute.startsWith("title=")) {
			title = attribute.slice("title=".length).replace(/^"|"$/g, "");
			continue;
		}

		unnamed.push(attribute);
	}

	return { title, unnamed };
}

function parseDirectiveAttributes(value: string): Record<string, string> {
	const entries = value
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	const attributes: Record<string, string> = {};

	for (const entry of entries) {
		const separatorIndex = entry.indexOf("=");
		if (separatorIndex === -1) {
			attributes[entry] = "true";
			continue;
		}

		const key = entry.slice(0, separatorIndex).trim();
		const rawValue = entry.slice(separatorIndex + 1).trim();
		attributes[key] = rawValue.replace(/^"|"$/g, "");
	}

	return attributes;
}

function parseIncludeDirective(line: string): IncludeDirective | undefined {
	const match = line.trim().match(includePattern);
	if (match === null) {
		return undefined;
	}

	const [, target, rawAttributes] = match;
	if (target === undefined || rawAttributes === undefined) {
		return undefined;
	}

	return {
		target,
		attributes: parseDirectiveAttributes(rawAttributes),
	};
}

function matchImage(value: string): ImageToken | undefined {
	const match = value.match(/^image::?([^\s[]+)\[([^\]]*)\]/);
	if (match === null) {
		return undefined;
	}

	const [, url, attributeText] = match;
	if (url === undefined || attributeText === undefined) {
		return undefined;
	}

	const attributes = parseNamedAttributes(attributeText);
	return {
		type: "image",
		raw: match[0],
		url,
		alt: attributes.unnamed[0] ?? "",
		title: attributes.title,
	};
}

function matchLink(value: string): LinkToken | XrefToken | undefined {
	const linkMatch = value.match(/^(?:link:)?(https?:\/\/[^\s[]+)\[([^\]]+)\]/);
	if (linkMatch !== null) {
		const [, url, label] = linkMatch;
		if (url !== undefined && label !== undefined) {
			return {
				type: "link",
				raw: linkMatch[0],
				url,
				label,
			};
		}
	}

	const xrefMatch = value.match(/^xref:([^[]+)\[([^\]]*)\]/);
	if (xrefMatch === null) {
		return undefined;
	}

	const [, rawTarget, label] = xrefMatch;
	if (rawTarget === undefined || label === undefined) {
		return undefined;
	}
	const parsedTarget = parseXrefTarget(rawTarget);
	if (parsedTarget === undefined) {
		return undefined;
	}

	return {
		type: "xref",
		raw: xrefMatch[0],
		url: parsedTarget.url,
		target: parsedTarget.target,
		label: label.length > 0 ? label : parsedTarget.label,
	};
}

function parseXrefTarget(rawTarget: string): ParsedXrefTarget | undefined {
	if (rawTarget.startsWith("#")) {
		const anchor = rawTarget.slice(1);
		return anchor.length === 0
			? undefined
			: {
					url: `#${anchor}`,
					label: anchor,
					target: {
						raw: rawTarget,
						path: "",
						fragment: anchor,
					},
				};
	}

	const [targetWithoutFragment, fragment] = rawTarget.split("#", 2);
	if (targetWithoutFragment === undefined) {
		return undefined;
	}

	const [versionPart, coordinatePart] = targetWithoutFragment.includes("@")
		? targetWithoutFragment.split("@", 2)
		: [undefined, targetWithoutFragment];
	if (coordinatePart === undefined) {
		return undefined;
	}

	const coordinateSegments = coordinatePart.split(":");
	const pageSegment = coordinateSegments.pop();
	if (pageSegment === undefined) {
		return undefined;
	}
	const [componentName, moduleName] =
		coordinateSegments.length === 2
			? coordinateSegments
			: [undefined, coordinateSegments[0]];

	const normalizedSegments: string[] = [];
	if (coordinateSegments.length === 2) {
		if (componentName !== undefined && componentName.length > 0) {
			normalizedSegments.push(componentName);
		}
		if (versionPart !== undefined && versionPart.length > 0) {
			normalizedSegments.push(versionPart);
		}
		if (moduleName !== undefined && moduleName.length > 0) {
			normalizedSegments.push(moduleName);
		}
	} else if (coordinateSegments.length === 1) {
		if (versionPart !== undefined && versionPart.length > 0) {
			normalizedSegments.push(versionPart);
		}
		if (moduleName !== undefined && moduleName.length > 0) {
			normalizedSegments.push(moduleName);
		}
	} else if (versionPart !== undefined && versionPart.length > 0) {
		normalizedSegments.push(versionPart);
	}

	const [familyName, familyPath] = pageSegment.includes("$")
		? pageSegment.split("$", 2)
		: [undefined, pageSegment];
	if (familyName !== undefined && familyName.length > 0) {
		normalizedSegments.push(familyName);
	}
	if (familyPath !== undefined && familyPath.length > 0) {
		normalizedSegments.push(familyPath);
	}

	const urlPath = normalizedSegments.join("/");
	const labelSource =
		fragment ??
		normalizedSegments[normalizedSegments.length - 1] ??
		targetWithoutFragment;
	return {
		url:
			fragment === undefined || fragment.length === 0
				? urlPath
				: `${urlPath}#${fragment}`,
		label: labelSource.replace(/\.adoc$/, ""),
		target: {
			raw: rawTarget,
			component: componentName,
			version: versionPart,
			module: moduleName,
			family: classifyXrefFamily(familyName),
			path: familyPath ?? pageSegment,
			fragment,
		},
	};
}

function matchCode(value: string): CodeToken | undefined {
	const match = value.match(/^`([^`]+)`/);
	if (match === null) {
		return undefined;
	}

	const [, content] = match;
	if (content === undefined) {
		return undefined;
	}

	return {
		type: "code",
		raw: match[0],
		content,
	};
}

function matchStrong(value: string): StrongToken | undefined {
	const match = value.match(/^\*([^*\n]+)\*/);
	if (match === null) {
		return undefined;
	}

	const [, content] = match;
	if (content === undefined) {
		return undefined;
	}

	return {
		type: "strong",
		raw: match[0],
		content,
	};
}

function matchEmphasis(value: string): EmphasisToken | undefined {
	const match = value.match(/^_([^_\n]+)_/);
	if (match === null) {
		return undefined;
	}

	const [, content] = match;
	if (content === undefined) {
		return undefined;
	}

	return {
		type: "emphasis",
		raw: match[0],
		content,
	};
}

function findNextInlineToken(
	value: string,
	startIndex: number,
): { index: number; token: InlineToken } | undefined {
	const patterns = [
		matchImage,
		matchLink,
		matchCode,
		matchStrong,
		matchEmphasis,
	];
	let nearest: { index: number; token: InlineToken } | undefined;

	for (let index = startIndex; index < value.length; index += 1) {
		const segment = value.slice(index);
		for (const matcher of patterns) {
			const token = matcher(segment);
			if (token !== undefined) {
				nearest = { index, token };
				break;
			}
		}

		if (nearest !== undefined) {
			break;
		}
	}

	return nearest;
}

function parseInline(value: string): MarkdownInline[] {
	const nodes: MarkdownInline[] = [];
	let cursor = 0;

	while (cursor < value.length) {
		const next = findNextInlineToken(value, cursor);
		if (next === undefined) {
			nodes.push({
				type: "text",
				value: value.slice(cursor),
			});
			break;
		}

		if (next.index > cursor) {
			nodes.push({
				type: "text",
				value: value.slice(cursor, next.index),
			});
		}

		switch (next.token.type) {
			case "image":
				nodes.push(<MarkdownImage>{
					type: "image",
					url: next.token.url,
					title: next.token.title,
					alt: parseInline(next.token.alt),
				});
				break;
			case "link":
				nodes.push({
					type: "link",
					url: next.token.url,
					title: next.token.title,
					children: parseInline(next.token.label),
				});
				break;
			case "xref":
				nodes.push({
					type: "xref",
					target: next.token.target,
					url: next.token.url,
					children: parseInline(next.token.label),
				});
				break;
			case "code":
				nodes.push({
					type: "code",
					value: next.token.content,
				});
				break;
			case "strong":
				nodes.push({
					type: "strong",
					children: parseInline(next.token.content),
				});
				break;
			case "emphasis":
				nodes.push({
					type: "emphasis",
					children: parseInline(next.token.content),
				});
				break;
		}

		cursor = next.index + next.token.raw.length;
	}

	if (nodes.length === 0) {
		nodes.push({ type: "text", value });
	}

	return nodes;
}

function parseHeading(line: string): MarkdownHeading | undefined {
	const match = line.match(/^(=+)\s+(.*)$/);
	if (match === null) {
		return undefined;
	}

	const [, markers, content] = match;
	if (markers === undefined || content === undefined) {
		return undefined;
	}

	const depth = Math.max(1, markers.length - 1);

	return {
		type: "heading",
		depth,
		children: parseInline(content.trim()),
	};
}

function parseLabeledGroupMarker(
	line: string,
): ParsedLabeledGroupMarker | undefined {
	const match = line.match(labeledGroupPattern);
	if (match === null) {
		return undefined;
	}

	const [, label, content] = match;
	if (label === undefined) {
		return undefined;
	}

	return {
		label: label.trim(),
		content: content?.trim(),
	};
}

function parseBlockLabelMarker(
	line: string,
): ParsedLabeledGroupMarker | undefined {
	const match = line.match(blockLabelPattern);
	if (match === null) {
		return undefined;
	}

	const [, raw] = match;
	if (raw === undefined) {
		return undefined;
	}

	const content = raw.trim();
	if (content.length === 0) {
		return undefined;
	}
	if (!/^\p{Lu}/u.test(content)) {
		return undefined;
	}

	if (/^[\p{Lu}][\p{L}\p{N}/-]*(?: [\p{Lu}][\p{L}\p{N}/-]*)*$/u.test(content)) {
		return {
			label: content,
		};
	}

	const separatorIndex = content.indexOf(" ");
	if (separatorIndex === -1) {
		return {
			label: content,
		};
	}

	const label = content.slice(0, separatorIndex).trim();
	const remainder = content.slice(separatorIndex + 1).trim();
	if (label.length === 0) {
		return undefined;
	}

	return {
		label,
		content: remainder.length === 0 ? undefined : remainder,
	};
}

function parseDocumentRenderOptions(
	lines: string[],
): MarkdownDocument["renderOptions"] {
	const hasSectionNumbering = lines.some((line) => {
		const trimmed = line.trim();
		return trimmed === ":numbered:" || trimmed === ":sectnums:";
	});
	const hasBookDoctype = lines.some((line) => line.trim() === ":doctype: book");
	const tocLine = lines.find((line) => line.trim().startsWith(":toc:"));
	const toclevelsLine = lines.find((line) =>
		line.trim().startsWith(":toclevels:"),
	);
	const maxDepthRaw = toclevelsLine?.split(":", 3)[2]?.trim();
	const maxDepth =
		maxDepthRaw === undefined ? undefined : Number.parseInt(maxDepthRaw, 10);

	return {
		headingNumbering: hasSectionNumbering
			? {
					mode: (hasBookDoctype
						? "book"
						: "section") satisfies MarkdownHeadingNumberingMode,
				}
			: undefined,
		tableOfContents:
			tocLine === undefined
				? undefined
				: {
						maxDepth: Number.isFinite(maxDepth) ? maxDepth : undefined,
					},
	};
}

function parseListMarker(line: string): ParsedListMarker | undefined {
	const match = line.match(listMarkerPattern);
	if (match === null) {
		return undefined;
	}

	const [, markers, content] = match;
	if (markers === undefined || content === undefined) {
		return undefined;
	}

	if (markers.includes("*") && markers.includes(".")) {
		return undefined;
	}

	return {
		content,
		depth: markers.length,
		ordered: markers.startsWith("."),
	};
}

function parseCalloutList(
	lines: string[],
	startIndex: number,
): { block?: MarkdownCalloutList; nextIndex: number } {
	const items: MarkdownCalloutList["items"] = [];
	let index = startIndex;

	while (index < lines.length) {
		const match = (lines[index] ?? "").trim().match(calloutPattern);
		if (match === null) {
			break;
		}

		const [, rawNumber, content] = match;
		if (rawNumber === undefined || content === undefined) {
			break;
		}

		items.push({
			ordinal: Number(rawNumber),
			children: [
				<MarkdownParagraph>{
					type: "paragraph",
					children: parseInline(content),
				},
			],
		});
		index += 1;
	}

	if (items.length === 0) {
		return { nextIndex: startIndex };
	}

	return {
		nextIndex: index,
		block: {
			type: "calloutList",
			items,
		},
	};
}

function parseList(
	lines: string[],
	startIndex: number,
): { block: MarkdownList; nextIndex: number } {
	const rootMarker = parseListMarker(lines[startIndex] ?? "");

	if (rootMarker === undefined) {
		throw new Error("parseList called without a list marker");
	}

	const rootList: MarkdownList = {
		type: "list",
		ordered: rootMarker.ordered,
		start: rootMarker.ordered ? 1 : undefined,
		items: [],
	};
	const stack: Array<{ depth: number; list: MarkdownList }> = [
		{ depth: rootMarker.depth, list: rootList },
	];
	let index = startIndex;

	while (index < lines.length) {
		const marker = parseListMarker(lines[index] ?? "");
		if (marker === undefined) {
			break;
		}

		const currentDepth = stack[stack.length - 1]?.depth ?? rootMarker.depth;
		if (marker.depth < rootMarker.depth) {
			break;
		}

		if (
			marker.depth === rootMarker.depth &&
			marker.ordered !== rootList.ordered
		) {
			break;
		}

		while (
			stack.length > 0 &&
			marker.depth < (stack[stack.length - 1]?.depth ?? rootMarker.depth)
		) {
			stack.pop();
		}

		if (marker.depth > currentDepth) {
			if (marker.depth !== currentDepth + 1) {
				break;
			}

			const parentList = stack[stack.length - 1]?.list;
			const parentItem = parentList?.items[parentList.items.length - 1];

			if (parentList === undefined || parentItem === undefined) {
				break;
			}

			const nestedList: MarkdownList = {
				type: "list",
				ordered: marker.ordered,
				start: marker.ordered ? 1 : undefined,
				items: [],
			};
			parentItem.children.push(nestedList);
			stack.push({ depth: marker.depth, list: nestedList });
		} else {
			const activeList = stack[stack.length - 1]?.list;
			if (activeList === undefined || activeList.ordered !== marker.ordered) {
				break;
			}
		}

		const destinationList = stack[stack.length - 1]?.list;
		if (destinationList === undefined) {
			break;
		}

		destinationList.items.push({
			children: [
				<MarkdownParagraph>{
					type: "paragraph",
					children: parseInline(marker.content),
				},
			],
		});
		index += 1;

		let continuationIndex = index;
		while (continuationIndex < lines.length) {
			const continuationLine = lines[continuationIndex]?.trim() ?? "";
			if (continuationLine.length === 0) {
				break;
			}
			if (continuationLine !== "+") {
				break;
			}

			continuationIndex += 1;
			while (
				continuationIndex < lines.length &&
				(lines[continuationIndex]?.trim() ?? "").length === 0
			) {
				continuationIndex += 1;
			}

			if (continuationIndex >= lines.length) {
				break;
			}

			const continuation = parseBlockAt(lines, continuationIndex);
			if (continuation.blocks.length === 0) {
				break;
			}

			const currentItem =
				destinationList.items[destinationList.items.length - 1];
			currentItem?.children.push(...continuation.blocks);
			continuationIndex = continuation.nextIndex;
		}
		index = continuationIndex;
		while (index < lines.length && (lines[index]?.trim() ?? "").length === 0) {
			index += 1;
		}
	}

	return { block: rootList, nextIndex: index };
}

function parseTableRowCells(line: string): string[] {
	return line
		.split("|")
		.slice(1)
		.map((cell) => cell.trim())
		.filter((cell) => cell.length > 0);
}

function parseTable(
	lines: string[],
	startIndex: number,
	align?: Array<"left" | "center" | "right" | null>,
): { block: MarkdownTable | MarkdownBlock; nextIndex: number } {
	let index = startIndex + 1;
	const rows: MarkdownTableRow[] = [];
	let currentRowCells: string[] = [];
	let expectedColumnCount =
		align?.length && align.length > 0 ? align.length : undefined;

	function flushCurrentRow(): void {
		if (currentRowCells.length === 0) {
			return;
		}

		if (expectedColumnCount === undefined) {
			expectedColumnCount = currentRowCells.length;
		}

		rows.push({
			cells: currentRowCells.map((cell) => ({
				children: parseInline(cell),
			})),
		});
		currentRowCells = [];
	}

	while (index < lines.length && (lines[index]?.trim() ?? "") !== "|===") {
		const line = lines[index]?.trim() ?? "";
		if (line.length === 0) {
			flushCurrentRow();
			index += 1;
			continue;
		}

		if (line.startsWith("|")) {
			currentRowCells.push(...parseTableRowCells(line));
			if (
				expectedColumnCount !== undefined &&
				currentRowCells.length >= expectedColumnCount
			) {
				flushCurrentRow();
			}
		}
		index += 1;
	}

	flushCurrentRow();

	if (index >= lines.length) {
		return {
			nextIndex: index,
			block: {
				type: "unsupported",
				reason: "table fence is not closed correctly",
			},
		};
	}

	if (rows.length === 0) {
		return {
			nextIndex: index + 1,
			block: {
				type: "unsupported",
				reason: "table requires at least one header row",
			},
		};
	}

	return {
		nextIndex: index + 1,
		block: {
			type: "table",
			align,
			header: rows[0] ?? { cells: [] },
			rows: rows.slice(1),
		},
	};
}

function parseAnchor(line: string): string | undefined {
	const bracketMatch = line.match(/^\[#([A-Za-z0-9:_-]+)\]$/);
	if (bracketMatch?.[1] !== undefined) {
		return bracketMatch[1];
	}

	const doubleBracketMatch = line.match(/^\[\[([A-Za-z0-9:_-]+)\]\]$/);
	return doubleBracketMatch?.[1];
}

function parseHtmlAnchor(line: string): string | undefined {
	const match = line.match(/^<a id="([^"]+)"><\/a>$/);
	return match?.[1];
}

function isAttributeEntry(line: string): boolean {
	return attributeEntryPattern.test(line);
}

function isCommentLine(line: string): boolean {
	return (
		line.startsWith("//") && !line.startsWith("// include cycle prevented")
	);
}

function isConditionalDirectiveLine(line: string): boolean {
	return /^(?:ifdef|ifndef|ifeval|endif)::/.test(line);
}

function isGenericBlockAttributeLine(line: string): boolean {
	return /^\[[^\]]+\]$/.test(line);
}

function isOpenBlockDelimiter(line: string): boolean {
	return line.trim() === "****";
}

function isPageBreak(line: string): boolean {
	return line.trim() === "<<<<";
}

function parseTableAlignment(
	line: string,
): Array<"left" | "center" | "right" | null> | undefined {
	const match = line.match(/^\[[^\]]*\bcols="?([^"\]]+)"?[^\]]*\]$/);
	if (match?.[1] === undefined) {
		return undefined;
	}

	return match[1].split(",").map((part) => {
		const token = part.trim();
		if (token.startsWith("<")) {
			return "left";
		}
		if (token.startsWith("^")) {
			return "center";
		}
		if (token.startsWith(">")) {
			return "right";
		}

		return null;
	});
}

function parseAdmonition(line: string): MarkdownAdmonition | undefined {
	const match = line.match(admonitionPattern);
	if (match === null) {
		return undefined;
	}

	const [, kind, content] = match;
	if (kind === undefined || content === undefined) {
		return undefined;
	}

	return {
		type: "admonition",
		kind: kind.toLowerCase() as MarkdownAdmonition["kind"],
		children: [
			{
				type: "paragraph",
				children: [...parseInline(content)],
			},
		],
	};
}

function parseStandaloneImage(line: string): MarkdownParagraph | undefined {
	const token = matchImage(line.trim());
	if (token === undefined || token.raw !== line.trim()) {
		return undefined;
	}

	return {
		type: "paragraph",
		children: [
			{
				type: "image",
				url: token.url,
				title: token.title,
				alt: parseInline(token.alt),
			},
		],
	};
}

function parseSourceBlock(
	lines: string[],
	startIndex: number,
): { block: MarkdownBlock; nextIndex: number } {
	const line = lines[startIndex]?.trim() ?? "";
	const sourceMatch = line.match(/^\[source,?([^\],]+)?(?:,([^\]]+))?\]$/);
	const language = sourceMatch?.[1]?.trim() || undefined;
	const meta = sourceMatch?.[2]?.trim() || undefined;
	const openingFence = lines[startIndex + 1]?.trim();

	if (openingFence !== "----") {
		return {
			block: {
				type: "unsupported",
				reason: "source block fence is not closed correctly",
			},
			nextIndex: startIndex + 1,
		};
	}

	let index = startIndex + 2;
	const codeLines: string[] = [];
	const callouts = new Set<number>();
	while (index < lines.length && lines[index]?.trim() !== "----") {
		const codeLine = lines[index] ?? "";
		for (const match of codeLine.matchAll(/<(\d+)>/g)) {
			const rawNumber = match[1];
			if (rawNumber !== undefined) {
				callouts.add(Number(rawNumber));
			}
		}
		codeLines.push(codeLine);
		index += 1;
	}

	if (index >= lines.length) {
		return {
			block: {
				type: "unsupported",
				reason: "source block fence is not closed correctly",
			},
			nextIndex: index,
		};
	}

	return {
		block: <MarkdownCodeBlock>{
			type: "codeBlock",
			language,
			meta,
			value: codeLines.join("\n"),
			callouts: callouts.size === 0 ? undefined : [...callouts],
		},
		nextIndex: index + 1,
	};
}

function parseQuoteBlock(
	lines: string[],
	startIndex: number,
): { block: MarkdownBlock; nextIndex: number } {
	if (lines[startIndex + 1]?.trim() !== "____") {
		return {
			block: {
				type: "unsupported",
				reason: "quote block fence is not closed correctly",
			},
			nextIndex: startIndex + 1,
		};
	}

	let index = startIndex + 2;
	const quoteLines: string[] = [];
	while (index < lines.length && lines[index]?.trim() !== "____") {
		quoteLines.push(lines[index] ?? "");
		index += 1;
	}

	if (index >= lines.length) {
		return {
			block: {
				type: "unsupported",
				reason: "quote block fence is not closed correctly",
			},
			nextIndex: index,
		};
	}

	return {
		block: <MarkdownBlockQuote>{
			type: "blockquote",
			children: parseBlocks(quoteLines),
		},
		nextIndex: index + 1,
	};
}

function parseParagraphBlock(
	lines: string[],
	startIndex: number,
): { block: MarkdownParagraph; nextIndex: number } {
	const paragraphLines = [(lines[startIndex] ?? "").trim()];
	let index = startIndex + 1;

	while (index < lines.length) {
		const nextLine = lines[index] ?? "";
		if (nextLine.trim().length === 0) {
			index += 1;
			break;
		}

		if (isBlockBoundary(nextLine.trimStart())) {
			break;
		}

		paragraphLines.push(nextLine.trim());
		index += 1;
	}

	return {
		block: <MarkdownParagraph>{
			type: "paragraph",
			children: parseInline(paragraphLines.join(" ")),
		},
		nextIndex: index,
	};
}

function parseLabeledGroup(
	lines: string[],
	startIndex: number,
): { block: MarkdownLabeledGroup; nextIndex: number } | undefined {
	const marker = parseLabeledGroupMarker(lines[startIndex]?.trim() ?? "");
	if (marker === undefined) {
		return undefined;
	}

	if (marker.content !== undefined && marker.content.length > 0) {
		return {
			block: {
				type: "labeledGroup",
				label: parseInline(marker.label),
				children: [
					{
						type: "paragraph",
						children: parseInline(marker.content),
					},
				],
			},
			nextIndex: startIndex + 1,
		};
	}

	let index = startIndex + 1;
	while (index < lines.length && lines[index]?.trim().length === 0) {
		index += 1;
	}

	const contentLines: string[] = [];
	while (index < lines.length) {
		const trimmed = lines[index]?.trim() ?? "";
		if (
			contentLines.length > 0 &&
			(parseHeading(trimmed) !== undefined ||
				parseLabeledGroupMarker(trimmed) !== undefined)
		) {
			break;
		}

		contentLines.push(lines[index] ?? "");
		index += 1;
	}

	return {
		block: {
			type: "labeledGroup",
			label: parseInline(marker.label),
			children: parseBlocks(contentLines),
		},
		nextIndex: index,
	};
}

function resolveIncludePath(
	sourcePath: string,
	includeTarget: string,
	includeRootDir = dirname(sourcePath),
): string {
	if (includeTarget.startsWith("partial$")) {
		return resolve(
			includeRootDir,
			"partials",
			includeTarget.slice("partial$".length),
		);
	}

	return resolve(dirname(sourcePath), includeTarget);
}

function defaultIncludeResolver(
	includeTarget: string,
	context: { includeRootDir: string; sourcePath: string },
): string | undefined {
	const resolvedPath = resolveIncludePath(
		context.sourcePath,
		includeTarget,
		context.includeRootDir,
	);
	if (!existsSync(resolvedPath)) {
		return undefined;
	}

	return readFileSync(resolvedPath, "utf8");
}

function selectTaggedRegions(content: string, tagValue: string): string {
	const requestedTags = parseIncludeTagSelection(tagValue)?.tags ?? [];
	if (requestedTags.length === 0) {
		return content;
	}

	const activeTags = new Set<string>();
	const selectedLines: string[] = [];
	for (const line of content.split(/\r?\n/)) {
		const startMatch = line.match(tagStartPattern);
		if (startMatch?.[1] !== undefined) {
			activeTags.add(startMatch[1]);
			continue;
		}

		const endMatch = line.match(tagEndPattern);
		if (endMatch?.[1] !== undefined) {
			activeTags.delete(endMatch[1]);
			continue;
		}

		if (requestedTags.some((tag) => activeTags.has(tag))) {
			selectedLines.push(line);
		}
	}

	return selectedLines.join("\n");
}

function parsePositiveInteger(value: string): number | undefined {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return undefined;
	}

	return parsed;
}

function parseIncludeTagSelection(
	tagValue: string,
): MarkdownIncludeTagSelection | undefined {
	const tags = [
		...new Set(
			tagValue
				.split(/[;,]/)
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	];
	if (tags.length === 0) {
		return undefined;
	}

	return {
		precedence: "document-order",
		tags,
	};
}

function parseIncludeLineRanges(lineSpec: string): {
	diagnostics: MarkdownIncludeDiagnostic[];
	lineRanges?: MarkdownIncludeLineRange[];
} {
	const diagnostics: MarkdownIncludeDiagnostic[] = [];
	const ranges = lineSpec
		.split(/[;,]/)
		.map((segment) => segment.trim())
		.filter(Boolean)
		.flatMap<MarkdownIncludeLineRange>((segment) => {
			const rangeMatch = segment.match(/^(-?\d*)\.\.(-?\d*)(?:\.\.(\d+))?$/);
			if (rangeMatch !== null) {
				const [, rawStart = "", rawEnd = "", rawStep = ""] = rangeMatch;
				if (rawStart.startsWith("-") || rawEnd.startsWith("-")) {
					diagnostics.push({
						code: "invalid-line-range",
						message:
							"include line ranges must use positive line numbers or open-ended bounds",
						source: segment,
					});
					return [];
				}
				const start =
					rawStart === "" ? undefined : parsePositiveInteger(rawStart);
				const end = rawEnd === "" ? undefined : parsePositiveInteger(rawEnd);
				const step = rawStep === "" ? undefined : parsePositiveInteger(rawStep);
				if (start === undefined && end === undefined) {
					diagnostics.push({
						code: "invalid-line-range",
						message: "include line ranges cannot omit both bounds",
						source: segment,
					});
					return [];
				}
				if (rawStep !== "" && step === undefined) {
					diagnostics.push({
						code: "invalid-line-step",
						message: "include line steps must be positive integers",
						source: segment,
					});
					return [];
				}

				if (
					start !== undefined &&
					end !== undefined &&
					Number.isFinite(start) &&
					Number.isFinite(end)
				) {
					return start <= end
						? [{ start, end, step }]
						: [{ start: end, end: start, step }];
				}

				return [{ start, end, step }];
			}

			const lineNumber = parsePositiveInteger(segment);
			if (lineNumber === undefined) {
				diagnostics.push({
					code: "invalid-line-range",
					message: "include line selectors must be positive integers or ranges",
					source: segment,
				});
				return [];
			}

			return [{ start: lineNumber, end: lineNumber }];
		});

	return {
		diagnostics,
		lineRanges: ranges.length === 0 ? undefined : ranges,
	};
}

function parseIncludeSemantics(
	attributes: Record<string, string>,
): ParsedIncludeSemantics {
	const diagnostics: MarkdownIncludeDiagnostic[] = [];
	const tagValue = attributes.tag ?? attributes.tags;
	const tagSelection =
		tagValue === undefined ? undefined : parseIncludeTagSelection(tagValue);
	if (tagValue !== undefined && tagSelection === undefined) {
		diagnostics.push({
			code: "empty-tag-selection",
			message: "include tag selection must contain at least one tag",
			source: tagValue,
		});
	}
	const parsedLineRanges =
		attributes.lines === undefined
			? { diagnostics: [], lineRanges: undefined }
			: parseIncludeLineRanges(attributes.lines);
	diagnostics.push(...parsedLineRanges.diagnostics);
	const indent =
		attributes.indent === undefined
			? undefined
			: parsePositiveInteger(attributes.indent);
	if (attributes.indent !== undefined && indent === undefined) {
		diagnostics.push({
			code: "invalid-indent",
			message: "include indent must be a positive integer",
			source: attributes.indent,
		});
	}
	const levelOffsetMatch = attributes.leveloffset?.match(/^([+-]?\d+)$/);
	const levelOffset =
		levelOffsetMatch?.[1] === undefined
			? undefined
			: Number(levelOffsetMatch[1]);
	if (
		attributes.leveloffset !== undefined &&
		(levelOffset === undefined || !Number.isFinite(levelOffset))
	) {
		diagnostics.push({
			code: "invalid-leveloffset",
			message: "include leveloffset must be a signed integer",
			source: attributes.leveloffset,
		});
	}

	if (
		tagSelection === undefined &&
		parsedLineRanges.lineRanges === undefined &&
		indent === undefined &&
		(levelOffset === undefined || !Number.isFinite(levelOffset))
	) {
		return {
			diagnostics,
		};
	}

	return {
		diagnostics,
		semantics: {
			tagSelection,
			lineRanges: parsedLineRanges.lineRanges,
			indent,
			levelOffset:
				levelOffset !== undefined && Number.isFinite(levelOffset)
					? levelOffset
					: undefined,
		},
	};
}

function applyLevelOffset(content: string, levelOffset: string): string {
	const match = levelOffset.match(/^([+-]?\d+)$/);
	if (match?.[1] === undefined) {
		return content;
	}

	const delta = Number(match[1]);
	if (!Number.isFinite(delta) || delta === 0) {
		return content;
	}

	return content
		.split(/\r?\n/)
		.map((line) => {
			const headingMatch = line.match(/^(=+)(\s+.*)$/);
			if (headingMatch === null) {
				return line;
			}

			const [, markers, rest] = headingMatch;
			if (markers === undefined || rest === undefined) {
				return line;
			}

			const adjustedDepth = Math.max(1, markers.length + delta);
			return `${"=".repeat(adjustedDepth)}${rest}`;
		})
		.join("\n");
}

function applyLineSelection(content: string, lineSpec: string): string {
	const lines = content.split(/\r?\n/);
	const ranges = parseIncludeLineRanges(lineSpec).lineRanges;
	if (ranges === undefined) {
		return content;
	}

	const selectedLines: string[] = [];
	const seenLineNumbers = new Set<number>();

	for (const range of ranges) {
		const start = range.start ?? 1;
		const end = range.end ?? lines.length;
		const step = range.step ?? 1;
		for (let index = start; index <= end; index += step) {
			if (seenLineNumbers.has(index)) {
				continue;
			}

			const line = lines[index - 1];
			if (line !== undefined) {
				selectedLines.push(line);
				seenLineNumbers.add(index);
			}
		}
	}

	return selectedLines.join("\n");
}

function applyIndent(content: string, indent: string): string {
	const size = Number(indent);
	if (!Number.isFinite(size) || size <= 0) {
		return content;
	}

	const padding = " ".repeat(size);
	return content
		.split(/\r?\n/)
		.map((line) => (line.length === 0 ? line : `${padding}${line}`))
		.join("\n");
}

function applyIncludeAttributes(
	content: string,
	attributes: Record<string, string>,
): string {
	const tagSelection = attributes.tag ?? attributes.tags;
	let transformed =
		tagSelection === undefined
			? content
			: selectTaggedRegions(content, tagSelection);

	if (attributes.leveloffset !== undefined) {
		transformed = applyLevelOffset(transformed, attributes.leveloffset);
	}
	if (attributes.lines !== undefined) {
		transformed = applyLineSelection(transformed, attributes.lines);
	}
	if (attributes.indent !== undefined) {
		transformed = applyIndent(transformed, attributes.indent);
	}

	return transformed;
}

function expandIncludes(
	assembledAsciiDoc: string,
	options: ConvertAssemblyToMarkdownIROptions,
	visited = new Set<string>(),
): string {
	if (options.sourcePath === undefined) {
		return assembledAsciiDoc;
	}

	const includeRootDir = options.includeRootDir ?? dirname(options.sourcePath);
	const includeResolver = options.includeResolver ?? defaultIncludeResolver;
	const lines = assembledAsciiDoc.split(/\r?\n/);
	const expandedLines: string[] = [];
	const inclusionStack = [...visited, options.sourcePath].filter(
		(path, index, array) => array.indexOf(path) === index,
	);

	for (const line of lines) {
		const directive = parseIncludeDirective(line);
		if (directive === undefined) {
			expandedLines.push(line);
			continue;
		}
		const includeTarget = directive.target;

		const resolvedPath = resolveIncludePath(
			options.sourcePath,
			includeTarget,
			includeRootDir,
		);
		const parsedSemantics = parseIncludeSemantics(directive.attributes);
		expandedLines.push(
			encodeIncludeDirectiveMarker({
				target: includeTarget,
				attributes: directive.attributes,
				diagnostics:
					parsedSemantics.diagnostics.length === 0
						? undefined
						: parsedSemantics.diagnostics,
				semantics: parsedSemantics.semantics,
				provenance: {
					depth: inclusionStack.length - 1,
					includeRootDir,
					inclusionStack,
					includingSourcePath: options.sourcePath,
					resolvedPath,
				},
			}),
		);
		if (visited.has(resolvedPath)) {
			expandedLines.push(
				`// include cycle prevented for ${includeTarget} from ${options.sourcePath}`,
			);
			continue;
		}

		const includeContent = includeResolver(includeTarget, {
			includeRootDir,
			sourcePath: options.sourcePath,
		});
		if (includeContent === undefined) {
			expandedLines.push(line);
			continue;
		}
		const transformedInclude = applyIncludeAttributes(
			includeContent,
			directive.attributes,
		);

		const nestedVisited = new Set(visited);
		nestedVisited.add(resolvedPath);
		const expandedInclude = expandIncludes(
			transformedInclude,
			{
				...options,
				includeRootDir,
				sourcePath: resolvedPath,
			},
			nestedVisited,
		);
		expandedLines.push(expandedInclude);
	}

	return expandedLines.join("\n");
}

function parseIncludeDirectiveMarker(
	line: string,
): MarkdownIncludeDirective | undefined {
	return decodeIncludeDirectiveMarker(line);
}

function isBlockBoundary(line: string): boolean {
	return (
		parseHeading(line) !== undefined ||
		parseAnchor(line) !== undefined ||
		parseHtmlAnchor(line) !== undefined ||
		line.match(pageAliasesPattern) !== null ||
		isAttributeEntry(line) ||
		isConditionalDirectiveLine(line) ||
		isCommentLine(line) ||
		isGenericBlockAttributeLine(line) ||
		parseTableAlignment(line) !== undefined ||
		parseListMarker(line) !== undefined ||
		parseLabeledGroupMarker(line) !== undefined ||
		parseBlockLabelMarker(line) !== undefined ||
		isOpenBlockDelimiter(line) ||
		isPageBreak(line) ||
		line === "[quote]" ||
		line.startsWith("[source") ||
		line === "|===" ||
		line === "'''" ||
		line.startsWith("include::") ||
		parseAdmonition(line) !== undefined ||
		parseStandaloneImage(line) !== undefined
	);
}

function attachAnchorsToHeadings(blocks: MarkdownBlock[]): MarkdownBlock[] {
	const attached: MarkdownBlock[] = [];
	let pendingAnchor: string | undefined;

	for (const block of blocks) {
		if (block.type === "anchor") {
			pendingAnchor = block.identifier;
			continue;
		}

		if (block.type === "heading" && pendingAnchor !== undefined) {
			attached.push({
				...block,
				identifier: pendingAnchor,
			});
			pendingAnchor = undefined;
			continue;
		}

		if (pendingAnchor !== undefined) {
			attached.push({
				type: "anchor",
				identifier: pendingAnchor,
			});
			pendingAnchor = undefined;
		}
		attached.push(block);
	}

	if (pendingAnchor !== undefined) {
		attached.push({
			type: "anchor",
			identifier: pendingAnchor,
		});
	}

	return attached;
}

function parseBlockAt(
	lines: string[],
	startIndex: number,
): { blocks: MarkdownBlock[]; nextIndex: number } {
	const rawLine = lines[startIndex] ?? "";
	const line = rawLine.trimEnd();

	if (line.trim().length === 0) {
		return { blocks: [], nextIndex: startIndex + 1 };
	}

	const heading = parseHeading(line.trimStart());
	if (heading !== undefined) {
		return {
			blocks: [heading],
			nextIndex: startIndex + 1,
		};
	}

	const anchorId = parseAnchor(line.trim());
	if (anchorId !== undefined) {
		return {
			blocks: [
				{
					type: "anchor",
					identifier: anchorId,
				},
			],
			nextIndex: startIndex + 1,
		};
	}

	const htmlAnchorId = parseHtmlAnchor(line.trim());
	if (htmlAnchorId !== undefined) {
		return {
			blocks: [
				{
					type: "anchor",
					identifier: htmlAnchorId,
				},
			],
			nextIndex: startIndex + 1,
		};
	}

	const pageAliasesMatch = line.trim().match(pageAliasesPattern);
	if (pageAliasesMatch?.[1] !== undefined) {
		return {
			blocks: [
				{
					type: "pageAliases",
					aliases: pageAliasesMatch[1]
						.split(",")
						.map((alias) => alias.trim())
						.filter(Boolean),
				},
			],
			nextIndex: startIndex + 1,
		};
	}

	if (
		isAttributeEntry(line.trim()) ||
		isConditionalDirectiveLine(line.trim()) ||
		isCommentLine(line.trim()) ||
		(isGenericBlockAttributeLine(line.trim()) &&
			parseTableAlignment(line.trim()) === undefined &&
			line.trim() !== "[quote]" &&
			!line.trim().startsWith("[source"))
	) {
		return { blocks: [], nextIndex: startIndex + 1 };
	}

	const includeDirective = parseIncludeDirectiveMarker(line.trim());
	if (includeDirective !== undefined) {
		return {
			blocks: [includeDirective],
			nextIndex: startIndex + 1,
		};
	}

	if (isPageBreak(line.trim()) || line.trim() === "'''") {
		return {
			blocks: [{ type: "thematicBreak" }],
			nextIndex: startIndex + 1,
		};
	}

	const tableAlignment = parseTableAlignment(line.trim());
	if (
		tableAlignment !== undefined &&
		lines[startIndex + 1]?.trim() === "|==="
	) {
		const { block, nextIndex } = parseTable(
			lines,
			startIndex + 1,
			tableAlignment,
		);
		return {
			blocks: [block],
			nextIndex,
		};
	}

	if (isOpenBlockDelimiter(line.trim())) {
		let index = startIndex + 1;
		const blockLines: string[] = [];
		while (index < lines.length && !isOpenBlockDelimiter(lines[index] ?? "")) {
			blockLines.push(lines[index] ?? "");
			index += 1;
		}

		if (index >= lines.length) {
			return {
				blocks: [
					{
						type: "unsupported",
						reason: "open block fence is not closed correctly",
					},
				],
				nextIndex: index,
			};
		}

		return {
			blocks: parseBlocks(blockLines),
			nextIndex: index + 1,
		};
	}

	if (parseListMarker(line) !== undefined) {
		const { block, nextIndex } = parseList(lines, startIndex);
		return {
			blocks: [block],
			nextIndex,
		};
	}

	const labeledGroup = parseLabeledGroup(lines, startIndex);
	if (labeledGroup !== undefined) {
		return {
			blocks: [labeledGroup.block],
			nextIndex: labeledGroup.nextIndex,
		};
	}

	const blockLabel = parseBlockLabelMarker(line.trim());
	if (blockLabel !== undefined) {
		if (blockLabel.content === undefined) {
			let index = startIndex + 1;
			while (
				index < lines.length &&
				(lines[index]?.trim() ?? "").length === 0
			) {
				index += 1;
			}

			const contentLines: string[] = [];
			while (index < lines.length) {
				const trimmed = lines[index]?.trim() ?? "";
				if (
					contentLines.length > 0 &&
					(parseHeading(trimmed) !== undefined ||
						parseLabeledGroupMarker(trimmed) !== undefined ||
						parseBlockLabelMarker(trimmed) !== undefined)
				) {
					break;
				}
				contentLines.push(lines[index] ?? "");
				index += 1;
			}

			return {
				blocks: [
					{
						type: "labeledGroup",
						label: parseInline(blockLabel.label),
						children: parseBlocks(contentLines),
					},
				],
				nextIndex: index,
			};
		}

		return {
			blocks: [
				{
					type: "labeledGroup",
					label: parseInline(blockLabel.label),
					children: [
						{
							type: "paragraph",
							children: parseInline(blockLabel.content ?? ""),
						},
					],
				},
			],
			nextIndex: startIndex + 1,
		};
	}

	if (line.trim() === "|===") {
		const { block, nextIndex } = parseTable(lines, startIndex);
		return {
			blocks: [block],
			nextIndex,
		};
	}

	if (line.trimStart().startsWith("include::")) {
		return {
			blocks: [
				{
					type: "unsupported",
					reason: `include directive is not yet inlined: ${line.trim()}`,
				},
			],
			nextIndex: startIndex + 1,
		};
	}

	const admonition = parseAdmonition(line.trimStart());
	if (admonition !== undefined) {
		return {
			blocks: [admonition],
			nextIndex: startIndex + 1,
		};
	}

	const standaloneImage = parseStandaloneImage(line);
	if (standaloneImage !== undefined) {
		return {
			blocks: [standaloneImage],
			nextIndex: startIndex + 1,
		};
	}

	if (line.startsWith("[source")) {
		const { block, nextIndex } = parseSourceBlock(lines, startIndex);
		const blocks: MarkdownBlock[] = [block];
		const { block: calloutList, nextIndex: calloutIndex } = parseCalloutList(
			lines,
			nextIndex,
		);
		if (calloutList !== undefined) {
			blocks.push(calloutList);
			return { blocks, nextIndex: calloutIndex };
		}
		return { blocks, nextIndex };
	}

	if (line.trim() === "[quote]") {
		const { block, nextIndex } = parseQuoteBlock(lines, startIndex);
		return {
			blocks: [block],
			nextIndex,
		};
	}

	const { block, nextIndex } = parseParagraphBlock(lines, startIndex);
	return {
		blocks: [block],
		nextIndex,
	};
}

function parseBlocks(lines: string[]): MarkdownBlock[] {
	const children: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const { blocks, nextIndex } = parseBlockAt(lines, index);
		children.push(...blocks);
		index = nextIndex;
	}

	return attachAnchorsToHeadings(children);
}

export function convertAssemblyToMarkdownIR(
	assembledAsciiDoc: string,
	options: ConvertAssemblyToMarkdownIROptions = {},
): MarkdownDocument {
	const expandedAsciiDoc = expandIncludes(assembledAsciiDoc, options);
	const lines = expandedAsciiDoc.split(/\r?\n/);

	return {
		type: "document",
		renderOptions: parseDocumentRenderOptions(lines),
		children: parseBlocks(lines),
	};
}
