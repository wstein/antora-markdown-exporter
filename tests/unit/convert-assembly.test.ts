import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";

describe("convertAssemblyToMarkdownIR", () => {
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
});
