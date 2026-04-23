---
id: 20260422043000
aliases: ["Assembly structure adapter boundary", "Repository-owned assembler adapter", "Structured assembly contract"]
tags: ["architecture", "adapter", "assembler", "exporter", "ir"]
target: current
---
Repository-owned assembly structure formalizes the exporter adapter boundary because the repository needs a stable internal contract between assembled Antora input and Markdown IR conversion. That contract should be owned here rather than implied by text parsing helpers or assumed to be identical to any one upstream API.

## What

The repository now defines an explicit structured assembly contract that:

- represents assembler-produced document structure in repository-owned types
- preserves metadata needed for Markdown conversion such as headings, lists, admonitions, tables, xrefs, anchors, and page aliases
- remains distinct from both raw assembled source text and final Markdown IR

This adapter contract is the intended handoff into future structured conversion code.

The contract now also publishes explicit invariants in `src/adapter/assembly-structure.ts` for:

- repository-owned boundary semantics
- explicit loss rules
- best-effort source-location expectations
- unsupported-node behavior
- deterministic inline fallback rules

It also now ships a formal typed specification in `src/adapter/assembly-structure-spec.ts` and exports that specification from the package root. That makes the adapter boundary auditable through code, package exports, and tests at the same time.

## Why

Without a repository-owned adapter boundary:

- the exporter drifts toward direct text parsing again
- structural refactors remain underspecified
- contributors cannot tell whether a change belongs to extraction, mapping, conversion, or rendering

An explicit adapter type makes the rewrite measurable. It lets the repository delete the legacy parser later without losing a stable description of what the exporter is supposed to consume.

## How

Keep the structured assembly contract in a dedicated module and test it directly.

Treat `assemblyStructureInvariants` as the review checklist for extractor and conversion changes. If a change weakens one of those invariants, update the contract, support matrix, and proof surface together instead of relying on implementation drift.

Treat `assemblyStructureSpecification` as the higher-level statement of scope and review rules. The invariants capture the enforceable contract points; the specification explains how those points fit together and why helper-module changes must stay aligned with them.

Extend it only when:

- the extractor can produce the new structure
- the Markdown IR conversion can consume it
- tests and support claims are updated together

Do not treat the adapter as a hidden alias for Markdown IR or as a disguised continuation of the text parser.

## Links

- [[Assembler custom exporters receive assembled AsciiDoc source buffers]] - The external handoff is still assembled source, not this internal adapter.
- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The adapter sits between assembled source and Markdown IR conversion.
- [[Markdown IR is the canonical render boundary]] - The adapter lowers into IR rather than replacing it.
- src/adapter/assembly-structure.ts - Repository-owned structured assembly contract.
- src/adapter/assembly-structure-spec.ts - Formal typed specification for the adapter contract.
- src/adapter/asciidoctor-structure.ts - Structured extractor entrypoint over the repository-owned contract.
- tests/unit/assembly-structure.test.ts - Contract tests for the adapter.
