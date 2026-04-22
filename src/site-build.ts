import { spawnSync } from "node:child_process";

function runCommand(command: string, args: string[], cwd: string): void {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		stdio: "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed`);
	}
}

export function runAntoraSiteBuild(rootDir: string): void {
	runCommand("antora", ["antora-playbook.yml"], rootDir);
}
