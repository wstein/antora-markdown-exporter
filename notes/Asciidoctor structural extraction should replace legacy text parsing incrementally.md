---
id: 20260422050500
aliases: ["Structural extraction replaces text parsing", "Phase 2 extractor boundary", "Asciidoctor extraction path"]
tags: ["architecture", "adapter", "asciidoctor", "exporter", "rewrite"]
target: current
---
Asciidoctor structural extraction should replace legacy text parsing incrementally because the repository can start using `Asciidoctor.load` to extract stable block structure now, even before every semantic family is fully lowered into Markdown IR. The important constraint is that each new structural slice expands the new path and reduces the legacy parser’s ownership.

## What

The repository now has a structured extraction phase that:

- loads assembled source through Asciidoctor
- walks the document structure
- maps supported blocks into repository-owned assembly adapter nodes
- marks unsupported structural contexts explicitly instead of silently folding them back into legacy parsing

## Why

The rewrite only becomes real when new supported behavior is sourced from structural extraction instead of the text parser.

An incremental structural extractor is acceptable if:

- it is explicit
- it is tested
- unsupported contexts stay visible
- it expands over time instead of coexisting forever as dead architecture

## How

Add extractor support by semantic family and prove each addition with dedicated tests.

Do not hide unsupported structural contexts behind fallback claims that make the extractor seem more complete than it is.

Use the repository-owned assembly adapter as the stable handoff into later Markdown IR lowering.

## Links

- [[Repository-owned assembly structure formalizes the exporter adapter boundary]] - The extractor lowers into the adapter contract.
- [[Structural document mapping is a desired internal adapter not the documented Assembler handoff]] - This is the first real implementation slice of that target design.
- src/adapter/asciidoctor-structure.ts - Asciidoctor-backed structured extraction path.
- tests/unit/asciidoctor-structure.test.ts - Extraction contract tests.
