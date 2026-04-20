import type {
	MarkdownDocument,
	MarkdownHeading,
	MarkdownParagraph,
	MarkdownText,
} from "../markdown/ir.js";

export function convertAssemblyToMarkdownIR(
	assembledAsciiDoc: string,
): MarkdownDocument {
	const lines = assembledAsciiDoc.split(/\r?\n/);
	const children = lines
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			if (line.startsWith("== ")) {
				return <MarkdownHeading>{
					type: "heading",
					depth: 2,
					children: [{ type: "text", value: line.slice(3).trim() }],
				};
			}

			return <MarkdownParagraph>{
				type: "paragraph",
				children: [{ type: "text", value: line }],
			};
		});

	return {
		type: "document",
		children,
	};
}
