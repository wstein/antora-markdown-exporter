---
id: 20260420193300
aliases:
  - Golden fixture testing
  - Deterministic snapshot testing
  - Render contract tests
tags:
  - testing
  - vitest
  - snapshots
  - determinism
---
Testing relies on golden fixtures and deterministic snapshots because Markdown export regressions are easiest to detect at the exact-output boundary. Structural tests remain useful, but the frozen render contract is enforced through fixture-based expected outputs.


## What


The repository uses Vitest for unit, integration, and golden-output tests. Each fixture contains one AsciiDoc input and one expected Markdown output per supported flavor.


The test suite separates concerns:
- unit tests for IR nodes and normalization
- renderer tests for flavor behavior
- integration tests for exporter wiring
- fixture golden tests for exact output


## Why


A Markdown exporter can appear correct while drifting in whitespace, fallback behavior, escaping, or flavor-specific syntax. Exact-output fixtures make those regressions visible and reviewable.


This also supports deterministic CI and safer refactoring.


## How


Place fixtures under `tests/fixtures/**` with `input.adoc` and `expected.<flavor>.md` files.


Use `vitest.config.ts` with `@vitest/coverage-v8` and keep render tests stable enough to run in CI without regeneration side effects.


Do not rely only on broad smoke tests.


## Links


- [[Markdown IR is the canonical render boundary]] - Normalized IR is what the render contract tests exercise.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Each flavor needs explicit golden outputs.
- src/markdown/normalize.ts - Normalization behavior needs unit coverage.
- tests/integration/fixture-golden.test.ts - Exact-output contract tests.
- vitest.config.ts - Coverage and test configuration.
