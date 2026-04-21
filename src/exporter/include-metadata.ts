import type { MarkdownIncludeDirective } from "../markdown/ir.js";

const includeDirectiveMarkerPrefix = "<!-- md-ir-include ";
const includeDirectiveMarkerSuffix = " -->";

export type IncludeDirectiveMarkerPayload = {
	attributes: Record<string, string>;
	diagnostics?: MarkdownIncludeDirective["diagnostics"];
	provenance?: MarkdownIncludeDirective["provenance"];
	semantics?: MarkdownIncludeDirective["semantics"];
	target: string;
};

export function encodeIncludeDirectiveMarker(
	payload: IncludeDirectiveMarkerPayload,
): string {
	return `${includeDirectiveMarkerPrefix}${JSON.stringify(payload)}${includeDirectiveMarkerSuffix}`;
}

export function decodeIncludeDirectiveMarker(
	line: string,
): MarkdownIncludeDirective | undefined {
	const trimmed = line.trim();
	if (
		!trimmed.startsWith(includeDirectiveMarkerPrefix) ||
		!trimmed.endsWith(includeDirectiveMarkerSuffix)
	) {
		return undefined;
	}

	const payload = JSON.parse(
		trimmed.slice(
			includeDirectiveMarkerPrefix.length,
			trimmed.length - includeDirectiveMarkerSuffix.length,
		),
	) as IncludeDirectiveMarkerPayload;

	return {
		type: "includeDirective",
		target: payload.target,
		attributes: payload.attributes,
		diagnostics: payload.diagnostics,
		semantics: payload.semantics,
		provenance: payload.provenance,
	};
}
