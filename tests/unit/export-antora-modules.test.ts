import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	cleanRenderedMarkdown,
	collectAntoraPageFiles,
	exportAntoraModulesToMarkdown,
	getAntoraModuleRootForPage,
	mapAntoraPageToMarkdownPath,
	parseArguments,
	sanitizeAntoraPageSource,
} from "../../scripts/export-antora-modules.ts";

describe("export antora modules script", () => {
	it("parses default arguments", () => {
		const options = parseArguments([]);

		expect(options.flavor).toBe("gfm");
		expect(options.modulesRoot).toBe(resolve("docs/modules"));
		expect(options.outputRoot).toBe(resolve("build/markdown"));
	});

	it("removes export-only asciidoc control lines from page sources", () => {
		expect(
			sanitizeAntoraPageSource(
				"= Title\n:toc:\n// comment\n<<<<\nBody\nifndef::revnumber[:revnumber: n/a]\n",
			),
		).toBe("= Title\nBody\n");
	});

	it("removes include marker artifacts from rendered markdown", () => {
		expect(
			cleanRenderedMarkdown(
				'Intro\n\\<!-- md-ir-include {"target":"partial$section.adoc"} --\\>\n> Unsupported: include directive is not yet inlined: include::partial$section.adoc[]\n\\[options="header"]\n\\***\\<Diagram or Table\\>**\\*\n\nBody\n',
			),
		).toBe("Intro\n\nBody");
	});

	it("parses explicit arguments", () => {
		const options = parseArguments([
			"--modules-root",
			"fixtures/modules",
			"--output-root",
			"tmp/out",
			"--flavor",
			"gitlab",
		]);

		expect(options.modulesRoot).toBe(resolve("fixtures/modules"));
		expect(options.outputRoot).toBe(resolve("tmp/out"));
		expect(options.flavor).toBe("gitlab");
	});

	it("maps antora pages to markdown paths", () => {
		const mapping = mapAntoraPageToMarkdownPath(
			resolve("/repo/docs/modules"),
			resolve("/repo/build/markdown"),
			resolve("/repo/docs/modules/manual/pages/index.adoc"),
		);

		expect(mapping.relativeInputPath).toBe("manual/pages/index.adoc");
		expect(mapping.relativeOutputPath).toBe("manual/pages/index.md");
		expect(mapping.outputPath).toBe(
			resolve("/repo/build/markdown/manual/pages/index.md"),
		);
	});

	it("finds the antora module root for a page", () => {
		expect(
			getAntoraModuleRootForPage(
				resolve("/repo/docs/modules/architecture/pages/index.adoc"),
			),
		).toBe(resolve("/repo/docs/modules/architecture"));
	});

	it("collects only antora page files", async () => {
		const root = await mkdtemp(resolve(tmpdir(), "antora-modules-"));
		const modulesRoot = resolve(root, "modules");
		await mkdir(resolve(modulesRoot, "guide/pages"), { recursive: true });
		await mkdir(resolve(modulesRoot, "guide/partials"), { recursive: true });
		await writeFile(
			resolve(modulesRoot, "guide/pages/index.adoc"),
			"= Guide\n",
		);
		await writeFile(
			resolve(modulesRoot, "guide/partials/snippet.adoc"),
			"ignored",
		);

		const files = await collectAntoraPageFiles(modulesRoot);

		expect(files).toEqual([resolve(modulesRoot, "guide/pages/index.adoc")]);
	});

	it("exports antora pages to markdown using the repository pipeline", async () => {
		const root = await mkdtemp(resolve(tmpdir(), "antora-export-"));
		const modulesRoot = resolve(root, "modules");
		const outputRoot = resolve(root, "markdown");

		await mkdir(resolve(modulesRoot, "guide/pages"), { recursive: true });
		await mkdir(resolve(modulesRoot, "guide/partials"), { recursive: true });
		await writeFile(
			resolve(modulesRoot, "guide/partials/snippet.adoc"),
			"Included line.\n",
		);
		await writeFile(
			resolve(modulesRoot, "guide/pages/index.adoc"),
			"= Guide\n\ninclude::../partials/snippet.adoc[]\n\n== Next Steps\n\nSee xref:other.adoc[other].\n",
		);
		await writeFile(
			resolve(modulesRoot, "guide/pages/other.adoc"),
			"= Other\n\nHello.\n",
		);

		const exportedFiles = await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			modulesRoot,
			outputRoot,
		});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"guide/pages/index.md",
			"guide/pages/other.md",
		]);

		const markdown = await readFile(
			resolve(outputRoot, "guide/pages/index.md"),
			"utf8",
		);
		expect(markdown).toContain("# Guide");
		expect(markdown).toContain("Included line.");
		expect(markdown).toContain("[other](other.adoc)");
	});

	it("resolves antora partial includes from the module root", async () => {
		const root = await mkdtemp(resolve(tmpdir(), "antora-partial-export-"));
		const modulesRoot = resolve(root, "modules");
		const outputRoot = resolve(root, "markdown");

		await mkdir(resolve(modulesRoot, "architecture/pages"), {
			recursive: true,
		});
		await mkdir(resolve(modulesRoot, "architecture/partials"), {
			recursive: true,
		});
		await writeFile(
			resolve(modulesRoot, "architecture/partials/section.adoc"),
			"== Included Section\n\nBody text.\n",
		);
		await writeFile(
			resolve(modulesRoot, "architecture/pages/index.adoc"),
			"= Architecture\n\ninclude::partial$section.adoc[]\n",
		);

		await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			modulesRoot,
			outputRoot,
		});

		const markdown = await readFile(
			resolve(outputRoot, "architecture/pages/index.md"),
			"utf8",
		);
		expect(markdown).toContain("# Included Section");
		expect(markdown).toContain("Body text.");
		expect(markdown).not.toContain("Unsupported: include directive");
		expect(markdown).not.toContain("md-ir-include");
	});
});
