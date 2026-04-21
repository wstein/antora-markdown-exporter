# Operator Manual

## Table of Contents

- [Chapter 1. Core Workflows](#chapter-1-core-workflows)
  - [1.1. Run The Standard Repository Loop](#11-run-the-standard-repository-loop)
  - [1.2. Generate An Inspection Report](#12-generate-an-inspection-report)
  - [1.3. Start And Finalize A Release](#13-start-and-finalize-a-release)
- [Chapter 2. Commands And Behavior](#chapter-2-commands-and-behavior)
  - [2.1. Primary Commands](#21-primary-commands)
  - [2.2. Inspection Script Behavior](#22-inspection-script-behavior)
- [Chapter 3. Validation And Troubleshooting](#chapter-3-validation-and-troubleshooting)
  - [3.1. Golden Tests: What Counts And What Does Not](#31-golden-tests-what-counts-and-what-does-not)
  - [3.2. Use Inspection Helpers Instead Of Ad-Hoc Traversal](#32-use-inspection-helpers-instead-of-ad-hoc-traversal)
  - [3.3. Reference Fixtures: Coverage, Provenance, And Scope](#33-reference-fixtures-coverage-provenance-and-scope)
  - [3.4. Common Failure Modes](#34-common-failure-modes)
- [Chapter 4. Release And Integrity](#chapter-4-release-and-integrity)
  - [4.1. Package Identity And Publish Checks](#41-package-identity-and-publish-checks)
  - [4.2. Keep Scripts, Docs, And Files In Lockstep](#42-keep-scripts-docs-and-files-in-lockstep)
- [Chapter 5. Reference Notes](#chapter-5-reference-notes)

This manual is for operators and maintainers who need to run, validate, and release `@wsmy/antora-markdown-exporter` using the repository’s supported workflows.

The manual is task-oriented on purpose. For contributor-first explanations, see the onboarding guide. For the most precise architectural statements, prefer the cited notes and the implementation files they point to.

When notes describe a broader intended system than the code currently ships, this manual preserves that uncertainty explicitly. In particular, the repository now exposes both a real markdown conversion and validation kernel and a real Assembler-backed Antora extension entrypoint.

# Chapter 1. Core Workflows

## 1.1. Run The Standard Repository Loop

The repository’s primary execution path is Bun-first through `make` and `package.json` scripts.

Recommended operator loop:

1. Install dependencies:
  ```bash
  make install
  ```
2. Build distributable artifacts:
  ```bash
  make build
  ```
3. Run the full test and validation suite:
  ```bash
  make test
  ```
4. Run narrower scopes when you need faster feedback:
  ```bash
  make unit
  make integration
  make reference
  ```
5. Build the docs site when validating documentation changes:
  ```bash
  make docs
  ```
6. Build only the assembled documentation PDFs when you need the portable module documents without the full HTML site:
  ```bash
  make pdf
  ```

That build now emits:

- the static Antora site under `build/site`
- downloadable module PDFs at `build/site/antora-markdown-exporter/architecture.pdf`, `build/site/antora-markdown-exporter/manual.pdf`, and `build/site/antora-markdown-exporter/onboarding.pdf`

1. Export Antora module pages to Markdown when you need generated Markdown artifacts from the repository’s own pipeline:
  ```bash
  make markdown
  ```

That export emits:

- flat module documents at `build/markdown/architecture.md`, `build/markdown/manual.md`, and `build/markdown/onboarding.md`
- one assembled `.md` file for each exported documentation module
- output built from the same assembled module sources as the repository PDFs and rendered through the same conversion, normalization, and flavor pipeline used by the package API
- no post-render Markdown cleanup layer; if the generated Markdown is wrong, the fix belongs in the converter or renderer

1. Let the Pages workflow publish the static site only after a successful tag-triggered `Release` workflow:
  - local docs validation happens on your working branch
  - public publication to `https://wstein.github.io/antora-markdown-exporter` happens from `.github/workflows/pages.yml`
  - the Pages workflow checks out `main`, which the release workflow has already promoted

Why this workflow exists:

- the note `Release and package identity use scoped npm publishing` expects the repository to behave like a publishable TypeScript package
- the notes `Repository scripts and referenced files must stay in lockstep` and `Testing relies on golden fixtures and deterministic snapshots` require stable, explicit validation entrypoints
- Bun is the primary development runtime, while npm remains the publish transport

Current uncertainty to preserve:

- the package and docs describe an Antora exporter pipeline
- the repository clearly implements conversion, rendering, inspection, testing, and release checks
- the extension boundary in `src/extension/index.ts` is now part of the supported runtime path

## 1.2. Generate An Inspection Report

Use the inspection script when you need machine-readable validation for include diagnostics and xref metadata.

File-backed input:

```bash
make inspect-report INPUT=tests/fixtures/includes-invalid-steps/input.adoc
```

Equivalent direct script invocation:

```bash
bun run inspect:report -- tests/fixtures/includes-invalid-steps/input.adoc
```

Read from standard input:

```bash
cat generated-page.adoc | bun run inspect:report -- --stdin \
  --source-path /workspace/modules/ROOT/pages/generated-page.adoc
```

Fail the command when include diagnostics are present:

```bash
bun run inspect:report -- tests/fixtures/includes-invalid-steps/input.adoc \
  --fail-on-diagnostics
```

Emit GitHub Actions annotations instead of JSON:

```bash
bun run inspect:report -- tests/fixtures/includes-invalid-steps/input.adoc \
  --format github-actions \
  --fail-on-diagnostics
```

Inputs:

- one input file path, or `--stdin`
- optional `--source-path` to preserve source identity in the output
- optional `--format json|github-actions`
- optional `--fail-on-diagnostics`

Outputs:

- JSON payload with `inputPath`, `sourcePath`, and a normalized inspection report
- or GitHub Actions `::error`, `::warning`, and `::notice` annotations

Operator rule:

- use this script for validation and reporting
- do not reimplement IR traversal in CI or release scripts unless the library API cannot express the needed behavior

## 1.3. Start And Finalize A Release

The release operating model uses `develop` as the integration branch, `main` as published history, and semver tags as the publish trigger.

Start a release candidate from a clean `develop` worktree:

```bash
make release VERSION=v0.1.0
```

That command:

- updates `package.json` and `package-lock.json` when present
- commits `chore(release): start v0.1.0`
- pushes `develop`

After the candidate commit has passed CI on `develop`, finalize from the same clean certified commit:

```bash
make release VERSION=v0.1.0 YES=1
```

With the same version as `package.json`, the wizard switches to finalize mode, creates the annotated tag, and pushes only the tag.

The release workflow in `.github/workflows/release.yml` then:

- verifies the tag is semantic and points at the checked-out commit
- verifies the tagged commit is contained in `develop`
- verifies that commit already passed the `CI` workflow on `develop`
- rebuilds and revalidates the package
- packs one tarball artifact
- publishes `@wsmy/antora-markdown-exporter` from that tarball
- attaches release assets on GitHub
- fast-forwards `main` to the released commit

After `.github/workflows/release.yml` completes successfully for a tag-triggered release, `.github/workflows/pages.yml` runs from `workflow_run`, rebuilds the Antora site from `antora-playbook.yml` on `main`, and publishes `build/site` to GitHub Pages at `https://wstein.github.io/antora-markdown-exporter`.

What `scripts/release-check.mjs` verifies during that process:

- required `dist/**` artifacts exist
- ESM and CJS root exports load
- ESM and CJS extension exports load
- `renderGfm` and `collectMarkdownInspectionReport` are exported from the root package
- `createMarkdownConverter` and `register` are exported from the extension package
- inspection reports retain include diagnostics
- `npm pack --dry-run --json` contains required publish artifacts and excludes forbidden bundle output

Important conflict to preserve:

- the package identity and publish workflow are real
- the extension export is also real and packaged
- the extension package now implements the Antora runtime registration contract through Assembler

# Chapter 2. Commands And Behavior

## 2.1. Primary Commands

| Command | Behavior |
| --- | --- |
| `make install` | Installs dependencies using the configured package manager. Defaults to Bun because `PM ?= bun`. |
| `make build` | Runs the package build and emits `dist/**` artifacts for the library and extension entrypoints. |
| `make test` | Runs the full Vitest suite with coverage through the configured package manager. |
| `make unit` | Runs unit tests only. |
| `make integration` | Runs integration tests only. |
| `make reference` | Runs the reference compatibility suite in `tests/integration/reference-antora.test.ts`. |
| `make inspect-report INPUT=...` | Emits a machine-readable inspection report for one input file by delegating to `bun run inspect:report`. |
| `make markdown` | Exports assembled module documents to `build/markdown/architecture.md`, `build/markdown/manual.md`, and `build/markdown/onboarding.md` by delegating to `bun run export:modules`. The export uses the same assembled module sources as the repository PDFs and the same converter path as the package API. |
| `make pdf` | Builds the assembled architecture, manual, and onboarding PDFs at `build/site/antora-markdown-exporter/*.pdf` without rebuilding the full Antora HTML site. |
| `bun run check` | Runs Biome checks and the full coverage-enabled Vitest suite. |
| `bun run release:check` | Runs pre-publish package integrity checks against built artifacts and `npm pack --dry-run`. |
| `make release VERSION=vX.Y.Z` | Runs the release wizard on `develop`. A new version starts a release candidate; the current untagged version finalizes by creating and pushing the release tag. |
| `make docs` | Builds the Antora docs site locally into `build/site` and emits downloadable module PDFs at `build/site/antora-markdown-exporter/architecture.pdf`, `build/site/antora-markdown-exporter/manual.pdf`, and `build/site/antora-markdown-exporter/onboarding.pdf`. Public publication is handled separately by the GitHub Pages workflow after successful tag-triggered release completion. |

## 2.2. Inspection Script Behavior

The inspection script accepts these supported modes:

- path input
- stdin input
- JSON output
- GitHub Actions annotation output
- non-zero exit on diagnostics with `--fail-on-diagnostics`

Known behavior from the implementation and tests:

- `empty-tag-selection` is emitted as a warning in GitHub Actions mode
- other include diagnostics currently emit as errors in GitHub Actions mode
- mixed `--stdin` plus a file path is rejected
- missing file input is rejected
- invalid `--format` values are rejected

These failure modes print a usage message and exit with a non-zero status.

# Chapter 3. Validation And Troubleshooting

## 3.1. Golden Tests: What Counts And What Does Not

The notes `Testing relies on golden fixtures and deterministic snapshots` and `Golden tests require rendered output comparison` define the exact-output contract.

A true golden validation path must:

1. convert AsciiDoc input into Markdown IR
2. normalize the IR
3. render a specific flavor
4. compare the rendered output against `expected.<flavor>.md`

If a test loads a fixture but never compares rendered output, it is not a golden test in this repository’s terminology.

Where to look:

- `tests/integration/fixture-golden.test.ts`
- `tests/fixtures/**`

Troubleshooting guidance:

- if a rendering change is intentional, review the exact flavor outputs
- if a change only updates structure assertions without touching expected markdown, the test may not be covering the real contract you think it covers

## 3.2. Use Inspection Helpers Instead Of Ad-Hoc Traversal

The note `Inspection helpers expose normalized validation surfaces` is the operator rule for diagnostics and reporting.

Use:

- `collectIncludeDiagnostics`
- `collectIncludeDirectives`
- `collectXrefs`
- `collectXrefTargets`
- `collectMarkdownInspectionReport`

Do not:

- reimplement traversal logic in CI without a strong reason
- mix inspection concerns into renderer policy code
- sort report output in downstream consumers unless you are intentionally changing presentation only

Troubleshooting hint:

If two validation consumers disagree, verify that both are operating on normalized documents and that one has not reimplemented traversal incompletely.

## 3.3. Reference Fixtures: Coverage, Provenance, And Scope

Four notes define the reference suite:

- `Reference testing uses official Antora documentation as a compatibility corpus`
- `Reference fixtures are curated and provenance locked`
- `Reference corpus should cover navigation xrefs includes and admonitions`
- `Reference tests check semantic invariants not exact bytes`

Operator guidance:

- use local fixtures for exact-output checks
- use reference fixtures for realistic semantic compatibility checks
- keep reference snapshots curated and provenance-locked
- refresh reference coverage deliberately instead of mirroring large upstream trees

What the manifest records:

- source project
- source paths
- capture date
- local path
- `sha256`
- coverage tags
- rationale
- semantic expectations

Troubleshooting guidance:

- if a reference test fails because the hash changed, confirm whether the snapshot was intentionally refreshed
- if a reference test passes but real regressions slipped through, the next step is often better coverage tags or a better representative fixture, not a bigger uncurated corpus

## 3.4. Common Failure Modes

| Failure mode | What to check |
| --- | --- |
| Golden output changed unexpectedly | Review `tests/integration/fixture-golden.test.ts`, the affected `expected.<flavor>.md` files, normalization logic, fallback behavior, and flavor routing. |
| Inspection report exits non-zero | Check include diagnostics in the emitted JSON or GitHub Actions output. `invalid-line-step`, `invalid-line-range`, `invalid-indent`, and similar failures come from include semantics. |
| GitHub Actions annotations look incomplete | Confirm the script is using `--format github-actions`, and that the consumer did not bypass `collectMarkdownInspectionReport`. |
| Reference suite is noisy | Check whether the issue is a hash drift, a stale coverage assumption in `tests/reference/manifest.json`, or a real semantic regression in xrefs, includes, fallback, tables, or admonitions. |

# Chapter 4. Release And Integrity

## 4.1. Package Identity And Publish Checks

The note `Release and package identity use scoped npm publishing` is the release anchor.

The repository publishes as `@wsmy/antora-markdown-exporter` and is expected to behave like a publishable TypeScript package.

Release integrity checks should confirm:

- built contents exist in `dist/**`
- the exports map is coherent
- CLI and package metadata are aligned
- release validation uses the same semantic inspection surfaces as the rest of the repository

Current conflict to preserve:

- the package identity is real and enforced
- the extension export is also real and packaged
- the extension export is a real runtime integration surface and should stay aligned with package docs and release checks

## 4.2. Keep Scripts, Docs, And Files In Lockstep

The note `Repository scripts and referenced files must stay in lockstep` is the repository integrity rule.

Before considering a release or operational change complete, verify that:

- `package.json` scripts point to real files
- `bin` entries point to real files
- `README.md` commands still match the current repo
- CI workflows use the intended commands
- tests refer to files that still exist

In this repository, stale references are blocking issues, not cleanup backlog.

# Chapter 5. Reference Notes

This manual is primarily grounded in the following notes:

- `Golden tests require rendered output comparison`
- `Inspection helpers expose normalized validation surfaces`
- `Reference corpus should cover navigation xrefs includes and admonitions`
- `Reference fixtures are curated and provenance locked`
- `Reference testing uses official Antora documentation as a compatibility corpus`
- `Reference tests check semantic invariants not exact bytes`
- `Testing relies on golden fixtures and deterministic snapshots`
- `Release and package identity use scoped npm publishing`
- `Repository scripts and referenced files must stay in lockstep`

Use the notes for canonical rationale, and use the cited code files for current operational truth.

