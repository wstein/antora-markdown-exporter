---
id: 20260422032500
aliases: ["Inline semantics come from assembler", "Do not reparse inline markup", "Assembler-owned inline semantics"]
tags: ["architecture", "antora", "asciidoctor", "inline", "exporter"]
target: current
---
Assembler-owned inline semantics should not be reparsed by the exporter because Antora and Asciidoctor already resolve most inline markup before the exporter boundary. The exporter should render the semantic nodes and honor Antora metadata such as structured xref and attribute information instead of pretending it is the primary inline parser.

## What

At the Antora extension boundary, inline content is mostly already parsed or resolved.

The exporter’s responsibility is to:

- consume assembler-provided inline semantics
- preserve and honor Antora xref and attribute metadata
- map those semantics into the repository’s Markdown IR
- render the resulting normalized IR faithfully

The exporter should not treat assembled content as an invitation to rebuild a full inline markup parser.

## Why

Reparsing inline markup after Asciidoctor and Antora have already interpreted it creates boundary confusion and raises the risk of semantic drift.

That drift is especially dangerous for:

- xref target metadata
- attribute-driven substitutions
- already-resolved inline structure that the exporter should preserve rather than reinterpret

Keeping inline ownership at the assembler boundary makes the exporter more honest about what it receives and narrows the semantic responsibilities that repository code must prove.

## How

Treat inline handling in the exporter as semantic mapping, not source-language reparsing.

When Antora or Asciidoctor provide structured xref, attribute, or inline-node metadata, prefer that metadata over heuristic string reparsing.

If a future extension requires new inline semantics, add them as explicit IR support rather than broadening ad-hoc inline reparsing rules.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The exporter starts after assembly, not before it.
- [[Markdown IR is the canonical render boundary]] - Inline meaning should land in IR rather than renderer-local heuristics.
- [[Xref target resolution is a separate lowering phase]] - Xref metadata should remain structured until lowering.
- src/adapter/asciidoctor-structure.ts - Structured extraction boundary for inline semantics.
- src/markdown/ir.ts - Canonical semantic representation.
