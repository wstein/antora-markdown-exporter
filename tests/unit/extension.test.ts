import { describe, expect, it } from "vitest";
import {
	createMarkdownConverter,
	prependMarkdownTableOfContents,
	renderAssemblyMarkdown,
} from "../../src/extension/index.ts";

describe("markdown exporter extension", () => {
	it("prepends a table of contents from heading nodes", () => {
		const markdown = prependMarkdownTableOfContents(
			{
				type: "document",
				children: [
					{
						type: "heading",
						depth: 1,
						children: [{ type: "text", value: "Title" }],
					},
					{ type: "anchor", identifier: "section-one" },
					{
						type: "heading",
						depth: 1,
						children: [{ type: "text", value: "Section One" }],
					},
					{
						type: "heading",
						depth: 2,
						children: [{ type: "text", value: "Detail" }],
					},
				],
			},
			"# Title\n\n# Section One\n\n## Detail",
		);

		expect(markdown).toContain("## Table of Contents");
		expect(markdown).toContain("- [Section One](#section-one)");
		expect(markdown).toContain("  - [Detail](#detail)");
	});

	it("renders assembled markdown through the canonical converter pipeline", () => {
		const markdown = renderAssemblyMarkdown(
			[
				"= Title",
				"",
				"== Section One",
				"",
				'[cols="1,2"]',
				"|===",
				"|Key",
				"|Value",
				"",
				"|Alpha",
				"|42",
				"|===",
			].join("\n"),
		);

		expect(markdown).toContain("## Table of Contents");
		expect(markdown).toContain("- [Section One](#section-one)");
		expect(markdown).toContain("| Key | Value |");
		expect(markdown).toContain("| Alpha | 42 |");
	});

	it("creates a markdown converter with the expected metadata", () => {
		const converter = createMarkdownConverter({ flavor: "gitlab" });

		expect(converter.backend).toBe("markdown");
		expect(converter.extname).toBe(".md");
		expect(converter.mediaType).toBe("text/markdown");
	});
});
