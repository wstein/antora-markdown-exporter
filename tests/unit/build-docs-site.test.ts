import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	createPdfBookSource,
	getPdfOutputPath,
	stripDocumentTitle,
} from "../../scripts/build-docs-site.mjs";

const root = resolve(__dirname, "../..");

describe("build docs site script", () => {
	it("strips a document title but keeps the body", () => {
		expect(stripDocumentTitle("= Sample\n\nBody")).toBe("\nBody");
	});

	it("assembles the portable PDF book from the docs modules", () => {
		const source = createPdfBookSource(root);

		expect(source).toContain("= Antora Markdown Exporter Documentation");
		expect(source).toContain("== Documentation");
		expect(source).toContain("== Architecture");
		expect(source).toContain("== Manual");
		expect(source).toContain("== Onboarding");
		expect(source).toContain(
			"include::../docs/modules/architecture/partials/01_introduction_and_goals.adoc[]",
		);
	});

	it("writes the PDF into the published site directory", () => {
		expect(getPdfOutputPath(root)).toBe(
			resolve(
				root,
				"build/site/antora-markdown-exporter/antora-markdown-exporter.pdf",
			),
		);
	});
});
