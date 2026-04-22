---
id: 20260422125500
aliases: ["MultiMarkdown flavor target", "v0.7 MultiMarkdown note"]
tags: ["markdown", "flavors", "multimarkdown", "roadmap"]
target: current
---
MultiMarkdown should be tracked as a flavor target for v0.7 rather than treated as an immediate baseline change. It is a plausible downstream renderer target because it extends Markdown with additional document features such as tables, footnotes, citations, metadata, definition lists, image attributes, captions, and automatic cross references.

## What

For v0.7 planning:

- treat MultiMarkdown as an additional explicit flavor target
- add it deliberately through the existing flavor matrix
- require support-matrix and proof updates before calling it implemented

## Why

The repository already has a semantic pipeline that separates extraction, lowering, and rendering. MultiMarkdown fits that architecture as another output target rather than as a reason to change the upstream contract.

## Sources

- MultiMarkdown overview: https://fletcherpenney.net/multimarkdown/
- MultiMarkdown summary and feature list: https://en.wikipedia.org/wiki/MultiMarkdown

## Links

- [[Flavor renderers are syntax adapters over one semantic layer]] - MultiMarkdown belongs in the flavor layer.
- [[Markdown IR is the canonical render boundary]] - New flavors should arrive after semantic lowering.
