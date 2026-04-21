---
id: 20260421071200
aliases: ["Extension versus fallback distinction", "Non-lossy passthrough category", "Markdown extension classification"]
tags: ["architecture", "fallback", "extensions", "classification"]
target: current
---
Transparent extensions are not fallback mechanisms because they preserve valid semantic constructs that downstream renderers may support, whereas fallback mechanisms represent controlled degradation for constructs that cannot be represented safely.

## What

The repository distinguishes between:

1. native markdown constructs
2. transparent extensions
3. controlled fallback
4. unsupported degradation

Transparent extensions include:
- fenced code blocks with language identifiers such as `mermaid`

Fallback mechanisms include:
- unsupported block markers
- raw HTML fallback
- fenced source fallback

## Why

Treating all unknown constructs as fallback:

- conflates valid but unsupported features with invalid or lossy constructs
- leads to unnecessary degradation
- reduces output fidelity

Transparent extensions preserve meaning without introducing ambiguity or unsafe behavior.

## How

When evaluating a node:

- if it is a valid semantic node such as `codeBlock`, preserve it
- if it cannot be represented semantically, apply fallback policy
- never route valid semantic constructs through fallback layers

Keep fallback logic centralized and separate from extension preservation.

## Links

- [[Transparent fenced extensions preserve authored language semantics]] - Mermaid is the primary example.
- [[Fallback selection is centralized across markdown flavors]] - Fallback logic must remain explicit.
- [[Markdown IR is the canonical render boundary]] - Classification occurs after semantic mapping.
