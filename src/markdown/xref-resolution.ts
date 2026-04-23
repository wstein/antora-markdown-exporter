import type { MarkdownFlavorSpec } from "./flavor.js";
import type { MarkdownXref, MarkdownXrefTarget } from "./ir.js";

export function resolveMarkdownSourceXrefDestination(
	_target: MarkdownXrefTarget,
	fallbackUrl: string,
): string {
	return fallbackUrl;
}

export function resolveMarkdownXrefDestination(
	node: MarkdownXref,
	_flavor: MarkdownFlavorSpec,
): string {
	return node.url;
}
