import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

describe("inspection report script", () => {
	it("emits machine-readable JSON for CI validation", () => {
		const inputPath = resolve(
			root,
			"tests/fixtures/includes-invalid-steps/input.adoc",
		);
		const result = spawnSync(
			"bun",
			["scripts/inspection-report.ts", inputPath, "--fail-on-diagnostics"],
			{
				cwd: root,
				encoding: "utf8",
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toBe("");
		const report = JSON.parse(result.stdout) as {
			inputPath: string;
			report: {
				includeDiagnostics: Array<{
					diagnostic: {
						code: string;
						message: string;
						source: string;
					};
					target: string;
				}>;
				xrefTargets: unknown[];
			};
			sourcePath: string;
		};

		expect(report.inputPath).toBe(inputPath);
		expect(report.sourcePath).toBe(inputPath);
		expect(report.report.includeDiagnostics).toEqual([
			{
				target: "partials/snippet.adoc",
				diagnostic: {
					code: "invalid-line-step",
					message: "include line steps must be positive integers",
					source: "1..5..0",
				},
			},
			{
				target: "partials/snippet.adoc",
				diagnostic: {
					code: "invalid-line-range",
					message: "include line selectors must be positive integers or ranges",
					source: "1..5..bad",
				},
			},
		]);
		expect(report.report.xrefTargets).toEqual([]);
	});

	it("accepts stdin and can emit GitHub Actions annotations", () => {
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
				"--fail-on-diagnostics",
			],
			{
				cwd: root,
				encoding: "utf8",
				input:
					"== Validation\n\ninclude::partials/snippet.adoc[lines=1..5..0,indent=-1]\n",
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("::error file=/virtual/project/page.adoc");
		expect(result.stdout).toContain("title=include%3Apartials/snippet.adoc");
		expect(result.stdout).toContain(
			"invalid-line-step%3A include line steps must be positive integers",
		);
		expect(result.stdout).toContain(
			"invalid-indent%3A include indent must be a positive integer",
		);
		expect(result.stdout).toContain("::notice title=inspection-report::");
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
			report: {
				includeDirectives: unknown[];
			};
			sourcePath: string;
		};

		expect(report.inputPath).toBe(inputPath);
		expect(report.sourcePath).toBe(sourcePath);
		expect(report.report.includeDirectives).toEqual([]);
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
