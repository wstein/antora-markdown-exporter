---
title: Antora module markdown export should use the canonical repository pipeline
---

# Antora module markdown export should use the canonical repository pipeline

## Summary

Antora module markdown export should use the canonical repository pipeline because generated Markdown artifacts must reflect the same Antora Assembler integration, semantic mapping, normalization, and flavor rendering rules that the package exposes everywhere else.

## What

When the repository exports Markdown from documentation modules, it should:

- assemble one module document per exported module through the same maintained module-source path used for the repository PDF artifacts
- convert assembled AsciiDoc with the repository-owned AsciiDoc-to-IR pipeline
- normalize the IR before rendering
- render with one explicit Markdown flavor
- write deterministic output under a generated directory such as `build/markdown/**`

The repository script and Make target should stay thin wrappers over that one pipeline rather than creating a separate conversion path or post-processing rendered Markdown with search-and-replace cleanup.

## Why

If local export workflows bypass the canonical pipeline:

- generated Markdown can drift from library behavior
- generated Markdown can drift from the repository PDFs even when both exports nominally describe the same module documents
- fixes in normalization or rendering will not propagate consistently
- tests stop proving the behavior users actually run
- repository tooling becomes harder to explain and maintain

One pipeline keeps exported artifacts, package behavior, and validation expectations aligned.

## How

Implement Antora module export through one maintained script in `scripts/**` that uses:

- the maintained assembled module-source builder already used for PDF generation
- `createMarkdownConverter`
- `convertAssemblyToMarkdownIR`
- `normalizeMarkdownIR`
- `renderMarkdown`

Expose that script through `package.json` and the `Makefile`.

Do not add a second markdown conversion path for repository exports.

Do not patch rendered Markdown after the renderer has emitted it. If the output is wrong, fix the semantic conversion or the renderer.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The export command must remain inside the repository-owned conversion boundary.
- [[Markdown IR is the canonical render boundary]] - Exported Markdown should come from normalized semantic nodes.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Export output must use explicit flavor rendering rather than ad-hoc formatting.
- [[Repository scripts and referenced files must stay in lockstep]] - The script, Make target, and documentation must stay aligned.
- scripts/export-antora-modules.ts - Maintained export entrypoint.
- scripts/docs-module-sources.mjs - Shared assembled module source for PDF and Markdown exports.
- Makefile - Operator entrypoint.
