---
id: 20260422043000
aliases: ["Assembly structure adapter boundary", "Repository-owned assembler adapter", "Structured assembly contract"]
tags: ["architecture", "adapter", "assembler", "exporter", "ir"]
target: current
---
Repository-owned assembly structure formalizes the exporter adapter boundary because the repository needs a stable internal contract between assembled Antora input and Markdown IR lowering. That contract should be owned here rather than implied by text parsing helpers or assumed to be identical to any one upstream API.

## What

The repository now defines an explicit structured assembly contract that:

- represents assembler-produced document structure in repository-owned types
- preserves metadata needed for Markdown lowering such as headings, lists, admonitions, tables, xrefs, anchors, and page aliases
- remains distinct from both raw assembled source text and final Markdown IR

This adapter contract is the intended handoff into future structured lowering code.

## Why

Without a repository-owned adapter boundary:

- the exporter drifts toward direct text parsing again
- structural refactors remain underspecified
- contributors cannot tell whether a change belongs to extraction, mapping, lowering, or rendering

An explicit adapter type makes the rewrite measurable. It lets the repository delete the legacy parser later without losing a stable description of what the exporter is supposed to consume.

## How

Keep the structured assembly contract in a dedicated module and test it directly.

Extend it only when:

- the extractor can produce the new structure
- the Markdown IR lowering can consume it
- tests and support claims are updated together

Do not treat the adapter as a hidden alias for Markdown IR or as a disguised continuation of the text parser.

## Links

- [[Assembler custom exporters receive assembled AsciiDoc source buffers]] - The external handoff is still assembled source, not this internal adapter.
- [[Structural document mapping is a desired internal adapter not the documented Assembler handoff]] - This note defines that desired internal stage concretely.
- [[Markdown IR is the canonical render boundary]] - The adapter lowers into IR rather than replacing it.
- src/adapter/assembly-structure.ts - Repository-owned structured assembly contract.
- tests/unit/assembly-structure.test.ts - Contract tests for the adapter.
