import type {
	MarkdownDocument,
	MarkdownIncludeDiagnostic,
	MarkdownIncludeDirective,
} from "./ir.js";
import { normalizeMarkdownIR } from "./normalize.js";

export type MarkdownIncludeDiagnosticEntry = {
	diagnostic: MarkdownIncludeDiagnostic;
	target: string;
};

export function collectIncludeDirectives(
	document: MarkdownDocument,
): MarkdownIncludeDirective[] {
	const normalized = normalizeMarkdownIR(document);
	return normalized.children.flatMap((block) =>
		block.type === "includeDirective" ? [block] : [],
	);
}

export function collectIncludeDiagnostics(
	document: MarkdownDocument,
): MarkdownIncludeDiagnosticEntry[] {
	return collectIncludeDirectives(document).flatMap((directive) =>
		(directive.diagnostics ?? []).map((diagnostic) => ({
			target: directive.target,
			diagnostic,
		})),
	);
}
