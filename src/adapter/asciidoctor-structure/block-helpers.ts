import type {
	AssemblyBlock,
	AssemblyCalloutList,
	AssemblyInline,
	AssemblyLabeledGroup,
	AssemblyList,
	AssemblyParagraph,
	AssemblyTable,
	AssemblyTableRow,
} from "../assembly-structure.js";
import { parseInlineHtmlWithOptions } from "./inline.js";
import { getSourceLocation } from "./shared.js";
import type {
	AsciidoctorBlock,
	AsciidoctorDescriptionListDescription,
	AsciidoctorDescriptionListTerm,
	AsciidoctorListItem,
	AsciidoctorTableCell,
	ExtractAssemblyStructureOptions,
} from "./types.js";

export function extractList(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
	extractBlock: (
		block: AsciidoctorBlock,
		options: ExtractAssemblyStructureOptions,
	) => AssemblyBlock[],
): AssemblyList {
	const items = (block.getItems?.() ?? []) as AsciidoctorListItem[];
	return {
		type: "list",
		ordered: block.getContext() === "olist",
		location: getSourceLocation(block),
		items: items.map((item) => ({
			location: getSourceLocation(item),
			children: [
				{
					type: "paragraph",
					children: parseInlineHtmlWithOptions(item.getText(), options),
				},
				...((item.getBlocks?.() ?? []).flatMap((child) =>
					extractBlock(child, options),
				) ?? []),
			],
		})),
	};
}

export function extractLabeledGroups(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
	extractBlock: (
		block: AsciidoctorBlock,
		options: ExtractAssemblyStructureOptions,
	) => AssemblyBlock[],
): AssemblyLabeledGroup[] {
	const items = (block.getItems?.() ?? []) as Array<
		[AsciidoctorDescriptionListTerm[], AsciidoctorDescriptionListDescription]
	>;

	return items.map(([terms, description]) => {
		const blocks = description.getBlocks?.() ?? [];
		const label: AssemblyInline[] = [];
		for (const [index, term] of terms.entries()) {
			if (index > 0) {
				label.push({ type: "text", value: "; " });
			}
			label.push(...parseInlineHtmlWithOptions(term.getText(), options));
		}
		const children =
			blocks.length > 0
				? blocks.flatMap((child) => extractBlock(child, options))
				: [
						{
							type: "paragraph",
							children: parseInlineHtmlWithOptions(
								description.getText?.() ?? "",
								options,
							),
							location: getSourceLocation(description),
						} satisfies AssemblyParagraph,
					];

		return {
			type: "labeledGroup",
			label,
			children,
			location: getSourceLocation(description),
		};
	});
}

export function extractAlignment(
	block: AsciidoctorBlock,
): AssemblyTable["align"] {
	const columnSpec = block
		.getAttribute("cols")
		?.split(",")
		.map((entry) => entry.trim());
	const columns = block.getColumns?.();
	if (columns === undefined) {
		return undefined;
	}

	return columns.map((column, index) => {
		const spec = columnSpec?.[index] ?? "";
		if (spec.includes("<")) {
			return "left";
		}
		if (spec.includes("^")) {
			return "center";
		}
		if (spec.includes(">")) {
			return "right";
		}

		const halign = column.getAttributes?.().halign;
		switch (halign) {
			case "center":
				return "center";
			case "right":
				return "right";
			default:
				return null;
		}
	});
}

export function extractRow(row: AsciidoctorTableCell[]): AssemblyTableRow {
	return {
		cells: row.map((cell) => ({
			children: parseInlineHtmlWithOptions(cell.getText(), {}),
		})),
	};
}

export function extractTable(block: AsciidoctorBlock): AssemblyTable {
	const headRows = block.getHeadRows?.() ?? [];
	const bodyRows = block.getBodyRows?.() ?? [];
	const rows = headRows.length > 0 ? bodyRows : bodyRows.slice(1);
	return {
		type: "table",
		location: getSourceLocation(block),
		align: extractAlignment(block),
		header: extractRow(
			(headRows[0] ?? bodyRows[0] ?? []) as AsciidoctorTableCell[],
		),
		rows: rows.map((row) => extractRow(row as AsciidoctorTableCell[])),
	};
}

export function extractCalloutList(
	block: AsciidoctorBlock,
	options: ExtractAssemblyStructureOptions,
	extractBlock: (
		block: AsciidoctorBlock,
		options: ExtractAssemblyStructureOptions,
	) => AssemblyBlock[],
): AssemblyCalloutList {
	const items = (block.getItems?.() ?? []) as AsciidoctorListItem[];
	return {
		type: "calloutList",
		location: getSourceLocation(block),
		items: items.map((item, index) => ({
			ordinal: index + 1,
			location: getSourceLocation(item),
			children: [
				{
					type: "paragraph",
					children: parseInlineHtmlWithOptions(item.getText(), options),
				},
				...((item.getBlocks?.() ?? []).flatMap((child) =>
					extractBlock(child, options),
				) ?? []),
			],
		})),
	};
}
