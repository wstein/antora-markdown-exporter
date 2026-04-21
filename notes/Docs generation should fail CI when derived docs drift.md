---
id: 20260421082300
aliases: ["Generated docs drift check", "CI guard for generated docs", "Derived docs staleness rule"]
tags: ["docs", "ci", "governance", "automation"]
target: current
---
Docs generation should fail CI when derived docs drift because a generated architecture guide is only useful if it stays synchronized with the canonical notes that define the repository's architectural truth.

## What

When generated docs are committed to the repository, CI should verify that:
- regeneration produces no diff
- the committed output matches current canonical notes
- stale generated files are rejected

This drift check is a synchronization guard, not a content-quality review.

## Why

A stale generated document gives contributors a false sense of architectural accuracy. That is worse than having no generated document at all.

If notes are canonical and docs are derived, the repository must enforce that relationship mechanically.

## How

Add a generation command such as:
- `bun run docs:generate`

Then add a CI step that:
- regenerates docs
- checks for a clean diff
- fails if committed generated output is stale

Keep the drift check narrow and deterministic.

## Links

- [[Generated docs are derived narrative views over canonical notes]] - Drift checks protect the canonical/derived relationship.
- [[Repository scripts and referenced files must stay in lockstep]] - Generated docs are part of repository self-consistency.
- .github/workflows/ci.yml - CI enforcement point.
- scripts/generate-architecture-docs.ts - Generation command implementation.
