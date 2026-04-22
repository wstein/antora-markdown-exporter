---
id: 20260421061000
aliases: ["Include marker transport", "Include metadata boundary", "Private include transport", "Include metadata transport is an internal implementation detail"]
tags: ["include", "exporter", "architecture", "internal"]
target: current
---
Preserved include metadata uses private transport details because the repository’s contract is include semantics, diagnostics, and provenance only when those surfaces are intentionally preserved for inspection, not any temporary representation used while moving that data through the structured conversion pipeline.

## What

The repository may use temporary internal representations to carry preserved include metadata through extraction and lowering when include diagnostics or provenance need to survive assembly.

That transport is intentionally private. The supported behavior is:
- include directives remain inspectable in the Markdown IR
- diagnostics survive expansion and normalization
- provenance remains available for validation and reporting

The exact transport shape must stay private and may change without affecting the public API.

## Why

If general conversion logic knows too much about the private marker shape, even small internal refactors become risky and noisy.

Isolating the transport keeps:
- include behavior stable while internals evolve
- tests focused on semantic outcomes rather than wire-format leakage
- future transport changes possible without rewriting unrelated parser code

## How

Keep any include metadata transport logic isolated behind one internal boundary.

Do not let renderer, inspection helpers, or general block parsing depend on raw marker syntax.

Preserve existing include semantics, diagnostics, and provenance when refactoring the transport layer.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Include transport sits inside the converter, not outside the pipeline boundary.
- [[Reference corpus should cover navigation xrefs includes and admonitions]] - Compatibility coverage should pin include behavior, not private marker syntax.
- src/markdown/include-diagnostics.ts - Public inspection surface for include diagnostics and surviving include metadata.
