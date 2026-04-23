---
id: 20260421035500
aliases: ["Xref destinations", "Assembled href preservation", "Markdown xref destinations"]
tags: ["markdown", "xref", "routing", "architecture"]
target: current
---
Xref destinations come from assembled hrefs. Renderers should serialize the assembled hrefs they receive rather than reconstruct Antora routing logic after conversion.

## What

The repository preserves structured xref metadata in the Markdown IR while carrying the assembled href through conversion and rendering.

The renderer is responsible for Markdown link syntax, not for rebuilding destination routing policy.

## Why

When xref routing logic is reconstructed after assembly, the exporter starts fighting Antora and Asciidoctor.

Keeping assembled destinations intact keeps:
- the converter aligned with the assembled source buffer
- renderer logic narrower
- structured target metadata available for inspection without inventing a second routing contract

## How

Keep structured xref target metadata in `src/markdown/ir.ts`.

Serialize destinations in `src/markdown/render/markdown.ts` using the assembled href already carried by `MarkdownXref.url`.

Do not add a second Antora-aware routing layer after assembly.

## Links

- [[Markdown IR is the canonical render boundary]] - Xref metadata survives until rendering.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers should consume preserved destinations, not own route policy.
- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Destination routing stops at the assembled-source boundary.
- src/markdown/render/markdown.ts - Markdown link serialization over preserved destinations.
