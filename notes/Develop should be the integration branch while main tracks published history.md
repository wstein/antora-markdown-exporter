---
id: 20260421113000
aliases: ["Develop main release model", "Release branch operating model", "Published history branch policy"]
tags: ["repository", "release", "branches", "policy"]
target: current
---
The repository should use `develop` as the integration branch for normal change flow while `main` tracks already-published history, because a two-phase release model is much easier to certify when candidate work and published history are separated explicitly.

## What

Under this operating model:
- feature and maintenance work merges into `develop`
- release candidates are prepared and certified on `develop`
- `main` advances only after a successful published release
- semver tags identify the exact certified commit that becomes the published release

This is a repository operating model, not just a Git naming preference.

## Why

If the same branch is both the day-to-day integration lane and the published history lane, it becomes harder to reason about what has merely passed CI and what has actually been released.

Separating `develop` from `main` supports:
- cleaner release certification
- less ambiguity in release tooling
- clearer contributor expectations
- easier audit of published state

## How

When the repository adopts the two-phase release flow:
- treat `develop` as the authoritative branch for CI certification
- require release preparation and release tagging to happen from `develop`
- treat `main` as the branch that reflects successfully published releases
- update CI, release workflows, docs, and branch protections together so the operating model stays coherent

Do not partially adopt the branch names while leaving the old `main`-only behavior in place.

## Links

- [[Release and package identity use scoped npm publishing]] - The published package identity needs a release lane that is easy to audit.
- [[Repository scripts and referenced files must stay in lockstep]] - Branch policy, workflows, and docs must all move together.
- [[Tag pushes should publish only certified develop commits]] - Tags are the bridge from `develop` certification to published history.
- .github/workflows/ci.yml - CI must certify the integration branch that feeds releases.
- .github/workflows/release.yml - Release automation must reflect the chosen branch model.
