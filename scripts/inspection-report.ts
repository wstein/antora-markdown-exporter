import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	collectMarkdownInspectionReport,
	convertAssemblyToMarkdownIR,
} from "../src/index.js";

type InspectionCliOptions = {
	failOnDiagnostics: boolean;
	inputPath: string;
	sourcePath: string;
};

function parseArguments(argv: string[]): InspectionCliOptions {
	const positional: string[] = [];
	let failOnDiagnostics = false;
	let sourcePath: string | undefined;

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === undefined) {
			continue;
		}

		if (argument === "--fail-on-diagnostics") {
			failOnDiagnostics = true;
			continue;
		}

		if (argument === "--source-path") {
			const value = argv[index + 1];
			if (value === undefined) {
				throw new Error("Missing value for --source-path");
			}

			sourcePath = resolve(value);
			index += 1;
			continue;
		}

		if (argument.startsWith("--")) {
			throw new Error(`Unknown option: ${argument}`);
		}

		positional.push(argument);
	}

	const [inputPath] = positional;
	if (inputPath === undefined) {
		throw new Error("Missing input path");
	}

	const resolvedInputPath = resolve(inputPath);
	return {
		inputPath: resolvedInputPath,
		sourcePath: sourcePath ?? resolvedInputPath,
		failOnDiagnostics,
	};
}

function usage(): string {
	return [
		"Usage: bun scripts/inspection-report.ts <input.adoc> [--source-path <path>] [--fail-on-diagnostics]",
		"",
		"Emit a machine-readable JSON inspection report for one AsciiDoc source file.",
	].join("\n");
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const source = await readFile(options.inputPath, "utf8");
	const document = convertAssemblyToMarkdownIR(source, {
		sourcePath: options.sourcePath,
	});
	const report = collectMarkdownInspectionReport(document);

	console.log(
		JSON.stringify(
			{
				inputPath: options.inputPath,
				sourcePath: options.sourcePath,
				report,
			},
			null,
			2,
		),
	);

	if (options.failOnDiagnostics && report.includeDiagnostics.length > 0) {
		process.exitCode = 1;
	}
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(message);
	console.error("");
	console.error(usage());
	process.exitCode = 1;
}
