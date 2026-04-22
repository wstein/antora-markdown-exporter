export type ConvertAssemblyToMarkdownIROptions = {
	includeRootDir?: string;
	includeResolver?: (
		includeTarget: string,
		context: { includeRootDir: string; sourcePath: string },
	) => string | undefined;
	sourcePath?: string;
};

export type ParsedListMarker = {
	content: string;
	depth: number;
	ordered: boolean;
};

export type ParsedLabeledGroupMarker = {
	content?: string;
	label: string;
};

export type IncludeDirective = {
	attributes: Record<string, string>;
	target: string;
};
