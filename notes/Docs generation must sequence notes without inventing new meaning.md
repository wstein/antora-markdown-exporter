---
id: 20260421082100
aliases: ["No-summary docs generation", "Narrative sequencing rule", "Notes sequencing without reinterpretation"]
tags: ["docs", "notes", "generation", "governance"]
target: current
---
Docs generation must sequence notes without inventing new meaning because the purpose of the generated architecture guide is to improve human readability, not to reinterpret or replace the repository's canonical design decisions.

## What

The docs generator produces a linear narrative by:
- selecting curated notes
- ordering them deterministically
- reusing their authored text
- grouping them into a readable structure

The generator must not:
- summarize with AI
- rewrite architectural decisions
- compress multiple notes into new undocumented claims
- infer unstated relationships as facts

## Why

The note corpus already contains the durable reasoning. A generator that reinterprets or paraphrases those notes would create a shadow architecture document with its own semantic drift.

This would break the repository's notes-first model and undermine trust in both the notes and the generated docs.

## How

Use note titles, tags, and a deterministic ordering strategy to assemble a human-readable document.

Prefer exact note text or lightly transformed section framing over paraphrase.

If connective framing is needed, keep it minimal and generic, and never let it introduce new technical claims.

## Links

- [[Generated docs are derived narrative views over canonical notes]] - Defines the role of generated docs relative to canonical notes.
- [[Notes-first workflow]] - The generator must respect the upstream intent model.
- docs/architecture.md - Generated output must remain faithful to note content.
- scripts/generate-architecture-docs.ts - Sequencing implementation.
