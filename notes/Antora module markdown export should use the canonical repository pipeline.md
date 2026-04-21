---
title: Antora module markdown export should use the canonical repository pipeline
---

# Antora module markdown export should use the canonical repository pipeline

## Summary

Antora module markdown export should use the canonical repository pipeline because generated Markdown artifacts must reflect the same semantic mapping, normalization, and flavor rendering rules that the package exposes everywhere else.

## What

When the repository exports Markdown from Antora module source pages, it should:

- read page sources from `docs/modules/**/pages/**/*.adoc`
- convert them with the repository-owned AsciiDoc-to-IR pipeline
- normalize the IR before rendering
- render with one explicit Markdown flavor
- write deterministic output under a generated directory such as `build/markdown/**`

The repository script and Make target should stay thin wrappers over that one pipeline rather than creating a separate conversion path.

## Why

If local export workflows bypass the canonical pipeline:

- generated Markdown can drift from library behavior
- fixes in normalization or rendering will not propagate consistently
- tests stop proving the behavior users actually run
- repository tooling becomes harder to explain and maintain

One pipeline keeps exported artifacts, package behavior, and validation expectations aligned.

## How

Implement Antora module export through one maintained script in `scripts/**` that uses:

- `convertAssemblyToMarkdownIR`
- `normalizeMarkdownIR`
- `renderMarkdown`

Expose that script through `package.json` and the `Makefile`.

Do not add a second markdown conversion path for repository exports.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The export command must remain inside the repository-owned conversion boundary.
- [[Markdown IR is the canonical render boundary]] - Exported Markdown should come from normalized semantic nodes.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Export output must use explicit flavor rendering rather than ad-hoc formatting.
- [[Repository scripts and referenced files must stay in lockstep]] - The script, Make target, and documentation must stay aligned.
- scripts/export-antora-modules.ts - Maintained export entrypoint.
- Makefile - Operator entrypoint.
