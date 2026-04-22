export type AsciidoctorBlock = {
	findBy: (filter: unknown) => unknown[];
	getAttribute: (name: string) => string | undefined;
	getAttributes: () => Record<string, string>;
	getBlocks: () => AsciidoctorBlock[];
	getBodyRows?: () => AsciidoctorTableCell[][];
	getColumns?: () => Array<{
		getAttributes?: () => Record<string, string>;
	}>;
	getContent?: () => string;
	getContext: () => string;
	getDocumentTitle?: () => string;
	getHeadRows?: () => AsciidoctorTableCell[][];
	getId?: () => string | undefined;
	getItems?: () => AsciidoctorListItem[];
	getLevel?: () => number;
	getNodeName?: () => string;
	getSource?: () => string;
	getSourceLocation?: () => {
		getLineNumber?: () => number;
		getPath?: () => string;
	};
	getStyle?: () => string | undefined;
	getTitle?: () => string | undefined;
	hasHeader?: () => boolean;
};

export type AsciidoctorListItem = {
	getBlocks?: () => AsciidoctorBlock[];
	getContext?: () => string;
	getSourceLocation?: () => {
		getLineNumber?: () => number;
		getPath?: () => string;
	};
	getText: () => string;
};

export type AsciidoctorDescriptionListTerm = {
	getText: () => string;
};

export type AsciidoctorDescriptionListDescription = {
	getBlocks?: () => AsciidoctorBlock[];
	getSourceLocation?: () => {
		getLineNumber?: () => number;
		getPath?: () => string;
	};
	getText?: () => string;
};

export type AsciidoctorTableCell = {
	getSource?: () => string;
	getText: () => string;
};

export type ExtractAssemblyStructureOptions = {
	attributes?: Record<string, string>;
	sourcePath?: string;
	xrefFallbackLabelStyle?: "fragment-or-basename" | "fragment-or-path";
};
