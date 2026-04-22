import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildDocsPdf,
	getPdfOutputPath,
} from "../../scripts/build-docs-site.mjs";

const root = resolve(__dirname, "../..");

describe("build docs site script", () => {
	it("writes each PDF into the published site directory", () => {
		expect(getPdfOutputPath(root, "documentation")).toBe(
			resolve(root, "build/site/antora-markdown-exporter/documentation.pdf"),
		);
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

	it("exposes a dedicated pdf build function", () => {
		expect(typeof buildDocsPdf).toBe("function");
	});
});
