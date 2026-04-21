---
id: 20260421082200
aliases: ["Curated note ordering", "Docs generation ordering policy", "Architecture doc sequencing"]
tags: ["docs", "architecture", "ordering", "notes"]
target: current
---
Architecture docs should be generated from a curated note order because timestamps and raw graph traversal alone do not guarantee a useful narrative flow for human readers.

## What

The generated architecture guide should follow an explicit order of topics, such as:
- project purpose and pipeline
- canonical IR boundary
- renderer and flavor model
- fallback policy
- xref lowering
- include handling
- testing and validation
- release and tooling

This order exists to support human comprehension, not to redefine technical dependencies.

## Why

Atomic notes are optimized for precision and local clarity, not necessarily for linear reading order. A human-readable architecture guide needs a stable, intentional narrative path.

Relying only on timestamps, filename sorting, or unconstrained graph traversal would produce unstable or confusing output.

## How

Define one deterministic generation order using one of these mechanisms:
- an explicit note list in generator configuration
- a document profile file
- a stable frontmatter ordering key

Do not rely solely on note timestamps for architecture sequencing.

## Links

- [[Generated docs are derived narrative views over canonical notes]] - Generated docs need a stable human-facing structure.
- [[Docs generation must sequence notes without inventing new meaning]] - Ordering should improve readability without changing meaning.
- docs/architecture.md - Ordered architecture output.
- scripts/generate-architecture-docs.ts - Curated ordering logic.
