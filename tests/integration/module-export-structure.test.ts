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
	const lines = source.split(/\r?\n/);
	const tocStart = lines.findIndex(
		(line) => line.trim() === "## Table of Contents",
	);
	if (tocStart === -1) {
		return [];
	}

	const headings: string[] = [];
	for (const line of lines.slice(tocStart + 1)) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		if (trimmed.startsWith("# Chapter ")) {
			break;
		}

		const match = trimmed.match(/^-\s+\[(.+?)\]\(#.+\)$/);
		if (!match) {
			continue;
		}

		headings.push(normalizeStructuralEntry(match[1]));
	}

	return headings;
}

function extractPdfStructuralHeadings(source: string): string[] {
	const lines = source.split(/\r?\n/);
	const tocStart = lines.findIndex((line) =>
		/table of contents/i.test(line.trim()),
	);
	if (tocStart === -1) {
		return [];
	}

	const headings: string[] = [];
	for (const line of lines.slice(tocStart + 1)) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed === "\f") {
			continue;
		}
		if (/^Chapter \d+\.\s+/.test(trimmed)) {
			break;
		}

		const match = trimmed.match(/^(.+?)(?:\.\s*){2,}\d+$/);
		if (!match) {
			continue;
		}

		headings.push(normalizeStructuralEntry(match[1].trim()));
	}

	return headings;
}

const describeIfPdfTooling =
	commandExists("asciidoctor-pdf") && commandExists("pdftotext")
		? describe
		: describe.skip;

describeIfPdfTooling("module export structural parity", () => {
	it("keeps module markdown numbering and major headings aligned with the generated PDFs", async () => {
		const outputRoot = await mkdtemp(
			resolve(tmpdir(), "antora-markdown-module-structure-"),
		);
		const { exportedFiles } = await exportAntoraModulesToMarkdown({
			flavor: "gfm",
			outputRoot,
			playbookPath: resolve(root, "antora-playbook.yml"),
		});

		buildDocsPdf(root);

		for (const exportedFile of exportedFiles) {
			const markdown = await readFile(exportedFile.outputPath, "utf8");
			const markdownHeadings = extractMarkdownStructuralHeadings(markdown);
			const pdfText = execFileSync(
				"pdftotext",
				["-layout", getPdfOutputPath(root, exportedFile.moduleName), "-"],
				{ encoding: "utf8" },
			);
			const pdfHeadings = extractPdfStructuralHeadings(pdfText);

			expect(
				markdownHeadings,
				`${exportedFile.moduleName} markdown headings`,
			).toEqual(pdfHeadings);
		}
	}, 20_000);
});
