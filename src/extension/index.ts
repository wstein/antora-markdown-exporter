export interface AntoraExtensionScaffoldConfig {
	readonly [key: string]: unknown;
}

export interface AntoraExtensionScaffold {
	readonly kind: "scaffold";
	readonly name: "@wsmy/antora-markdown-exporter";
	readonly version: "0.1.0-dev";
	readonly config: AntoraExtensionScaffoldConfig;
}

export function createAntoraExtensionScaffold(
	config: AntoraExtensionScaffoldConfig = {},
): AntoraExtensionScaffold {
	return {
		kind: "scaffold",
		name: "@wsmy/antora-markdown-exporter",
		version: "0.1.0-dev",
		config,
	};
}
