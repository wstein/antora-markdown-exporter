import type {
	AssemblyAdmonition,
	AssemblyAnchor,
	AssemblyBlock,
	AssemblyBlockQuote,
	AssemblyCodeBlock,
	AssemblyHeading,
	AssemblyHtmlBlock,
	AssemblyParagraph,
	AssemblyUnsupported,
} from "../assembly-structure.js";
import {
	extractCalloutList,
	extractLabeledGroups,
	extractList,
	extractTable,
} from "./block-helpers.js";
import {
	parseInlineHtmlWithOptions,
	parsePlainTextWithSoftBreaks,
} from "./inline.js";
import { getSourceLocation } from "./shared.js";
import type {
	AsciidoctorBlock,
	ExtractAssemblyStructureOptions,
} from "./types.js";

function extractParagraph(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
): AssemblyParagraph {
	return {
		type: "paragraph",
		location: getSourceLocation(block),
		children: parseInlineHtmlWithOptions(block.getContent?.() ?? "", options),
	};
}

function extractHeading(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
): AssemblyHeading {
	return {
		type: "heading",
		depth: Math.max(1, block.getLevel?.() ?? 1),
		identifier: block.getId?.(),
		location: getSourceLocation(block),
		children: parseInlineHtmlWithOptions(block.getTitle?.() ?? "", options),
	};
}

function extractAdmonition(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
): AssemblyAdmonition {
	return {
		type: "admonition",
		kind: ((block.getStyle?.() ?? "NOTE").toLowerCase() ??
			"note") as AssemblyAdmonition["kind"],
		location: getSourceLocation(block),
		children:
			block.getBlocks?.().length && block.getBlocks().length > 0
				? block.getBlocks().flatMap((child) => extractBlock(child, options))
				: [
						{
							type: "paragraph",
							children: parseInlineHtmlWithOptions(
								block.getContent?.() ?? "",
								options,
							),
						},
					],
	};
}

function filterElementAttributes(
	attributes: Record<string, string>,
	keysToOmit: string[],
): Record<string, string> | undefined {
	const preserved = Object.fromEntries(
		Object.entries(attributes).filter(
			([key]) =>
				!keysToOmit.includes(key) &&
				!["attribute_entries", "$positional", "imagesdir"].includes(key),
		),
	);
	return Object.keys(preserved).length > 0 ? preserved : undefined;
}

function extractImageBlock(block: AsciidoctorBlock): AssemblyParagraph {
	const attributes = block.getAttributes?.() ?? {};
	return {
		type: "paragraph",
		location: getSourceLocation(block),
		children: [
			{
				type: "image",
				url: block.getAttribute("target") ?? "",
				title: block.getTitle?.(),
				attributes: filterElementAttributes(attributes, ["alt", "target"]),
				alt: [
					{
						type: "text",
						value: block.getAttribute("alt") ?? "",
					},
				],
			},
		],
	};
}

function extractCodeBlock(block: AsciidoctorBlock): AssemblyCodeBlock {
	const source = block.getSource?.() ?? "";
	return {
		type: "codeBlock",
		location: getSourceLocation(block),
		language: block.getAttribute("language"),
		value: source,
		callouts: [...source.matchAll(/<(\d+)>/gu)].map((match) =>
			Number.parseInt(match[1] ?? "0", 10),
		),
	};
}

function extractBlockQuote(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
): AssemblyBlockQuote {
	return {
		type: "blockquote",
		location: getSourceLocation(block),
		children: block
			.getBlocks()
			.flatMap((child) => extractBlock(child, options)),
	};
}

function extractVerse(block: AsciidoctorBlock): AssemblyBlockQuote {
	return {
		type: "blockquote",
		location: getSourceLocation(block),
		children: [
			{
				type: "paragraph",
				location: getSourceLocation(block),
				children: parsePlainTextWithSoftBreaks(block.getSource?.() ?? ""),
			},
		],
	};
}

function extractUnsupported(block: AsciidoctorBlock): AssemblyUnsupported {
	return {
		type: "unsupported",
		location: getSourceLocation(block),
		reason: `structured extractor does not support block context: ${block.getContext()}`,
	};
}

function attachBlockAnchor(
	block: AsciidoctorBlock,
	extracted: AssemblyBlock[],
): AssemblyBlock[] {
	const identifier = block.getId?.();
	if (
		identifier === undefined ||
		identifier.length === 0 ||
		block.getContext() === "section"
	) {
		return extracted;
	}

	return [
		<AssemblyAnchor>{
			type: "anchor",
			identifier,
			location: getSourceLocation(block),
		},
		...extracted,
	];
}

function attachBlockTitle(
	block: AsciidoctorBlock,
	extracted: AssemblyBlock[],
	options: ExtractAssemblyStructureOptions,
): AssemblyBlock[] {
	const titleBearingContexts = new Set([
		"example",
		"listing",
		"literal",
		"quote",
		"sidebar",
		"verse",
	]);
	if (!titleBearingContexts.has(block.getContext())) {
		return extracted;
	}

	const title = block.getTitle?.();
	if (title === undefined || title.length === 0) {
		return extracted;
	}

	return [
		{
			type: "labeledGroup",
			label: parseInlineHtmlWithOptions(title, options),
			children: extracted,
			location: getSourceLocation(block),
		},
	];
}

export function extractBlock(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
): AssemblyBlock[] {
	let extracted: AssemblyBlock[];
	switch (block.getContext()) {
		case "paragraph":
			extracted = [extractParagraph(block, options)];
			break;
		case "preamble":
			extracted = block
				.getBlocks()
				.flatMap((child) => extractBlock(child, options));
			break;
		case "section":
			extracted = [
				extractHeading(block, options),
				...block.getBlocks().flatMap((child) => extractBlock(child, options)),
			];
			break;
		case "ulist":
		case "olist":
			extracted = [extractList(block, options, extractBlock)];
			break;
		case "dlist":
			extracted = extractLabeledGroups(block, options, extractBlock);
			break;
		case "admonition":
			extracted = [extractAdmonition(block, options)];
			break;
		case "image":
			extracted = [extractImageBlock(block)];
			break;
		case "table":
			extracted = [extractTable(block, options)];
			break;
		case "colist":
			extracted = [extractCalloutList(block, options, extractBlock)];
			break;
		case "listing":
		case "literal":
			extracted = [extractCodeBlock(block)];
			break;
		case "quote":
			extracted = [extractBlockQuote(block, options)];
			break;
		case "verse":
			extracted = [extractVerse(block)];
			break;
		case "open":
			extracted = block
				.getBlocks()
				.flatMap((child) => extractBlock(child, options));
			break;
		case "example":
		case "sidebar":
			extracted = [
				<AssemblyBlockQuote>{
					type: "blockquote",
					location: getSourceLocation(block),
					children:
						block.getBlocks?.().length && block.getBlocks().length > 0
							? block
									.getBlocks()
									.flatMap((child) => extractBlock(child, options))
							: [
									{
										type: "paragraph",
										children: parseInlineHtmlWithOptions(
											block.getContent?.() ?? "",
											options,
										),
										location: getSourceLocation(block),
									},
								],
				},
			];
			break;
		case "pass":
			extracted = [
				<AssemblyHtmlBlock>{
					type: "htmlBlock",
					location: getSourceLocation(block),
					value: block.getSource?.() ?? "",
				},
			];
			break;
		case "thematic_break":
			extracted = [
				{
					type: "thematicBreak",
					location: getSourceLocation(block),
				},
			];
			break;
		default:
			extracted = [extractUnsupported(block)];
			break;
	}

	return attachBlockAnchor(block, attachBlockTitle(block, extracted, options));
}
