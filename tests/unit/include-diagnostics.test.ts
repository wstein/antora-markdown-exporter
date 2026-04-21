import { describe, expect, it } from "vitest";
import {
	collectIncludeDiagnostics,
	collectIncludeDirectives,
} from "../../src/markdown/include-diagnostics.js";

describe("include diagnostics helpers", () => {
	it("collects normalized include directives and diagnostics", () => {
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
					type: "paragraph" as const,
					children: [{ type: "text" as const, value: "Body." }],
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
		]);
	});
});
