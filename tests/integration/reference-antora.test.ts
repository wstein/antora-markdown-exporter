import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { convertAssemblyToMarkdownIR } from "../../src/exporter/convert-assembly.js";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";
import { renderGfm } from "../../src/markdown/render/index.js";

interface ReferenceManifestEntry {
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
	for (const entry of manifest) {
		it(`preserves semantic invariants for ${entry.id}`, async () => {
			const input = await readFile(resolve(root, entry.localPath), "utf8");
			const digest = createHash("sha256").update(input).digest("hex");
			const ir = convertAssemblyToMarkdownIR(input);
			const normalized = normalizeMarkdownIR(ir);
			const rendered = renderGfm(normalized);

			expect(digest).toBe(entry.sha256);
			expect(entry.sourceProject).toBe("antora/docs.antora.org");
			expect(entry.sourceUrl).toContain("gitlab.com/antora/docs.antora.org");
			expect(entry.sourcePath).toContain(".adoc");
			expect(entry.sourceCapturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(entry.rationale.length).toBeGreaterThan(20);

			expect(ir.type).toBe("document");
			expect(ir.children.some((child) => child.type === "heading")).toBe(true);
			expect(ir.children.some((child) => child.type === "list")).toBe(true);
			expect(ir.children.some((child) => child.type === "codeBlock")).toBe(
				true,
			);
			expect(ir.children.some((child) => child.type === "blockquote")).toBe(
				true,
			);
			expect(rendered).toContain("[Antora docs](https://docs.antora.org)");
			expect(rendered).toContain("- Define modules clearly");
			expect(rendered).toContain("```sh");
			expect(rendered).toContain("> Docs are part of the product.");
			expect(rendered).not.toContain("Unsupported:");
		});
	}
});
