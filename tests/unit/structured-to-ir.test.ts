import { describe, expect, it } from "vitest";
import { extractAssemblyStructure } from "../../src/adapter/asciidoctor-structure.js";
import { defineAssemblyDocument } from "../../src/adapter/assembly-structure.js";
import { convertAssemblyStructureToMarkdownIR } from "../../src/exporter/structured-to-ir.js";

describe("structured assembly to markdown ir", () => {
	it("lowers repository-owned structured assembly nodes into markdown ir", () => {
		const ir = convertAssemblyStructureToMarkdownIR(
			defineAssemblyDocument({
				type: "document",
				renderOptions: {
					headingNumbering: { mode: "book" },
				},
				children: [
					{
						type: "pageAliases",
						aliases: ["legacy-home"],
					},
					{
						type: "anchor",
						identifier: "overview",
					},
					{
						type: "heading",
						depth: 2,
						identifier: "overview",
						children: [{ type: "text", value: "Overview" }],
					},
					{
						type: "paragraph",
						children: [
							{ type: "text", value: "See " },
							{
								type: "xref",
								url: "install.html#cli",
								target: {
									raw: "install.html#cli",
									path: "install.adoc",
									fragment: "cli",
								},
								children: [{ type: "text", value: "install" }],
							},
						],
					},
					{
						type: "admonition",
						kind: "note",
						children: [
							{
								type: "paragraph",
								children: [{ type: "text", value: "Keep docs aligned." }],
							},
						],
					},
					{
						type: "list",
						ordered: false,
						items: [
							{
								children: [
									{
										type: "paragraph",
										children: [{ type: "text", value: "One" }],
									},
								],
							},
						],
					},
					{
						type: "labeledGroup",
						label: [{ type: "text", value: "Motivation" }],
						children: [
							{
								type: "paragraph",
								children: [{ type: "text", value: "Stay semantic." }],
							},
						],
					},
					{
						type: "table",
						align: ["left", "right"],
						header: {
							cells: [
								{ children: [{ type: "text", value: "Name" }] },
								{ children: [{ type: "text", value: "Value" }] },
							],
						},
						rows: [
							{
								cells: [
									{ children: [{ type: "text", value: "Alpha" }] },
									{ children: [{ type: "code", value: "42" }] },
								],
							},
						],
					},
				],
			}),
		);

		expect(ir.renderOptions).toEqual({
			headingNumbering: { mode: "book" },
		});
		expect(ir.children.map((child) => child.type)).toEqual([
			"pageAliases",
			"anchor",
			"heading",
			"paragraph",
			"admonition",
			"list",
			"labeledGroup",
			"table",
		]);
		expect(ir.children[3]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					url: "install.adoc#cli",
					target: expect.objectContaining({
						raw: "install.html#cli",
						path: "install.adoc",
						fragment: "cli",
					}),
				}),
			]),
		});
	});

	it("lowers extracted asciidoctor structure without using the legacy parser", () => {
		const structured = extractAssemblyStructure(
			[
				"= Manual",
				":page-aliases: legacy-home",
				"",
				"== Overview",
				"",
				"See xref:install.adoc#cli[install].",
				"",
				"[[para-anchor]]",
				"Paragraph with anchor.",
			].join("\n"),
		);
		const ir = convertAssemblyStructureToMarkdownIR(structured);

		expect(ir.children[0]).toMatchObject({
			type: "pageAliases",
			aliases: ["legacy-home"],
		});
		expect(ir.children[1]).toMatchObject({
			type: "heading",
			children: [{ type: "text", value: "Manual" }],
		});
		expect(ir.children[2]).toMatchObject({
			type: "heading",
			children: [{ type: "text", value: "Overview" }],
		});
		expect(ir.children[3]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					url: "install.adoc#cli",
				}),
			]),
		});
		expect(ir.children[4]).toMatchObject({
			type: "anchor",
			identifier: "para-anchor",
		});
		expect(ir.children[5]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "Paragraph with anchor." }],
		});
	});

	it("preserves titled listing blocks through lowering as labeled groups over code blocks", () => {
		const structured = extractAssemblyStructure(
			[
				"= Manual",
				"",
				".Release command",
				"[source,bash]",
				"----",
				"make release",
				"----",
			].join("\n"),
		);
		const ir = convertAssemblyStructureToMarkdownIR(structured);

		expect(ir.children).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "labeledGroup",
					label: [{ type: "text", value: "Release command" }],
					children: [
						expect.objectContaining({
							type: "codeBlock",
							language: "bash",
							value: "make release",
						}),
					],
				}),
			]),
		);
	});

	it("lowers html blocks, callout lists, and unsupported nodes explicitly", () => {
		const ir = convertAssemblyStructureToMarkdownIR(
			defineAssemblyDocument({
				type: "document",
				children: [
					{
						type: "calloutList",
						items: [
							{
								ordinal: 1,
								children: [
									{
										type: "paragraph",
										children: [{ type: "text", value: "Review output." }],
									},
								],
							},
						],
					},
					{
						type: "htmlBlock",
						value: "<aside>raw</aside>",
					},
					{
						type: "unsupported",
						reason: "not modeled",
					},
				],
			}),
		);

		expect(ir.children).toEqual([
			{
				type: "calloutList",
				items: [
					{
						ordinal: 1,
						children: [
							{
								type: "paragraph",
								children: [{ type: "text", value: "Review output." }],
							},
						],
					},
				],
			},
			{
				type: "htmlBlock",
				value: "<aside>raw</aside>",
			},
			{
				type: "unsupported",
				reason: "not modeled",
			},
		]);
	});
});
