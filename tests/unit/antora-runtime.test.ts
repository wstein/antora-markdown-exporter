import { describe, expect, it } from "vitest";
import {
	assembleAntoraModules,
	resolveAntoraMarkdownExportDefaults,
} from "../../src/antora-runtime.js";

describe("antora runtime helpers", () => {
	it("throws a clear error when the playbook file does not exist", async () => {
		await expect(
			assembleAntoraModules({
				playbookPath: "/tmp/antora-playbook-missing.yml",
			}),
		).rejects.toThrow(/Antora playbook does not exist:/);
	});

	it("returns an undefined flavor for unsupported configured flavor values", async () => {
		await expect(
			resolveAntoraMarkdownExportDefaults({
				configSource: {
					assembly: {
						attributes: {
							"markdown-exporter-flavor": "not-a-real-flavor",
						},
					},
				},
				playbookPath: "antora-playbook.yml",
			}),
		).resolves.toEqual(
			expect.objectContaining({
				flavor: undefined,
			}),
		);
	});
});
