---
id: 20260421082000
aliases: ["Derived docs policy", "Notes to docs generation rule", "Canonical notes derived docs"]
tags: ["docs", "notes", "architecture", "governance"]
target: current
---
Generated docs are derived narrative views over canonical notes because the repository's atomic notes remain the source of truth for durable architectural knowledge, while human contributors still need a linear reading path that the raw notes graph does not provide naturally.

## What

The repository may generate human-readable documents such as `docs/architecture.md` from curated note sets in `notes/**`.

The generated document is:
- read-only
- derived from canonical notes
- intended for human onboarding and review
- not a second source of truth

The canonical source remains the note corpus.

## Why

The notes graph is excellent for precision, auditability, and machine reuse, but it is harder for human contributors to consume as a sequential architecture narrative.

A derived document solves the onboarding problem without weakening the notes-first workflow or duplicating architectural truth in multiple hand-maintained places.

## How

Generate architecture documents from note files only.

Do not generate them from:
- code comments
- README fragments
- ad hoc summaries
- AI-authored paraphrases

Every generated document must clearly state that:
- it is derived
- notes remain canonical
- direct edits should be made in `notes/**`

## Links

- [[Strict architecture must be extended without weakening invariants]] - Derived docs extend usability without weakening repository invariants.
- [[Repository scripts and referenced files must stay in lockstep]] - Generated docs must stay synchronized with canonical inputs.
- notes/README.md - Notes-first governance source.
- docs/architecture.md - Generated narrative architecture view.
- scripts/generate-architecture-docs.ts - Docs generation entrypoint.
