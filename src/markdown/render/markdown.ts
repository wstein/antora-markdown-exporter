import { renderUnsupportedBlock, resolveRawHtmlFallback } from "../fallback.js";
import type { MarkdownFlavorName, MarkdownFlavorSpec } from "../flavor.js";
import { resolveMarkdownFlavor } from "../flavor.js";
import type { MarkdownBlock, MarkdownDocument, MarkdownInline } from "../ir.js";
import { resolveMarkdownXrefDestination } from "../xref-resolution.js";

function escapeMarkdownText(value: string): string {
	return value.replace(/[\\*_`[\]<>]/g, "\\$&");
}

function escapeMarkdownTitle(value: string): string {
	return value.replace(/"/g, '\\"');
}

function renderLinkDestination(url: string, title?: string): string {
	return title === undefined ? url : `${url} "${escapeMarkdownTitle(title)}"`;
}

function renderCodeBlock(
	block: Extract<MarkdownBlock, { type: "codeBlock" }>,
): string {
	const language = block.language ?? "";
	return `\`\`\`${language}\n${block.value}\n\`\`\``;
}

function inlineText(children: MarkdownInline[]): string {
	return children
		.map((child) => {
			switch (child.type) {
				case "text":
					return child.value;
				case "code":
					return child.value;
				case "emphasis":
				case "strong":
				case "link":
				case "xref":
					return inlineText(child.children);
				case "image":
					return inlineText(child.alt);
				case "hardBreak":
				case "softBreak":
					return " ";
				case "htmlInline":
					return "";
				case "footnoteReference":
					return child.label ?? child.identifier;
				case "citation":
					return child.label ?? child.identifier;
				default:
					return "";
			}
		})
		.join("")
		.replace(/\s+/g, " ")
		.trim();
}

function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.replace(/<\/?[a-z][^>]*>/gi, "")
		.replace(/<([^>]+)>/g, "$1")
		.replace(/[`*_~[\]()]/g, "")
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

type HeadingRenderInfo = {
	anchor: string;
	block: Extract<MarkdownBlock, { type: "heading" }>;
	depth: number;
	index: number;
	text: string;
};

function collectHeadingRenderInfo(
	document: MarkdownDocument,
): HeadingRenderInfo[] {
	const numberingMode = document.renderOptions?.headingNumbering?.mode;
	const headings = document.children.filter(
		(block): block is Extract<MarkdownBlock, { type: "heading" }> =>
			block.type === "heading",
	);
	const counters: number[] = [];

	return headings.map((block, index) => {
		const baseText = inlineText(block.children);
		let text = baseText;

		if (index > 0 && numberingMode !== undefined) {
			const depth = block.depth;
			while (counters.length <= depth) {
				counters.push(0);
			}
			counters[depth] = (counters[depth] ?? 0) + 1;
			for (
				let childDepth = depth + 1;
				childDepth < counters.length;
				childDepth += 1
			) {
				counters[childDepth] = 0;
			}

			const prefix =
				numberingMode === "book" && depth === 1
					? `Chapter ${counters[depth]}. `
					: `${counters.slice(1, depth + 1).join(".")}. `;
			text = `${prefix}${baseText}`;
		}

		return {
			anchor: slugifyHeading(text),
			block,
			depth: block.depth,
			index,
			text,
		};
	});
}

function renderTableOfContents(document: MarkdownDocument): string | undefined {
	const tableOfContents = document.renderOptions?.tableOfContents;
	if (tableOfContents === undefined) {
		return undefined;
	}

	const entries = collectHeadingRenderInfo(document).slice(1);
	if (entries.length === 0) {
		return undefined;
	}

	const maxDepth = tableOfContents.maxDepth;
	const visibleEntries = entries.filter((entry) =>
		maxDepth === undefined ? true : entry.depth <= maxDepth,
	);
	if (visibleEntries.length === 0) {
		return undefined;
	}

	const baseDepth = Math.min(...visibleEntries.map((entry) => entry.depth));
	return [
		"## Table of Contents",
		"",
		...visibleEntries.map(
			(entry) =>
				`${"  ".repeat(entry.depth - baseDepth)}- [${entry.text}](#${entry.anchor})`,
		),
	].join("\n");
}

function renderInline(
	node: MarkdownInline,
	flavor: MarkdownFlavorSpec,
	context: RenderContext,
): string {
	switch (node.type) {
		case "text":
			return escapeMarkdownText(node.value);
		case "emphasis":
			return `*${node.children.map((child) => renderInline(child, flavor, context)).join("")}*`;
		case "strong":
			return `**${node.children.map((child) => renderInline(child, flavor, context)).join("")}**`;
		case "code":
			return `\`${node.value.replace(/`/g, "\\`")}\``;
		case "link": {
			const label = node.children
				.map((child) => renderInline(child, flavor, context))
				.join("");
			if (
				flavor.name === "multimarkdown" &&
				node.attributes !== undefined &&
				Object.keys(node.attributes).length > 0
			) {
				const identifier = registerMultiMarkdownDefinition(
					context,
					"link",
					node.url,
					node.title,
					node.attributes,
				);
				return `[${label}][${identifier}]`;
			}
			return `[${label}](${renderLinkDestination(node.url, node.title)})`;
		}
		case "xref":
			return `[${node.children.map((child) => renderInline(child, flavor, context)).join("")}](${renderLinkDestination(resolveMarkdownXrefDestination(node, flavor), node.title)})`;
		case "image": {
			const alt = node.alt
				.map((child) => renderInline(child, flavor, context))
				.join("");
			if (
				flavor.name === "multimarkdown" &&
				node.attributes !== undefined &&
				Object.keys(node.attributes).length > 0
			) {
				const identifier = registerMultiMarkdownDefinition(
					context,
					"image",
					node.url,
					node.title,
					node.attributes,
				);
				return `![${alt}][${identifier}]`;
			}
			return `![${alt}](${renderLinkDestination(node.url, node.title)})`;
		}
		case "hardBreak":
			return flavor.hardBreakStyle === "spaces" ? "  \n" : "\\\n";
		case "softBreak":
			return flavor.softBreakStyle === "space" ? " " : "\n";
		case "htmlInline":
			return resolveRawHtmlFallback(node, flavor, {
				annotate: false,
				fallbackReason: "html-inline",
				unsupportedReason: "raw HTML inline is not allowed in this flavor",
			});
		case "footnoteReference":
			return flavor.supportsFootnotes
				? `[^${node.identifier}]`
				: `[${node.label ?? node.identifier}]`;
		case "citation":
			if (!flavor.supportsCitations) {
				return `[cite:${node.label ?? node.identifier}]`;
			}
			if (flavor.name === "multimarkdown") {
				const locator = node.label?.trim();
				return locator === undefined ||
					locator.length === 0 ||
					locator === node.identifier
					? `[][#${node.identifier}]`
					: `[${escapeMarkdownText(locator)}][#${node.identifier}]`;
			}

			return flavor.citationStyle === "at"
				? `[@${node.identifier}]`
				: `[${node.identifier}]`;
	}
}

function renderListItem(
	blocks: MarkdownBlock[],
	bullet: string,
	flavor: MarkdownFlavorSpec,
	context: RenderContext,
): string {
	return blocks
		.map((block, index) => {
			const rendered = renderBlock(block, flavor, context).split("\n");
			const [firstLine, ...rest] = rendered;
			const prefix = index === 0 ? `${bullet} ` : "  ";

			return [
				`${prefix}${firstLine}`,
				...rest.map((line) => (line.length > 0 ? `  ${line}` : line)),
			].join("\n");
		})
		.join("\n");
}

function renderAdmonitionLabel(kind: string): string {
	return kind.toUpperCase();
}

type RenderContext = {
	headingInfo: Map<MarkdownBlock, HeadingRenderInfo>;
	multimarkdownDefinitions: string[];
	nextMultimarkdownReference: number;
};

function formatMultiMarkdownAttributeValue(value: string): string {
	return /\s/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function registerMultiMarkdownDefinition(
	context: RenderContext,
	prefix: "image" | "link",
	url: string,
	title: string | undefined,
	attributes: Record<string, string> | undefined,
): string {
	const identifier = `${prefix}-${context.nextMultimarkdownReference}`;
	context.nextMultimarkdownReference += 1;
	const titleSegment =
		title === undefined ? "" : ` "${escapeMarkdownTitle(title)}"`;
	const attributeSuffix =
		attributes === undefined
			? ""
			: Object.entries(attributes)
					.map(
						([key, value]) =>
							` ${key}=${formatMultiMarkdownAttributeValue(value)}`,
					)
					.join("");
	context.multimarkdownDefinitions.push(
		`[${identifier}]: ${url}${titleSegment}${attributeSuffix}`,
	);
	return identifier;
}

function renderMultiMarkdownMetadata(
	document: MarkdownDocument,
): string | undefined {
	const attributes = document.metadata?.attributes ?? {};
	const titleHeading = document.children.find(
		(block): block is Extract<MarkdownBlock, { type: "heading" }> =>
			block.type === "heading" && block.depth === 1,
	);
	const title =
		attributes.doctitle ??
		titleHeading?.children.map((child) => inlineText([child])).join("");
	const metadataEntries = [
		["Title", title],
		["Author", attributes.author],
		["Date", attributes.revdate ?? attributes.docdate],
		["Component", document.metadata?.component],
		["Version", document.metadata?.version],
		["Module", document.metadata?.module],
		["Page ID", document.metadata?.pageId],
		["Source Path", document.metadata?.relativeSrcPath],
	].filter((entry): entry is [string, string] => {
		const [, value] = entry;
		return value !== undefined && value.trim().length > 0;
	});

	if (metadataEntries.length === 0) {
		return undefined;
	}

	return metadataEntries.map(([key, value]) => `${key}: ${value}`).join("\n");
}

function getRenderableBlocks(
	document: MarkdownDocument,
	flavor: MarkdownFlavorSpec,
): MarkdownBlock[] {
	if (!flavor.supportsMetadata) {
		return document.children;
	}

	const titleHeading = document.children.find(
		(block): block is Extract<MarkdownBlock, { type: "heading" }> =>
			block.type === "heading" && block.depth === 1,
	);
	const metadataTitle =
		document.metadata?.attributes?.doctitle?.trim() ??
		titleHeading?.children.map((child) => inlineText([child])).join("");
	if (metadataTitle === undefined || metadataTitle.length === 0) {
		return document.children;
	}

	const [first, ...rest] = document.children;
	if (
		first?.type === "heading" &&
		first.depth === 1 &&
		inlineText(first.children) === metadataTitle
	) {
		return rest;
	}

	return document.children;
}

function renderLabeledGroup(
	block: Extract<MarkdownBlock, { type: "labeledGroup" }>,
	flavor: MarkdownFlavorSpec,
	context: RenderContext,
): string {
	const label = block.label
		.map((child) => renderInline(child, flavor, context))
		.join("");
	if (flavor.supportsDefinitionLists) {
		const renderedChildren = block.children.map((child) =>
			renderBlock(child, flavor, context),
		);
		const [firstRendered = "", ...restRendered] = renderedChildren;
		const definitionLines = [
			`:   ${firstRendered}`,
			...restRendered.flatMap((value) =>
				value.split("\n").map((line) => `    ${line}`),
			),
		];
		return [`${label}`, ...definitionLines]
			.filter((value) => value.length > 0)
			.join("\n");
	}
	const [firstChild, ...restChildren] = block.children;
	if (firstChild?.type === "paragraph") {
		const firstParagraph = firstChild.children
			.map((child) => renderInline(child, flavor, context))
			.join("");
		const rest = restChildren.map((child) =>
			renderBlock(child, flavor, context),
		);
		return [`**${label}:** ${firstParagraph}`, ...rest]
			.filter((value) => value.length > 0)
			.join("\n\n");
	}

	return [
		`**${label}:**`,
		...block.children.map((child) => renderBlock(child, flavor, context)),
	]
		.filter((value) => value.length > 0)
		.join("\n\n");
}

function renderBlock(
	block: MarkdownBlock,
	flavor: MarkdownFlavorSpec,
	context: RenderContext,
): string {
	switch (block.type) {
		case "heading": {
			const heading = context.headingInfo.get(block);
			const text =
				heading?.text ??
				block.children
					.map((child) => renderInline(child, flavor, context))
					.join("");
			return `${"#".repeat(block.depth)} ${text}`;
		}
		case "paragraph":
			return block.children
				.map((child) => renderInline(child, flavor, context))
				.join("");
		case "anchor":
			return resolveRawHtmlFallback(
				{
					type: "htmlBlock",
					value: `<a id="${block.identifier}"></a>`,
				},
				flavor,
				{
					annotate: false,
					fallbackReason: "anchor",
					unsupportedReason:
						"anchor blocks require raw HTML support in this flavor",
				},
			);
		case "pageAliases":
			return resolveRawHtmlFallback(
				{
					type: "htmlBlock",
					value: `<!-- page-aliases: ${block.aliases.join(", ")} -->`,
				},
				flavor,
				{
					annotate: false,
					fallbackReason: "page-aliases",
					unsupportedReason:
						"page alias metadata requires raw HTML support in this flavor",
				},
			);
		case "thematicBreak":
			return "---";
		case "codeBlock":
			return renderCodeBlock(block);
		case "blockquote":
			return block.children
				.map((child) => renderBlock(child, flavor, context))
				.join("\n\n")
				.split("\n")
				.map((line) => (line.length > 0 ? `> ${line}` : ">"))
				.join("\n");
		case "admonition": {
			const [first, ...rest] = block.children;
			const firstParagraph = {
				type: "paragraph" as const,
				children: [
					{
						type: "strong" as const,
						children: [
							{
								type: "text" as const,
								value: `${renderAdmonitionLabel(block.kind)}:`,
							},
						],
					},
				],
			};
			const children =
				first?.type === "paragraph"
					? [
							{
								...first,
								children: [
									...firstParagraph.children,
									{ type: "text" as const, value: " " },
									...first.children,
								],
							},
							...rest,
						]
					: [firstParagraph, ...block.children];
			return children
				.map((child) => renderBlock(child, flavor, context))
				.join("\n\n")
				.split("\n")
				.map((line) => (line.length > 0 ? `> ${line}` : ">"))
				.join("\n");
		}
		case "list":
			return block.items
				.map((item, index) =>
					renderListItem(
						item.children,
						block.ordered
							? `${(flavor.preserveOrderedListStart ? (block.start ?? 1) : 1) + index}.`
							: "-",
						flavor,
						context,
					),
				)
				.join("\n");
		case "labeledGroup":
			return renderLabeledGroup(block, flavor, context);
		case "calloutList":
			return block.items
				.map((item) =>
					renderListItem(item.children, `${item.ordinal}.`, flavor, context),
				)
				.join("\n");
		case "table": {
			if (!flavor.supportsTables) {
				return renderUnsupportedBlock(
					"table rendering requires table-capable markdown",
					flavor,
				);
			}

			const header = `| ${block.header.cells.map((cell) => cell.children.map((child) => renderInline(child, flavor, context)).join("")).join(" | ")} |`;
			const alignments = block.align ?? [];
			const separator = `| ${block.header.cells
				.map((_, index) => {
					switch (alignments[index]) {
						case "left":
							return ":---";
						case "center":
							return ":---:";
						case "right":
							return "---:";
						default:
							return "---";
					}
				})
				.join(" | ")} |`;
			const rows = block.rows.map(
				(row) =>
					`| ${row.cells.map((cell) => cell.children.map((child) => renderInline(child, flavor, context)).join("")).join(" | ")} |`,
			);
			const table = [header, separator, ...rows].join("\n");
			if (
				flavor.supportsTableCaptions &&
				block.caption !== undefined &&
				block.caption.length > 0
			) {
				return `${table}\n[${block.caption
					.map((child) => renderInline(child, flavor, context))
					.join("")}]`;
			}
			return table;
		}
		case "htmlBlock":
			return resolveRawHtmlFallback(block, flavor, {
				fallbackReason: "html-block",
				unsupportedReason: "raw HTML blocks are not allowed in this flavor",
			});
		case "footnoteDefinition": {
			if (!flavor.supportsFootnotes) {
				return renderUnsupportedBlock(
					"footnote definitions require footnote-capable markdown",
					flavor,
				);
			}

			const [first, ...rest] = block.children;
			if (first?.type === "paragraph") {
				const lines = [
					`[^${block.identifier}]: ${first.children
						.map((child) => renderInline(child, flavor, context))
						.join("")}`,
					...rest.flatMap((child) =>
						renderBlock(child, flavor, context)
							.split("\n")
							.map((line) => `    ${line}`),
					),
				];
				return lines.join("\n");
			}

			return [
				`[^${block.identifier}]:`,
				...block.children.flatMap((child) =>
					renderBlock(child, flavor, context)
						.split("\n")
						.map((line) => `    ${line}`),
				),
			].join("\n");
		}
		case "unsupported":
			return renderUnsupportedBlock(block.reason, flavor);
	}
}

export function renderMarkdown(
	document: MarkdownDocument,
	flavor: MarkdownFlavorName | MarkdownFlavorSpec = "gfm",
): string {
	const resolvedFlavor = resolveMarkdownFlavor(flavor);
	const renderableBlocks = getRenderableBlocks(document, resolvedFlavor);
	const headingInfo = new Map(
		collectHeadingRenderInfo({
			...document,
			children: renderableBlocks,
		}).map((entry) => [entry.block, entry] as const),
	);
	const context: RenderContext = {
		headingInfo,
		multimarkdownDefinitions: [],
		nextMultimarkdownReference: 1,
	};
	const renderedBlocks = renderableBlocks
		.map((block) => renderBlock(block, resolvedFlavor, context))
		.filter((block) => block.length > 0);
	const toc = renderTableOfContents({
		...document,
		children: renderableBlocks,
	});
	const metadata =
		resolvedFlavor.supportsMetadata && resolvedFlavor.name === "multimarkdown"
			? renderMultiMarkdownMetadata(document)
			: undefined;
	const referenceDefinitions =
		context.multimarkdownDefinitions.length > 0
			? context.multimarkdownDefinitions.join("\n")
			: undefined;

	if (toc === undefined) {
		return `${[metadata, renderedBlocks.join("\n\n"), referenceDefinitions]
			.filter((value) => value !== undefined && value.length > 0)
			.join("\n\n")}\n`;
	}

	const [firstBlock, ...restBlocks] = renderedBlocks;
	if (firstBlock === undefined) {
		return `${[metadata, toc, referenceDefinitions]
			.filter((value) => value !== undefined && value.length > 0)
			.join("\n\n")}\n`;
	}

	return `${[metadata, firstBlock, toc, ...restBlocks, referenceDefinitions]
		.filter((value) => value !== undefined && value.length > 0)
		.join("\n\n")}\n`;
}
