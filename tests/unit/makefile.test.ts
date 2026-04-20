import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const makefile = readFileSync(resolve(__dirname, "../../Makefile"), "utf8");

describe("Makefile package manager policy", () => {
	it("uses one explicit package manager for script execution", () => {
		expect(makefile).toContain("PACKAGER ?= bun");
		expect(makefile).toContain("NODE ?= node");
		expect(makefile).toContain("$(PACKAGER) install");
		expect(makefile).toContain("$(PACKAGER) run build");
		expect(makefile).toContain("$(PACKAGER) run test");
		expect(makefile).toContain("$(PACKAGER) run check");
		expect(makefile).toContain("$(PACKAGER) run lint");
	});

	it("does not keep lockfile-driven or deprecated fallbacks", () => {
		expect(makefile).not.toContain("bun.lockb");
		expect(makefile).not.toContain("bun.lock");
		expect(makefile).not.toContain("$(BUN)");
		expect(makefile).not.toContain("$(NPM)");
		expect(makefile).not.toContain("pnpm");
		expect(makefile).not.toContain("yarn");
	});
});
