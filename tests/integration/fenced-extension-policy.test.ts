import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";
import type { MarkdownFlavorName } from "../../src/markdown/flavor.js";
import { renderMarkdown } from "../../src/markdown/render/index.js";

const flavors: MarkdownFlavorName[] = ["gfm", "commonmark", "gitlab", "strict"];

describe("fenced extension preservation integration", () => {
	it("preserves authored language tags for valid fenced blocks in every flavor", () => {
		const document = convertAssemblyToMarkdownIR(
			[
				"== Extensions",
				"",
				"[source,mermaid]",
				"----",
				"graph TD",
				"  A --> B",
				"----",
				"",
				"[source,foobarlang]",
				"----",
				"alpha()",
				"----",
			].join("\n"),
		);

		for (const flavor of flavors) {
			const rendered = renderMarkdown(document, flavor);
			expect(rendered).toContain("```mermaid\ngraph TD\n  A --> B\n```");
			expect(rendered).toContain("```foobarlang\nalpha()\n```");
			expect(rendered).not.toContain("```text");
			expect(rendered).not.toContain("Unsupported: valid code block");
		}
	});

	it("keeps transparent fenced preservation separate from raw html and malformed fallback policy", () => {
		const htmlDocument = {
			type: "document" as const,
			children: [
				{
					type: "paragraph" as const,
					children: [
						{ type: "text" as const, value: "Press " },
						{ type: "htmlInline" as const, value: "<kbd>Ctrl</kbd>" },
						{ type: "text" as const, value: " now." },
					],
				},
			],
		};
		const malformedSource = convertAssemblyToMarkdownIR(
			["[source,mermaid]", "graph TD", "  A --> B"].join("\n"),
		);

		expect(renderMarkdown(htmlDocument, "strict")).toBe(
			"Press [Unsupported: raw HTML inline is not allowed in this flavor] now.\n",
		);
		expect(renderMarkdown(malformedSource, "gfm")).toBe(
			[
				"> Unsupported: source block fence is not closed correctly",
				"",
				"graph TD A --\\> B",
				"",
			].join("\n"),
		);
	});
});
