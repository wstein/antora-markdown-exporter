import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOCUMENT_TITLE_PATTERN = /^=\s+.+\n?/;
const DOC_MODULES = ["architecture", "manual", "onboarding"];
const ARCHITECTURE_PARTIALS = [
	"01_introduction_and_goals.adoc",
	"02_architecture_constraints.adoc",
	"03_context_and_scope.adoc",
	"04_solution_strategy.adoc",
	"05_building_block_view.adoc",
	"06_runtime_view.adoc",
	"07_deployment_view.adoc",
	"08_concepts.adoc",
	"09_architecture_decisions.adoc",
	"10_quality_requirements.adoc",
	"11_technical_risks.adoc",
	"12_glossary.adoc",
];

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
:toc-title: table of contents
:toclevels: 3
:sectnums:
:reproducible:

`;
}

function readArchitecturePartialBodies(rootDir) {
	const partialsDir = resolve(rootDir, "docs/modules/architecture/partials");

	return ARCHITECTURE_PARTIALS.map((fileName) =>
		readFileSync(resolve(partialsDir, fileName), "utf8").trim(),
	).join("\n\n");
}

export function createArchitectureModuleSource(rootDir) {
	const imagesDir = resolve(rootDir, "docs/modules/architecture/images");

	return `${createBookPreamble("Architecture")}:imagesdir: ${imagesDir}

${readArchitecturePartialBodies(rootDir)}
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
