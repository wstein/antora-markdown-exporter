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

	it("renders numbering and table of contents from document render options", () => {
		const rendered = renderGfm({
			type: "document",
			renderOptions: {
				headingNumbering: { mode: "book" },
				tableOfContents: { maxDepth: 2 },
			},
			children: [
				{
					type: "heading",
					depth: 1,
					children: [{ type: "text", value: "Sample document" }],
				},
				{
					type: "heading",
					depth: 1,
					children: [{ type: "text", value: "Section One" }],
				},
				{
					type: "heading",
					depth: 2,
					children: [{ type: "text", value: "Detail" }],
				},
			],
		});

		expect(rendered).toContain("## Table of Contents");
		expect(rendered).toContain(
			"- [Chapter 1. Section One](#chapter-1-section-one)",
		);
		expect(rendered).toContain("  - [1.1. Detail](#11-detail)");
		expect(rendered).toContain("# Chapter 1. Section One");
		expect(rendered).toContain("## 1.1. Detail");
	});

	it("renders page aliases and suppresses redundant heading anchors", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "pageAliases",
					aliases: ["legacy-home", "legacy-overview"],
				},
				{
					type: "heading",
					depth: 1,
					identifier: "overview",
					children: [{ type: "text", value: "Overview" }],
				},
			],
		});

		expect(rendered).toBe(
			`${[
				"<!-- page-aliases: legacy-home, legacy-overview -->",
				"",
				"# Overview",
			].join("\n")}\n`,
		);
	});

	it("renders xref nodes like links without include-directive placeholders", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "paragraph",
					children: [
						{
							type: "xref",
							url: "docs/ROOT/install.adoc#cli",
							target: {
								raw: "docs:ROOT:install.adoc#cli",
								component: "docs",
								module: "ROOT",
								path: "install.adoc",
								fragment: "cli",
							},
							children: [{ type: "text", value: "cli" }],
						},
					],
				},
			],
		});

		expect(rendered).toBe("[cli](docs/ROOT/install.adoc#cli)\n");
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

	it("renders titled example and verse blocks with explicit stable markdown shape", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "labeledGroup",
					label: [{ type: "text", value: "Worked example" }],
					children: [
						{
							type: "blockquote",
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", value: "Example body." }],
								},
							],
						},
					],
				},
				{
					type: "labeledGroup",
					label: [{ type: "text", value: "Release verse" }],
					children: [
						{
							type: "blockquote",
							children: [
								{
									type: "paragraph",
									children: [
										{ type: "text", value: "Ship with care" },
										{ type: "softBreak" },
										{ type: "text", value: "Verify each layer" },
									],
								},
							],
						},
					],
				},
			],
		});

		expect(rendered).toBe(
			[
				"**Worked example:**",
				"",
				"> Example body.",
				"",
				"**Release verse:**",
				"",
				"> Ship with care",
				"> Verify each layer",
				"",
			].join("\n"),
		);
	});

	it("renders labeled groups with non-paragraph leading blocks on separate lines", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "labeledGroup",
					label: [{ type: "text", value: "Release command" }],
					children: [
						{
							type: "codeBlock",
							language: "bash",
							value: "make release",
						},
					],
				},
			],
		});

		expect(rendered).toBe(
			["**Release command:**", "", "```bash", "make release", "```", ""].join(
				"\n",
			),
		);
	});

	it("renders anchor and page alias metadata through raw-html fallback policy", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "anchor",
					identifier: "overview",
				},
				{
					type: "pageAliases",
					aliases: ["legacy-home"],
				},
			],
		});

		expect(rendered).toBe(
			[
				'<a id="overview"></a>',
				"",
				"<!-- page-aliases: legacy-home -->",
				"",
			].join("\n"),
		);
	});

	it("renders empty table-of-contents documents without stray separators", () => {
		const rendered = renderGfm({
			type: "document",
			renderOptions: {
				tableOfContents: { maxDepth: 2 },
			},
			children: [],
		});

		expect(rendered).toBe("\n");
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
				"<!-- fallback: raw_html reason=html-block -->",
				"<div>raw</div>",
				"<!-- /fallback: raw_html -->",
				"",
				"[^note-1]: Footnote body.",
				"",
			].join("\n"),
		);
	});

	it("renders raw html inline fallbacks and both footnote block shapes", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "paragraph",
					children: [
						{ type: "htmlInline", value: "<sup>1</sup>" },
						{ type: "text", value: " " },
						{
							type: "xref",
							url: "docs/ROOT/index.adoc",
							target: {
								raw: "docs:ROOT:index.adoc",
								component: "docs",
								module: "ROOT",
								path: "",
							},
							children: [{ type: "text", value: "home" }],
						},
					],
				},
				{
					type: "footnoteDefinition",
					identifier: "note-1",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "First paragraph." }],
						},
						{
							type: "paragraph",
							children: [{ type: "text", value: "Second paragraph." }],
						},
					],
				},
				{
					type: "footnoteDefinition",
					identifier: "note-2",
					children: [
						{
							type: "blockquote",
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", value: "Quoted note." }],
								},
							],
						},
					],
				},
			],
		});

		expect(rendered).toBe(
			[
				"<sup>1</sup> [home](docs/ROOT/index.adoc)",
				"",
				"[^note-1]: First paragraph.",
				"    Second paragraph.",
				"",
				"[^note-2]:",
				"    > Quoted note.",
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

	it("renders labeled groups around titled code blocks explicitly", () => {
		const rendered = renderGfm({
			type: "document",
			children: [
				{
					type: "labeledGroup",
					label: [{ type: "text", value: "Release command" }],
					children: [
						{
							type: "codeBlock",
							language: "bash",
							value: "make release",
						},
					],
				},
			],
		});

		expect(rendered).toBe(
			["**Release command:**", "", "```bash", "make release", "```", ""].join(
				"\n",
			),
		);
	});
});
