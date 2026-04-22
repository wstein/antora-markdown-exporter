---
id: 20260422032700
aliases: ["Assembler-owned block structure", "Do not parse blocks twice", "Block mapping boundary"]
tags: ["architecture", "antora", "blocks", "exporter", "ir"]
target: current
---
Block structure is owned by the assembler not the exporter because Antora and Asciidoctor produce the document’s block organization before the exporter stage. The exporter’s job is to map those block nodes into the Markdown IR and render them, not to behave like a second low-level block parser.

## What

The assembler and parser are responsible for producing document block structure such as:

- sections and headings
- paragraphs
- lists
- block quotes
- source blocks
- admonitions
- tables

The exporter should then:

- receive that block structure
- map it into repository-owned Markdown semantic nodes
- normalize the IR
- render by flavor

That is a mapping boundary, not a second parsing frontier.

## Why

If the exporter treats assembled content as raw source to parse again, it blurs component ownership and makes it harder to know which layer is responsible for behavior changes or regressions.

Clear block ownership improves:

- architectural honesty
- testability
- future AST-based integration paths
- separation between Antora-facing assembly and repository-owned markdown rendering

## How

Describe exporter behavior as block mapping rather than low-level block parsing.

When richer block semantics are needed, extend the IR and the mapping layer together rather than adding broad text-level reparsing rules that duplicate assembler responsibilities.

If a future implementation consumes a richer Asciidoctor or Antora AST surface directly, keep the Markdown IR as the contract and swap the mapping input, not the render boundary.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The assembly stage comes before repository-owned mapping.
- [[Markdown IR is the canonical render boundary]] - Block meaning should be represented semantically before rendering.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers should not inherit parser responsibilities.
- docs/modules/architecture/partials/05_building_block_view.adoc - Building-block description for the converter boundary.
- src/markdown/ir.ts - Repository-owned block semantics.
