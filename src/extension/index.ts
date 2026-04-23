import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { configure } from "@antora/assembler";
import { extractAssemblyStructure } from "../adapter/asciidoctor-structure.js";
import { convertAssemblyStructureToMarkdownIR } from "../exporter/structured-to-markdown-ir.js";
import type { MarkdownFlavorName } from "../markdown/flavor.js";
import { normalizeMarkdownIR } from "../markdown/normalize.js";
import { renderMarkdown } from "../markdown/render/index.js";

export type AssemblerRootLevel = 0 | 1;
const exporterFlavorAttribute = "markdown-exporter-flavor";

export interface AntoraMarkdownExporterExtensionConfig {
	readonly flavor?: MarkdownFlavorName;
	readonly configSource?: Record<string, unknown> | string;
	readonly rootLevel?: AssemblerRootLevel;
	readonly navigationCatalog?: {
		getNavigation: (component: string, version: string) => unknown[];
	};
	readonly configFile?: string;
	readonly configFiles?: string[];
	readonly logOutput?: string;
}

type MarkdownConverterConfig = {
	readonly flavor: MarkdownFlavorName;
};

type ConvertAttributes = {
	docfile: string;
	outdir: string;
	outfile: string;
	outfilesuffix: string;
} & Record<string, unknown>;

type BuildConfig = {
	cwd?: string;
	dir?: string;
};

type AssemblerFile = {
	contents: Buffer;
	path: string;
};

const defaultFlavor: MarkdownFlavorName = "gfm";
const defaultAssemblerRootLevel: AssemblerRootLevel = 1;

function createDefaultAssemblerConfigSource(rootLevel: AssemblerRootLevel) {
	return {
		assembly: {
			root_level: rootLevel,
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseConfiguredFlavor(value: unknown): MarkdownFlavorName | undefined {
	return value === "gfm" ||
		value === "commonmark" ||
		value === "gitlab" ||
		value === "multimarkdown" ||
		value === "strict"
		? value
		: undefined;
}

function parseConfiguredRootLevel(
	value: unknown,
): AssemblerRootLevel | undefined {
	return value === 0 || value === 1 ? value : undefined;
}

function resolveExporterDefaultsFromConfigSource(
	configSource: AntoraMarkdownExporterExtensionConfig["configSource"],
): Partial<{
	flavor: MarkdownFlavorName;
	rootLevel: AssemblerRootLevel;
}> {
	if (!isRecord(configSource)) {
		return {};
	}

	const assembly = isRecord(configSource.assembly) ? configSource.assembly : {};
	const asciidoc = isRecord(configSource.asciidoc) ? configSource.asciidoc : {};
	const assemblyAttributes = isRecord(assembly.attributes)
		? assembly.attributes
		: {};
	const asciidocAttributes = isRecord(asciidoc.attributes)
		? asciidoc.attributes
		: {};

	return {
		flavor: parseConfiguredFlavor(
			assemblyAttributes[exporterFlavorAttribute] ??
				asciidocAttributes[exporterFlavorAttribute],
		),
		rootLevel: parseConfiguredRootLevel(
			assembly.root_level ?? assembly.rootLevel,
		),
	};
}

function mergeRootLevelIntoConfigSource(
	configSource: AntoraMarkdownExporterExtensionConfig["configSource"],
	rootLevel: AssemblerRootLevel | undefined,
): AntoraMarkdownExporterExtensionConfig["configSource"] {
	if (rootLevel === undefined || typeof configSource === "string") {
		return configSource;
	}

	if (!isRecord(configSource)) {
		return createDefaultAssemblerConfigSource(rootLevel);
	}

	return {
		...configSource,
		assembly: {
			...(isRecord(configSource.assembly) ? configSource.assembly : {}),
			root_level: rootLevel,
		},
	};
}

function extractStringAttributes(
	attributes: Record<string, unknown>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(attributes).flatMap(([key, value]) =>
			typeof value === "string" ? [[key, value]] : [],
		),
	);
}

export function renderAssemblyMarkdown(
	source: string,
	flavor: MarkdownFlavorName = defaultFlavor,
	sourcePath = "assembly.adoc",
	options: {
		attributes?: Record<string, string>;
	} = {},
): string {
	const structured = extractAssemblyStructure(source, {
		attributes: options.attributes,
		sourcePath,
	});
	return renderMarkdown(
		normalizeMarkdownIR(convertAssemblyStructureToMarkdownIR(structured)),
		flavor,
	);
}

export function createMarkdownConverter(
	config: Partial<MarkdownConverterConfig> = {},
) {
	const flavor = config.flavor ?? defaultFlavor;

	return {
		backend: "markdown",
		extname: ".md",
		mediaType: "text/markdown",
		loggerName: "@wsmy/antora-markdown-exporter",
		async convert(
			file: AssemblerFile,
			convertAttributes: ConvertAttributes,
			buildConfig: BuildConfig,
		): Promise<void> {
			const outputDir = buildConfig.dir ?? buildConfig.cwd ?? process.cwd();
			const outputPath = resolve(
				outputDir,
				basename(convertAttributes.outfile),
			);
			convertAttributes.outdir = dirname(outputPath);
			convertAttributes.outfile = outputPath;
			convertAttributes.outfilesuffix = ".md";
			await mkdir(dirname(outputPath), { recursive: true });
			const markdown = renderAssemblyMarkdown(
				file.contents.toString("utf8"),
				flavor,
				convertAttributes.docfile,
				{
					attributes: extractStringAttributes(convertAttributes),
				},
			);
			await writeFile(outputPath, `${markdown}\n`);
		},
	} as const;
}

export function register(
	this: unknown,
	{ config = {} }: { config?: AntoraMarkdownExporterExtensionConfig } = {},
): void {
	const {
		configSource,
		flavor,
		navigationCatalog,
		rootLevel,
		logOutput,
		...assemblerConfig
	} = config;
	const configuredDefaults =
		resolveExporterDefaultsFromConfigSource(configSource);

	// Capture logs if logOutput is specified
	const capturedLogs: string[] = [];
	if (logOutput) {
		const originalStderr = console.error;
		const originalStdout = console.log;

		console.error = (...args: unknown[]) => {
			capturedLogs.push(args.map((arg) => String(arg)).join(" "));
			originalStderr(...args);
		};

		console.log = (...args: unknown[]) => {
			capturedLogs.push(args.map((arg) => String(arg)).join(" "));
			originalStdout(...args);
		};

		// Write logs after configure completes
		const writeLogsAsync = async () => {
			const logContent = [
				"=== Antora Markdown Export Log ===",
				new Date().toISOString(),
				"",
				...capturedLogs,
			].join("\n");
			await mkdir(dirname(logOutput), { recursive: true });
			await writeFile(logOutput, logContent, "utf8");
		};

		// Schedule log write for next tick to ensure it happens after processing
		setImmediate(() => {
			writeLogsAsync().catch((err) => {
				originalStderr("Failed to write log file:", err);
			});
		});
	}

	configure(
		this,
		createMarkdownConverter({
			flavor: flavor ?? configuredDefaults.flavor,
		}),
		assemblerConfig,
		{
			configSource:
				typeof configSource === "string" || configSource !== undefined
					? mergeRootLevelIntoConfigSource(
							configSource,
							rootLevel ?? configuredDefaults.rootLevel,
						)
					: createDefaultAssemblerConfigSource(
							rootLevel ?? defaultAssemblerRootLevel,
						),
			navigationCatalog,
		},
	);
}
