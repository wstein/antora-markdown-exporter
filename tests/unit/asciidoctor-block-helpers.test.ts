import { describe, expect, it } from "vitest";
import {
	extractAlignment,
	extractCalloutList,
	extractLabeledGroups,
	extractList,
	extractTable,
} from "../../src/adapter/asciidoctor-structure/block-helpers.js";
import type { AssemblyBlock } from "../../src/adapter/assembly-structure.js";

describe("asciidoctor block helpers", () => {
	it("extracts description groups and list items with nested blocks", () => {
		const extractBlock = () =>
			[
				{
					type: "paragraph",
					children: [{ type: "text", value: "nested block" }],
				},
			] satisfies AssemblyBlock[];

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
							getBlocks: () => [{ getContext: () => "paragraph" }],
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
			items: [
				{
					children: [
						{ type: "paragraph", children: [{ type: "text", value: "step" }] },
						{
							type: "paragraph",
							children: [{ type: "text", value: "nested block" }],
						},
					],
				},
			],
		});
	});

	it("covers callout nesting and zero-item fallbacks", () => {
		const extractBlock = () =>
			[
				{
					type: "paragraph",
					children: [{ type: "text", value: "continued explanation" }],
				},
			] satisfies AssemblyBlock[];

		expect(
			extractCalloutList(
				{
					getItems: () => [],
					getSourceLocation: () => undefined,
				} as never,
				{},
				extractBlock,
			),
		).toEqual({
			type: "calloutList",
			location: undefined,
			items: [],
		});

		expect(
			extractCalloutList(
				{
					getItems: () => [
						{
							getText: () => "first callout",
							getBlocks: () => [{ getContext: () => "paragraph" }],
						},
					],
					getSourceLocation: () => undefined,
				} as never,
				{},
				extractBlock,
			),
		).toMatchObject({
			type: "calloutList",
			items: [
				{
					ordinal: 1,
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "first callout" }],
						},
						{
							type: "paragraph",
							children: [{ type: "text", value: "continued explanation" }],
						},
					],
				},
			],
		});
	});

	it("covers table alignment and missing-row cases directly", () => {
		expect(
			extractAlignment({
				getAttribute: () => "<,^,>",
				getColumns: () => [
					{ getAttributes: () => ({}) },
					{ getAttributes: () => ({}) },
					{ getAttributes: () => ({}) },
				],
			} as never),
		).toEqual(["left", "center", "right"]);

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
				getHeadRows: () => [[{ getText: () => "Header" }]],
				getBodyRows: () => [],
				getSourceLocation: () => undefined,
			} as never),
		).toMatchObject({
			type: "table",
			header: {
				cells: [{ children: [{ type: "text", value: "Header" }] }],
			},
			rows: [],
		});

		expect(
			extractTable({
				getAttribute: () => undefined,
				getColumns: () => [{ getAttributes: () => ({}) }],
				getHeadRows: () => [],
				getBodyRows: () => [],
				getSourceLocation: () => undefined,
			} as never),
		).toMatchObject({
			type: "table",
			header: { cells: [] },
			rows: [],
		});
	});
});
