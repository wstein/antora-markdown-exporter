import { describe, expect, it } from "vitest";
import { markdownFlavorSpecs } from "../../src/markdown/flavor.js";
import { resolveMarkdownXrefDestination } from "../../src/markdown/xref-resolution.js";

describe("resolveMarkdownXrefDestination", () => {
	it("keeps source-shaped destinations for source-style flavors", () => {
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
		).toBe("docs/2.0/ROOT/install.adoc#cli");
	});

	it("routes page-family targets through site-style flavors and omits ROOT when configured", () => {
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "docs/2.0/ROOT/install.adoc#cli",
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

	it("routes each supported site asset family explicitly", () => {
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "docs/2.0/ROOT/image/diagram.png",
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
					url: "docs/2.0/ROOT/attachment/guide.pdf",
					target: {
						raw: "2.0@docs:ROOT:attachment$guide.pdf",
						component: "docs",
						version: "2.0",
						module: "ROOT",
						family: {
							kind: "attachment",
							name: "attachment",
						},
						path: "guide.pdf",
					},
					children: [{ type: "text", value: "guide" }],
				},
				markdownFlavorSpecs.strict,
			),
		).toBe("docs/2.0/_attachments/guide.pdf");
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "docs/2.0/ROOT/example/example.adoc",
					target: {
						raw: "2.0@docs:ROOT:example$example.adoc",
						component: "docs",
						version: "2.0",
						module: "ROOT",
						family: {
							kind: "example",
							name: "example",
						},
						path: "example.adoc",
					},
					children: [{ type: "text", value: "example" }],
				},
				markdownFlavorSpecs.strict,
			),
		).toBe("docs/2.0/_examples/example.adoc");
	});

	it("keeps unknown families source-shaped even in site-style flavors", () => {
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "2.0@docs:ROOT:widget$thing.bin",
					target: {
						raw: "docs:ROOT:widget$thing.bin",
						component: "docs",
						version: "2.0",
						module: "ROOT",
						family: {
							kind: "other",
							name: "widget",
						},
						path: "thing.bin",
					},
					children: [{ type: "text", value: "thing" }],
				},
				markdownFlavorSpecs.gitlab,
			),
		).toBe("docs/2.0/ROOT/widget/thing.bin");
	});

	it("falls back to fragments or original urls when the target path is empty", () => {
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "docs/ROOT/index.adoc#overview",
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
				markdownFlavorSpecs.gitlab,
			),
		).toBe("#overview");
		expect(
			resolveMarkdownXrefDestination(
				{
					type: "xref",
					url: "docs/ROOT/index.adoc",
					target: {
						raw: "docs:ROOT:index.adoc",
						component: "docs",
						module: "ROOT",
						family: {
							kind: "page",
							name: "page",
						},
						path: "",
					},
					children: [{ type: "text", value: "home" }],
				},
				markdownFlavorSpecs.gitlab,
			),
		).toBe("docs/ROOT/index.adoc");
	});
});
