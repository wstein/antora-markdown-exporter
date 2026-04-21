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
});
