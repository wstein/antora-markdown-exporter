---
id: 20260421082400
aliases: ["Human onboarding docs layer", "Narrative onboarding view", "Notes-first human interface"]
tags: ["docs", "onboarding", "notes", "architecture"]
target: current
---
Docs generation improves human onboarding without weakening notes-first governance because it gives contributors a readable architecture path while preserving the repository's discipline that durable architectural knowledge must originate in atomic notes.

## What

The repository uses atomic notes as a cognition layer for durable architectural intent.

Generated docs add a human-facing interface over that layer by:
- sequencing core notes into a readable order
- reducing navigation friction
- preserving authored technical meaning

This is a usability layer, not a governance replacement.

## Why

Human contributors often need a top-down explanation before they can work effectively with a graph of atomic constraints and invariants.

A generated architecture guide reduces this friction while still requiring all real design decisions to originate in the notes corpus.

## How

Start with one generated file:
- `docs/architecture.md`

Do not expand into a broad generated-docs system until that first document proves useful and stable.

Keep note creation mandatory for new architectural decisions even after generated docs exist.

## Links

- [[Generated docs are derived narrative views over canonical notes]] - Defines the relationship between notes and generated docs.
- [[Docs generation must sequence notes without inventing new meaning]] - Generated onboarding material must stay faithful to note content.
- notes/README.md - Notes-first workflow rules.
- docs/architecture.md - Human-facing onboarding view.
