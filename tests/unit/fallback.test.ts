import { describe, expect, it } from "vitest";
import {
	renderUnsupportedBlock,
	renderUnsupportedInline,
	resolveRawHtmlFallback,
} from "../../src/markdown/fallback.js";
import { markdownFlavorSpecs } from "../../src/markdown/flavor.js";

describe("markdown fallback policy", () => {
	it("renders unsupported block and inline markers deterministically", () => {
		expect(
			renderUnsupportedBlock(
				"table rendering requires table-capable markdown",
				markdownFlavorSpecs.gfm,
			),
		).toBe("> Unsupported: table rendering requires table-capable markdown");
		expect(
			renderUnsupportedInline(
				"raw HTML inline is not allowed in this flavor",
				markdownFlavorSpecs.strict,
			),
		).toBe("[Unsupported: raw HTML inline is not allowed in this flavor]");
	});

	it("allows block-level raw HTML only through the centralized policy entrypoint", () => {
		expect(
			resolveRawHtmlFallback(
				{ type: "htmlBlock", value: "<div>raw</div>" },
				markdownFlavorSpecs.gfm,
				{
					fallbackReason: "html-block",
					unsupportedReason: "raw HTML blocks are not allowed in this flavor",
				},
			),
		).toBe(
			[
				"<!-- fallback: raw_html reason=html-block -->",
				"<div>raw</div>",
				"<!-- /fallback: raw_html -->",
			].join("\n"),
		);
	});

	it("forbids raw HTML fallbacks when the flavor denies them", () => {
		expect(
			resolveRawHtmlFallback(
				{ type: "htmlBlock", value: "<div>raw</div>" },
				markdownFlavorSpecs.strict,
				{
					fallbackReason: "html-block",
					unsupportedReason: "raw HTML blocks are not allowed in this flavor",
				},
			),
		).toBe("> Unsupported: raw HTML blocks are not allowed in this flavor");
		expect(
			resolveRawHtmlFallback(
				{ type: "htmlInline", value: "<kbd>Ctrl</kbd>" },
				markdownFlavorSpecs.strict,
				{
					annotate: false,
					fallbackReason: "html-inline",
					unsupportedReason: "raw HTML inline is not allowed in this flavor",
				},
			),
		).toBe("[Unsupported: raw HTML inline is not allowed in this flavor]");
	});

	it("keeps inline raw HTML deterministic for flavors that allow it", () => {
		expect(
			resolveRawHtmlFallback(
				{ type: "htmlInline", value: "<kbd>Ctrl</kbd>" },
				markdownFlavorSpecs.commonmark,
				{
					annotate: false,
					fallbackReason: "html-inline",
					unsupportedReason: "raw HTML inline is not allowed in this flavor",
				},
			),
		).toBe("<kbd>Ctrl</kbd>");
	});
});
