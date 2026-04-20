---
id: 20260420194000
aliases: ["Script-file consistency", "Repository self-consistency", "Referenced file lockstep"]
tags: ["repository", "tooling", "consistency", "governance"]
target: v0.1
---
Repository scripts and referenced files must stay in lockstep because a package cannot be considered buildable, testable, or publishable when its scripts, metadata, and documentation refer to files that do not exist. Self-consistency is a release prerequisite, not optional polish.

## What

The repository must keep these layers aligned:
- `package.json` scripts and publish metadata
- CI workflow commands
- README developer commands
- Makefile delegate targets
- test assumptions about repository files
- actual tracked files in the tree

Examples include build config files, formatter config, CLI bin files, Makefiles, and license files.

## Why

A repository can look structurally mature while still failing immediately in CI or during local setup if scripts point to missing files. This erodes trust and makes every downstream review noisy.

Self-consistency also keeps documentation honest and prevents tests from asserting policy against artifacts that are not present.

## How

Whenever a script, bin entry, test, or README command references a file, verify that the file exists in the repository and is included in packaging rules when required.

If a file is intentionally deferred, remove or narrow the reference until the file lands.

Treat missing referenced files as blocking issues for the current phase.

## Links

- [[Release and package identity use scoped npm publishing]] - Publish readiness depends on file and script alignment.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Test infrastructure must exist, not only be described.
- package.json - Script and publish metadata source.
- .github/workflows/ci.yml - CI command contract.
- README.md - Developer command surface.
