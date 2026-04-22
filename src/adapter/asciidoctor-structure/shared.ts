import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { AssemblySourceLocation } from "../assembly-structure.js";
import type { AsciidoctorBlock, AsciidoctorListItem } from "./types.js";

const require = createRequire(
	typeof __filename === "string"
		? __filename
		: resolve(process.cwd(), "package.json"),
);

type AsciidoctorInstance = {
	load: (source: string, options: Record<string, unknown>) => AsciidoctorBlock;
};

let cachedAsciidoctor: AsciidoctorInstance | undefined;

function loadAntoraAsciidoctor(): AsciidoctorInstance | undefined {
	try {
		const loaderPackagePath = require.resolve(
			"@antora/asciidoc-loader/package.json",
		);
		return require(
			resolve(dirname(loaderPackagePath), "lib/asciidoctor.js"),
		) as AsciidoctorInstance;
	} catch {
		return undefined;
	}
}

function loadStandaloneAsciidoctor(): AsciidoctorInstance {
	const asciidoctorFactory = require("@asciidoctor/core") as
		| (() => AsciidoctorInstance)
		| { default?: () => AsciidoctorInstance };

	if (typeof asciidoctorFactory === "function") {
		return asciidoctorFactory();
	}

	if (typeof asciidoctorFactory.default === "function") {
		return asciidoctorFactory.default();
	}

	throw new Error("Unable to initialize Asciidoctor runtime");
}

export function createAsciidoctor(): AsciidoctorInstance {
	if (cachedAsciidoctor !== undefined) {
		return cachedAsciidoctor;
	}

	cachedAsciidoctor =
		globalThis.Opal !== undefined
			? (loadAntoraAsciidoctor() ?? loadStandaloneAsciidoctor())
			: loadStandaloneAsciidoctor();
	return cachedAsciidoctor;
}

export function getSourceLocation(
	node: Pick<AsciidoctorBlock, "getSourceLocation"> | AsciidoctorListItem,
): AssemblySourceLocation | undefined {
	const location = node.getSourceLocation?.();
	if (location === undefined) {
		return undefined;
	}

	const path = location.getPath?.();
	const line = location.getLineNumber?.();
	if (path === undefined && line === undefined) {
		return undefined;
	}

	return {
		path,
		line,
	};
}

export function decodeHtmlEntities(value: string): string {
	return value
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'");
}

export function decodeLiteralCode(value: string): string {
	return decodeHtmlEntities(value)
		.replace(/<a\s[^>]*>/gu, "")
		.replaceAll("</a>", "")
		.replaceAll("<strong>", "**")
		.replaceAll("</strong>", "**")
		.replaceAll("<em>", "_")
		.replaceAll("</em>", "_")
		.replaceAll("&#8230;", "...")
		.replaceAll("&#8203;", "")
		.replaceAll("&#8201;", " ")
		.replaceAll("&#8212;", "--")
		.replaceAll("&#8594;", "->");
}

export function parseHtmlAttributes(value: string): {
	attributes: Record<string, string>;
	tagName: string;
} {
	const tagMatch = value.match(/^<([A-Za-z0-9]+)\s*([^>]*)>$/);
	if (tagMatch === null) {
		return { tagName: "", attributes: {} };
	}

	const [, tagName = "", rawAttributes = ""] = tagMatch;
	const attributes: Record<string, string> = {};
	for (const match of rawAttributes.matchAll(
		/([A-Za-z_:][-A-Za-z0-9_:.]*)="([^"]*)"/g,
	)) {
		const [, name, attributeValue] = match;
		if (name !== undefined && attributeValue !== undefined) {
			attributes[name] = decodeHtmlEntities(attributeValue);
		}
	}

	return {
		tagName: tagName.toLowerCase(),
		attributes,
	};
}
