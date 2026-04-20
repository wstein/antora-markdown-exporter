import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";
import type { MarkdownFlavorName } from "../../src/markdown/flavor.js";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";
import { renderMarkdown } from "../../src/markdown/render/index.js";

const fixturesRoot = resolve(__dirname, "../fixtures");
const fixtureNames = (await readdir(fixturesRoot, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

describe("fixture golden tests", () => {
	for (const fixtureName of fixtureNames) {
		it(`renders ${fixtureName} to each expected markdown flavor`, async () => {
			const fixtureDir = resolve(fixturesRoot, fixtureName);
			const input = await readFile(resolve(fixtureDir, "input.adoc"), "utf8");
			const fixtureFiles = await readdir(fixtureDir);
			const expectedFiles = fixtureFiles
				.filter((file) => file.startsWith("expected.") && file.endsWith(".md"))
				.sort();

			const ir = convertAssemblyToMarkdownIR(input);
			const normalized = normalizeMarkdownIR(ir);

			for (const expectedFile of expectedFiles) {
				const flavor = expectedFile.slice(
					"expected.".length,
					".md".length * -1,
				) as MarkdownFlavorName;
				const expected = await readFile(
					resolve(fixtureDir, expectedFile),
					"utf8",
				);
				const rendered = renderMarkdown(normalized, flavor);
				expect(rendered).toBe(expected);
			}
		});
	}
});
