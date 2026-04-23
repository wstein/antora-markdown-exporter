# Antora Markdown Exporter: Architecture

## Table of Contents

- [Chapter 1. Introduction and Goals](#chapter-1-introduction-and-goals)
  - [1.1. Requirements Overview](#11-requirements-overview)
  - [1.2. Claim Status Grammar](#12-claim-status-grammar)
  - [1.3. Quality Goals](#13-quality-goals)
  - [1.4. Stakeholders](#14-stakeholders)
- [Chapter 2. Architecture Constraints](#chapter-2-architecture-constraints)
- [Chapter 3. Context and Scope](#chapter-3-context-and-scope)
  - [3.1. Business Context](#31-business-context)
  - [3.2. Technical Context](#32-technical-context)
- [Chapter 4. Solution Strategy](#chapter-4-solution-strategy)
- [Chapter 5. Building Block View](#chapter-5-building-block-view)
  - [5.1. Whitebox Overall System](#51-whitebox-overall-system)
    - [5.1.1. Markdown Kernel](#511-markdown-kernel)
    - [5.1.2. Conversion And Include Handling](#512-conversion-and-include-handling)
    - [5.1.3. Validation And Release Surfaces](#513-validation-and-release-surfaces)
- [Chapter 6. Runtime View](#chapter-6-runtime-view)
  - [6.1. Convert Assembled Content To Flavor-Specific Markdown](#61-convert-assembled-content-to-flavor-specific-markdown)
  - [6.2. Collect Inspection Data For CI Or Release Validation](#62-collect-inspection-data-for-ci-or-release-validation)
- [Chapter 7. Deployment View](#chapter-7-deployment-view)
  - [7.1. Infrastructure Level 1](#71-infrastructure-level-1)
  - [7.2. Infrastructure Level 2](#72-infrastructure-level-2)
    - [7.2.1. Local Validation Surface](#721-local-validation-surface)
    - [7.2.2. Release and Publication Surface](#722-release-and-publication-surface)
- [Chapter 8. Cross-cutting Concepts](#chapter-8-cross-cutting-concepts)
  - [8.1. Deterministic Contract Testing](#81-deterministic-contract-testing)
- [Chapter 9. Architecture Decisions](#chapter-9-architecture-decisions)
- [Chapter 10. Quality Requirements](#chapter-10-quality-requirements)
  - [10.1. Quality Requirements Overview](#101-quality-requirements-overview)
  - [10.2. Proof Matrix](#102-proof-matrix)
  - [10.3. Evidence Ledger](#103-evidence-ledger)
  - [10.4. Quality Scenarios](#104-quality-scenarios)
    - [10.4.1. QS-1 Deterministic Golden Rendering](#1041-qs-1-deterministic-golden-rendering)
    - [10.4.2. QS-2 Reference Compatibility With Locked Provenance](#1042-qs-2-reference-compatibility-with-locked-provenance)
    - [10.4.3. QS-3 Valid Extensions Stay Out Of Fallback](#1043-qs-3-valid-extensions-stay-out-of-fallback)
    - [10.4.4. QS-4 Repository Self-Consistency Before Release](#1044-qs-4-repository-self-consistency-before-release)
- [Chapter 11. Risks and Technical Debts](#chapter-11-risks-and-technical-debts)
- [Chapter 12. Reference Notes](#chapter-12-reference-notes)

# Chapter 1. Introduction and Goals

## 1.1. Requirements Overview

`@wsmy/antora-markdown-exporter` is a library-first TypeScript package that converts assembled AsciiDoc into a repository-owned structured document, lowers that structure into a normalized Markdown intermediate representation (IR), normalizes that IR, and renders it into explicit Markdown flavors. The current public API centers on `extractAssemblyStructure`, `convertAssemblyStructureToMarkdownIR`, `normalizeMarkdownIR`, `renderMarkdown` and flavor helpers, plus inspection helpers for xref targets and normalized report collection.

## 1.2. Claim Status Grammar

This architecture document is the canonical home for claim-status markers.

**`Implemented`:** The behavior exists in repository code.

**`Test-enforced`:** The behavior is pinned by automated tests.

**`CI-enforced`:** The behavior is executed or guarded by repository workflows.

**`Intended`:** The design direction is documented, but the repository does not yet prove it completely.

The main architectural goals are:

- keep document meaning inside a canonical IR instead of spreading semantics across renderers
- preserve valid authored constructs, including transparent fenced extensions such as `mermaid`, without misclassifying them as fallback
- make fallback behavior explicit, centralized, and testable across flavors
- expose stable inspection APIs for CI, release validation, and downstream tooling
- keep package naming and extension entrypoints honest about current implementation maturity

The architecture is built around a real Assembler-backed extension entrypoint in `src/extension/index.ts` and a repository-owned markdown kernel in `src/exporter/**`, `src/markdown/**`, `scripts/inspection-report.ts`, and the test suite. Semantic meaning stays centralized, fallback stays explicit, transparent extensions stay semantic where safe, and rendered destinations stay tied to the assembled hrefs instead of being reconstructed in a separate routing layer.

The main uncertainty is no longer whether a real Antora registration path exists. It does. The remaining architectural concern is keeping that outer registration path, its converter coverage, and the public documentation aligned as the pipeline evolves.

## 1.3. Quality Goals

| Priority | Quality goal | Why it matters |
| --- | --- | --- |
| 1 | Deterministic, reviewable output | Semantic decisions stay centralized and rendered output stays stable enough for golden tests, release checks, and review. |
| 2 | Semantic fidelity with explicit escape hatches | The system should preserve valid author intent where safe and degrade visibly only through explicit policy. |
| 3 | Inspectable validation surfaces | Reusable inspection results should keep CI, release checks, and tooling off ad-hoc recursive traversal. |
| 4 | Honest public maturity signaling | Names, examples, and public docs must match the package surface the repository actually ships today. |

## 1.4. Stakeholders

| Role/Name | Contact | Expectations |
| --- | --- | --- |
| Architects and maintainers | Repository contributors | Need a clear account of current invariants, implemented boundaries, and known maturity gaps so architectural change does not silently weaken determinism. |
| Library consumers | Developers importing `@wsmy/antora-markdown-exporter` | Need stable render and inspection APIs, predictable flavor behavior, and accurate statements about package and extension maturity. |
| Release and CI owners | Maintainers of `.github/workflows/**`, `scripts/release-check.mjs`, and `scripts/inspection-report.ts` | Need deterministic validation surfaces, machine-readable inspection output, and repository self-consistency between scripts, packaging metadata, and tracked files. |
| Documentation authors using Antora content | Upstream AsciiDoc and Antora authors | Need preserved semantics for headings, xrefs, includes, admonitions, tables, images, anchors, aliases, and valid fenced extensions, plus visible degradation for unsupported constructs. |

# Chapter 2. Architecture Constraints

| Constraint | Source | Implication |
| --- | --- | --- |
| Reference fixtures are curated and provenance locked | `tests/reference/manifest.json`; curated reference-fixture policy | Reference tests must run against local snapshots with locked hashes and recorded provenance. The architecture must not depend on live upstream fetches for correctness or CI reproducibility. |
| Repository scripts and referenced files must stay in lockstep | `tests/unit/repository-contract.test.ts`; `package.json` | Build, test, release, README examples, and package metadata may only reference files that actually exist. Cleanup of stale scaffolding is a correctness constraint, not optional polish. |

# Chapter 3. Context and Scope

The repository sits between Antora-authored AsciiDoc content and downstream Markdown consumers. Its scope starts with assembled AsciiDoc input and ends with normalized Markdown documents, inspection reports, and publishable package artifacts.

## 3.1. Business Context

| Partner | Inputs to the repository | Outputs from the repository |
| --- | --- | --- |
| Documentation authors and maintainers | AsciiDoc content, Antora navigation structure, includes, xrefs, images, and release metadata | Deterministic Markdown exports, visible diagnostics for unsupported or invalid constructs, and documentation builds that stay aligned with the published package behavior |
| Library consumers | Assembled AsciiDoc strings and flavor-selection intent | Normalized Markdown IR, rendered Markdown in explicit flavors, and inspection reports for includes and xrefs |
| CI and release automation | Repository scripts, package metadata, fixture corpora, and tagged release inputs | Build validation results, inspection reports, packed release artifacts, and promoted documentation outputs |
| Package distribution and documentation hosting | Built package artifacts and release workflow outputs | npm publication for `@wsmy/antora-markdown-exporter` and published Antora site artifacts served from GitHub Pages |

The business boundary is intentionally narrow. The repository does not claim to be a general-purpose document conversion service. It owns one explicit pipeline for Antora-oriented AsciiDoc to Markdown conversion and validation.

## 3.2. Technical Context

| Technical interface | Role |
| --- | --- |
| Antora and Assembler | Provide the assembly and exporter extension boundary. The repository integrates through `@antora/assembler.configure()` and consumes assembled AsciiDoc as the converter input. |
| Repository conversion kernel | `src/exporter/**`, `src/markdown/**`, and `src/extension/**` implement AsciiDoc-to-IR conversion, normalization, rendering, and the Antora extension entrypoint. |
| Bun-first operator tooling | `Makefile`, `package.json`, and `scripts/**` provide the supported local execution path for build, validation, release, inspection reporting, and module Markdown export. |
| GitHub Actions | Runs CI, release publication, and Pages deployment workflows against certified repository states. |
| npm registry and GitHub Pages | Receive the published package and static documentation outputs after successful release automation. |

The technical context follows two rules. The canonical contract begins at assembled AsciiDoc, not at raw Antora source traversal. Documentation exports, release checks, and operator scripts also use the same conversion path instead of maintaining sidecar implementations.

# Chapter 4. Solution Strategy

The repository follows one explicit toolchain policy: development commands are delegated through the `Makefile`, which defaults to `PM ?= bun`, while npm remains the explicit publish transport and alternate package-manager path. This keeps command behavior predictable and avoids lockfile-based branching.

The broader architectural strategy is:

- keep the core contract inside repository-owned TypeScript modules instead of delegating semantics to external document-conversion chains
- keep development and CI entrypoints narrow and explicit through `make`, `package.json` scripts, and release-check automation
- accept pragmatic extension through explicit policy and tests rather than by loosening invariants

# Chapter 5. Building Block View

## 5.1. Whitebox Overall System

The repository separates the outer Antora integration boundary from the inner markdown kernel. Assembly, structural extraction, conversion, normalization, rendering, inspection, and release validation stay visible as distinct stages rather than collapsing into one opaque export step.

The main building blocks are:

| Building block | Responsibility |
| --- | --- |
| Extension entrypoint | `src/extension/index.ts` exposes `register()` and `createMarkdownConverter()`. `register()` delegates to `@antora/assembler.configure()` and makes the package usable as a real Antora exporter extension. |
| Structured assembly adapter | `src/adapter/assembly-structure.ts` defines the repository-owned structural handoff between assembled Antora input and future Markdown IR conversion. `src/adapter/assembly-structure-spec.ts` and the published `assemblyStructureInvariants` keep the contract explicit about loss rules, source locations, and unsupported-node semantics. This boundary must outlive any one extractor implementation. |
| Asciidoctor structural extractor | `src/adapter/asciidoctor-structure.ts` loads assembled source through Asciidoctor and maps supported document structure into the repository-owned assembly adapter. Helper modules under `src/adapter/asciidoctor-structure/` separate block extraction, inline extraction, xref normalization, and list/table helpers so branch-heavy semantics can be tested directly. Unsupported structural contexts remain explicit. |
| Structured conversion | `src/exporter/structured-to-markdown-ir.ts` converts repository-owned structured assembly into semantic Markdown IR nodes, preserving headings, xrefs, anchors, aliases, images, tables, admonitions, and other mapped structure without reparsing block syntax. |
| Markdown kernel | `src/markdown/ir.ts`, `src/markdown/normalize.ts`, and `src/markdown/render/**` define the canonical IR, normalize documents, and serialize preserved destinations during rendering. |
| Flavor renderers and fallback policy | `src/markdown/flavor.ts`, `src/markdown/fallback.ts`, and `src/markdown/render/**` define flavor capabilities, raw HTML and unsupported-node fallback policy, and the final markdown serializers. |
| Inspection and automation surfaces | `src/markdown/inspection.ts` and `scripts/inspection-report.ts` expose normalized inspection data for CI, release validation, and other tooling. |
| Package, CLI, and release boundary | `src/index.ts`, `package.json`, `bin/antora-markdown-exporter.js`, and `scripts/release-check.mjs` package the library-first API, CLI entrypoint, and release validation. |
| Test corpus | `tests/fixtures/**`, `tests/reference/**`, and `tests/**` encode golden-output, semantic-compatibility, provenance-locking, and repository-contract expectations. |

The most important interfaces are:

- `defineAssemblyDocument(document)` pins the repository-owned adapter contract for structured assembly input.
- `assemblyStructureInvariants` and `assemblyStructureSpecification` publish the contract rules for loss, source locations, and explicit unsupported nodes.
- `extractAssemblyStructure(source, options)` extracts supported document structure into the repository-owned assembly adapter.
- `convertAssemblyStructureToMarkdownIR(document)` converts repository-owned structured assembly into Markdown IR.
- `renderAssemblyMarkdown(source, flavor, sourcePath)` is the shipped extension runtime entrypoint for assembled AsciiDoc export.
- `normalizeMarkdownIR(document)` freezes the semantic shape expected by renderers and inspection helpers.
- `renderMarkdown(document, flavor)` and flavor-specific helpers serialize the normalized IR.
- `collectMarkdownInspectionReport(document)` provides normalized inspection data for includes and xrefs.

### 5.1.1. Markdown Kernel

The markdown kernel is the repository’s semantic center. It owns canonical node types, normalization, flavor capability lookup, fallback decisions, and rendering of the preserved assembled destinations.

Its implementation lives in `src/markdown/ir.ts`, `src/markdown/normalize.ts`, `src/markdown/flavor.ts`, `src/markdown/fallback.ts`, and `src/markdown/render/**`.

The remaining risk is not the absence of an outer Antora integration boundary. It is drift between the real extension entrypoint and the repository-owned conversion semantics that entrypoint is supposed to expose.

### 5.1.2. Conversion And Include Handling

The exporter converts assembled content into IR and keeps include semantics, provenance, and diagnostics available only when they are intentionally preserved. Private transport details are not part of the public contract.

Its shipped structured runtime lives in `src/extension/index.ts`, `src/adapter/asciidoctor-structure.ts`, `src/exporter/structured-to-markdown-ir.ts`, and `src/markdown/**`. Structured extraction and conversion are now the maintained runtime path.

The private marker transport is intentionally isolated. The main ongoing risk is conversion coverage for richer assembled AsciiDoc constructs, not missing registration itself. Recent helper-focused tests now pin sparse row handling, optional nested block accessors, labeled-group fallback paragraphs, and xref fallback-label policy directly at the adapter boundary instead of hiding those cases only in end-to-end fixtures.

### 5.1.3. Validation And Release Surfaces

Inspection helpers and scripts expose reusable validation outputs so downstream tooling does not walk the IR itself. Packaging and release scripts keep the repository aligned with its scoped npm package identity.

These surfaces live in `src/markdown/inspection.ts`, `scripts/inspection-report.ts`, `scripts/release-check.mjs`, and `package.json`.

# Chapter 6. Runtime View

## 6.1. Convert Assembled Content To Flavor-Specific Markdown

1. An upstream caller provides assembled AsciiDoc content to `renderAssemblyMarkdown(source, flavor, sourcePath)` or explicitly invokes `extractAssemblyStructure(source, { sourcePath })`.
2. `src/adapter/asciidoctor-structure.ts` loads the assembled content through Asciidoctor and maps supported structure into the repository-owned assembly adapter.
3. `convertAssemblyStructureToMarkdownIR(document)` lowers that structured assembly document into Markdown IR nodes.
4. The caller normalizes the document through `normalizeMarkdownIR`.
5. Xref targets remain structured until final link serialization in `src/markdown/render/**`.
6. A flavor renderer serializes the normalized document according to `src/markdown/flavor.ts` and `src/markdown/fallback.ts`.

The shipped runtime spans both the Assembler-backed extension entrypoint and the repository-owned structured conversion boundary. Coverage, docs, and CLI-facing policy controls must stay aligned with that structured runtime.

## 6.2. Collect Inspection Data For CI Or Release Validation

1. A caller converts source to IR, typically with a real file-backed `sourcePath`.
2. `collectMarkdownInspectionReport(document)` normalizes the document before traversal.
3. The inspection layer walks nested blocks, callout lists, footnote definitions, tables, and inline containers to gather xrefs and xref targets in normalized document order.
4. `scripts/inspection-report.ts` serializes that report either as JSON or GitHub Actions annotations.

Validation uses one maintained normalized inspection surface instead of separate ad-hoc traversals in CI scripts.

# Chapter 7. Deployment View

The repository does not ship a distributed runtime service. Its deployment view is therefore about execution environments for development, validation, release publication, and static documentation publishing.

## 7.1. Infrastructure Level 1

The most relevant deployment concern is not horizontal scaling. It is ensuring that local development, CI validation, npm publication, and GitHub Pages publication all execute the same package and documentation contracts.

Key deployment qualities are:

- deterministic builds from tracked repository inputs
- one Bun-first operator path for local validation
- one certified release path from `develop` through semver tags to `main`
- reproducible documentation artifacts for the published Antora site and repository markdown exports

The infrastructure mapping is:

| Environment | Mapped responsibilities |
| --- | --- |
| Local maintainer workstation | Runs `make install`, `make build`, `make test`, `make markdown`, `make docs`, and `make release`. This environment exercises the markdown kernel, inspection helpers, and documentation-export scripts before changes reach CI. |
| GitHub Actions CI on `develop` | Runs repository validation, unit and integration tests, fixture golden tests, reference tests, repository-contract checks, and build verification on the integration branch. |
| GitHub Actions release workflow | Validates tagged commits from `develop`, rebuilds the package, runs release checks, publishes `@wsmy/antora-markdown-exporter`, attaches release assets, and fast-forwards `main` to the certified release commit. |
| GitHub Actions Pages workflow | Builds the Antora site from `main` after successful release completion and publishes the static site to `https://wstein.github.io/antora-markdown-exporter`. |
| npm registry and GitHub Pages | Receive the packaged library artifacts and static documentation outputs that the repository automation promotes. |

## 7.2. Infrastructure Level 2

### 7.2.1. Local Validation Surface

The local validation surface consists of the Bun runtime, repository scripts in `scripts/**`, the `Makefile`, and the working tree inputs under `src/**`, `tests/**`, and `docs/**`.

This level exists to catch semantic drift before release:

- the same converter and renderer power package APIs, inspection reporting, and module Markdown export
- the assembled module-source path powers module Markdown export
- operator commands remain thin wrappers over maintained repository entrypoints

### 7.2.2. Release and Publication Surface

The release and publication surface consists of `.github/workflows/release.yml`, `.github/workflows/pages.yml`, `package.json`, `scripts/release-check.mjs`, `antora-playbook.yml`, and the generated artifacts under `dist/**`, `build/site/**`, and `build/markdown/**`.

This level exists to make publication trustworthy:

- release publication only starts from a semantic version tag on a certified `develop` commit
- `main` tracks published history rather than day-to-day integration work
- Pages publishes only after the release workflow has promoted the published commit
- documentation artifacts and package artifacts stay coupled to the same repository state

# Chapter 8. Cross-cutting Concepts

This section collects concepts that shape multiple architectural areas at once rather than belonging to a single converter or workflow component.

## 8.1. Deterministic Contract Testing

The repository validates architecture boundaries at multiple levels:

- unit tests pin IR, normalization, fallback, xref resolution, and repository-contract behavior
- integration golden tests render fixture inputs and compare full output against `expected.<flavor>.md`
- reference tests use provenance-locked external snapshots to check semantic invariants rather than exact bytes
- inspection-helper tests keep validation surfaces reusable and deterministic

This concept cuts across the exporter, markdown kernel, inspection layer, packaging, and release automation. It is how the architecture proves that semantic decisions remain centralized and that flavor-specific behavior does not drift invisibly.

# Chapter 9. Architecture Decisions

| Decision | Rationale | Current consequence |
| --- | --- | --- |
| Use Antora Assembler as the export boundary | The repository should expose a real Antora exporter extension, not a metadata-only helper. | `src/extension/index.ts` registers through `@antora/assembler.configure()` and keeps assembly outside renderer-local logic. |
| Keep the Markdown IR as the canonical semantic boundary | Semantic decisions should stay centralized and testable. | Conversion changes must land in the exporter, IR, normalization, or renderer layers rather than as ad-hoc string rewrites. |
| Centralize fallback policy instead of flavor-local degradation | Valid semantic preservation and controlled degradation must stay distinct. | Unsupported constructs and raw HTML policy are owned by `src/markdown/fallback.ts`, while valid semantic constructs remain ordinary IR nodes. |
| Use one semantic export path for package APIs, module Markdown export, and inspection tooling | Repository exports should stay on the same converter path as the package API. | `make markdown`, inspection scripts, and library consumers all depend on the same `extractAssemblyStructure -> convertAssemblyStructureToMarkdownIR -> normalizeMarkdownIR -> renderMarkdown` contract. |
| Prefer Assembler-owned assembly partitioning over repository-local export rules | Antora navigation and Assembler configuration should decide where exports begin. | `antora-assembler.yml` pins the repository default to `root_level: 1`, `src/extension/index.ts` applies the same default when no explicit config source is provided, and the repository scripts run through the real Antora generator and Assembler path. |
| Use `develop` for integration and `main` for published history | The release path needs one certified integration state and one published history branch. | Release automation can verify one certified input state, then promote `main` and Pages publication only after successful publication steps. |

These decisions are intentionally implementation-facing. They explain why the repository keeps resisting shortcut conversions, flavor-local semantics, and duplicated export paths even when those shortcuts might appear simpler in the short term.

# Chapter 10. Quality Requirements

## 10.1. Quality Requirements Overview

| Category | Requirement |
| --- | --- |
| Determinism | The same normalized IR and flavor must produce the same rendered output and the same inspection ordering on every run. |
| Compatibility | Representative Antora authoring patterns must remain covered by curated reference fixtures with locked provenance and semantic assertions. |
| Fidelity | Valid semantic constructs, including transparent fenced extensions, must be preserved explicitly where safe. |
| Honesty | Public package surfaces and docs must not imply a fuller Antora integration than the code currently implements. |

## 10.2. Proof Matrix

| Claim | Status | Evidence surface | Proof files |
| --- | --- | --- | --- |
| Deterministic output and stable inspection ordering | `Implemented`, `Test-enforced` | Canonical semantic pipeline and golden/reference checks | `src/exporter/**`; `src/markdown/**`; `tests/integration/fixture-golden.test.ts`; `tests/integration/module-export-golden.test.ts`; `tests/integration/reference-antora.test.ts` |
| Centralized fallback policy | `Implemented`, `Test-enforced` | One fallback layer shared by renderers | `src/markdown/fallback.ts`; `tests/unit/fallback.test.ts`; `tests/integration/raw-html-policy.test.ts` |
| Reusable inspection surfaces | `Implemented`, `Test-enforced` | Inspection helpers and machine-readable reporting | `src/markdown/inspection.ts`; `scripts/inspection-report.ts`; `tests/unit/inspection.test.ts`; `tests/unit/inspection-report-script.test.ts` |
| Module export follows the package pipeline | `Implemented`, `Test-enforced` | Assembler-backed partition defaults plus module-export tests | `antora-assembler.yml`; `src/extension/index.ts`; `scripts/export-antora-modules.ts`; `tests/unit/export-antora-modules.test.ts`; `tests/integration/module-export-golden.test.ts` |
| Release promotion and Pages publication | `CI-enforced` | Tag-triggered release workflow and follow-on Pages workflow | `.github/workflows/release.yml`; `.github/workflows/pages.yml`; `tests/unit/repository-contract.test.ts` |
| Broader converter coverage beyond the published matrix | `Intended` | Future semantic extensions and fixtures | Support matrix in the operator manual; note `Converter coverage should be published as a support matrix` |

## 10.3. Evidence Ledger

| Claim family | Implementation evidence | Test evidence | Workflow evidence | Boundary note |
| --- | --- | --- | --- | --- |
| Semantic conversion stays explicit | `src/adapter/assembly-structure.ts`; `src/adapter/assembly-structure-spec.ts`; `src/adapter/asciidoctor-structure.ts`; `src/exporter/structured-to-markdown-ir.ts`; `src/markdown/ir.ts` | `tests/unit/assembly-structure.test.ts`; `tests/unit/asciidoctor-structure.test.ts`; `tests/unit/asciidoctor-block-helpers.test.ts`; `tests/unit/structured-to-markdown-ir.test.ts`; `tests/unit/ir.test.ts` | `bun run check` | Semantic extensions should land in structured extraction and IR-aware conversion, not renderer-local rewrites. Adapter invariants, the published specification, and focused helper tests are part of the proof surface. |
| Workflow claims stay auditable | `scripts/release-check.mjs`; `scripts/export-antora-modules.ts` | `tests/unit/repository-contract.test.ts`; `tests/unit/export-antora-modules.test.ts` | `.github/workflows/ci.yml`; `.github/workflows/release.yml`; `.github/workflows/pages.yml` | Release and publication claims require both local contract tests and workflow references. |
| Compatibility claims stay curated | `tests/reference/manifest.json` | `tests/integration/reference-antora.test.ts` | `make reference` | Coverage tags and provenance are part of the proof surface, not metadata garnish. |

## 10.4. Quality Scenarios

### 10.4.1. QS-1 Deterministic Golden Rendering

**Context/Background:** Local fixture tests exercise the canonical render contract.

**Source/Stimulus:** A contributor changes conversion, normalization, fallback, or renderer code.

**Artifact:** `src/exporter/**`, `src/markdown/**`, `tests/integration/fixture-golden.test.ts`

**Response:** The test suite renders fixture input and compares complete output against `expected.<flavor>.md`.

**Response Measure:** Any unexpected byte-level output drift fails the golden test.

**Traceability:** `Golden tests require rendered output comparison`; `Testing relies on golden fixtures and deterministic snapshots`

### 10.4.2. QS-2 Reference Compatibility With Locked Provenance

**Context/Background:** The project validates realistic Antora content without using live upstream documents as byte-exact truth.

**Source/Stimulus:** A maintainer refreshes or adds reference fixtures.

**Artifact:** `tests/reference/**`, `tests/integration/reference-antora.test.ts`

**Response:** The suite verifies the locked `sha256`, provenance metadata, expected node types, and selected rendered markers while avoiding brittle whole-file byte comparisons.

**Response Measure:** A changed snapshot without manifest alignment, or a semantic regression in links, includes, admonitions, tables, images, or visible fallback markers, fails the reference test.

**Traceability:** `Reference testing uses official Antora documentation as a compatibility corpus`; `Reference tests check semantic invariants not exact bytes`; `Reference fixtures are curated and provenance locked`; `Reference corpus should cover navigation xrefs includes and admonitions`

### 10.4.3. QS-3 Valid Extensions Stay Out Of Fallback

**Context/Background:** A source document contains a fenced code block with an authored language tag such as `mermaid`.

**Source/Stimulus:** The exporter encounters a semantically valid but flavor-specific construct.

**Artifact:** `src/adapter/asciidoctor-structure.ts`, `src/exporter/structured-to-markdown-ir.ts`, `src/markdown/fallback.ts`, renderer modules

**Response:** The converter emits a semantic `codeBlock`, renderers preserve the language tag verbatim, and fallback is not invoked merely because the downstream tool may interpret that language specially.

**Response Measure:** Rendered output retains the original fence language and contains no `Unsupported` fallback marker for that block.

**Traceability:** `Transparent extensions are not fallback mechanisms`; `The architecture favors explicit extension over implicit degradation`

### 10.4.4. QS-4 Repository Self-Consistency Before Release

**Context/Background:** A release or CI run validates packaging, scripts, and tracked files.

**Source/Stimulus:** A contributor changes scripts, publish metadata, README commands, or repository layout.

**Artifact:** `package.json`, `README.md`, `Makefile`, `.github/workflows/**`, `tests/unit/repository-contract.test.ts`

**Response:** Contract tests verify that referenced files exist, that removed scaffold artifacts stay removed, and that release scripts target the actual package structure.

**Response Measure:** Missing referenced files, stale scaffold paths, or misaligned package metadata fail the repository-contract suite or release checks.

**Traceability:** `Repository scripts and referenced files must stay in lockstep`; `Golden tests require rendered output comparison`

# Chapter 11. Risks and Technical Debts

The main current risk is no longer a missing extension boundary. It is drift between the real extension entrypoint, the converter’s actual coverage, and the way docs or package examples describe that coverage.

| Priority | Risk and mitigation |
| --- | --- |
| 1 | The repository now ships a real extension entrypoint as well as the markdown kernel. The main risk is drift between the extension entrypoint, the converter’s real coverage, and the way docs or package examples describe that coverage. Mitigation: \* keep the real extension entrypoint, README examples, and release checks aligned \* remove dead scaffolding artifacts when they linger in docs or tests \* treat repository self-consistency checks as release gates \* extend converter coverage and tests together whenever richer assembled AsciiDoc constructs are supported |

# Chapter 12. Reference Notes

This section is the reference index for canonical notes cited by the architecture document.

| Section | Referenced notes |
| --- | --- |
| Introduction and Goals | `Antora extension entrypoints must reflect actual integration maturity`; `Exporter pipeline uses Assembler and a direct TypeScript converter`; `Fallback selection is centralized across markdown flavors`; `Flavor renderers are syntax adapters over one semantic layer`; `Preserved include metadata uses private transport details`; `Markdown IR is the canonical render boundary`; `Strict architecture must be extended without weakening invariants`; `The architecture favors explicit extension over implicit degradation`; `Transparent extensions are not fallback mechanisms`; `Xref destinations come from assembled hrefs` |
| Constraints | `Reference fixtures are curated and provenance locked`; `Repository scripts and referenced files must stay in lockstep` |
| Solution Strategy | `Build tooling uses bun-first package manager fallback` |
| Runtime View | `Inspection helpers expose normalized validation surfaces`; `Release and package identity use scoped npm publishing` |
| Cross-cutting Concepts | `Testing relies on golden fixtures and deterministic snapshots` |
| Quality Requirements | `Golden tests require rendered output comparison`; `Reference corpus should cover navigation xrefs includes and admonitions`; `Reference fixtures are curated and provenance locked`; `Reference testing uses official Antora documentation as a compatibility corpus`; `Reference tests check semantic invariants not exact bytes` |
| Risks and Technical Debt | `Scaffold leftovers must be removed before contract expansion` |

The notes remain canonical inputs. The codebase remains the authoritative statement of what is implemented today when note intent and implementation maturity differ.

