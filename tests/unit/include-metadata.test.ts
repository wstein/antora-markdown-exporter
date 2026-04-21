import { describe, expect, it } from "vitest";
import {
	decodeIncludeDirectiveMarker,
	encodeIncludeDirectiveMarker,
} from "../../src/exporter/include-metadata.js";

describe("include metadata transport", () => {
	it("round-trips include directive metadata through the marker format", () => {
		const marker = encodeIncludeDirectiveMarker({
			target: "partials/snippet.adoc",
			attributes: {
				lines: "1..3",
				leveloffset: "+1",
			},
			diagnostics: [
				{
					code: "invalid-line-range",
					message: "include line selectors must be positive integers or ranges",
					source: "1..bad",
				},
			],
			semantics: {
				lineRanges: [{ start: 1, end: 3 }],
				levelOffset: 1,
			},
			provenance: {
				depth: 1,
				includeRootDir: "/virtual/project",
				inclusionStack: [
					"/virtual/project/page.adoc",
					"/virtual/project/partials/snippet.adoc",
				],
				includingSourcePath: "/virtual/project/page.adoc",
				resolvedPath: "/virtual/project/partials/snippet.adoc",
			},
		});

		expect(marker).toContain("<!-- md-ir-include ");
		expect(decodeIncludeDirectiveMarker(marker)).toEqual({
			type: "includeDirective",
			target: "partials/snippet.adoc",
			attributes: {
				lines: "1..3",
				leveloffset: "+1",
			},
			diagnostics: [
				{
					code: "invalid-line-range",
					message: "include line selectors must be positive integers or ranges",
					source: "1..bad",
				},
			],
			semantics: {
				lineRanges: [{ start: 1, end: 3 }],
				levelOffset: 1,
			},
			provenance: {
				depth: 1,
				includeRootDir: "/virtual/project",
				inclusionStack: [
					"/virtual/project/page.adoc",
					"/virtual/project/partials/snippet.adoc",
				],
				includingSourcePath: "/virtual/project/page.adoc",
				resolvedPath: "/virtual/project/partials/snippet.adoc",
			},
		});
	});

	it("ignores non-marker lines", () => {
		expect(
			decodeIncludeDirectiveMarker(
				"include::partials/snippet.adoc[lines=1..3]",
			),
		).toBeUndefined();
	});
});
