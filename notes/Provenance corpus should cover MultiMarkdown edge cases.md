---
id: 20260422182000
title: Provenance corpus should cover MultiMarkdown edge cases
target: current
---

# Provenance corpus should cover MultiMarkdown edge cases

## Summary

The provenance corpus should cover MultiMarkdown edge cases because the `multimarkdown` flavor now represents real package behavior and needs the same provenance-locked compatibility pressure that already exists for core GFM and site-routing cases.

## What

Reference fixtures should include realistic edge cases that stress MultiMarkdown-specific behavior such as:

- metadata blocks
- definition lists
- citations
- footnotes
- table captions
- attribute-carrying links or images when those semantics survive normalization

Those fixtures should live in the provenance-locked corpus and declare explicit flavor expectations in `tests/reference/manifest.json`.

## Why

Without provenance-backed MultiMarkdown cases:

- flavor support can drift behind the published support matrix
- regressions stay invisible until operator exports change
- the repository over-relies on local synthetic fixtures for flavor confidence

The curated reference corpus should pressure high-value flavor behavior with the same discipline used for other documented compatibility claims.

## How

Add compact curated reference inputs that:

- represent realistic document shapes
- record provenance and hash locking
- assert semantic invariants for shared behavior
- assert MultiMarkdown-specific rendered markers only where the flavor contract truly differs

Do not replace the local fixture corpus. Use reference fixtures to widen compatibility pressure, not to displace deterministic local golden tests.

## Links

- [[Reference fixtures are curated and provenance locked]] - New coverage must preserve provenance discipline.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Reference fixtures complement exact local golden tests.
- [[MultiMarkdown should be a v0.7 flavor target]] - MultiMarkdown is a real flavor goal, not an aspirational label.
- tests/reference/manifest.json - Provenance registry.
- tests/integration/reference-antora.test.ts - Compatibility assertion entrypoint.
