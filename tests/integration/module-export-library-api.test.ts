import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os, { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	assembleAntoraModules,
	exportAntoraModules,
	exportAntoraModulesToMarkdown,
	resolveAntoraMarkdownExportDefaults,
} from "../../src/index.js";

const cleanupPaths: string[] = [];

async function writeTextFile(path: string, contents: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, contents, "utf8");
}

function git(cwd: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
	}).trim();
}

async function createUnsupportedFixtureRepository(): Promise<string> {
	const root = await mkdtemp(join(os.tmpdir(), "antora-md-diag-"));
	cleanupPaths.push(root);

	await writeTextFile(
		resolve(root, "antora-playbook.yml"),
		[
			"site:",
			"  title: Markdown Diagnostic Fixture",
			"  url: https://example.invalid/docs",
			"  start_page: sample::index.adoc",
			"",
			"content:",
			"  sources:",
			"    - url: .",
			"      branches: HEAD",
			"      start_path: docs",
			"",
			"ui:",
			"  bundle:",
			"    url: https://example.invalid/ui-bundle.zip",
			"    snapshot: true",
			"",
			"output:",
			"  dir: build/site",
			"",
		].join("\n"),
	);
	await writeTextFile(
		resolve(root, "docs/antora.yml"),
		[
			"name: sample",
			"title: Markdown Diagnostic Fixture",
			"version: ~",
			"nav:",
			"  - modules/ROOT/nav.adoc",
			"",
		].join("\n"),
	);
	await writeTextFile(
		resolve(root, "docs/modules/ROOT/nav.adoc"),
		["* xref:index.adoc[Guide]", ""].join("\n"),
	);
	await writeTextFile(
		resolve(root, "docs/modules/ROOT/pages/index.adoc"),
		["= Guide", "", "Normal paragraph.", "", "video::clip.mp4[]", ""].join(
			"\n",
		),
	);

	git(root, ["init", "--initial-branch=develop"]);
	git(root, ["config", "user.name", "Integration Test"]);
	git(root, ["config", "user.email", "integration@test.invalid"]);
	git(root, ["add", "."]);
	git(root, ["commit", "-m", "test: initialize diagnostic fixture"]);

	return root;
}

afterEach(async () => {
	for (const path of cleanupPaths.splice(0)) {
		await rm(path, { force: true, recursive: true });
	}
});

describe("module export library API", () => {
	it("publishes assembled module files with source-page provenance", async () => {
		const assembledFiles = await assembleAntoraModules({
			playbookPath: resolve("antora-playbook.yml"),
		});

		expect(
			assembledFiles.map((entry) => ({
				assemblyName: entry.assemblyName,
				moduleName: entry.moduleName,
				name: entry.name,
				relativePath: entry.relativePath,
				sourcePages: entry.sourcePages,
			})),
		).toEqual([
			{
				assemblyName: "documentation",
				moduleName: "ROOT",
				name: "documentation",
				relativePath: "documentation.adoc",
				sourcePages: ["modules/ROOT/pages/index.adoc"],
			},
			{
				assemblyName: "architecture",
				moduleName: "architecture",
				name: "architecture",
				relativePath: "architecture.adoc",
				sourcePages: ["modules/architecture/pages/index.adoc"],
			},
			{
				assemblyName: "manual",
				moduleName: "manual",
				name: "manual",
				relativePath: "manual.adoc",
				sourcePages: ["modules/manual/pages/index.adoc"],
			},
			{
				assemblyName: "onboarding",
				moduleName: "onboarding",
				name: "onboarding",
				relativePath: "onboarding.adoc",
				sourcePages: ["modules/onboarding/pages/index.adoc"],
			},
		]);
		expect(assembledFiles[0]?.contents.toString("utf8")).toContain(
			"= Antora Markdown Exporter: Documentation",
		);
	}, 15_000);

	it("publishes in-memory markdown exports with metadata and defaults", async () => {
		const defaults = await resolveAntoraMarkdownExportDefaults({
			playbookPath: resolve("antora-playbook.yml"),
		});
		const markdownExports = await exportAntoraModulesToMarkdown({
			playbookPath: resolve("antora-playbook.yml"),
		});

		expect(defaults).toEqual({
			flavor: "gfm",
			rootLevel: 1,
		});
		expect(markdownExports.map((entry) => entry.path)).toEqual([
			"documentation.md",
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);
		expect(markdownExports.map((entry) => entry.moduleName)).toEqual([
			"ROOT",
			"architecture",
			"manual",
			"onboarding",
		]);
		expect(
			markdownExports.every((entry) => entry.diagnostics.length === 0),
		).toBe(true);
		expect(markdownExports[2]?.sourcePages).toEqual([
			"modules/manual/pages/index.adoc",
		]);
		expect(markdownExports[2]?.content).toContain(
			"# Antora Markdown Exporter: Manual",
		);
		expect(markdownExports[2]?.content).toContain(
			"- [Chapter 2. Core Workflows](#chapter-2-core-workflows)",
		);
	}, 15_000);

	it("writes markdown exports and optional assembly source files to disk", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-library-export-"),
		);

		const result = await exportAntoraModules({
			keepSource: true,
			outputRoot,
			playbookPath: resolve("antora-playbook.yml"),
		});

		expect(result.flavor).toBe("gfm");
		expect(result.rootLevel).toBe(1);
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
		const manualAssemblySource = await readFile(
			resolve(outputRoot, "manual.adoc"),
			"utf8",
		);
		expect(manualMarkdown).toContain("# Antora Markdown Exporter: Manual");
		expect(manualMarkdown).toContain(
			"- [Chapter 2. Core Workflows](#chapter-2-core-workflows)",
		);
		expect(manualAssemblySource).toContain(
			"= Antora Markdown Exporter: Manual",
		);
	}, 15_000);

	it("emits structured export diagnostics for unsupported assembly nodes", async () => {
		const root = await createUnsupportedFixtureRepository();
		const exports = await exportAntoraModulesToMarkdown({
			playbookPath: resolve(root, "antora-playbook.yml"),
		});

		expect(
			exports.map((entry) => ({
				diagnostics: entry.diagnostics,
				path: entry.path,
			})),
		).toEqual([
			{
				path: "index.md",
				diagnostics: [
					expect.objectContaining({
						code: "unsupported-structure",
						line: expect.any(Number),
						message: expect.stringContaining("video"),
						severity: "warning",
						sourcePath: "index.adoc",
					}),
				],
			},
		]);
		expect(exports[0]?.content).toContain("Unsupported:");
		expect(exports[0]?.sourcePages).toEqual(["modules/ROOT/pages/index.adoc"]);
	}, 15_000);

	it("reports assembly-first metadata for a single combined export", async () => {
		const markdownExports = await exportAntoraModulesToMarkdown({
			playbookPath: resolve("antora-playbook.yml"),
			rootLevel: 0,
		});

		expect(markdownExports).toHaveLength(1);
		expect(markdownExports[0]).toEqual(
			expect.objectContaining({
				assemblyName: "index",
				moduleName: null,
				path: "index.md",
				rootLevel: 0,
			}),
		);
	});

	it("allows overriding Antora runtime log settings through the API", async () => {
		const root = await createUnsupportedFixtureRepository();
		const logPath = resolve(root, "build", "logs", "export.log");

		const exports = await exportAntoraModulesToMarkdown({
			playbookPath: resolve(root, "antora-playbook.yml"),
			runtimeLog: {
				destination: {
					file: logPath,
				},
				format: "json",
				level: "warn",
			},
		});

		expect(exports[0]?.path).toBe("index.md");
		const logContents = await readFile(logPath, "utf8");
		expect(logContents).toBe("");
	}, 15_000);
});
