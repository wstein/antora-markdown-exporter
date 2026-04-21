import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	collectAntoraPageFiles,
	exportAntoraModulesToMarkdown,
	mapAntoraPageToMarkdownPath,
	parseArguments,
} from "../../scripts/export-antora-modules.ts";

describe("export antora modules script", () => {
	it("parses default arguments", () => {
		const options = parseArguments([]);

		expect(options.flavor).toBe("gfm");
		expect(options.modulesRoot).toBe(resolve("docs/modules"));
		expect(options.outputRoot).toBe(resolve("build/markdown"));
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
});
