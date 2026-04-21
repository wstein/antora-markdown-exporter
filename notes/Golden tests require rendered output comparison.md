---
id: 20260420194200
aliases: ["Real golden tests", "Rendered output comparison", "Golden contract requirement"]
tags: ["testing", "golden", "renderer", "contracts"]
target: current
---
Golden tests require rendered output comparison because a fixture test is not a golden test unless it renders the target output and compares it against an expected artifact. Loading a fixture without exact-output assertion only proves fixture plumbing.

## What

A true golden test for this repository must:
- convert source input into Markdown IR
- normalize the IR
- render Markdown for a chosen flavor
- compare the full rendered output against `expected.<flavor>.md`

Ancillary assertions about node kinds or titles are useful, but they do not replace the exact-output contract.

## Why

The repository’s core value is deterministic Markdown output. Regressions often appear in whitespace, escaping, fallback markers, heading structure, and flavor syntax rather than in broad structural shape.

Only exact-output comparisons make those regressions visible and reviewable.

## How

Keep the current integration fixture layout, but add at least one real renderer and compare exact output in `tests/integration/fixture-golden.test.ts`.

Use local fixtures for byte-exact expectations and reserve external reference corpora for semantic compatibility assertions.

Do not label a test as golden if it does not compare rendered output.

## Links

- [[Testing relies on golden fixtures and deterministic snapshots]] - Defines the repository-wide testing contract.
- [[Reference tests check semantic invariants not exact bytes]] - Distinguishes golden tests from reference compatibility tests.
- tests/integration/fixture-golden.test.ts - Golden comparison entrypoint.
- tests/fixtures - Expected output fixtures.
