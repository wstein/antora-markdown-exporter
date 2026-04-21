import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCUMENT_TITLE_PATTERN = /^=\s+.+\n?/;

export function stripDocumentTitle(source) {
	return source.replace(DOCUMENT_TITLE_PATTERN, "");
}

export function createPdfBookSource(rootDir) {
	const rootIndex = stripDocumentTitle(
		readFileSync(
			resolve(rootDir, "docs/modules/ROOT/pages/index.adoc"),
			"utf8",
		),
	).trim();
	const manualIndex = stripDocumentTitle(
		readFileSync(
			resolve(rootDir, "docs/modules/manual/pages/index.adoc"),
			"utf8",
		),
	).trim();
	const onboardingIndex = stripDocumentTitle(
		readFileSync(
			resolve(rootDir, "docs/modules/onboarding/pages/index.adoc"),
			"utf8",
		),
	).trim();

	return `= Antora Markdown Exporter Documentation
:doctype: book
:toc:
:toclevels: 3
:sectnums:
:reproducible:
:imagesdir: ../docs/modules/architecture/images

== Documentation

${rootIndex}

include::../docs/modules/architecture/partials/config.adoc[]

== Architecture

include::../docs/modules/architecture/partials/01_introduction_and_goals.adoc[]
include::../docs/modules/architecture/partials/02_architecture_constraints.adoc[]
include::../docs/modules/architecture/partials/03_context_and_scope.adoc[]
include::../docs/modules/architecture/partials/04_solution_strategy.adoc[]
include::../docs/modules/architecture/partials/05_building_block_view.adoc[]
include::../docs/modules/architecture/partials/06_runtime_view.adoc[]
include::../docs/modules/architecture/partials/07_deployment_view.adoc[]
include::../docs/modules/architecture/partials/08_concepts.adoc[]
include::../docs/modules/architecture/partials/09_architecture_decisions.adoc[]
include::../docs/modules/architecture/partials/10_quality_requirements.adoc[]
include::../docs/modules/architecture/partials/11_technical_risks.adoc[]
include::../docs/modules/architecture/partials/12_glossary.adoc[]

== Manual

${manualIndex}

== Onboarding

${onboardingIndex}
`;
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

export function getPdfOutputPath(rootDir) {
	return resolve(
		rootDir,
		"build/site/antora-markdown-exporter/antora-markdown-exporter.pdf",
	);
}

export function buildDocsSite(rootDir) {
	const buildDir = resolve(rootDir, "build");
	const pdfSourcePath = resolve(buildDir, "antora-markdown-exporter-book.adoc");
	const pdfOutputPath = getPdfOutputPath(rootDir);

	mkdirSync(buildDir, { recursive: true });
	writeFileSync(pdfSourcePath, createPdfBookSource(rootDir));

	runCommand("antora", ["antora-playbook.yml"], rootDir);
	mkdirSync(dirname(pdfOutputPath), { recursive: true });
	runCommand("asciidoctor-pdf", ["-o", pdfOutputPath, pdfSourcePath], rootDir);
	rmSync(pdfSourcePath, { force: true });
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
