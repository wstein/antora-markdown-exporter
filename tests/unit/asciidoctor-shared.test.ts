import { describe, expect, it } from "vitest";
import {
	decodeHtmlEntities,
	decodeLiteralCode,
	getSourceLocation,
	parseHtmlAttributes,
} from "../../src/adapter/asciidoctor-structure/shared.js";

describe("asciidoctor shared helpers", () => {
	it("returns undefined when source locations are absent or empty", () => {
		expect(getSourceLocation({ getSourceLocation: () => undefined })).toBe(
			undefined,
		);
		expect(
			getSourceLocation({
				getSourceLocation: () => ({
					getLineNumber: () => undefined,
					getPath: () => undefined,
				}),
			}),
		).toBe(undefined);
	});

	it("extracts source path and line when available", () => {
		expect(
			getSourceLocation({
				getSourceLocation: () => ({
					getLineNumber: () => 42,
					getPath: () => "/virtual/page.adoc",
				}),
			}),
		).toEqual({
			line: 42,
			path: "/virtual/page.adoc",
		});
	});

	it("decodes html entities and strips supported literal-code wrappers", () => {
		expect(
			decodeHtmlEntities("&lt;tag&gt; &amp; &quot;quote&quot; &#39;x&#39;"),
		).toBe(`<tag> & "quote" 'x'`);
		expect(
			decodeLiteralCode(
				'<a href="guide.html"><strong>alpha</strong></a><em>beta</em>&#8230;&#8203;&#8201;&#8212;&#8594;',
			),
		).toBe("**alpha**_beta_... --->");
	});

	it("parses html attributes and tolerates malformed tags", () => {
		expect(
			parseHtmlAttributes(
				'<img src="diagram.png" data-name="overview" alt="A &amp; B">',
			),
		).toEqual({
			tagName: "img",
			attributes: {
				src: "diagram.png",
				"data-name": "overview",
				alt: "A & B",
			},
		});

		expect(parseHtmlAttributes("<not-closed")).toEqual({
			tagName: "",
			attributes: {},
		});
	});
});
