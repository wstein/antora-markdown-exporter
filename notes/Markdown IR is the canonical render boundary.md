---
id: 20260420193100
aliases:
  - Markdown semantic layer
  - Markdown IR boundary
  - Canonical render boundary
tags:
  - architecture
  - ir
  - markdown
  - renderer
---
The Markdown IR is the canonical render boundary for the repository and preserves document meaning independently from any concrete Markdown flavor. All renderer logic must consume normalized semantic nodes instead of source-specific or syntax-specific structures.


## What


The repository defines a custom Markdown intermediate representation for headings, paragraphs, inline emphasis, code, lists, block quotes, links, images, admonitions, tables, anchors, and explicit unsupported nodes.


The IR is semantic rather than textual. It expresses meaning such as admonition kind or heading depth without embedding flavor syntax.


## Why


Multiple Markdown flavors differ in syntax support and fallback behavior. A direct flavor-to-string approach would spread semantic decisions across renderers and make regressions hard to detect.


The IR isolates meaning from syntax, supports normalization, and makes the output contract testable.


## How


Define the canonical node types in `src/markdown/ir.ts`.


Run all source mappings through the IR before rendering. Apply normalization in `src/markdown/normalize.ts` before any flavor renderer runs.


Do not let renderers accept raw AsciiDoc AST nodes. Renderers only consume normalized IR.


## Links


- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The pipeline feeds the IR boundary.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers depend on this invariant.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Snapshot tests validate the frozen render contract.
- src/markdown/ir.ts - Canonical semantic node definitions.
- src/markdown/normalize.ts - IR normalization pass.
