import { describe, expect, it } from "vitest";
import {
	convertAssemblyStructureToMarkdownIR,
	extractAssemblyStructure,
} from "../../src/index.js";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";

function toIr(source: string, sourcePath = "/virtual/project/input.adoc") {
	return convertAssemblyStructureToMarkdownIR(
		extractAssemblyStructure(source, { sourcePath }),
	);
}

describe("Markdown IR boundary", () => {
	it("converts structured assembled content into a document IR", () => {
		const normalized = normalizeMarkdownIR(toIr("== Sample\nHello world."));

		expect(normalized.type).toBe("document");
		expect(normalized.children[0]).toMatchObject({ type: "heading", depth: 1 });
		expect(normalized.children[1]).toMatchObject({ type: "paragraph" });
		expect(normalized.children[0]?.children).toEqual([
			{ type: "text", value: "Sample" },
		]);
	});

	it("maps richer supported structures into the IR", () => {
		const ir = toIr(
			[
				":page-aliases: legacy-home, legacy-overview",
				"",
				"[[overview]]",
				"== Overview",
				"",
				"See xref:install.adoc#cli[install], https://example.com[docs], and image:diagram.png[Diagram,title=Architecture].",
				"",
				". Prepare release",
				".. Review changelog",
				". Publish package",
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
				'[cols="<,^,>"]',
				"|===",
				"| Name | Status | Value",
				"| *Alpha* | _Ready_ | `42`",
				"|===",
			].join("\n"),
		);

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "pageAliases",
					aliases: ["legacy-home", "legacy-overview"],
				}),
				expect.objectContaining({
					type: "heading",
					depth: 1,
					identifier: "overview",
				}),
				expect.objectContaining({ type: "paragraph" }),
				expect.objectContaining({ type: "list", ordered: true }),
				expect.objectContaining({ type: "thematicBreak" }),
				expect.objectContaining({ type: "admonition", kind: "note" }),
				expect.objectContaining({ type: "codeBlock", language: "ts" }),
				expect.objectContaining({ type: "calloutList" }),
				expect.objectContaining({ type: "blockquote" }),
				expect.objectContaining({
					type: "table",
					align: ["left", "center", "right"],
				}),
			]),
		);
	});

	it("keeps xref targets structured until render-time lowering", () => {
		const ir = toIr(
			[
				"== Xref coordinates",
				"",
				"See xref:install.adoc[], xref:install.adoc#cli[], and xref:#local[].",
				"",
				"[[local]]",
				"Paragraph.",
			].join("\n"),
		);

		expect(ir.children[1]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					url: "install.html",
					target: expect.objectContaining({
						raw: "install.html",
						path: "install.html",
					}),
				}),
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
					type: "xref",
					url: "#local",
					target: expect.objectContaining({
						raw: "#local",
						path: "",
						fragment: "local",
					}),
				}),
			]),
		});
	});

	it("normalizes structured inline and block semantics without the legacy parser", () => {
		const normalized = normalizeMarkdownIR(
			toIr(
				[
					"= Manual",
					"",
					"== Core Workflows",
					"",
					"Motivation::",
					"",
					"The converter should emit final Markdown.",
				].join("\n"),
			),
		);

		expect(normalized.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
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
				}),
			]),
		);
	});
});
