---
id: 20260421071300
aliases: ["Explicit extension principle", "No implicit degradation rule"]
tags: ["architecture", "philosophy", "rendering"]
target: current
---
The architecture favors explicit extension over implicit degradation because preserving valid author intent is more valuable than forcing all constructs into a reduced common denominator.

## What

When the system encounters constructs outside the core Markdown model:

- it prefers preserving them explicitly where safe
- instead of degrading them silently

This applies especially to:
- fenced language blocks such as `mermaid`

## Why

Implicit degradation:
- hides intent
- creates inconsistent output
- breaks downstream tooling

Explicit extension:
- preserves information
- remains deterministic
- allows downstream systems to add value

## How

Prefer:

- preserving semantic nodes
- preserving language identifiers
- using fallback only when necessary

Avoid:

- rewriting valid constructs
- implicit conversions
- lossy normalization

## Links

- [[Strict architecture must be extended without weakening invariants]]
- [[Transparent fenced extensions preserve authored language semantics]]
