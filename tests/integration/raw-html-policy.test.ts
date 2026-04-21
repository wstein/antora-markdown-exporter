import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/markdown/render/index.js";

describe("raw HTML policy integration", () => {
	it("renders allowed and forbidden raw HTML through explicit fallback policy", () => {
		const document = {
			type: "document" as const,
			children: [
				{
					type: "paragraph" as const,
					children: [
						{ type: "text" as const, value: "Press " },
						{ type: "htmlInline" as const, value: "<kbd>Ctrl</kbd>" },
						{ type: "text" as const, value: " now." },
					],
				},
				{
					type: "htmlBlock" as const,
					value: "<div>raw</div>",
				},
			],
		};

		expect(renderMarkdown(document, "gfm")).toBe(
			[
				"Press <kbd>Ctrl</kbd> now.",
				"",
				"<!-- fallback: raw_html reason=html-block -->",
				"<div>raw</div>",
				"<!-- /fallback: raw_html -->",
				"",
			].join("\n"),
		);
		expect(renderMarkdown(document, "strict")).toBe(
			[
				"Press [Unsupported: raw HTML inline is not allowed in this flavor] now.",
				"",
				"> Unsupported: raw HTML blocks are not allowed in this flavor",
				"",
			].join("\n"),
		);
	});
});
