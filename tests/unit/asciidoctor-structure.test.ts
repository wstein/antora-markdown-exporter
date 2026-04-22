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
			depth: 2,
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
});
