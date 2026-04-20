import type { MarkdownDocument } from "./ir.js";

export function normalizeMarkdownIR(
	document: MarkdownDocument,
): MarkdownDocument {
	// Minimal normalization pass: preserve structure, normalize text runs,
	// and prepare the document for renderer consumption.
	return {
		...document,
		children: document.children.map((child) => {
			if (child.type === "paragraph" || child.type === "heading") {
				return {
					...child,
					children: child.children.map((node) =>
						node.type === "text"
							? { ...node, value: node.value.replace(/\s+/g, " ").trim() }
							: node,
					),
				};
			}

			return child;
		}),
	};
}
