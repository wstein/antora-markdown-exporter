import type { MarkdownFlavorSpec } from "./flavor.js";
import type { MarkdownXref, MarkdownXrefFamily } from "./ir.js";

function stripAsciiDocExtension(value: string): string {
	return value.replace(/\.adoc$/i, ".html");
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
		return node.url;
	}

	const { target } = node;
	if (target.path.length === 0) {
		return target.fragment === undefined ? node.url : `#${target.fragment}`;
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
		return node.url;
	}
	segments.push(resolvedPath);

	const path = segments.join("/");
	return target.fragment === undefined ? path : `${path}#${target.fragment}`;
}
