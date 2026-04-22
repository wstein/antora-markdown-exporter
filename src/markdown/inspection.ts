import type {
	MarkdownBlock,
	MarkdownDocument,
	MarkdownInline,
	MarkdownXref,
	MarkdownXrefTarget,
} from "./ir.js";
import { normalizeMarkdownIR } from "./normalize.js";

export type MarkdownInspectionReport = {
	xrefTargets: MarkdownXrefTarget[];
	xrefs: MarkdownXref[];
};

export type MarkdownInspectionRagEntry = {
	component?: string;
	destination: string;
	family: string;
	fragment?: string;
	index: number;
	label: string;
	module?: string;
	path: string;
	rawTarget: string;
	version?: string;
};

export type MarkdownInspectionRagDocument = {
	entries: MarkdownInspectionRagEntry[];
	xrefCount: number;
	xrefTargetCount: number;
};

function joinInlineText(children: MarkdownInline[]): string {
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
				case "footnoteReference":
					return child.label ?? child.identifier;
				case "citation":
					return child.label ?? child.identifier;
				default:
					return "";
			}
		})
		.join("")
		.replace(/\s+/gu, " ")
		.trim();
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
	const xrefs = collectXrefsFromBlocks(blocks);

	return {
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

export function collectMarkdownInspectionRagDocument(
	document: MarkdownDocument,
): MarkdownInspectionRagDocument {
	const report = collectNormalizedInspectionReport(document);
	return {
		xrefCount: report.xrefs.length,
		xrefTargetCount: report.xrefTargets.length,
		entries: report.xrefs.map((xref, index) => ({
			index,
			label: joinInlineText(xref.children),
			destination: xref.url,
			rawTarget: xref.target.raw,
			path: xref.target.path,
			family: xref.target.family?.kind ?? "page",
			component: xref.target.component,
			module: xref.target.module,
			version: xref.target.version,
			fragment: xref.target.fragment,
		})),
	};
}
