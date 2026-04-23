import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	assembleAntoraModules,
	exportAntoraModules,
	resolveAntoraMarkdownExportDefaults,
} from "../../src/index.js";

describe("module export library API", () => {
	it("publishes a stable library surface for Antora module export", async () => {
		const assembledFiles = await assembleAntoraModules({
			playbookPath: resolve("antora-playbook.yml"),
		});
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-library-export-"),
		);
		const defaults = await resolveAntoraMarkdownExportDefaults({
			playbookPath: resolve("antora-playbook.yml"),
		});

		expect(defaults).toEqual({
			flavor: "gfm",
			rootLevel: 1,
			xrefFallbackLabelStyle: "fragment-or-basename",
		});
		expect(
			assembledFiles.map((entry) => ({
				name: entry.name,
				relativePath: entry.relativePath,
				sourcePages: entry.sourcePages,
			})),
		).toEqual([
			{
				name: "documentation",
				relativePath: "documentation.adoc",
				sourcePages: ["modules/ROOT/pages/index.adoc"],
			},
			{
				name: "architecture",
				relativePath: "architecture.adoc",
				sourcePages: ["modules/architecture/pages/index.adoc"],
			},
			{
				name: "manual",
				relativePath: "manual.adoc",
				sourcePages: ["modules/manual/pages/index.adoc"],
			},
			{
				name: "onboarding",
				relativePath: "onboarding.adoc",
				sourcePages: ["modules/onboarding/pages/index.adoc"],
			},
		]);
		expect(assembledFiles[0]?.contents.toString("utf8")).toContain(
			"= Antora Markdown Exporter: Documentation",
		);

		const result = await exportAntoraModules({
			outputRoot,
			playbookPath: resolve("antora-playbook.yml"),
		});

		expect(result.flavor).toBe("gfm");
		expect(result.rootLevel).toBe(1);
		expect(result.xrefFallbackLabelStyle).toBe("fragment-or-basename");
		expect(
			result.exportedFiles.map((entry) => entry.relativeOutputPath),
		).toEqual([
			"documentation.md",
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);

		const manualMarkdown = await readFile(
			resolve(outputRoot, "manual.md"),
			"utf8",
		);
		expect(manualMarkdown).toContain("# Antora Markdown Exporter: Manual");
		expect(manualMarkdown).toContain(
			"- [Chapter 2. Core Workflows](#chapter-2-core-workflows)",
		);
	});
});
