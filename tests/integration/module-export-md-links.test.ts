import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportAntoraModulesToMarkdown } from "../../scripts/export-antora-modules.ts";

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

async function createRepositoryFixture(): Promise<string> {
	const root = await mkdtemp(join(os.tmpdir(), "antora-md-links-"));
	cleanupPaths.push(root);

	await writeTextFile(
		resolve(root, "antora-playbook.yml"),
		[
			"site:",
			"  title: Markdown Link Fixture",
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
			"title: Markdown Link Fixture",
			"version: ~",
			"nav:",
			"  - modules/ROOT/nav.adoc",
			"",
		].join("\n"),
	);
	await writeTextFile(
		resolve(root, "docs/modules/ROOT/nav.adoc"),
		["* xref:index.adoc[Guide]", "* xref:setup.adoc[Setup]", ""].join("\n"),
	);
	await writeTextFile(
		resolve(root, "docs/modules/ROOT/pages/index.adoc"),
		["= Guide", "", "See xref:setup.adoc[].", ""].join("\n"),
	);
	await writeTextFile(
		resolve(root, "docs/modules/ROOT/pages/setup.adoc"),
		["= Setup", "", "Return to xref:index.adoc[].", ""].join("\n"),
	);
	await writeTextFile(
		resolve(root, ".github/workflows/release.yml"),
		"name: Release Fixture\n",
	);
	await writeTextFile(
		resolve(root, ".github/workflows/pages.yml"),
		"name: Pages Fixture\n",
	);

	git(root, ["init", "--initial-branch=develop"]);
	git(root, ["config", "user.name", "Integration Test"]);
	git(root, ["config", "user.email", "integration@test.invalid"]);
	git(root, ["add", "."]);
	git(root, ["commit", "-m", "test: initialize antora fixture"]);

	return root;
}

afterEach(async () => {
	for (const path of cleanupPaths.splice(0)) {
		await rm(path, { force: true, recursive: true });
	}
});

describe("module export markdown links", () => {
	it("keeps page xrefs as .md links across a multi-page Antora export", async () => {
		const root = await createRepositoryFixture();
		const outputRoot = resolve(root, "build/markdown");

		const { exportedFiles } = await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			format: "human",
			outputRoot,
			packageTaskMarkdown: false,
			playbookPath: resolve(root, "antora-playbook.yml"),
			rootLevel: 1,
			xrefFallbackLabelStyle: "fragment-or-basename",
		});

		expect(exportedFiles.map((entry) => entry.relativeOutputPath)).toEqual([
			"guide.md",
			"setup.md",
		]);

		const guideMarkdown = await readFile(
			resolve(outputRoot, "guide.md"),
			"utf8",
		);
		const setupMarkdown = await readFile(
			resolve(outputRoot, "setup.md"),
			"utf8",
		);

		expect(guideMarkdown).toContain("[Setup](setup.md)");
		expect(guideMarkdown).not.toContain("setup.html");
		expect(guideMarkdown).not.toContain("setup.adoc");
		expect(setupMarkdown).toContain("[Guide](guide.md)");
		expect(setupMarkdown).not.toContain("guide.html");
		expect(setupMarkdown).not.toContain("guide.adoc");
	});
});
