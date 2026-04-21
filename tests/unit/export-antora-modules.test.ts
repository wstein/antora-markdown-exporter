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
	});

	it("parses explicit arguments", () => {
		const options = parseArguments([
			"--playbook",
			"tmp/playbook.yml",
			"--output-root",
			"tmp/out",
			"--flavor",
			"gitlab",
			"--json",
		]);

		expect(options.playbookPath).toBe(resolve("tmp/playbook.yml"));
		expect(options.outputRoot).toBe(resolve("tmp/out"));
		expect(options.flavor).toBe("gitlab");
		expect(options.format).toBe("json");
	});

	it("exports one assembled markdown document per documentation module", async () => {
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
			"- [Chapter 1. Mental Models](#chapter-1-mental-models)",
		);
		expect(onboardingMarkdown).toContain("# Chapter 2. Core Workflows");
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
		};

		expect(result.count).toBe(3);
		expect(result.flavor).toBe("gfm");
		expect(result.files).toEqual([
			{ moduleName: "architecture", outputPath: "architecture.md" },
			{ moduleName: "manual", outputPath: "manual.md" },
			{ moduleName: "onboarding", outputPath: "onboarding.md" },
		]);
	});
});
