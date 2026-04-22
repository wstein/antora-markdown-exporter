import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

describe("inspection report script", () => {
	it("emits machine-readable JSON for structured inspection flows", () => {
		const inputPath = resolve(root, "tests/fixtures/xrefs/input.adoc");
		const result = spawnSync(
			"bun",
			["scripts/inspection-report.ts", inputPath],
			{
				cwd: root,
				encoding: "utf8",
			},
		);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		const report = JSON.parse(result.stdout) as {
			inputPath: string;
			report: {
				xrefTargets: Array<{ raw: string }>;
				xrefs: Array<{ url: string }>;
			};
			sourcePath: string;
		};

		expect(report.inputPath).toBe(inputPath);
		expect(report.sourcePath).toBe(inputPath);
		expect(report.report.xrefTargets).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ raw: "install.html", path: "install.adoc" }),
				expect.objectContaining({ raw: "#overview" }),
			]),
		);
		expect(report.report.xrefs).toHaveLength(2);
	});

	it("accepts stdin and emits GitHub Actions notices", () => {
		const sourcePath = "/virtual/project/page.adoc";
		const result = spawnSync(
			"bun",
			[
				"scripts/inspection-report.ts",
				"--stdin",
				"--source-path",
				sourcePath,
				"--format",
				"github-actions",
			],
			{
				cwd: root,
				encoding: "utf8",
				input: "== Validation\n\nSee xref:install.adoc#cli[install].\n",
			},
		);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("::notice title=inspection-report::");
		expect(result.stdout).toContain("xrefs=1");
		expect(result.stdout).toContain("xrefTargets=1");
		expect(result.stdout).toContain(`sourcePath=${sourcePath}`);
	});

	it("accepts an explicit source path in the emitted report", () => {
		const inputPath = resolve(root, "tests/fixtures/sample/input.adoc");
		const sourcePath = "/virtual/component/modules/ROOT/pages/sample.adoc";
		const output = execFileSync(
			"bun",
			["scripts/inspection-report.ts", inputPath, "--source-path", sourcePath],
			{
				cwd: root,
				encoding: "utf8",
			},
		);
		const report = JSON.parse(output) as {
			inputPath: string;
			report: { xrefs: unknown[] };
			sourcePath: string;
		};

		expect(report.inputPath).toBe(inputPath);
		expect(report.sourcePath).toBe(sourcePath);
		expect(report.report.xrefs).toEqual([]);
	});

	it("rejects mixed stdin and file inputs with a usage message", () => {
		const inputPath = resolve(root, "tests/fixtures/sample/input.adoc");
		const result = spawnSync(
			"bun",
			["scripts/inspection-report.ts", "--stdin", inputPath],
			{
				cwd: root,
				encoding: "utf8",
				input: "== Ignored\n",
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"Provide either an input path or --stdin, not both",
		);
		expect(result.stderr).toContain("Usage: bun scripts/inspection-report.ts");
	});
});
