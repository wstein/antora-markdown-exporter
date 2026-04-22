import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const buildPlaybook = require("@antora/playbook-builder");
const GeneratorContext = require("@antora/site-generator/generator-context");
const { assembleContent } = require("@antora/assembler");
const assemblerPackagePath = require.resolve("@antora/assembler/package.json");
const assemblerLibDir = resolve(dirname(assemblerPackagePath), "lib");
const loadAssemblerConfig = require(resolve(assemblerLibDir, "load-config.js"));
const produceAssemblyFiles = require(
	resolve(assemblerLibDir, "produce-assembly-files.js"),
);

const modulePath = fileURLToPath(import.meta.url);
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

function parseConfiguredFlavor(value) {
	return ["gfm", "commonmark", "gitlab", "multimarkdown", "strict"].includes(
		value,
	)
		? value
		: undefined;
}

function parseConfiguredXrefFallbackLabelStyle(value) {
	return value === "fragment-or-basename" || value === "fragment-or-path"
		? value
		: undefined;
}

function createBuildConfig(buildDir, keepSource = false) {
	return {
		clean: false,
		dir: buildDir,
		keepSource,
		publish: false,
	};
}

function mergeAssemblerConfig(
	baseConfig,
	{ buildDir, keepSource = false, rootLevel },
) {
	const baseAssembly = baseConfig.assembly ?? {};
	const baseAttributes = baseAssembly.attributes ?? {};
	const baseBuild = baseConfig.build ?? {};

	return {
		...baseConfig,
		assembly: {
			...baseAssembly,
			attributes: {
				...defaultAssemblyAttributes,
				...baseAttributes,
			},
			doctype: baseAssembly.doctype ?? "book",
			rootLevel: rootLevel ?? baseAssembly.rootLevel ?? 1,
		},
		build: {
			...baseBuild,
			...createBuildConfig(buildDir, keepSource),
		},
	};
}

function createIntrinsicAssemblerAttributes(converter) {
	const attributes = {
		"loader-assembler": "",
	};
	const targetExtname = converter?.extname ?? "";
	const targetBackend = converter?.backend ?? targetExtname.slice(1);
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
	context,
	playbook,
	contentCatalog,
	converter,
	configSource,
	navigationCatalog,
) {
	const assemblerConfig = await loadAssemblerConfig.call(
		context,
		playbook,
		configSource,
		`-${converter?.backend ?? converter?.extname?.slice(1) ?? ""}`,
	);
	if (assemblerConfig.enabled === false) {
		return new Map();
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
		(componentVersion) => ({
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
	const exportedPageUrlMap = new Map();

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

export async function runAntoraAssembler({
	buildDir,
	configSource,
	converter,
	keepSource = false,
	playbookPath,
	rootLevel,
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
	const preferredQualifier = `-${
		converter?.backend ?? converter?.extname?.slice(1) ?? "markdown"
	}`;
	const baseAssemblerConfig = await loadAssemblerConfig.call(
		moduleShim,
		playbook,
		configSource,
		preferredQualifier,
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
		if (typeof converter?.setExportedPageUrlMap === "function") {
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
		}

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

export async function resolveMarkdownExportDefaults({
	configSource,
	playbookPath,
}) {
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
