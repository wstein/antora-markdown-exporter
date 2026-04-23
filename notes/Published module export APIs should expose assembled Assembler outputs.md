---
id: 20260423021500
title: Published module export APIs should expose assembled Assembler outputs
target: current
---

# Published module export APIs should expose assembled Assembler outputs

## Summary

The published package should expose high-level Antora Assembler export APIs because module export is a library capability, not just a repository script convenience.

## What

The root package should publish both sides of the Antora module export boundary:

- `assembleAntoraModules(...)` for callers that want assembled AsciiDoc module files with provenance before Markdown rendering
- `exportAntoraModulesToMarkdown(...)` for callers that want assembled Markdown module exports with content and metadata already materialized

Those APIs should stay Assembler-centered. They should accept Antora playbook and configuration inputs, use the same Assembler runtime as the extension and repository scripts, and expose one result per assembled export surface.

The result shapes should include:

- a stable module name
- the assembled relative path
- in-memory contents
- source-page provenance derived from the assembled page membership
- export metadata such as flavor, root level, and fallback-label policy
- diagnostics as an explicit field, even when the current export path has no export-local diagnostics to report

## Why

If the package only exports low-level string rendering and file-writing helpers:

- consumers must rebuild the Assembler runtime boundary themselves
- repository scripts become the de facto public API even though they are not package contracts
- downstream tools cannot cleanly reuse assembled module exports in memory
- provenance and export metadata drift into ad-hoc wrapper logic
- the repository keeps duplicating orchestration concerns that belong in `src/**`

Publishing the Assembler boundary directly keeps the package honest about its real capability and reduces the pressure to treat repository scripts as semi-public integration points.

## How

Implement the public module-export surface in `src/module-export.ts` and keep repository scripts as thin delegates.

Use the same Antora runtime helpers to:

- resolve exporter defaults from the playbook and Assembler config
- produce assembled AsciiDoc module files
- render assembled Markdown exports
- keep internal review-link rewriting aligned with Assembler export membership

Do not make callers reverse-engineer repository scripts to get one export per assembled module.

Do not expose a second non-Assembler export path just to satisfy programmatic callers.

## Links

- [[Antora module markdown export should use the canonical repository pipeline]] - The exported module workflow should stay on one maintained semantic path.
- [[Assembler custom exporters receive assembled AsciiDoc source buffers]] - The public API should expose the real Assembler handoff rather than hiding it behind scripts.
- [[Assembly root level controls export partitioning not exporter handoff semantics]] - Partitioning remains Antora-owned even when the package exports higher-level helpers.
- src/module-export.ts - Root package module-export surface.
- scripts/export-antora-modules.ts - Repository wrapper that should delegate to the package API.
