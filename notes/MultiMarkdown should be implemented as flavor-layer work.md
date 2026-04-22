---
id: 20260422125700
aliases: ["MultiMarkdown renderer-layer note", "Flavor-layer MultiMarkdown support"]
tags: ["markdown", "flavors", "multimarkdown", "architecture", "renderer"]
target: current
---
If the repository adds MultiMarkdown support, it should be implemented as flavor-layer work over the existing structured pipeline instead of as extractor-local or parser-local behavior.

## What

MultiMarkdown support should flow through:

- assembly structure
- Markdown IR
- flavor-specific rendering

## Why

The repository already treats Markdown IR as the canonical render boundary and flavor renderers as syntax adapters over one semantic layer. That means MultiMarkdown should be expressed as renderer differences wherever possible, while the adapter and lowering layers remain flavor-agnostic.

## How

When MultiMarkdown work starts:

- add it as a named flavor beside GFM
- prove it with focused renderer tests and fixtures
- update the support matrix with flavor-specific status
- avoid pushing flavor-specific quirks down into extraction unless the semantic model truly needs to grow

## Links

- [[Markdown IR is the canonical render boundary]] - Flavor expansion should happen after semantic lowering.
- [[Flavor renderers are syntax adapters over one semantic layer]] - The renderer layer is the right home for MultiMarkdown differences.
- [[Repository-owned assembly structure formalizes the exporter adapter boundary]] - New flavor work should continue to honor the adapter contract.
