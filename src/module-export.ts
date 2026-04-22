import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type {
	AntoraMarkdownExporterExtensionConfig,
	AssemblerRootLevel,
	XrefFallbackLabelStyle,
} from "./extension/index.js";
import { createMarkdownConverter } from "./extension/index.js";
import type { MarkdownFlavorName } from "./markdown/flavor.js";

const require = createRequire(
	typeof __filename === "string"
		? __filename
		: resolve(process.cwd(), "package.json"),
);
const buildPlaybook = require("@antora/playbook-builder");
const GeneratorContext = require("@antora/site-generator/generator-context");
const { assembleContent } = require("@antora/assembler");
const assemblerPackagePath = require.resolve("@antora/assembler/package.json");
const assemblerLibDir = resolve(dirname(assemblerPackagePath), "lib");
const loadAssemblerConfig = require(resolve(assemblerLibDir, "load-config.js"));
const produceAssemblyFiles = require(
	resolve(assemblerLibDir, "produce-assembly-files.js"),
);

const modulePath =
	typeof __filename === "string"
		? __filename
		: resolve(process.cwd(), "package.json");
const moduleShim = {
	filename: modulePath,
	path: dirname(modulePath),
	require,
};

const defaultAssemblyAttributes = {
	reproducible: "",
	sectnums: "",
	toc: "",
	"toc-title": "table of contents",
	toclevels: "3",
};
const exporterFlavorAttribute = "markdown-exporter-flavor";
const exporterXrefFallbackAttribute =
	"markdown-exporter-xref-fallback-label-style";

export type AntoraMarkdownExportDefaults = {
	flavor?: MarkdownFlavorName;
	rootLevel?: AssemblerRootLevel;
	xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
};

export type AntoraMarkdownModuleExportOptions = {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	flavor?: MarkdownFlavorName;
	keepSource?: boolean;
	outputRoot: string;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
	xrefFallbackLabelStyle?: XrefFallbackLabelStyle;
};

export type AntoraMarkdownModuleExportFile = {
	moduleName: string;
	outputPath: string;
	relativeOutputPath: string;
};

export type AntoraMarkdownModuleExportResult = {
	exportedFiles: AntoraMarkdownModuleExportFile[];
	flavor: MarkdownFlavorName;
	outputRoot: string;
	playbookPath: string;
	rootLevel: AssemblerRootLevel;
	xrefFallbackLabelStyle: XrefFallbackLabelStyle;
};

function parseConfiguredFlavor(value: unknown): MarkdownFlavorName | undefined {
	return ["gfm", "commonmark", "gitlab", "multimarkdown", "strict"].includes(
		String(value),
	)
		? (value as MarkdownFlavorName)
		: undefined;
}

function parseConfiguredXrefFallbackLabelStyle(
	value: unknown,
): XrefFallbackLabelStyle | undefined {
	return value === "fragment-or-basename" || value === "fragment-or-path"
		? value
		: undefined;
}

function createBuildConfig(buildDir: string, keepSource = false) {
	return {
		clean: false,
		dir: buildDir,
		keepSource,
		publish: false,
	};
}

function mergeAssemblerConfig(
	baseConfig: Record<string, unknown>,
	{
		buildDir,
		keepSource = false,
		rootLevel,
	}: {
		buildDir: string;
		keepSource?: boolean;
		rootLevel?: AssemblerRootLevel;
	},
) {
	const baseAssembly =
		typeof baseConfig.assembly === "object" && baseConfig.assembly !== null
			? (baseConfig.assembly as Record<string, unknown>)
			: {};
	const baseAttributes =
		typeof baseAssembly.attributes === "object" &&
		baseAssembly.attributes !== null
			? (baseAssembly.attributes as Record<string, unknown>)
			: {};
	const baseBuild =
		typeof baseConfig.build === "object" && baseConfig.build !== null
			? (baseConfig.build as Record<string, unknown>)
			: {};

	return {
		...baseConfig,
		assembly: {
			...baseAssembly,
			attributes: {
				...defaultAssemblyAttributes,
				...baseAttributes,
			},
			doctype:
				typeof baseAssembly.doctype === "string"
					? baseAssembly.doctype
					: "book",
			rootLevel:
				rootLevel ??
				(baseAssembly.rootLevel === 0 || baseAssembly.rootLevel === 1
					? baseAssembly.rootLevel
					: 1),
		},
		build: {
			...baseBuild,
			...createBuildConfig(buildDir, keepSource),
		},
	};
}

function createIntrinsicAssemblerAttributes(converter: {
	backend?: string;
	extname?: string;
}) {
	const attributes: Record<string, string> = {
		"loader-assembler": "",
	};
	const targetExtname = converter.extname ?? "";
	const targetBackend = converter.backend ?? targetExtname.slice(1);
	const profile = targetBackend;

	if (profile) {
		attributes[`assembler-profile-${profile}`] = "";
		attributes["assembler-profile"] = profile;
	}

	if (targetBackend) {
		attributes[`assembler-backend-${targetBackend}`] = "";
		attributes["assembler-backend"] = targetBackend;
	}

	if (targetExtname) {
		const targetFiletype = targetExtname.slice(1);
		attributes[`assembler-filetype-${targetFiletype}`] = "";
		attributes["assembler-filetype"] = targetFiletype;
	}

	return attributes;
}

async function createExportedPageUrlMap(
	context: InstanceType<typeof GeneratorContext>,
	playbook: Record<string, unknown>,
	contentCatalog: unknown,
	converter: ReturnType<typeof createMarkdownConverter>,
	configSource: Record<string, unknown>,
	navigationCatalog?: {
		getNavigation: (component: string, version: string) => unknown[];
	},
) {
	const assemblerConfig = await loadAssemblerConfig.call(
		context,
		playbook,
		configSource,
		`-${converter.backend}`,
	);
	if (assemblerConfig.enabled === false) {
		return new Map<string, string>();
	}

	Object.assign(
		assemblerConfig.assembly.attributes,
		createIntrinsicAssemblerAttributes(converter),
	);

	const generatorFunctions = context.getFunctions();
	const loadAsciiDoc =
		generatorFunctions.loadAsciiDoc ?? require("@antora/asciidoc-loader");
	const assemblyFiles = produceAssemblyFiles(
		loadAsciiDoc,
		contentCatalog,
		assemblerConfig,
		(componentVersion: {
			name: string;
			navigation: unknown[];
			version: string;
		}) => ({
			...assemblerConfig.assembly,
			attributes: { ...assemblerConfig.assembly.attributes },
			navigation:
				navigationCatalog?.getNavigation(
					componentVersion.name,
					componentVersion.version,
				) ?? componentVersion.navigation,
		}),
	);
	const siteUrl =
		assemblerConfig.assembly.attributes["site-url"] ??
		assemblerConfig.assembly.attributes["primary-site-url"];
	const exportedPageUrlMap = new Map<string, string>();

	for (const assemblyFile of assemblyFiles) {
		const outputRelativePath = assemblyFile.src.relative.replace(
			/\.adoc$/u,
			converter.extname,
		);
		for (const page of assemblyFile.assembler.assembled.pages.keys()) {
			if (typeof page.pub?.url !== "string" || page.pub.url.length === 0) {
				continue;
			}

			exportedPageUrlMap.set(page.pub.url, outputRelativePath);
			if (typeof siteUrl === "string" && siteUrl.length > 0) {
				exportedPageUrlMap.set(
					new URL(page.pub.url, siteUrl).toString(),
					outputRelativePath,
				);
			}
		}
	}

	return exportedPageUrlMap;
}

async function runAntoraAssembler({
	buildDir,
	configSource,
	converter,
	keepSource = false,
	playbookPath,
	rootLevel,
}: {
	buildDir: string;
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	converter: ReturnType<typeof createMarkdownConverter>;
	keepSource?: boolean;
	playbookPath: string;
	rootLevel?: AssemblerRootLevel;
}) {
	const resolvedPlaybookPath = resolve(playbookPath);
	const playbookStats = await stat(resolvedPlaybookPath).catch(() => undefined);
	if (playbookStats === undefined || !playbookStats.isFile()) {
		throw new Error(`Antora playbook does not exist: ${resolvedPlaybookPath}`);
	}

	const playbook = buildPlaybook(
		["--playbook", resolvedPlaybookPath],
		process.env,
	);
	const baseAssemblerConfig = await loadAssemblerConfig.call(
		moduleShim,
		playbook,
		configSource,
		`-${converter.backend}`,
	);
	const assemblerConfig = mergeAssemblerConfig(baseAssemblerConfig, {
		buildDir,
		keepSource,
		rootLevel,
	});
	const context = new GeneratorContext(moduleShim);

	try {
		const { fxns, vars } = await GeneratorContext.start(context, playbook);
		vars.siteAsciiDocConfig = fxns.resolveAsciiDocConfig(playbook);
		if (!(vars.siteAsciiDocConfig.keepSource instanceof Boolean)) {
			vars.siteAsciiDocConfig.keepSource = Object.assign(new Boolean(true), {
				oldValue: vars.siteAsciiDocConfig.keepSource,
			});
		}
		const contentAggregate = await fxns.aggregateContent(playbook);
		vars.contentCatalog = fxns.classifyContent(
			playbook,
			contentAggregate,
			vars.siteAsciiDocConfig,
		);
		fxns.convertDocuments(vars.contentCatalog, vars.siteAsciiDocConfig);
		const navigationCatalog = fxns.buildNavigation(
			vars.contentCatalog,
			vars.siteAsciiDocConfig,
		);
		converter.setExportedPageUrlMap(
			await createExportedPageUrlMap(
				context,
				playbook,
				vars.contentCatalog,
				converter,
				assemblerConfig,
				navigationCatalog,
			),
		);

		return await assembleContent.call(
			context,
			playbook,
			vars.contentCatalog,
			converter,
			{
				configSource: assemblerConfig,
				navigationCatalog,
			},
		);
	} finally {
		await GeneratorContext.close(context);
	}
}

export async function resolveAntoraMarkdownExportDefaults({
	configSource,
	playbookPath,
}: {
	configSource?: AntoraMarkdownExporterExtensionConfig["configSource"];
	playbookPath: string;
}): Promise<AntoraMarkdownExportDefaults> {
	const resolvedPlaybookPath = resolve(playbookPath);
	const playbook = buildPlaybook(
		["--playbook", resolvedPlaybookPath],
		process.env,
	);
	const assemblerConfig = await loadAssemblerConfig.call(
		moduleShim,
		playbook,
		configSource,
		"-markdown",
	);
	const assemblyAttributes = assemblerConfig.assembly?.attributes ?? {};
	const playbookAttributes = playbook.asciidoc?.attributes ?? {};

	return {
		flavor: parseConfiguredFlavor(
			assemblyAttributes[exporterFlavorAttribute] ??
				playbookAttributes[exporterFlavorAttribute],
		),
		rootLevel:
			assemblerConfig.assembly?.rootLevel === 0 ||
			assemblerConfig.assembly?.rootLevel === 1
				? assemblerConfig.assembly.rootLevel
				: undefined,
		xrefFallbackLabelStyle: parseConfiguredXrefFallbackLabelStyle(
			assemblyAttributes[exporterXrefFallbackAttribute] ??
				playbookAttributes[exporterXrefFallbackAttribute],
		),
	};
}

export async function exportAntoraModules(
	options: AntoraMarkdownModuleExportOptions,
): Promise<AntoraMarkdownModuleExportResult> {
	const defaults = await resolveAntoraMarkdownExportDefaults({
		configSource: options.configSource,
		playbookPath: options.playbookPath,
	});
	const flavor = options.flavor ?? defaults.flavor ?? "gfm";
	const rootLevel = options.rootLevel ?? defaults.rootLevel ?? 1;
	const xrefFallbackLabelStyle =
		options.xrefFallbackLabelStyle ??
		defaults.xrefFallbackLabelStyle ??
		"fragment-or-basename";
	const outputRoot = resolve(options.outputRoot);
	const playbookPath = resolve(options.playbookPath);
	const converter = createMarkdownConverter({
		flavor,
		xrefFallbackLabelStyle,
	});
	const files = await runAntoraAssembler({
		buildDir: outputRoot,
		configSource: options.configSource,
		converter,
		keepSource: options.keepSource,
		playbookPath,
		rootLevel,
	});

	return {
		flavor,
		outputRoot,
		playbookPath,
		rootLevel,
		xrefFallbackLabelStyle,
		exportedFiles: files.map((file: { src: { relative: string } }) => {
			const relativeOutputPath = file.src.relative;
			return {
				moduleName: relativeOutputPath.replace(/\.md$/u, ""),
				outputPath: resolve(outputRoot, relativeOutputPath),
				relativeOutputPath,
			};
		}),
	};
}
