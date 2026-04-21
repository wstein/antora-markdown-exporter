import { describe, expect, it } from "vitest";
import {
	collectIncludeDiagnostics,
	collectIncludeDirectives,
	collectXrefTargets,
	collectXrefs,
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
});
