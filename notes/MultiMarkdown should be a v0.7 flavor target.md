---
id: 20260422125500
aliases: ["MultiMarkdown flavor target", "v0.7 MultiMarkdown note", "Supported MultiMarkdown flavor"]
tags: ["markdown", "flavors", "multimarkdown", "roadmap"]
target: current
---
MultiMarkdown is now a supported flavor profile in the repository, but it still should not be treated as a baseline replacement for GFM. It fits the exporter because it extends Markdown with additional document features such as tables, footnotes, citations, metadata, definition lists, image attributes, captions, and automatic cross references.

## What

For the current implementation:

- treat MultiMarkdown as an additional explicit flavor target beside GFM
- keep it inside the existing flavor matrix rather than inventing a separate conversion path
- require support-matrix and proof updates when expanding or tightening MultiMarkdown behavior

## Why

The repository already has a semantic pipeline that separates extraction, lowering, and rendering. MultiMarkdown fits that architecture as another output target rather than as a reason to change the upstream contract or default operator expectations.

## Sources

- MultiMarkdown overview: https://fletcherpenney.net/multimarkdown/
- MultiMarkdown summary and feature list: https://en.wikipedia.org/wiki/MultiMarkdown

## Links

- [[Flavor renderers are syntax adapters over one semantic layer]] - MultiMarkdown belongs in the flavor layer.
- [[Markdown IR is the canonical render boundary]] - New flavors should arrive after semantic lowering.
