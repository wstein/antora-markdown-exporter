import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	convertAssemblyStructureToMarkdownIR,
	extractAssemblyStructure,
} from "../../src/index.js";
import type { MarkdownFlavorName } from "../../src/markdown/flavor.js";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";
import { renderGfm, renderMarkdown } from "../../src/markdown/render/index.js";

interface ReferenceManifestEntry {
	coverage: string[];
	expectations: {
		nodeTypes: string[];
		renderedByFlavor?: Partial<
			Record<
				MarkdownFlavorName,
				{
					contains: string[];
					excludes?: string[];
				}
			>
		>;
		renderedContains: string[];
		renderedExcludes?: string[];
	};
	id: string;
	localPath: string;
	rationale: string;
	sha256: string;
	sourceCapturedAt: string;
	sourcePath: string;
	sourceProject: string;
	sourceUrl: string;
}

const root = resolve(__dirname, "../..");
const manifest = JSON.parse(
	await readFile(resolve(root, "tests/reference/manifest.json"), "utf8"),
) as ReferenceManifestEntry[];

describe("reference Antora compatibility tests", () => {
	for (const entry of manifest.filter(
		(entry) => !entry.id.startsWith("antora-include-"),
	)) {
		it(`preserves semantic invariants for ${entry.id}`, async () => {
			const input = await readFile(resolve(root, entry.localPath), "utf8");
			const digest = createHash("sha256").update(input).digest("hex");
			const ir = convertAssemblyStructureToMarkdownIR(
				extractAssemblyStructure(input, {
					sourcePath: resolve(root, entry.localPath),
				}),
			);
			const normalized = normalizeMarkdownIR(ir);
			const rendered = renderGfm(normalized);

			expect(digest).toBe(entry.sha256);
			expect(entry.sourceProject.length).toBeGreaterThan(0);
			expect(entry.sourceUrl).toMatch(/^https?:\/\//);
			expect(entry.sourcePath).toContain(".adoc");
			expect(entry.sourceCapturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(entry.coverage.length).toBeGreaterThan(0);
			expect(entry.rationale.length).toBeGreaterThan(20);

			expect(ir.type).toBe("document");

			for (const nodeType of entry.expectations.nodeTypes) {
				expect(ir.children.some((child) => child.type === nodeType)).toBe(true);
			}

			for (const marker of entry.expectations.renderedContains) {
				expect(rendered).toContain(marker);
			}

			for (const marker of entry.expectations.renderedExcludes ?? []) {
				expect(rendered).not.toContain(marker);
			}

			for (const [flavor, expectations] of Object.entries(
				entry.expectations.renderedByFlavor ?? {},
			) as Array<
				[
					MarkdownFlavorName,
					{
						contains: string[];
						excludes?: string[];
					},
				]
			>) {
				const flavoredRender = renderMarkdown(normalized, flavor);
				for (const marker of expectations.contains) {
					expect(flavoredRender).toContain(marker);
				}

				for (const marker of expectations.excludes ?? []) {
					expect(flavoredRender).not.toContain(marker);
				}
			}
		});
	}
});
