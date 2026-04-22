import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";
import { ExitPromptError } from "@inquirer/core";
import { afterEach, describe, expect, it } from "vitest";
import {
	assertReleasePreconditions,
	inferExplicitReleaseAction,
	isDevelopmentVersion,
	isSemver,
	normalizeVersionInput,
	runReleaseWizard,
	suggestReleaseVersion,
} from "../../scripts/release.js";

function git(cwd: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
	}).trim();
}

function writePackageJson(cwd: string, version: string) {
	writeFileSync(
		resolve(cwd, "package.json"),
		`${JSON.stringify(
			{
				name: "@wsmy/antora-markdown-exporter-test",
				version,
				type: "module",
			},
			null,
			"\t",
		)}\n`,
	);
}

function createRepo(version: string) {
	const root = mkdtempSync(join(os.tmpdir(), "antora-md-exporter-release-"));
	const remote = `${root}-remote.git`;

	execFileSync("git", ["init", "--bare", remote], { encoding: "utf8" });
	git(root, ["init", "--initial-branch=develop"]);
	git(root, ["config", "user.name", "Release Test"]);
	git(root, ["config", "user.email", "release@test.invalid"]);
	git(root, ["remote", "add", "origin", remote]);
	writePackageJson(root, version);
	git(root, ["add", "package.json"]);
	git(root, ["commit", "-m", "chore: initialize release fixture"]);
	git(root, ["push", "-u", "origin", "develop"]);

	return { remote, root };
}

const cleanupPaths: string[] = [];

afterEach(() => {
	for (const path of cleanupPaths.splice(0)) {
		rmSync(path, { force: true, recursive: true });
	}
});

describe("release script helpers", () => {
	it("normalizes semantic version inputs", () => {
		expect(normalizeVersionInput(" v1.2.3 ")).toBe("1.2.3");
		expect(isSemver("1.2.3")).toBe(true);
		expect(isDevelopmentVersion("1.2.3-dev")).toBe(true);
		expect(suggestReleaseVersion("0.4.0-dev")).toBe("0.4.0");
		expect(suggestReleaseVersion("0.4.0")).toBe("0.4.1");
		expect(
			inferExplicitReleaseAction({
				currentVersion: "0.4.0",
				requestedVersion: "v0.4.0",
			}),
		).toBe("finalize");
		expect(
			inferExplicitReleaseAction({
				currentVersion: "0.4.0-dev",
				requestedVersion: "0.4.0",
			}),
		).toBe("start");
	});

	it("requires develop and a clean worktree", () => {
		expect(() =>
			assertReleasePreconditions({
				branch: "main",
				worktreeClean: true,
			}),
		).toThrow("Release wizard must run on develop");

		expect(() =>
			assertReleasePreconditions({
				branch: "develop",
				worktreeClean: false,
			}),
		).toThrow("Release wizard requires a clean worktree");
	});
});

describe("release wizard", () => {
	it("starts a release candidate from develop and pushes develop", async () => {
		const repo = createRepo("0.1.0-dev");
		cleanupPaths.push(repo.root, repo.remote);

		await runReleaseWizard({
			cwd: repo.root,
			env: {
				VERSION: "0.1.0",
				RELEASE_YES: "1",
			},
			log: () => {},
		});

		const pkg = JSON.parse(
			readFileSync(resolve(repo.root, "package.json"), "utf8"),
		) as { version: string };

		expect(pkg.version).toBe("0.1.0");
		expect(git(repo.root, ["log", "-1", "--pretty=%s"])).toBe(
			"chore(release): start v0.1.0",
		);
		expect(git(repo.root, ["rev-parse", "HEAD"])).toBe(
			git(repo.root, ["rev-parse", "origin/develop"]),
		);
		expect(git(repo.root, ["tag", "--list", "v0.1.0"])).toBe("");
	});

	it("uses the prompt adapter for interactive release selection and version entry", async () => {
		const repo = createRepo("0.1.0-dev");
		cleanupPaths.push(repo.root, repo.remote);

		await runReleaseWizard({
			cwd: repo.root,
			log: () => {},
			promptAdapter: {
				async confirm() {
					return true;
				},
				async input() {
					return "v0.1.0";
				},
				async select() {
					return "start";
				},
			},
		});

		const pkg = JSON.parse(
			readFileSync(resolve(repo.root, "package.json"), "utf8"),
		) as { version: string };

		expect(pkg.version).toBe("0.1.0");
		expect(git(repo.root, ["log", "-1", "--pretty=%s"])).toBe(
			"chore(release): start v0.1.0",
		);
	});

	it("finalizes the current release candidate by pushing a tag only", async () => {
		const repo = createRepo("0.1.0");
		cleanupPaths.push(repo.root, repo.remote);

		await runReleaseWizard({
			cwd: repo.root,
			env: {
				VERSION: "0.1.0",
				RELEASE_YES: "1",
			},
			log: () => {},
		});

		expect(git(repo.root, ["tag", "--list", "v0.1.0"])).toBe("v0.1.0");
		expect(
			execFileSync(
				"git",
				["--git-dir", repo.remote, "tag", "--list", "v0.1.0"],
				{
					encoding: "utf8",
				},
			).trim(),
		).toBe("v0.1.0");
		expect(git(repo.root, ["log", "-1", "--pretty=%s"])).toBe(
			"chore: initialize release fixture",
		);
	});

	it("rejects release execution outside develop", async () => {
		const repo = createRepo("0.1.0-dev");
		cleanupPaths.push(repo.root, repo.remote);
		git(repo.root, ["checkout", "-b", "feature/release-test"]);

		await expect(
			runReleaseWizard({
				cwd: repo.root,
				env: {
					VERSION: "0.1.0",
					RELEASE_YES: "1",
				},
				log: () => {},
			}),
		).rejects.toThrow("Release wizard must run on develop");
	});

	it("rejects finalizing a development baseline", async () => {
		const repo = createRepo("0.1.0-dev");
		cleanupPaths.push(repo.root, repo.remote);

		await expect(
			runReleaseWizard({
				cwd: repo.root,
				env: {
					VERSION: "0.1.0-dev",
					RELEASE_YES: "1",
				},
				log: () => {},
			}),
		).rejects.toThrow("development baseline");
	});

	it("cancels cleanly when the confirmation prompt returns false", async () => {
		const repo = createRepo("0.1.0-dev");
		cleanupPaths.push(repo.root, repo.remote);
		const logs: string[] = [];

		await runReleaseWizard({
			cwd: repo.root,
			env: {
				VERSION: "0.1.0",
			},
			log: (value?: unknown) => {
				logs.push(String(value ?? ""));
			},
			promptAdapter: {
				async confirm() {
					return false;
				},
			},
		});

		const pkg = JSON.parse(
			readFileSync(resolve(repo.root, "package.json"), "utf8"),
		) as { version: string };

		expect(pkg.version).toBe("0.1.0-dev");
		expect(git(repo.root, ["log", "-1", "--pretty=%s"])).toBe(
			"chore: initialize release fixture",
		);
		expect(
			logs.some((entry) => entry.includes("Release wizard cancelled.")),
		).toBe(true);
	});

	it("treats prompt exit as a cancellation instead of a failure", async () => {
		const repo = createRepo("0.1.0-dev");
		cleanupPaths.push(repo.root, repo.remote);
		const logs: string[] = [];

		await runReleaseWizard({
			cwd: repo.root,
			env: {
				VERSION: "0.1.0",
			},
			log: (value?: unknown) => {
				logs.push(String(value ?? ""));
			},
			promptAdapter: {
				async confirm() {
					throw new ExitPromptError();
				},
			},
		});

		expect(git(repo.root, ["log", "-1", "--pretty=%s"])).toBe(
			"chore: initialize release fixture",
		);
		expect(logs.at(-1)).toContain("Release wizard cancelled.");
	});
});
