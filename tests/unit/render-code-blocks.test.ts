import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/markdown/render/index.js";

describe("code block rendering", () => {
	it("preserves authored fenced language tags verbatim", () => {
		const document = {
			type: "document" as const,
			children: [
				{
					type: "codeBlock" as const,
					language: "mermaid",
					value: "graph TD\n  A --> B",
				},
				{
					type: "codeBlock" as const,
					language: "foobarlang",
					value: "alpha()",
				},
				{
					type: "codeBlock" as const,
					value: "plain fence",
				},
			],
		};

		expect(renderMarkdown(document, "gfm")).toBe(
			[
				"```mermaid",
				"graph TD",
				"  A --> B",
				"```",
				"",
				"```foobarlang",
				"alpha()",
				"```",
				"",
				"```",
				"plain fence",
				"```",
				"",
			].join("\n"),
		);
		expect(renderMarkdown(document, "strict")).toContain("```mermaid");
		expect(renderMarkdown(document, "strict")).toContain("```foobarlang");
		expect(renderMarkdown(document, "strict")).toContain(
			"```\nplain fence\n```",
		);
	});
});
