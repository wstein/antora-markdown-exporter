---
id: 20260422032600
aliases: ["Assembler-resolved includes", "Includes are resolved before export", "Include metadata and diagnostics boundary", "Assembler-resolved includes only need exporter handling for metadata and diagnostics"]
tags: ["architecture", "antora", "include", "exporter", "inspection"]
target: current
---
Assembler-resolved includes narrow exporter responsibilities because an Antora extension normally sees included content already expanded into the assembled page. The exporter only needs include-specific logic when the repository deliberately preserves include-directive metadata or emits diagnostics about include selectors and provenance.

## What

At the normal Antora extension boundary:

- `include::[]` content has already been assembled into the document
- the exporter usually receives the expanded page content, not the original include directive as an unresolved authoring construct

Exporter-specific include handling is still useful when the repository wants to preserve:

- include-directive metadata
- any selector semantics that are intentionally retained for inspection
- diagnostics about malformed selectors
- provenance for validation or inspection output

## Why

This boundary keeps include support honest.

Without it, the exporter can over-claim responsibility for include expansion even though Antora Assembler already owns the primary include-resolution step. At the same time, the repository still needs a clear place to preserve or inspect include-related metadata when that behavior is part of the contract.

The distinction is:

- Antora owns normal include expansion
- the exporter may own include metadata retention and reporting

## How

Do not model include expansion as though the exporter were a general replacement for Assembler behavior.

When include behavior matters after assembly, keep the contract focused on:

- metadata preservation
- diagnostics
- provenance
- inspection-friendly IR nodes

Keep any transport used for that metadata private and isolated.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Include expansion belongs on the Assembler side of the boundary.
- [[Preserved include metadata uses private transport details]] - Marker transport is private even when include semantics are public.
- [[Inspection helpers expose normalized validation surfaces]] - Diagnostics and provenance should surface through normalized inspection outputs.
- src/markdown/inspection.ts - Public inspection surface for xref inspection.
