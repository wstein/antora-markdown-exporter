import asciidoctorFactory from "@asciidoctor/core";
import {
	type AssemblyAdmonition,
	type AssemblyAnchor,
	type AssemblyBlock,
	type AssemblyBlockQuote,
	type AssemblyCalloutList,
	type AssemblyCodeBlock,
	type AssemblyDocument,
	type AssemblyHeading,
	type AssemblyHtmlBlock,
	type AssemblyImage,
	type AssemblyInline,
	type AssemblyLabeledGroup,
	type AssemblyLink,
	type AssemblyList,
	type AssemblyParagraph,
	type AssemblySourceLocation,
	type AssemblyTable,
	type AssemblyTableRow,
	type AssemblyUnsupported,
	type AssemblyXref,
	type AssemblyXrefFamily,
	type AssemblyXrefTarget,
	defineAssemblyDocument,
} from "./assembly-structure.js";

type AsciidoctorBlock = {
	findBy: (filter: unknown) => unknown[];
	getAttribute: (name: string) => string | undefined;
	getAttributes: () => Record<string, string>;
	getBlocks: () => AsciidoctorBlock[];
	getBodyRows?: () => AsciidoctorTableCell[][];
	getColumns?: () => Array<{
		getAttributes?: () => Record<string, string>;
	}>;
	getContent?: () => string;
	getContext: () => string;
	getDocumentTitle?: () => string;
	getHeadRows?: () => AsciidoctorTableCell[][];
	getId?: () => string | undefined;
	getItems?: () => AsciidoctorListItem[];
	getLevel?: () => number;
	getNodeName?: () => string;
	getSource?: () => string;
	getSourceLocation?: () => {
		getLineNumber?: () => number;
		getPath?: () => string;
	};
	getStyle?: () => string | undefined;
	hasHeader?: () => boolean;
};

type AsciidoctorListItem = {
	getBlocks?: () => AsciidoctorBlock[];
	getContext?: () => string;
	getSourceLocation?: () => {
		getLineNumber?: () => number;
		getPath?: () => string;
	};
	getText: () => string;
};

type AsciidoctorDescriptionListTerm = {
	getText: () => string;
};

type AsciidoctorDescriptionListDescription = {
	getBlocks?: () => AsciidoctorBlock[];
	getSourceLocation?: () => {
		getLineNumber?: () => number;
		getPath?: () => string;
	};
	getText?: () => string;
};

type AsciidoctorTableCell = {
	getSource?: () => string;
	getText: () => string;
};

export type ExtractAssemblyStructureOptions = {
	attributes?: Record<string, string>;
	sourcePath?: string;
};

const createAsciidoctor = asciidoctorFactory as unknown as () => {
	load: (source: string, options: Record<string, unknown>) => AsciidoctorBlock;
};

function getSourceLocation(
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

function decodeHtmlEntities(value: string): string {
	return value
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'");
}

function decodeLiteralCode(value: string): string {
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

function parseHtmlAttributes(value: string): {
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

function normalizeXrefFamilyPath(
	family: AssemblyXrefFamily["kind"],
	path: string,
): string {
	if (
		(family === "page" || family === "example" || family === "partial") &&
		path.endsWith(".html")
	) {
		return path.replace(/\.html$/u, ".adoc");
	}

	return path;
}

function parseXrefFamily(
	name: string | undefined,
): AssemblyXrefFamily | undefined {
	if (name === undefined || name.length === 0) {
		return undefined;
	}

	switch (name) {
		case "attachment":
		case "example":
		case "image":
		case "page":
		case "partial":
			return {
				kind: name,
				name,
			};
		default:
			return {
				kind: "other",
				name,
			};
	}
}

function parseXrefTarget(href: string): AssemblyXrefTarget {
	if (href.startsWith("#")) {
		return {
			raw: href,
			path: "",
			fragment: href.slice(1),
		};
	}

	const [rawPath, fragment] = href.split("#", 2);
	const qualifiedPattern =
		/^(?:(?<version>[^@/#]+)@)?(?:(?<component>[^:/#]+):(?<module>[^:/#]+):)?(?:(?<family>[^$:/#]+)\$)?(?<path>.+)$/u;
	const qualifiedMatch = rawPath?.match(qualifiedPattern);
	const component = qualifiedMatch?.groups?.component;
	const moduleName = qualifiedMatch?.groups?.module;
	const version = qualifiedMatch?.groups?.version;
	const family = parseXrefFamily(qualifiedMatch?.groups?.family);
	const familyKind = family?.kind ?? "page";
	const path = normalizeXrefFamilyPath(
		familyKind,
		qualifiedMatch?.groups?.path ?? rawPath ?? "",
	);

	return {
		raw: href,
		component,
		module: moduleName,
		version,
		family,
		path,
		fragment,
	};
}

function isStructuredXrefHref(href: string): boolean {
	if (href.startsWith("#")) {
		return true;
	}

	if (href.startsWith("http://") || href.startsWith("https://")) {
		return false;
	}

	return (
		href.includes(".html") ||
		href.includes("$") ||
		href.includes("@") ||
		/^[^:/#]+:[^:/#]+:/u.test(href)
	);
}

function parseInlineHtml(content: string): AssemblyInline[] {
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
				children: parseInlineHtml(
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
				children: parseInlineHtml(
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
			const children = parseInlineHtml(inner);
			if (isStructuredXrefHref(href)) {
				const target = parseXrefTarget(href);
				nodes.push(<AssemblyXref>{
					type: "xref",
					url: href,
					target,
					children:
						children.length === 0
							? [{ type: "text", value: href.replace(/^#/, "") }]
							: children,
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

function extractParagraph(block: AsciidoctorBlock): AssemblyParagraph {
	return {
		type: "paragraph",
		location: getSourceLocation(block),
		children: parseInlineHtml(block.getContent?.() ?? ""),
	};
}

function extractHeading(block: AsciidoctorBlock): AssemblyHeading {
	return {
		type: "heading",
		depth: Math.max(1, block.getLevel?.() ?? 1),
		identifier: block.getId?.(),
		location: getSourceLocation(block),
		children: parseInlineHtml(block.getTitle?.() ?? ""),
	};
}

function extractList(block: AsciidoctorBlock): AssemblyList {
	const items = (block.getItems?.() ?? []) as AsciidoctorListItem[];
	return {
		type: "list",
		ordered: block.getContext() === "olist",
		location: getSourceLocation(block),
		items: items.map((item) => ({
			location: getSourceLocation(item),
			children: [
				{
					type: "paragraph",
					children: parseInlineHtml(item.getText()),
				},
				...(item.getBlocks?.().flatMap(extractBlock) ?? []),
			],
		})),
	};
}

function extractLabeledGroups(block: AsciidoctorBlock): AssemblyLabeledGroup[] {
	const items = (block.getItems?.() ?? []) as Array<
		[AsciidoctorDescriptionListTerm[], AsciidoctorDescriptionListDescription]
	>;

	return items.map(([terms, description]) => {
		const blocks = description.getBlocks?.() ?? [];
		const label: AssemblyInline[] = [];
		for (const [index, term] of terms.entries()) {
			if (index > 0) {
				label.push({ type: "text", value: "; " });
			}
			label.push(...parseInlineHtml(term.getText()));
		}
		const children =
			blocks.length > 0
				? blocks.flatMap((child) => extractBlock(child))
				: [
						<AssemblyParagraph>{
							type: "paragraph",
							children: parseInlineHtml(description.getText?.() ?? ""),
							location: getSourceLocation(description),
						},
					];

		return {
			type: "labeledGroup",
			label,
			children,
			location: getSourceLocation(description),
		};
	});
}

function extractAdmonition(block: AsciidoctorBlock): AssemblyAdmonition {
	return {
		type: "admonition",
		kind: ((block.getStyle?.() ?? "NOTE").toLowerCase() ??
			"note") as AssemblyAdmonition["kind"],
		location: getSourceLocation(block),
		children:
			block.getBlocks?.().length && block.getBlocks().length > 0
				? block.getBlocks().flatMap(extractBlock)
				: [
						{
							type: "paragraph",
							children: parseInlineHtml(block.getContent?.() ?? ""),
						},
					],
	};
}

function extractImageBlock(block: AsciidoctorBlock): AssemblyParagraph {
	return {
		type: "paragraph",
		location: getSourceLocation(block),
		children: [
			{
				type: "image",
				url: block.getAttribute("target") ?? "",
				title: block.getTitle?.(),
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

function extractAlignment(block: AsciidoctorBlock): AssemblyTable["align"] {
	const columnSpec = block
		.getAttribute("cols")
		?.split(",")
		.map((entry) => entry.trim());
	return block.getColumns?.().map((column, index) => {
		const spec = columnSpec?.[index] ?? "";
		if (spec.includes("<")) {
			return "left";
		}
		if (spec.includes("^")) {
			return "center";
		}
		if (spec.includes(">")) {
			return "right";
		}

		const halign = column.getAttributes?.().halign;
		switch (halign) {
			case "center":
				return "center";
			case "right":
				return "right";
			default:
				return null;
		}
	});
}

function extractRow(row: AsciidoctorTableCell[]): AssemblyTableRow {
	return {
		cells: row.map((cell) => ({
			children: parseInlineHtml(cell.getText()),
		})),
	};
}

function extractTable(block: AsciidoctorBlock): AssemblyTable {
	const headRows = block.getHeadRows?.() ?? [];
	const bodyRows = block.getBodyRows?.() ?? [];
	const rows = headRows.length > 0 ? bodyRows : bodyRows.slice(1);
	return {
		type: "table",
		location: getSourceLocation(block),
		align: extractAlignment(block),
		header: extractRow(
			(headRows[0] ?? bodyRows[0] ?? []) as AsciidoctorTableCell[],
		),
		rows: rows.map((row) => extractRow(row as AsciidoctorTableCell[])),
	};
}

function extractCalloutList(block: AsciidoctorBlock): AssemblyCalloutList {
	const items = (block.getItems?.() ?? []) as AsciidoctorListItem[];
	return {
		type: "calloutList",
		location: getSourceLocation(block),
		items: items.map((item, index) => ({
			ordinal: index + 1,
			location: getSourceLocation(item),
			children: [
				{
					type: "paragraph",
					children: parseInlineHtml(item.getText()),
				},
			],
		})),
	};
}

function extractCodeBlock(block: AsciidoctorBlock): AssemblyCodeBlock {
	return {
		type: "codeBlock",
		location: getSourceLocation(block),
		language: block.getAttribute("language"),
		value: block.getSource?.() ?? "",
	};
}

function extractBlockQuote(block: AsciidoctorBlock): AssemblyBlockQuote {
	return {
		type: "blockquote",
		location: getSourceLocation(block),
		children: block.getBlocks().flatMap(extractBlock),
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

function extractBlock(block: AsciidoctorBlock): AssemblyBlock[] {
	let extracted: AssemblyBlock[];
	switch (block.getContext()) {
		case "paragraph":
			extracted = [extractParagraph(block)];
			break;
		case "section":
			extracted = [
				extractHeading(block),
				...block.getBlocks().flatMap((child) => extractBlock(child)),
			];
			break;
		case "preamble":
			extracted = block.getBlocks().flatMap((child) => extractBlock(child));
			break;
		case "ulist":
		case "olist":
			extracted = [extractList(block)];
			break;
		case "dlist":
			extracted = extractLabeledGroups(block);
			break;
		case "admonition":
			extracted = [extractAdmonition(block)];
			break;
		case "image":
			extracted = [extractImageBlock(block)];
			break;
		case "thematic_break":
			extracted = [
				{ type: "thematicBreak", location: getSourceLocation(block) },
			];
			break;
		case "table":
			extracted = [extractTable(block)];
			break;
		case "colist":
			extracted = [extractCalloutList(block)];
			break;
		case "listing":
		case "literal":
			extracted = [extractCodeBlock(block)];
			break;
		case "quote":
			extracted = [extractBlockQuote(block)];
			break;
		case "open":
			extracted = block.getBlocks().flatMap((child) => extractBlock(child));
			break;
		case "example":
		case "sidebar":
			extracted = [
				<AssemblyBlockQuote>{
					type: "blockquote",
					location: getSourceLocation(block),
					children:
						block.getBlocks?.().length && block.getBlocks().length > 0
							? block.getBlocks().flatMap((child) => extractBlock(child))
							: [
									{
										type: "paragraph",
										children: parseInlineHtml(block.getContent?.() ?? ""),
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
		default:
			extracted = [extractUnsupported(block)];
			break;
	}

	return attachBlockAnchor(block, extracted);
}

function parseRenderOptions(
	document: AsciidoctorBlock,
): AssemblyDocument["renderOptions"] {
	const numbered =
		document.getAttribute("sectnums") ?? document.getAttribute("numbered");
	const doctype = document.getAttribute("doctype");
	const toc = document.getAttribute("toc");
	const toclevels = document.getAttribute("toclevels");
	const maxDepth =
		toclevels === undefined ? undefined : Number.parseInt(toclevels, 10);
	return {
		headingNumbering:
			numbered === undefined
				? undefined
				: {
						mode: doctype === "book" ? "book" : "section",
					},
		tableOfContents:
			toc === undefined
				? undefined
				: {
						maxDepth: Number.isFinite(maxDepth) ? maxDepth : undefined,
					},
	};
}

export function extractAssemblyStructure(
	source: string,
	options: ExtractAssemblyStructureOptions = {},
): AssemblyDocument {
	const asciidoctor = createAsciidoctor();
	const document = asciidoctor.load(source, {
		safe: "safe",
		sourcemap: true,
		attributes: options.attributes,
	});
	const pageAliases = document.getAttribute("page-aliases");
	const hasDocumentTitle = document.hasHeader?.() === true;
	const children: AssemblyBlock[] = [];

	if (pageAliases !== undefined) {
		children.push({
			type: "pageAliases",
			aliases: pageAliases
				.split(",")
				.map((alias) => alias.trim())
				.filter(Boolean),
		});
	}

	if (hasDocumentTitle) {
		children.push({
			type: "heading",
			depth: 1,
			children: parseInlineHtml(document.getDocumentTitle?.() ?? ""),
		});
	}

	for (const block of document.getBlocks()) {
		children.push(...extractBlock(block));
	}

	return defineAssemblyDocument({
		type: "document",
		source: {
			backend: "assembler-structure",
			path: options.sourcePath,
		},
		metadata: {
			attributes: document.getAttributes(),
			component: document.getAttribute("page-component-name"),
			version: document.getAttribute("page-component-version"),
			module: document.getAttribute("page-module"),
			relativeSrcPath: document.getAttribute("page-relative-src-path"),
		},
		renderOptions: parseRenderOptions(document),
		children,
	});
}
