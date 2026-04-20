import { describe, expect, it } from "vitest";
import { normalizeMarkdownIR } from "../../src/markdown/normalize.js";

describe("normalizeMarkdownIR", () => {
	it("collapses repeated whitespace in paragraph and heading text nodes", () => {
		const normalized = normalizeMarkdownIR({
			type: "document",
			children: [
				{
					type: "heading",
					depth: 1,
					children: [{ type: "text", value: "  Sample   title  " }],
				},
				{
					type: "paragraph",
					children: [{ type: "text", value: "Hello   world" }],
				},
			],
		});

		expect(normalized.children[0]).toMatchObject({
			type: "heading",
			children: [{ type: "text", value: "Sample title" }],
		});
		expect(normalized.children[1]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "Hello world" }],
		});
	});

	it("normalizes nested ordered list, quote, and link content recursively", () => {
		const normalized = normalizeMarkdownIR({
			type: "document",
			children: [
				{
					type: "list",
					ordered: true,
					items: [
						{
							children: [
								{
									type: "paragraph",
									children: [
										{
											type: "link",
											url: "https://example.com",
											children: [{ type: "text", value: "  Example   docs  " }],
										},
									],
								},
								{
									type: "list",
									ordered: false,
									items: [
										{
											children: [
												{
													type: "paragraph",
													children: [
														{
															type: "text",
															value: "  Keep   reviewing  ",
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
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [{ type: "text", value: "  Stay   focused. " }],
						},
					],
				},
			],
		});

		expect(normalized.children[0]).toMatchObject({
			type: "list",
			ordered: true,
			items: [
				{
					children: [
						{
							type: "paragraph",
							children: [
								{
									type: "link",
									children: [{ type: "text", value: "Example docs" }],
								},
							],
						},
						{
							type: "list",
							ordered: false,
							items: [
								{
									children: [
										{
											type: "paragraph",
											children: [{ type: "text", value: "Keep reviewing" }],
										},
									],
								},
							],
						},
					],
				},
			],
		});
		expect(normalized.children[1]).toMatchObject({
			type: "blockquote",
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "Stay focused." }],
				},
			],
		});
	});
});
