import { describe, expect, it } from "vitest";
import {
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
});
