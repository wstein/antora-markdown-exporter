import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(
	typeof __filename === "string"
		? __filename
		: resolve(process.cwd(), "package.json"),
);
const buildPlaybook = require("@antora/playbook-builder");
const GeneratorContext = require("@antora/site-generator/generator-context");
const { configureLogger, finalizeLogger } = require("@antora/logger");
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

function parseConfiguredFlavor(value) {
	return ["gfm", "commonmark", "gitlab", "multimarkdown", "strict"].includes(
		value,
	)
		? value
		: undefined;
}

function mergeRuntimeLogConfig(playbook, runtimeLog) {
	if (!runtimeLog) {
		return playbook;
	}

	const playbookRuntime = playbook.runtime ?? {};
	const playbookLog = playbookRuntime.log ?? {};
	const runtimeLogDestination = runtimeLog.destination ?? {};
	const playbookDestination = playbookLog.destination ?? {};

	playbook.runtime = {
		...playbookRuntime,
		log: {
			...playbookLog,
			...runtimeLog,
			destination: {
				...playbookDestination,
				...runtimeLogDestination,
			},
		},
	};

	return playbook;
}

function createBuildConfig(buildDir, keepSource = false) {
	return {
		clean: false,
		keepSource,
		publish: false,
		...(buildDir ? { dir: buildDir } : {}),
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

async function prepareAntoraRuntime({
	buildDir,
	configSource,
	keepSource = false,
	playbookPath,
	preferredQualifier,
	runtimeLog,
	rootLevel,
}) {
	const resolvedPlaybookPath = resolve(playbookPath);
	const playbookStats = await stat(resolvedPlaybookPath).catch(() => undefined);
	if (playbookStats === undefined || !playbookStats.isFile()) {
		throw new Error(`Antora playbook does not exist: ${resolvedPlaybookPath}`);
	}

	const playbook = mergeRuntimeLogConfig(
		buildPlaybook(["--playbook", resolvedPlaybookPath], process.env),
		runtimeLog,
	);
	configureLogger(playbook.runtime.log, dirname(resolvedPlaybookPath));
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

	return {
		assemblerConfig,
		context,
		fxns,
		navigationCatalog,
		playbook,
		vars,
	};
}

function closeAntoraRuntime(context) {
	return GeneratorContext.close(context).then(() => finalizeLogger());
}

function produceAssemblerFiles(runtime) {
	const loadAsciiDoc =
		runtime.fxns.loadAsciiDoc ?? require("@antora/asciidoc-loader");
	return produceAssemblyFiles(
		loadAsciiDoc,
		runtime.vars.contentCatalog,
		runtime.assemblerConfig,
		(componentVersion) => ({
			...runtime.assemblerConfig.assembly,
			attributes: { ...runtime.assemblerConfig.assembly.attributes },
			navigation:
				runtime.navigationCatalog?.getNavigation(
					componentVersion.name,
					componentVersion.version,
				) ?? componentVersion.navigation,
		}),
	);
}

export async function assembleAntoraModules({
	configSource,
	playbookPath,
	runtimeLog,
	rootLevel,
}) {
	const runtime = await prepareAntoraRuntime({
		configSource,
		playbookPath,
		preferredQualifier: "-markdown",
		runtimeLog,
		rootLevel,
	});

	try {
		return produceAssemblerFiles(runtime);
	} finally {
		await closeAntoraRuntime(runtime.context);
	}
}

export async function runAntoraAssembler({
	buildDir,
	configSource,
	converter,
	keepSource = false,
	playbookPath,
	runtimeLog,
	rootLevel,
}) {
	const preferredQualifier = `-${
		converter?.backend ?? converter?.extname?.slice(1) ?? "markdown"
	}`;
	const runtime = await prepareAntoraRuntime({
		buildDir,
		configSource,
		keepSource,
		playbookPath,
		preferredQualifier,
		runtimeLog,
		rootLevel,
	});

	try {
		return await assembleContent.call(
			runtime.context,
			runtime.playbook,
			runtime.vars.contentCatalog,
			converter,
			{
				configSource: runtime.assemblerConfig,
				navigationCatalog: runtime.navigationCatalog,
			},
		);
	} finally {
		await closeAntoraRuntime(runtime.context);
	}
}

export async function resolveAntoraMarkdownExportDefaults({
	configSource,
	playbookPath,
	runtimeLog,
}) {
	const resolvedPlaybookPath = resolve(playbookPath);
	const playbook = mergeRuntimeLogConfig(
		buildPlaybook(["--playbook", resolvedPlaybookPath], process.env),
		runtimeLog,
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
	};
}
