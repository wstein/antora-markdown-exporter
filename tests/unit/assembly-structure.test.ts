import { describe, expect, it } from "vitest";
import {
	type AssemblyDocument,
	defineAssemblyDocument,
} from "../../src/adapter/assembly-structure.js";

describe("assembly structure contract", () => {
	it("defines a repository-owned structured document boundary", () => {
		const document = defineAssemblyDocument({
			type: "document",
			source: {
				backend: "assembler-structure",
				path: "/virtual/modules/ROOT/pages/index.adoc",
			},
			metadata: {
				component: "docs",
				version: "2.0",
				module: "ROOT",
				family: "page",
				pageId: "docs:ROOT:index.adoc",
				relativeSrcPath: "modules/ROOT/pages/index.adoc",
				attributes: {
					doctype: "book",
				},
			},
			renderOptions: {
				headingNumbering: { mode: "book" },
				tableOfContents: { maxDepth: 2 },
			},
			children: [
				{
					type: "pageAliases",
					aliases: ["legacy-home", "legacy-index"],
				},
				{
					type: "anchor",
					identifier: "overview",
				},
				{
					type: "heading",
					depth: 1,
					identifier: "overview",
					children: [{ type: "text", value: "Overview" }],
				},
				{
					type: "paragraph",
					children: [
						{ type: "text", value: "See " },
						{
							type: "xref",
							url: "install.adoc#cli",
							target: {
								raw: "install.adoc#cli",
								path: "install.adoc",
								fragment: "cli",
								family: {
									kind: "page",
									name: "page",
								},
							},
							attributes: {
								role: "nav",
							},
							children: [{ type: "text", value: "install" }],
						},
						{ type: "text", value: " before release." },
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
					ordered: true,
					items: [
						{
							children: [
								{
									type: "paragraph",
									children: [{ type: "text", value: "Review notes" }],
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
							children: [{ type: "text", value: "Keep the mapping semantic." }],
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
		});

		expect(document.source?.backend).toBe("assembler-structure");
		expect(document.metadata?.pageId).toBe("docs:ROOT:index.adoc");
		expect(document.children.map((child) => child.type)).toEqual([
			"pageAliases",
			"anchor",
			"heading",
			"paragraph",
			"admonition",
			"list",
			"labeledGroup",
			"table",
		]);
		expect(document.children[3]).toMatchObject({
			type: "paragraph",
			children: expect.arrayContaining([
				expect.objectContaining({
					type: "xref",
					attributes: { role: "nav" },
					target: expect.objectContaining({
						raw: "install.adoc#cli",
						path: "install.adoc",
						fragment: "cli",
					}),
				}),
			]),
		});
	});

	it("keeps the adapter contract distinct from markdown ir while remaining mappable", () => {
		const document: AssemblyDocument = {
			type: "document",
			children: [
				{
					type: "codeBlock",
					language: "mermaid",
					value: "graph TD\n  A --> B",
				},
				{
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "Quoted context." }],
						},
					],
				},
				{
					type: "unsupported",
					reason: "index generation is not part of the default exporter scope",
				},
			],
		};

		expect(document.children).toHaveLength(3);
		expect(document.children[0]).toMatchObject({
			type: "codeBlock",
			language: "mermaid",
		});
		expect(document.children[2]).toMatchObject({
			type: "unsupported",
			reason: expect.stringContaining("index generation"),
		});
	});
});
