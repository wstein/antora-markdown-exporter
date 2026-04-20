import { describe, expect, it } from "vitest";
import { renderGfm } from "../../src/markdown/render/index.js";

describe("renderGfm", () => {
	it("renders headings and paragraphs as exact markdown output", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "heading",
					depth: 1,
					children: [{ type: "text", value: "Sample document" }],
				},
				{
					type: "paragraph",
					children: [{ type: "text", value: "Hello world." }],
				},
			],
		});

		expect(rendered).toBe("# Sample document\n\nHello world.\n");
	});

	it("renders unsupported blocks as visible fallback markers", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{ type: "unsupported", reason: "table rendering is not implemented" },
			],
		});

		expect(rendered).toBe(
			"> Unsupported: table rendering is not implemented\n",
		);
	});
});
