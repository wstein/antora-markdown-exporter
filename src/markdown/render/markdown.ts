import type { MarkdownFlavorName, MarkdownFlavorSpec } from "../flavor.js";
import { resolveMarkdownFlavor } from "../flavor.js";
import type {
	MarkdownBlock,
	MarkdownDocument,
	MarkdownInline,
	MarkdownXref,
} from "../ir.js";

function escapeMarkdownText(value: string): string {
	return value.replace(/[\\*_`[\]<>]/g, "\\$&");
}

function escapeMarkdownTitle(value: string): string {
	return value.replace(/"/g, '\\"');
}

function renderLinkDestination(url: string, title?: string): string {
	return title === undefined ? url : `${url} "${escapeMarkdownTitle(title)}"`;
}

function stripAsciiDocExtension(value: string): string {
	return value.replace(/\.adoc$/i, ".html");
}

function renderXrefDestination(
	node: MarkdownXref,
	flavor: MarkdownFlavorSpec,
): string {
	if (flavor.xrefStyle === "source") {
		return node.url;
	}

	const { target } = node;
	if (target.path.length === 0) {
		return target.fragment === undefined ? node.url : `#${target.fragment}`;
	}
	const segments = [target.component, target.version].filter(
		(segment): segment is string => segment !== undefined && segment.length > 0,
	);
	const moduleSegment =
		target.module !== undefined &&
		target.module.length > 0 &&
		!(flavor.xrefSiteOmitRootModule && target.module === "ROOT")
			? target.module
			: undefined;
	if (moduleSegment !== undefined) {
		segments.push(moduleSegment);
	}

	const family = target.family ?? { kind: "page", name: "page" };
	if (family.kind === "page") {
		segments.push(stripAsciiDocExtension(target.path));
	} else {
		const assetDirectory =
			flavor.xrefSiteAssetFamilies[
				family.kind as keyof typeof flavor.xrefSiteAssetFamilies
			];
		if (assetDirectory === undefined) {
			return node.url;
		}

		segments.push(assetDirectory, target.path);
	}
	const path = segments.join("/");

	return target.fragment === undefined ? path : `${path}#${target.fragment}`;
}

function renderUnsupported(reason: string, flavor: MarkdownFlavorSpec): string {
	return `> ${flavor.blockFallbackLabel}: ${reason}`;
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
			return `[${node.children.map((child) => renderInline(child, flavor)).join("")}](${renderLinkDestination(renderXrefDestination(node, flavor), node.title)})`;
		case "image":
			return `![${node.alt.map((child) => renderInline(child, flavor)).join("")}](${renderLinkDestination(node.url, node.title)})`;
		case "hardBreak":
			return flavor.hardBreakStyle === "spaces" ? "  \n" : "\\\n";
		case "softBreak":
			return flavor.softBreakStyle === "space" ? " " : "\n";
		case "htmlInline":
			return flavor.supportsRawHtml
				? node.value
				: escapeMarkdownText(node.value);
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
): string {
	return blocks
		.map((block, index) => {
			const rendered = renderBlock(block, flavor).split("\n");
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

function renderBlock(block: MarkdownBlock, flavor: MarkdownFlavorSpec): string {
	switch (block.type) {
		case "heading":
			return `${"#".repeat(block.depth)} ${block.children.map((child) => renderInline(child, flavor)).join("")}`;
		case "paragraph":
			return block.children
				.map((child) => renderInline(child, flavor))
				.join("");
		case "anchor":
			return flavor.supportsRawHtml
				? `<a id="${block.identifier}"></a>`
				: renderUnsupported(
						"anchor blocks require raw HTML support in this flavor",
						flavor,
					);
		case "pageAliases":
			return flavor.supportsRawHtml
				? `<!-- page-aliases: ${block.aliases.join(", ")} -->`
				: renderUnsupported(
						"page alias metadata requires raw HTML support in this flavor",
						flavor,
					);
		case "includeDirective":
			return "";
		case "thematicBreak":
			return "---";
		case "codeBlock":
			return `\`\`\`${block.language ?? ""}\n${block.value}\n\`\`\``;
		case "blockquote":
			return block.children
				.map((child) => renderBlock(child, flavor))
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
				.map((child) => renderBlock(child, flavor))
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
					),
				)
				.join("\n");
		case "calloutList":
			return block.items
				.map((item) =>
					renderListItem(item.children, `${item.ordinal}.`, flavor),
				)
				.join("\n");
		case "table": {
			if (!flavor.supportsTables) {
				return renderUnsupported(
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
			return flavor.supportsRawHtml
				? block.value
				: renderUnsupported(
						"raw HTML blocks are not allowed in this flavor",
						flavor,
					);
		case "footnoteDefinition": {
			if (!flavor.supportsFootnotes) {
				return renderUnsupported(
					"footnote definitions require footnote-capable markdown",
					flavor,
				);
			}

			const [first, ...rest] = block.children;
			if (first?.type === "paragraph") {
				const lines = [
					`[^${block.identifier}]: ${first.children.map((child) => renderInline(child, flavor)).join("")}`,
					...rest.flatMap((child) =>
						renderBlock(child, flavor)
							.split("\n")
							.map((line) => `    ${line}`),
					),
				];
				return lines.join("\n");
			}

			return [
				`[^${block.identifier}]:`,
				...block.children.flatMap((child) =>
					renderBlock(child, flavor)
						.split("\n")
						.map((line) => `    ${line}`),
				),
			].join("\n");
		}
		case "unsupported":
			return renderUnsupported(block.reason, flavor);
	}
}

export function renderMarkdown(
	document: MarkdownDocument,
	flavor: MarkdownFlavorName | MarkdownFlavorSpec = "gfm",
): string {
	const resolvedFlavor = resolveMarkdownFlavor(flavor);
	return `${document.children
		.map((block) => renderBlock(block, resolvedFlavor))
		.filter((block) => block.length > 0)
		.join("\n\n")}\n`;
}
