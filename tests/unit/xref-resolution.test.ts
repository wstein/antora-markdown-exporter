import { describe, expect, it } from "vitest";
import { markdownFlavorSpecs } from "../../src/markdown/flavor.js";
import { resolveMarkdownXrefDestination } from "../../src/markdown/xref-resolution.js";

describe("resolveMarkdownXrefDestination", () => {
	it("keeps the assembled href unchanged for source-style flavors", () => {
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "2.0@docs:ROOT:install.html#cli",
					target: {
						raw: "docs:ROOT:install.adoc#cli",
						component: "docs",
						version: "2.0",
						module: "ROOT",
						family: {
							kind: "page",
							name: "page",
						},
						path: "install.adoc",
						fragment: "cli",
					},
					children: [{ type: "text", value: "cli" }],
				},
				markdownFlavorSpecs.gfm,
			),
		).toBe("2.0@docs:ROOT:install.html#cli");
	});

	it("keeps the assembled href unchanged for site-style flavors", () => {
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "docs/2.0/install.html#cli",
					target: {
						raw: "2.0@docs:ROOT:install.adoc#cli",
						component: "docs",
						version: "2.0",
						module: "ROOT",
						family: {
							kind: "page",
							name: "page",
						},
						path: "install.adoc",
						fragment: "cli",
					},
					children: [{ type: "text", value: "cli" }],
				},
				markdownFlavorSpecs.gitlab,
			),
		).toBe("docs/2.0/install.html#cli");
	});

	it("keeps asset and same-page hrefs unchanged", () => {
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "docs/2.0/_images/diagram.png",
					target: {
						raw: "2.0@docs:ROOT:image$diagram.png",
						component: "docs",
						version: "2.0",
						module: "ROOT",
						family: {
							kind: "image",
							name: "image",
						},
						path: "diagram.png",
					},
					children: [{ type: "text", value: "diagram" }],
				},
				markdownFlavorSpecs.strict,
			),
		).toBe("docs/2.0/_images/diagram.png");
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "#overview",
					target: {
						raw: "docs:ROOT:index.adoc#overview",
						component: "docs",
						module: "ROOT",
						family: {
							kind: "page",
							name: "page",
						},
						path: "",
						fragment: "overview",
					},
					children: [{ type: "text", value: "overview" }],
				},
				markdownFlavorSpecs.strict,
			),
		).toBe("#overview");
	});
});
