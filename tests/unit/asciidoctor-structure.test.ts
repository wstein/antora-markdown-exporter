import { describe, expect, it } from "vitest";
import { extractAssemblyStructure } from "../../src/adapter/asciidoctor-structure.js";

describe("asciidoctor structure extraction", () => {
	it("extracts a repository-owned structured document from assembled source", () => {
		const document = extractAssemblyStructure(
			[
				"= Manual",
				":doctype: book",
				":toc:",
				":toclevels: 2",
				":sectnums:",
				":page-aliases: legacy-home, legacy-overview",
				"",
				"== Overview",
				"",
				"See xref:install.adoc#cli[install], <https://example.com>, *bold*, _em_, `code`, and image:diagram.png[Diagram,title=Architecture].",
				"",
				"NOTE: Keep *docs* aligned with xref:install.adoc[install].",
				"",
				"* Review notes",
				"* Publish package",
				"",
				'[cols="<,^,>"]',
				"|===",
				"| Name | Status | Value",
				"| Alpha | Ready | 42",
				"|===",
			].join("\n"),
			{
				sourcePath: "/virtual/modules/ROOT/pages/index.adoc",
			},
		);

		expect(document.source).toEqual({
			backend: "assembler-structure",
			path: "/virtual/modules/ROOT/pages/index.adoc",
		});
		expect(document.renderOptions).toEqual({
			headingNumbering: { mode: "book" },
			tableOfContents: { maxDepth: 2 },
		});
		expect(document.children.map((child) => child.type)).toEqual([
			"pageAliases",
			"heading",
			"heading",
			"paragraph",
			"admonition",
			"list",
			"table",
		]);
		expect(document.children[2]).toMatchObject({
			type: "heading",
			depth: 1,
			identifier: "_overview",
			children: [{ type: "text", value: "Overview" }],
		});
		expect(document.children[3]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					url: "install.html#cli",
					target: expect.objectContaining({
						raw: "install.html#cli",
						path: "install.html",
						fragment: "cli",
					}),
				}),
				expect.objectContaining({
					type: "link",
					url: "https://example.com",
				}),
				expect.objectContaining({ type: "strong" }),
				expect.objectContaining({ type: "emphasis" }),
				expect.objectContaining({ type: "code", value: "code" }),
				expect.objectContaining({
					type: "image",
					url: "diagram.png",
					title: "Architecture",
				}),
			]),
		});
		expect(document.children[4]).toMatchObject({
			type: "admonition",
			kind: "note",
			children: [
				{
					type: "paragraph",
					children: expect.arrayContaining([
						expect.objectContaining({ type: "strong" }),
						expect.objectContaining({ type: "xref", url: "install.html" }),
					]),
				},
			],
		});
		expect(document.children[5]).toMatchObject({
			type: "list",
			ordered: false,
			items: [
				{
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Review notes" }],
						},
					],
				},
				{
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Publish package" }],
						},
					],
				},
			],
		});
		expect(document.children[6]).toMatchObject({
			type: "table",
			align: ["left", "center", "right"],
			header: {
				cells: [
					{ children: [{ type: "text", value: "Name" }] },
					{ children: [{ type: "text", value: "Status" }] },
					{ children: [{ type: "text", value: "Value" }] },
				],
			},
		});
	});

	it("extracts description lists as labeled groups and preserves list continuations structurally", () => {
		const document = extractAssemblyStructure(
			[
				"= Manual",
				":sectnums:",
				"",
				"== Core Workflows",
				"",
				". Install dependencies:",
				"+",
				"[source,bash]",
				"----",
				"make install",
				"----",
				"",
				"Motivation::",
				"",
				"The converter should emit final Markdown.",
			].join("\n"),
		);

		expect(document.children[1]).toMatchObject({
			type: "heading",
			depth: 1,
			children: [{ type: "text", value: "Core Workflows" }],
		});
		expect(document.children[2]).toMatchObject({
			type: "list",
			ordered: true,
			items: [
				{
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Install dependencies:" }],
						},
						{
							type: "codeBlock",
							language: "bash",
							value: "make install",
						},
						{
							type: "labeledGroup",
							label: [{ type: "text", value: "Motivation" }],
							children: [
								{
									type: "paragraph",
									children: [
										{
											type: "text",
											value: "The converter should emit final Markdown.",
										},
									],
								},
							],
						},
					],
				},
			],
		});
	});

	it("marks unsupported block contexts explicitly in the extracted structure", () => {
		const document = extractAssemblyStructure(
			[
				"== Example",
				"",
				"[sidebar]",
				"****",
				"Not yet mapped structurally.",
				"****",
			].join("\n"),
		);

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "heading",
				depth: 1,
				children: [{ type: "text", value: "Example" }],
			}),
			expect.objectContaining({
				type: "unsupported",
				reason: "structured extractor does not support block context: sidebar",
			}),
		]);
	});

	it("maps preambles and heading inline code without falling back to unsupported blocks", () => {
		const document = extractAssemblyStructure(
			[
				"= Guide",
				"",
				"Intro paragraph.",
				"",
				"== Release Flow Uses `develop`, `main`, And Semver Tags",
			].join("\n"),
		);

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "heading",
				children: [{ type: "text", value: "Guide" }],
			}),
			expect.objectContaining({
				type: "paragraph",
				children: [{ type: "text", value: "Intro paragraph." }],
			}),
			expect.objectContaining({
				type: "heading",
				children: [
					{ type: "text", value: "Release Flow Uses " },
					{ type: "code", value: "develop" },
					{ type: "text", value: ", " },
					{ type: "code", value: "main" },
					{ type: "text", value: ", And Semver Tags" },
				],
			}),
		]);
	});
});
