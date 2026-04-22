import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export {
	createDocumentationModuleSource as createModulePdfSource,
	getDocumentationModuleNames as getPdfModuleNames,
	stripDocumentTitle,
} from "./docs-module-sources.mjs";

function runCommand(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		stdio: "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed`);
	}
}

export function getPdfOutputPath(rootDir, moduleName) {
	return resolve(
		rootDir,
		"build/site/antora-markdown-exporter",
		`${moduleName}.pdf`,
	);
}

export function buildDocsPdf(rootDir) {
	const buildDir = resolve(rootDir, "build");
	mkdirSync(buildDir, { recursive: true });
	const tempDir = mkdtempSync(resolve(buildDir, "pdf-build-"));

	try {
		for (const moduleName of getPdfModuleNames()) {
			const pdfSourcePath = resolve(tempDir, `${moduleName}.pdf.adoc`);
			const pdfOutputPath = getPdfOutputPath(rootDir, moduleName);
			writeFileSync(pdfSourcePath, createModulePdfSource(rootDir, moduleName));
			mkdirSync(dirname(pdfOutputPath), { recursive: true });
			runCommand(
				"asciidoctor-pdf",
				["-o", pdfOutputPath, pdfSourcePath],
				rootDir,
			);
		}
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

export function buildDocsSite(rootDir) {
	runCommand("antora", ["antora-playbook.yml"], rootDir);
	buildDocsPdf(rootDir);
}

function isDirectExecution() {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}

	return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
}

if (isDirectExecution()) {
	try {
		const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
		buildDocsSite(rootDir);
	} catch (error) {
		console.error(String(error instanceof Error ? error.message : error));
		process.exit(1);
	}
}
