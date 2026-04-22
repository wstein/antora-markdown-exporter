import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAntoraSiteBuild } from "../src/index.js";

export async function buildDocsSite(rootDir) {
	runAntoraSiteBuild(rootDir);
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
