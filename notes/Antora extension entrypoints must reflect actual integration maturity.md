---
id: 20260420194300
aliases: ["Extension maturity signaling", "Antora entrypoint honesty", "Scaffold boundary note"]
tags: ["architecture", "antora", "extension", "naming"]
target: current
---
Antora extension entrypoints must reflect actual integration maturity because public names that imply real Antora integration should either remain explicitly scaffolded or implement the real Antora registration contract. Honest boundary naming improves review accuracy and reduces future churn.

## What

An extension boundary is acceptable in two states:
- explicitly scaffolded with names that say so, or
- implemented as a real Antora extension registration contract

The repository now ships the second state. `src/extension/index.ts` exports `register()` and delegates to `@antora/assembler.configure()` with the repository’s Markdown converter.

## Why

Overstated naming creates false confidence in integration completeness and makes later code review harder. It also weakens the usefulness of architecture notes because the code appears more mature than it is.

Clear maturity signaling supports honest incremental delivery.

## How

Name placeholder helpers explicitly until the real Antora registration contract lands, then replace them with a real implementation in the public package surface.

Document the current maturity level in README and notes, and once the real integration lands, update those materials promptly so they stop describing a scaffold that no longer exists.

Do not let public package examples suggest full Antora behavior before the implementation exists.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The real integration boundary described by the architecture.
- README.md - Public-facing usage examples must match real maturity.
- src/extension/index.ts - Real Assembler-backed extension entrypoint.
