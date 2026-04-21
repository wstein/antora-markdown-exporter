import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type ThemeDefinition = {
	title: string;
	intro?: string;
	notes: string[];
};

type ParsedNote = {
	title: string;
	summary: string;
	body: string;
};

type GenerationOptions = {
	notesDir: string;
	order: ThemeDefinition[];
};

type CliOptions = {
	check: boolean;
	outputPath: string;
	notesDir: string;
};

export const ARCHITECTURE_THEMES: ThemeDefinition[] = [
	{
		title: "Foundational Principles",
		intro:
			"Overarching rules that govern how the exporter evolves. New capabilities must satisfy these principles before they reach the IR, renderers, or fallback layer.",
		notes: [
			"Strict architecture must be extended without weakening invariants",
			"The architecture favors explicit extension over implicit degradation",
		],
	},
	{
		title: "Exporter Pipeline",
		intro:
			"The three-stage pipeline that turns Antora Assembler output into Markdown through a single canonical semantic layer.",
		notes: [
			"Exporter pipeline uses Assembler and a direct TypeScript converter",
		],
	},
	{
		title: "Markdown IR Boundary",
		intro:
			"The semantic intermediate representation that decouples document meaning from any concrete Markdown flavor.",
		notes: ["Markdown IR is the canonical render boundary"],
	},
	{
		title: "Renderer And Flavor Model",
		intro:
			"Flavor renderers as syntax adapters that consume the same normalized IR and defer fallback, routing, and extension decisions to dedicated policy layers.",
		notes: ["Flavor renderers are syntax adapters over one semantic layer"],
	},
	{
		title: "Fallback Policy",
		intro:
			"Centralized policy for unsupported constructs, raw HTML allowance, and visible degradation. Fallback is deliberate and never a renderer-local default.",
		notes: [
			"Raw HTML is a controlled fallback not a default rendering path",
			"Fallback selection is centralized across markdown flavors",
		],
	},
	{
		title: "Transparent Extensions",
		intro:
			"Valid fenced constructs such as Mermaid diagrams are preserved verbatim. Transparent extensions are a distinct contract category from fallback and unsupported degradation.",
		notes: [
			"Transparent fenced extensions preserve authored language semantics",
			"Transparent extensions are not fallback mechanisms",
		],
	},
	{
		title: "Xref Lowering",
		intro:
			"Antora-aware xref destinations are resolved in a dedicated lowering phase so renderers serialize already-routed targets.",
		notes: ["Xref target resolution is a separate lowering phase"],
	},
	{
		title: "Include Handling",
		intro:
			"Include semantics, diagnostics, and provenance survive conversion through a deliberately private metadata transport.",
		notes: ["Include metadata transport is an internal implementation detail"],
	},
	{
		title: "Testing And Validation",
		intro:
			"Golden fixtures pin the render contract. Inspection helpers expose the same normalized semantics to CI and release validation.",
		notes: [
			"Testing relies on golden fixtures and deterministic snapshots",
			"Inspection helpers expose normalized validation surfaces",
		],
	},
	{
		title: "Release And Tooling",
		intro:
			"Scripts, workflows, and referenced files must stay in lockstep so release readiness is observable, not aspirational.",
		notes: ["Repository scripts and referenced files must stay in lockstep"],
	},
];

const FRONTMATTER_FENCE = "---";
const SCRIPT_COMMAND = "bun run docs:generate";
const GENERATED_HEADER = [
	"<!-- GENERATED FILE — DO NOT EDIT DIRECTLY -->",
	"<!-- Source: notes/**  Generator: scripts/generate-architecture-docs.ts -->",
	`<!-- Regenerate with: ${SCRIPT_COMMAND} -->`,
];

export async function readNote(
	notesDir: string,
	title: string,
): Promise<ParsedNote> {
	const source = await readFile(resolve(notesDir, `${title}.md`), "utf8");
	return parseNote(source, title);
}

export function parseNote(source: string, title: string): ParsedNote {
	const body = stripFrontmatter(source);
	const trimmedBody = body.replace(/\s+$/u, "");
	const summary = extractSummaryParagraph(trimmedBody);

	if (summary.split(/\s+/u).filter(Boolean).length < 6) {
		throw new Error(
			`Note "${title}" does not start with a substantive summary paragraph`,
		);
	}

	return { title, summary, body: trimmedBody };
}

function stripFrontmatter(source: string): string {
	if (!source.startsWith(`${FRONTMATTER_FENCE}\n`)) {
		return source;
	}

	const closingIndex = source.indexOf(
		`\n${FRONTMATTER_FENCE}\n`,
		FRONTMATTER_FENCE.length + 1,
	);
	if (closingIndex === -1) {
		return source;
	}

	return source.slice(closingIndex + FRONTMATTER_FENCE.length + 2);
}

function extractSummaryParagraph(body: string): string {
	const lines = body.split("\n");
	const summaryLines: string[] = [];

	for (const line of lines) {
		if (line.trim() === "") {
			if (summaryLines.length > 0) {
				break;
			}
			continue;
		}
		if (line.startsWith("#")) {
			break;
		}
		summaryLines.push(line);
	}

	return summaryLines.join(" ").trim();
}

export function demoteHeadings(body: string, levels: number): string {
	const prefix = "#".repeat(levels);
	return body
		.split("\n")
		.map((line) => {
			const match = /^(#{1,6})(\s+\S)/u.exec(line);
			if (!match) {
				return line;
			}
			const current = match[1] ?? "";
			const tail = line.slice(current.length);
			const newLevel = Math.min(current.length + levels, 6);
			return `${prefix.slice(0, newLevel - current.length)}${current}${tail}`;
		})
		.join("\n");
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/gu, "")
		.trim()
		.replace(/\s+/gu, "-");
}

export async function generateArchitectureDocs(
	options: GenerationOptions,
): Promise<string> {
	const themes = await Promise.all(
		options.order.map(async (theme) => {
			const notes = await Promise.all(
				theme.notes.map((title) => readNote(options.notesDir, title)),
			);
			return { theme, notes };
		}),
	);

	const lines: string[] = [];
	lines.push(...GENERATED_HEADER, "");
	lines.push("# Architecture");
	lines.push("");
	lines.push(
		"This document is a derived, read-only narrative view over the repository's atomic notes. The atomic notes in [`notes/`](../notes) remain the canonical source of truth for architectural decisions, invariants, and rendering policy.",
	);
	lines.push("");
	lines.push(
		"Edits to architectural intent must land in `notes/` first. This file is regenerated from a curated note order and should never be modified by hand.",
	);
	lines.push("");
	lines.push("```bash");
	lines.push(SCRIPT_COMMAND);
	lines.push("```");
	lines.push("");

	lines.push("## Contents");
	lines.push("");
	for (const { theme, notes } of themes) {
		lines.push(`- [${theme.title}](#${slugify(theme.title)})`);
		for (const note of notes) {
			lines.push(`  - [${note.title}](#${slugify(note.title)})`);
		}
	}
	lines.push("");

	for (const { theme, notes } of themes) {
		lines.push(`## ${theme.title}`);
		lines.push("");
		if (theme.intro !== undefined) {
			lines.push(theme.intro);
			lines.push("");
		}
		for (const note of notes) {
			lines.push(`### ${note.title}`);
			lines.push("");
			const demoted = demoteHeadings(note.body, 2);
			lines.push(demoted.trim());
			lines.push("");
		}
	}

	return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

function parseCliArguments(argv: string[], defaults: CliOptions): CliOptions {
	const options: CliOptions = { ...defaults };

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === undefined) {
			continue;
		}

		if (argument === "--check") {
			options.check = true;
			continue;
		}

		if (argument === "--output") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --output");
			}
			options.outputPath = resolve(value);
			index += 1;
			continue;
		}

		if (argument === "--notes-dir") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --notes-dir");
			}
			options.notesDir = resolve(value);
			index += 1;
			continue;
		}

		throw new Error(`Unknown option: ${argument}`);
	}

	return options;
}

function usage(): string {
	return [
		"Usage: bun scripts/generate-architecture-docs.ts [--check] [--notes-dir <path>] [--output <path>]",
		"",
		"Generate docs/architecture.md as a derived narrative view over notes/**.",
		"Use --check to verify that the committed file matches the current note corpus.",
	].join("\n");
}

async function readIfExists(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return undefined;
		}
		throw error;
	}
}

async function main(): Promise<void> {
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const defaults: CliOptions = {
		check: false,
		outputPath: resolve(root, "docs/architecture.md"),
		notesDir: resolve(root, "notes"),
	};
	const options = parseCliArguments(process.argv.slice(2), defaults);

	const generated = await generateArchitectureDocs({
		notesDir: options.notesDir,
		order: ARCHITECTURE_THEMES,
	});

	if (options.check) {
		const current = await readIfExists(options.outputPath);
		if (current !== generated) {
			console.error(
				`Generated docs are out of date: ${options.outputPath}. Run \`${SCRIPT_COMMAND}\` and commit the result.`,
			);
			process.exitCode = 1;
			return;
		}
		console.log(`Generated docs are up to date: ${options.outputPath}`);
		return;
	}

	await writeFile(options.outputPath, generated);
	console.log(`Wrote ${options.outputPath}`);
}

const isDirectInvocation =
	process.argv[1] !== undefined &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
	try {
		await main();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		console.error("");
		console.error(usage());
		process.exitCode = 1;
	}
}
