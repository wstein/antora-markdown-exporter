import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { pathToFileURL } from "node:url";
import { CancelPromptError, ExitPromptError } from "@inquirer/core";
import {
	confirm as promptConfirm,
	input as promptInput,
	select as promptSelect,
} from "@inquirer/prompts";
import kleur from "kleur";

export const SEMVER = /^\d+\.\d+\.\d+(?:[-+].+)?$/;

export function isSemver(version) {
	return SEMVER.test(version);
}

export function normalizeVersionInput(version) {
	if (typeof version !== "string") {
		return "";
	}

	return version.trim().replace(/^v/i, "");
}

export function isDevelopmentVersion(version) {
	return /-dev(?:[.+-].*)?$/i.test(normalizeVersionInput(version));
}

export function suggestReleaseVersion(currentVersion) {
	const normalizedVersion = normalizeVersionInput(currentVersion);
	if (!isSemver(normalizedVersion)) {
		return normalizedVersion;
	}

	if (isDevelopmentVersion(normalizedVersion)) {
		return normalizedVersion.replace(/-dev(?:[.+-].*)?$/i, "");
	}

	return normalizedVersion.replace(/(\d+)$/, (match) =>
		String(Number(match) + 1),
	);
}

export function inferExplicitReleaseAction({
	currentVersion,
	requestedVersion,
}) {
	const normalizedRequestedVersion = normalizeVersionInput(requestedVersion);
	if (!normalizedRequestedVersion) {
		return null;
	}

	return normalizedRequestedVersion === normalizeVersionInput(currentVersion)
		? "finalize"
		: "start";
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`);
}

export function updateReleaseVersionFiles(cwd, version) {
	const packageJsonPath = resolve(cwd, "package.json");
	const packageJson = readJson(packageJsonPath);
	packageJson.version = version;
	writeJson(packageJsonPath, packageJson);

	const packageLockPath = resolve(cwd, "package-lock.json");
	if (existsSync(packageLockPath)) {
		const packageLock = readJson(packageLockPath);
		packageLock.version = version;
		if (packageLock.packages?.[""] !== undefined) {
			packageLock.packages[""].version = version;
		}
		writeJson(packageLockPath, packageLock);
	}
}

export function getVersionFiles(cwd) {
	const files = ["package.json"];
	if (existsSync(resolve(cwd, "package-lock.json"))) {
		files.push("package-lock.json");
	}
	return files;
}

function git(cwd, args, options = {}) {
	const result = spawnSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: options.capture === true ? ["ignore", "pipe", "pipe"] : "inherit",
	});

	if (result.status !== 0) {
		const stderr = result.stderr?.trim();
		const stdoutText = result.stdout?.trim();
		throw new Error(stderr || stdoutText || `git ${args.join(" ")} failed`);
	}

	return (result.stdout ?? "").trim();
}

export function getReleaseState(cwd) {
	const packageJson = readJson(resolve(cwd, "package.json"));
	const currentVersion = String(packageJson.version ?? "");
	const tagName = `v${currentVersion}`;

	return {
		branch: git(cwd, ["branch", "--show-current"], { capture: true }),
		currentVersion,
		currentVersionTagExists:
			git(cwd, ["tag", "--list", tagName], { capture: true }) === tagName,
		headTags: git(cwd, ["tag", "--points-at", "HEAD"], { capture: true })
			.split("\n")
			.map((value) => value.trim())
			.filter(Boolean),
		suggestedVersion: suggestReleaseVersion(currentVersion),
		worktreeClean:
			git(cwd, ["status", "--short"], { capture: true }).trim().length === 0,
	};
}

export function assertReleasePreconditions(state) {
	if (state.branch !== "develop") {
		throw new Error(
			`Release wizard must run on develop. Current branch: ${state.branch || "(detached HEAD)"}`,
		);
	}

	if (!state.worktreeClean) {
		throw new Error(
			"Release wizard requires a clean worktree so the candidate and tag map to one audited state.",
		);
	}
}

export function assertVersionAvailable(cwd, state, version, action) {
	const normalizedVersion = normalizeVersionInput(version);

	if (!isSemver(normalizedVersion)) {
		throw new Error(`Invalid version: ${version}`);
	}

	if (action === "finalize" && isDevelopmentVersion(normalizedVersion)) {
		throw new Error(
			`Version ${normalizedVersion} is still a development baseline. Start a release candidate first before finalizing a tag.`,
		);
	}

	if (action === "start" && normalizedVersion === state.currentVersion) {
		throw new Error(
			`Version ${normalizedVersion} is already set in package.json. Rerun the wizard with the same version to finalize the current candidate, or choose a new version to start a fresh candidate.`,
		);
	}

	if (
		action === "start" &&
		git(cwd, ["tag", "--list", `v${normalizedVersion}`], { capture: true }) ===
			`v${normalizedVersion}`
	) {
		throw new Error(
			`Tag v${normalizedVersion} already exists. Start a new candidate with a different version.`,
		);
	}

	if (action === "finalize" && state.currentVersionTagExists) {
		throw new Error(
			`Tag v${normalizedVersion} already exists. The current candidate has already been finalized.`,
		);
	}
}

function createPromptAdapter(options = {}) {
	if (options.promptAdapter) {
		return options.promptAdapter;
	}

	function ensureInteractive() {
		if (!stdin.isTTY || !stdout.isTTY) {
			throw new Error(
				"Interactive release prompts require a TTY. Supply VERSION=... and --yes for non-interactive use.",
			);
		}
	}

	return {
		async confirm(message, defaultValue) {
			ensureInteractive();
			return promptConfirm({
				default: defaultValue,
				message,
			});
		},
		close() {},
		async input(message, defaultValue) {
			ensureInteractive();
			return promptInput({
				default: defaultValue,
				message,
				prefill: "editable",
				required: true,
				validate(value) {
					return isSemver(normalizeVersionInput(value))
						? true
						: "Enter a semantic version such as 0.7.1 or v0.7.1.";
				},
			}).then((value) => normalizeVersionInput(value));
		},
		async select(message, choices) {
			ensureInteractive();
			return promptSelect({
				choices: choices.map((choice) => ({
					description: choice.description,
					name: choice.label,
					short: choice.label,
					value: choice.value,
				})),
				loop: false,
				message,
				theme: {
					icon: {
						cursor: kleur.cyan("›"),
					},
					indexMode: "number",
					style: {
						description: kleur.dim,
						highlight: kleur.cyan().bold,
						keysHelpTip(keys) {
							return kleur.dim(
								keys
									.map(([key, action]) => `${kleur.bold(key)} ${action}`)
									.join(kleur.dim(" | ")),
							);
						},
					},
				},
			});
		},
	};
}

function formatWorktreeState(state) {
	return state.worktreeClean ? kleur.green("clean") : kleur.red("dirty");
}

function formatStateValue(label, value) {
	return `${kleur.dim(`${label}:`)} ${kleur.bold(value)}`;
}

function isPromptCancellationError(error) {
	return error instanceof CancelPromptError || error instanceof ExitPromptError;
}

function printHeader(log) {
	log(`\n${kleur.bold().cyan("== Release Wizard ==")}\n`);
}

function printStateSummary(state, log) {
	log(
		[
			formatStateValue("Version", `v${state.currentVersion}`),
			formatStateValue("Branch", state.branch || "(detached HEAD)"),
			formatStateValue("Worktree", formatWorktreeState(state)),
		].join(kleur.dim(" | ")),
	);

	if (isDevelopmentVersion(state.currentVersion)) {
		log(
			`${kleur.yellow("Current version is a development baseline.")} Start a release candidate such as ${kleur.bold(`v${state.suggestedVersion}`)} before finalizing a tag.\n`,
		);
		return;
	}

	if (state.currentVersionTagExists) {
		log(
			`${kleur.yellow(`Tag v${state.currentVersion} already exists.`)} The current version can only start a newer candidate.\n`,
		);
		return;
	}

	log(
		`${kleur.green(`Current version v${state.currentVersion} is untagged.`)} It can be finalized if CI already certified the commit.\n`,
	);
}

async function chooseReleaseAction(state, requestedVersion, promptAdapter) {
	const explicitAction = inferExplicitReleaseAction({
		currentVersion: state.currentVersion,
		requestedVersion,
	});
	if (explicitAction !== null) {
		return explicitAction;
	}

	const choices = [
		{
			label: `Start release candidate from ${state.currentVersion}`,
			value: "start",
		},
	];

	if (
		!state.currentVersionTagExists &&
		!isDevelopmentVersion(state.currentVersion)
	) {
		choices.push({
			label: `Finalize current candidate as v${state.currentVersion}`,
			value: "finalize",
		});
	}

	return promptAdapter.select("Choose release phase by number:", choices);
}

async function chooseVersion(state, requestedVersion, promptAdapter) {
	if (requestedVersion) {
		return normalizeVersionInput(requestedVersion);
	}

	return promptAdapter.input("Release version:", state.suggestedVersion);
}

function inferYesFlag(argv, env) {
	return (
		argv.includes("--yes") ||
		env.RELEASE_YES === "1" ||
		env.YES === "1" ||
		env.CI === "true"
	);
}

async function confirmPlan({ action, promptAdapter, version }) {
	const tagName = `v${normalizeVersionInput(version)}`;
	const message =
		action === "start"
			? `Start release candidate ${tagName} on develop: bump version files, commit, and push the candidate commit?`
			: `Finalize release ${tagName}: create and push the release tag from the current certified commit?`;

	return promptAdapter.confirm(message, true);
}

export function runReleaseAction({ action, cwd, log, version }) {
	const normalizedVersion = normalizeVersionInput(version);
	const tagName = `v${normalizedVersion}`;

	if (action === "start") {
		updateReleaseVersionFiles(cwd, normalizedVersion);
		git(cwd, ["add", ...getVersionFiles(cwd)]);
		git(cwd, ["commit", "-m", `chore(release): start ${tagName}`]);
		git(cwd, ["push", "origin", "develop"]);
		log(kleur.green(`Release candidate ${tagName} started.`));
		log(
			`${kleur.cyan("Next:")} wait for CI to certify develop, then rerun ${kleur.bold(`make release VERSION=${tagName}`)} to create and push the tag.`,
		);
		return;
	}

	git(cwd, ["tag", "-a", tagName, "-m", `Release ${tagName}`]);
	git(cwd, ["push", "origin", tagName]);
	log(kleur.green(`Release tag ${tagName} pushed.`));
	log(
		`${kleur.cyan("Next:")} watch the tag-triggered release workflow publish the package and promote main to the released commit.`,
	);
}

export async function runReleaseWizard(options = {}) {
	const cwd = options.cwd ?? process.cwd();
	const argv = options.argv ?? process.argv.slice(2);
	const env = options.env ?? process.env;
	const log = options.log ?? console.log;
	const promptAdapter = createPromptAdapter(options);
	const autoConfirm = inferYesFlag(argv, env);

	try {
		printHeader(log);

		const state = getReleaseState(cwd);
		assertReleasePreconditions(state);
		printStateSummary(state, log);

		const requestedVersion =
			env.VERSION ?? argv.find((value) => !value.startsWith("-"));
		const action = await chooseReleaseAction(
			state,
			requestedVersion,
			promptAdapter,
		);
		const version =
			action === "start"
				? await chooseVersion(state, requestedVersion, promptAdapter)
				: state.currentVersion;

		assertVersionAvailable(cwd, state, version, action);

		const proceed = autoConfirm
			? true
			: await confirmPlan({ action, promptAdapter, version });
		if (!proceed) {
			log(kleur.yellow("Release wizard cancelled."));
			return;
		}

		runReleaseAction({ action, cwd, log, version });
	} catch (error) {
		if (isPromptCancellationError(error)) {
			log(kleur.yellow("Release wizard cancelled."));
			return;
		}
		throw error;
	} finally {
		promptAdapter.close?.();
	}
}

function isDirectExecution() {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}

	return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
	runReleaseWizard().catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		process.exit(1);
	});
}
