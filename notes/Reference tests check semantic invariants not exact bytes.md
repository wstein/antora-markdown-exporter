---
id: 20260420193700
aliases: ["Semantic invariant reference tests", "Reference assertions", "Compatibility invariants"]
tags: ["testing", "invariants", "compatibility", "markdown"]
target: current
---
Reference tests check semantic invariants rather than exact byte output because external documentation corpora are best used to validate robustness, structural preservation, and fallback behavior, not to replace deterministic local golden fixtures.

## What

Reference tests assert durable properties such as:
- export completes without internal errors
- section hierarchy remains coherent
- links and images are preserved or degraded explicitly
- unsupported constructs emit visible fallback markers
- selected semantic counts or markers remain stable

These tests may also compare normalized summaries instead of full rendered files.

## Why

Exact-output snapshots for large external corpora are brittle and expensive to maintain. The value of reference testing is broad semantic coverage, not byte-level identity.

This keeps the reference suite informative without turning every upstream authoring change into a noisy test failure.

## How

Implement semantic assertions in `tests/integration/reference-antora.test.ts` and keep byte-exact assertions in local fixture golden tests.

Where exact comparisons are still useful, compare reduced normalized forms rather than raw output unless the case is intentionally frozen.

Do not let reference tests silently accept content loss. They must still fail on missing sections, broken links, or unmarked unsupported drops.

## Links

- [[Reference testing uses official Antora documentation as a compatibility corpus]] - Defines the purpose of the corpus.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Separates exact-output tests from semantic compatibility tests.
- src/markdown/fallback.ts - Unsupported constructs must stay visible.
- tests/integration/reference-antora.test.ts - Semantic compatibility assertions.
