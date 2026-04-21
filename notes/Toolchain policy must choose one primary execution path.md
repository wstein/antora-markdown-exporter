---
id: 20260420194100
aliases: ["Primary toolchain policy", "Bun Node policy", "Execution path policy"]
tags: ["tooling", "repository", "policy", "build"]
target: current
---
Toolchain policy must choose one primary execution path because mixed Bun-first and Node/npm-first instructions create avoidable confusion in builds, tests, CI, and contributor expectations. Secondary compatibility paths are acceptable, but one path must be authoritative.

## What

The repository currently spans multiple execution assumptions:
- Bun-oriented agent guidance and TypeScript config
- Node/npm-oriented CI and publish workflow
- Vitest-based tests
- package scripts invoked through npm-style semantics

For the current phase, Bun is the authoritative development and CI path, while npm remains the explicit publish path and an alternate installer.

## Why

Ambiguous toolchain policy increases maintenance cost and causes subtle breakage in local setup, CI parity, and contributor onboarding.

A clear primary path also makes support expectations explicit and keeps future automation simpler.

## How

Choose one primary path for the current milestone and align:
- `AGENT.md`
- `README.md`
- `package.json`
- `tsconfig*.json`
- CI workflows
- Makefile policy

Describe npm as the release transport and an explicit alternate install path rather than the primary day-to-day workflow.

Keep Bun as the runtime for local validation helpers such as `scripts/inspection-report.ts`, and do not split validation behavior across separate Bun-only and npm-only implementations.

Do not keep Bun-specific ambient types enabled unless the codebase actively depends on them.

## Links

- [[Build tooling uses bun-first package manager fallback]] - This note must remain compatible with the declared primary path.
- [[Repository scripts and referenced files must stay in lockstep]] - Toolchain references must match real files and commands.
- AGENT.md - Current agent-level toolchain instructions.
- tsconfig.json - Ambient runtime assumptions.
- package.json - Actual script contract.
