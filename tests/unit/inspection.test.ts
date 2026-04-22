import { describe, expect, it } from "vitest";
import {
	collectMarkdownInspectionRagDocument,
	collectMarkdownInspectionReport,
	collectXrefs,
	collectXrefTargets,
} from "../../src/markdown/inspection.js";

describe("inspection helpers", () => {
	it("collects xrefs and xref targets recursively across nested block shapes", () => {
		const document = {
			type: "document" as const,
			children: [
				{
					type: "paragraph" as const,
					children: [
						{
							type: "xref" as const,
							url: "docs/ROOT/install.adoc",
							target: {
								raw: "docs:ROOT:install.adoc",
								component: "docs",
								module: "ROOT",
								family: {
									kind: "page" as const,
									name: "page",
								},
								path: "install.adoc",
							},
							children: [{ type: "text" as const, value: "install" }],
						},
					],
				},
				{
					type: "admonition" as const,
					kind: "tip" as const,
					children: [
						{
							type: "calloutList" as const,
							items: [
								{
									ordinal: 1,
									children: [
										{
											type: "paragraph" as const,
											children: [
												{
													type: "link" as const,
													url: "https://example.com",
													children: [
														{
															type: "xref" as const,
															url: "docs/2.0/ROOT/image/diagram.png",
															target: {
																raw: "2.0@docs:ROOT:image$diagram.png",
																component: "docs",
																version: "2.0",
																module: "ROOT",
																family: {
																	kind: "image" as const,
																	name: "image",
																},
																path: "diagram.png",
															},
															children: [
																{ type: "text" as const, value: "diagram" },
															],
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
				},
				{
					type: "table" as const,
					header: {
						cells: [
							{
								children: [
									{
										type: "xref" as const,
										url: "docs/2.0/api/index.adoc#overview",
										target: {
											raw: "2.0@docs:api:page$index.adoc#overview",
											component: "docs",
											version: "2.0",
											module: "api",
											family: {
												kind: "page" as const,
												name: "page",
											},
											path: "index.adoc",
											fragment: "overview",
										},
										children: [{ type: "text" as const, value: "overview" }],
									},
								],
							},
						],
					},
					rows: [],
				},
			],
		};

		expect(collectXrefs(document)).toHaveLength(3);
		expect(collectXrefTargets(document)).toEqual([
			{
				raw: "docs:ROOT:install.adoc",
				component: "docs",
				module: "ROOT",
				family: { kind: "page", name: "page" },
				path: "install.adoc",
			},
			{
				raw: "2.0@docs:ROOT:image$diagram.png",
				component: "docs",
				version: "2.0",
				module: "ROOT",
				family: { kind: "image", name: "image" },
				path: "diagram.png",
			},
			{
				raw: "2.0@docs:api:page$index.adoc#overview",
				component: "docs",
				version: "2.0",
				module: "api",
				family: { kind: "page", name: "page" },
				path: "index.adoc",
				fragment: "overview",
			},
		]);
	});

	it("returns a normalized xref-only inspection report", () => {
		const report = collectMarkdownInspectionReport({
			type: "document",
			children: [
				{
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [
								{
									type: "xref",
									url: " docs/ROOT/install.adoc ",
									target: {
										raw: " docs:ROOT:install.adoc ",
										component: " docs ",
										module: " ROOT ",
										family: {
											kind: "page" as const,
											name: " page ",
										},
										path: " install.adoc ",
									},
									children: [{ type: "text", value: " Install " }],
								},
							],
						},
					],
				},
			],
		});

		expect(report).toEqual({
			xrefs: [
				{
					type: "xref",
					url: "docs/ROOT/install.adoc",
					target: {
						raw: "docs:ROOT:install.adoc",
						component: "docs",
						module: "ROOT",
						family: {
							kind: "page",
							name: "page",
						},
						path: "install.adoc",
					},
					children: [{ type: "text", value: "Install" }],
				},
			],
			xrefTargets: [
				{
					raw: "docs:ROOT:install.adoc",
					component: "docs",
					module: "ROOT",
					family: {
						kind: "page",
						name: "page",
					},
					path: "install.adoc",
				},
			],
		});
	});

	it("collects xrefs through footnotes and table body rows while ignoring unsupported leaf blocks", () => {
		const report = collectMarkdownInspectionReport({
			type: "document",
			children: [
				{
					type: "footnoteDefinition",
					identifier: "note-1",
					children: [
						{
							type: "paragraph",
							children: [
								{
									type: "xref",
									url: "docs/ROOT/footnotes.adoc",
									target: {
										raw: "docs:ROOT:footnotes.adoc",
										component: "docs",
										module: "ROOT",
										family: {
											kind: "page" as const,
											name: "page",
										},
										path: "footnotes.adoc",
									},
									children: [{ type: "text", value: "footnotes" }],
								},
							],
						},
					],
				},
				{
					type: "table",
					header: {
						cells: [{ children: [{ type: "text", value: "Header" }] }],
					},
					rows: [
						{
							cells: [
								{
									children: [
										{
											type: "xref",
											url: "docs/ROOT/rows.adoc",
											target: {
												raw: "docs:ROOT:rows.adoc",
												component: "docs",
												module: "ROOT",
												family: {
													kind: "page" as const,
													name: "page",
												},
												path: "rows.adoc",
											},
											children: [{ type: "text", value: "rows" }],
										},
									],
								},
							],
						},
					],
				},
				{
					type: "unsupported",
					reason: "ignored",
				},
			],
		});

		expect(report.xrefs.map((xref) => xref.target.raw)).toEqual([
			"docs:ROOT:footnotes.adoc",
			"docs:ROOT:rows.adoc",
		]);
		expect(report.xrefTargets).toEqual([
			expect.objectContaining({ path: "footnotes.adoc" }),
			expect.objectContaining({ path: "rows.adoc" }),
		]);
	});

	it("builds a deterministic rag-oriented inspection document with structure and source metadata", () => {
		const rag = collectMarkdownInspectionRagDocument({
			type: "document",
			metadata: {
				component: "docs",
				module: "ROOT",
				pageId: "guide",
				relativeSrcPath: "modules/ROOT/pages/guide.adoc",
				version: "current",
			},
			children: [
				{
					type: "pageAliases",
					aliases: ["legacy-guide"],
					location: { path: "guide.adoc", line: 1 },
				},
				{
					type: "heading",
					depth: 1,
					identifier: "guide",
					location: { path: "guide.adoc", line: 3 },
					children: [{ type: "text", value: "Guide" }],
				},
				{
					type: "anchor",
					identifier: "intro",
					location: { path: "guide.adoc", line: 5 },
				},
				{
					type: "paragraph",
					children: [
						{ type: "text", value: "See " },
						{
							type: "xref",
							url: "docs/install.adoc",
							target: {
								raw: "docs:ROOT:install.adoc",
								component: "docs",
								module: "ROOT",
								family: {
									kind: "page" as const,
									name: "page",
								},
								path: "install.adoc",
							},
							location: { path: "guide.adoc", line: 6 },
							children: [
								{
									type: "strong",
									children: [{ type: "text", value: "Install" }],
								},
							],
						},
						{ type: "text", value: " and " },
						{
							type: "xref",
							url: "docs/api/index.adoc#overview",
							target: {
								raw: "docs:api:index.adoc#overview",
								component: "docs",
								module: "api",
								family: {
									kind: "page" as const,
									name: "page",
								},
								path: "index.adoc",
								fragment: "overview",
							},
							location: { path: "guide.adoc", line: 6 },
							children: [{ type: "text", value: "overview" }],
						},
					],
				},
			],
		});

		expect(rag).toEqual({
			document: {
				component: "docs",
				module: "ROOT",
				pageId: "guide",
				relativeSrcPath: "modules/ROOT/pages/guide.adoc",
				version: "current",
			},
			headings: [
				{
					index: 0,
					depth: 1,
					identifier: "guide",
					location: { path: "guide.adoc", line: 3 },
					text: "Guide",
				},
			],
			anchors: [
				{
					index: 0,
					identifier: "intro",
					location: { path: "guide.adoc", line: 5 },
				},
			],
			pageAliases: [
				{
					index: 0,
					aliases: ["legacy-guide"],
					location: { path: "guide.adoc", line: 1 },
				},
			],
			xrefCount: 2,
			xrefTargetCount: 2,
			entries: [
				{
					index: 0,
					label: "Install",
					destination: "docs/install.adoc",
					rawTarget: "docs:ROOT:install.adoc",
					path: "install.adoc",
					family: "page",
					component: "docs",
					location: { path: "guide.adoc", line: 6 },
					module: "ROOT",
				},
				{
					index: 1,
					label: "overview",
					destination: "docs/api/index.adoc#overview",
					rawTarget: "docs:api:index.adoc#overview",
					path: "index.adoc",
					family: "page",
					component: "docs",
					location: { path: "guide.adoc", line: 6 },
					module: "api",
					fragment: "overview",
				},
			],
		});
	});
});
