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

	it("maps floating titles to headings and drops page breaks from the structured output", () => {
		const document = extractAssemblyStructure(
			[
				"= Manual",
				":toc:",
				":sectnums:",
				"",
				"[discrete]",
				"== Overview",
				"",
				"Text under overview.",
				"",
				"<<<",
				"",
				"== Next",
				"",
				"Next section.",
			].join("\n"),
		);

		expect(document.renderOptions).toMatchObject({
			headingNumbering: { mode: "section" },
			tableOfContents: {},
		});
		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "heading",
					identifier: "_overview",
					children: [{ type: "text", value: "Overview" }],
				}),
				expect.objectContaining({
					type: "heading",
					identifier: "_next",
					children: [{ type: "text", value: "Next" }],
				}),
			]),
		);
		expect(document.children).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "unsupported",
					reason: expect.stringContaining("floating_title"),
				}),
				expect.objectContaining({
					type: "unsupported",
					reason: expect.stringContaining("page_break"),
				}),
			]),
		);
	});

	it("extracts document metadata, footnotes, citations, captions, and image attributes structurally", () => {
		const document = extractAssemblyStructure(
			[
				"= Manual",
				"Doc Writer",
				":revdate: 2026-04-22",
				"",
				"A note footnote:[Body text] and [cite]#Doe2026#.",
				"",
				".Release table",
				"|===",
				"| Name | Value",
				"| Alpha | 42",
				"|===",
				"",
				".Architecture figure",
				"image::diagram.png[Alt text,width=320,height=240]",
			].join("\n"),
		);

		expect(document.metadata).toMatchObject({
			attributes: expect.objectContaining({
				doctitle: "Manual",
				author: "Doc Writer",
				revdate: "2026-04-22",
			}),
		});
		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "paragraph",
					children: expect.arrayContaining([
						expect.objectContaining({
							type: "footnoteReference",
							identifier: "1",
							label: "1",
						}),
						expect.objectContaining({
							type: "citation",
							identifier: "Doe2026",
							label: "Doe2026",
						}),
					]),
				}),
				expect.objectContaining({
					type: "table",
					caption: [{ type: "text", value: "Release table" }],
				}),
				expect.objectContaining({
					type: "paragraph",
					children: [
						expect.objectContaining({
							type: "image",
							url: "diagram.png",
							title: "Architecture figure",
							attributes: { width: "320", height: "240" },
						}),
					],
				}),
				expect.objectContaining({
					type: "footnoteDefinition",
					identifier: "1",
					children: [
						expect.objectContaining({
							type: "paragraph",
							children: [{ type: "text", value: "Body text" }],
						}),
					],
				}),
			]),
		);
	});

	it("preserves titled example blocks, verse blocks, and richer callout continuations", () => {
		const document = extractAssemblyStructure(
			[
				"== Examples",
				"",
				".Worked example",
				"====",
				"Example body.",
				"====",
				"",
				"[verse]",
				"____",
				"Roses are red",
				"Violets are blue",
				"____",
				"",
				".Annotated code",
				"[source,ts]",
				"----",
				"const answer = 42; <1>",
				"----",
				"<1> Verify the result",
				"+",
				"Review the release checklist.",
			].join("\n"),
		);

		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "labeledGroup",
					label: [{ type: "text", value: "Worked example" }],
					children: [
						expect.objectContaining({
							type: "blockquote",
							children: [
								expect.objectContaining({
									type: "paragraph",
									children: [{ type: "text", value: "Example body." }],
								}),
							],
						}),
					],
				}),
				expect.objectContaining({
					type: "blockquote",
					children: [
						expect.objectContaining({
							type: "paragraph",
							children: [
								{ type: "text", value: "Roses are red" },
								{ type: "softBreak" },
								{ type: "text", value: "Violets are blue" },
							],
						}),
					],
				}),
				expect.objectContaining({
					type: "labeledGroup",
					label: [{ type: "text", value: "Annotated code" }],
					children: [
						expect.objectContaining({
							type: "codeBlock",
							language: "ts",
							callouts: [1],
						}),
					],
				}),
				expect.objectContaining({
					type: "calloutList",
					items: [
						expect.objectContaining({
							ordinal: 1,
							children: [
								expect.objectContaining({
									type: "paragraph",
									children: [{ type: "text", value: "Verify the result" }],
								}),
								expect.objectContaining({
									type: "paragraph",
									children: [
										{ type: "text", value: "Review the release checklist." },
									],
								}),
							],
						}),
					],
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

	it("derives readable fallback labels for unlabeled qualified xrefs", () => {
		const document = extractAssemblyStructure(
			[
				"== Xrefs",
				"",
				"See xref:docs:ROOT:install.adoc[], xref:2.0@docs:ROOT:install.adoc#cli[], xref:2.0@docs:api:page$index.adoc#overview[], xref:docs:ROOT:guide/setup.adoc[], and xref:docs:ROOT:partial$nav.adoc[].",
			].join("\n"),
		);

		const paragraph = document.children[1];
		expect(paragraph).toMatchObject({ type: "paragraph" });
		if (paragraph?.type !== "paragraph") {
			throw new Error("expected paragraph");
		}

		const labels = paragraph.children
			.filter((child) => child.type === "xref")
			.map((child) =>
				child.type === "xref" && child.children[0]?.type === "text"
					? child.children[0].value
					: "",
			);
		expect(labels).toEqual(["install", "cli", "overview", "setup", "nav"]);
	});

	it("supports explicit xref fallback label display policy", () => {
		const document = extractAssemblyStructure(
			[
				"== Xrefs",
				"",
				"See xref:docs:ROOT:guide/setup.adoc[] and xref:2.0@docs:api:page$guide/index.adoc#overview[].",
			].join("\n"),
			{
				xrefFallbackLabelStyle: "fragment-or-path",
			},
		);

		const paragraph = document.children[1];
		expect(paragraph).toMatchObject({ type: "paragraph" });
		if (paragraph?.type !== "paragraph") {
			throw new Error("expected paragraph");
		}

		const labels = paragraph.children
			.filter((child) => child.type === "xref")
			.map((child) =>
				child.type === "xref" && child.children[0]?.type === "text"
					? child.children[0].value
					: "",
			);
		expect(labels).toEqual(["guide/setup", "overview"]);
	});

	it("extracts pass blocks and halign-driven table alignment structurally", () => {
		const document = extractAssemblyStructure(
			[
				"== Raw",
				"",
				"++++",
				"<aside>Preserve me</aside>",
				"++++",
				"",
				"|===",
				"| Left | Center | Right",
				"",
				"| One | Two | Three",
				"|===",
			].join("\n"),
		);

		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "htmlBlock",
					value: "<aside>Preserve me</aside>",
				}),
				expect.objectContaining({
					type: "table",
					align: [null, null, null],
				}),
			]),
		);
	});

	it("keeps malformed inline html literal and exposes unsupported block contexts", () => {
		const document = extractAssemblyStructure(
			[
				"== Edge Cases",
				"",
				"+++<strong>broken+++",
				"",
				"video::clip.mp4[]",
			].join("\n"),
		);

		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "paragraph",
					children: [{ type: "text", value: "<strong>broken" }],
				}),
				expect.objectContaining({
					type: "unsupported",
					reason: expect.stringContaining("video"),
				}),
			]),
		);
	});

	it("treats malformed inline image spans and raw angle-bracket fragments as text", () => {
		const document = extractAssemblyStructure(
			[
				"== Inline edge cases",
				"",
				'Broken <span class="image"><img src="diagram.png" alt="Diagram"> and dangling <raw text',
			].join("\n"),
		);

		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "paragraph",
					children: [
						{
							type: "text",
							value:
								'Broken <span class="image"><img src="diagram.png" alt="Diagram"> and dangling <raw text',
						},
					],
				}),
			]),
		);
	});

	it("joins multi-term description labels with a stable separator", () => {
		const document = extractAssemblyStructure(
			["== Terms", "", "first term; second term:: Shared description."].join(
				"\n",
			),
		);

		expect(document.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "labeledGroup",
					label: [{ type: "text", value: "first term; second term" }],
				}),
			]),
		);
	});
});
