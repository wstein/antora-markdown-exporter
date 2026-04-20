import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const packageJson = JSON.parse(
	readFileSync(resolve(root, "package.json"), "utf8"),
) as {
	bin: Record<string, string>;
	files: string[];
	scripts: Record<string, string>;
};

describe("repository contract", () => {
	it("keeps referenced package files in the tree", () => {
		expect(existsSync(resolve(root, "Makefile"))).toBe(true);
		expect(existsSync(resolve(root, "LICENSE"))).toBe(true);
		expect(existsSync(resolve(root, "README.md"))).toBe(true);
		expect(existsSync(resolve(root, "biome.json"))).toBe(true);
		expect(existsSync(resolve(root, "tsconfig.json"))).toBe(true);
		expect(existsSync(resolve(root, "tsconfig.build.json"))).toBe(true);
		expect(existsSync(resolve(root, "vitest.config.ts"))).toBe(true);
		expect(existsSync(resolve(root, ".github/workflows/ci.yml"))).toBe(true);
		expect(existsSync(resolve(root, ".github/workflows/release.yml"))).toBe(
			true,
		);
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
	});
});
