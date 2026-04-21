import { describe, expect, it } from "vitest";
import {
	createMarkdownConverter,
	describePackage,
	PACKAGE_NAME,
	register,
} from "../../src/index.js";

describe("public extension API", () => {
	it("exposes package metadata through the root entrypoint", () => {
		expect(PACKAGE_NAME).toBe("@wsmy/antora-markdown-exporter");
		expect(describePackage()).toContain("Markdown exporter");
	});

	it("exports the real Antora extension entrypoints", () => {
		expect(typeof createMarkdownConverter).toBe("function");
		expect(typeof register).toBe("function");
	});
});
