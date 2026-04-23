---
id: 20260421120000
title: Antora module markdown export should use the canonical repository pipeline
target: current
---

# Antora module markdown export should use the canonical repository pipeline

## Summary

Antora module markdown export should use the canonical repository pipeline because generated Markdown artifacts must reflect the same Antora Assembler integration, semantic mapping, normalization, and flavor rendering rules that the package exposes everywhere else.

## What

When the repository exports Markdown from documentation modules, it should:

- model export partitioning through Antora Assembler configuration, defaulting to `assembly.root_level: 1`
- convert assembled AsciiDoc with the repository-owned AsciiDoc-to-IR pipeline
- normalize the IR before rendering
- render with one explicit Markdown flavor
- write deterministic output under a generated directory such as `build/markdown/**`
- keep assembled review artifacts locally navigable by rewriting internal page links to the corresponding exported `.md` files

The repository script and Make target should stay thin wrappers over that one pipeline rather than creating a separate conversion path or post-processing rendered Markdown with search-and-replace cleanup.

That export-local link rewriting still belongs to the same pipeline because it uses Antora Assembler membership data for the assembled outputs. It is not a second converter and it is not a renderer-side string cleanup pass.

## Why

If local export workflows bypass the canonical pipeline:

- generated Markdown can drift from library behavior
- generated Markdown can drift from the repository PDFs even when both exports nominally describe the same module documents
- fixes in normalization or rendering will not propagate consistently
- tests stop proving the behavior users actually run
- repository tooling becomes harder to explain and maintain

One pipeline keeps exported artifacts, package behavior, and validation expectations aligned.

## How

Implement Antora module export through one maintained package surface in `src/module-export.ts`, with one maintained script in `scripts/**` delegating to that library API.

The package surface should expose:

- `assembleAntoraModules(...)`
- `exportAntoraModulesToMarkdown(...)`
- `exportAntoraModules(...)`

Those entrypoints should use:

- Antora Assembler configuration as the source of truth for assembly partitioning
- `createMarkdownConverter`
- `convertAssemblyStructureToMarkdownIR`
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
- antora-assembler.yml - Repository default Assembler partitioning policy.
- src/extension/index.ts - Extension-level Assembler default and converter registration.
- Makefile - Operator entrypoint.
