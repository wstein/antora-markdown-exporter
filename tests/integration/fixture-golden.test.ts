import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";
import { renderGfm } from "../../src/markdown/render/index.js";

const fixturesRoot = resolve(__dirname, "../fixtures");
const fixtureNames = (await readdir(fixturesRoot, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

describe("fixture golden tests", () => {
	for (const fixtureName of fixtureNames) {
		it(`renders ${fixtureName} to the expected GFM output`, async () => {
			const fixtureDir = resolve(fixturesRoot, fixtureName);
			const input = await readFile(resolve(fixtureDir, "input.adoc"), "utf8");
			const expected = await readFile(
				resolve(fixtureDir, "expected.gfm.md"),
				"utf8",
			);

			const ir = convertAssemblyToMarkdownIR(input);
			const normalized = normalizeMarkdownIR(ir);
			const rendered = renderGfm(normalized);

			expect(rendered).toBe(expected);
		});
	}
});
