import { describe, expect, it } from "vitest";
import {
	collectMarkdownInspectionRagDocument,
	createMarkdownConverter,
	describePackage,
	exportAntoraModules,
	PACKAGE_NAME,
	register,
	resolveAntoraMarkdownExportDefaults,
	runAntoraAssembler,
} from "../../src/index.js";

describe("public extension API", () => {
	it("exposes package metadata through the root entrypoint", () => {
		expect(PACKAGE_NAME).toBe("@wsmy/antora-markdown-exporter");
		expect(describePackage()).toBe(
			"Antora Assembler based Markdown exporter with semantic IR, inspection surfaces, and explicit Markdown flavor rendering.",
		);
	});

	it("exports the real Antora extension entrypoints", () => {
		expect(typeof createMarkdownConverter).toBe("function");
		expect(typeof register).toBe("function");
	});

	it("exports the stable Antora module-export library entrypoints", () => {
		expect(typeof exportAntoraModules).toBe("function");
		expect(typeof resolveAntoraMarkdownExportDefaults).toBe("function");
		expect(typeof runAntoraAssembler).toBe("function");
	});

	it("exports the agent-ready inspection helper from the root entrypoint", () => {
		expect(typeof collectMarkdownInspectionRagDocument).toBe("function");
	});
});
