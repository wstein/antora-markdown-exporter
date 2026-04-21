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

function collectInspectionReportFromBlocks(
	blocks: MarkdownBlock[],
): MarkdownInspectionReport {
	const includeDirectives = collectIncludeDirectivesFromBlocks(blocks);
	const xrefs = collectXrefsFromBlocks(blocks);

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

function collectNormalizedInspectionReport(
	document: MarkdownDocument,
): MarkdownInspectionReport {
	return collectInspectionReportFromBlocks(
		normalizeMarkdownIR(document).children,
	);
}

export function collectIncludeDirectives(
	document: MarkdownDocument,
): MarkdownIncludeDirective[] {
	return collectNormalizedInspectionReport(document).includeDirectives;
}

export function collectIncludeDiagnostics(
	document: MarkdownDocument,
): MarkdownIncludeDiagnosticEntry[] {
	return collectNormalizedInspectionReport(document).includeDiagnostics;
}

export function collectXrefs(document: MarkdownDocument): MarkdownXref[] {
	return collectNormalizedInspectionReport(document).xrefs;
}

export function collectXrefTargets(
	document: MarkdownDocument,
): MarkdownXrefTarget[] {
	return collectNormalizedInspectionReport(document).xrefTargets;
}

export function collectMarkdownInspectionReport(
	document: MarkdownDocument,
): MarkdownInspectionReport {
	return collectNormalizedInspectionReport(document);
}
