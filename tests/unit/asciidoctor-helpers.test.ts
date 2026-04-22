import { describe, expect, it } from "vitest";
import {
	extractAlignment,
	extractCalloutList,
	extractLabeledGroups,
	extractList,
	extractTable,
} from "../../src/adapter/asciidoctor-structure/block-helpers.js";
import {
	parseInlineHtmlWithOptions,
	parsePlainTextWithSoftBreaks,
} from "../../src/adapter/asciidoctor-structure/inline.js";
import {
	applyXrefFallbackLabelStyleToBlocks,
	deriveXrefFallbackLabel,
	isStructuredXrefHref,
	normalizeXrefChildren,
	parseXrefTarget,
} from "../../src/adapter/asciidoctor-structure/xref.js";

describe("asciidoctor helper modules", () => {
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

	it("parses inline links and xrefs through their dedicated branches", () => {
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
	});

	it("preserves soft breaks for plain text helper parsing", () => {
		expect(parsePlainTextWithSoftBreaks("first\nsecond")).toEqual([
			{ type: "text", value: "first" },
			{ type: "softBreak" },
			{ type: "text", value: "second" },
		]);
	});

	it("extracts description groups, lists, callouts, and table alignment branches", () => {
		const extractBlock = () => [
			{
				type: "paragraph" as const,
				children: [{ type: "text" as const, value: "nested block" }],
			},
		];

		expect(
			extractLabeledGroups(
				{
					getItems: () => [
						[
							[
								{ getText: () => "first term" },
								{ getText: () => "second term" },
							],
							{
								getBlocks: () => [{ getContext: () => "paragraph" }],
								getSourceLocation: () => undefined,
							},
						],
					],
				} as never,
				{},
				extractBlock,
			),
		).toEqual([
			{
				type: "labeledGroup",
				label: [
					{ type: "text", value: "first term" },
					{ type: "text", value: "; " },
					{ type: "text", value: "second term" },
				],
				children: [
					{
						type: "paragraph",
						children: [{ type: "text", value: "nested block" }],
					},
				],
				location: undefined,
			},
		]);

		expect(
			extractList(
				{
					getContext: () => "olist",
					getItems: () => [
						{
							getText: () => "step",
						},
					],
					getSourceLocation: () => undefined,
				} as never,
				{},
				extractBlock,
			),
		).toMatchObject({
			type: "list",
			ordered: true,
			items: [{ children: [{ type: "paragraph" }] }],
		});

		expect(
			extractCalloutList(
				{
					getItems: () => [
						{
							getText: () => "first callout",
						},
					],
					getSourceLocation: () => undefined,
				} as never,
				{},
				extractBlock,
			),
		).toMatchObject({
			type: "calloutList",
			items: [{ ordinal: 1, children: [{ type: "paragraph" }] }],
		});

		expect(
			extractAlignment({
				getAttribute: () => undefined,
				getColumns: () => [
					{ getAttributes: () => ({ halign: "center" }) },
					{ getAttributes: () => ({ halign: "right" }) },
					{ getAttributes: () => ({}) },
				],
			} as never),
		).toEqual(["center", "right", null]);

		expect(
			extractTable({
				getAttribute: () => undefined,
				getColumns: () => [{ getAttributes: () => ({}) }],
				getHeadRows: () => [],
				getBodyRows: () => [
					[{ getText: () => "Header" }],
					[{ getText: () => "Body" }],
				],
				getSourceLocation: () => undefined,
			} as never),
		).toMatchObject({
			type: "table",
			header: {
				cells: [{ children: [{ type: "text", value: "Header" }] }],
			},
			rows: [
				{
					cells: [{ children: [{ type: "text", value: "Body" }] }],
				},
			],
		});
	});

	it("covers xref helper normalization and fallback recursion", () => {
		expect(isStructuredXrefHref("#anchor")).toBe(true);
		expect(isStructuredXrefHref("https://example.com")).toBe(false);
		expect(isStructuredXrefHref("docs:ROOT:page$guide/setup.html")).toBe(true);

		expect(parseXrefTarget("#overview")).toEqual({
			raw: "#overview",
			path: "",
			fragment: "overview",
		});
		expect(parseXrefTarget("docs:ROOT:partial$nav.html")).toMatchObject({
			component: "docs",
			module: "ROOT",
			family: { kind: "partial", name: "partial" },
			path: "nav.adoc",
		});
		expect(parseXrefTarget("2.0@docs:ROOT:thing$blob.bin")).toMatchObject({
			version: "2.0",
			component: "docs",
			module: "ROOT",
			family: { kind: "other", name: "thing" },
			path: "blob.bin",
		});

		const target = parseXrefTarget("guide/setup.html");
		expect(deriveXrefFallbackLabel(target, "fragment-or-basename")).toBe(
			"setup",
		);
		expect(deriveXrefFallbackLabel(target, "fragment-or-path")).toBe(
			"guide/setup",
		);
		expect(
			normalizeXrefChildren(
				"guide/setup.html",
				target,
				[{ type: "text", value: "Custom label" }],
				"fragment-or-path",
			),
		).toEqual([{ type: "text", value: "Custom label" }]);
		expect(
			normalizeXrefChildren(
				"guide/setup.html",
				target,
				[{ type: "text", value: "setup" }],
				"fragment-or-path",
			),
		).toEqual([{ type: "text", value: "guide/setup" }]);

		const blocks = applyXrefFallbackLabelStyleToBlocks(
			[
				{
					type: "paragraph",
					children: [
						{
							type: "xref",
							url: "guide/setup.html",
							target,
							children: [{ type: "text", value: "setup" }],
						},
						{ type: "hardBreak" },
						{ type: "htmlInline", value: "<mark>" },
					],
				},
				{
					type: "labeledGroup",
					label: [
						{
							type: "xref",
							url: "guide/setup.html",
							target,
							children: [{ type: "text", value: "setup" }],
						},
					],
					children: [
						{
							type: "blockquote",
							children: [
								{
									type: "paragraph",
									children: [
										{
											type: "image",
											url: "diagram.png",
											alt: [
												{
													type: "xref",
													url: "guide/setup.html",
													target,
													children: [{ type: "text", value: "setup" }],
												},
											],
										},
									],
								},
							],
						},
					],
				},
				{
					type: "table",
					header: {
						cells: [
							{
								children: [
									{
										type: "xref",
										url: "guide/setup.html",
										target,
										children: [{ type: "text", value: "setup" }],
									},
								],
							},
						],
					},
					rows: [],
				},
				{
					type: "calloutList",
					items: [
						{
							ordinal: 1,
							children: [
								{
									type: "paragraph",
									children: [
										{
											type: "xref",
											url: "guide/setup.html",
											target,
											children: [{ type: "text", value: "setup" }],
										},
									],
								},
							],
						},
					],
				},
			],
			"fragment-or-path",
		);

		expect(blocks[0]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					children: [{ type: "text", value: "guide/setup" }],
				}),
			]),
		});
		expect(blocks[1]).toMatchObject({
			type: "labeledGroup",
			label: [
				{
					type: "xref",
					children: [{ type: "text", value: "guide/setup" }],
				},
			],
			children: [
				{
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [
								{
									type: "image",
									alt: [
										{
											type: "xref",
											children: [{ type: "text", value: "guide/setup" }],
										},
									],
								},
							],
						},
					],
				},
			],
		});
		expect(blocks[2]).toMatchObject({
			type: "table",
			header: {
				cells: [
					{
						children: [
							{
								type: "xref",
								children: [{ type: "text", value: "guide/setup" }],
							},
						],
					},
				],
			},
		});
		expect(blocks[3]).toMatchObject({
			type: "calloutList",
			items: [
				{
					children: [
						{
							type: "paragraph",
							children: [
								{
									type: "xref",
									children: [{ type: "text", value: "guide/setup" }],
								},
							],
						},
					],
				},
			],
		});
	});
});
