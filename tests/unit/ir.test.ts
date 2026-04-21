import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";

describe("Markdown IR boundary", () => {
	it("converts assembled AsciiDoc into a document IR", () => {
		const assembled = "== Sample\nHello world.";
		const ir = convertAssemblyToMarkdownIR(assembled);
		const normalized = normalizeMarkdownIR(ir);

		expect(normalized.type).toBe("document");
		expect(normalized.children[0]).toMatchObject({ type: "heading", depth: 1 });
		expect(normalized.children[1]).toMatchObject({ type: "paragraph" });
		expect(normalized.children[0]?.children).toEqual([
			{ type: "text", value: "Sample" },
		]);
	});

	it("maps richer AsciiDoc structures into the IR", () => {
		const assembled = [
			"== Rich sample",
			"",
			"Read https://example.com[the docs], xref:install.adoc[install guide], and image::diagram.png[Diagram,title=Architecture].",
			"",
			". Prepare release",
			".. Review changelog",
			".. Notify https://example.com[stakeholders]",
			". Publish package",
			"",
			"* Capture follow-up",
			"** Gather feedback",
			"",
			"'''",
			"",
			"NOTE: Keep _docs_ and *code* aligned.",
			"",
			"[source,ts]",
			"----",
			"const answer = 42; <1>",
			"----",
			"<1> Verify the result",
			"",
			"[quote]",
			"____",
			"Stay focused.",
			"____",
			"",
			"|===",
			"| Name | Value",
			"| Alpha | 42",
			"|===",
			"",
			"include::partial$shared.adoc[]",
		].join("\n");
		const ir = convertAssemblyToMarkdownIR(assembled, {
			sourcePath: "/virtual/project/input.adoc",
			includeResolver: (includeTarget) => {
				if (includeTarget === "partial$shared.adoc") {
					return "Included paragraph.";
				}

				return undefined;
			},
		});

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "heading", depth: 1 }),
				expect.objectContaining({ type: "paragraph" }),
				expect.objectContaining({ type: "list", ordered: true }),
				expect.objectContaining({ type: "list", ordered: false }),
				expect.objectContaining({ type: "thematicBreak" }),
				expect.objectContaining({ type: "codeBlock", language: "ts" }),
				expect.objectContaining({ type: "blockquote" }),
				expect.objectContaining({ type: "admonition", kind: "note" }),
				expect.objectContaining({ type: "table" }),
			]),
		);
		expect(ir.children[1]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					url: "install.adoc",
					target: expect.objectContaining({
						raw: "install.adoc",
						path: "install.adoc",
					}),
				}),
				expect.objectContaining({ type: "image", url: "diagram.png" }),
			]),
		});
		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "includeDirective",
					target: "partial$shared.adoc",
					provenance: expect.objectContaining({
						includingSourcePath: "/virtual/project/input.adoc",
					}),
				}),
				expect.objectContaining({
					type: "codeBlock",
					callouts: [1],
				}),
				expect.objectContaining({
					type: "calloutList",
					items: [
						expect.objectContaining({
							ordinal: 1,
						}),
					],
				}),
				expect.objectContaining({
					type: "paragraph",
					children: [{ type: "text", value: "Included paragraph." }],
				}),
			]),
		);
	});

	it("maps anchors, page aliases, aligned tables, and implicit xref labels", () => {
		const assembled = [
			":page-aliases: legacy-home, legacy-overview",
			"",
			"[[overview]]",
			"== Overview",
			"",
			"See xref:#overview[] and xref:guide/setup.adoc#details[].",
			"",
			'[cols="<,^,>"]',
			"|===",
			"| Name | Status | Value",
			"| *Alpha* | _Ready_ | `42`",
			"|===",
		].join("\n");
		const ir = convertAssemblyToMarkdownIR(assembled);

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "pageAliases",
					aliases: ["legacy-home", "legacy-overview"],
				}),
				expect.objectContaining({
					type: "anchor",
					identifier: "overview",
				}),
				expect.objectContaining({ type: "heading", depth: 1 }),
				expect.objectContaining({
					type: "table",
					align: ["left", "center", "right"],
				}),
			]),
		);
		expect(ir.children[3]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					url: "#overview",
					target: expect.objectContaining({
						raw: "#overview",
						fragment: "overview",
					}),
					children: [{ type: "text", value: "overview" }],
				}),
				expect.objectContaining({
					type: "xref",
					url: "guide/setup.adoc#details",
					target: expect.objectContaining({
						raw: "guide/setup.adoc#details",
						path: "guide/setup.adoc",
						fragment: "details",
					}),
					children: [{ type: "text", value: "details" }],
				}),
			]),
		});
	});

	it("applies include tag selection and level offsets before conversion", () => {
		const assembled = [
			"== Include features",
			"",
			"include::partials/snippet.adoc[tag=intro]",
			"",
			"include::partials/section.adoc[leveloffset=+1]",
		].join("\n");
		const ir = convertAssemblyToMarkdownIR(assembled, {
			sourcePath: "/virtual/project/input.adoc",
			includeResolver: (includeTarget) => {
				if (includeTarget === "partials/snippet.adoc") {
					return [
						"// tag::intro[]",
						"Selected introduction.",
						"// end::intro[]",
						"",
						"// tag::details[]",
						"Hidden details.",
						"// end::details[]",
					].join("\n");
				}

				if (includeTarget === "partials/section.adoc") {
					return ["== Nested section", "", "Shifted body."].join("\n");
				}

				return undefined;
			},
		});

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "paragraph",
					children: [{ type: "text", value: "Selected introduction." }],
				}),
				expect.objectContaining({
					type: "heading",
					depth: 2,
				}),
			]),
		);
		expect(ir.children).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "paragraph",
					children: [{ type: "text", value: "Hidden details." }],
				}),
			]),
		);
	});

	it("applies include line selection, indent, and multi-tag extraction", () => {
		const assembled = [
			"== Include slices",
			"",
			"include::partials/snippet.adoc[lines=2..3]",
			"",
			"include::partials/indented.adoc[indent=2]",
			"",
			"include::partials/tagged.adoc[tags=intro;details]",
		].join("\n");
		const ir = convertAssemblyToMarkdownIR(assembled, {
			sourcePath: "/virtual/project/input.adoc",
			includeResolver: (includeTarget) => {
				if (includeTarget === "partials/snippet.adoc") {
					return [
						"First line.",
						"Second line.",
						"Third line.",
						"Fourth line.",
					].join("\n");
				}
				if (includeTarget === "partials/indented.adoc") {
					return "Indented paragraph.";
				}
				if (includeTarget === "partials/tagged.adoc") {
					return [
						"// tag::intro[]",
						"Selected introduction.",
						"// end::intro[]",
						"",
						"// tag::details[]",
						"Selected details.",
						"// end::details[]",
					].join("\n");
				}

				return undefined;
			},
		});

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "includeDirective",
					attributes: { lines: "2..3" },
					semantics: {
						lineRanges: [{ start: 2, end: 3 }],
					},
				}),
				expect.objectContaining({
					type: "includeDirective",
					attributes: { indent: "2" },
					semantics: {
						indent: 2,
					},
				}),
				expect.objectContaining({
					type: "includeDirective",
					attributes: { tags: "intro;details" },
					semantics: {
						tagSelection: {
							precedence: "document-order",
							tags: ["intro", "details"],
						},
					},
				}),
				expect.objectContaining({
					type: "paragraph",
					children: [{ type: "text", value: "Second line. Third line." }],
				}),
				expect.objectContaining({
					type: "paragraph",
					children: [{ type: "text", value: "Indented paragraph." }],
				}),
			]),
		);
		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "paragraph",
					children: [
						{
							type: "text",
							value: "Selected introduction. Selected details.",
						},
					],
				}),
			]),
		);
	});

	it("captures open-ended line unions, overlapping tags, and include provenance", () => {
		const assembled = [
			"== Include edge cases",
			"",
			"include::partials/ranges.adoc[lines=..2;4..]",
			"",
			"include::partials/overlap.adoc[tags=intro;details]",
		].join("\n");
		const ir = convertAssemblyToMarkdownIR(assembled, {
			sourcePath: "/virtual/project/input.adoc",
			includeResolver: (includeTarget) => {
				if (includeTarget === "partials/ranges.adoc") {
					return [
						"First line.",
						"Second line.",
						"Third line.",
						"Fourth line.",
					].join("\n");
				}

				if (includeTarget === "partials/overlap.adoc") {
					return [
						"// tag::intro[]",
						"Selected introduction.",
						"// tag::details[]",
						"Shared detail.",
						"// end::details[]",
						"Closing intro.",
						"// end::intro[]",
					].join("\n");
				}

				return undefined;
			},
		});

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "includeDirective",
					target: "partials/ranges.adoc",
					semantics: {
						lineRanges: [{ end: 2 }, { start: 4 }],
					},
					provenance: {
						includeRootDir: "/virtual/project",
						includingSourcePath: "/virtual/project/input.adoc",
						resolvedPath: "/virtual/project/partials/ranges.adoc",
					},
				}),
				expect.objectContaining({
					type: "includeDirective",
					target: "partials/overlap.adoc",
					semantics: {
						tagSelection: {
							precedence: "document-order",
							tags: ["intro", "details"],
						},
					},
				}),
				expect.objectContaining({
					type: "paragraph",
					children: [
						{
							type: "text",
							value: "First line. Second line. Fourth line.",
						},
					],
				}),
				expect.objectContaining({
					type: "paragraph",
					children: [
						{
							type: "text",
							value: "Selected introduction. Shared detail. Closing intro.",
						},
					],
				}),
			]),
		);
	});

	it("normalizes richer Antora xref coordinates into markdown link targets", () => {
		const assembled = [
			"== Xref coordinates",
			"",
			"See xref:docs:ROOT:install.adoc[], xref:2.0@docs:ROOT:install.adoc#cli[], and xref:docs:ROOT:partial$nav.adoc[].",
		].join("\n");
		const ir = convertAssemblyToMarkdownIR(assembled);

		expect(ir.children[1]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					url: "docs/ROOT/install.adoc",
					target: expect.objectContaining({
						component: "docs",
						module: "ROOT",
						path: "install.adoc",
					}),
					children: [{ type: "text", value: "install" }],
				}),
				expect.objectContaining({
					type: "xref",
					url: "docs/2.0/ROOT/install.adoc#cli",
					target: expect.objectContaining({
						component: "docs",
						version: "2.0",
						module: "ROOT",
						path: "install.adoc",
						fragment: "cli",
					}),
					children: [{ type: "text", value: "cli" }],
				}),
				expect.objectContaining({
					type: "xref",
					url: "docs/ROOT/partial/nav.adoc",
					target: expect.objectContaining({
						component: "docs",
						module: "ROOT",
						family: "partial",
						path: "nav.adoc",
					}),
					children: [{ type: "text", value: "nav" }],
				}),
			]),
		});
	});
});
