import { describe, expect, it } from "vitest";
import {
	applyXrefFallbackLabelStyleToBlocks,
	deriveXrefFallbackLabel,
	isStructuredXrefHref,
	normalizeXrefChildren,
	parseXrefTarget,
} from "../../src/adapter/asciidoctor-structure/xref.js";

describe("asciidoctor xref helpers", () => {
	it("recognizes structured href forms and parses qualified targets", () => {
		expect(isStructuredXrefHref("#anchor")).toBe(true);
		expect(isStructuredXrefHref("https://example.com")).toBe(false);
		expect(isStructuredXrefHref("docs:ROOT:page$guide/setup.html")).toBe(true);
		expect(isStructuredXrefHref("2.0@docs:ROOT:partial$nav.adoc")).toBe(true);

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
		expect(parseXrefTarget("install.html#cli")).toMatchObject({
			path: "install.adoc",
			fragment: "cli",
		});
	});

	it("normalizes fallback labels while preserving custom visible labels", () => {
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
		expect(
			normalizeXrefChildren(
				"guide/setup.html",
				target,
				[{ type: "text", value: "guide/setup.html" }],
				"fragment-or-path",
			),
		).toEqual([{ type: "text", value: "guide/setup" }]);
	});

	it("rewrites recursive fallback labels across block families", () => {
		const target = parseXrefTarget("guide/setup.html");
		const blocks = applyXrefFallbackLabelStyleToBlocks(
			[
				{
					type: "paragraph",
					children: [
						{
							type: "xref",
							url: "guide/setup.html",
							target,
							children: [
								{ type: "hardBreak" },
								{ type: "softBreak" },
								{ type: "text", value: "setup" },
								{ type: "htmlInline", value: "<mark>" },
							],
						},
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
											children: [
												{
													type: "strong",
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
			],
			"fragment-or-path",
		);

		expect(blocks[0]).toMatchObject({
			type: "paragraph",
			children: [
				{
					type: "xref",
					children: [
						{ type: "hardBreak" },
						{ type: "softBreak" },
						{ type: "text", value: "setup" },
						{ type: "htmlInline", value: "<mark>" },
					],
				},
			],
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

	it("keeps unknown inline node kinds inert in recursive fallback traversal", () => {
		const target = parseXrefTarget("guide/setup.html");
		const [paragraph] = applyXrefFallbackLabelStyleToBlocks(
			[
				{
					type: "paragraph",
					children: [
						{
							type: "xref",
							url: "guide/setup.html",
							target,
							children: [
								{
									type: "mystery",
									value: "ignored",
								} as never,
							],
						},
					],
				},
			],
			"fragment-or-path",
		);

		expect(paragraph).toMatchObject({
			type: "paragraph",
			children: [
				{
					type: "xref",
					children: [{ type: "mystery", value: "ignored" }],
				},
			],
		});
	});
});
