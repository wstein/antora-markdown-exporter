import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";

describe("convertAssemblyToMarkdownIR", () => {
	it("handles assembler-emitted anchors, attributes, open blocks, and page breaks semantically", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				"= Title",
				":doctype: book",
				":page-component-name: antora-markdown-exporter",
				"",
				'<a id="section-one"></a>',
				"[discrete#section-one]",
				"== Section One",
				"",
				'[role="example"]',
				"****",
				"Wrapped paragraph",
				"****",
				"",
				'[options="header",cols="1,2"]',
				"|===",
				"|Key",
				"|Value",
				"",
				"|Alpha",
				"|42",
				"|===",
				"",
				"<<<<",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "heading",
				depth: 1,
				children: [{ type: "text", value: "Title" }],
			},
			{
				type: "anchor",
				identifier: "section-one",
			},
			{
				type: "heading",
				depth: 1,
				children: [{ type: "text", value: "Section One" }],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "Wrapped paragraph" }],
			},
			{
				type: "table",
				align: [null, null],
				header: {
					cells: [
						{ children: [{ type: "text", value: "Key" }] },
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
				type: "thematicBreak",
			},
		]);
	});

	it("keeps unresolved include directives visible when no source path is available", () => {
		const document = convertAssemblyToMarkdownIR(
			"Before\ninclude::partials/missing.adoc[]\nAfter",
		);

		expect(document.children).toEqual([
			{
				type: "paragraph",
				children: [{ type: "text", value: "Before" }],
			},
			{
				type: "unsupported",
				reason:
					"include directive is not yet inlined: include::partials/missing.adoc[]",
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "After" }],
			},
		]);
	});

	it("preserves directives when an include resolver cannot resolve a target", () => {
		const document = convertAssemblyToMarkdownIR(
			"include::partials/missing.adoc[lines=1..2]",
			{
				sourcePath: "/virtual/page.adoc",
				includeResolver: () => undefined,
			},
		);

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "includeDirective",
				target: "partials/missing.adoc",
				attributes: { lines: "1..2" },
				semantics: {
					lineRanges: [{ start: 1, end: 2 }],
					tagSelection: undefined,
					indent: undefined,
					levelOffset: undefined,
				},
				provenance: {
					depth: 0,
					includeRootDir: "/virtual",
					includingSourcePath: "/virtual/page.adoc",
					inclusionStack: ["/virtual/page.adoc"],
					resolvedPath: "/virtual/partials/missing.adoc",
				},
			}),
			{
				type: "unsupported",
				reason:
					"include directive is not yet inlined: include::partials/missing.adoc[lines=1..2]",
			},
		]);
	});

	it("prevents include cycles and keeps the prevention marker visible", () => {
		const document = convertAssemblyToMarkdownIR("include::a.adoc[]", {
			sourcePath: "/virtual/page.adoc",
			includeResolver: (target) => {
				switch (target) {
					case "a.adoc":
						return "include::b.adoc[]";
					case "b.adoc":
						return "include::a.adoc[]";
					default:
						return undefined;
				}
			},
		});

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "includeDirective",
				target: "a.adoc",
			}),
			expect.objectContaining({
				type: "includeDirective",
				target: "b.adoc",
			}),
			expect.objectContaining({
				type: "includeDirective",
				target: "a.adoc",
				provenance: expect.objectContaining({
					includingSourcePath: "/virtual/b.adoc",
				}),
			}),
			{
				type: "paragraph",
				children: [
					{
						type: "text",
						value: "// include cycle prevented for a.adoc from /virtual/b.adoc",
					},
				],
			},
		]);
	});

	it("marks malformed source and quote blocks as unsupported and stops paragraphs at block boundaries", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				"Lead line",
				"include::partials/next.adoc[]",
				"[source,ts]",
				"const answer = 42;",
				"[quote]",
				"Not fenced",
				"[quote]",
				"____",
				"Nested thought",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "paragraph",
				children: [{ type: "text", value: "Lead line" }],
			},
			{
				type: "unsupported",
				reason:
					"include directive is not yet inlined: include::partials/next.adoc[]",
			},
			{
				type: "unsupported",
				reason: "source block fence is not closed correctly",
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "const answer = 42;" }],
			},
			{
				type: "unsupported",
				reason: "quote block fence is not closed correctly",
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "Not fenced" }],
			},
			{
				type: "unsupported",
				reason: "quote block fence is not closed correctly",
			},
		]);
	});

	it("marks unterminated quote blocks after an opening fence as unsupported", () => {
		const document = convertAssemblyToMarkdownIR(
			["[quote]", "____", "Missing closing fence"].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "unsupported",
				reason: "quote block fence is not closed correctly",
			},
		]);
	});

	it("applies tag selection, zero level offsets, and overlapping line unions deterministically", () => {
		const document = convertAssemblyToMarkdownIR(
			"include::snippet.adoc[tags=intro;details,leveloffset=0,lines=2..4;3..4,indent=2]",
			{
				sourcePath: "/virtual/page.adoc",
				includeResolver: (target) => {
					if (target !== "snippet.adoc") {
						return undefined;
					}

					return [
						"// tag::intro[]",
						"== Intro",
						"Shared line",
						"// end::intro[]",
						"// tag::details[]",
						"=== Detail",
						"Shared line",
						"// end::details[]",
					].join("\n");
				},
			},
		);

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "includeDirective",
				target: "snippet.adoc",
				attributes: {
					tags: "intro;details",
					leveloffset: "0",
					lines: "2..4;3..4",
					indent: "2",
				},
				semantics: {
					tagSelection: {
						precedence: "document-order",
						tags: ["intro", "details"],
					},
					lineRanges: [
						{ start: 2, end: 4 },
						{ start: 3, end: 4 },
					],
					indent: 2,
					levelOffset: 0,
				},
			}),
			{
				type: "paragraph",
				children: [{ type: "text", value: "Shared line" }],
			},
			{
				type: "heading",
				depth: 2,
				children: [{ type: "text", value: "Detail" }],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "Shared line" }],
			},
		]);
	});

	it("keeps content unchanged for empty tags and invalid level offsets while surfacing diagnostics", () => {
		const document = convertAssemblyToMarkdownIR(
			"include::snippet.adoc[tags=,leveloffset=bogus]",
			{
				sourcePath: "/virtual/page.adoc",
				includeResolver: (target) => {
					if (target !== "snippet.adoc") {
						return undefined;
					}

					return ["== Included", "Body line"].join("\n");
				},
			},
		);

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "includeDirective",
				target: "snippet.adoc",
				attributes: {
					tags: "",
					leveloffset: "bogus",
				},
				diagnostics: [
					{
						code: "empty-tag-selection",
						message: "include tag selection must contain at least one tag",
						source: "",
					},
					{
						code: "invalid-leveloffset",
						message: "include leveloffset must be a signed integer",
						source: "bogus",
					},
				],
			}),
			{
				type: "heading",
				depth: 1,
				children: [{ type: "text", value: "Included" }],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "Body line" }],
			},
		]);
	});

	it("normalizes reversed line ranges and keeps invalid open-ended ranges visible as diagnostics", () => {
		const document = convertAssemblyToMarkdownIR(
			"include::snippet.adoc[lines=4..2;-2..4;7]",
			{
				sourcePath: "/virtual/page.adoc",
				includeResolver: (target) => {
					if (target !== "snippet.adoc") {
						return undefined;
					}

					return [
						"line 1",
						"line 2",
						"line 3",
						"line 4",
						"line 5",
						"line 6",
						"line 7",
					].join("\n");
				},
			},
		);

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "includeDirective",
				target: "snippet.adoc",
				diagnostics: [
					{
						code: "invalid-line-range",
						message:
							"include line ranges must use positive line numbers or open-ended bounds",
						source: "-2..4",
					},
				],
				semantics: {
					tagSelection: undefined,
					lineRanges: [
						{ start: 2, end: 4 },
						{ start: 7, end: 7 },
					],
					indent: undefined,
					levelOffset: undefined,
				},
			}),
			{
				type: "paragraph",
				children: [{ type: "text", value: "line 2 line 3 line 4 line 7" }],
			},
		]);
	});

	it("leaves non-heading lines unchanged when level offsets are otherwise valid", () => {
		const document = convertAssemblyToMarkdownIR(
			"include::snippet.adoc[leveloffset=+2]",
			{
				sourcePath: "/virtual/page.adoc",
				includeResolver: (target) => {
					if (target !== "snippet.adoc") {
						return undefined;
					}

					return ["plain line", "another plain line"].join("\n");
				},
			},
		);

		expect(document.children).toEqual([
			expect.objectContaining({
				type: "includeDirective",
				target: "snippet.adoc",
				semantics: {
					tagSelection: undefined,
					lineRanges: undefined,
					indent: undefined,
					levelOffset: 2,
				},
			}),
			{
				type: "paragraph",
				children: [{ type: "text", value: "plain line another plain line" }],
			},
		]);
	});

	it("covers xref parsing, inline fallback, and table or alignment guard branches", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				"link:xref:#[]",
				"xref:#anchor[]",
				"Standalone `code` with *strong* and _emphasis_ plus `",
				'[cols="1,>2"]',
				"|===",
				"|===",
				'[cols="1,^2"]',
				"|===",
				"| Header | Value",
				"|===",
				"NOTE:",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "paragraph",
				children: [
					{ type: "text", value: "link:xref:#[] " },
					{
						type: "xref",
						url: "#anchor",
						target: {
							raw: "#anchor",
							path: "",
							fragment: "anchor",
						},
						children: [{ type: "text", value: "anchor" }],
					},
					{ type: "text", value: " Standalone " },
					{ type: "code", value: "code" },
					{ type: "text", value: " with " },
					{ type: "strong", children: [{ type: "text", value: "strong" }] },
					{ type: "text", value: " and " },
					{ type: "emphasis", children: [{ type: "text", value: "emphasis" }] },
					{ type: "text", value: " plus `" },
				],
			},
			{
				type: "unsupported",
				reason: "table requires at least one header row",
			},
			{
				type: "table",
				align: [null, "center"],
				header: {
					cells: [
						{ children: [{ type: "text", value: "Header" }] },
						{ children: [{ type: "text", value: "Value" }] },
					],
				},
				rows: [],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "NOTE:" }],
			},
		]);
	});

	it("covers version-only xrefs, unmatched inline markers, standalone images, and mixed table alignment", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				"xref:2.0@install.adoc[]",
				"Broken *strong and _emphasis markers stay visible",
				"image::diagram.png[Diagram]",
				'[cols="<1,2,>3"]',
				"|===",
				"| Left | Plain | Right",
				"| body | center? | tail",
				"|===",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "paragraph",
				children: [
					{
						type: "xref",
						url: "2.0/install.adoc",
						target: {
							raw: "2.0@install.adoc",
							component: undefined,
							version: "2.0",
							module: undefined,
							family: {
								kind: "page",
								name: "page",
							},
							path: "install.adoc",
							fragment: undefined,
						},
						children: [{ type: "text", value: "install" }],
					},
					{
						type: "text",
						value: " Broken *strong and _emphasis markers stay visible",
					},
				],
			},
			{
				type: "paragraph",
				children: [
					{
						type: "image",
						url: "diagram.png",
						title: undefined,
						alt: [{ type: "text", value: "Diagram" }],
					},
				],
			},
			{
				type: "table",
				align: ["left", null, "right"],
				header: {
					cells: [
						{ children: [{ type: "text", value: "Left" }] },
						{ children: [{ type: "text", value: "Plain" }] },
						{ children: [{ type: "text", value: "Right" }] },
					],
				},
				rows: [
					{
						cells: [
							{ children: [{ type: "text", value: "body" }] },
							{ children: [{ type: "text", value: "center?" }] },
							{ children: [{ type: "text", value: "tail" }] },
						],
					},
				],
			},
		]);
	});

	it("uses the default include resolver for partials, keeps missing includes visible, and preserves paragraph boundaries", () => {
		const fixtureRoot = mkdtempSync(
			join(tmpdir(), "antora-markdown-exporter-"),
		);

		try {
			const pagesDir = join(fixtureRoot, "modules", "ROOT", "pages");
			const partialsDir = join(pagesDir, "partials");
			mkdirSync(partialsDir, { recursive: true });
			writeFileSync(
				join(partialsDir, "snippet.adoc"),
				["== Included title", "", "Included body"].join("\n"),
			);

			const sourcePath = join(pagesDir, "page.adoc");
			const document = convertAssemblyToMarkdownIR(
				[
					"include::partial$snippet.adoc[leveloffset=+1]",
					"",
					"include::missing.adoc[]",
					"",
					"Trailing paragraph",
				].join("\n"),
				{ sourcePath },
			);

			expect(document.children).toEqual([
				expect.objectContaining({
					type: "includeDirective",
					target: "partial$snippet.adoc",
					provenance: expect.objectContaining({
						resolvedPath: join(partialsDir, "snippet.adoc"),
					}),
					semantics: {
						tagSelection: undefined,
						lineRanges: undefined,
						indent: undefined,
						levelOffset: 1,
					},
				}),
				{
					type: "heading",
					depth: 2,
					children: [{ type: "text", value: "Included title" }],
				},
				{
					type: "paragraph",
					children: [{ type: "text", value: "Included body" }],
				},
				expect.objectContaining({
					type: "includeDirective",
					target: "missing.adoc",
					provenance: expect.objectContaining({
						resolvedPath: join(pagesDir, "missing.adoc"),
					}),
				}),
				{
					type: "unsupported",
					reason:
						"include directive is not yet inlined: include::missing.adoc[]",
				},
				{
					type: "paragraph",
					children: [{ type: "text", value: "Trailing paragraph" }],
				},
			]);
		} finally {
			rmSync(fixtureRoot, { force: true, recursive: true });
		}
	});

	it("falls back cleanly for mixed list markers and preserves separate list blocks after type changes", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				". Ordered item",
				"* Bullets restart as a separate block",
				".* Mixed marker syntax stays literal",
				"",
				"* Parent",
				"*** Too deep to nest immediately",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "list",
				ordered: true,
				start: 1,
				items: [
					{
						children: [
							{
								type: "paragraph",
								children: [{ type: "text", value: "Ordered item" }],
							},
						],
					},
				],
			},
			{
				type: "list",
				ordered: false,
				start: undefined,
				items: [
					{
						children: [
							{
								type: "paragraph",
								children: [
									{
										type: "text",
										value: "Bullets restart as a separate block",
									},
								],
							},
						],
					},
				],
			},
			{
				type: "paragraph",
				children: [
					{ type: "text", value: ".* Mixed marker syntax stays literal" },
				],
			},
			{
				type: "list",
				ordered: false,
				start: undefined,
				items: [
					{
						children: [
							{
								type: "paragraph",
								children: [{ type: "text", value: "Parent" }],
							},
						],
					},
				],
			},
			{
				type: "list",
				ordered: false,
				start: undefined,
				items: [
					{
						children: [
							{
								type: "paragraph",
								children: [
									{ type: "text", value: "Too deep to nest immediately" },
								],
							},
						],
					},
				],
			},
		]);
	});

	it("parses successful source and quote blocks without inventing callout lists", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				"[source,js,linenums]",
				"----",
				"console.log('hi');",
				"----",
				"After source",
				"",
				"[quote]",
				"____",
				"== Nested heading",
				"Quoted line",
				"____",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "codeBlock",
				language: "js",
				meta: "linenums",
				value: "console.log('hi');",
				callouts: undefined,
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "After source" }],
			},
			{
				type: "blockquote",
				children: [
					{
						type: "heading",
						depth: 1,
						children: [{ type: "text", value: "Nested heading" }],
					},
					{
						type: "paragraph",
						children: [{ type: "text", value: "Quoted line" }],
					},
				],
			},
		]);
	});

	it("keeps malformed or unapplied table directives visible without mis-parsing later content", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				'[cols="1,2"]',
				"Not a table fence",
				"",
				"|===",
				"| Header only",
				"",
				"NOTE: Parsed admonition",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "paragraph",
				children: [{ type: "text", value: '[cols="1,2"] Not a table fence' }],
			},
			{
				type: "unsupported",
				reason: "table fence is not closed correctly",
			},
		]);
	});

	it("parses source callouts and preserves explicit xref semantics while leaving invalid anchors literal", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				"[source,mermaid]",
				"----",
				"graph TD",
				"  A --> B <1>",
				"----",
				"<1> Rendered by downstream tooling",
				"",
				"xref:2.0@install.adoc[Install guide]",
				"xref:docs:ROOT:example$demo.adoc[Example asset]",
				"xref:#[]",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "codeBlock",
				language: "mermaid",
				meta: undefined,
				value: "graph TD\n  A --> B <1>",
				callouts: [1],
			},
			{
				type: "calloutList",
				items: [
					{
						ordinal: 1,
						children: [
							{
								type: "paragraph",
								children: [
									{
										type: "text",
										value: "Rendered by downstream tooling",
									},
								],
							},
						],
					},
				],
			},
			{
				type: "paragraph",
				children: [
					{
						type: "xref",
						url: "2.0/install.adoc",
						target: {
							raw: "2.0@install.adoc",
							component: undefined,
							version: "2.0",
							module: undefined,
							family: { kind: "page", name: "page" },
							path: "install.adoc",
							fragment: undefined,
						},
						children: [{ type: "text", value: "Install guide" }],
					},
					{ type: "text", value: " " },
					{
						type: "xref",
						url: "docs/ROOT/example/demo.adoc",
						target: {
							raw: "docs:ROOT:example$demo.adoc",
							component: "docs",
							version: undefined,
							module: "ROOT",
							family: { kind: "example", name: "example" },
							path: "demo.adoc",
							fragment: undefined,
						},
						children: [{ type: "text", value: "Example asset" }],
					},
					{ type: "text", value: " xref:#[]" },
				],
			},
		]);
	});

	it("keeps empty aligned tables visible as unsupported before continuing with later blocks", () => {
		const document = convertAssemblyToMarkdownIR(
			['[cols=">1,^1"]', "|===", "|===", "", "Paragraph after table"].join(
				"\n",
			),
		);

		expect(document.children).toEqual([
			{
				type: "unsupported",
				reason: "table requires at least one header row",
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "Paragraph after table" }],
			},
		]);
	});

	it("groups multiline asciidoc table rows using the declared column count", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				'[cols="1,2,2"]',
				"|===",
				"|Priority",
				"|Quality goal",
				"|Why it matters",
				"",
				"|1",
				"|Deterministic, reviewable output",
				"|Stable golden tests depend on this.",
				"",
				"|2",
				"|Inspectable validation surfaces",
				"|Release checks reuse normalized inspection data.",
				"|===",
			].join("\n"),
		);

		expect(document.children).toEqual([
			{
				type: "table",
				align: [null, null, null],
				header: {
					cells: [
						{ children: [{ type: "text", value: "Priority" }] },
						{ children: [{ type: "text", value: "Quality goal" }] },
						{ children: [{ type: "text", value: "Why it matters" }] },
					],
				},
				rows: [
					{
						cells: [
							{ children: [{ type: "text", value: "1" }] },
							{
								children: [
									{
										type: "text",
										value: "Deterministic, reviewable output",
									},
								],
							},
							{
								children: [
									{
										type: "text",
										value: "Stable golden tests depend on this.",
									},
								],
							},
						],
					},
					{
						cells: [
							{ children: [{ type: "text", value: "2" }] },
							{
								children: [
									{
										type: "text",
										value: "Inspectable validation surfaces",
									},
								],
							},
							{
								children: [
									{
										type: "text",
										value: "Release checks reuse normalized inspection data.",
									},
								],
							},
						],
					},
				],
			},
		]);
	});
});
