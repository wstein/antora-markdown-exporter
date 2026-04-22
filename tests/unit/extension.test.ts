import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createMarkdownConverter,
	renderAssemblyMarkdown,
} from "../../src/extension/index.ts";

describe("markdown exporter extension", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

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

	it("writes converted markdown to the requested output file", async () => {
		const converter = createMarkdownConverter();
		const outputRoot = await mkdtemp(join(tmpdir(), "antora-md-exporter-"));
		const outputFile = join(outputRoot, "guide.md");
		const attributes = {
			docfile: "/virtual/modules/ROOT/pages/guide.adoc",
			outdir: outputRoot,
			outfile: outputFile,
			outfilesuffix: ".html",
		};

		await converter.convert(
			{
				path: "/virtual/modules/ROOT/pages/guide.adoc",
				contents: Buffer.from(
					"= Guide\n\nSee xref:guide/setup.adoc[].",
					"utf8",
				),
			},
			attributes,
			{ dir: outputRoot },
		);

		expect(attributes.outfilesuffix).toBe(".md");
		expect(attributes.outfile).toBe(outputFile);
		await expect(readFile(outputFile, "utf8")).resolves.toBe(
			"# Guide\n\nSee [setup](guide/setup.adoc).\n\n",
		);
	});

	it("writes configured path-style xref fallback labels when requested", async () => {
		const converter = createMarkdownConverter({
			xrefFallbackLabelStyle: "fragment-or-path",
		});
		const outputRoot = await mkdtemp(join(tmpdir(), "antora-md-exporter-"));
		const outputFile = join(outputRoot, "guide.md");

		await converter.convert(
			{
				path: "/virtual/modules/ROOT/pages/guide.adoc",
				contents: Buffer.from(
					"= Guide\n\nSee xref:guide/setup.adoc[].",
					"utf8",
				),
			},
			{
				docfile: "/virtual/modules/ROOT/pages/guide.adoc",
				outdir: outputRoot,
				outfile: outputFile,
				outfilesuffix: ".html",
			},
			{ dir: outputRoot },
		);

		await expect(readFile(outputFile, "utf8")).resolves.toBe(
			"# Guide\n\nSee [guide/setup](guide/setup.adoc).\n\n",
		);
	});

	it("registers the converter through Antora assembler configuration", async () => {
		vi.resetModules();
		vi.doMock("@antora/assembler", () => ({
			configure: vi.fn(),
		}));

		const assembler = await import("@antora/assembler");
		const { register } = await import("../../src/extension/index.ts");
		const context = { name: "extension-context" };
		const navigationCatalog = {
			getNavigation: () => [],
		};

		register.call(context, {
			config: {
				flavor: "gitlab",
				configSource: { playbook: true },
				navigationCatalog,
				configFile: "antora-playbook.yml",
				xrefFallbackLabelStyle: "fragment-or-path",
			},
		});

		expect(assembler.configure).toHaveBeenCalledWith(
			context,
			expect.objectContaining({
				backend: "markdown",
				extname: ".md",
				convert: expect.any(Function),
			}),
			{ configFile: "antora-playbook.yml" },
			{
				configSource: { playbook: true },
				navigationCatalog,
			},
		);
	});
});
