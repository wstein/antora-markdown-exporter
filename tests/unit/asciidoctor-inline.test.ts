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
				children: [{ type: "text", value: "guide/setup.html" }],
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

	it("preserves mixed nested inline semantics when parsing is unambiguous", () => {
		expect(
			parseInlineHtmlWithOptions(
				'<strong>See <a href="guide/setup.html">guide/setup.html</a></strong>',
			),
		).toEqual([
			{
				type: "strong",
				children: [
					{ type: "text", value: "See " },
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
						children: [{ type: "text", value: "guide/setup.html" }],
					},
				],
			},
		]);

		expect(
			parseInlineHtmlWithOptions(
				'<a href="guide/setup.html"><code>guide/setup.html</code></a>',
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
				children: [{ type: "code", value: "guide/setup.html" }],
			},
		]);
	});

	it("keeps malformed anchor-like tags and empty href anchors deterministic", () => {
		expect(
			parseInlineHtmlWithOptions('<a id="legacy">broken anchor</a>'),
		).toEqual([
			{
				type: "link",
				url: "",
				attributes: { id: "legacy" },
				children: [{ type: "text", value: "broken anchor" }],
			},
		]);

		expect(parseInlineHtmlWithOptions('<a name="legacy"></a>')).toEqual([
			{
				type: "link",
				url: "",
				attributes: { name: "legacy" },
				children: [{ type: "text", value: "" }],
			},
		]);
	});

	it("keeps authored xref labels when they are not generated fallbacks", () => {
		expect(
			parseInlineHtmlWithOptions(
				'<a href="guide/setup.html"><em>Install Guide</em></a>',
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
				children: [
					{
						type: "emphasis",
						children: [{ type: "text", value: "Install Guide" }],
					},
				],
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
