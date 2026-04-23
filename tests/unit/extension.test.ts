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
			"# Guide\n\nSee [setup](guide/setup.md).\n\n",
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
			"# Guide\n\nSee [guide/setup](guide/setup.md).\n\n",
		);
	});

	it("keeps standalone markdown conversion working without exporter-owned relinking", () => {
		const markdown = renderAssemblyMarkdown(
			"= Guide\n\nSee xref:guide/setup.adoc[].",
			"gfm",
			"guide.adoc",
			{
				attributes: {
					"site-url": "https://example.invalid",
				},
			},
		);

		expect(markdown).toBe("# Guide\n\nSee [setup](guide/setup.html).\n");
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

	it("defaults assembler config to root_level 1 when no config source is provided", async () => {
		vi.resetModules();
		vi.doMock("@antora/assembler", () => ({
			configure: vi.fn(),
		}));

		const assembler = await import("@antora/assembler");
		const { register } = await import("../../src/extension/index.ts");
		const context = { name: "extension-context" };

		register.call(context, {
			config: {},
		});

		expect(assembler.configure).toHaveBeenCalledWith(
			context,
			expect.objectContaining({
				backend: "markdown",
				extname: ".md",
			}),
			{},
			{
				configSource: {
					assembly: {
						root_level: 1,
					},
				},
				navigationCatalog: undefined,
			},
		);
	});

	it("derives converter defaults from object config sources", async () => {
		vi.resetModules();
		vi.doMock("@antora/assembler", () => ({
			configure: vi.fn(),
		}));

		const assembler = await import("@antora/assembler");
		const { register } = await import("../../src/extension/index.ts");
		const context = { name: "extension-context" };

		register.call(context, {
			config: {
				configSource: {
					assembly: {
						root_level: 0,
						attributes: {
							"markdown-exporter-flavor": "multimarkdown",
							"markdown-exporter-xref-fallback-label-style": "fragment-or-path",
						},
					},
				},
			},
		});
		const converter = vi.mocked(assembler.configure).mock.calls[0]?.[1];
		expect(converter).toBeDefined();

		const outputRoot = await mkdtemp(join(tmpdir(), "antora-md-exporter-"));
		const outputFile = join(outputRoot, "guide.md");

		await converter?.convert(
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

		expect(assembler.configure).toHaveBeenCalledWith(
			context,
			expect.objectContaining({
				backend: "markdown",
				extname: ".md",
				convert: expect.any(Function),
			}),
			{},
			{
				configSource: {
					assembly: {
						root_level: 0,
						attributes: {
							"markdown-exporter-flavor": "multimarkdown",
							"markdown-exporter-xref-fallback-label-style": "fragment-or-path",
						},
					},
				},
				navigationCatalog: undefined,
			},
		);
		await expect(readFile(outputFile, "utf8")).resolves.toContain(
			"See [guide/setup](guide/setup.md).",
		);
	});

	it("reads exporter defaults from asciidoc attributes and keeps string config sources intact", async () => {
		vi.resetModules();
		vi.doMock("@antora/assembler", () => ({
			configure: vi.fn(),
		}));

		const assembler = await import("@antora/assembler");
		const { register } = await import("../../src/extension/index.ts");
		const context = { name: "extension-context" };

		register.call(context, {
			config: {
				configSource: "antora-playbook.yml",
				rootLevel: 0,
			},
		});

		expect(assembler.configure).toHaveBeenNthCalledWith(
			1,
			context,
			expect.objectContaining({
				backend: "markdown",
				extname: ".md",
			}),
			{},
			{
				configSource: "antora-playbook.yml",
				navigationCatalog: undefined,
			},
		);

		register.call(context, {
			config: {
				rootLevel: 1,
				configSource: {
					asciidoc: {
						attributes: {
							"markdown-exporter-flavor": "strict",
							"markdown-exporter-xref-fallback-label-style": "fragment-or-path",
						},
					},
				},
			},
		});

		const converter = vi.mocked(assembler.configure).mock.calls[1]?.[1];
		expect(assembler.configure).toHaveBeenNthCalledWith(
			2,
			context,
			expect.objectContaining({
				backend: "markdown",
				extname: ".md",
				convert: expect.any(Function),
			}),
			{},
			{
				configSource: {
					asciidoc: {
						attributes: {
							"markdown-exporter-flavor": "strict",
							"markdown-exporter-xref-fallback-label-style": "fragment-or-path",
						},
					},
					assembly: {
						root_level: 1,
					},
				},
				navigationCatalog: undefined,
			},
		);

		const outputRoot = await mkdtemp(join(tmpdir(), "antora-md-exporter-"));
		const outputFile = join(outputRoot, "guide.md");

		await converter?.convert(
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

		await expect(readFile(outputFile, "utf8")).resolves.toContain(
			"See [guide/setup](guide/setup.md).",
		);
	});

	it("keeps nested xref destinations unchanged across structured markdown blocks", async () => {
		const converter = createMarkdownConverter();
		const outputRoot = await mkdtemp(join(tmpdir(), "antora-md-exporter-"));
		const outputFile = join(outputRoot, "guide.md");

		await converter.convert(
			{
				path: "/virtual/modules/ROOT/pages/guide.adoc",
				contents: Buffer.from(
					[
						"= Guide",
						"",
						"Term:: xref:term.adoc[_Term_]",
						"",
						"image:diagram.svg[Diagram]",
						"",
						'[cols="1"]',
						"|===",
						"|xref:table.adoc[Table]",
						"|===",
						"",
						"[source,js]",
						"----",
						"const n = 1 // <1>",
						"----",
						"<1> xref:callout.adoc[Callout]",
						"",
						"footnote:[xref:footnote.adoc[Footnote]]",
					].join("\n"),
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
			[
				"# Guide",
				"",
				"**Term:** [*Term*](term.md)",
				"",
				"![Diagram](diagram.svg)",
				"",
				"| [Table](table.md) |",
				"| --- |",
				"",
				"```js",
				"const n = 1 // <1>",
				"```",
				"",
				"1. [Callout](callout.md)",
				"",
				"[^1]",
				"",
				"[^1]: [Footnote](footnote.md)",
				"",
				"",
			].join("\n"),
		);
	});
});
