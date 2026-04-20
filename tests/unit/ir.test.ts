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

	it("maps ordered and nested lists, links, code blocks, and quote blocks into the IR", () => {
		const assembled = [
			"== Rich sample",
			"",
			"Read https://example.com[the docs].",
			"",
			". Prepare release",
			".. Review changelog",
			".. Notify https://example.com[stakeholders]",
			". Publish package",
			"",
			"* Capture follow-up",
			"** Gather feedback",
			"",
			"[source,ts]",
			"----",
			"const answer = 42;",
			"----",
			"",
			"[quote]",
			"____",
			"Stay focused.",
			"____",
		].join("\n");
		const ir = convertAssemblyToMarkdownIR(assembled);

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "heading", depth: 1 }),
				expect.objectContaining({ type: "paragraph" }),
				expect.objectContaining({ type: "list", ordered: true }),
				expect.objectContaining({ type: "list", ordered: false }),
				expect.objectContaining({ type: "codeBlock", language: "ts" }),
				expect.objectContaining({ type: "blockquote" }),
			]),
		);
	});
});
