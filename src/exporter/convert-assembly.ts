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
	MarkdownImage,
	MarkdownInline,
	MarkdownList,
	MarkdownParagraph,
	MarkdownTable,
	MarkdownTableRow,
} from "../markdown/ir.js";

const listMarkerPattern = /^\s*([*.]+)\s+(.*)$/;
const admonitionPattern = /^(NOTE|TIP|IMPORTANT|CAUTION|WARNING):\s+(.*)$/;
const calloutPattern = /^<(\d+)>\s+(.*)$/;
const includePattern = /^include::([^\[]+)\[[^\]]*\]$/;
const pageAliasesPattern = /^:page-aliases:\s+(.+)$/;

type ParsedListMarker = {
	content: string;
	depth: number;
	ordered: boolean;
};

export type ConvertAssemblyToMarkdownIROptions = {
	includeRootDir?: string;
	includeResolver?: (
		includeTarget: string,
		context: { includeRootDir: string; sourcePath: string },
	) => string | undefined;
	sourcePath?: string;
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
	| CodeToken
	| StrongToken
	| EmphasisToken;

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

function matchLink(value: string): LinkToken | undefined {
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

	const xrefMatch = value.match(/^xref:([^\[]+)\[([^\]]*)\]/);
	if (xrefMatch === null) {
		return undefined;
	}

	const [, url, label] = xrefMatch;
	if (url === undefined || label === undefined) {
		return undefined;
	}

	const normalizedLabel =
		label.length > 0
			? label
			: url.startsWith("#")
				? url.slice(1)
				: (url.split("#")[1] ??
					url
						.split("/")
						.at(-1)
						?.replace(/\.adoc$/, "") ??
					url);

	return {
		type: "link",
		raw: xrefMatch[0],
		url,
		label: normalizedLabel,
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

	return {
		type: "heading",
		depth: Math.max(1, markers.length - 1),
		children: parseInline(content.trim()),
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
	}

	return { block: rootList, nextIndex: index };
}

function parseTableRow(line: string): MarkdownTableRow {
	const cells = line
		.split("|")
		.slice(1)
		.map((cell) => ({
			children: parseInline(cell.trim()),
		}));

	return { cells };
}

function parseTable(
	lines: string[],
	startIndex: number,
	align?: Array<"left" | "center" | "right" | null>,
): { block: MarkdownTable | MarkdownBlock; nextIndex: number } {
	let index = startIndex + 1;
	const rows: MarkdownTableRow[] = [];

	while (index < lines.length && (lines[index]?.trim() ?? "") !== "|===") {
		const line = lines[index]?.trim() ?? "";
		if (line.length > 0 && line.startsWith("|")) {
			rows.push(parseTableRow(line));
		}
		index += 1;
	}

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

function parseTableAlignment(
	line: string,
): Array<"left" | "center" | "right" | null> | undefined {
	const match = line.match(/^\[cols="?([^"\]]+)"?\]$/);
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

	for (const line of lines) {
		const match = line.trim().match(includePattern);
		if (match === null) {
			expandedLines.push(line);
			continue;
		}

		const includeTarget = match[1];
		if (includeTarget === undefined) {
			expandedLines.push(line);
			continue;
		}

		const resolvedPath = resolveIncludePath(
			options.sourcePath,
			includeTarget,
			includeRootDir,
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

		const nestedVisited = new Set(visited);
		nestedVisited.add(resolvedPath);
		const expandedInclude = expandIncludes(
			includeContent,
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

function isBlockBoundary(line: string): boolean {
	return (
		parseHeading(line) !== undefined ||
		parseAnchor(line) !== undefined ||
		line.match(pageAliasesPattern) !== null ||
		parseTableAlignment(line) !== undefined ||
		parseListMarker(line) !== undefined ||
		line === "[quote]" ||
		line.startsWith("[source") ||
		line === "|===" ||
		line === "'''" ||
		line.startsWith("include::") ||
		parseAdmonition(line) !== undefined ||
		parseStandaloneImage(line) !== undefined
	);
}

function parseBlocks(lines: string[]): MarkdownBlock[] {
	const children: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const rawLine = lines[index] ?? "";
		const line = rawLine.trimEnd();

		if (line.trim().length === 0) {
			index += 1;
			continue;
		}

		const heading = parseHeading(line.trimStart());
		if (heading !== undefined) {
			children.push(heading);
			index += 1;
			continue;
		}

		const anchorId = parseAnchor(line.trim());
		if (anchorId !== undefined) {
			children.push({
				type: "htmlBlock",
				value: `<a id="${anchorId}"></a>`,
			});
			index += 1;
			continue;
		}

		const pageAliasesMatch = line.trim().match(pageAliasesPattern);
		if (pageAliasesMatch?.[1] !== undefined) {
			children.push({
				type: "htmlBlock",
				value: `<!-- page-aliases: ${pageAliasesMatch[1].trim()} -->`,
			});
			index += 1;
			continue;
		}

		if (line.trim() === "'''") {
			children.push({ type: "thematicBreak" });
			index += 1;
			continue;
		}

		const tableAlignment = parseTableAlignment(line.trim());
		if (tableAlignment !== undefined && lines[index + 1]?.trim() === "|===") {
			const { block, nextIndex } = parseTable(lines, index + 1, tableAlignment);
			children.push(block);
			index = nextIndex;
			continue;
		}

		if (parseListMarker(line) !== undefined) {
			const { block, nextIndex } = parseList(lines, index);
			children.push(block);
			index = nextIndex;
			continue;
		}

		if (line.trim() === "|===") {
			const { block, nextIndex } = parseTable(lines, index);
			children.push(block);
			index = nextIndex;
			continue;
		}

		if (line.trimStart().startsWith("include::")) {
			children.push({
				type: "unsupported",
				reason: `include directive is not yet inlined: ${line.trim()}`,
			});
			index += 1;
			continue;
		}

		const admonition = parseAdmonition(line.trimStart());
		if (admonition !== undefined) {
			children.push(admonition);
			index += 1;
			continue;
		}

		const standaloneImage = parseStandaloneImage(line);
		if (standaloneImage !== undefined) {
			children.push(standaloneImage);
			index += 1;
			continue;
		}

		if (line.startsWith("[source")) {
			const sourceMatch = line.match(/^\[source,?([^\],]+)?(?:,([^\]]+))?\]$/);
			const language = sourceMatch?.[1]?.trim() || undefined;
			const meta = sourceMatch?.[2]?.trim() || undefined;
			const openingFence = lines[index + 1]?.trim();

			if (openingFence !== "----") {
				children.push({
					type: "unsupported",
					reason: "source block fence is not closed correctly",
				});
				index += 1;
				continue;
			}

			index += 2;
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
				children.push({
					type: "unsupported",
					reason: "source block fence is not closed correctly",
				});
				continue;
			}

			children.push(<MarkdownCodeBlock>{
				type: "codeBlock",
				language,
				meta,
				value: codeLines.join("\n"),
				callouts: callouts.size === 0 ? undefined : [...callouts],
			});
			index += 1;

			const { block: calloutList, nextIndex } = parseCalloutList(lines, index);
			if (calloutList !== undefined) {
				children.push(calloutList);
				index = nextIndex;
			}
			continue;
		}

		if (line.trim() === "[quote]") {
			if (lines[index + 1]?.trim() !== "____") {
				children.push({
					type: "unsupported",
					reason: "quote block fence is not closed correctly",
				});
				index += 1;
				continue;
			}

			index += 2;
			const quoteLines: string[] = [];
			while (index < lines.length && lines[index]?.trim() !== "____") {
				quoteLines.push(lines[index] ?? "");
				index += 1;
			}

			if (index >= lines.length) {
				children.push({
					type: "unsupported",
					reason: "quote block fence is not closed correctly",
				});
				continue;
			}

			children.push(<MarkdownBlockQuote>{
				type: "blockquote",
				children: parseBlocks(quoteLines),
			});
			index += 1;
			continue;
		}

		const paragraphLines = [line.trim()];
		index += 1;

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

		children.push(<MarkdownParagraph>{
			type: "paragraph",
			children: parseInline(paragraphLines.join(" ")),
		});
	}

	return children;
}

export function convertAssemblyToMarkdownIR(
	assembledAsciiDoc: string,
	options: ConvertAssemblyToMarkdownIROptions = {},
): MarkdownDocument {
	const expandedAsciiDoc = expandIncludes(assembledAsciiDoc, options);
	const lines = expandedAsciiDoc.split(/\r?\n/);

	return {
		type: "document",
		children: parseBlocks(lines),
	};
}
