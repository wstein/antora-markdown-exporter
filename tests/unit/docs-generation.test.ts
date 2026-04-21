import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	ARCHITECTURE_THEMES,
	demoteHeadings,
	generateArchitectureDocs,
	parseNote,
	slugify,
} from "../../scripts/generate-architecture-docs.ts";

const root = resolve(__dirname, "../..");
const notesDir = resolve(root, "notes");
const scriptPath = resolve(root, "scripts/generate-architecture-docs.ts");

describe("docs generation sequencing", () => {
	it("produces a stable, read-only header and bash regeneration block", async () => {
		const output = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});

		expect(
			output.startsWith("<!-- GENERATED FILE — DO NOT EDIT DIRECTLY -->"),
		).toBe(true);
		expect(output).toContain(
			"<!-- Source: notes/**  Generator: scripts/generate-architecture-docs.ts -->",
		);
		expect(output).toContain("<!-- Regenerate with: bun run docs:generate -->");
		expect(output).toContain("```bash\nbun run docs:generate\n```");
		expect(output.endsWith("\n")).toBe(true);
	});

	it("emits each theme and referenced note title as headings", async () => {
		const output = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});

		for (const theme of ARCHITECTURE_THEMES) {
			expect(output).toContain(`## ${theme.title}\n`);
			for (const note of theme.notes) {
				expect(output).toContain(`### ${note}\n`);
			}
		}
	});

	it("links the table of contents to every theme and note anchor", async () => {
		const output = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});

		for (const theme of ARCHITECTURE_THEMES) {
			expect(output).toContain(`- [${theme.title}](#${slugify(theme.title)})`);
			for (const note of theme.notes) {
				expect(output).toContain(`  - [${note}](#${slugify(note)})`);
			}
		}
	});

	it("preserves authored summary text verbatim from canonical notes", async () => {
		const output = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});

		expect(output).toContain(
			"The Markdown IR is the canonical render boundary for the repository",
		);
		expect(output).toContain(
			"Transparent fenced extensions preserve authored language semantics because",
		);
		expect(output).toContain(
			"Raw HTML is a controlled fallback mechanism for constructs that Markdown cannot represent cleanly",
		);
	});

	it("demotes note body headings so What/Why/How/Links become fourth-level", async () => {
		const output = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});

		expect(output).toContain("#### What");
		expect(output).toContain("#### Why");
		expect(output).toContain("#### How");
		expect(output).toContain("#### Links");
		expect(output).not.toMatch(/\n## What\n/);
	});

	it("emits themes in curated order without alphabetizing them", async () => {
		const output = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});

		const themeOrder = ARCHITECTURE_THEMES.map((theme) =>
			output.indexOf(`## ${theme.title}\n`),
		);

		for (const index of themeOrder) {
			expect(index).toBeGreaterThan(-1);
		}

		const sorted = [...themeOrder].sort((left, right) => left - right);
		expect(themeOrder).toEqual(sorted);
	});

	it("produces identical output when invoked repeatedly", async () => {
		const first = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});
		const second = await generateArchitectureDocs({
			notesDir,
			order: ARCHITECTURE_THEMES,
		});

		expect(first).toBe(second);
	});

	it("covers every theme declared in the curated ordering", () => {
		const expectedThemes = [
			"Foundational Principles",
			"Exporter Pipeline",
			"Markdown IR Boundary",
			"Renderer And Flavor Model",
			"Fallback Policy",
			"Transparent Extensions",
			"Xref Lowering",
			"Include Handling",
			"Testing And Validation",
			"Release And Tooling",
		];
		expect(ARCHITECTURE_THEMES.map((theme) => theme.title)).toEqual(
			expectedThemes,
		);
	});

	it("fails with a descriptive error when a referenced note is missing", async () => {
		await expect(
			generateArchitectureDocs({
				notesDir,
				order: [
					{
						title: "Imaginary",
						notes: ["this-note-does-not-exist"],
					},
				],
			}),
		).rejects.toThrow(/this-note-does-not-exist/);
	});
});

describe("note parsing", () => {
	it("rejects notes without a substantive summary paragraph", () => {
		const source = [
			"---",
			"id: 20260421000000",
			"aliases: []",
			"tags: []",
			"---",
			"tiny.",
			"",
			"## What",
			"",
			"Body.",
		].join("\n");

		expect(() => parseNote(source, "tiny")).toThrow(
			/does not start with a substantive summary paragraph/,
		);
	});

	it("returns the full body without the frontmatter fence", () => {
		const source = [
			"---",
			"id: 20260421000000",
			"---",
			"This note summary contains at least six words.",
			"",
			"## What",
			"",
			"Detail.",
			"",
		].join("\n");

		const parsed = parseNote(source, "sample");

		expect(parsed.title).toBe("sample");
		expect(parsed.summary).toBe(
			"This note summary contains at least six words.",
		);
		expect(parsed.body.startsWith("---")).toBe(false);
		expect(parsed.body).toContain("## What");
		expect(parsed.body).toContain("Detail.");
	});
});

describe("heading and slug helpers", () => {
	it("demotes headings by the requested number of levels", () => {
		const body = ["## What", "", "Detail.", "", "## Why", "", "More."].join(
			"\n",
		);

		expect(demoteHeadings(body, 2)).toContain("#### What");
		expect(demoteHeadings(body, 2)).toContain("#### Why");
	});

	it("caps demotion at heading level six", () => {
		expect(demoteHeadings("###### Deep", 2)).toBe("###### Deep");
		expect(demoteHeadings("##### Deep", 2)).toBe("###### Deep");
	});

	it("ignores lines that only look like headings", () => {
		const body = ["##notaheading", "## Real"].join("\n");
		const demoted = demoteHeadings(body, 2);
		expect(demoted).toContain("##notaheading");
		expect(demoted).toContain("#### Real");
	});

	it("slugifies titles into stable anchor fragments", () => {
		expect(slugify("Foundational Principles")).toBe("foundational-principles");
		expect(slugify("Markdown IR Boundary")).toBe("markdown-ir-boundary");
		expect(slugify("Xref target resolution is a separate lowering phase")).toBe(
			"xref-target-resolution-is-a-separate-lowering-phase",
		);
	});
});

describe("docs generation CLI", () => {
	it("reports up-to-date when the committed file matches the notes", () => {
		const result = spawnSync("bun", [scriptPath, "--check"], {
			cwd: root,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Generated docs are up to date");
	});

	it("fails with a remediation hint when the committed file drifts", async () => {
		const tempDir = resolve(
			root,
			`tests/fixtures/.tmp-docs-drift-${process.pid}-${Date.now()}`,
		);
		await mkdir(tempDir, { recursive: true });
		const driftedPath = join(tempDir, "architecture.md");
		await writeFile(driftedPath, "stale output\n");

		try {
			const result = spawnSync(
				"bun",
				[scriptPath, "--check", "--output", driftedPath],
				{ cwd: root, encoding: "utf8" },
			);

			expect(result.status).toBe(1);
			expect(result.stderr).toContain("Generated docs are out of date");
			expect(result.stderr).toContain("bun run docs:generate");

			const unchanged = await readFile(driftedPath, "utf8");
			expect(unchanged).toBe("stale output\n");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
