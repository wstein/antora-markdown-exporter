import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const cacheDir = mkdtempSync(
	join(os.tmpdir(), "antora-markdown-exporter-npm-cache-"),
);

const requiredBuildArtifacts = [
	"dist/index.js",
	"dist/index.cjs",
	"dist/index.d.ts",
	"dist/extension/index.js",
	"dist/extension/index.cjs",
	"dist/extension/index.d.ts",
];

try {
	for (const artifact of requiredBuildArtifacts) {
		if (!existsSync(resolve(root, artifact))) {
			throw new Error(`Missing build artifact: ${artifact}`);
		}
	}

	const esmEntry = await import(
		pathToFileURL(resolve(root, "dist/index.js")).href
	);
	const cjsEntry = require(resolve(root, "dist/index.cjs"));
	const esmExtension = await import(
		pathToFileURL(resolve(root, "dist/extension/index.js")).href
	);
	const cjsExtension = require(resolve(root, "dist/extension/index.cjs"));

	if (
		typeof esmEntry.renderGfm !== "function" ||
		typeof cjsEntry.renderGfm !== "function"
	) {
		throw new Error(
			"Root package exports must expose renderGfm in both module formats",
		);
	}

	if (
		typeof esmEntry.collectMarkdownInspectionReport !== "function" ||
		typeof cjsEntry.collectMarkdownInspectionReport !== "function"
	) {
		throw new Error(
			"Root package exports must expose collectMarkdownInspectionReport in both module formats",
		);
	}

	if (
		typeof esmExtension.createAntoraExtensionScaffold !== "function" ||
		typeof cjsExtension.createAntoraExtensionScaffold !== "function"
	) {
		throw new Error(
			"Extension package exports must expose createAntoraExtensionScaffold in both module formats",
		);
	}

	const sampleDocument = esmEntry.convertAssemblyToMarkdownIR(
		"== Release Check\n\ninclude::partials/snippet.adoc[lines=1..5..0]\n",
		{
			sourcePath: resolve(
				root,
				"tests/fixtures/includes-invalid-steps/input.adoc",
			),
		},
	);
	const sampleReport = esmEntry.collectMarkdownInspectionReport(sampleDocument);

	if (sampleReport.includeDiagnostics.length === 0) {
		throw new Error(
			"Inspection report release checks must retain include diagnostics",
		);
	}

	const packOutput = execFileSync("npm", ["pack", "--dry-run", "--json"], {
		cwd: root,
		encoding: "utf8",
		env: {
			...process.env,
			NPM_CONFIG_CACHE: cacheDir,
		},
	});

	const [packSummary] = JSON.parse(packOutput);
	const packedFiles = new Set(packSummary.files.map((entry) => entry.path));
	const requiredPackedFiles = [
		"LICENSE",
		"README.md",
		"bin/antora-markdown-exporter.js",
		"dist/index.js",
		"dist/index.cjs",
		"dist/index.d.ts",
		"dist/extension/index.js",
		"dist/extension/index.cjs",
		"dist/extension/index.d.ts",
	];

	for (const file of requiredPackedFiles) {
		if (!packedFiles.has(file)) {
			throw new Error(`Missing packed publish artifact: ${file}`);
		}
	}

	for (const file of packedFiles) {
		if (file.startsWith("dist/antora-markdown-exporter-bundle/")) {
			throw new Error(
				`Publish archive must not contain bundle artifact: ${file}`,
			);
		}
	}
} finally {
	rmSync(cacheDir, { recursive: true, force: true });
}
