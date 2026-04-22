---
id: 20260420193800
aliases: ["Reference corpus coverage model", "Antora feature coverage", "Compatibility coverage targets"]
tags: ["testing", "coverage", "antora", "fixtures"]
target: current
---
The reference corpus should be selected to cover navigation structure, xrefs, includes, anchors, page aliases, admonitions, tables, images, and unsupported constructs because those features create most of the exporter’s real-world compatibility pressure. Coverage quality matters more than corpus size.

## What

Reference cases should deliberately represent the highest-value Antora authoring patterns, including:
- navigation-driven section ordering
- mixed ordered and unordered list hierarchies
- intra-page and inter-page xrefs, including component/module/version-qualified targets and cases where page, image, attachment, example, and partial families differ by output policy
- anchors and page-alias metadata
- include-heavy pages where the repository intentionally preserves include semantics, diagnostics, or provenance for inspection
- admonitions and block variants
- code listings and callout-adjacent structures
- tables and images
- cases that must degrade visibly

## Why

A large but uncurated corpus can still miss the document shapes most likely to break rendering. Coverage should be guided by exporter risk rather than repository size.

This keeps the suite small enough to review and broad enough to be meaningful.

## How

Tag each reference case with one or more coverage themes and track them in a simple manifest.

Prefer a small curated matrix of representative cases over a full mirror of upstream docs.

Refresh the coverage plan when a new renderer feature or regression class appears.

## Links

- [[Reference fixtures are curated and provenance locked]] - Curation policy keeps the corpus reproducible.
- [[Reference tests check semantic invariants not exact bytes]] - Coverage themes guide compatibility assertions.
- [[Preserved include metadata uses private transport details]] - Reference cases should pin include semantics, not the private marker transport.
- tests/reference/manifest.json - Coverage tags and provenance.
- tests/fixtures - Local exact-output fixtures for reduced cases.
