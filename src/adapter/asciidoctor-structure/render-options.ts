import type { AssemblyDocument } from "../assembly-structure.js";
import type { AsciidoctorBlock } from "./types.js";

export function parseRenderOptions(
	document: AsciidoctorBlock,
): AssemblyDocument["renderOptions"] {
	const numbered =
		document.getAttribute("sectnums") ?? document.getAttribute("numbered");
	const doctype = document.getAttribute("doctype");
	const toc = document.getAttribute("toc");
	const toclevels = document.getAttribute("toclevels");
	const maxDepth =
		toclevels === undefined ? undefined : Number.parseInt(toclevels, 10);
	return {
		headingNumbering:
			numbered === undefined
				? undefined
				: {
						mode: doctype === "book" ? "book" : "section",
					},
		tableOfContents:
			toc === undefined
				? undefined
				: {
						maxDepth: Number.isFinite(maxDepth) ? maxDepth : undefined,
					},
	};
}
