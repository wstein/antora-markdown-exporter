---
id: 20260422181000
title: Antora CLI markdown export should be configurable through playbook variables
target: current
---

# Antora CLI markdown export should be configurable through playbook variables

## Summary

Antora CLI markdown export should be configurable through playbook variables so repository users can drive Markdown generation through standard Antora entrypoints instead of relying on repository-local wrapper scripts as the only operational path.

## What

The repository should converge on one Antora-native control surface for Markdown export settings such as:

- export flavor
- assembly root level
- xref fallback label style
- output directory intent

Those controls should be expressible through playbook or Assembler configuration data that the real Antora runtime can read directly.

Repository scripts may remain as thin convenience wrappers, but they should not become the only place where export policy can be expressed.

## Why

If markdown-export policy lives only in repository-local scripts:

- end users cannot reproduce export behavior through standard Antora commands alone
- script flags become a second policy surface beside the playbook
- documentation has to explain repository wrappers before it can explain the Antora-native workflow
- CLI integration drifts away from the real extension contract

Keeping policy Antora-native reduces surprises and makes the exporter feel like part of the normal Antora toolchain instead of a sidecar utility.

## How

Prefer implementation steps that:

- read exporter defaults from explicit playbook or Assembler config
- keep `scripts/export-antora-modules.ts` as a convenience delegate, not a separate policy owner
- preserve one converter pipeline under `src/extension/index.ts`
- prove the behavior through integration tests that exercise the real Antora generator context

The repository now reads default export flavor and xref fallback label policy from `antora-playbook.yml` attributes and keeps `assembly.root_level` in `antora-assembler.yml`. Wrapper flags remain overrides, not the only policy source.

Do not add a second custom configuration format for repository use.

Do not move policy into shell wrappers when the Antora runtime can own it directly.

## Links

- [[Antora module markdown export should use the canonical repository pipeline]] - Export policy must stay inside the canonical pipeline.
- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The real extension runtime remains the primary boundary.
- scripts/export-antora-modules.ts - Current convenience wrapper.
- src/extension/index.ts - Real extension registration and converter entrypoint.
- antora-assembler.yml - Repository-level Assembler policy source.
