import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runAntoraAssembler } from "../../src/runtime.ts";

function createProbeConverter() {
	return {
		backend: "probe",
		extname: ".txt",
		mediaType: "text/plain",
		async convert(file, convertAttributes) {
			const source = [
				`docfile=${convertAttributes.docfile}`,
				`source=${file.src.relative}`,
			].join("\n");
			await mkdir(dirname(convertAttributes.outfile), { recursive: true });
			await writeFile(convertAttributes.outfile, `${source}\n`);
			return {
				contents: Buffer.from(source, "utf8"),
				extname: ".txt",
				mediaType: "text/plain",
				path: convertAttributes.outfile,
				src: {
					...file.src,
					basename: file.src.basename.replace(/\.adoc$/u, ".txt"),
					extname: ".txt",
					relative: file.src.relative.replace(/\.adoc$/u, ".txt"),
				},
			};
		},
	};
}

describe("antora assembler runtime", () => {
	it("produces one export per top-level Antora navigation entry", async () => {
		const buildDir = await mkdtemp(resolve(tmpdir(), "antora-assembler-"));
		const files = await runAntoraAssembler({
			buildDir,
			converter: createProbeConverter(),
			playbookPath: resolve("antora-playbook.yml"),
			rootLevel: 1,
		});

		expect(files.map((file) => file.src.relative)).toEqual([
			"documentation.txt",
			"architecture.txt",
			"manual.txt",
			"onboarding.txt",
		]);
		await expect(
			readFile(
				resolve(
					buildDir,
					"antora-markdown-exporter/_exports/documentation.txt",
				),
				"utf8",
			),
		).resolves.toContain("source=documentation.adoc");
	});

	it("produces a single component-level export for root level 0", async () => {
		const buildDir = await mkdtemp(resolve(tmpdir(), "antora-assembler-"));
		const files = await runAntoraAssembler({
			buildDir,
			converter: createProbeConverter(),
			playbookPath: resolve("antora-playbook.yml"),
			rootLevel: 0,
		});

		expect(files.map((file) => file.src.relative)).toEqual(["index.txt"]);
		await expect(
			readFile(
				resolve(buildDir, "antora-markdown-exporter/_exports/index.txt"),
				"utf8",
			),
		).resolves.toContain("source=index.adoc");
	});
});
