import type {
	MarkdownHeading,
	MarkdownImage,
	MarkdownInline,
	MarkdownXrefFamily,
	MarkdownXrefTarget,
} from "../../markdown/ir.js";

type ParsedXrefTarget = {
	label: string;
	target: MarkdownXrefTarget;
	url: string;
};

type ImageToken = {
	alt: string;
	raw: string;
	title?: string;
	type: "image";
	url: string;
};

type LinkToken = {
	label: string;
	raw: string;
	title?: string;
	type: "link";
	url: string;
};

type XrefToken = {
	label: string;
	raw: string;
	target: MarkdownXrefTarget;
	type: "xref";
	url: string;
};

type CodeToken = {
	content: string;
	raw: string;
	type: "code";
};

type StrongToken = {
	content: string;
	raw: string;
	type: "strong";
};

type EmphasisToken = {
	content: string;
	raw: string;
	type: "emphasis";
};

type InlineToken =
	| ImageToken
	| LinkToken
	| XrefToken
	| CodeToken
	| StrongToken
	| EmphasisToken;

function classifyXrefFamily(name: string | undefined): MarkdownXrefFamily {
	switch (name) {
		case undefined:
			return { kind: "page", name: "page" };
		case "attachment":
			return { kind: "attachment", name };
		case "example":
			return { kind: "example", name };
		case "image":
			return { kind: "image", name };
		case "partial":
			return { kind: "partial", name };
		case "page":
			return { kind: "page", name };
		default:
			return { kind: "other", name };
	}
}

function parseNamedAttributes(value: string): {
	title?: string;
	unnamed: string[];
} {
	const attributes = value
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	const unnamed: string[] = [];
	let title: string | undefined;

	for (const attribute of attributes) {
		if (attribute.startsWith("title=")) {
			title = attribute.slice("title=".length).replace(/^"|"$/g, "");
			continue;
		}

		unnamed.push(attribute);
	}

	return { title, unnamed };
}

export function matchImage(value: string): ImageToken | undefined {
	const match = value.match(/^image::?([^\s[]+)\[([^\]]*)\]/);
	if (match === null) {
		return undefined;
	}

	const [, url, attributeText] = match;
	if (url === undefined || attributeText === undefined) {
		return undefined;
	}

	const attributes = parseNamedAttributes(attributeText);
	return {
		type: "image",
		raw: match[0],
		url,
		alt: attributes.unnamed[0] ?? "",
		title: attributes.title,
	};
}

function matchLink(value: string): LinkToken | XrefToken | undefined {
	const linkMatch = value.match(/^(?:link:)?(https?:\/\/[^\s[]+)\[([^\]]+)\]/);
	if (linkMatch !== null) {
		const [, url, label] = linkMatch;
		if (url !== undefined && label !== undefined) {
			return {
				type: "link",
				raw: linkMatch[0],
				url,
				label,
			};
		}
	}

	const xrefMatch = value.match(/^xref:([^[]+)\[([^\]]*)\]/);
	if (xrefMatch === null) {
		return undefined;
	}

	const [, rawTarget, label] = xrefMatch;
	if (rawTarget === undefined || label === undefined) {
		return undefined;
	}
	const parsedTarget = parseXrefTarget(rawTarget);
	if (parsedTarget === undefined) {
		return undefined;
	}

	return {
		type: "xref",
		raw: xrefMatch[0],
		url: parsedTarget.url,
		target: parsedTarget.target,
		label: label.length > 0 ? label : parsedTarget.label,
	};
}

function parseXrefTarget(rawTarget: string): ParsedXrefTarget | undefined {
	if (rawTarget.startsWith("#")) {
		const anchor = rawTarget.slice(1);
		return anchor.length === 0
			? undefined
			: {
					url: `#${anchor}`,
					label: anchor,
					target: {
						raw: rawTarget,
						path: "",
						fragment: anchor,
					},
				};
	}

	const [targetWithoutFragment, fragment] = rawTarget.split("#", 2);
	if (targetWithoutFragment === undefined) {
		return undefined;
	}

	const [versionPart, coordinatePart] = targetWithoutFragment.includes("@")
		? targetWithoutFragment.split("@", 2)
		: [undefined, targetWithoutFragment];
	if (coordinatePart === undefined) {
		return undefined;
	}

	const coordinateSegments = coordinatePart.split(":");
	const pageSegment = coordinateSegments.pop();
	if (pageSegment === undefined) {
		return undefined;
	}
	const [componentName, moduleName] =
		coordinateSegments.length === 2
			? coordinateSegments
			: [undefined, coordinateSegments[0]];

	const normalizedSegments: string[] = [];
	if (coordinateSegments.length === 2) {
		if (componentName !== undefined && componentName.length > 0) {
			normalizedSegments.push(componentName);
		}
		if (versionPart !== undefined && versionPart.length > 0) {
			normalizedSegments.push(versionPart);
		}
		if (moduleName !== undefined && moduleName.length > 0) {
			normalizedSegments.push(moduleName);
		}
	} else if (coordinateSegments.length === 1) {
		if (versionPart !== undefined && versionPart.length > 0) {
			normalizedSegments.push(versionPart);
		}
		if (moduleName !== undefined && moduleName.length > 0) {
			normalizedSegments.push(moduleName);
		}
	} else if (versionPart !== undefined && versionPart.length > 0) {
		normalizedSegments.push(versionPart);
	}

	const [familyName, familyPath] = pageSegment.includes("$")
		? pageSegment.split("$", 2)
		: [undefined, pageSegment];
	if (familyName !== undefined && familyName.length > 0) {
		normalizedSegments.push(familyName);
	}
	if (familyPath !== undefined && familyPath.length > 0) {
		normalizedSegments.push(familyPath);
	}

	const urlPath = normalizedSegments.join("/");
	const labelSource =
		fragment ??
		normalizedSegments[normalizedSegments.length - 1] ??
		targetWithoutFragment;
	return {
		url:
			fragment === undefined || fragment.length === 0
				? urlPath
				: `${urlPath}#${fragment}`,
		label: labelSource.replace(/\.adoc$/, ""),
		target: {
			raw: rawTarget,
			component: componentName,
			version: versionPart,
			module: moduleName,
			family: classifyXrefFamily(familyName),
			path: familyPath ?? pageSegment,
			fragment,
		},
	};
}

function matchCode(value: string): CodeToken | undefined {
	const match = value.match(/^`([^`]+)`/);
	if (match === null) {
		return undefined;
	}

	const [, content] = match;
	if (content === undefined) {
		return undefined;
	}

	return {
		type: "code",
		raw: match[0],
		content,
	};
}

function matchStrong(value: string): StrongToken | undefined {
	const match = value.match(/^\*([^*\n]+)\*/);
	if (match === null) {
		return undefined;
	}

	const [, content] = match;
	if (content === undefined) {
		return undefined;
	}

	return {
		type: "strong",
		raw: match[0],
		content,
	};
}

function matchEmphasis(value: string): EmphasisToken | undefined {
	const match = value.match(/^_([^_\n]+)_/);
	if (match === null) {
		return undefined;
	}

	const [, content] = match;
	if (content === undefined) {
		return undefined;
	}

	return {
		type: "emphasis",
		raw: match[0],
		content,
	};
}

function findNextInlineToken(
	value: string,
	startIndex: number,
): { index: number; token: InlineToken } | undefined {
	const patterns = [
		matchImage,
		matchLink,
		matchCode,
		matchStrong,
		matchEmphasis,
	];
	let nearest: { index: number; token: InlineToken } | undefined;

	for (let index = startIndex; index < value.length; index += 1) {
		const segment = value.slice(index);
		for (const matcher of patterns) {
			const token = matcher(segment);
			if (token !== undefined) {
				nearest = { index, token };
				break;
			}
		}

		if (nearest !== undefined) {
			break;
		}
	}

	return nearest;
}

export function parseInline(value: string): MarkdownInline[] {
	const nodes: MarkdownInline[] = [];
	let cursor = 0;

	while (cursor < value.length) {
		const next = findNextInlineToken(value, cursor);
		if (next === undefined) {
			nodes.push({
				type: "text",
				value: value.slice(cursor),
			});
			break;
		}

		if (next.index > cursor) {
			nodes.push({
				type: "text",
				value: value.slice(cursor, next.index),
			});
		}

		switch (next.token.type) {
			case "image":
				nodes.push(<MarkdownImage>{
					type: "image",
					url: next.token.url,
					title: next.token.title,
					alt: parseInline(next.token.alt),
				});
				break;
			case "link":
				nodes.push({
					type: "link",
					url: next.token.url,
					title: next.token.title,
					children: parseInline(next.token.label),
				});
				break;
			case "xref":
				nodes.push({
					type: "xref",
					target: next.token.target,
					url: next.token.url,
					children: parseInline(next.token.label),
				});
				break;
			case "code":
				nodes.push({
					type: "code",
					value: next.token.content,
				});
				break;
			case "strong":
				nodes.push({
					type: "strong",
					children: parseInline(next.token.content),
				});
				break;
			case "emphasis":
				nodes.push({
					type: "emphasis",
					children: parseInline(next.token.content),
				});
				break;
		}

		cursor = next.index + next.token.raw.length;
	}

	if (nodes.length === 0) {
		nodes.push({ type: "text", value });
	}

	return nodes;
}

export function parseHeading(line: string): MarkdownHeading | undefined {
	const match = line.match(/^(=+)\s+(.*)$/);
	if (match === null) {
		return undefined;
	}

	const [, markers, content] = match;
	if (markers === undefined || content === undefined) {
		return undefined;
	}

	const depth = Math.max(1, markers.length - 1);

	return {
		type: "heading",
		depth,
		children: parseInline(content.trim()),
	};
}
