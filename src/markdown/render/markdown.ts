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
): string {
	switch (node.type) {
		case "text":
			return escapeMarkdownText(node.value);
		case "emphasis":
			return `*${node.children.map((child) => renderInline(child, flavor)).join("")}*`;
		case "strong":
			return `**${node.children.map((child) => renderInline(child, flavor)).join("")}**`;
		case "code":
			return `\`${node.value.replace(/`/g, "\\`")}\``;
		case "link":
			return `[${node.children.map((child) => renderInline(child, flavor)).join("")}](${renderLinkDestination(node.url, node.title)})`;
		case "xref":
			return `[${node.children.map((child) => renderInline(child, flavor)).join("")}](${renderLinkDestination(resolveMarkdownXrefDestination(node, flavor), node.title)})`;
		case "image":
			return `![${node.alt.map((child) => renderInline(child, flavor)).join("")}](${renderLinkDestination(node.url, node.title)})`;
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
};

function renderLabeledGroup(
	block: Extract<MarkdownBlock, { type: "labeledGroup" }>,
	flavor: MarkdownFlavorSpec,
	context: RenderContext,
): string {
	const label = block.label
		.map((child) => renderInline(child, flavor))
		.join("");
	const [firstChild, ...restChildren] = block.children;
	if (firstChild?.type === "paragraph") {
		const firstParagraph = firstChild.children
			.map((child) => renderInline(child, flavor))
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
				block.children.map((child) => renderInline(child, flavor)).join("");
			return `${"#".repeat(block.depth)} ${text}`;
		}
		case "paragraph":
			return block.children
				.map((child) => renderInline(child, flavor))
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

			const header = `| ${block.header.cells.map((cell) => cell.children.map((child) => renderInline(child, flavor)).join("")).join(" | ")} |`;
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
					`| ${row.cells.map((cell) => cell.children.map((child) => renderInline(child, flavor)).join("")).join(" | ")} |`,
			);
			return [header, separator, ...rows].join("\n");
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
					`[^${block.identifier}]: ${first.children.map((child) => renderInline(child, flavor)).join("")}`,
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
	const headingInfo = new Map(
		collectHeadingRenderInfo(document).map(
			(entry) => [entry.block, entry] as const,
		),
	);
	const context: RenderContext = { headingInfo };
	const renderedBlocks = document.children
		.map((block) => renderBlock(block, resolvedFlavor, context))
		.filter((block) => block.length > 0);
	const toc = renderTableOfContents(document);

	if (toc === undefined) {
		return `${renderedBlocks.join("\n\n")}\n`;
	}

	const [firstBlock, ...restBlocks] = renderedBlocks;
	if (firstBlock === undefined) {
		return `${toc}\n`;
	}

	return `${[firstBlock, toc, ...restBlocks].join("\n\n")}\n`;
}
