import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
	MarkdownIncludeDiagnostic,
	MarkdownIncludeDirective,
	MarkdownIncludeLineRange,
	MarkdownIncludeSemantics,
	MarkdownIncludeTagSelection,
} from "../../markdown/ir.js";
import {
	decodeIncludeDirectiveMarker,
	encodeIncludeDirectiveMarker,
} from "../include-metadata.js";
import type {
	ConvertAssemblyToMarkdownIROptions,
	IncludeDirective,
} from "./types.js";

const includePattern = /^include::([^[]+)\[([^\]]*)\]$/;
const tagStartPattern = /^\s*\/\/\s*tag::([A-Za-z0-9:_-]+)\[\]\s*$/;
const tagEndPattern = /^\s*\/\/\s*end::([A-Za-z0-9:_-]+)\[\]\s*$/;

type ParsedIncludeSemantics = {
	diagnostics: MarkdownIncludeDiagnostic[];
	semantics?: MarkdownIncludeSemantics;
};

function parseDirectiveAttributes(value: string): Record<string, string> {
	const entries = value
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	const attributes: Record<string, string> = {};

	for (const entry of entries) {
		const separatorIndex = entry.indexOf("=");
		if (separatorIndex === -1) {
			attributes[entry] = "true";
			continue;
		}

		const key = entry.slice(0, separatorIndex).trim();
		const rawValue = entry.slice(separatorIndex + 1).trim();
		attributes[key] = rawValue.replace(/^"|"$/g, "");
	}

	return attributes;
}

function parseIncludeDirective(line: string): IncludeDirective | undefined {
	const match = line.trim().match(includePattern);
	if (match === null) {
		return undefined;
	}

	const [, target, rawAttributes] = match;
	if (target === undefined || rawAttributes === undefined) {
		return undefined;
	}

	return {
		target,
		attributes: parseDirectiveAttributes(rawAttributes),
	};
}

export function resolveIncludePath(
	sourcePath: string,
	includeTarget: string,
	includeRootDir = dirname(sourcePath),
): string {
	if (includeTarget.startsWith("partial$")) {
		return resolve(
			includeRootDir,
			"partials",
			includeTarget.slice("partial$".length),
		);
	}

	return resolve(dirname(sourcePath), includeTarget);
}

function defaultIncludeResolver(
	includeTarget: string,
	context: { includeRootDir: string; sourcePath: string },
): string | undefined {
	const resolvedPath = resolveIncludePath(
		context.sourcePath,
		includeTarget,
		context.includeRootDir,
	);
	if (!existsSync(resolvedPath)) {
		return undefined;
	}

	return readFileSync(resolvedPath, "utf8");
}

function selectTaggedRegions(content: string, tagValue: string): string {
	const requestedTags = parseIncludeTagSelection(tagValue)?.tags ?? [];
	if (requestedTags.length === 0) {
		return content;
	}

	const activeTags = new Set<string>();
	const selectedLines: string[] = [];
	for (const line of content.split(/\r?\n/)) {
		const startMatch = line.match(tagStartPattern);
		if (startMatch?.[1] !== undefined) {
			activeTags.add(startMatch[1]);
			continue;
		}

		const endMatch = line.match(tagEndPattern);
		if (endMatch?.[1] !== undefined) {
			activeTags.delete(endMatch[1]);
			continue;
		}

		if (requestedTags.some((tag) => activeTags.has(tag))) {
			selectedLines.push(line);
		}
	}

	return selectedLines.join("\n");
}

function parsePositiveInteger(value: string): number | undefined {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return undefined;
	}

	return parsed;
}

function parseIncludeTagSelection(
	tagValue: string,
): MarkdownIncludeTagSelection | undefined {
	const tags = [
		...new Set(
			tagValue
				.split(/[;,]/)
				.map((tag) => tag.trim())
				.filter(Boolean),
		),
	];
	if (tags.length === 0) {
		return undefined;
	}

	return {
		precedence: "document-order",
		tags,
	};
}

function parseIncludeLineRanges(lineSpec: string): {
	diagnostics: MarkdownIncludeDiagnostic[];
	lineRanges?: MarkdownIncludeLineRange[];
} {
	const diagnostics: MarkdownIncludeDiagnostic[] = [];
	const ranges = lineSpec
		.split(/[;,]/)
		.map((segment) => segment.trim())
		.filter(Boolean)
		.flatMap<MarkdownIncludeLineRange>((segment) => {
			const rangeMatch = segment.match(/^(-?\d*)\.\.(-?\d*)(?:\.\.(\d+))?$/);
			if (rangeMatch !== null) {
				const [, rawStart = "", rawEnd = "", rawStep = ""] = rangeMatch;
				if (rawStart.startsWith("-") || rawEnd.startsWith("-")) {
					diagnostics.push({
						code: "invalid-line-range",
						message:
							"include line ranges must use positive line numbers or open-ended bounds",
						source: segment,
					});
					return [];
				}
				const start =
					rawStart === "" ? undefined : parsePositiveInteger(rawStart);
				const end = rawEnd === "" ? undefined : parsePositiveInteger(rawEnd);
				const step = rawStep === "" ? undefined : parsePositiveInteger(rawStep);
				if (start === undefined && end === undefined) {
					diagnostics.push({
						code: "invalid-line-range",
						message: "include line ranges cannot omit both bounds",
						source: segment,
					});
					return [];
				}
				if (rawStep !== "" && step === undefined) {
					diagnostics.push({
						code: "invalid-line-step",
						message: "include line steps must be positive integers",
						source: segment,
					});
					return [];
				}

				if (
					start !== undefined &&
					end !== undefined &&
					Number.isFinite(start) &&
					Number.isFinite(end)
				) {
					return start <= end
						? [{ start, end, step }]
						: [{ start: end, end: start, step }];
				}

				return [{ start, end, step }];
			}

			const lineNumber = parsePositiveInteger(segment);
			if (lineNumber === undefined) {
				diagnostics.push({
					code: "invalid-line-range",
					message: "include line selectors must be positive integers or ranges",
					source: segment,
				});
				return [];
			}

			return [{ start: lineNumber, end: lineNumber }];
		});

	return {
		diagnostics,
		lineRanges: ranges.length === 0 ? undefined : ranges,
	};
}

function parseIncludeSemantics(
	attributes: Record<string, string>,
): ParsedIncludeSemantics {
	const diagnostics: MarkdownIncludeDiagnostic[] = [];
	const tagValue = attributes.tag ?? attributes.tags;
	const tagSelection =
		tagValue === undefined ? undefined : parseIncludeTagSelection(tagValue);
	if (tagValue !== undefined && tagSelection === undefined) {
		diagnostics.push({
			code: "empty-tag-selection",
			message: "include tag selection must contain at least one tag",
			source: tagValue,
		});
	}
	const parsedLineRanges =
		attributes.lines === undefined
			? { diagnostics: [], lineRanges: undefined }
			: parseIncludeLineRanges(attributes.lines);
	diagnostics.push(...parsedLineRanges.diagnostics);
	const indent =
		attributes.indent === undefined
			? undefined
			: parsePositiveInteger(attributes.indent);
	if (attributes.indent !== undefined && indent === undefined) {
		diagnostics.push({
			code: "invalid-indent",
			message: "include indent must be a positive integer",
			source: attributes.indent,
		});
	}
	const levelOffsetMatch = attributes.leveloffset?.match(/^([+-]?\d+)$/);
	const levelOffset =
		levelOffsetMatch?.[1] === undefined
			? undefined
			: Number(levelOffsetMatch[1]);
	if (
		attributes.leveloffset !== undefined &&
		(levelOffset === undefined || !Number.isFinite(levelOffset))
	) {
		diagnostics.push({
			code: "invalid-leveloffset",
			message: "include leveloffset must be a signed integer",
			source: attributes.leveloffset,
		});
	}

	if (
		tagSelection === undefined &&
		parsedLineRanges.lineRanges === undefined &&
		indent === undefined &&
		(levelOffset === undefined || !Number.isFinite(levelOffset))
	) {
		return {
			diagnostics,
		};
	}

	return {
		diagnostics,
		semantics: {
			tagSelection,
			lineRanges: parsedLineRanges.lineRanges,
			indent,
			levelOffset:
				levelOffset !== undefined && Number.isFinite(levelOffset)
					? levelOffset
					: undefined,
		},
	};
}

function applyLevelOffset(content: string, levelOffset: string): string {
	const match = levelOffset.match(/^([+-]?\d+)$/);
	if (match?.[1] === undefined) {
		return content;
	}

	const delta = Number(match[1]);
	if (!Number.isFinite(delta) || delta === 0) {
		return content;
	}

	return content
		.split(/\r?\n/)
		.map((line) => {
			const headingMatch = line.match(/^(=+)(\s+.*)$/);
			if (headingMatch === null) {
				return line;
			}

			const [, markers, rest] = headingMatch;
			if (markers === undefined || rest === undefined) {
				return line;
			}

			const adjustedDepth = Math.max(1, markers.length + delta);
			return `${"=".repeat(adjustedDepth)}${rest}`;
		})
		.join("\n");
}

function applyLineSelection(content: string, lineSpec: string): string {
	const lines = content.split(/\r?\n/);
	const ranges = parseIncludeLineRanges(lineSpec).lineRanges;
	if (ranges === undefined) {
		return content;
	}

	const selectedLines: string[] = [];
	const seenLineNumbers = new Set<number>();

	for (const range of ranges) {
		const start = range.start ?? 1;
		const end = range.end ?? lines.length;
		const step = range.step ?? 1;
		for (let index = start; index <= end; index += step) {
			if (seenLineNumbers.has(index)) {
				continue;
			}

			const line = lines[index - 1];
			if (line !== undefined) {
				selectedLines.push(line);
				seenLineNumbers.add(index);
			}
		}
	}

	return selectedLines.join("\n");
}

function applyIndent(content: string, indent: string): string {
	const size = Number(indent);
	if (!Number.isFinite(size) || size <= 0) {
		return content;
	}

	const padding = " ".repeat(size);
	return content
		.split(/\r?\n/)
		.map((line) => (line.length === 0 ? line : `${padding}${line}`))
		.join("\n");
}

function applyIncludeAttributes(
	content: string,
	attributes: Record<string, string>,
): string {
	const tagSelection = attributes.tag ?? attributes.tags;
	let transformed =
		tagSelection === undefined
			? content
			: selectTaggedRegions(content, tagSelection);

	if (attributes.leveloffset !== undefined) {
		transformed = applyLevelOffset(transformed, attributes.leveloffset);
	}
	if (attributes.lines !== undefined) {
		transformed = applyLineSelection(transformed, attributes.lines);
	}
	if (attributes.indent !== undefined) {
		transformed = applyIndent(transformed, attributes.indent);
	}

	return transformed;
}

export function expandIncludes(
	assembledAsciiDoc: string,
	options: ConvertAssemblyToMarkdownIROptions,
	visited = new Set<string>(),
): string {
	if (options.sourcePath === undefined) {
		return assembledAsciiDoc;
	}

	const includeRootDir = options.includeRootDir ?? dirname(options.sourcePath);
	const includeResolver = options.includeResolver ?? defaultIncludeResolver;
	const lines = assembledAsciiDoc.split(/\r?\n/);
	const expandedLines: string[] = [];
	const inclusionStack = [...visited, options.sourcePath].filter(
		(path, index, array) => array.indexOf(path) === index,
	);

	for (const line of lines) {
		const directive = parseIncludeDirective(line);
		if (directive === undefined) {
			expandedLines.push(line);
			continue;
		}
		const includeTarget = directive.target;

		const resolvedPath = resolveIncludePath(
			options.sourcePath,
			includeTarget,
			includeRootDir,
		);
		const parsedSemantics = parseIncludeSemantics(directive.attributes);
		expandedLines.push(
			encodeIncludeDirectiveMarker({
				target: includeTarget,
				attributes: directive.attributes,
				diagnostics:
					parsedSemantics.diagnostics.length === 0
						? undefined
						: parsedSemantics.diagnostics,
				semantics: parsedSemantics.semantics,
				provenance: {
					depth: inclusionStack.length - 1,
					includeRootDir,
					inclusionStack,
					includingSourcePath: options.sourcePath,
					resolvedPath,
				},
			}),
		);
		if (visited.has(resolvedPath)) {
			expandedLines.push(
				`// include cycle prevented for ${includeTarget} from ${options.sourcePath}`,
			);
			continue;
		}

		const includeContent = includeResolver(includeTarget, {
			includeRootDir,
			sourcePath: options.sourcePath,
		});
		if (includeContent === undefined) {
			expandedLines.push(line);
			continue;
		}
		const transformedInclude = applyIncludeAttributes(
			includeContent,
			directive.attributes,
		);

		const nestedVisited = new Set(visited);
		nestedVisited.add(resolvedPath);
		const expandedInclude = expandIncludes(
			transformedInclude,
			{
				...options,
				includeRootDir,
				sourcePath: resolvedPath,
			},
			nestedVisited,
		);
		expandedLines.push(expandedInclude);
	}

	return expandedLines.join("\n");
}

export function parseIncludeDirectiveMarker(
	line: string,
): MarkdownIncludeDirective | undefined {
	return decodeIncludeDirectiveMarker(line);
}
