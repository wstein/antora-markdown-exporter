import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildDocsPdf,
	createModulePdfSource,
	getPdfModuleNames,
	getPdfOutputPath,
	stripDocumentTitle,
} from "../../scripts/build-docs-site.mjs";

const root = resolve(__dirname, "../..");

describe("build docs site script", () => {
	it("strips a document title but keeps the body", () => {
		expect(stripDocumentTitle("= Sample\n\nBody")).toBe("\nBody");
	});

	it("assembles the architecture PDF from the module page defined in Antora navigation", () => {
		const source = createModulePdfSource(root, "architecture");

		expect(source).toContain("= Architecture");
		expect(source).toContain("== Introduction and Goals");
		expect(source).toContain("== Reference Notes");
	});

	it("assembles the manual PDF from the module page", () => {
		const source = createModulePdfSource(root, "manual");

		expect(source).toContain("= Manual");
		expect(source).toContain("== Core Workflows");
	});

	it("assembles the onboarding PDF from the module page", () => {
		const source = createModulePdfSource(root, "onboarding");

		expect(source).toContain("= Onboarding");
		expect(source).toContain("== Mental Models");
	});

	it("writes each PDF into the published site directory", () => {
		expect(getPdfOutputPath(root, "architecture")).toBe(
			resolve(root, "build/site/antora-markdown-exporter/architecture.pdf"),
		);
		expect(getPdfOutputPath(root, "manual")).toBe(
			resolve(root, "build/site/antora-markdown-exporter/manual.pdf"),
		);
		expect(getPdfOutputPath(root, "onboarding")).toBe(
			resolve(root, "build/site/antora-markdown-exporter/onboarding.pdf"),
		);
	});

	it("exposes the supported PDF modules", () => {
		expect(getPdfModuleNames()).toEqual([
			"architecture",
			"manual",
			"onboarding",
		]);
	});

	it("exposes a dedicated pdf build function", () => {
		expect(typeof buildDocsPdf).toBe("function");
	});
});
