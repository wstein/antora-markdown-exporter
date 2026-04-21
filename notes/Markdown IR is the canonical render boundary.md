---
id: 20260420193100
aliases: ["Markdown semantic layer", "Markdown IR boundary", "Canonical render boundary", "Render Kernel Constitution"]
tags: ["architecture", "ir", "markdown", "renderer"]
target: current
---
The Markdown IR is the canonical render boundary for the repository and preserves document meaning independently from any concrete Markdown flavor. All renderer logic must consume normalized semantic nodes instead of source-specific or syntax-specific structures.


## What


The repository currently defines a custom Markdown intermediate representation for headings, paragraphs, inline emphasis and strong spans, code, links, dedicated xrefs with structured family metadata, images, hard and soft breaks, dedicated anchors, page-alias metadata, include-directive metadata with parsed selection semantics, diagnostics, and provenance, ordered and unordered lists, nested list items, thematic breaks, tables, block quotes, dedicated admonitions, dedicated callout lists, code blocks, raw HTML, footnote placeholders, and explicit unsupported nodes. Additional constructs should only land when conversion, normalization, rendering, and tests ship together.

The IR is semantic rather than textual. It expresses meaning such as admonition kind or heading depth without embedding flavor syntax. Transparent extensions such as fenced code blocks with `mermaid` or other authored language tags remain ordinary semantic `codeBlock` nodes rather than fallback artifacts.


## Why


Multiple Markdown flavors differ in syntax support and fallback behavior. A direct flavor-to-string approach would spread semantic decisions across renderers and make regressions hard to detect.


The IR isolates meaning from syntax, supports normalization, and makes the output contract testable.


## How


Define the canonical node types in `src/markdown/ir.ts`.


Run all source mappings through the IR before rendering. Apply normalization in `src/markdown/normalize.ts` before any flavor renderer runs, and lower xref targets through `src/markdown/xref-resolution.ts` before markdown link serialization.


Do not let renderers accept raw AsciiDoc AST nodes. Renderers only consume normalized IR.

Do not classify valid semantic nodes as fallback cases merely because the exporter does not interpret every downstream extension. Preserve them explicitly when the IR already represents them faithfully.


## Links


- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The pipeline feeds the IR boundary.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers depend on this invariant.
- [[Raw HTML is a controlled fallback not a default rendering path]] - HTML fallback must remain explicit and policy-bound at the render boundary.
- [[Transparent extensions are not fallback mechanisms]] - Valid semantic extensions remain inside the IR instead of bypassing it.
- [[Xref target resolution is a separate lowering phase]] - Target routing is a lowering concern, not a renderer-local one.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Snapshot tests validate the frozen render contract.
- src/markdown/ir.ts - Canonical semantic node definitions.
- src/markdown/normalize.ts - IR normalization pass.
