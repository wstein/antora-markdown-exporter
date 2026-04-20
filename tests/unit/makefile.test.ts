import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const makefile = readFileSync(resolve(__dirname, "../../Makefile"), "utf8");

describe("Makefile package manager policy", () => {
	it("uses one explicit package manager for script execution", () => {
		expect(makefile).toContain("PM ?= bun");
		expect(makefile).toContain("$(PM) install");
		expect(makefile).toContain("$(PM) run build");
		expect(makefile).toContain("$(PM) run test");
		expect(makefile).toContain("$(PM) run unit");
		expect(makefile).toContain("$(PM) run integration");
		expect(makefile).toContain("$(PM) run reference");
		expect(makefile).toContain("$(PM) run check");
		expect(makefile).toContain("$(PM) run lint");
		expect(makefile).toContain("$(PM) run format");
		expect(makefile).toContain("$(PM) run fix");
		expect(makefile).toContain("$(PM) run release");
	});

	it("does not keep detection logic or deprecated fallbacks", () => {
		expect(makefile).not.toContain("readFileSync");
		expect(makefile).not.toContain("typecheck");
		expect(makefile).not.toContain("Skipping check");
		expect(makefile).not.toContain("Skipping lint");
		expect(makefile).not.toContain("bun.lockb");
		expect(makefile).not.toContain("bun.lock");
		expect(makefile).not.toContain("$(BUN)");
		expect(makefile).not.toContain("$(NPM)");
		expect(makefile).not.toContain("pnpm");
		expect(makefile).not.toContain("yarn");
	});
});
