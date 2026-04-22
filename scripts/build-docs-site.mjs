import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAntoraSiteBuild } from "../src/index.js";

export { runAntoraSiteBuild as buildDocsSite };

if (
	process.argv[1] &&
	resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
	try {
		const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
		runAntoraSiteBuild(rootDir);
	} catch (error) {
		console.error(String(error instanceof Error ? error.message : error));
		process.exit(1);
	}
}
