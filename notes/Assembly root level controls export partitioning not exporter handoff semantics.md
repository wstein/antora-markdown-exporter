---
id: 20260422035700
aliases: ["root_level is partitioning", "Assembly partitioning boundary", "root_level does not imply AST handoff"]
tags: ["architecture", "antora", "assembler", "configuration", "scope"]
target: current
---
Assembly root level controls export partitioning not exporter handoff semantics because the `assembly.root_level` setting determines where assemblies start in the navigation tree, but it does not change the fundamental data format passed to the exporter.

## What

The `root_level` assembly setting controls whether Assembler produces:

- one assembly for the whole navigation model
- or one assembly per top-level navigation entry

For example:

- `root_level: 0` means a single assembly
- `root_level: 1` means an assembly per top-level navigation entry

This changes assembly scope and output partitioning, not the handoff contract itself.

## Why

It is easy to over-read `root_level: 1` as evidence of a richer exporter boundary because the output shape becomes more modular.

But that configuration only changes:

- how content is grouped into assemblies
- where output boundaries begin
- how many exported documents are produced

It does not, by itself, imply an AST or structural-document handoff to the exporter.

## How

Describe `root_level` as an assembly modeling and export partitioning choice.

Do not use it as evidence that the exporter receives:

- parsed block trees
- parsed inline nodes
- a structural document API

Any such structural stage would need separate architecture, code, and proof surfaces.

## Links

- [[Assembler custom exporters receive assembled AsciiDoc source buffers]] - `root_level` changes scope, not the handoff type.
- [[Structural document mapping is a desired internal adapter not the documented Assembler handoff]] - Structural mapping is a separate design decision.
- docs/modules/manual/pages/index.adoc - Operator-facing workflow and support boundaries.
- https://docs.antora.org/assembler/latest/configure-assembly/ - `root_level` assembly configuration reference.
