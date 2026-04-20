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

	it("renders ordered and nested lists, links, code blocks, and block quotes", () => {
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
					ordered: true,
					items: [
						{
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", value: "First item" }],
								},
								{
									type: "list",
									ordered: false,
									items: [
										{
											children: [
												{
													type: "paragraph",
													children: [{ type: "text", value: "Nested item" }],
												},
											],
										},
									],
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
				"1. First item",
				"  - Nested item",
				"2. Second item",
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

	it("renders extended markdown nodes with stable GFM-compatible output", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "paragraph",
					children: [
						{
							type: "strong",
							children: [{ type: "text", value: "Strong" }],
						},
						{ type: "text", value: " emphasis" },
						{ type: "softBreak" },
						{
							type: "image",
							url: "https://example.com/diagram.png",
							title: 'Diagram "A"',
							alt: [{ type: "text", value: "Diagram" }],
						},
						{ type: "hardBreak" },
						{
							type: "footnoteReference",
							identifier: "note-1",
						},
						{ type: "text", value: " " },
						{
							type: "citation",
							identifier: "cite-key",
						},
					],
				},
				{
					type: "thematicBreak",
				},
				{
					type: "table",
					align: ["left", "right"],
					header: {
						cells: [
							{ children: [{ type: "text", value: "Name" }] },
							{ children: [{ type: "text", value: "Value" }] },
						],
					},
					rows: [
						{
							cells: [
								{ children: [{ type: "text", value: "Alpha" }] },
								{ children: [{ type: "text", value: "42" }] },
							],
						},
					],
				},
				{
					type: "htmlBlock",
					value: "<div>raw</div>",
				},
				{
					type: "footnoteDefinition",
					identifier: "note-1",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Footnote body." }],
						},
					],
				},
			],
		});

		expect(rendered).toBe(
			[
				"**Strong** emphasis",
				'![Diagram](https://example.com/diagram.png "Diagram \\"A\\"")\\',
				"[^note-1] [cite:cite-key]",
				"",
				"---",
				"",
				"| Name | Value |",
				"| :--- | ---: |",
				"| Alpha | 42 |",
				"",
				"<div>raw</div>",
				"",
				"[^note-1]: Footnote body.",
				"",
			].join("\n"),
		);
	});

	it("renders dedicated admonition and callout list nodes deterministically", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "admonition",
					kind: "warning",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Review generated links." }],
						},
					],
				},
				{
					type: "calloutList",
					items: [
						{
							ordinal: 2,
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", value: "Second observation" }],
								},
							],
						},
					],
				},
			],
		});

		expect(rendered).toBe(
			[
				"> **WARNING:** Review generated links.",
				"",
				"2. Second observation",
				"",
			].join("\n"),
		);
	});
});
