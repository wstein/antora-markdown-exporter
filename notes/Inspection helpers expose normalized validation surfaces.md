---
id: 20260421224500
aliases: ["Validation helper API", "Inspection report surface", "Normalized inspection helpers"]
tags: ["api", "validation", "inspection", "testing", "release"]
target: current
---
Inspection helpers expose normalized validation surfaces because downstream tooling should inspect include diagnostics and xref targets through a stable API instead of reimplementing tree traversal over Markdown IR nodes. Validation consumers need durable semantics, not knowledge of every recursive block shape.

## What

The repository exposes helper functions that consume a Markdown document and return normalized inspection data:
- include directives
- include diagnostics
- xrefs
- xref targets
- combined inspection reports

These helpers should normalize the document first and then traverse the full recursive block structure.

Their output order should follow normalized document order so JSON reports, CLI output, and release validation remain deterministic without extra consumer-side sorting.

The inspection API exists for validation and reporting, not rendering.

## Why

Validation logic that reimplements traversal outside the library will drift from the canonical IR semantics. That creates inconsistent CI checks, release validation, and user tooling.

A first-class inspection layer keeps diagnostics and family-aware xref metadata reusable across:
- CI validation
- release checks
- editor or CLI reporting
- downstream automation

## How

Keep the helper surface in `src/markdown/inspection.ts` or an equivalent inspection-focused module.

Helpers should:
- accept a Markdown document
- normalize before inspection
- recurse through supported block and inline containers
- return structured data instead of formatted strings

If multiple validation consumers need the same traversal, add one combined inspection report helper rather than making each consumer stitch together separate passes.

When repository automation needs machine-readable output, provide one maintained script example that serializes the combined inspection report as JSON instead of leaving each CI pipeline to invent its own formatting layer.

If CI consumers need native platform feedback, keep that as an explicit alternate output mode over the same normalized inspection report rather than a separate ad-hoc validation implementation. For example, GitHub Actions annotations should be emitted from the same inspection data that powers the JSON report.

The repository currently treats Bun as the primary development runtime for the inspection script, while npm remains the publish channel rather than a separate validation implementation path.

Do not mix inspection helpers into renderer policy or export conversion logic.

## Links

- [[Markdown IR is the canonical render boundary]] - Inspection helpers consume normalized semantic nodes.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Fixtures and validation helpers should reinforce the same contract.
- [[Release and package identity use scoped npm publishing]] - Release validation can use these helpers before publish.
- src/markdown/inspection.ts - Inspection helper implementation.
- scripts/inspection-report.ts - Machine-readable JSON reporting example for CI flows.
- README.md - Public usage examples for validation and reporting.
