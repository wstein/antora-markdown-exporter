---
id: 20260422181500
title: Inspection reports should provide deterministic RAG inputs
target: current
---

# Inspection reports should provide deterministic RAG inputs

## Summary

Inspection reports should provide deterministic RAG inputs because agentic consumers need a stable, reviewable semantic surface for Antora-derived Markdown structure rather than ad-hoc prompt parsing over rendered prose.

## What

The existing normalized inspection surface should grow into an agent-oriented export shape that stays:

- deterministic across runs
- derived from normalized Markdown semantics
- narrow enough for retrieval and prompt assembly
- explicit about xrefs, targets, and source identity

This work should extend `collectMarkdownInspectionReport` and adjacent inspection helpers rather than creating an unrelated agent-only parser.

## Why

If LLM and RAG workflows consume only rendered Markdown:

- routing metadata becomes harder to recover
- semantic drift hides behind formatting noise
- retrieval quality depends on prompt heuristics instead of explicit structure
- repository tests cannot pin the agent-facing contract cleanly

Using the normalized inspection surface as the base keeps agentic integrations inspectable, deterministic, and testable.

## How

Prefer additions that:

- normalize before producing agent-facing output
- preserve source identifiers, xref targets, and document order
- serialize to stable text or data structures that snapshot tests can compare exactly
- reuse `collectMarkdownInspectionReport` rather than duplicating traversal logic

Do not build agent-specific semantics by reparsing rendered Markdown strings when the normalized report already carries the needed structure.

## Links

- [[Inspection helpers expose normalized validation surfaces]] - Reusable inspection surfaces are the right extension point.
- [[Markdown IR is the canonical render boundary]] - Agent inputs should come from normalized semantics.
- src/markdown/inspection.ts - Current inspection surface.
- scripts/inspection-report.ts - Existing machine-readable reporting entrypoint.
