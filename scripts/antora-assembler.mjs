import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const buildPlaybook = require("@antora/playbook-builder");
const GeneratorContext = require("@antora/site-generator/generator-context");
const { assembleContent } = require("@antora/assembler");

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

function createBuildConfig(buildDir, keepSource = false) {
	return {
		clean: false,
		dir: buildDir,
		keepSource,
		publish: false,
	};
}

function createAssemblerConfigSource(rootLevel, buildDir, keepSource = false) {
	return {
		assembly: {
			attributes: defaultAssemblyAttributes,
			doctype: "book",
			rootLevel,
		},
		build: createBuildConfig(buildDir, keepSource),
	};
}

export async function runAntoraAssembler({
	buildDir,
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

		return await assembleContent.call(
			context,
			playbook,
			vars.contentCatalog,
			converter,
			{
				configSource: createAssemblerConfigSource(
					rootLevel,
					buildDir,
					keepSource,
				),
				navigationCatalog,
			},
		);
	} finally {
		await GeneratorContext.close(context);
	}
}
