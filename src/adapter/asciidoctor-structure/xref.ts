import type {
	AssemblyBlock,
	AssemblyInline,
	AssemblyText,
	AssemblyXrefFamily,
	AssemblyXrefTarget,
} from "../assembly-structure.js";
import type { ExtractAssemblyStructureOptions } from "./types.js";

function normalizeXrefFamilyPath(
	family: AssemblyXrefFamily["kind"],
	path: string,
): string {
	if (
		(family === "page" || family === "example" || family === "partial") &&
		path.endsWith(".html")
	) {
		return path.replace(/\.html$/u, ".adoc");
	}

	return path;
}

function parseXrefFamily(
	name: string | undefined,
): AssemblyXrefFamily | undefined {
	if (name === undefined || name.length === 0) {
		return undefined;
	}

	switch (name) {
		case "attachment":
		case "example":
		case "image":
		case "page":
		case "partial":
			return {
				kind: name,
				name,
			};
		default:
			return {
				kind: "other",
				name,
			};
	}
}

export function parseXrefTarget(href: string): AssemblyXrefTarget {
	if (href.startsWith("#")) {
		return {
			raw: href,
			path: "",
			fragment: href.slice(1),
		};
	}

	const [rawPath, fragment] = href.split("#", 2);
	const qualifiedPattern =
		/^(?:(?<version>[^@/#]+)@)?(?:(?<component>[^:/#]+):(?<module>[^:/#]+):)?(?:(?<family>[^$:/#]+)\$)?(?<path>.+)$/u;
	const qualifiedMatch = rawPath?.match(qualifiedPattern);
	const component = qualifiedMatch?.groups?.component;
	const moduleName = qualifiedMatch?.groups?.module;
	const version = qualifiedMatch?.groups?.version;
	const family = parseXrefFamily(qualifiedMatch?.groups?.family);
	const familyKind = family?.kind ?? "page";
	const path = normalizeXrefFamilyPath(
		familyKind,
		qualifiedMatch?.groups?.path ?? rawPath ?? "",
	);

	return {
		raw: href,
		component,
		module: moduleName,
		version,
		family,
		path,
		fragment,
	};
}

export function isStructuredXrefHref(href: string): boolean {
	if (href.startsWith("#")) {
		return true;
	}

	if (href.startsWith("http://") || href.startsWith("https://")) {
		return false;
	}

	return (
		href.includes(".md") ||
		href.includes(".html") ||
		href.includes("$") ||
		href.includes("@") ||
		/^[^:/#]+:[^:/#]+:/u.test(href)
	);
}

function joinInlineText(children: AssemblyInline[]): string {
	return children
		.map((child) => {
			switch (child.type) {
				case "text":
				case "code":
				case "htmlInline":
					return child.value;
				case "emphasis":
				case "strong":
				case "link":
				case "xref":
					return joinInlineText(child.children);
				case "image":
					return joinInlineText(child.alt);
				case "hardBreak":
				case "softBreak":
					return " ";
				default:
					return "";
			}
		})
		.join("")
		.trim();
}

export function deriveXrefFallbackLabel(
	target: AssemblyXrefTarget,
	style: NonNullable<ExtractAssemblyStructureOptions["xrefFallbackLabelStyle"]>,
): string {
	if (target.fragment !== undefined && target.fragment.length > 0) {
		return target.fragment;
	}

	if (style === "fragment-or-path") {
		return target.path.replace(/\.(adoc|html|md)$/u, "");
	}

	const lastSegment = target.path.split("/").at(-1) ?? target.path;
	return lastSegment.replace(/\.(adoc|html|md)$/u, "");
}

export function normalizeXrefChildren(
	href: string,
	target: AssemblyXrefTarget,
	children: AssemblyInline[],
	style: NonNullable<ExtractAssemblyStructureOptions["xrefFallbackLabelStyle"]>,
): AssemblyInline[] {
	const visibleText = joinInlineText(children);
	const preferredLabel = deriveXrefFallbackLabel(target, style);
	const generatedFallbackLabels = new Set([
		deriveXrefFallbackLabel(target, "fragment-or-basename"),
		deriveXrefFallbackLabel(target, "fragment-or-path"),
	]);
	const equivalentFallbackLabels = new Set([
		href,
		href.split("#", 1)[0] ?? href,
		target.raw,
		target.raw.split("#", 1)[0] ?? target.raw,
	]);
	if (
		visibleText.length > 0 &&
		!equivalentFallbackLabels.has(visibleText) &&
		!generatedFallbackLabels.has(visibleText)
	) {
		return children;
	}

	return [
		{
			type: "text",
			value: preferredLabel,
		},
	];
}

function applyXrefFallbackLabelStyleToInlines(
	children: AssemblyInline[],
	style: NonNullable<ExtractAssemblyStructureOptions["xrefFallbackLabelStyle"]>,
): AssemblyInline[] {
	return children.map((child) => {
		switch (child.type) {
			case "emphasis":
			case "strong":
			case "link":
				return {
					...child,
					children: applyXrefFallbackLabelStyleToInlines(child.children, style),
				};
			case "xref": {
				const visibleText = joinInlineText(child.children);
				const basenameLabel = deriveXrefFallbackLabel(
					child.target,
					"fragment-or-basename",
				);
				const pathLabel = deriveXrefFallbackLabel(
					child.target,
					"fragment-or-path",
				);
				const preferredLabel = deriveXrefFallbackLabel(child.target, style);
				const generatedFallbackChildren =
					visibleText === basenameLabel || visibleText === pathLabel
						? [{ type: "text", value: preferredLabel } satisfies AssemblyText]
						: applyXrefFallbackLabelStyleToInlines(child.children, style);
				return {
					...child,
					children: generatedFallbackChildren,
				};
			}
			case "image":
				return {
					...child,
					alt: applyXrefFallbackLabelStyleToInlines(child.alt, style),
				};
			default:
				return child;
		}
	});
}

export function applyXrefFallbackLabelStyleToBlocks(
	blocks: AssemblyBlock[],
	style: NonNullable<ExtractAssemblyStructureOptions["xrefFallbackLabelStyle"]>,
): AssemblyBlock[] {
	return blocks.map((block) => {
		switch (block.type) {
			case "paragraph":
			case "heading":
				return {
					...block,
					children: applyXrefFallbackLabelStyleToInlines(block.children, style),
				};
			case "list":
				return {
					...block,
					items: block.items.map((item) => ({
						...item,
						children: applyXrefFallbackLabelStyleToBlocks(item.children, style),
					})),
				};
			case "labeledGroup":
				return {
					...block,
					label: applyXrefFallbackLabelStyleToInlines(block.label, style),
					children: applyXrefFallbackLabelStyleToBlocks(block.children, style),
				};
			case "admonition":
			case "blockquote":
				return {
					...block,
					children: applyXrefFallbackLabelStyleToBlocks(block.children, style),
				};
			case "table":
				return {
					...block,
					header: {
						...block.header,
						cells: block.header.cells.map((cell) => ({
							...cell,
							children: applyXrefFallbackLabelStyleToInlines(
								cell.children,
								style,
							),
						})),
					},
					rows: block.rows.map((row) => ({
						...row,
						cells: row.cells.map((cell) => ({
							...cell,
							children: applyXrefFallbackLabelStyleToInlines(
								cell.children,
								style,
							),
						})),
					})),
				};
			case "calloutList":
				return {
					...block,
					items: block.items.map((item) => ({
						...item,
						children: applyXrefFallbackLabelStyleToBlocks(item.children, style),
					})),
				};
			default:
				return block;
		}
	});
}
