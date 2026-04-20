---
id: 20260420193600
aliases: ["Reference fixture provenance", "Curated reference fixtures", "Provenance locked fixtures"]
tags: ["testing", "fixtures", "provenance", "governance"]
target: v0.1
---
Reference fixtures are curated and provenance locked so the repository can benefit from real external document shapes without turning tests into an uncontrolled moving target. Every imported reference case must record where it came from and why it was selected.

## What

The repository keeps reference fixtures as curated snapshots rather than live pulls from upstream documentation repositories. The current provenance registry lives in `tests/reference/manifest.json` and records the local snapshot path plus a locked `sha256`.

Each fixture records at least:
- source project
- original file paths
- capture date
- coverage themes
- local selection rationale
- semantic expectations for compatibility assertions

## Why

Live upstream content changes can break tests for reasons unrelated to the exporter. Provenance-locked snapshots preserve reproducibility while still grounding the test corpus in real documents.

Curation also keeps the corpus compact and high-signal.

## How

Store fixture metadata beside each reference case, for example in `case.json` or a small manifest file. Keep the current repository contract in `tests/reference/manifest.json`, including coverage tags and expected semantic markers.

Require review whenever a reference snapshot is refreshed. Refreshes should explain semantic differences, not only file diffs.

Do not import large upstream trees without selection criteria.

## Links

- [[Reference testing uses official Antora documentation as a compatibility corpus]] - Defines why the external corpus exists.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Provenance locking complements deterministic local fixtures.
- tests/reference/manifest.json - Reference fixture provenance registry.
- tests/reference/fixtures - Curated snapshot storage.
