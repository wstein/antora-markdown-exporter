import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOCUMENT_TITLE_PATTERN = /^=\s+.+\n?/;
const DOC_MODULES = ["architecture", "manual", "onboarding"];

export function stripDocumentTitle(source) {
	return source.replace(DOCUMENT_TITLE_PATTERN, "");
}

export function getDocumentationModuleNames() {
	return [...DOC_MODULES];
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

export function createArchitectureModuleSource(rootDir) {
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

export function createDocumentationModuleSource(rootDir, moduleName) {
	if (moduleName === "architecture") {
		return createArchitectureModuleSource(rootDir);
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

	throw new Error(`Unsupported documentation module: ${moduleName}`);
}
