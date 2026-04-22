import type {
	MarkdownAdmonition,
	MarkdownBlock,
	MarkdownBlockQuote,
	MarkdownCalloutList,
	MarkdownCodeBlock,
	MarkdownDocument,
	MarkdownHeadingNumberingMode,
	MarkdownLabeledGroup,
	MarkdownList,
	MarkdownParagraph,
	MarkdownTable,
	MarkdownTableRow,
} from "../../markdown/ir.js";
import { parseIncludeDirectiveMarker } from "./includes.js";
import { matchImage, parseHeading, parseInline } from "./inline.js";
import type { ParsedLabeledGroupMarker, ParsedListMarker } from "./types.js";

const listMarkerPattern = /^\s*([*.]+)\s+(.*)$/;
const labeledGroupPattern = /^(.+?)::(?:\s+(.*))?$/;
const blockLabelPattern = /^\.(.+)$/u;
const admonitionPattern = /^(NOTE|TIP|IMPORTANT|CAUTION|WARNING):\s+(.*)$/;
const calloutPattern = /^<(\d+)>\s+(.*)$/;
const pageAliasesPattern = /^:page-aliases:\s+(.+)$/;
const attributeEntryPattern = /^:(!?[\p{Alpha}0-9_][^:]*):(?:\s+.*)?$/u;

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

export function parseDocumentRenderOptions(
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

export function parseBlocks(lines: string[]): MarkdownBlock[] {
	const children: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const { blocks, nextIndex } = parseBlockAt(lines, index);
		children.push(...blocks);
		index = nextIndex;
	}

	return attachAnchorsToHeadings(children);
}
