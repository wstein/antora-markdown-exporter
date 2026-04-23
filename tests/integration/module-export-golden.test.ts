import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { exportAntoraModulesToMarkdown } from "../../scripts/export-antora-modules.ts";

const fixturesRoot = resolve(__dirname, "../fixtures/module-exports");

describe("module export golden tests", () => {
	it("renders the documentation modules to the checked-in markdown artifacts", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-module-export-"),
		);
		const { exportedFiles, reviewBundleFiles } =
			await exportAntoraModulesToMarkdown({
				flavor: "gfm",
				outputRoot,
				packageTaskMarkdown: false,
				playbookPath: resolve("antora-playbook.yml"),
			});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"documentation.md",
			"architecture.md",
			"manual.md",
			"onboarding.md",
		]);
		expect(reviewBundleFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			".github/workflows/release.yml",
			".github/workflows/pages.yml",
		]);

		for (const exportedFile of exportedFiles) {
			const actual = await readFile(exportedFile.outputPath, "utf8");
			const expected = await readFile(
				resolve(fixturesRoot, `${exportedFile.assemblyName}.gfm.md`),
				"utf8",
			);
			expect(actual).toBe(expected);
		}
	});
});
