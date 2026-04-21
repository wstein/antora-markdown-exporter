---
id: 20260421113200
aliases: ["Release model migration constraint", "Branch model migration note", "Coordinated release workflow migration"]
tags: ["migration", "release", "repository", "governance"]
target: current
---
Moving the repository to a `develop` / `main` / semver-tag release model must be coordinated across code, docs, and automation because changing only one layer would create a confusing hybrid workflow where branch names, release scripts, CI assumptions, and operator instructions disagree.

## What

This migration affects multiple layers at once:
- branch strategy
- CI triggers and certification expectations
- release workflow triggers
- release wizard or helper scripts
- README and operator guidance
- onboarding and architecture documentation

The change is therefore a repository operating model migration, not just a release-script addition.

## Why

A partial migration would create avoidable failure modes:
- CI still certifies the wrong branch
- release tooling assumes a branch that contributors do not use
- docs describe a workflow that automation does not enforce
- operators cannot tell whether `main` or `develop` is authoritative for release state

The repository needs one coherent release story.

## How

Adopt the new operating model in coordinated phases:
- define the branch policy in notes first
- update CI to certify `develop`
- update release automation to trigger from semver tags
- add release helper tooling that enforces the same assumptions
- update docs and repository-contract checks so written guidance matches automation

Until that migration is complete, preserve the current uncertainty explicitly in docs rather than implying the develop/main/tag flow already exists.

## Links

- [[Develop should be the integration branch while main tracks published history]] - Defines the target branch operating model.
- [[Tag pushes should publish only certified develop commits]] - Defines the target publication gate.
- [[Repository scripts and referenced files must stay in lockstep]] - The migration must keep workflows, scripts, and docs aligned.
- [[Toolchain policy must choose one primary execution path]] - Release automation changes must still preserve one authoritative workflow.
- README.md - Public workflow guidance must change with the operating model.
- .github/workflows/ci.yml - CI assumptions are part of the migration surface.
- .github/workflows/release.yml - Release automation is part of the migration surface.
