import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

describe("inspection report script integration", () => {
	it("keeps the JSON report shape stable end to end", () => {
		const inputPath = resolve(
			root,
			"tests/fixtures/includes-invalid-steps/input.adoc",
		);
		const output = execFileSync(
			"bun",
			["scripts/inspection-report.ts", inputPath],
			{
				cwd: root,
				encoding: "utf8",
			},
		);
		const report = JSON.parse(output) as {
			inputPath: string;
			report: {
				includeDiagnostics: unknown[];
				includeDirectives: Array<{
					provenance?: {
						includeRootDir: string;
						includingSourcePath: string;
						inclusionStack: string[];
						resolvedPath?: string;
					};
				}>;
				xrefTargets: unknown[];
				xrefs: unknown[];
			};
			sourcePath: string;
		};

		expect({
			...report,
			inputPath: report.inputPath.replace(root, "<root>"),
			report: {
				...report.report,
				includeDirectives: report.report.includeDirectives.map((directive) => ({
					...directive,
					provenance:
						directive.provenance === undefined
							? undefined
							: {
									...directive.provenance,
									includeRootDir: directive.provenance.includeRootDir.replace(
										root,
										"<root>",
									),
									includingSourcePath:
										directive.provenance.includingSourcePath.replace(
											root,
											"<root>",
										),
									inclusionStack: directive.provenance.inclusionStack.map(
										(path) => path.replace(root, "<root>"),
									),
									resolvedPath: directive.provenance.resolvedPath?.replace(
										root,
										"<root>",
									),
								},
				})),
			},
			sourcePath: report.sourcePath.replace(root, "<root>"),
		}).toMatchInlineSnapshot(`
			{
			  "inputPath": "<root>/tests/fixtures/includes-invalid-steps/input.adoc",
			  "report": {
			    "includeDiagnostics": [
			      {
			        "diagnostic": {
			          "code": "invalid-line-step",
			          "message": "include line steps must be positive integers",
			          "source": "1..5..0",
			        },
			        "target": "partials/snippet.adoc",
			      },
			      {
			        "diagnostic": {
			          "code": "invalid-line-range",
			          "message": "include line selectors must be positive integers or ranges",
			          "source": "1..5..bad",
			        },
			        "target": "partials/snippet.adoc",
			      },
			    ],
			    "includeDirectives": [
			      {
			        "attributes": {
			          "lines": "1..5..0;1..5..bad",
			        },
			        "diagnostics": [
			          {
			            "code": "invalid-line-step",
			            "message": "include line steps must be positive integers",
			            "source": "1..5..0",
			          },
			          {
			            "code": "invalid-line-range",
			            "message": "include line selectors must be positive integers or ranges",
			            "source": "1..5..bad",
			          },
			        ],
			        "provenance": {
			          "depth": 0,
			          "includeRootDir": "<root>/tests/fixtures/includes-invalid-steps",
			          "includingSourcePath": "<root>/tests/fixtures/includes-invalid-steps/input.adoc",
			          "inclusionStack": [
			            "<root>/tests/fixtures/includes-invalid-steps/input.adoc",
			          ],
			          "resolvedPath": "<root>/tests/fixtures/includes-invalid-steps/partials/snippet.adoc",
			        },
			        "target": "partials/snippet.adoc",
			        "type": "includeDirective",
			      },
			    ],
			    "xrefTargets": [],
			    "xrefs": [],
			  },
			  "sourcePath": "<root>/tests/fixtures/includes-invalid-steps/input.adoc",
			}
		`);
	});
});
