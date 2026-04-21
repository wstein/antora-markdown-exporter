---
id: 20260422110000
title: Documentation claims should distinguish implementation test and workflow evidence
target: current
---

# Documentation claims should distinguish implementation test and workflow evidence

## Summary

Documentation claims should distinguish implementation, test, and workflow evidence because architectural coherence is not the same thing as operational proof. Readers need to know whether a behavior is merely designed, implemented in code, enforced by tests, or enforced by CI automation.

## What

Repository-facing docs should use a small explicit status grammar for major claims:

- `Implemented` for behavior present in the code
- `Test-enforced` for behavior pinned by automated tests
- `CI-enforced` for behavior executed or guarded by repository workflows
- `Intended` for design direction that is documented but not yet fully enforced

Those markers should appear where the repository makes important claims about:

- determinism
- fallback policy
- inspection surfaces
- module export
- release integrity
- documentation publication

## Why

Without a status grammar, docs can become philosophically correct but operationally ambiguous. That ambiguity is especially risky in a repository whose architecture notes are intentionally ahead of some implementation details.

Explicit markers let the docs stay ambitious without overstating proof.

## How

Add the status grammar to contributor-facing and operator-facing docs.

For major repository claims, include a compact proof matrix that links the claim to:

- source files
- tests
- workflow files when relevant

When a workflow file exists but its behavior is not yet contract-tested or routinely exercised, document that as `Intended` rather than as established fact.

## Links

- [[Inspection helpers expose normalized validation surfaces]] - Validation claims need clear evidence markers.
- [[Release and package identity use scoped npm publishing]] - Release claims should distinguish design from enforced workflow behavior.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Determinism claims must state their proof surface.
- docs/modules/manual/pages/index.adoc - Operator-facing claim status guidance.
- docs/modules/onboarding/pages/index.adoc - Contributor-facing claim status guidance.
- docs/modules/architecture/partials/10_quality_requirements.adoc - Architecture proof matrix.
