---
id: 20260420193400
aliases: ["Scoped npm publishing", "Package identity", "Release package policy"]
tags: ["packaging", "npm", "release", "repository"]
target: current
---
The package identity uses scoped npm publishing under `@wsmy/antora-markdown-exporter` and the repository should behave like a publishable TypeScript package instead of a Bun-init application. Tooling, exports, and release checks must reinforce that identity.


## What


The repository publishes as `@wsmy/antora-markdown-exporter`.


The package exposes a library-first API and also ships a small CLI entrypoint for local export workflows. Release validation should confirm built contents, exports, and package metadata before publication.


## Why


The current repository metadata is Bun-specific and not aligned with a reusable package. A clear package identity improves installation, contributor expectations, and release discipline.


This also fits the requested distribution model.


## How


Set the package name, exports map, files list, build scripts, and release validation around npm publishing.


Keep publishable assets in `dist/**`, validate package contents in CI, and separate build-time and test-time TypeScript configuration.

When release or publish validation needs semantic checks, prefer library-provided inspection helpers and the maintained `scripts/inspection-report.ts` example over ad-hoc repository scripts so diagnostics and xref-target analysis stay aligned with the canonical IR.

Treat Bun as the primary development and validation runtime while keeping npm as the actual publish transport.


## Links


- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The exported package wraps the pipeline implementation.
- [[Inspection helpers expose normalized validation surfaces]] - Validation tooling should consume stable inspection APIs.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Release confidence depends on deterministic contract tests.
- package.json - Package metadata and exports.
- .github/workflows/release.yml - Release validation and publish workflow.
- scripts/release-check.mjs - Pre-publish package checks.
