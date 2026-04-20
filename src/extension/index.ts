export interface AntoraExtensionConfig {
  readonly [key: string]: unknown;
}

export function registerAntoraExtension(config: AntoraExtensionConfig = {}) {
  return {
    name: "@wsmy/antora-markdown-exporter",
    version: "0.1.0",
    config,
  };
}
