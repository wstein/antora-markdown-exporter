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

	it("renders lists, links, code blocks, and block quotes", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "paragraph",
					children: [
						{ type: "text", value: "Visit " },
						{
							type: "link",
							url: "https://example.com",
							children: [{ type: "text", value: "Example" }],
						},
						{ type: "text", value: " today." },
					],
				},
				{
					type: "list",
					ordered: false,
					items: [
						{
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", value: "First item" }],
								},
							],
						},
						{
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", value: "Second item" }],
								},
							],
						},
					],
				},
				{
					type: "codeBlock",
					language: "ts",
					value: "const answer = 42;",
				},
				{
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Stay focused." }],
						},
					],
				},
			],
		});

		expect(rendered).toBe(
			[
				"Visit [Example](https://example.com) today.",
				"",
				"- First item",
				"- Second item",
				"",
				"```ts",
				"const answer = 42;",
				"```",
				"",
				"> Stay focused.",
				"",
			].join("\n"),
		);
	});
});
