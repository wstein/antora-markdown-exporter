import type {
	MarkdownBlock,
	MarkdownBlockQuote,
	MarkdownCodeBlock,
	MarkdownDocument,
	MarkdownHeading,
	MarkdownInline,
	MarkdownList,
	MarkdownParagraph,
} from "../markdown/ir.js";

const externalLinkPattern = /(?:link:)?(https?:\/\/[^\s[]+)\[([^\]]+)\]/g;
const listMarkerPattern = /^\s*([*.]+)\s+(.*)$/;

type ParsedListMarker = {
	content: string;
	depth: number;
	ordered: boolean;
};

function parseInline(value: string): MarkdownInline[] {
	const nodes: MarkdownInline[] = [];
	let lastIndex = 0;

	for (const match of value.matchAll(externalLinkPattern)) {
		const [raw, url, label] = match;
		const start = match.index ?? 0;

		if (url === undefined || label === undefined) {
			continue;
		}

		if (start > lastIndex) {
			nodes.push({
				type: "text",
				value: value.slice(lastIndex, start),
			});
		}

		nodes.push({
			type: "link",
			url,
			children: [{ type: "text", value: label }],
		});
		lastIndex = start + raw.length;
	}

	if (lastIndex < value.length) {
		nodes.push({
			type: "text",
			value: value.slice(lastIndex),
		});
	}

	if (nodes.length === 0) {
		nodes.push({ type: "text", value });
	}

	return nodes;
}

function isBlockBoundary(line: string): boolean {
	return (
		line.startsWith("== ") ||
		parseListMarker(line) !== undefined ||
		line === "[quote]" ||
		line.startsWith("[source")
	);
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

function parseBlocks(lines: string[]): MarkdownBlock[] {
	const children: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index]?.trimEnd() ?? "";

		if (line.trim().length === 0) {
			index += 1;
			continue;
		}

		if (line.startsWith("== ")) {
			children.push(<MarkdownHeading>{
				type: "heading",
				depth: 1,
				children: parseInline(line.slice(3).trim()),
			});
			index += 1;
			continue;
		}

		if (parseListMarker(line) !== undefined) {
			const { block, nextIndex } = parseList(lines, index);
			children.push(block);
			index = nextIndex;
			continue;
		}

		if (line.startsWith("[source")) {
			const languageMatch = line.match(/^\[source,?([^\]]+)?\]$/);
			const language = languageMatch?.[1]?.trim() || undefined;
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
			while (index < lines.length && lines[index]?.trim() !== "----") {
				codeLines.push(lines[index] ?? "");
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
				value: codeLines.join("\n"),
			});
			index += 1;
			continue;
		}

		if (line === "[quote]") {
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

		const paragraphLines = [line];
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
): MarkdownDocument {
	const lines = assembledAsciiDoc.split(/\r?\n/);

	return {
		type: "document",
		children: parseBlocks(lines),
	};
}
