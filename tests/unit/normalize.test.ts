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

	it("normalizes anchor and page alias metadata", () => {
		const normalized = normalizeMarkdownIR({
			type: "document",
			children: [
				{
					type: "pageAliases",
					aliases: [" legacy-home ", "  legacy-overview  "],
				},
				{
					type: "anchor",
					identifier: " overview ",
				},
			],
		});

		expect(normalized.children[0]).toEqual({
			type: "pageAliases",
			aliases: ["legacy-home", "legacy-overview"],
		});
		expect(normalized.children[1]).toEqual({
			type: "anchor",
			identifier: "overview",
		});
	});

	it("normalizes nested ordered list, quote, and link content recursively", () => {
		const normalized = normalizeMarkdownIR({
			type: "document",
			children: [
				{
					type: "list",
					ordered: true,
					items: [
						{
							children: [
								{
									type: "paragraph",
									children: [
										{
											type: "link",
											url: "https://example.com",
											children: [{ type: "text", value: "  Example   docs  " }],
										},
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
													children: [
														{
															type: "text",
															value: "  Keep   reviewing  ",
														},
													],
												},
											],
										},
									],
								},
							],
						},
					],
				},
				{
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "  Stay   focused. " }],
						},
					],
				},
			],
		});

		expect(normalized.children[0]).toMatchObject({
			type: "list",
			ordered: true,
			items: [
				{
					children: [
						{
							type: "paragraph",
							children: [
								{
									type: "link",
									children: [{ type: "text", value: "Example docs" }],
								},
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
											children: [{ type: "text", value: "Keep reviewing" }],
										},
									],
								},
							],
						},
					],
				},
			],
		});
		expect(normalized.children[1]).toMatchObject({
			type: "blockquote",
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "Stay focused." }],
				},
			],
		});
	});

	it("normalizes admonition and callout list content recursively", () => {
		const normalized = normalizeMarkdownIR({
			type: "document",
			children: [
				{
					type: "admonition",
					kind: "tip",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "  Keep   it   tidy. " }],
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
									children: [{ type: "text", value: "  Second   note  " }],
								},
							],
						},
					],
				},
			],
		});

		expect(normalized.children[0]).toMatchObject({
			type: "admonition",
			kind: "tip",
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "Keep it tidy." }],
				},
			],
		});
		expect(normalized.children[1]).toMatchObject({
			type: "calloutList",
			items: [
				{
					ordinal: 2,
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Second note" }],
						},
					],
				},
			],
		});
	});

	it("normalizes rich inline and block metadata for new markdown nodes", () => {
		const normalized = normalizeMarkdownIR({
			type: "document",
			children: [
				{
					type: "paragraph",
					children: [
						{
							type: "strong",
							children: [{ type: "text", value: "  Strong   text " }],
						},
						{ type: "softBreak" },
						{
							type: "image",
							url: " https://example.com/image.png ",
							title: '  Hero "image"  ',
							alt: [{ type: "text", value: "  Hero   image  " }],
						},
						{ type: "hardBreak" },
						{
							type: "htmlInline",
							value: "  <span>inline</span>  ",
						},
						{
							type: "footnoteReference",
							identifier: " note-1 ",
							label: "  Footnote label  ",
						},
						{
							type: "citation",
							identifier: " cite-key ",
							label: "  Citation label  ",
						},
					],
				},
				{
					type: "table",
					align: ["left", null],
					header: {
						cells: [
							{
								children: [{ type: "text", value: "  Column   A " }],
							},
							{
								children: [{ type: "text", value: " Column B  " }],
							},
						],
					},
					rows: [
						{
							cells: [
								{
									children: [{ type: "text", value: "  Cell   1 " }],
								},
								{
									children: [{ type: "text", value: "  Cell   2 " }],
								},
							],
						},
					],
				},
				{
					type: "htmlBlock",
					value: "  <div>block</div>  ",
				},
				{
					type: "footnoteDefinition",
					identifier: " note-1 ",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "  Footnote   body  " }],
						},
					],
				},
			],
		});

		expect(normalized.children[0]).toMatchObject({
			type: "paragraph",
			children: [
				{
					type: "strong",
					children: [{ type: "text", value: "Strong text" }],
				},
				{ type: "softBreak" },
				{
					type: "image",
					url: "https://example.com/image.png",
					title: 'Hero "image"',
					alt: [{ type: "text", value: "Hero image" }],
				},
				{ type: "hardBreak" },
				{
					type: "htmlInline",
					value: "<span>inline</span>",
				},
				{
					type: "footnoteReference",
					identifier: "note-1",
					label: "Footnote label",
				},
				{
					type: "citation",
					identifier: "cite-key",
					label: "Citation label",
				},
			],
		});
		expect(normalized.children[1]).toMatchObject({
			type: "table",
			header: {
				cells: [
					{ children: [{ type: "text", value: "Column A" }] },
					{ children: [{ type: "text", value: "Column B" }] },
				],
			},
			rows: [
				{
					cells: [
						{ children: [{ type: "text", value: "Cell 1" }] },
						{ children: [{ type: "text", value: "Cell 2" }] },
					],
				},
			],
		});
		expect(normalized.children[2]).toMatchObject({
			type: "htmlBlock",
			value: "<div>block</div>",
		});
		expect(normalized.children[3]).toMatchObject({
			type: "footnoteDefinition",
			identifier: "note-1",
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "Footnote body" }],
				},
			],
		});
	});
});
