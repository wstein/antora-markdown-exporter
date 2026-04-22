import { describe, expect, it } from "vitest";
import {
	parseInlineHtmlWithOptions,
	parsePlainTextWithSoftBreaks,
} from "../../src/adapter/asciidoctor-structure/inline.js";

describe("asciidoctor inline helpers", () => {
	it("keeps malformed inline tags as deterministic text", () => {
		expect(parseInlineHtmlWithOptions("")).toEqual([
			{ type: "text", value: "" },
		]);
		expect(parseInlineHtmlWithOptions("<strong>broken")).toEqual([
			{ type: "text", value: "<strong>broken" },
		]);
		expect(parseInlineHtmlWithOptions("<em>broken")).toEqual([
			{ type: "text", value: "<em>broken" },
		]);
		expect(parseInlineHtmlWithOptions("<code>broken")).toEqual([
			{ type: "text", value: "<code>broken" },
		]);
		expect(parseInlineHtmlWithOptions('<a href="install.html">broken')).toEqual(
			[{ type: "text", value: '<a href="install.html">broken' }],
		);
		expect(
			parseInlineHtmlWithOptions(
				'<span class="image"><img src="diagram.png" alt="Diagram">',
			),
		).toEqual([
			{
				type: "text",
				value: '<span class="image"><img src="diagram.png" alt="Diagram">',
			},
		]);
		expect(parseInlineHtmlWithOptions("<dangling")).toEqual([
			{ type: "text", value: "<dangling" },
		]);
	});

	it("parses inline links, xrefs, and inline images through dedicated branches", () => {
		expect(
			parseInlineHtmlWithOptions(
				'<a href="https://example.com"><strong>docs</strong></a>',
			),
		).toEqual([
			{
				type: "link",
				url: "https://example.com",
				children: [
					{
						type: "strong",
						children: [{ type: "text", value: "docs" }],
					},
				],
			},
		]);

		expect(
			parseInlineHtmlWithOptions(
				'<a href="guide/setup.html">guide/setup.html</a>',
				{
					xrefFallbackLabelStyle: "fragment-or-path",
				},
			),
		).toEqual([
			{
				type: "xref",
				url: "guide/setup.html",
				target: {
					raw: "guide/setup.html",
					path: "guide/setup.adoc",
					family: undefined,
					component: undefined,
					module: undefined,
					version: undefined,
					fragment: undefined,
				},
				children: [{ type: "text", value: "guide/setup" }],
			},
		]);

		expect(
			parseInlineHtmlWithOptions(
				'<span class="image"><img src="diagram.png" alt="Diagram" title="Architecture"></span>',
			),
		).toEqual([
			{
				type: "image",
				url: "diagram.png",
				title: "Architecture",
				alt: [{ type: "text", value: "Diagram" }],
			},
		]);
	});

	it("preserves soft breaks for plain text helper parsing", () => {
		expect(parsePlainTextWithSoftBreaks("first\nsecond")).toEqual([
			{ type: "text", value: "first" },
			{ type: "softBreak" },
			{ type: "text", value: "second" },
		]);
	});
});
