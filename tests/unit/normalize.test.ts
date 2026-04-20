import { describe, expect, it } from "vitest";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";

describe("normalizeMarkdownIR", () => {
	it("collapses repeated whitespace in paragraph and heading text nodes", () => {
		const normalized = normalizeMarkdownIR({
			type: "document",
			children: [
				{
					type: "heading",
					depth: 1,
					children: [{ type: "text", value: "  Sample   title  " }],
				},
				{
					type: "paragraph",
					children: [{ type: "text", value: "Hello   world" }],
				},
			],
		});

		expect(normalized.children[0]).toMatchObject({
			type: "heading",
			children: [{ type: "text", value: "Sample title" }],
		});
		expect(normalized.children[1]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "Hello world" }],
		});
	});
});
