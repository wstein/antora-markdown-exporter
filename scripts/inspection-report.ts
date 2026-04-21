import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	collectMarkdownInspectionReport,
	convertAssemblyToMarkdownIR,
} from "../src/index.js";

type InspectionCliFormat = "github-actions" | "json";

type InspectionCliOptions = {
	failOnDiagnostics: boolean;
	format: InspectionCliFormat;
	inputPath: string;
	readFromStdin: boolean;
	sourcePath: string;
};

function parseArguments(argv: string[]): InspectionCliOptions {
	const positional: string[] = [];
	let failOnDiagnostics = false;
	let format: InspectionCliFormat = "json";
	let readFromStdin = false;
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

		if (argument === "--format") {
			const value = argv[index + 1];
			if (value !== "json" && value !== "github-actions") {
				throw new Error("Missing or invalid value for --format");
			}

			format = value;
			index += 1;
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

		if (argument === "--stdin") {
			readFromStdin = true;
			continue;
		}

		if (argument.startsWith("--")) {
			throw new Error(`Unknown option: ${argument}`);
		}

		if (argument === "-") {
			readFromStdin = true;
			continue;
		}

		positional.push(argument);
	}

	const [inputPath] = positional;
	if (readFromStdin && inputPath !== undefined) {
		throw new Error("Provide either an input path or --stdin, not both");
	}

	if (!readFromStdin && inputPath === undefined) {
		throw new Error("Missing input path");
	}

	return {
		failOnDiagnostics,
		format,
		inputPath: readFromStdin ? "<stdin>" : resolve(inputPath),
		readFromStdin,
		sourcePath: sourcePath ?? (readFromStdin ? "<stdin>" : resolve(inputPath)),
	};
}

function usage(): string {
	return [
		"Usage: bun scripts/inspection-report.ts <input.adoc> [--source-path <path>] [--format <json|github-actions>] [--fail-on-diagnostics]",
		"   or: bun scripts/inspection-report.ts --stdin [--source-path <path>] [--format <json|github-actions>] [--fail-on-diagnostics]",
		"",
		"Emit a machine-readable JSON inspection report for one AsciiDoc source file.",
	].join("\n");
}

function readStdin(): Promise<string> {
	return new Promise((resolveInput, reject) => {
		const chunks: Uint8Array[] = [];
		process.stdin.on("data", (chunk) => {
			chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
		});
		process.stdin.on("end", () => {
			resolveInput(Buffer.concat(chunks).toString("utf8"));
		});
		process.stdin.on("error", reject);
	});
}

function escapeGitHubAnnotationValue(value: string): string {
	return value
		.replaceAll("%", "%25")
		.replaceAll("\r", "%0D")
		.replaceAll("\n", "%0A")
		.replaceAll(":", "%3A")
		.replaceAll(",", "%2C");
}

function emitGitHubActionsAnnotations(
	options: InspectionCliOptions,
	source: string,
): void {
	const document = convertAssemblyToMarkdownIR(source, {
		sourcePath: options.sourcePath,
	});
	const report = collectMarkdownInspectionReport(document);

	for (const entry of report.includeDiagnostics) {
		const message = `${entry.diagnostic.code}: ${entry.diagnostic.message}${
			entry.diagnostic.source === undefined
				? ""
				: ` (source: ${entry.diagnostic.source})`
		}`;
		console.log(
			`::error file=${escapeGitHubAnnotationValue(options.sourcePath)},title=${escapeGitHubAnnotationValue(`include:${entry.target}`)}::${escapeGitHubAnnotationValue(message)}`,
		);
	}

	console.log(
		`::notice title=inspection-report::${escapeGitHubAnnotationValue(
			`includeDirectives=${report.includeDirectives.length} includeDiagnostics=${report.includeDiagnostics.length} xrefs=${report.xrefs.length}`,
		)}`,
	);

	if (options.failOnDiagnostics && report.includeDiagnostics.length > 0) {
		process.exitCode = 1;
	}
}

async function main(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	const source = options.readFromStdin
		? await readStdin()
		: await readFile(options.inputPath, "utf8");

	if (options.format === "github-actions") {
		emitGitHubActionsAnnotations(options, source);
		return;
	}

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
