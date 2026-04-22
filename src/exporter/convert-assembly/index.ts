import type { MarkdownDocument } from "../../markdown/ir.js";
import { parseBlocks, parseDocumentRenderOptions } from "./blocks.js";
import { expandIncludes } from "./includes.js";
import type { ConvertAssemblyToMarkdownIROptions } from "./types.js";

export type { ConvertAssemblyToMarkdownIROptions } from "./types.js";

export function convertAssemblyToMarkdownIR(
	assembledAsciiDoc: string,
	options: ConvertAssemblyToMarkdownIROptions = {},
): MarkdownDocument {
	const expandedAsciiDoc = expandIncludes(assembledAsciiDoc, options);
	const lines = expandedAsciiDoc.split(/\r?\n/);

	return {
		type: "document",
		renderOptions: parseDocumentRenderOptions(lines),
		children: parseBlocks(lines),
	};
}
