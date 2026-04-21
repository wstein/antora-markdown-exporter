import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	createModuleNavigationCatalog,
	exportAntoraModulesToMarkdown,
	getDocumentationModuleEntries,
	parseArguments,
} from "../../scripts/export-antora-modules.ts";

describe("export antora modules script", () => {
	it("parses default arguments", () => {
		const options = parseArguments([]);

		expect(options.flavor).toBe("gfm");
		expect(options.outputRoot).toBe(resolve("build/markdown"));
		expect(options.playbookPath).toBe(resolve("antora-playbook.yml"));
	});

	it("parses explicit arguments", () => {
		const options = parseArguments([
			"--playbook",
			"tmp/playbook.yml",
			"--output-root",
			"tmp/out",
			"--flavor",
			"gitlab",
		]);

		expect(options.playbookPath).toBe(resolve("tmp/playbook.yml"));
		expect(options.outputRoot).toBe(resolve("tmp/out"));
		expect(options.flavor).toBe("gitlab");
	});

	it("extracts documentation module roots from the built navigation", () => {
		const entries = getDocumentationModuleEntries({
			name: "antora-markdown-exporter",
			version: "",
			navigation: [
				{
					items: [
						{
							content: "Documentation",
							url: "/antora-markdown-exporter/index.html",
						},
					],
				},
				{
					items: [
						{
							content: "Architecture",
							url: "/antora-markdown-exporter/architecture/index.html",
						},
					],
				},
				{
					items: [
						{
							content: "Manual",
							url: "/antora-markdown-exporter/manual/index.html",
						},
					],
				},
				{
					items: [
						{
							content: "Onboarding",
							url: "/antora-markdown-exporter/onboarding/index.html",
						},
					],
				},
			],
		});

		expect(entries.map((entry) => entry.moduleName)).toEqual([
			"architecture",
			"manual",
			"onboarding",
		]);
	});

	it("creates a module-scoped navigation override for assembler", () => {
		const componentVersion = {
			name: "antora-markdown-exporter",
			version: "",
			navigation: [],
		};
		const architectureNavigation = {
			content: "Architecture",
			url: "/antora-markdown-exporter/architecture/index.html",
		};
		const navigationCatalog = createModuleNavigationCatalog(
			componentVersion,
			architectureNavigation,
		);

		expect(
			navigationCatalog.getNavigation("antora-markdown-exporter", ""),
		).toEqual([architectureNavigation]);
		expect(navigationCatalog.getNavigation("other", "")).toEqual([]);
	});

	it("exports assembled markdown modules through antora and assembler", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-export-"),
		);
		const exportedFiles = await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			outputRoot,
			playbookPath: resolve("antora-playbook.yml"),
		});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);

		const architectureMarkdown = await readFile(
			resolve(outputRoot, "architecture.md"),
			"utf8",
		);
		expect(architectureMarkdown).toContain("## Table of Contents");
		expect(architectureMarkdown).toContain(
			"- [Chapter 1. Introduction and Goals](#",
		);
		expect(architectureMarkdown).toContain(
			"# Chapter 2. Architecture Constraints",
		);
		expect(architectureMarkdown).toContain(
			"| 1 | Deterministic, reviewable output |",
		);
		expect(architectureMarkdown).not.toContain(":doctype:");
		expect(architectureMarkdown).not.toContain(":page-component-name:");

		const manualMarkdown = await readFile(
			resolve(outputRoot, "manual.md"),
			"utf8",
		);
		expect(manualMarkdown).toContain("## Table of Contents");
		expect(manualMarkdown).toContain("- [Core Workflows](#");
	});
});
