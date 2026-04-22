import { execFileSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	exportAntoraModulesToMarkdown,
	parseArguments,
} from "../../scripts/export-antora-modules.ts";

describe("export antora modules script", () => {
	it("parses default arguments", () => {
		const options = parseArguments([]);

		expect(options.flavor).toBe("gfm");
		expect(options.format).toBe("human");
		expect(options.outputRoot).toBe(resolve("build/markdown"));
		expect(options.playbookPath).toBe(resolve("antora-playbook.yml"));
		expect(options.xrefFallbackLabelStyle).toBe("fragment-or-basename");
	});

	it("parses explicit arguments", () => {
		const options = parseArguments([
			"--playbook",
			"tmp/playbook.yml",
			"--output-root",
			"tmp/out",
			"--flavor",
			"gitlab",
			"--xref-fallback-label-style",
			"fragment-or-path",
			"--json",
		]);

		expect(options.playbookPath).toBe(resolve("tmp/playbook.yml"));
		expect(options.outputRoot).toBe(resolve("tmp/out"));
		expect(options.flavor).toBe("gitlab");
		expect(options.format).toBe("json");
		expect(options.xrefFallbackLabelStyle).toBe("fragment-or-path");
	});

	it("accepts multimarkdown as an explicit export flavor", () => {
		const options = parseArguments(["--flavor", "multimarkdown"]);

		expect(options.flavor).toBe("multimarkdown");
	});

	it("keeps gfm as the script default when flavor is not specified", () => {
		const options = parseArguments(["--output-root", "tmp/out"]);

		expect(options.flavor).toBe("gfm");
	});

	it("accepts a package-task default flavor from the environment", () => {
		const previous = process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR;
		process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR = "multimarkdown";

		try {
			const options = parseArguments(["--output-root", "tmp/out"]);
			expect(options.flavor).toBe("multimarkdown");
		} finally {
			if (previous === undefined) {
				delete process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR;
			} else {
				process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR = previous;
			}
		}
	});

	it("lets explicit flavor arguments override the package-task default", () => {
		const previous = process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR;
		process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR = "multimarkdown";

		try {
			const options = parseArguments(["--flavor", "gfm"]);
			expect(options.flavor).toBe("gfm");
		} finally {
			if (previous === undefined) {
				delete process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR;
			} else {
				process.env.ANTORA_MARKDOWN_EXPORT_DEFAULT_FLAVOR = previous;
			}
		}
	});

	it("exports one assembled markdown document per documentation module", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-export-"),
		);
		const { exportedFiles, reviewBundleFiles, reviewBundleRoot } =
			await exportAntoraModulesToMarkdown({
				flavor: "gfm",
				outputRoot,
				playbookPath: resolve("antora-playbook.yml"),
				xrefFallbackLabelStyle: "fragment-or-basename",
			});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);
		expect(reviewBundleRoot).toBe(resolve(outputRoot, "review-bundle"));
		expect(reviewBundleFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			".github/workflows/release.yml",
			".github/workflows/pages.yml",
		]);

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
			"- [Chapter 1. Core Workflows](#chapter-1-core-workflows)",
		);
		expect(manualMarkdown).toContain("1. Install dependencies:");
		expect(manualMarkdown).not.toContain("\n+\n");

		const onboardingMarkdown = await readFile(
			resolve(outputRoot, "onboarding.md"),
			"utf8",
		);
		expect(onboardingMarkdown).toContain(
			"- [Chapter 1. Reading Status Markers](#chapter-1-reading-status-markers)",
		);
		expect(onboardingMarkdown).toContain("# Chapter 2. Mental Models");
		expect(onboardingMarkdown).toContain(
			"support matrix, proof matrix, and evidence ledger",
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
			"Exported 3 documentation modules as gfm Markdown.",
		);
		expect(output).toContain("Review bundle:");
		expect(output).toContain("Xref fallback labels: fragment-or-basename");
		expect(output).toContain("- review bundle: .github/workflows/release.yml");
		expect(output).toContain("- review bundle: .github/workflows/pages.yml");
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
			xrefFallbackLabelStyle: string;
		};

		expect(result.count).toBe(3);
		expect(result.flavor).toBe("gfm");
		expect(result.reviewBundleRoot).toBe(
			resolve("build/markdown/review-bundle"),
		);
		expect(result.reviewBundleFiles).toEqual([
			{ outputPath: ".github/workflows/release.yml" },
			{ outputPath: ".github/workflows/pages.yml" },
		]);
		expect(result.xrefFallbackLabelStyle).toBe("fragment-or-basename");
		expect(result.files).toEqual([
			{ moduleName: "architecture", outputPath: "architecture.md" },
			{ moduleName: "manual", outputPath: "manual.md" },
			{ moduleName: "onboarding", outputPath: "onboarding.md" },
		]);
	});

	it("accepts path-style xref fallback labels for module export runs", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-export-"),
		);
		const { exportedFiles, reviewBundleFiles } =
			await exportAntoraModulesToMarkdown({
				flavor: "gfm",
				outputRoot,
				playbookPath: resolve("antora-playbook.yml"),
				xrefFallbackLabelStyle: "fragment-or-path",
			});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);
		expect(reviewBundleFiles).toHaveLength(2);
	});
});
