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
		expect(architectureMarkdown).toContain(
			"**Motivation:** The decomposition follows",
		);
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
});
