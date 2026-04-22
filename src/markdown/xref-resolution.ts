import type { MarkdownFlavorSpec } from "./flavor.js";
import type {
	MarkdownXref,
	MarkdownXrefFamily,
	MarkdownXrefTarget,
} from "./ir.js";

function stripAsciiDocExtension(value: string): string {
	return value.replace(/\.adoc$/i, ".html");
}

function resolveSourceFamilyPath(target: MarkdownXrefTarget): string {
	const family = target.family ?? { kind: "page", name: "page" };
	if (family.kind === "page") {
		return target.path;
	}

	const familySegment = family.kind === "other" ? family.name : family.kind;
	return `${familySegment}/${target.path}`;
}

export function resolveMarkdownSourceXrefDestination(
	target: MarkdownXrefTarget,
	fallbackUrl: string,
): string {
	if (target.path.length === 0) {
		return target.fragment === undefined ? fallbackUrl : `#${target.fragment}`;
	}

	const segments = [target.component, target.version, target.module].filter(
		(segment): segment is string => segment !== undefined && segment.length > 0,
	);
	segments.push(resolveSourceFamilyPath(target));

	const path = segments.join("/");
	return target.fragment === undefined ? path : `${path}#${target.fragment}`;
}

function resolveSiteFamilyPath(
	family: MarkdownXrefFamily,
	path: string,
	flavor: MarkdownFlavorSpec,
): string | undefined {
	if (family.kind === "page") {
		return stripAsciiDocExtension(path);
	}

	const assetDirectory =
		flavor.xrefSiteAssetFamilies[
			family.kind as keyof typeof flavor.xrefSiteAssetFamilies
		];
	if (assetDirectory === undefined) {
		return undefined;
	}

	return `${assetDirectory}/${path}`;
}

export function resolveMarkdownXrefDestination(
	node: MarkdownXref,
	flavor: MarkdownFlavorSpec,
): string {
	if (flavor.xrefStyle === "source") {
		return resolveMarkdownSourceXrefDestination(node.target, node.url);
	}

	const { target } = node;
	if (target.path.length === 0) {
		return resolveMarkdownSourceXrefDestination(target, node.url);
	}

	const segments = [target.component, target.version].filter(
		(segment): segment is string => segment !== undefined && segment.length > 0,
	);
	const moduleSegment =
		target.module !== undefined &&
		target.module.length > 0 &&
		!(flavor.xrefSiteOmitRootModule && target.module === "ROOT")
			? target.module
			: undefined;
	if (moduleSegment !== undefined) {
		segments.push(moduleSegment);
	}

	const family = target.family ?? { kind: "page", name: "page" };
	const resolvedPath = resolveSiteFamilyPath(family, target.path, flavor);
	if (resolvedPath === undefined) {
		return resolveMarkdownSourceXrefDestination(target, node.url);
	}
	segments.push(resolvedPath);

	const path = segments.join("/");
	return target.fragment === undefined ? path : `${path}#${target.fragment}`;
}
