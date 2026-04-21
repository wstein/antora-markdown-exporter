import { describe, expect, it } from "vitest";
import {
	markdownFlavorSpecs,
	resolveMarkdownFlavor,
} from "../../src/markdown/flavor.js";
import {
	renderCommonMark,
	renderGitLab,
	renderMarkdown,
	renderStrict,
} from "../../src/markdown/render/index.js";

const richDocument = {
	type: "document" as const,
	children: [
		{
			type: "paragraph" as const,
			children: [
				{ type: "text" as const, value: "Line one" },
				{ type: "hardBreak" as const },
				{ type: "text" as const, value: "Line two" },
				{ type: "softBreak" as const },
				{
					type: "footnoteReference" as const,
					identifier: "note-1",
					label: "Note one",
				},
				{ type: "text" as const, value: " " },
				{
					type: "citation" as const,
					identifier: "cite-key",
					label: "Source",
				},
			],
		},
		{
			type: "table" as const,
			align: ["left", "right"] as const,
			header: {
				cells: [
					{ children: [{ type: "text" as const, value: "Name" }] },
					{ children: [{ type: "text" as const, value: "Value" }] },
				],
			},
			rows: [
				{
					cells: [
						{ children: [{ type: "text" as const, value: "Alpha" }] },
						{ children: [{ type: "text" as const, value: "42" }] },
					],
				},
			],
		},
		{
			type: "htmlBlock" as const,
			value: "<div>raw</div>",
		},
		{
			type: "footnoteDefinition" as const,
			identifier: "note-1",
			children: [
				{
					type: "paragraph" as const,
					children: [{ type: "text" as const, value: "Footnote body." }],
				},
			],
		},
	],
};

describe("flavor-aware markdown rendering", () => {
	it("renders GFM-compatible features through the generic renderer", () => {
		const rendered = renderMarkdown(richDocument, "gfm");

		expect(rendered).toContain("Line one\\\nLine two");
		expect(rendered).toContain("[^note-1] [cite:Source]");
		expect(rendered).toContain("| Name | Value |");
		expect(rendered).toContain("<div>raw</div>");
		expect(rendered).toContain("[^note-1]: Footnote body.");
	});

	it("falls back for commonmark features that are outside the shared subset", () => {
		const rendered = renderCommonMark(richDocument);

		expect(rendered).toContain("Line one  \nLine two");
		expect(rendered).toContain("[Note one] [cite:Source]");
		expect(rendered).toContain(
			"> Unsupported: table rendering requires table-capable markdown",
		);
		expect(rendered).toContain(
			"> Unsupported: footnote definitions require footnote-capable markdown",
		);
		expect(rendered).toContain("<div>raw</div>");
	});

	it("preserves citations for the gitlab profile", () => {
		const rendered = renderGitLab(richDocument);

		expect(rendered).toContain("[^note-1] [@cite-key]");
		expect(rendered).toContain("| Name | Value |");
	});

	it("uses strict fallback policy for raw html and soft breaks", () => {
		const rendered = renderStrict(richDocument);

		expect(rendered).toContain("Line two [Note one] [cite:Source]");
		expect(rendered).toContain(
			"> Unsupported: raw HTML blocks are not allowed in this flavor",
		);
		expect(rendered).toContain(
			"> Unsupported: table rendering requires table-capable markdown",
		);
	});

	it("escapes inline raw html in flavors that do not allow it", () => {
		const rendered = renderStrict({
			type: "document",
			children: [
				{
					type: "paragraph" as const,
					children: [{ type: "htmlInline" as const, value: "<kbd>Ctrl</kbd>" }],
				},
			],
		});

		expect(rendered).toBe("\\<kbd\\>Ctrl\\</kbd\\>\n");
	});

	it("shapes Antora xref destinations per flavor policy", () => {
		const documentWithXrefs = {
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
						{ type: "text" as const, value: " " },
						{
							type: "xref" as const,
							url: "docs/2.0/ROOT/install.adoc#cli",
							target: {
								raw: "2.0@docs:ROOT:install.adoc#cli",
								component: "docs",
								version: "2.0",
								module: "ROOT",
								family: {
									kind: "page" as const,
									name: "page",
								},
								path: "install.adoc",
								fragment: "cli",
							},
							children: [{ type: "text" as const, value: "cli" }],
						},
						{ type: "text" as const, value: " " },
						{
							type: "xref" as const,
							url: "docs/ROOT/partial/nav.adoc",
							target: {
								raw: "docs:ROOT:partial$nav.adoc",
								component: "docs",
								module: "ROOT",
								family: {
									kind: "partial" as const,
									name: "partial",
								},
								path: "nav.adoc",
							},
							children: [{ type: "text" as const, value: "nav" }],
						},
					],
				},
			],
		};

		expect(renderMarkdown(documentWithXrefs, "gfm")).toContain(
			"[install](docs/ROOT/install.adoc) [cli](docs/2.0/ROOT/install.adoc#cli) [nav](docs/ROOT/partial/nav.adoc)",
		);
		expect(renderGitLab(documentWithXrefs)).toContain(
			"[install](docs/install.html) [cli](docs/2.0/install.html#cli) [nav](docs/ROOT/partial/nav.adoc)",
		);
		expect(renderStrict(documentWithXrefs)).toContain(
			"[install](docs/install.html) [cli](docs/2.0/install.html#cli) [nav](docs/ROOT/partial/nav.adoc)",
		);
	});

	it("routes asset-family and non-root-module xrefs through site-style flavors", () => {
		const documentWithFamilyTargets = {
			type: "document" as const,
			children: [
				{
					type: "paragraph" as const,
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
						{ type: "text" as const, value: " " },
						{
							type: "xref" as const,
							url: "docs/2.0/ROOT/attachment/guide.pdf",
							target: {
								raw: "2.0@docs:ROOT:attachment$guide.pdf",
								component: "docs",
								version: "2.0",
								module: "ROOT",
								family: {
									kind: "attachment" as const,
									name: "attachment",
								},
								path: "guide.pdf",
							},
							children: [{ type: "text" as const, value: "guide" }],
						},
						{ type: "text" as const, value: " " },
						{
							type: "xref" as const,
							url: "docs/2.0/api/page/index.adoc#overview",
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
						{ type: "text" as const, value: " " },
						{
							type: "xref" as const,
							url: "docs/2.0/ROOT/example/example.adoc",
							target: {
								raw: "2.0@docs:ROOT:example$example.adoc",
								component: "docs",
								version: "2.0",
								module: "ROOT",
								family: {
									kind: "example" as const,
									name: "example",
								},
								path: "example.adoc",
							},
							children: [{ type: "text" as const, value: "example" }],
						},
					],
				},
			],
		};

		expect(renderCommonMark(documentWithFamilyTargets)).toContain(
			"[diagram](docs/2.0/ROOT/image/diagram.png) [guide](docs/2.0/ROOT/attachment/guide.pdf) [overview](docs/2.0/api/page/index.adoc#overview) [example](docs/2.0/ROOT/example/example.adoc)",
		);
		expect(renderGitLab(documentWithFamilyTargets)).toContain(
			"[diagram](docs/2.0/_images/diagram.png) [guide](docs/2.0/_attachments/guide.pdf) [overview](docs/2.0/api/index.html#overview) [example](docs/2.0/_examples/example.adoc)",
		);
	});

	it("accepts pre-resolved flavor specs and covers site fallbacks for empty xref paths", () => {
		const flavor = resolveMarkdownFlavor(markdownFlavorSpecs.gitlab);
		const rendered = renderMarkdown(
			{
				type: "document",
				children: [
					{
						type: "paragraph" as const,
						children: [
							{
								type: "xref" as const,
								url: "docs/ROOT/index.adoc#overview",
								target: {
									raw: "docs:ROOT:index.adoc#overview",
									component: "docs",
									module: "ROOT",
									family: {
										kind: "page" as const,
										name: "page",
									},
									path: "",
									fragment: "overview",
								},
								children: [{ type: "text" as const, value: "overview" }],
							},
							{ type: "text" as const, value: " " },
							{
								type: "xref" as const,
								url: "docs/ROOT/index.adoc",
								target: {
									raw: "docs:ROOT:index.adoc",
									component: "docs",
									module: "ROOT",
									family: {
										kind: "page" as const,
										name: "page",
									},
									path: "",
								},
								children: [{ type: "text" as const, value: "home" }],
							},
						],
					},
				],
			},
			flavor,
		);

		expect(rendered).toContain(
			"[overview](#overview) [home](docs/ROOT/index.adoc)",
		);
	});

	it("renders admonitions with non-paragraph bodies and respects ordered-list start policy", () => {
		const document = {
			type: "document" as const,
			children: [
				{
					type: "admonition" as const,
					kind: "warning" as const,
					children: [
						{
							type: "list" as const,
							ordered: true,
							start: 4,
							items: [
								{
									children: [
										{
											type: "paragraph" as const,
											children: [
												{ type: "text" as const, value: "First warning" },
											],
										},
									],
								},
								{
									children: [
										{
											type: "paragraph" as const,
											children: [
												{ type: "text" as const, value: "Second warning" },
											],
										},
									],
								},
							],
						},
					],
				},
			],
		};

		expect(renderGitLab(document)).toBe(
			[
				"> **WARNING:**",
				">",
				"> 4. First warning",
				"> 5. Second warning",
				"",
			].join("\n"),
		);
		expect(renderStrict(document)).toBe(
			[
				"> **WARNING:**",
				">",
				"> 1. First warning",
				"> 2. Second warning",
				"",
			].join("\n"),
		);
	});
});
