---
id: 20260420193500
aliases: ["Antora reference corpus", "Official docs compatibility corpus", "Reference testing corpus"]
tags: ["testing", "antora", "fixtures", "compatibility"]
target: current
---
Reference testing uses the official Antora documentation project as a compatibility corpus because it exercises real navigation structure, xrefs, includes, admonitions, and authoring conventions that synthetic fixtures do not fully capture. The project should treat this corpus as a living external reference rather than a source of exact-output truth.

## What

The repository uses a curated subset of the official Antora documentation project as a reference-testing corpus, stored as provenance-locked local snapshots under `tests/reference/fixtures/**`.

This corpus is separate from the repository’s local golden fixtures. It exists to validate that the exporter can process realistic Antora content and preserve core semantics across representative pages and assembled outputs.

## Why

Synthetic fixtures are necessary for exact deterministic tests, but they are too small to expose many document-shape interactions seen in real Antora projects. A reference corpus catches gaps in xref handling, structural nesting, include behavior, and fallback policy.

Using the official docs also reduces the risk of tuning the exporter only for self-invented examples.

## How

Create a curated reference fixture area under `tests/reference/fixtures/**` or an equivalent managed snapshot directory.

Store provenance for each imported reference case, including source repository, source path, revision, and any local normalization applied for testing.

Do not treat the external corpus as a byte-for-byte golden snapshot source. Use it for compatibility assertions, semantic checks, and controlled comparison fixtures.

## Links

- [[Testing relies on golden fixtures and deterministic snapshots]] - Golden fixtures remain the exact-output authority.
- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Reference testing validates the pipeline on real Antora material.
- tests/reference/fixtures - Curated external compatibility corpus.
- tests/integration/reference-antora.test.ts - Compatibility test entrypoint.
