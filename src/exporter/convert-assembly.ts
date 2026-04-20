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
		line.startsWith("* ") ||
		line === "[quote]" ||
		line.startsWith("[source")
	);
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

		if (line.startsWith("* ")) {
			const items: MarkdownList["items"] = [];

			while (
				index < lines.length &&
				(lines[index]?.trimStart().startsWith("* ") ?? false)
			) {
				const itemLine = lines[index]?.trimStart().slice(2) ?? "";
				items.push({
					children: [
						<MarkdownParagraph>{
							type: "paragraph",
							children: parseInline(itemLine),
						},
					],
				});
				index += 1;
			}

			children.push({
				type: "list",
				ordered: false,
				items,
			});
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
