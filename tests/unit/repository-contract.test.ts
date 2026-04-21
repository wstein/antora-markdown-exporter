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
const ciWorkflow = readFileSync(
	resolve(root, ".github/workflows/ci.yml"),
	"utf8",
);
const releaseWorkflow = readFileSync(
	resolve(root, ".github/workflows/release.yml"),
	"utf8",
);
const antoraPlaybook = readFileSync(
	resolve(root, "antora-playbook.yml"),
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
		expect(existsSync(resolve(root, ".github/workflows/pages.yml"))).toBe(
			false,
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
		expect(packageJson.scripts.release).toBe("bun scripts/release.js");
		expect(packageJson.scripts["inspect:report"]).toBe(
			"bun scripts/inspection-report.ts",
		);
	});

	it("keeps CI and release workflows aligned with the develop/tag operating model", () => {
		expect(ciWorkflow).toContain("branches: [develop]");
		expect(releaseWorkflow).toContain("tags:");
		expect(releaseWorkflow).toContain('- "v*"');
		expect(releaseWorkflow).toContain("origin/develop$");
		expect(releaseWorkflow).toContain('head_branch=="develop"');
		expect(releaseWorkflow).toContain("git push origin main");
	});

	it("keeps GitHub Pages deployment aligned with the release workflow", () => {
		expect(releaseWorkflow).toContain("pages-build:");
		expect(releaseWorkflow).toContain("pages-deploy:");
		expect(releaseWorkflow).toContain("actions/configure-pages@v5");
		expect(releaseWorkflow).toContain("actions/upload-pages-artifact@v3");
		expect(releaseWorkflow).toContain("actions/deploy-pages@v4");
		expect(releaseWorkflow).toContain("path: build/site");
		expect(releaseWorkflow).toContain("needs: gate");
		expect(releaseWorkflow).toContain("promote-main");
		expect(antoraPlaybook).toContain(
			"url: https://wstein.github.io/antora-markdown-exporter",
		);
	});
});
