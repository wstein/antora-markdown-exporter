import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import loadAsciiDoc from "@antora/asciidoc-loader";
import { assembleContent } from "@antora/assembler";
import aggregateContent from "@antora/content-aggregator";
import classifyContent from "@antora/content-classifier";
import convertDocuments from "@antora/document-converter";
import buildNavigation from "@antora/navigation-builder";
import buildPlaybook from "@antora/playbook-builder";
import {
	createMarkdownConverter,
	type MarkdownFlavorName,
} from "../src/extension/index.ts";

export type ExportAntoraModulesOptions = {
	flavor: MarkdownFlavorName;
	outputRoot: string;
	playbookPath: string;
};

export type ExportedMarkdownFile = {
	moduleName: string;
	outputPath: string;
	relativeOutputPath: string;
};

type NavigationEntry = {
	content?: string;
	items?: NavigationEntry[];
	url?: string;
	urlType?: string;
};

type ComponentVersionWithNavigation = {
	name: string;
	version: string;
	navigation?: NavigationEntry[];
};

const markdownFlavors = new Set<MarkdownFlavorName>([
	"gfm",
	"commonmark",
	"gitlab",
	"strict",
]);

function usage(): string {
	return [
		"Usage: bun scripts/export-antora-modules.ts [--playbook <file>] [--output-root <dir>] [--flavor <gfm|commonmark|gitlab|strict>]",
		"",
		"Export assembled Antora documentation modules to Markdown using Antora and the repository exporter extension.",
	].join("\n");
}

export function parseArguments(argv: string[]): ExportAntoraModulesOptions {
	let flavor: MarkdownFlavorName = "gfm";
	let outputRoot = resolve("build/markdown");
	let playbookPath = resolve("antora-playbook.yml");

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === undefined) continue;

		if (argument === "--playbook") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --playbook");
			}
			playbookPath = resolve(value);
			index += 1;
			continue;
		}

		if (argument === "--output-root") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --output-root");
			}
			outputRoot = resolve(value);
			index += 1;
			continue;
		}

		if (argument === "--flavor") {
			const value = argv[index + 1];
			if (
				value !== "gfm" &&
				value !== "commonmark" &&
				value !== "gitlab" &&
				value !== "strict"
			) {
				throw new Error("Missing or invalid value for --flavor");
			}

			flavor = value;
			index += 1;
			continue;
		}

		throw new Error(`Unknown option: ${argument}`);
	}

	return { flavor, outputRoot, playbookPath };
}

function isNavigationEntry(value: unknown): value is NavigationEntry {
	return value !== null && typeof value === "object";
}

function createAssemblerConfigSource(
	outputRoot: string,
): Record<string, unknown> {
	return {
		componentVersionFilter: {
			names: ["antora-markdown-exporter"],
		},
		assembly: {
			insertStartPage: false,
			rootLevel: 1,
		},
		build: {
			clean: false,
			dir: outputRoot,
			mkdirs: true,
			publish: false,
		},
	};
}

function createAntoraEnvironment(playbookPath: string): NodeJS.ProcessEnv {
	return {
		...process.env,
		ANTORA_CACHE_DIR: resolve(dirname(playbookPath), "build/.antora-cache"),
	};
}

function getTargetComponentVersion(contentCatalog: {
	getComponent: (
		name: string,
	) => { versions?: ComponentVersionWithNavigation[] } | undefined;
}): ComponentVersionWithNavigation {
	const component = contentCatalog.getComponent("antora-markdown-exporter");
	const [componentVersion] = component?.versions ?? [];
	if (componentVersion === undefined) {
		throw new Error("Could not resolve component antora-markdown-exporter");
	}

	return componentVersion;
}

function findModuleRootEntry(
	entry: NavigationEntry,
): NavigationEntry | undefined {
	if (!Array.isArray(entry.items) || entry.items.length === 0) {
		return undefined;
	}

	const [candidate] = entry.items;
	return isNavigationEntry(candidate) ? candidate : undefined;
}

function extractModuleNameFromUrl(url: string | undefined): string | undefined {
	if (typeof url !== "string") {
		return undefined;
	}

	const match = /\/([^/]+)\/index\.html$/u.exec(url);
	return match?.[1];
}

export function getDocumentationModuleEntries(
	componentVersion: ComponentVersionWithNavigation,
): Array<{ moduleName: string; navigation: NavigationEntry }> {
	return (componentVersion.navigation ?? [])
		.map(findModuleRootEntry)
		.filter((entry): entry is NavigationEntry => entry !== undefined)
		.map((entry) => ({
			moduleName: extractModuleNameFromUrl(entry.url),
			navigation: entry,
		}))
		.filter(
			(entry): entry is { moduleName: string; navigation: NavigationEntry } =>
				entry.moduleName === "architecture" ||
				entry.moduleName === "manual" ||
				entry.moduleName === "onboarding",
		);
}

export function createModuleNavigationCatalog(
	componentVersion: ComponentVersionWithNavigation,
	moduleNavigation: NavigationEntry,
) {
	return {
		getNavigation(component: string, version: string): NavigationEntry[] {
			if (
				component === componentVersion.name &&
				version === componentVersion.version
			) {
				return [moduleNavigation];
			}

			return [];
		},
	};
}

export async function exportAntoraModulesToMarkdown(
	options: ExportAntoraModulesOptions,
): Promise<ExportedMarkdownFile[]> {
	const playbookStats = await stat(options.playbookPath).catch(() => undefined);
	if (playbookStats === undefined || !playbookStats.isFile()) {
		throw new Error(`Antora playbook does not exist: ${options.playbookPath}`);
	}

	if (!markdownFlavors.has(options.flavor)) {
		throw new Error(`Unsupported markdown flavor: ${options.flavor}`);
	}

	const playbook = buildPlaybook(
		["--playbook", options.playbookPath, "--quiet"],
		createAntoraEnvironment(options.playbookPath),
	);
	playbook.runtime.quiet = true;

	const siteAsciiDocConfig = loadAsciiDoc.resolveAsciiDocConfig(playbook);
	siteAsciiDocConfig.keepSource = true;
	const contentAggregate = await aggregateContent(playbook);
	const contentCatalog = classifyContent(
		playbook,
		contentAggregate,
		siteAsciiDocConfig,
	);
	convertDocuments(contentCatalog, siteAsciiDocConfig);
	buildNavigation(contentCatalog, siteAsciiDocConfig);
	await rm(options.outputRoot, { force: true, recursive: true });
	await mkdir(options.outputRoot, { recursive: true });

	const componentVersion = getTargetComponentVersion(contentCatalog);
	const moduleEntries = getDocumentationModuleEntries(componentVersion);
	const exportedFiles: ExportedMarkdownFile[] = [];

	for (const moduleEntry of moduleEntries) {
		const files = await assembleContent(
			playbook,
			contentCatalog,
			createMarkdownConverter({ flavor: options.flavor }),
			{
				configSource: createAssemblerConfigSource(options.outputRoot),
				navigationCatalog: createModuleNavigationCatalog(
					componentVersion,
					moduleEntry.navigation,
				),
			},
		);

		for (const file of files) {
			const relativeOutputPath =
				typeof file?.src?.relative === "string" ? file.src.relative : undefined;
			if (relativeOutputPath === undefined) {
				continue;
			}

			exportedFiles.push({
				moduleName: moduleEntry.moduleName,
				outputPath: resolve(options.outputRoot, relativeOutputPath),
				relativeOutputPath,
			});
		}
	}

	return exportedFiles.sort((left, right) =>
		left.relativeOutputPath.localeCompare(right.relativeOutputPath),
	);
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const exportedFiles = await exportAntoraModulesToMarkdown(options);

	console.log(
		JSON.stringify(
			{
				count: exportedFiles.length,
				flavor: options.flavor,
				outputRoot: options.outputRoot,
				playbookPath: options.playbookPath,
				files: exportedFiles.map((entry) => ({
					moduleName: entry.moduleName,
					outputPath: entry.relativeOutputPath,
				})),
			},
			null,
			2,
		),
	);
}

function isDirectExecution(): boolean {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}

	return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
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
