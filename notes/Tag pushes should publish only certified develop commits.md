---
id: 20260421113100
aliases: ["Tag-gated publish policy", "Certified commit tagging", "Semver tag publish contract"]
tags: ["release", "tags", "ci", "governance"]
target: current
---
Tag pushes should publish only certified `develop` commits because a release tag is the repository’s strongest statement that one exact commit has passed the required checks and is eligible to become the published package.

## What

In the planned release flow:
- release tags use semantic version names such as `v0.4.0`
- the tag must point at the exact commit that passed the required CI workflow on `develop`
- publishing is triggered by the tag, not by an untagged branch push
- after successful publication, `main` may be fast-forwarded to that same commit

The tag is the certification boundary between candidate state and published state.

## Why

Publishing from branch state alone is easier to race, reinterpret, or reproduce incorrectly.

Requiring a certified tagged commit gives operators:
- one immutable publish input
- a clean audit trail from CI to release
- fewer opportunities for accidental republish from the wrong commit
- a simpler mental model for rollback and release forensics

## How

Release automation should:
- validate the tag name as a semantic version
- verify that the checked-out commit matches the tag target
- verify that the tagged commit passed the required CI workflow on `develop`
- verify that package version metadata matches the tag version
- publish the packed tarball derived from that exact commit

Do not allow ad-hoc publish jobs that bypass the tag gate.

## Links

- [[Develop should be the integration branch while main tracks published history]] - The tag policy depends on the develop/main split.
- [[Release and package identity use scoped npm publishing]] - The npm publish path should consume certified tagged inputs.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Release certification depends on deterministic validation, not only branch state.
- .github/workflows/ci.yml - CI defines the certification lane that a tagged commit must pass.
- .github/workflows/release.yml - Release automation should evolve into the tag-triggered publish gate.
- package.json - Package version metadata must match the semantic tag.
