---
id: 20260421035500
aliases: ["Xref lowering phase", "Xref routing boundary", "Markdown xref resolution"]
tags: ["markdown", "xref", "routing", "architecture"]
target: current
---
Xref target resolution is a separate lowering phase because Antora-aware destination shaping is semantic policy, not string-formatting work. Renderers should serialize resolved destinations rather than own routing logic directly.

## What

The repository preserves structured xref metadata in the Markdown IR and then lowers that metadata into a concrete destination path in `src/markdown/xref-resolution.ts`.

That lowering step is responsible for:
- source-shaped vs site-shaped routing
- family-aware routing for page, image, attachment, and example targets
- ROOT-module omission when a site flavor requires it
- fallback to source-shaped destinations for unknown families

The renderer then formats the already-resolved destination as Markdown link syntax.

## Why

When xref routing logic lives inside a string renderer, it becomes hard to test, hard to reuse, and easy to couple to unrelated formatting concerns.

Separating the lowering phase keeps:
- routing policy testable in direct unit assertions
- renderer logic narrower
- Antora-specific semantics inspectable after conversion

## How

Keep structured xref target metadata in `src/markdown/ir.ts`.

Resolve destinations through `src/markdown/xref-resolution.ts` before link serialization in `src/markdown/render/markdown.ts`.

Do not duplicate family routing or ROOT-module omission logic in multiple renderers.

## Links

- [[Markdown IR is the canonical render boundary]] - Xref metadata survives until the lowering phase.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers should consume resolved destinations, not own route policy.
- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Xref lowering happens after conversion, before final markdown emission.
- src/markdown/xref-resolution.ts - Canonical xref destination lowering logic.
