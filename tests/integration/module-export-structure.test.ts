import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildDocsPdf,
	getPdfOutputPath,
} from "../../scripts/build-docs-site.mjs";
import { exportAntoraModulesToMarkdown } from "../../scripts/export-antora-modules.ts";

const root = resolve(__dirname, "../..");

function commandExists(command: string): boolean {
	const result = spawnSync("which", [command], {
		encoding: "utf8",
		stdio: "ignore",
	});

	return result.status === 0;
}

function normalizeStructuralEntry(entry: string): string {
	const chapterMatch = entry.match(/^Chapter (\d+)\.\s+(.+)$/);
	if (chapterMatch) {
		return `${chapterMatch[1]}. ${chapterMatch[2]}`;
	}

	return entry.replace(/\s+/g, " ").trim();
}

function extractMarkdownStructuralHeadings(source: string): string[] {
	return source.split(/\r?\n/).flatMap((line) => {
		const match = line.match(/^#\s+Chapter\s+\d+\.\s+(.+)$/);
		return match?.[1] ? [normalizeStructuralEntry(match[1])] : [];
	});
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const describeIfPdfTooling =
	commandExists("asciidoctor-pdf") && commandExists("pdftotext")
		? describe
		: describe.skip;

describeIfPdfTooling("module export structural parity", () => {
	it("keeps module markdown major headings aligned with the generated PDFs", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-module-structure-"),
		);
		const { exportedFiles } = await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			outputRoot,
			packageTaskMarkdown: false,
			playbookPath: resolve(root, "antora-playbook.yml"),
		});

		await buildDocsPdf(root);

		for (const exportedFile of exportedFiles) {
			const markdown = await readFile(exportedFile.outputPath, "utf8");
			const markdownHeadings = extractMarkdownStructuralHeadings(markdown);
			const pdfText = execFileSync(
				"pdftotext",
				["-layout", getPdfOutputPath(root, exportedFile.moduleName), "-"],
				{ encoding: "utf8" },
			).replace(/\f/g, "\n");
			for (const heading of markdownHeadings) {
				expect(
					pdfText,
					`${exportedFile.moduleName} pdf should contain heading ${heading}`,
				).toMatch(new RegExp(`^${escapeRegExp(heading)}$`, "m"));
			}
		}
	}, 20_000);
});
