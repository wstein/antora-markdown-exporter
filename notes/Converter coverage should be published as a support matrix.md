---
id: 20260422110500
title: Converter coverage should be published as a support matrix
target: current
---

# Converter coverage should be published as a support matrix

## Summary

Converter coverage should be published as a support matrix because the next honesty gap after maturity signaling is feature coverage. Users and maintainers need to know which AsciiDoc constructs are supported, partially supported, or intentionally unsupported, and where that status is proven.

## What

The repository should publish a compact support matrix for important construct families such as:

- headings and section structure
- xrefs and anchors
- include directives and diagnostics
- admonitions, images, and tables
- transparent fenced extensions
- raw HTML and unsupported fallback

For each family, the docs should state whether support is:

- supported
- partial
- unsupported

and should link to the tests or fixtures that currently prove that status.

## Why

A support matrix turns “the converter is capable” into a reviewable claim with boundaries. It also helps contributors decide whether a new failure is a regression, a missing feature, or a case that should degrade visibly.

## How

Publish the matrix in operator-facing docs and keep it short enough to review.

When support status changes, update the matrix together with:

- code
- tests
- generated documentation fixtures

Do not hide partial coverage behind broad statements like “AsciiDoc is supported.”

## Links

- [[Markdown IR is the canonical render boundary]] - Coverage status belongs to semantic behavior, not string rewriting.
- [[Fallback selection is centralized across markdown flavors]] - Partial and unsupported status often hinge on fallback rules.
- [[Reference corpus should cover navigation xrefs includes and admonitions]] - The matrix should point back to representative fixtures.
- docs/modules/manual/pages/index.adoc - Operator-facing support matrix.
- tests/integration/fixture-golden.test.ts - Exact-output evidence.
- tests/integration/reference-antora.test.ts - Semantic compatibility evidence.
