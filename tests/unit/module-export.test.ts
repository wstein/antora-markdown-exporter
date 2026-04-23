import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveDefaultsFromRuntime = vi.fn();
const mockAssembleModulesFromRuntime = vi.fn();
const mockRunAssemblerRuntime = vi.fn();
const mockCreateMarkdownConverter = vi.fn();
const mockExtractAssemblyStructure = vi.fn();

vi.mock("../../src/antora-runtime.js", () => ({
	assembleAntoraModules: mockAssembleModulesFromRuntime,
	resolveAntoraMarkdownExportDefaults: mockResolveDefaultsFromRuntime,
	runAntoraAssembler: mockRunAssemblerRuntime,
}));

vi.mock("../../src/extension/index.js", () => ({
	createMarkdownConverter: mockCreateMarkdownConverter,
}));

vi.mock("../../src/adapter/asciidoctor-structure.js", () => ({
	extractAssemblyStructure: mockExtractAssemblyStructure,
}));

const {
	assembleAntoraModules,
	exportAntoraModules,
	exportAntoraModulesToMarkdown,
	runAntoraAssembler,
} = await import("../../src/module-export.ts");

describe("module export library internals", () => {
	beforeEach(() => {
		mockResolveDefaultsFromRuntime.mockReset();
		mockAssembleModulesFromRuntime.mockReset();
		mockRunAssemblerRuntime.mockReset();
		mockCreateMarkdownConverter.mockReset();
		mockExtractAssemblyStructure.mockReset();

		mockResolveDefaultsFromRuntime.mockResolvedValue({
			flavor: "gfm",
			rootLevel: 1,
		});
		mockCreateMarkdownConverter.mockReturnValue({
			convert: vi.fn(),
			write: vi.fn(),
		});
	});

	it("passes through the lower-level assembler runtime", async () => {
		const runtimeFiles = [{ src: { relative: "manual.md", stem: "manual" } }];
		mockRunAssemblerRuntime.mockResolvedValue(runtimeFiles);

		await expect(
			runAntoraAssembler({
				buildDir: "/tmp/antora-export",
				converter: { convert: vi.fn(), write: vi.fn() },
				playbookPath: "/workspace/antora-playbook.yml",
			}),
		).resolves.toBe(runtimeFiles);
	});

	it("normalizes assembled module provenance and falls back to null for mixed modules", async () => {
		mockAssembleModulesFromRuntime.mockResolvedValue([
			{
				assembler: {
					assembled: {
						pages: new Map([
							[
								{
									src: {
										family: "page",
										module: "manual",
										relative: "index.adoc",
									},
								},
								true,
							],
							[
								{
									src: {
										family: "page",
										module: "manual",
										relative: "index.adoc",
									},
								},
								true,
							],
							[
								{
									src: {
										family: "page",
										module: "onboarding",
										relative: "index.adoc",
									},
								},
								true,
							],
							[
								{
									src: {
										family: "image",
										module: "manual",
										relative: "diagram.png",
									},
								},
								true,
							],
						]),
					},
					downloadStem: "docs",
					rootLevel: 1,
				},
				contents: "= Docs\n",
				src: {
					component: "component",
					mediaType: "text/asciidoc",
					relative: "docs.adoc",
					stem: "docs",
					version: "latest",
				},
			},
		]);

		await expect(
			assembleAntoraModules({
				playbookPath: "/workspace/antora-playbook.yml",
			}),
		).resolves.toEqual([
			expect.objectContaining({
				assemblyName: "docs",
				moduleName: null,
				relativePath: "docs.adoc",
				sourcePages: [
					"modules/manual/pages/index.adoc",
					"modules/onboarding/pages/index.adoc",
				],
			}),
		]);
	});

	it("handles string, buffer, and stream markdown outputs and collects nested diagnostics", async () => {
		mockAssembleModulesFromRuntime.mockResolvedValue([
			{
				assembler: {
					assembled: {
						pages: new Map([
							[
								{
									src: {
										family: "page",
										module: "manual",
										relative: "guide.adoc",
									},
								},
								true,
							],
						]),
					},
					downloadStem: "guide",
					rootLevel: 1,
				},
				contents: "= Guide\n",
				src: {
					component: "component",
					mediaType: "text/asciidoc",
					relative: "guide.adoc",
					stem: "guide",
					version: "latest",
				},
			},
			{
				assembler: {
					assembled: {
						pages: new Map([
							[
								{
									src: {
										family: "page",
										module: "manual",
										relative: "buffered.adoc",
									},
								},
								true,
							],
						]),
					},
					downloadStem: "buffered",
					rootLevel: 1,
				},
				contents: "= Buffered\n",
				src: {
					component: "component",
					mediaType: "text/asciidoc",
					relative: "buffered.adoc",
					stem: "buffered",
					version: "latest",
				},
			},
		]);

		mockRunAssemblerRuntime.mockResolvedValue([
			{
				contents: "# Guide\n",
				src: {
					component: "component",
					mediaType: "text/markdown",
					relative: "guide.md",
					stem: "guide",
					version: "latest",
				},
			},
			{
				contents: Buffer.from("# Buffered\n", "utf8"),
				src: {
					component: "component",
					mediaType: "text/markdown",
					relative: "buffered.md",
					stem: "buffered",
					version: "latest",
				},
			},
			{
				contents: Readable.from(["# Streamed\n"]),
				src: {
					component: "component",
					mediaType: "text/markdown",
					relative: "streamed.md",
					stem: "streamed",
					version: "latest",
				},
			},
		]);

		mockExtractAssemblyStructure.mockReturnValue({
			children: [
				{
					type: "admonition",
					children: [
						{
							type: "unsupported",
							location: {
								column: 2,
								line: 4,
								path: "<stdin>",
							},
							reason: "admonition child unsupported",
						},
					],
				},
				{
					type: "footnoteDefinition",
					children: [
						{
							type: "unsupported",
							location: {
								column: 3,
								line: 8,
								path: "nested.adoc",
							},
							reason: "footnote child unsupported",
						},
					],
				},
				{
					type: "list",
					items: [
						{
							children: [
								{
									type: "unsupported",
									location: {
										column: 1,
										line: 12,
										path: "list.adoc",
									},
									reason: "list child unsupported",
								},
							],
						},
					],
				},
				{
					type: "labeledGroup",
					children: [
						{
							type: "unsupported",
							location: {
								column: 4,
								line: 15,
								path: "group.adoc",
							},
							reason: "group child unsupported",
						},
					],
				},
				{
					type: "calloutList",
					items: [
						{
							children: [
								{
									type: "unsupported",
									location: {
										column: 5,
										line: 18,
										path: "callout.adoc",
									},
									reason: "callout child unsupported",
								},
							],
						},
					],
				},
				{
					type: "paragraph",
					children: [],
				},
			],
		});

		const exports = await exportAntoraModulesToMarkdown({
			playbookPath: "/workspace/antora-playbook.yml",
		});

		expect(exports.map((entry) => entry.content)).toEqual([
			"# Guide\n",
			"# Buffered\n",
			"# Streamed\n",
		]);
		expect(exports[0]?.moduleName).toBe("manual");
		expect(exports[0]?.sourcePages).toEqual([
			"modules/manual/pages/guide.adoc",
		]);
		expect(exports[0]?.diagnostics).toEqual([
			expect.objectContaining({
				code: "unsupported-structure",
				message: "admonition child unsupported",
				severity: "warning",
				sourcePath: "guide.adoc",
			}),
			expect.objectContaining({
				code: "unsupported-structure",
				message: "footnote child unsupported",
				severity: "warning",
				sourcePath: "nested.adoc",
			}),
			expect.objectContaining({
				code: "unsupported-structure",
				message: "list child unsupported",
				severity: "warning",
				sourcePath: "list.adoc",
			}),
			expect.objectContaining({
				code: "unsupported-structure",
				message: "group child unsupported",
				severity: "warning",
				sourcePath: "group.adoc",
			}),
			expect.objectContaining({
				code: "unsupported-structure",
				message: "callout child unsupported",
				severity: "warning",
				sourcePath: "callout.adoc",
			}),
		]);
		expect(exports[2]).toEqual(
			expect.objectContaining({
				assemblyName: "streamed",
				diagnostics: [],
				moduleName: null,
				path: "streamed.md",
				sourcePages: [],
			}),
		);
	});

	it("writes markdown exports and optional source assemblies to disk", async () => {
		const outputRoot = await mkdtemp(
			join(tmpdir(), "antora-module-export-unit-"),
		);

		mockAssembleModulesFromRuntime.mockResolvedValue([
			{
				assembler: {
					assembled: {
						pages: new Map([
							[
								{
									src: {
										family: "page",
										module: "manual",
										relative: "index.adoc",
									},
								},
								true,
							],
						]),
					},
					downloadStem: "manual",
					rootLevel: 1,
				},
				contents: "= Manual\n",
				src: {
					component: "component",
					mediaType: "text/asciidoc",
					relative: "manual.adoc",
					stem: "manual",
					version: "latest",
				},
			},
		]);

		mockRunAssemblerRuntime.mockResolvedValue([
			{
				contents: "# Manual\n",
				src: {
					component: "component",
					mediaType: "text/markdown",
					relative: "manual.md",
					stem: "manual",
					version: "latest",
				},
			},
		]);

		mockExtractAssemblyStructure.mockReturnValue({ children: [] });

		try {
			const result = await exportAntoraModules({
				keepSource: true,
				outputRoot,
				playbookPath: "/workspace/antora-playbook.yml",
			});

			expect(result.exportedFiles).toEqual([
				expect.objectContaining({
					assemblyName: "manual",
					moduleName: "manual",
					relativeOutputPath: "manual.md",
				}),
			]);
			await expect(
				readFile(resolve(outputRoot, "manual.md"), "utf8"),
			).resolves.toBe("# Manual\n");
			await expect(
				readFile(resolve(outputRoot, "manual.adoc"), "utf8"),
			).resolves.toBe("= Manual\n");
		} finally {
			await rm(outputRoot, { force: true, recursive: true });
		}
	});
});
