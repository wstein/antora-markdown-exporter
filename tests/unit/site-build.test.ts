import { afterEach, describe, expect, it, vi } from "vitest";

describe("site build helpers", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("runs the Antora CLI against the repository playbook", async () => {
		const spawnSync = vi.fn(() => ({ status: 0 }));
		vi.doMock("node:child_process", () => ({
			spawnSync,
		}));

		const { runAntoraSiteBuild } = await import("../../src/site-build.ts");
		runAntoraSiteBuild("/workspace/project");

		expect(spawnSync).toHaveBeenCalledWith("antora", ["antora-playbook.yml"], {
			cwd: "/workspace/project",
			encoding: "utf8",
			stdio: "inherit",
		});
	});

	it("throws when the Antora CLI exits unsuccessfully", async () => {
		vi.doMock("node:child_process", () => ({
			spawnSync: vi.fn(() => ({ status: 1 })),
		}));

		const { runAntoraSiteBuild } = await import("../../src/site-build.ts");
		expect(() => runAntoraSiteBuild("/workspace/project")).toThrow(
			"antora antora-playbook.yml failed",
		);
	});
});
