import { execFileSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	exportAntoraModulesToMarkdown,
	parseArguments,
	resolveExportAntoraModulesOptions,
} from "../../scripts/export-antora-modules.ts";

describe("export antora modules script", () => {
	it("parses default arguments", () => {
		const options = parseArguments([]);

		expect(options.flavor).toBeUndefined();
		expect(options.format).toBe("human");
		expect(options.outputRoot).toBe(resolve("build/markdown"));
		expect(options.playbookPath).toBe(resolve("antora-playbook.yml"));
		expect(options.rootLevel).toBeUndefined();
	});

	it("parses explicit arguments", () => {
		const options = parseArguments([
			"--playbook",
			"tmp/playbook.yml",
			"--output-root",
			"tmp/out",
			"--flavor",
			"gitlab",
			"--root-level",
			"0",
			"--json",
		]);

		expect(options.playbookPath).toBe(resolve("tmp/playbook.yml"));
		expect(options.outputRoot).toBe(resolve("tmp/out"));
		expect(options.flavor).toBe("gitlab");
		expect(options.format).toBe("json");
		expect(options.rootLevel).toBe(0);
	});

	it("accepts multimarkdown as an explicit export flavor", () => {
		const options = parseArguments(["--flavor", "multimarkdown"]);

		expect(options.flavor).toBe("multimarkdown");
	});

	it("keeps flavor unset until Antora-owned defaults are resolved", () => {
		const options = parseArguments(["--output-root", "tmp/out"]);

		expect(options.flavor).toBeUndefined();
	});

	it("uses multimarkdown for the dedicated package-task mode", () => {
		const options = parseArguments(["--package-task-markdown"]);

		expect(options.flavor).toBeUndefined();
		expect(options.packageTaskMarkdown).toBe(true);
	});

	it("lets explicit flavor arguments override the package-task markdown mode", () => {
		const options = parseArguments([
			"--package-task-markdown",
			"--flavor",
			"gfm",
		]);

		expect(options.flavor).toBe("gfm");
		expect(options.packageTaskMarkdown).toBe(true);
	});

	it("resolves exporter defaults from playbook and assembler config", async () => {
		const options = await resolveExportAntoraModulesOptions(parseArguments([]));

		expect(options.flavor).toBe("gfm");
		expect(options.rootLevel).toBe(1);
	});

	it("lets the package-task markdown mode override config-owned flavor defaults", async () => {
		const options = await resolveExportAntoraModulesOptions(
			parseArguments(["--package-task-markdown"]),
		);

		expect(options.flavor).toBe("multimarkdown");
		expect(options.rootLevel).toBe(1);
	});

	it("exports one assembled markdown document per Antora root-level assembly", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-export-"),
		);
		const { exportedFiles, reviewBundleFiles, reviewBundleRoot } =
			await exportAntoraModulesToMarkdown({
				flavor: "gfm",
				outputRoot,
				packageTaskMarkdown: false,
				playbookPath: resolve("antora-playbook.yml"),
				rootLevel: 1,
			});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"documentation.md",
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);
		expect(reviewBundleRoot).toBe(resolve(outputRoot, "review-bundle"));
		expect(reviewBundleFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			".github/workflows/release.yml",
			".github/workflows/pages.yml",
		]);

		const documentationMarkdown = await readFile(
			resolve(outputRoot, "documentation.md"),
			"utf8",
		);
		expect(documentationMarkdown).toContain(
			"# Antora Markdown Exporter: Documentation",
		);
		expect(documentationMarkdown).toContain("Antora Markdown Exporter");

		const architectureMarkdown = await readFile(
			resolve(outputRoot, "architecture.md"),
			"utf8",
		);
		expect(architectureMarkdown).toContain("## Table of Contents");
		expect(architectureMarkdown).toContain(
			"- [Chapter 1. Introduction and Goals](#chapter-1-introduction-and-goals)",
		);
		expect(architectureMarkdown).toContain(
			"# Chapter 2. Architecture Constraints",
		);
		expect(architectureMarkdown).toContain("The main building blocks are:");
		expect(architectureMarkdown).not.toContain(
			'<a id="architecture:index"></a>',
		);
		expect(architectureMarkdown).not.toContain(
			'<a id="section-introduction-and-goals"></a>',
		);

		const manualMarkdown = await readFile(
			resolve(outputRoot, "manual.md"),
			"utf8",
		);
		expect(manualMarkdown).toContain(
			"- [Chapter 1. Reader Split](#chapter-1-reader-split)",
		);
		expect(manualMarkdown).toContain(
			"- [Chapter 2. Core Workflows](#chapter-2-core-workflows)",
		);
		expect(manualMarkdown).toContain("1. Install dependencies:");
		expect(manualMarkdown).not.toContain("\n+\n");

		const onboardingMarkdown = await readFile(
			resolve(outputRoot, "onboarding.md"),
			"utf8",
		);
		expect(onboardingMarkdown).toContain(
			"- [Chapter 1. Start Here](#chapter-1-start-here)",
		);
		expect(onboardingMarkdown).toContain("# Chapter 2. Mental Models");
		expect(onboardingMarkdown).toContain(
			"You do not need that model to get started.",
		);
	});

	it("prints a human-readable summary by default", () => {
		const output = execFileSync(
			"bun",
			["scripts/export-antora-modules.ts", "--output-root", "build/markdown"],
			{
				cwd: resolve(__dirname, "../.."),
				encoding: "utf8",
			},
		);

		expect(output).toContain(
			"Exported 4 documentation modules as gfm Markdown.",
		);
		expect(output).toContain("Assembly root level: 1");
		expect(output).toContain("Review bundle:");
		expect(output).toContain("- review bundle: .github/workflows/release.yml");
		expect(output).toContain("- review bundle: .github/workflows/pages.yml");
		expect(output).toContain("- documentation: documentation.md");
		expect(output).toContain("- architecture: architecture.md");
		expect(output).toContain("- manual: manual.md");
		expect(output).toContain("- onboarding: onboarding.md");
		expect(output.trim().startsWith("{")).toBe(false);
	});

	it("emits JSON only when requested explicitly", () => {
		const output = execFileSync(
			"bun",
			[
				"scripts/export-antora-modules.ts",
				"--output-root",
				"build/markdown",
				"--json",
			],
			{
				cwd: resolve(__dirname, "../.."),
				encoding: "utf8",
			},
		);
		const result = JSON.parse(output) as {
			count: number;
			flavor: string;
			files: { moduleName: string; outputPath: string }[];
			reviewBundleFiles: { outputPath: string }[];
			reviewBundleRoot: string;
			rootLevel: number;
		};

		expect(result.count).toBe(4);
		expect(result.flavor).toBe("gfm");
		expect(result.reviewBundleRoot).toBe(
			resolve("build/markdown/review-bundle"),
		);
		expect(result.reviewBundleFiles).toEqual([
			{ outputPath: ".github/workflows/release.yml" },
			{ outputPath: ".github/workflows/pages.yml" },
		]);
		expect(result.rootLevel).toBe(1);
		expect(result.files).toEqual([
			{ moduleName: "documentation", outputPath: "documentation.md" },
			{ moduleName: "architecture", outputPath: "architecture.md" },
			{ moduleName: "manual", outputPath: "manual.md" },
			{ moduleName: "onboarding", outputPath: "onboarding.md" },
		]);
	});

	it("keeps multimarkdown module exports free of source-style antora xref destinations", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-export-"),
		);
		await exportAntoraModulesToMarkdown({
			flavor: "multimarkdown",
			outputRoot,
			packageTaskMarkdown: true,
			playbookPath: resolve("antora-playbook.yml"),
			rootLevel: 1,
		});

		const manualMarkdown = await readFile(
			resolve(outputRoot, "manual.md"),
			"utf8",
		);

		expect(manualMarkdown).not.toContain(".adoc)");
		expect(manualMarkdown).not.toContain("ROOT:");
		expect(manualMarkdown).not.toContain("page$");
	});

	it("emits a single combined export when root level 0 is requested", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-export-"),
		);
		const { exportedFiles } = await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			outputRoot,
			packageTaskMarkdown: false,
			playbookPath: resolve("antora-playbook.yml"),
			rootLevel: 0,
		});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"index.md",
		]);
	});
});
