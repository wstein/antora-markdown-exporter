import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { describePackage } from "../../src/index.js";

const root = resolve(__dirname, "../..");
const packageJson = JSON.parse(
	readFileSync(resolve(root, "package.json"), "utf8"),
) as {
	bin: Record<string, string>;
	dependencies?: Record<string, string>;
	files: string[];
	scripts: Record<string, string>;
};
const ciWorkflow = readFileSync(
	resolve(root, ".github/workflows/ci.yml"),
	"utf8",
);
const releaseWorkflow = readFileSync(
	resolve(root, ".github/workflows/release.yml"),
	"utf8",
);
const pagesWorkflow = readFileSync(
	resolve(root, ".github/workflows/pages.yml"),
	"utf8",
);
const antoraPlaybook = readFileSync(
	resolve(root, "antora-playbook.yml"),
	"utf8",
);
const agentGuidance = readFileSync(resolve(root, "AGENT.md"), "utf8");
const exportScript = readFileSync(
	resolve(root, "scripts/export-antora-modules.ts"),
	"utf8",
);
const extensionEntrypoint = readFileSync(
	resolve(root, "src/extension/index.ts"),
	"utf8",
);
const packageIndex = readFileSync(resolve(root, "src/index.ts"), "utf8");
const cliEntrypoint = readFileSync(
	resolve(root, "bin/antora-markdown-exporter.js"),
	"utf8",
);
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const manualDoc = readFileSync(
	resolve(root, "docs/modules/manual/pages/index.adoc"),
	"utf8",
);
const onboardingDoc = readFileSync(
	resolve(root, "docs/modules/onboarding/pages/index.adoc"),
	"utf8",
);
const introGoalsDoc = readFileSync(
	resolve(
		root,
		"docs/modules/architecture/partials/01_introduction_and_goals.adoc",
	),
	"utf8",
);
const qualityDoc = readFileSync(
	resolve(
		root,
		"docs/modules/architecture/partials/10_quality_requirements.adoc",
	),
	"utf8",
);

describe("repository contract", () => {
	it("keeps referenced package files in the tree", () => {
		expect(existsSync(resolve(root, "Makefile"))).toBe(true);
		expect(existsSync(resolve(root, "LICENSE"))).toBe(true);
		expect(existsSync(resolve(root, "README.md"))).toBe(true);
		expect(existsSync(resolve(root, "scripts/release.js"))).toBe(true);
		expect(existsSync(resolve(root, "scripts/inspection-report.ts"))).toBe(
			true,
		);
		expect(existsSync(resolve(root, "biome.json"))).toBe(true);
		expect(existsSync(resolve(root, "tsconfig.json"))).toBe(true);
		expect(existsSync(resolve(root, "tsconfig.build.json"))).toBe(true);
		expect(existsSync(resolve(root, "vitest.config.ts"))).toBe(true);
		expect(existsSync(resolve(root, ".github/workflows/ci.yml"))).toBe(true);
		expect(existsSync(resolve(root, ".github/workflows/release.yml"))).toBe(
			true,
		);
		expect(existsSync(resolve(root, ".github/workflows/pages.yml"))).toBe(true);
	});

	it("keeps published file references aligned with tracked files", () => {
		for (const file of packageJson.files) {
			expect(file).not.toBe("dist");
		}

		for (const file of Object.values(packageJson.bin)) {
			expect(existsSync(resolve(root, file))).toBe(true);
		}
	});

	it("does not keep the removed Bun scaffold source file", () => {
		expect(existsSync(resolve(root, "src/antora-markdown-exporter.ts"))).toBe(
			false,
		);
		expect(packageJson.scripts.unit).toContain("tests/unit");
		expect(packageJson.scripts.integration).toContain("tests/integration");
		expect(packageJson.scripts.reference).toContain(
			"tests/integration/reference-antora.test.ts",
		);
		expect(packageJson.scripts.release).toBe("bun scripts/release.js");
		expect(packageJson.scripts["docs:build"]).toBe(
			"node scripts/build-docs-site.mjs",
		);
		expect(packageJson.scripts["pdf:build"]).toContain("buildDocsPdf");
		expect(existsSync(resolve(root, "scripts/build-docs-site.mjs"))).toBe(true);
		expect(packageJson.scripts["export:modules"]).toBe(
			"bun scripts/export-antora-modules.ts",
		);
		expect(packageJson.scripts["inspect:report"]).toBe(
			"bun scripts/inspection-report.ts",
		);
		expect(existsSync(resolve(root, "scripts/export-antora-modules.ts"))).toBe(
			true,
		);
	});

	it("keeps module export machine-readable output explicit and opt-in", () => {
		expect(exportScript).toContain('format: "human" | "json"');
		expect(exportScript).toContain('let format: "human" | "json" = "human"');
		expect(exportScript).toContain('if (argument === "--json")');
		expect(exportScript).toContain(
			'if (argument === "--xref-fallback-label-style")',
		);
		expect(exportScript).toContain("Xref fallback labels:");
		expect(exportScript).toContain('if (options.format === "json")');
		expect(exportScript).not.toContain('if (argument === "--format")');
		expect(exportScript).toContain("Exported ");
		expect(exportScript).toContain("Output root:");
	});

	it("keeps the lightweight CLI wrapper honest about its current scope", () => {
		expect(cliEntrypoint).toContain("Current scope:");
		expect(cliEntrypoint).toContain(
			"--xref-fallback-label-style fragment-or-path",
		);
		expect(cliEntrypoint).toContain("only help and version output");
	});

	it("keeps package metadata wording aligned with the public package description", () => {
		expect(packageJson.description).toBe(
			"Antora Assembler based Markdown exporter with semantic IR, inspection surfaces, and explicit Markdown flavor rendering",
		);
		expect(describePackage()).toContain(packageJson.description);
		expect(packageJson.description.toLowerCase()).not.toContain("scaffold");
		expect(packageJson.description.toLowerCase()).not.toContain("placeholder");
		expect(releaseWorkflow).toContain("PACKAGE_DESCRIPTION=$(node -p");
		expect(releaseWorkflow).toContain("$" + "{PACKAGE_DESCRIPTION}.");
	});

	it("documents claim status, evidence, and support boundaries explicitly", () => {
		expect(readme).toContain("## Status Markers");
		expect(readme).toContain("evidence ledger");
		expect(readme).toContain("`Implemented`");
		expect(readme).toContain("`Test-enforced`");
		expect(readme).toContain("`CI-enforced`");
		expect(readme).toContain("`Intended`");

		expect(onboardingDoc).toContain("== Reading Status Markers");
		expect(onboardingDoc).toContain("`Implemented`::");
		expect(onboardingDoc).toContain("`Test-enforced`::");
		expect(onboardingDoc).toContain("`CI-enforced`::");
		expect(onboardingDoc).toContain("`Intended`::");
		expect(onboardingDoc).toContain("one contract family");
		expect(onboardingDoc).toContain(".github/workflows/release.yml");
		expect(onboardingDoc).toContain(".github/workflows/pages.yml");
		expect(onboardingDoc).toContain(
			"support matrix, proof matrix, and evidence ledger",
		);

		expect(manualDoc).toContain("=== Read Status Markers First");
		expect(manualDoc).toContain("=== Operator Prerequisites Matrix");
		expect(manualDoc).toContain("=== Canonical Contract Family");
		expect(manualDoc).toContain("=== Converter Support Matrix");
		expect(manualDoc).toContain("=== Evidence Ledger");
		expect(manualDoc).toContain("=== Proof Matrix");
		expect(manualDoc).toContain(".github/workflows/release.yml");
		expect(manualDoc).toContain(".github/workflows/pages.yml");
		expect(manualDoc).toContain("`Implemented`");
		expect(manualDoc).toContain("`Test-enforced`");
		expect(manualDoc).toContain("`CI-enforced`");
		expect(manualDoc).toContain("`Intended`");

		expect(introGoalsDoc).toContain("=== Claim Status Grammar");
		expect(qualityDoc).toContain("=== Proof Matrix");
		expect(qualityDoc).toContain("=== Evidence Ledger");
		expect(qualityDoc).toContain(
			"Broader converter coverage beyond the published matrix",
		);
	});

	it("keeps the structured assembly adapter as a first-class repository boundary", () => {
		expect(existsSync(resolve(root, "src/adapter/assembly-structure.ts"))).toBe(
			true,
		);
		expect(
			existsSync(resolve(root, "src/adapter/asciidoctor-structure.ts")),
		).toBe(true);
		expect(packageJson.dependencies?.["@asciidoctor/core"]).toBe("~2.2.8");
		expect(readme).toContain("semantic IR");
		expect(packageJson.description).toContain("semantic IR");
		expect(packageIndex).toContain("./adapter/asciidoctor-structure.js");
		expect(packageIndex).toContain("./adapter/assembly-structure.js");
		expect(
			readFileSync(
				resolve(
					root,
					"notes/Repository-owned assembly structure formalizes the exporter adapter boundary.md",
				),
				"utf8",
			),
		).toContain(
			"Repository-owned assembly structure formalizes the exporter adapter boundary",
		);
		expect(
			readFileSync(
				resolve(
					root,
					"docs/modules/architecture/partials/05_building_block_view.adoc",
				),
				"utf8",
			),
		).toContain("Structured assembly adapter");
		expect(
			readFileSync(
				resolve(
					root,
					"notes/Repository-owned assembly structure formalizes the exporter adapter boundary.md",
				),
				"utf8",
			),
		).toContain(
			"Repository-owned assembly structure formalizes the exporter adapter boundary",
		);
	});

	it("keeps the shipped extension runtime on the structured exporter path", () => {
		expect(extensionEntrypoint).toContain("./adapter/asciidoctor-structure.js");
		expect(extensionEntrypoint).toContain("./exporter/structured-to-ir.js");
		expect(extensionEntrypoint).not.toContain("./exporter/convert-assembly.js");
		expect(packageIndex).not.toContain("./exporter/convert-assembly.js");
		expect(extensionEntrypoint).toContain("renderAssemblyMarkdown");
		expect(extensionEntrypoint).toContain("extractAssemblyStructure");
		expect(extensionEntrypoint).toContain(
			"convertAssemblyStructureToMarkdownIR",
		);
		expect(existsSync(resolve(root, "src/exporter/convert-assembly.ts"))).toBe(
			false,
		);
		expect(existsSync(resolve(root, "src/exporter/include-metadata.ts"))).toBe(
			false,
		);
		expect(
			existsSync(
				resolve(
					root,
					"notes/Structured runtime cutover means the legacy text parser is now a deletion target.md",
				),
			),
		).toBe(false);
		expect(
			existsSync(
				resolve(
					root,
					"notes/Asciidoctor structural extraction should replace legacy text parsing incrementally.md",
				),
			),
		).toBe(false);
		expect(
			existsSync(
				resolve(
					root,
					"notes/Structural document mapping is a desired internal adapter not the documented Assembler handoff.md",
				),
			),
		).toBe(false);
		expect(
			readFileSync(
				resolve(
					root,
					"docs/modules/architecture/partials/06_runtime_view.adoc",
				),
				"utf8",
			),
		).toContain("convertAssemblyStructureToMarkdownIR(document)");
	});

	it("keeps CI and release workflows aligned with the develop/tag operating model", () => {
		expect(ciWorkflow).toContain("branches: [develop]");
		expect(ciWorkflow).toContain("ruby/setup-ruby@v1");
		expect(ciWorkflow).toContain("gem install asciidoctor-pdf --no-document");
		expect(ciWorkflow).toContain("apt-get install -y poppler-utils");
		expect(releaseWorkflow).toContain("tags:");
		expect(releaseWorkflow).toContain('- "v*"');
		expect(releaseWorkflow).toContain("origin/develop$");
		expect(releaseWorkflow).toContain('head_branch=="develop"');
		expect(releaseWorkflow).toContain("git push origin main");
	});

	it("keeps GitHub Pages deployment aligned with the published docs site", () => {
		expect(pagesWorkflow).toContain("workflow_run:");
		expect(pagesWorkflow).toContain('workflows: ["Release"]');
		expect(pagesWorkflow).not.toContain("workflow_dispatch:");
		expect(pagesWorkflow).toContain("conclusion == 'success'");
		expect(pagesWorkflow).toContain("event == 'push'");
		expect(pagesWorkflow).toContain("ref: main");
		expect(pagesWorkflow).toContain("actions/configure-pages@v5");
		expect(pagesWorkflow).toContain("ruby/setup-ruby@v1");
		expect(pagesWorkflow).toContain(
			"gem install asciidoctor-pdf --no-document",
		);
		expect(pagesWorkflow).toContain("bun run docs:build");
		expect(pagesWorkflow).toContain("actions/upload-pages-artifact@v3");
		expect(pagesWorkflow).toContain("actions/deploy-pages@v4");
		expect(pagesWorkflow).toContain("path: build/site");
		expect(releaseWorkflow).toContain("git push origin main");
		expect(antoraPlaybook).toContain(
			"url: https://wstein.github.io/antora-markdown-exporter",
		);
	});

	it("keeps AGENT guidance aligned with the real extension runtime", () => {
		expect(agentGuidance).toContain("real Antora extension entrypoint");
		expect(agentGuidance).toContain("@antora/assembler.configure()");
		expect(agentGuidance).toContain(
			"explicit machine-readable module-export mode",
		);
		expect(agentGuidance).not.toContain("scaffolded extension entrypoint");
		expect(agentGuidance).not.toContain("not full Antora registration");
	});
});
