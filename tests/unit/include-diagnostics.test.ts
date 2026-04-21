import { describe, expect, it } from "vitest";
import {
	collectIncludeDiagnostics,
	collectIncludeDirectives,
	collectMarkdownInspectionReport,
	collectXrefs,
	collectXrefTargets,
} from "../../src/markdown/include-diagnostics.js";

describe("include diagnostics helpers", () => {
	it("collects normalized include directives and diagnostics recursively", () => {
		const document = {
			type: "document" as const,
			children: [
				{
					type: "includeDirective" as const,
					target: " partials/snippet.adoc ",
					attributes: {},
					diagnostics: [
						{
							code: "invalid-indent" as const,
							message: " include indent must be a positive integer ",
							source: " -1 ",
						},
					],
				},
				{
					type: "blockquote" as const,
					children: [
						{
							type: "includeDirective" as const,
							target: " nested/example.adoc ",
							attributes: {},
							diagnostics: [
								{
									code: "invalid-line-step" as const,
									message: " include line steps must be a positive integer ",
									source: " 1..5..0 ",
								},
							],
						},
						{
							type: "paragraph" as const,
							children: [{ type: "text" as const, value: "Body." }],
						},
					],
				},
			],
		};

		expect(collectIncludeDirectives(document)).toEqual([
			{
				type: "includeDirective",
				target: "partials/snippet.adoc",
				attributes: {},
				diagnostics: [
					{
						code: "invalid-indent",
						message: "include indent must be a positive integer",
						source: "-1",
					},
				],
			},
			{
				type: "includeDirective",
				target: "nested/example.adoc",
				attributes: {},
				diagnostics: [
					{
						code: "invalid-line-step",
						message: "include line steps must be a positive integer",
						source: "1..5..0",
					},
				],
			},
		]);
		expect(collectIncludeDiagnostics(document)).toEqual([
			{
				target: "partials/snippet.adoc",
				diagnostic: {
					code: "invalid-indent",
					message: "include indent must be a positive integer",
					source: "-1",
				},
			},
			{
				target: "nested/example.adoc",
				diagnostic: {
					code: "invalid-line-step",
					message: "include line steps must be a positive integer",
					source: "1..5..0",
				},
			},
		]);
	});

	it("collects xrefs and xref targets recursively", () => {
		const document = {
			type: "document" as const,
			children: [
				{
					type: "paragraph" as const,
					children: [
						{
							type: "xref" as const,
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
							children: [{ type: "text" as const, value: "install" }],
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
										children: [{ type: "text" as const, value: "diagram" }],
									},
								],
							},
						],
					},
					rows: [],
				},
			],
		};

		expect(collectXrefs(document)).toHaveLength(2);
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
		]);
	});

	it("covers recursive helper branches and combined inspection reports", () => {
		const document = {
			type: "document" as const,
			children: [
				{
					type: "admonition" as const,
					kind: "tip" as const,
					children: [
						{
							type: "paragraph" as const,
							children: [
								{
									type: "emphasis" as const,
									children: [
										{
											type: "xref" as const,
											url: "docs/tip.adoc",
											target: {
												raw: "docs:ROOT:tip.adoc",
												component: "docs",
												module: "ROOT",
												family: {
													kind: "page" as const,
													name: "page",
												},
												path: "tip.adoc",
											},
											children: [{ type: "text" as const, value: "tip" }],
										},
									],
								},
							],
						},
						{
							type: "calloutList" as const,
							items: [
								{
									ordinal: 1,
									children: [
										{
											type: "includeDirective" as const,
											target: " notes/callout.adoc ",
											attributes: {},
											diagnostics: [
												{
													code: "invalid-leveloffset" as const,
													message:
														" include leveloffset must be a signed integer ",
													source: " bad ",
												},
											],
										},
										{
											type: "paragraph" as const,
											children: [
												{
													type: "link" as const,
													url: "https://example.com",
													children: [
														{
															type: "xref" as const,
															url: "docs/nested.adoc",
															target: {
																raw: "docs:ROOT:nested.adoc",
																component: "docs",
																module: "ROOT",
																family: {
																	kind: "page" as const,
																	name: "page",
																},
																path: "nested.adoc",
															},
															children: [
																{ type: "text" as const, value: "nested" },
															],
														},
													],
												},
												{
													type: "image" as const,
													url: "diagram.png",
													alt: [
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
					type: "footnoteDefinition" as const,
					identifier: "note-1",
					children: [
						{
							type: "includeDirective" as const,
							target: " footnotes/detail.adoc ",
							attributes: {},
						},
						{
							type: "paragraph" as const,
							children: [
								{
									type: "strong" as const,
									children: [
										{
											type: "xref" as const,
											url: "docs/final.adoc",
											target: {
												raw: "docs:ROOT:final.adoc",
												component: "docs",
												module: "ROOT",
												family: {
													kind: "page" as const,
													name: "page",
												},
												path: "final.adoc",
											},
											children: [{ type: "text" as const, value: "final" }],
										},
									],
								},
							],
						},
					],
				},
				{
					type: "codeBlock" as const,
					value: "const ignored = true;",
				},
			],
		};

		const report = collectMarkdownInspectionReport(document);

		expect(report.includeDirectives).toEqual([
			expect.objectContaining({ target: "notes/callout.adoc" }),
			expect.objectContaining({ target: "footnotes/detail.adoc" }),
		]);
		expect(report.includeDiagnostics).toEqual([
			{
				target: "notes/callout.adoc",
				diagnostic: {
					code: "invalid-leveloffset",
					message: "include leveloffset must be a signed integer",
					source: "bad",
				},
			},
		]);
		expect(report.xrefs.map((xref) => xref.target.raw)).toEqual([
			"docs:ROOT:tip.adoc",
			"docs:ROOT:nested.adoc",
			"2.0@docs:ROOT:image$diagram.png",
			"docs:ROOT:final.adoc",
		]);
		expect(report.xrefTargets).toEqual(report.xrefs.map((xref) => xref.target));
	});
});
