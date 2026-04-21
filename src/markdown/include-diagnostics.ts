import type {
	MarkdownBlock,
	MarkdownDocument,
	MarkdownIncludeDiagnostic,
	MarkdownIncludeDirective,
	MarkdownInline,
	MarkdownXref,
	MarkdownXrefTarget,
} from "./ir.js";
import { normalizeMarkdownIR } from "./normalize.js";

export type MarkdownIncludeDiagnosticEntry = {
	diagnostic: MarkdownIncludeDiagnostic;
	target: string;
};

export type MarkdownInspectionReport = {
	includeDiagnostics: MarkdownIncludeDiagnosticEntry[];
	includeDirectives: MarkdownIncludeDirective[];
	xrefTargets: MarkdownXrefTarget[];
	xrefs: MarkdownXref[];
};

function collectIncludeDirectivesFromBlocks(
	blocks: MarkdownBlock[],
): MarkdownIncludeDirective[] {
	return blocks.flatMap((block) => {
		switch (block.type) {
			case "includeDirective":
				return [block];
			case "blockquote":
			case "admonition":
				return collectIncludeDirectivesFromBlocks(block.children);
			case "list":
				return block.items.flatMap((item) =>
					collectIncludeDirectivesFromBlocks(item.children),
				);
			case "calloutList":
				return block.items.flatMap((item) =>
					collectIncludeDirectivesFromBlocks(item.children),
				);
			case "footnoteDefinition":
				return collectIncludeDirectivesFromBlocks(block.children);
			default:
				return [];
		}
	});
}

function collectXrefsFromInlineChildren(
	children: MarkdownInline[],
): MarkdownXref[] {
	return children.flatMap((child) => {
		switch (child.type) {
			case "xref":
				return [child, ...collectXrefsFromInlineChildren(child.children)];
			case "emphasis":
			case "strong":
			case "link":
				return collectXrefsFromInlineChildren(child.children);
			case "image":
				return collectXrefsFromInlineChildren(child.alt);
			default:
				return [];
		}
	});
}

function collectXrefsFromBlocks(blocks: MarkdownBlock[]): MarkdownXref[] {
	return blocks.flatMap((block) => {
		switch (block.type) {
			case "paragraph":
			case "heading":
				return collectXrefsFromInlineChildren(block.children);
			case "blockquote":
			case "admonition":
				return collectXrefsFromBlocks(block.children);
			case "list":
				return block.items.flatMap((item) =>
					collectXrefsFromBlocks(item.children),
				);
			case "calloutList":
				return block.items.flatMap((item) =>
					collectXrefsFromBlocks(item.children),
				);
			case "table":
				return [
					...collectXrefsFromInlineChildren(
						block.header.cells.flatMap((cell) => cell.children),
					),
					...block.rows.flatMap((row) =>
						collectXrefsFromInlineChildren(
							row.cells.flatMap((cell) => cell.children),
						),
					),
				];
			case "footnoteDefinition":
				return collectXrefsFromBlocks(block.children);
			default:
				return [];
		}
	});
}

export function collectIncludeDirectives(
	document: MarkdownDocument,
): MarkdownIncludeDirective[] {
	const normalized = normalizeMarkdownIR(document);
	return collectIncludeDirectivesFromBlocks(normalized.children);
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

export function collectXrefs(document: MarkdownDocument): MarkdownXref[] {
	const normalized = normalizeMarkdownIR(document);
	return collectXrefsFromBlocks(normalized.children);
}

export function collectXrefTargets(
	document: MarkdownDocument,
): MarkdownXrefTarget[] {
	return collectXrefs(document).map((xref) => xref.target);
}

export function collectMarkdownInspectionReport(
	document: MarkdownDocument,
): MarkdownInspectionReport {
	const normalized = normalizeMarkdownIR(document);
	const includeDirectives = collectIncludeDirectivesFromBlocks(
		normalized.children,
	);
	const xrefs = collectXrefsFromBlocks(normalized.children);

	return {
		includeDirectives,
		includeDiagnostics: includeDirectives.flatMap((directive) =>
			(directive.diagnostics ?? []).map((diagnostic) => ({
				target: directive.target,
				diagnostic,
			})),
		),
		xrefs,
		xrefTargets: xrefs.map((xref) => xref.target),
	};
}
