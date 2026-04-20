import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";

const fixtureDir = resolve(__dirname, "../fixtures/sample");

describe("fixture golden tests", () => {
	it("loads a sample fixture and produces a document IR", async () => {
		const input = await readFile(resolve(fixtureDir, "input.adoc"), "utf8");
		const expected = await readFile(
			resolve(fixtureDir, "expected.gfm.md"),
			"utf8",
		);

		const ir = convertAssemblyToMarkdownIR(input);

		expect(ir.type).toBe("document");
		expect(expected).toContain("Sample document");
	});
});
