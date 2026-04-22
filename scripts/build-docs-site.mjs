import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAntoraAssembler } from "../src/antora-runtime.js";

function runCommand(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		stdio: "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed`);
	}
}

export function getPdfOutputPath(rootDir, exportName) {
	return resolve(
		rootDir,
		"build/site/antora-markdown-exporter",
		`${exportName}.pdf`,
	);
}

function createPdfConverter() {
	return {
		backend: "pdf",
		extname: ".pdf",
		mediaType: "application/pdf",
		loggerName: "@wsmy/antora-markdown-exporter/pdf",
		async convert(file, convertAttributes, buildConfig, helpers) {
			const outputDir = buildConfig.dir ?? buildConfig.cwd ?? process.cwd();
			const outputPath = resolve(
				outputDir,
				file.src.basename.replace(/\.adoc$/u, ".pdf"),
			);
			convertAttributes.outdir = dirname(outputPath);
			convertAttributes.outfile = outputPath;
			convertAttributes.outfilesuffix = ".pdf";
			helpers.logCommand("asciidoctor-pdf", file, convertAttributes, "-a");
			return helpers.runCommand(
				"asciidoctor-pdf",
				[
					...convertAttributes.toArgs("-a", "asciidoctor-pdf"),
					"-o",
					outputPath,
					convertAttributes.docfile,
				],
				{
					cwd: buildConfig.cwd,
					stderr: "print",
					stdout: "ignore",
				},
			);
		},
	};
}

export async function buildDocsPdf(rootDir) {
	const outputDir = resolve(rootDir, "build/site/antora-markdown-exporter");
	await runAntoraAssembler({
		buildDir: outputDir,
		converter: createPdfConverter(),
		keepSource: true,
		playbookPath: resolve(rootDir, "antora-playbook.yml"),
		rootLevel: 1,
	});
	rmSync(resolve(outputDir, "antora-markdown-exporter"), {
		force: true,
		recursive: true,
	});
}

export async function buildDocsSite(rootDir) {
	await runCommand("antora", ["antora-playbook.yml"], rootDir);
	await buildDocsPdf(rootDir);
}

function isDirectExecution() {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}

	return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
}

if (isDirectExecution()) {
	try {
		const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
		await buildDocsSite(rootDir);
	} catch (error) {
		console.error(String(error instanceof Error ? error.message : error));
		process.exit(1);
	}
}
