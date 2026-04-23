import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

describe("inspection report script integration", () => {
	it("keeps the JSON report shape stable end to end", () => {
		const inputPath = resolve(root, "tests/fixtures/xrefs/input.adoc");
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
				xrefTargets: Array<{ raw: string; path: string; fragment?: string }>;
				xrefs: Array<{ url: string }>;
			};
			sourcePath: string;
		};

		expect({
			...report,
			inputPath: report.inputPath.replace(root, "<root>"),
			sourcePath: report.sourcePath.replace(root, "<root>"),
		}).toMatchInlineSnapshot(`
			{
			  "inputPath": "<root>/tests/fixtures/xrefs/input.adoc",
			  "report": {
			    "xrefTargets": [
			      {
			        "path": "install.adoc",
			        "raw": "install.html",
			      },
			      {
			        "fragment": "overview",
			        "path": "",
			        "raw": "#overview",
			      },
			    ],
			    "xrefs": [
			      {
			        "children": [
			          {
			            "type": "text",
			            "value": "Install guide",
			          },
			        ],
			        "target": {
			          "path": "install.adoc",
			          "raw": "install.html",
			        },
			        "type": "xref",
			        "url": "install.html",
			      },
			      {
			        "children": [
			          {
			            "type": "text",
			            "value": "Overview",
			          },
			        ],
			        "target": {
			          "fragment": "overview",
			          "path": "",
			          "raw": "#overview",
			        },
			        "type": "xref",
			        "url": "#overview",
			      },
			    ],
			  },
			  "sourcePath": "<root>/tests/fixtures/xrefs/input.adoc",
			}
		`);
	});

	it("keeps the GitHub Actions output stable end to end", () => {
		const inputPath = resolve(root, "tests/fixtures/xrefs/input.adoc");
		const result = spawnSync(
			"bun",
			["scripts/inspection-report.ts", inputPath, "--format", "github-actions"],
			{
				cwd: root,
				encoding: "utf8",
			},
		);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout.replaceAll(root, "<root>")).toMatchInlineSnapshot(`
			"::notice title=inspection-report::xrefs=2 xrefTargets=2 sourcePath=<root>/tests/fixtures/xrefs/input.adoc
			"
		`);
	});
});
