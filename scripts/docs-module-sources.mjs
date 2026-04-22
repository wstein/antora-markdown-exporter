import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DOCUMENT_TITLE_PATTERN = /^=\s+.+\n?/m;

export function stripDocumentTitle(source) {
	return source.replace(DOCUMENT_TITLE_PATTERN, "");
}

function createBookPreamble(title) {
	return `= ${title}
:doctype: book
:toc:
:toc-title: table of contents
:toclevels: 3
:sectnums:
:reproducible:

`;
}

function parseAntoraNavFiles(rootDir) {
	return readFileSync(resolve(rootDir, "docs/antora.yml"), "utf8")
		.split(/\r?\n/)
		.map((line) => line.match(/^\s*-\s+modules\/([^/]+)\/nav\.adoc\s*$/))
		.flatMap((match) => (match?.[1] ? [match[1]] : []))
		.filter((moduleName) => moduleName !== "ROOT");
}

function parseTopLevelNavEntries(rootDir, moduleName) {
	const navPath = resolve(rootDir, "docs/modules", moduleName, "nav.adoc");
	const source = readFileSync(navPath, "utf8");
	const match = source
		.split(/\r?\n/)
		.map((line) => line.match(/^\*\s+xref:([^[]+)\[([^\]]*)\]\s*$/))
		.find(Boolean);

	if (!match?.[1]) {
		return [];
	}

	const [, target = "", label = ""] = match;
	const qualifiedMatch = target.match(
		/^(?:(?<module>[^:]+):)?(?<page>[^#]+?)(?:#.+)?$/,
	);
	const page = qualifiedMatch?.groups?.page;
	if (page === undefined) {
		return [];
	}

	return [
		{
			label: label.trim() || page.replace(/\.adoc$/i, ""),
			moduleName: qualifiedMatch?.groups?.module ?? moduleName,
			page,
		},
	];
}

function getDocumentationEntries(rootDir) {
	return parseAntoraNavFiles(rootDir).flatMap((moduleName) =>
		parseTopLevelNavEntries(rootDir, moduleName),
	);
}

function resolveIncludeTarget(
	rootDir,
	moduleName,
	currentFilePath,
	includeTarget,
) {
	if (includeTarget.startsWith("partial$")) {
		return resolve(
			rootDir,
			"docs/modules",
			moduleName,
			"partials",
			includeTarget.slice("partial$".length),
		);
	}

	if (
		includeTarget.startsWith("./") ||
		includeTarget.startsWith("../") ||
		(!includeTarget.includes(":") && !includeTarget.includes("$"))
	) {
		return resolve(dirname(currentFilePath), includeTarget);
	}

	return undefined;
}

function expandModuleIncludes(
	rootDir,
	moduleName,
	filePath,
	stack = new Set(),
) {
	const normalizedPath = resolve(filePath);
	if (stack.has(normalizedPath)) {
		throw new Error(`Cyclic documentation include detected: ${normalizedPath}`);
	}

	const nextStack = new Set(stack);
	nextStack.add(normalizedPath);

	return readFileSync(normalizedPath, "utf8").replace(
		/^include::([^[]+)\[[^\]]*\]$/gm,
		(match, includeTarget) => {
			const resolvedTarget = resolveIncludeTarget(
				rootDir,
				moduleName,
				normalizedPath,
				includeTarget,
			);
			if (resolvedTarget === undefined) {
				return match;
			}

			return expandModuleIncludes(
				rootDir,
				moduleName,
				resolvedTarget,
				nextStack,
			).trim();
		},
	);
}

function normalizeModulePageBody(source) {
	return source
		.split(/\r?\n/)
		.filter((line) => line.trim() !== "<<<<")
		.join("\n");
}

function createModuleImagesAttribute(rootDir, moduleName) {
	const imagesDir = resolve(rootDir, "docs/modules", moduleName, "images");
	return existsSync(imagesDir) ? `:imagesdir: ${imagesDir}\n\n` : "";
}

function readAssemblyEntryBody(rootDir, entry) {
	return stripDocumentTitle(
		normalizeModulePageBody(
			expandModuleIncludes(
				rootDir,
				entry.moduleName,
				resolve(rootDir, "docs/modules", entry.moduleName, "pages", entry.page),
			),
		),
	).trim();
}

function createAssemblyEntrySource(rootDir, entry) {
	return `${createBookPreamble(entry.label)}${createModuleImagesAttribute(
		rootDir,
		entry.moduleName,
	)}${readAssemblyEntryBody(rootDir, entry)}
`;
}

export function getDocumentationModuleNames(rootDir = process.cwd()) {
	return getDocumentationEntries(rootDir).map((entry) => entry.moduleName);
}

export function createDocumentationModuleSource(rootDir, moduleName) {
	const entry = getDocumentationEntries(rootDir).find(
		(candidate) => candidate.moduleName === moduleName,
	);
	if (entry === undefined) {
		throw new Error(`Unsupported documentation module: ${moduleName}`);
	}

	return createAssemblyEntrySource(rootDir, entry);
}

export function createDocumentationRootSource(rootDir) {
	const entries = getDocumentationEntries(rootDir);
	return `${createBookPreamble("Antora Markdown Exporter")}${entries
		.map((entry) => createAssemblyEntrySource(rootDir, entry).trim())
		.join("\n\n")}\n`;
}
