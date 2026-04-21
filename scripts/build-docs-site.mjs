import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCUMENT_TITLE_PATTERN = /^=\s+.+\n?/;
const PDF_MODULES = ["architecture", "manual", "onboarding"];

export function stripDocumentTitle(source) {
	return source.replace(DOCUMENT_TITLE_PATTERN, "");
}

function createBookPreamble(title) {
	return `= ${title}
:doctype: book
:toc:
:toclevels: 3
:sectnums:
:reproducible:

`;
}

export function createArchitecturePdfSource(rootDir) {
	const partialsDir = resolve(rootDir, "docs/modules/architecture/partials");
	const imagesDir = resolve(rootDir, "docs/modules/architecture/images");

	return `${createBookPreamble("Architecture")}:imagesdir: ${imagesDir}

include::${resolve(partialsDir, "config.adoc")}[]

include::${resolve(partialsDir, "01_introduction_and_goals.adoc")}[]
include::${resolve(partialsDir, "02_architecture_constraints.adoc")}[]
include::${resolve(partialsDir, "03_context_and_scope.adoc")}[]
include::${resolve(partialsDir, "04_solution_strategy.adoc")}[]
include::${resolve(partialsDir, "05_building_block_view.adoc")}[]
include::${resolve(partialsDir, "06_runtime_view.adoc")}[]
include::${resolve(partialsDir, "07_deployment_view.adoc")}[]
include::${resolve(partialsDir, "08_concepts.adoc")}[]
include::${resolve(partialsDir, "09_architecture_decisions.adoc")}[]
include::${resolve(partialsDir, "10_quality_requirements.adoc")}[]
include::${resolve(partialsDir, "11_technical_risks.adoc")}[]
include::${resolve(partialsDir, "12_glossary.adoc")}[]
`;
}

function readModulePageBody(rootDir, moduleName) {
	return stripDocumentTitle(
		readFileSync(
			resolve(rootDir, `docs/modules/${moduleName}/pages/index.adoc`),
			"utf8",
		),
	).trim();
}

export function createModulePdfSource(rootDir, moduleName) {
	if (moduleName === "architecture") {
		return createArchitecturePdfSource(rootDir);
	}

	if (moduleName === "manual") {
		return `${createBookPreamble("Operator Manual")}${readModulePageBody(
			rootDir,
			moduleName,
		)}
`;
	}

	if (moduleName === "onboarding") {
		return `${createBookPreamble("Onboarding")}${readModulePageBody(
			rootDir,
			moduleName,
		)}
`;
	}

	throw new Error(`Unsupported PDF module: ${moduleName}`);
}

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

export function getPdfModuleNames() {
	return [...PDF_MODULES];
}

export function buildDocsPdf(rootDir) {
	const buildDir = resolve(rootDir, "build");
	mkdirSync(buildDir, { recursive: true });
	const tempDir = mkdtempSync(resolve(buildDir, "pdf-build-"));

	try {
		for (const moduleName of PDF_MODULES) {
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
