import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	addMarkdownTableOfContents,
	cleanRenderedMarkdown,
	exportAntoraModulesToMarkdown,
	getAntoraModuleIndexPath,
	getAntoraModuleRoot,
	getExportableModuleNames,
	mapAntoraModuleToMarkdownPath,
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

	it("adds a markdown table of contents from rendered headings", () => {
		expect(
			addMarkdownTableOfContents(
				'# Title\n\n<a id="section-one"></a>\n\n# Section One\n\n## Detail\n',
			),
		).toContain(
			[
				"## Table of Contents",
				"",
				"- [Section One](#section-one)",
				"  - [Detail](#detail)",
			].join("\n"),
		);
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

	it("exposes the supported module names", () => {
		expect(getExportableModuleNames()).toEqual([
			"architecture",
			"manual",
			"onboarding",
		]);
	});

	it("maps antora modules to flat markdown paths", () => {
		const mapping = mapAntoraModuleToMarkdownPath(
			resolve("/repo/build/markdown"),
			"manual",
		);

		expect(mapping.relativeInputPath).toBe("manual/pages/index.adoc");
		expect(mapping.relativeOutputPath).toBe("manual.md");
		expect(mapping.outputPath).toBe(resolve("/repo/build/markdown/manual.md"));
	});

	it("finds the antora module root and index path", () => {
		expect(
			getAntoraModuleRoot(resolve("/repo/docs/modules"), "architecture"),
		).toBe(resolve("/repo/docs/modules/architecture"));
		expect(
			getAntoraModuleIndexPath(resolve("/repo/docs/modules"), "architecture"),
		).toBe(resolve("/repo/docs/modules/architecture/pages/index.adoc"));
	});

	it("exports one markdown file per antora module", async () => {
		const root = await mkdtemp(resolve(tmpdir(), "antora-module-export-"));
		const modulesRoot = resolve(root, "modules");
		const outputRoot = resolve(root, "markdown");

		for (const moduleName of getExportableModuleNames()) {
			await mkdir(resolve(modulesRoot, moduleName, "pages"), {
				recursive: true,
			});
			await writeFile(
				resolve(modulesRoot, moduleName, "pages/index.adoc"),
				`= ${moduleName}\n\n== Section\n\nBody for ${moduleName}.\n`,
			);
		}

		const exportedFiles = await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			modulesRoot,
			outputRoot,
		});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);

		const manualMarkdown = await readFile(
			resolve(outputRoot, "manual.md"),
			"utf8",
		);
		expect(manualMarkdown).toContain("# manual");
		expect(manualMarkdown).toContain("## Table of Contents");
		expect(manualMarkdown).toContain("- [Section](#section)");
		expect(manualMarkdown).toContain("Body for manual.");
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
		await mkdir(resolve(modulesRoot, "manual/pages"), { recursive: true });
		await mkdir(resolve(modulesRoot, "onboarding/pages"), { recursive: true });

		await writeFile(
			resolve(modulesRoot, "architecture/partials/section.adoc"),
			"== Included Section\n\nBody text.\n",
		);
		await writeFile(
			resolve(modulesRoot, "architecture/pages/index.adoc"),
			"= Architecture\n\ninclude::partial$section.adoc[]\n",
		);
		await writeFile(
			resolve(modulesRoot, "manual/pages/index.adoc"),
			"= Manual\n\nBody.\n",
		);
		await writeFile(
			resolve(modulesRoot, "onboarding/pages/index.adoc"),
			"= Onboarding\n\nBody.\n",
		);

		await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			modulesRoot,
			outputRoot,
		});

		const markdown = await readFile(
			resolve(outputRoot, "architecture.md"),
			"utf8",
		);
		expect(markdown).toContain("# Included Section");
		expect(markdown).toContain("Body text.");
		expect(markdown).not.toContain("Unsupported: include directive");
		expect(markdown).not.toContain("md-ir-include");
	});
});
