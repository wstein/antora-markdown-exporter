# Antora Markdown Exporter: Onboarding

## Table of Contents

- [Chapter 1. Start Here](#chapter-1-start-here)
- [Chapter 2. Mental Models](#chapter-2-mental-models)
  - [2.1. Start With The Real Boundary, Not The Marketing Boundary](#21-start-with-the-real-boundary-not-the-marketing-boundary)
  - [2.2. Think In Pipeline Stages](#22-think-in-pipeline-stages)
  - [2.3. The Markdown IR Is The Contract](#23-the-markdown-ir-is-the-contract)
  - [2.4. Changed Responsibilities After Structured Extraction](#24-changed-responsibilities-after-structured-extraction)
  - [2.5. Renderers Adapt Syntax, They Do Not Redefine Meaning](#25-renderers-adapt-syntax-they-do-not-redefine-meaning)
  - [2.6. Fallback Is A Policy Layer](#26-fallback-is-a-policy-layer)
  - [2.7. Transparent Extensions Are Not Fallback](#27-transparent-extensions-are-not-fallback)
  - [2.8. Includes Are Mostly Assembler-Owned](#28-includes-are-mostly-assembler-owned)
  - [2.9. Xref Routing Is Lowering, Not Rendering](#29-xref-routing-is-lowering-not-rendering)
  - [2.10. One Toolchain Path Is Primary](#210-one-toolchain-path-is-primary)
- [Chapter 3. Core Workflows](#chapter-3-core-workflows)
  - [3.1. Day One](#31-day-one)
  - [3.2. First Task](#32-first-task)
  - [3.3. First Successful Change Checklist](#33-first-successful-change-checklist)
  - [3.4. Worked Example](#34-worked-example)
  - [3.5. Release Flow Uses develop, main, And Semver Tags](#35-release-flow-uses-develop-main-and-semver-tags)
  - [3.6. How To Reason About Documentation](#36-how-to-reason-about-documentation)
- [Chapter 4. Core Architecture](#chapter-4-core-architecture)
- [Chapter 5. Quality And Guardrails](#chapter-5-quality-and-guardrails)
  - [5.1. Exact Output Matters](#51-exact-output-matters)
  - [5.2. Reference Tests Serve A Different Purpose](#52-reference-tests-serve-a-different-purpose)
  - [5.3. Keep Repository Contracts Honest](#53-keep-repository-contracts-honest)
- [Chapter 6. Reference Notes](#chapter-6-reference-notes)

This guide is for day-one contributors. Start here when you need the first build, the first test run, the first code change, and the shortest path to the right file.

Use this document chronologically:

- get the repo building
- learn where semantic changes belong
- learn where rendering-only changes belong
- avoid fighting the architecture by editing the wrong layer

If you need the full architectural rationale, proof surface, or invariants, jump to the architecture document. This guide keeps only the minimum contributor-facing version of that material.

# Chapter 1. Start Here

Some docs use short status markers such as `Implemented`, `Test-enforced`, `CI-enforced`, and `Intended`.

You do not need that model to get started. Use the architecture document when you need the full proof matrix, evidence ledger, or contract traceability.

# Chapter 2. Mental Models

## 2.1. Start With The Real Boundary, Not The Marketing Boundary

The repository ships a real Antora exporter extension. The public entrypoint in `src/extension/index.ts` exports `register()` and delegates to `@antora/assembler.configure()` with the repository’s Markdown converter.

Why this matters:

- public names must match real behavior
- architecture docs are only useful if maturity is signaled honestly
- review quality drops quickly when names and examples overstate or understate the real boundary

As a contributor, assume both layers are real:

- the outer Antora registration path
- the inner semantic markdown pipeline

Changes should keep those layers aligned.

## 2.2. Think In Pipeline Stages

The project shape is:

1. Antora Assembler produces assembled AsciiDoc and resolves most low-level inline and block structure first.
2. The TypeScript exporter maps that assembled content and preserved metadata into a semantic Markdown IR.
3. Flavor renderers serialize that IR into concrete Markdown.

The practical rule is simpler: once content reaches the repository pipeline, semantic decisions stay inside repository code. Do not route meaning through HTML-to-Markdown shortcuts or renderer-local hacks.

This is why the implementation is split across:

- `src/adapter/asciidoctor-structure.ts`
- `src/exporter/structured-to-ir.ts`
- `src/markdown/ir.ts`
- `src/markdown/normalize.ts`
- `src/markdown/render/**`
- `src/markdown/xref-resolution.ts`

If you are touching behavior after conversion starts, your change should usually land in the adapter, lowering, IR, normalization, renderer, or tests.

## 2.3. The Markdown IR Is The Contract

The Markdown IR is the canonical render boundary. The repository does not treat markdown as a string-formatting exercise. It converts structured assembly content into a semantic intermediate representation first, then normalizes it, then renders it.

Contributor rule of thumb:

- if a change affects document meaning, it belongs before or inside the IR boundary
- if a change affects how one flavor prints the same meaning, it belongs in renderer logic
- if a feature cannot be represented semantically yet, do not hide that fact behind loose renderer behavior

This separation is what keeps regressions explainable and testable.

## 2.4. Changed Responsibilities After Structured Extraction

The biggest contributor trap is assuming the exporter still owns low-level AsciiDoc parsing. It does not.

Current responsibility split:

- Antora Assembler resolves include expansion, most low-level inline interpretation, and block formation before repository lowering starts
- `src/adapter/asciidoctor-structure.ts` and its helper modules convert assembled content into the repository-owned adapter contract
- `src/exporter/structured-to-ir.ts` lowers that contract into Markdown IR
- `src/markdown/inspection.ts` inspects normalized Markdown semantics such as xrefs rather than reviving include-directive transport

Use this routing guide:

- to add a new structural mapping, start in `src/adapter/asciidoctor-structure.ts`
- to change semantic lowering, work in `src/exporter/structured-to-ir.ts`
- to change normalized semantic shape, work in `src/markdown/ir.ts` or `src/markdown/normalize.ts`
- to change rendered syntax only, stay in `src/markdown/render/**`
- to change xref routing, stay in `src/markdown/xref-resolution.ts`
- to change inspection output, stay in `src/markdown/inspection.ts`

The helper split under `src/adapter/asciidoctor-structure/` matters too. `inline.ts`, `xref.ts`, `block-helpers.ts`, and `blocks.ts` carry narrower responsibilities, and their focused tests are part of the main proof surface. Update those helper tests when you change helper behavior.

## 2.5. Renderers Adapt Syntax, They Do Not Redefine Meaning

The repository currently ships explicit `gfm`, `commonmark`, `gitlab`, `multimarkdown`, and `strict` profiles. These flavors can differ in syntax and policy, but they must not reinterpret the document’s meaning independently.

Operator default policy is split intentionally:

- `bun run export:modules` defaults to `gfm`
- `make markdown` runs the dedicated package `markdown:build` task, which invokes the exporter in explicit `--package-task-markdown` mode
- both keep `.md` as the output extension

That means:

- flavor capability differences live in `src/markdown/flavor.ts`
- renderer output lives in `src/markdown/render/**`
- semantic drift between flavors is a bug, not a feature

When adding or changing a flavor, keep the semantic layer shared and the syntax surface explicit.

## 2.6. Fallback Is A Policy Layer

Unsupported constructs, raw HTML handling, and visible degradation are routed through `src/markdown/fallback.ts`. Individual renderers should consume that policy instead of inventing their own ad-hoc fallback rules.

This matters because fallback behavior is part of the contract:

- unsupported output must stay deterministic
- raw HTML allowance must be explicit
- regressions should be testable in one policy surface

If you are about to add a one-off renderer branch for unsupported behavior, stop and check whether the change belongs in the fallback layer instead.

## 2.7. Transparent Extensions Are Not Fallback

The main example today is fenced code blocks with authored language tags like `mermaid`. If the construct is already representable semantically as a `codeBlock`, the system should preserve it instead of degrading it simply because not every downstream flavor interprets it specially.

For contributors, this distinction is critical:

- valid semantic constructs should stay valid semantic constructs
- fallback is for controlled degradation, not for every unfamiliar feature
- strictness should lead to explicit extension points, not silent lossy rewrites

## 2.8. Includes Are Mostly Assembler-Owned

The default structured runtime no longer treats includes as a first-class exporter subsystem. Antora Assembler normally resolves include content before extraction. Any preserved include metadata is optional evidence transport, not the main converter path.

When touching includes:

- do not reintroduce exporter-side include parsing
- keep preserved metadata narrow and explicitly private
- document any diagnostic or provenance retention in architecture or operator docs when it becomes part of a supported workflow

## 2.9. Xref Routing Is Lowering, Not Rendering

Structured xref metadata is preserved in the IR and lowered to concrete destinations in `src/markdown/xref-resolution.ts` before link serialization. Renderers should format already-resolved destinations rather than owning Antora-aware routing logic themselves.

If you need to change xref behavior, start by deciding whether you are changing:

- semantic target shape
- lowering policy
- final markdown string formatting

Mixing those layers makes xref regressions much harder to reason about.

## 2.10. One Toolchain Path Is Primary

For the current phase, Bun is the authoritative development path. The `Makefile` defaults to `PM ?= bun`, package scripts are designed around that path, and npm remains the explicit publish transport plus an alternate install path.

Practical onboarding takeaway:

- use `make` targets first
- expect Bun to be the default runtime for day-to-day development
- do not add new lockfile-detection or multi-package-manager branching

# Chapter 3. Core Workflows

## 3.1. Day One

The shortest reliable contributor path is:

1. Install dependencies with `make install`
2. Build with `make build`
3. Run tests with `make test`, or use `make unit`, `make integration`, and `make reference` when you need narrower scope
4. Use `make inspect-report INPUT=...` for machine-readable validation on one source file

This flow is intentionally explicit. The repository prefers a small set of stable entrypoints over clever tool detection.

For package-level details, `package.json` is the durable source of truth. For contributor-friendly entrypoints, prefer `Makefile`.

## 3.2. First Task

Start here when you need to make a code change:

- add a structural mapping: `src/adapter/asciidoctor-structure.ts`
- adjust helper extraction logic: `src/adapter/asciidoctor-structure/*.ts`
- fix semantic lowering: `src/exporter/structured-to-ir.ts`
- change semantic node shapes: `src/markdown/ir.ts`
- change normalization: `src/markdown/normalize.ts`
- change xref lowering: `src/markdown/xref-resolution.ts`
- change fallback policy: `src/markdown/fallback.ts`
- change printed markdown syntax only: `src/markdown/render/**`
- change machine-readable inspection: `src/markdown/inspection.ts` or `scripts/inspection-report.ts`

Then update the nearest focused tests before relying on end-to-end fixtures alone.

## 3.3. First Successful Change Checklist

Use this quick checklist after your first code edit:

- run the nearest focused test first
- run `make test` before considering the change done
- update golden fixtures only when the rendered change is intentional
- update docs if the operator path, contributor path, or package behavior changed
- if you changed semantic mapping or lowering, make sure the helper tests or IR tests changed with it
- if you changed rendered syntax only, keep the change inside `src/markdown/render/**`

## 3.4. Worked Example

One small structural change usually touches three places:

1. Update adapter code in `src/adapter/asciidoctor-structure.ts` or one of the helper modules under `src/adapter/asciidoctor-structure/`.
2. Update the nearest focused test such as `tests/unit/asciidoctor-inline.test.ts`, `tests/unit/asciidoctor-block-helpers.test.ts`, or `tests/unit/asciidoctor-structure.test.ts`.
3. Update a golden fixture only if the rendered markdown output changed intentionally.

Example path:

- you add or adjust a table-mapping rule in `src/adapter/asciidoctor-structure/block-helpers.ts`
- you first pin that behavior in `tests/unit/asciidoctor-block-helpers.test.ts`
- if the final markdown changes, you then review the relevant `tests/fixtures/**/expected.<flavor>.md` file or module-export golden snapshot
- if the change is only about assembled review-export links, keep the `.md` expectation in extension or module-export tests rather than rewriting the generic xref fixture corpus

That order matters. Start with the narrowest proof surface, then widen to end-to-end fixtures only when the semantic or rendered result really changed.

## 3.5. Release Flow Uses develop, main, And Semver Tags

In practical terms:

- it separates “integrated” from “published”
- it keeps release publication tied to one immutable tag input
- it means `main` is not the branch for normal feature integration anymore

## 3.6. How To Reason About Documentation

These docs have different jobs:

- onboarding is the paved road for the first build, first task, and first validation loop
- the manual is task-first operator guidance
- architecture is the canonical home for invariants, proof surfaces, and formal rationale
- notes are canonical inputs when a design rule needs durable provenance

When docs disagree, prefer code for what is implemented today and architecture for the formal contract.

# Chapter 4. Core Architecture

At a high level, contributors can think about the repository in six layers:

1. Public package and CLI surface in `src/index.ts`, `package.json`, and `bin/**`
2. Assembler-backed Antora extension boundary in `src/extension/**`
3. Assembly-to-IR conversion in `src/exporter/**`
4. Canonical markdown kernel in `src/markdown/ir.ts` and `src/markdown/normalize.ts`
5. Policy and lowering layers in `src/markdown/fallback.ts` and `src/markdown/xref-resolution.ts`
6. Flavor renderers and validation surfaces in `src/markdown/render/**` and `src/markdown/inspection.ts`

Those layers are exposed through one contract family:

- root package API in `src/index.ts`
- Antora extension API in `src/extension/index.ts`
- repository operator scripts in `scripts/export-antora-modules.ts`, `scripts/inspection-report.ts`, and `scripts/release.js`
- release and publication workflows in `.github/workflows/release.yml` and `.github/workflows/pages.yml`

The test suite mirrors those layers:

- unit tests for IR, normalization, fallback, xref resolution, include metadata, and repository contracts
- integration golden tests for exact rendered output
- reference tests for semantic compatibility on curated external material
- inspection-report tests for machine-readable validation flows

# Chapter 5. Quality And Guardrails

## 5.1. Exact Output Matters

A real golden test must:

1. convert input into IR
2. normalize the IR
3. render a specific flavor
4. compare full rendered output against `expected.<flavor>.md`

This is why `tests/integration/fixture-golden.test.ts` is a key contributor touchpoint. If your change affects rendering, expect golden outputs to be the primary review surface.

## 5.2. Reference Tests Serve A Different Purpose

New contributors should remember:

- local fixtures are the byte-exact authority
- reference fixtures are curated snapshots, not live upstream pulls
- reference tests protect semantic robustness, not exact byte identity
- provenance and coverage tags are part of the contract

When adding a new reference case, include a clear reason for why that case earns its place in the corpus.

## 5.3. Keep Repository Contracts Honest

A change is not complete if:

- `package.json` points at files that do not exist
- README commands describe files or scripts that are gone
- CI workflows reference stale commands
- tests enforce contracts for artifacts the repository no longer ships

Contributors should treat self-consistency as release readiness, not as optional cleanup work.

# Chapter 6. Reference Notes

If you want the deeper rationale after your first successful change, read:

- `Build tooling uses bun-first package manager fallback`
- `Toolchain policy must choose one primary execution path`
- `Repository scripts and referenced files must stay in lockstep`

