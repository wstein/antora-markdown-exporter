import type {
	AssemblyXrefFamily,
	AssemblyXrefTarget,
} from "../assembly-structure.js";

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
