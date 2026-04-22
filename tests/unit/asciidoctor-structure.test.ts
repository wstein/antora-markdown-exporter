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
						path: "install.adoc",
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
						expect.objectContaining({
							type: "xref",
							url: "install.html",
							target: expect.objectContaining({
								path: "install.adoc",
							}),
						}),
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

	it("maps sidebar and open blocks into supported structured containers", () => {
		const document = extractAssemblyStructure(
			[
				"== Example",
				"",
				"[sidebar]",
				"****",
				"Sidebar guidance.",
				"****",
				"",
				"--",
				"Open block body.",
				"--",
			].join("\n"),
		);

		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "heading",
					depth: 1,
					children: [{ type: "text", value: "Example" }],
				}),
				expect.objectContaining({
					type: "blockquote",
					children: [
						expect.objectContaining({
							type: "paragraph",
							children: [{ type: "text", value: "Sidebar guidance." }],
						}),
					],
				}),
				expect.objectContaining({
					type: "paragraph",
					children: [{ type: "text", value: "Open block body." }],
				}),
			]),
		);
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

	it("extracts family-qualified Antora xrefs into structured target coordinates", () => {
		const document = extractAssemblyStructure(
			[
				"== Routes",
				"",
				"See xref:2.0@docs:api:page$index.adoc#overview[overview], xref:2.0@docs:ROOT:image$diagram.png[diagram], and xref:2.0@docs:ROOT:partial$nav.adoc[nav].",
			].join("\n"),
		);

		const paragraph = document.children[1];
		expect(paragraph).toMatchObject({ type: "paragraph" });
		if (paragraph?.type !== "paragraph") {
			throw new Error("expected paragraph");
		}

		const xrefs = paragraph.children.filter((child) => child.type === "xref");
		expect(xrefs).toHaveLength(3);
		expect(xrefs[0]).toMatchObject({
			type: "xref",
			target: {
				raw: "2.0@docs:api:page$index.html#overview",
				component: "docs",
				version: "2.0",
				module: "api",
				family: {
					kind: "page",
					name: "page",
				},
				path: "index.adoc",
				fragment: "overview",
			},
		});
		expect(xrefs[1]).toMatchObject({
			type: "xref",
			target: {
				raw: "2.0@docs:ROOT:image$diagram.png",
				component: "docs",
				version: "2.0",
				module: "ROOT",
				family: {
					kind: "image",
					name: "image",
				},
				path: "diagram.png",
			},
		});
		expect(xrefs[2]).toMatchObject({
			type: "xref",
			target: {
				raw: "2.0@docs:ROOT:partial$nav.html",
				component: "docs",
				version: "2.0",
				module: "ROOT",
				family: {
					kind: "partial",
					name: "partial",
				},
				path: "nav.adoc",
			},
		});
	});
});
