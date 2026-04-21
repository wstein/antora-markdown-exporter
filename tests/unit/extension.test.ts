import { describe, expect, it } from "vitest";
import {
	createMarkdownConverter,
	renderAssemblyMarkdown,
} from "../../src/extension/index.ts";

describe("markdown exporter extension", () => {
	it("renders assembled markdown through the canonical converter pipeline", () => {
		const markdown = renderAssemblyMarkdown(
			[
				"= Title",
				":doctype: book",
				":toc:",
				":toclevels: 2",
				":numbered:",
				"",
				"== Section One",
				"",
				"=== Detail",
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
		expect(markdown).toContain(
			"- [Chapter 1. Section One](#chapter-1-section-one)",
		);
		expect(markdown).toContain("  - [1.1. Detail](#11-detail)");
		expect(markdown).toContain("# Title");
		expect(markdown).toContain("# Chapter 1. Section One");
		expect(markdown).toContain("## 1.1. Detail");
		expect(markdown).toContain("| Key | Value |");
		expect(markdown).toContain("| Alpha | 42 |");
	});

	it("keeps list continuations and labeled groups semantic in rendered markdown", () => {
		const markdown = renderAssemblyMarkdown(
			[
				"= Manual",
				":toc:",
				":sectnums:",
				"",
				"== Core Workflows",
				"",
				". Install dependencies:",
				"+",
				"[source,bash]",
				"----",
				"make install",
				"----",
				"",
				"Motivation::",
				"",
				"The converter should emit final Markdown.",
			].join("\n"),
		);

		expect(markdown).toContain("1. Install dependencies:");
		expect(markdown).toContain("```bash");
		expect(markdown).not.toContain("\n+\n");
		expect(markdown).toContain(
			"**Motivation:** The converter should emit final Markdown.",
		);
	});

	it("creates a markdown converter with the expected metadata", () => {
		const converter = createMarkdownConverter({ flavor: "gitlab" });

		expect(converter.backend).toBe("markdown");
		expect(converter.extname).toBe(".md");
		expect(converter.mediaType).toBe("text/markdown");
	});
});
