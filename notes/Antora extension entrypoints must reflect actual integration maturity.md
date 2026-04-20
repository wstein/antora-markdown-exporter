---
id: 20260420194300
aliases: ["Extension maturity signaling", "Antora entrypoint honesty", "Scaffold boundary note"]
tags: ["architecture", "antora", "extension", "naming"]
target: v0.1
---
Antora extension entrypoints must reflect actual integration maturity because public names that imply real Antora integration should not wrap placeholder objects without clearly signaling scaffold status. Honest boundary naming improves review accuracy and reduces future churn.

## What

A placeholder extension helper is acceptable in an early scaffold, but it should either:
- be named as a scaffold helper, or
- implement the actual Antora extension registration contract

Public names such as `registerAntoraExtension` imply stronger semantics than a plain metadata-returning helper.

## Why

Overstated naming creates false confidence in integration completeness and makes later code review harder. It also weakens the usefulness of architecture notes because the code appears more mature than it is.

Clear maturity signaling supports honest incremental delivery.

## How

Name the current helper as an explicit scaffold until the real Antora registration contract lands, or replace it with a real Antora extension registration implementation as the next vertical slice.

Document the current maturity level in README and notes until the real integration lands.

Do not let public package examples suggest full Antora behavior before the implementation exists.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The real integration boundary described by the architecture.
- README.md - Public-facing usage examples must match real maturity.
- src/extension/index.ts - Current scaffolded extension entrypoint.
