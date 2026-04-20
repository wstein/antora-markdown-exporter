---
id: 20260420193900
aliases:
  - explicit package manager policy
  - Makefile package manager setting
  - Build tooling policy
tags:
  - tooling
  - build
  - package-manager
  - notes
---
Build tooling uses one explicit package manager setting. The Makefile defaults to Bun, and developers can override it with npm when needed. This keeps the repository focused without carrying lockfile-detection branches or extra compatibility paths.

## What

The Makefile uses `PM ?= bun` and routes install, build, test, check, lint, format, fix, and release through that one setting. Each target is a thin delegate to the matching package-manager command. When a different package manager is needed, invoke Make with `PM=npm`.

## Why

An explicit package manager policy reduces maintenance cost, keeps the command surface predictable, and avoids hidden behavior tied to lockfile detection.

## How

Keep the Makefile logic simple and explicit. Default to Bun, use `PM=npm` only when an npm run is intentionally required, and avoid script-detection logic inside Make targets.

Do not reintroduce lockfile-based switching, pnpm, Yarn, or other package manager fallbacks.

## Links

- [[Release and package identity use scoped npm publishing]] - The package is library-first and npm-publish ready.
- README.md - Developer usage guidance for `make install`, `make build`, and `make test`.
- Makefile - Primary package manager policy implementation.
