import { describe, expect, it } from "vitest";
import {
	createAntoraExtensionScaffold,
	describePackage,
	PACKAGE_NAME,
} from "../../src/index.js";

describe("public scaffold API", () => {
	it("exposes package metadata through the root entrypoint", () => {
		expect(PACKAGE_NAME).toBe("@wsmy/antora-markdown-exporter");
		expect(describePackage()).toContain("GitHub Flavored Markdown");
	});

	it("signals scaffold maturity in the extension helper", () => {
		expect(
			createAntoraExtensionScaffold({
				feature: "example",
			}),
		).toEqual({
			kind: "scaffold",
			name: "@wsmy/antora-markdown-exporter",
			version: "0.1.0-dev",
			config: {
				feature: "example",
			},
		});
	});
});
