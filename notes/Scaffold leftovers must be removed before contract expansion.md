---
id: 20260420194400
aliases: ["Scaffold cleanup rule", "Leftover removal policy", "Migration cleanup invariant"]
tags: ["repository", "cleanup", "migration", "quality"]
target: current
---
Scaffold leftovers must be removed before contract expansion because placeholder files, obsolete runtime assumptions, and dead migration artifacts reduce trust faster than missing features do. Cleanup should precede broadening the public contract.

## What

Leftovers include:
- obsolete starter files
- stale runtime-specific console stubs
- ambient type configuration for unused runtimes
- docs that describe superseded setup paths
- tests that assert artifacts which do not exist

These artifacts should be removed or replaced before adding more renderer features. The Bun hello-world stub in `src/antora-markdown-exporter.ts` is an example of the kind of artifact that should not survive past the cleanup phase.

## Why

A narrow but coherent scaffold is easier to trust than a broad but contradictory one. Leftovers create review noise and hide the real state of the project.

This is especially important in a library-first package where publish metadata and documentation amplify inconsistencies.

## How

Create a dedicated cleanup phase before adding flavor renderers, richer IR nodes, or reference corpus machinery.

Prefer deletion over “temporary” coexistence when the old path is no longer intended.

Treat dead scaffolding as a correctness issue, not only a style issue.

## Links

- [[Repository scripts and referenced files must stay in lockstep]] - Cleanup restores self-consistency.
- [[Toolchain policy must choose one primary execution path]] - Cleanup is required to make that choice visible.
- src/antora-markdown-exporter.ts - Example of a leftover stub.
- tsconfig.json - Example of stale runtime assumptions.
