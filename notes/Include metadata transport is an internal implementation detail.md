---
id: 20260421061000
aliases: ["Include marker transport", "Include metadata boundary", "Private include transport"]
tags: ["include", "exporter", "architecture", "internal"]
target: current
---
Include metadata transport is an internal implementation detail because the repository’s contract is include semantics, diagnostics, and provenance, not the specific marker shape used while moving that metadata through the converter pipeline.

## What

The converter currently uses an HTML comment transport to carry include-directive metadata through assembled content until it is rehydrated as semantic IR nodes.

That transport is intentionally private. The supported behavior is:
- include directives remain inspectable in the Markdown IR
- diagnostics survive expansion and normalization
- provenance remains available for validation and reporting

The exact wire format is isolated in `src/exporter/include-metadata.ts`.

## Why

If general conversion logic knows too much about the private marker shape, even small internal refactors become risky and noisy.

Isolating the transport keeps:
- include behavior stable while internals evolve
- tests focused on semantic outcomes rather than wire-format leakage
- future transport changes possible without rewriting unrelated parser code

## How

Keep marker encode/decode logic in one internal module.

Do not let renderer, inspection helpers, or general block parsing depend on raw marker syntax.

Preserve existing include semantics, diagnostics, and provenance when refactoring the transport layer.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Include transport sits inside the converter, not outside the pipeline boundary.
- [[Reference corpus should cover navigation xrefs includes and admonitions]] - Compatibility coverage should pin include behavior, not private marker syntax.
- src/exporter/include-metadata.ts - Private include transport implementation.
