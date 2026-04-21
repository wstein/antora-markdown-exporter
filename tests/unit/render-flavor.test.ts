import { describe, expect, it } from "vitest";
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
								family: "partial",
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
			"[install](docs/ROOT/install.html) [cli](docs/2.0/ROOT/install.html#cli) [nav](docs/ROOT/partial/nav.adoc)",
		);
		expect(renderStrict(documentWithXrefs)).toContain(
			"[install](docs/ROOT/install.html) [cli](docs/2.0/ROOT/install.html#cli) [nav](docs/ROOT/partial/nav.adoc)",
		);
	});
});
