---
id: 20260422035600
aliases: ["Structural doc adapter", "Desired internal adapter stage", "AST target pipeline"]
tags: ["architecture", "antora", "asciidoctor", "adapter", "ir"]
target: current
---
Structural document mapping is a desired internal adapter not the documented Assembler handoff because the cleanest long-term repository design may introduce an `asciidoctor.load` or equivalent structural stage after assembly, but that stage is an internal architecture goal rather than the current documented exporter extension interface.

## What

The desired internal target pipeline is:

- `adoc` files
- Assembler
- assembled AsciiDoc
- structural document adapter
- Markdown IR
- Markdown renderer

In that design, the exporter no longer behaves like a low-level line parser over assembled source. Instead, it maps a structural document representation into the repository’s Markdown IR.

## Why

This architecture is attractive because it:

- narrows semantic drift from source-level reparsing
- makes block and inline ownership clearer
- fits better with the repository’s IR-first design
- creates a cleaner seam for preserving Antora and Asciidoctor metadata

But it must be described honestly as a target design, not as an already-provided upstream boundary.

## How

When discussing future refactors, distinguish:

- current documented handoff: assembled AsciiDoc source buffer
- desired internal adapter: structural document mapping stage

If the repository adopts this adapter, ship it as an explicit architectural change with:

- dedicated tests for parity
- updated support-matrix entries
- documentation updates that describe the new boundary precisely

## Links

- [[Assembler custom exporters receive assembled AsciiDoc source buffers]] - The external handoff is still source-buffer based.
- [[Markdown IR is the canonical render boundary]] - The structural adapter should lower into IR, not bypass it.
- [[Block structure is owned by the assembler not the exporter]] - The adapter should preserve assembler-owned structure instead of reparsing it loosely.
- [[Assembler-owned inline semantics should not be reparsed by the exporter]] - Inline meaning should move through explicit structure when available.
