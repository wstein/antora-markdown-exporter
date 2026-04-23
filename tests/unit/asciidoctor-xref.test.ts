import { describe, expect, it } from "vitest";
import {
	isStructuredXrefHref,
	parseXrefTarget,
} from "../../src/adapter/asciidoctor-structure/xref.js";

describe("asciidoctor xref helpers", () => {
	it("recognizes structured href forms and parses qualified targets", () => {
		expect(isStructuredXrefHref("#anchor")).toBe(true);
		expect(isStructuredXrefHref("https://example.com")).toBe(false);
		expect(isStructuredXrefHref("guide/setup.md")).toBe(true);
		expect(isStructuredXrefHref("docs:ROOT:page$guide/setup.html")).toBe(true);
		expect(isStructuredXrefHref("2.0@docs:ROOT:partial$nav.adoc")).toBe(true);

		expect(parseXrefTarget("#overview")).toEqual({
			raw: "#overview",
			path: "",
			fragment: "overview",
		});
		expect(parseXrefTarget("docs:ROOT:partial$nav.html")).toMatchObject({
			component: "docs",
			module: "ROOT",
			family: { kind: "partial", name: "partial" },
			path: "nav.adoc",
		});
		expect(parseXrefTarget("2.0@docs:ROOT:thing$blob.bin")).toMatchObject({
			version: "2.0",
			component: "docs",
			module: "ROOT",
			family: { kind: "other", name: "thing" },
			path: "blob.bin",
		});
		expect(parseXrefTarget("install.html#cli")).toMatchObject({
			path: "install.adoc",
			fragment: "cli",
		});
	});
});
