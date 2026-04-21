---
id: 20260421071000
aliases: ["Controlled escape hatches principle", "Strictness versus pragmatism resolution", "Extend without relaxing invariants"]
tags: ["architecture", "philosophy", "invariants", "design"]
target: current
---
Strict architecture must be extended without weakening invariants because real-world document conversion inevitably encounters formats and constructs that exceed any fixed semantic model, yet relaxing core constraints would destroy determinism and testability.

## What

The repository enforces a strict semantic pipeline based on a canonical Markdown IR, deterministic normalization, and explicit renderer policies.

Feedback correctly identifies that:
- markdown ecosystems are fragmented
- real documents contain constructs not covered by the IR
- fallback behavior is unavoidable

However, the correct response is not to loosen constraints or allow implicit behavior.

Instead, the system must introduce controlled extension points that:
- preserve semantic integrity
- keep fallback behavior explicit
- maintain deterministic output contracts

## Why

Relaxing invariants leads to:
- hidden semantic drift
- inconsistent rendering across flavors
- untestable behavior
- loss of trust in the exporter

Strictness is not the problem. Uncontrolled flexibility is.

The system must evolve by adding explicit, testable escape hatches, not by weakening boundaries.

## How

When encountering constructs outside the current IR:

- do not silently pass them through
- do not implicitly reinterpret them
- do not degrade them without visibility

Instead:

- extend the IR with controlled nodes when necessary
- introduce explicit passthrough categories where safe
- route all non-native behavior through centralized policy layers

Every extension must still satisfy:
- IR representation or explicit classification
- normalization rules or explicit exemption
- renderer behavior
- test coverage

## Links

- [[Markdown IR is the canonical render boundary]] - Core invariant that must not be weakened.
- [[Fallback selection is centralized across markdown flavors]] - Escape hatches must be policy-driven.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Extensions must not bypass semantic boundaries.
- src/markdown/ir.ts - Canonical semantic model.
