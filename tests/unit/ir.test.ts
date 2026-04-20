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
				expect.objectContaining({ type: "link", url: "install.adoc" }),
				expect.objectContaining({ type: "image", url: "diagram.png" }),
			]),
		});
		expect(ir.children).toEqual(
			expect.arrayContaining([
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
					type: "link",
					url: "#overview",
					children: [{ type: "text", value: "overview" }],
				}),
				expect.objectContaining({
					type: "link",
					url: "guide/setup.adoc#details",
					children: [{ type: "text", value: "details" }],
				}),
			]),
		});
	});
});
