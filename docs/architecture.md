<!-- GENERATED FILE — DO NOT EDIT DIRECTLY -->
<!-- Source: notes/**  Generator: scripts/generate-architecture-docs.ts -->
<!-- Regenerate with: bun run docs:generate -->

# Architecture

This document is a derived, read-only narrative view over the repository's atomic notes. The atomic notes in [`notes/`](../notes) remain the canonical source of truth for architectural decisions, invariants, and rendering policy.

Edits to architectural intent must land in `notes/` first. This file is regenerated from a curated note order and should never be modified by hand.

```bash
bun run docs:generate
```

## Contents

- [Foundational Principles](#foundational-principles)
  - [Strict architecture must be extended without weakening invariants](#strict-architecture-must-be-extended-without-weakening-invariants)
  - [The architecture favors explicit extension over implicit degradation](#the-architecture-favors-explicit-extension-over-implicit-degradation)
- [Exporter Pipeline](#exporter-pipeline)
  - [Exporter pipeline uses Assembler and a direct TypeScript converter](#exporter-pipeline-uses-assembler-and-a-direct-typescript-converter)
- [Markdown IR Boundary](#markdown-ir-boundary)
  - [Markdown IR is the canonical render boundary](#markdown-ir-is-the-canonical-render-boundary)
- [Renderer And Flavor Model](#renderer-and-flavor-model)
  - [Flavor renderers are syntax adapters over one semantic layer](#flavor-renderers-are-syntax-adapters-over-one-semantic-layer)
- [Fallback Policy](#fallback-policy)
  - [Raw HTML is a controlled fallback not a default rendering path](#raw-html-is-a-controlled-fallback-not-a-default-rendering-path)
  - [Fallback selection is centralized across markdown flavors](#fallback-selection-is-centralized-across-markdown-flavors)
- [Transparent Extensions](#transparent-extensions)
  - [Transparent fenced extensions preserve authored language semantics](#transparent-fenced-extensions-preserve-authored-language-semantics)
  - [Transparent extensions are not fallback mechanisms](#transparent-extensions-are-not-fallback-mechanisms)
- [Xref Lowering](#xref-lowering)
  - [Xref target resolution is a separate lowering phase](#xref-target-resolution-is-a-separate-lowering-phase)
- [Include Handling](#include-handling)
  - [Include metadata transport is an internal implementation detail](#include-metadata-transport-is-an-internal-implementation-detail)
- [Testing And Validation](#testing-and-validation)
  - [Testing relies on golden fixtures and deterministic snapshots](#testing-relies-on-golden-fixtures-and-deterministic-snapshots)
  - [Inspection helpers expose normalized validation surfaces](#inspection-helpers-expose-normalized-validation-surfaces)
- [Release And Tooling](#release-and-tooling)
  - [Repository scripts and referenced files must stay in lockstep](#repository-scripts-and-referenced-files-must-stay-in-lockstep)

## Foundational Principles

Overarching rules that govern how the exporter evolves. New capabilities must satisfy these principles before they reach the IR, renderers, or fallback layer.

### Strict architecture must be extended without weakening invariants

Strict architecture must be extended without weakening invariants because real-world document conversion inevitably encounters formats and constructs that exceed any fixed semantic model, yet relaxing core constraints would destroy determinism and testability.

#### What

The repository enforces a strict semantic pipeline based on a canonical Markdown IR, deterministic normalization, and explicit renderer policies.

Feedback correctly identifies that:
- markdown ecosystems are fragmented
- real documents contain constructs not covered by the IR
- fallback behavior is unavoidable

However, the correct response is not to loosen constraints or allow implicit behavior.

Instead, the system must introduce controlled extension points that:
- preserve semantic integrity
- keep fallback behavior explicit
- maintain deterministic output contracts

#### Why

Relaxing invariants leads to:
- hidden semantic drift
- inconsistent rendering across flavors
- untestable behavior
- loss of trust in the exporter

Strictness is not the problem. Uncontrolled flexibility is.

The system must evolve by adding explicit, testable escape hatches, not by weakening boundaries.

#### How

When encountering constructs outside the current IR:

- do not silently pass them through
- do not implicitly reinterpret them
- do not degrade them without visibility

Instead:

- extend the IR with controlled nodes when necessary
- introduce explicit passthrough categories where safe
- route all non-native behavior through centralized policy layers

Every extension must still satisfy:
- IR representation or explicit classification
- normalization rules or explicit exemption
- renderer behavior
- test coverage

#### Links

- [[Markdown IR is the canonical render boundary]] - Core invariant that must not be weakened.
- [[Fallback selection is centralized across markdown flavors]] - Escape hatches must be policy-driven.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Extensions must not bypass semantic boundaries.
- src/markdown/ir.ts - Canonical semantic model.

### The architecture favors explicit extension over implicit degradation

The architecture favors explicit extension over implicit degradation because preserving valid author intent is more valuable than forcing all constructs into a reduced common denominator.

#### What

When the system encounters constructs outside the core Markdown model:

- it prefers preserving them explicitly where safe
- instead of degrading them silently

This applies especially to:
- fenced language blocks such as `mermaid`

#### Why

Implicit degradation:
- hides intent
- creates inconsistent output
- breaks downstream tooling

Explicit extension:
- preserves information
- remains deterministic
- allows downstream systems to add value

#### How

Prefer:

- preserving semantic nodes
- preserving language identifiers
- using fallback only when necessary

Avoid:

- rewriting valid constructs
- implicit conversions
- lossy normalization

#### Links

- [[Strict architecture must be extended without weakening invariants]]
- [[Transparent fenced extensions preserve authored language semantics]]

## Exporter Pipeline

The three-stage pipeline that turns Antora Assembler output into Markdown through a single canonical semantic layer.

### Exporter pipeline uses Assembler and a direct TypeScript converter

The exporter pipeline uses Antora Assembler to produce assembled AsciiDoc and then hands that document to a direct TypeScript converter rather than routing through Pandoc or DocBook. This preserves deterministic control over semantics, fallbacks, and flavor-specific rendering.


#### What


The repository adopts a three-stage export pipeline:


1. Antora Assembler builds the assembled source document.
2. The TypeScript exporter maps assembled AsciiDoc into a Markdown semantic layer.
3. Flavor renderers serialize that semantic layer into concrete Markdown output.


The converter is direct by design. External document-conversion tools are excluded from the core contract.


#### Why


The project targets deterministic, reviewable Markdown output. A direct converter keeps semantic decisions inside the repository, makes fallback behavior testable, and avoids hidden behavior from general-purpose conversion tools.


This also keeps Antora-specific concerns near the extension boundary while preserving a stable internal render contract.


#### How


Implement the Antora integration in `src/extension/**` and the assembly conversion boundary in `src/exporter/**`.


Treat the assembled AsciiDoc document as the last Antora-facing artifact. After that point, all decisions must move through the Markdown semantic layer in `src/markdown/**`, including dedicated xref target metadata, dedicated anchors, page-alias metadata, include-directive metadata, images, admonitions, aligned tables, callouts, and recursive include inlining with tagged regions, multi-tag selection, line ranges, indentation, and `leveloffset` handling when source context is available. Xref destination shaping is a separate lowering phase in `src/markdown/xref-resolution.ts`, so renderers can serialize already-resolved destinations without owning Antora routing policy. Include metadata transport is isolated behind `src/exporter/include-metadata.ts`, so the converter no longer hardcodes the HTML-comment marker format in its general parsing logic.


Do not add Pandoc, DocBook, or HTML-to-Markdown fallback chains to the primary path.


#### Links


- [[Markdown IR is the canonical render boundary]] - The semantic layer formalizes the direct conversion contract.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderer implementations depend on this pipeline boundary.
- [[Include metadata transport is an internal implementation detail]] - Include marker transport should stay isolated from general conversion logic.
- [[Xref target resolution is a separate lowering phase]] - Xref routing is resolved before markdown link serialization.
- src/extension/index.ts - Antora extension registration entrypoint.
- src/exporter/convert-assembly.ts - Assembly-to-IR conversion boundary.

## Markdown IR Boundary

The semantic intermediate representation that decouples document meaning from any concrete Markdown flavor.

### Markdown IR is the canonical render boundary

The Markdown IR is the canonical render boundary for the repository and preserves document meaning independently from any concrete Markdown flavor. All renderer logic must consume normalized semantic nodes instead of source-specific or syntax-specific structures.


#### What


The repository currently defines a custom Markdown intermediate representation for headings, paragraphs, inline emphasis and strong spans, code, links, dedicated xrefs with structured family metadata, images, hard and soft breaks, dedicated anchors, page-alias metadata, include-directive metadata with parsed selection semantics, diagnostics, and provenance, ordered and unordered lists, nested list items, thematic breaks, tables, block quotes, dedicated admonitions, dedicated callout lists, code blocks, raw HTML, footnote placeholders, and explicit unsupported nodes. Additional constructs should only land when conversion, normalization, rendering, and tests ship together.

The IR is semantic rather than textual. It expresses meaning such as admonition kind or heading depth without embedding flavor syntax. Transparent extensions such as fenced code blocks with `mermaid` or other authored language tags remain ordinary semantic `codeBlock` nodes rather than fallback artifacts.


#### Why


Multiple Markdown flavors differ in syntax support and fallback behavior. A direct flavor-to-string approach would spread semantic decisions across renderers and make regressions hard to detect.


The IR isolates meaning from syntax, supports normalization, and makes the output contract testable.


#### How


Define the canonical node types in `src/markdown/ir.ts`.


Run all source mappings through the IR before rendering. Apply normalization in `src/markdown/normalize.ts` before any flavor renderer runs, and lower xref targets through `src/markdown/xref-resolution.ts` before markdown link serialization.


Do not let renderers accept raw AsciiDoc AST nodes. Renderers only consume normalized IR.

Do not classify valid semantic nodes as fallback cases merely because the exporter does not interpret every downstream extension. Preserve them explicitly when the IR already represents them faithfully.


#### Links


- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The pipeline feeds the IR boundary.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers depend on this invariant.
- [[Raw HTML is a controlled fallback not a default rendering path]] - HTML fallback must remain explicit and policy-bound at the render boundary.
- [[Transparent extensions are not fallback mechanisms]] - Valid semantic extensions remain inside the IR instead of bypassing it.
- [[Xref target resolution is a separate lowering phase]] - Target routing is a lowering concern, not a renderer-local one.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Snapshot tests validate the frozen render contract.
- src/markdown/ir.ts - Canonical semantic node definitions.
- src/markdown/normalize.ts - IR normalization pass.

## Renderer And Flavor Model

Flavor renderers as syntax adapters that consume the same normalized IR and defer fallback, routing, and extension decisions to dedicated policy layers.

### Flavor renderers are syntax adapters over one semantic layer

Flavor renderers are syntax adapters over one normalized semantic layer rather than independent document translators. Each renderer may differ in syntax choices and supported constructs, but it must not redefine document meaning.


#### What


The repository currently ships explicit `gfm`, `commonmark`, `gitlab`, and `strict` renderer profiles. Additional flavors should serialize the same normalized IR using explicit flavor capabilities and render policy rather than introducing flavor-local semantics.


GLFM and GFM share core Markdown features based on the CommonMark specification, but each has its own extensions. GLFM includes GFM extensions and also adds GitLab-specific enhancements, while GFM remains the baseline GitHub-compatible syntax. This distinction matters when renderer behavior or fallback policy differs by platform support.


Flavor-specific behavior includes constructs such as admonition serialization, callout-list serialization, nested-list indentation, table emission, fence style, heading ID behavior, transparent fenced extension preservation, HTML tolerance, and family-aware xref routing for page, image, attachment, and example targets.


#### Why


If each renderer makes its own semantic decisions, the project will drift into inconsistent output and impossible-to-explain regressions. A syntax-adapter model keeps meaning centralized and renderer logic narrow.


This makes new flavors additive instead of invasive.


#### How


Implement concrete renderers in `src/markdown/render/**` and keep flavor capabilities explicit in `src/markdown/flavor.ts`.

Route unsupported blocks, unsupported inline degradation, and raw HTML allowance decisions through `src/markdown/fallback.ts` instead of duplicating fallback policy inside renderers.

Preserve valid `codeBlock` language tags verbatim, including transparent extensions such as `mermaid`. That preservation is semantic rendering, not fallback.


Keep flavor support, render policy, escaping, and fallback rules explicit. Unsupported constructs must degrade deterministically and visibly.


Do not allow renderer-local semantics that bypass the IR or normalization passes.


#### Links


- [[Markdown IR is the canonical render boundary]] - Semantic meaning is defined upstream of flavor rendering.
- [[Fallback selection is centralized across markdown flavors]] - Renderer-specific fallback drift should be avoided.
- [[Raw HTML is a controlled fallback not a default rendering path]] - HTML passthrough must be an explicit flavor policy, not renderer default behavior.
- [[Transparent fenced extensions preserve authored language semantics]] - Valid fenced blocks should preserve authored language tags verbatim.
- [[Markdown Guide Extended Syntax is a capability reference not a specification]] - Feature discovery must not override explicit flavor capabilities.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Per-flavor golden outputs verify this boundary.
- src/markdown/fallback.ts - Centralized fallback policy for unsupported and raw HTML handling.
- src/markdown/flavor.ts - Flavor capability and policy definitions.
- src/markdown/render/gfm.ts - GFM renderer.
- src/markdown/render/commonmark.ts - CommonMark-oriented renderer.
- src/markdown/render/strict.ts - Strict canonical renderer.

## Fallback Policy

Centralized policy for unsupported constructs, raw HTML allowance, and visible degradation. Fallback is deliberate and never a renderer-local default.

### Raw HTML is a controlled fallback not a default rendering path

Raw HTML is a controlled fallback mechanism for constructs that Markdown cannot represent cleanly, not a default rendering path. It must be explicitly gated by flavor policy and used only after semantic Markdown fallbacks are exhausted.

#### What

The repository supports raw HTML emission as a fallback in Markdown output, but only under explicit conditions.

Raw HTML is not part of the semantic Markdown IR. Instead, it appears as a fallback strategy when:
- a construct cannot be represented in Markdown
- semantic fallback would lose too much structure
- the selected flavor policy allows HTML emission through `src/markdown/fallback.ts`

Transparent fenced extensions are a separate category. A valid `codeBlock` with a language tag such as `mermaid` remains a semantic Markdown node and must not be rerouted through raw HTML fallback.

Fallback priority must be:

1. semantic Markdown representation
2. explicit unsupported marker
3. raw HTML fallback
4. fenced source fallback (e.g. asciidoc)

#### Why

Markdown portability depends on avoiding assumptions about HTML rendering and sanitization.

Although CommonMark and GFM allow raw HTML syntactically, real platforms apply filtering, sanitization, or partial support. Blind HTML emission introduces:
- non-portable output
- silent rendering differences
- hidden security constraints
- unpredictable behavior across platforms

A controlled fallback ensures:
- deterministic output
- visible degradation
- testable behavior
- clear reviewer intent

#### How

Represent HTML fallback explicitly in the IR or fallback layer:

- use a dedicated node or fallback descriptor
- attach a reason for the fallback
- annotate block-level raw HTML when it is emitted as a generic fallback

Example:

```md
<!-- fallback: raw_html reason=html-block -->
<div>raw</div>
<!-- /fallback: raw_html -->
```

Flavor policies must define whether HTML is:

- forbidden
- allowed for a safe subset
- fully allowed

Default behavior:

- strict -> forbid block and inline raw HTML, and emit visible unsupported markers instead
- gfm -> allow policy-mediated inline raw HTML and annotated block-level raw HTML fallback
- commonmark -> allow policy-mediated inline raw HTML and annotated block-level raw HTML fallback
- gitlab -> allow policy-mediated inline raw HTML and annotated block-level raw HTML fallback

Do not use raw HTML for core constructs such as headings, lists, links, or paragraphs.
Do not use raw HTML to preserve valid fenced code blocks or other transparent extensions.

#### Links

- [[Markdown IR is the canonical render boundary]] - Raw HTML must not bypass semantic representation.
- [[Fallback selection is centralized across markdown flavors]] - HTML allowance and visible degradation should flow through one fallback layer.
- [[Flavor renderers are syntax adapters over one semantic layer]] - HTML usage depends on flavor policy.
- [[Transparent fenced extensions preserve authored language semantics]] - Valid fenced code blocks are preserved semantically instead of routed through HTML fallback.
- [[Reference tests check semantic invariants not exact bytes]] - HTML fallback must remain visible and testable.
- src/markdown/fallback.ts - Fallback selection logic.

### Fallback selection is centralized across markdown flavors

Fallback selection is centralized across markdown flavors because unsupported markers, raw HTML allowance, and visible degradation must follow one policy layer instead of drifting across individual renderers. Transparent extensions remain outside that fallback path.

#### What

The repository now routes block fallback markers, inline fallback markers, and raw HTML allowance decisions through `src/markdown/fallback.ts`.

That layer decides:
- how unsupported blocks render
- how unsupported inline degradation renders
- when raw HTML is preserved
- when raw HTML is rejected visibly
- when generic raw HTML blocks receive explicit fallback annotations

Flavor renderers consume that policy instead of reimplementing it.

Valid semantic nodes such as fenced `codeBlock` nodes with language tags, including `mermaid` and unknown downstream identifiers, are transparent extensions rather than fallback cases.

#### Why

If each renderer owns its own fallback logic, behavior will drift across flavors and raw HTML policy will become implicit again.

Centralizing fallback selection keeps:
- unsupported output deterministic
- raw HTML policy explicit
- renderer code narrower
- tests focused on one contract surface

#### How

Keep fallback helpers in `src/markdown/fallback.ts`.

Use renderer unit tests and integration tests to verify both allowed and forbidden raw HTML behavior.

Do not reintroduce direct raw HTML pass-through branches in renderers without going through the fallback layer.

Do not route valid semantic constructs through fallback just because a flavor or the exporter does not interpret their meaning. Transparent extension preservation stays upstream of fallback selection.

#### Links

- [[Raw HTML is a controlled fallback not a default rendering path]] - Raw HTML policy depends on explicit fallback selection.
- [[Transparent extensions are not fallback mechanisms]] - Valid semantic extensions must stay separate from fallback behavior.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers should delegate fallback policy.
- src/markdown/fallback.ts - Central fallback policy implementation.

## Transparent Extensions

Valid fenced constructs such as Mermaid diagrams are preserved verbatim. Transparent extensions are a distinct contract category from fallback and unsupported degradation.

### Transparent fenced extensions preserve authored language semantics

Transparent fenced extensions preserve authored language semantics because valid code blocks with declared languages represent intentional author input that downstream Markdown renderers may interpret, and rewriting or downgrading those language tags introduces unnecessary information loss.

#### What

The repository treats fenced code blocks with explicit language identifiers, for example `mermaid`, as transparent extensions.

These blocks are:

- represented as normal `codeBlock` nodes in the IR
- rendered with their original language tag unchanged
- not treated as unsupported constructs
- not downgraded to generic or plain text code blocks

Example:

```adoc
[source,mermaid]
----
graph TD
  A --> B
----
```

must render as:

```md
```mermaid
graph TD
  A --> B
```
```

#### Why

A fenced code block with a language tag:

- already has a valid semantic representation
- is safe to preserve as text
- may be interpreted by downstream renderers such as GitHub or GitLab

Downgrading it to a generic language or emitting an unsupported marker:

- destroys author intent
- removes useful information
- reduces compatibility with capable renderers
- violates the goal of least-loss conversion

Preserving the language tag is the most faithful and least lossy transformation.

#### How

Renderer rules:

- if a node is a valid `codeBlock`, preserve the language string verbatim
- do not rewrite known or unknown languages
- do not convert language identifiers to `text` or other generic values
- do not emit unsupported fallback for valid code blocks

Fallback behavior applies only when:
- the block itself is invalid
- the construct is not representable as a code block
- policy explicitly forbids the entire construct class

This rule is independent from raw HTML fallback and must not be implemented through HTML passthrough.

#### Links

- [[Strict architecture must be extended without weakening invariants]] - This is a controlled extension, not a relaxation.
- [[Raw HTML is a controlled fallback not a default rendering path]] - Distinguishes HTML fallback from fenced extension preservation.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers must preserve IR semantics.
- src/markdown/render/markdown.ts - Code block rendering logic.

### Transparent extensions are not fallback mechanisms

Transparent extensions are not fallback mechanisms because they preserve valid semantic constructs that downstream renderers may support, whereas fallback mechanisms represent controlled degradation for constructs that cannot be represented safely.

#### What

The repository distinguishes between:

1. native markdown constructs
2. transparent extensions
3. controlled fallback
4. unsupported degradation

Transparent extensions include:
- fenced code blocks with language identifiers such as `mermaid`

Fallback mechanisms include:
- unsupported block markers
- raw HTML fallback
- fenced source fallback

#### Why

Treating all unknown constructs as fallback:

- conflates valid but unsupported features with invalid or lossy constructs
- leads to unnecessary degradation
- reduces output fidelity

Transparent extensions preserve meaning without introducing ambiguity or unsafe behavior.

#### How

When evaluating a node:

- if it is a valid semantic node such as `codeBlock`, preserve it
- if it cannot be represented semantically, apply fallback policy
- never route valid semantic constructs through fallback layers

Keep fallback logic centralized and separate from extension preservation.

#### Links

- [[Transparent fenced extensions preserve authored language semantics]] - Mermaid is the primary example.
- [[Fallback selection is centralized across markdown flavors]] - Fallback logic must remain explicit.
- [[Markdown IR is the canonical render boundary]] - Classification occurs after semantic mapping.

## Xref Lowering

Antora-aware xref destinations are resolved in a dedicated lowering phase so renderers serialize already-routed targets.

### Xref target resolution is a separate lowering phase

Xref target resolution is a separate lowering phase because Antora-aware destination shaping is semantic policy, not string-formatting work. Renderers should serialize resolved destinations rather than own routing logic directly.

#### What

The repository preserves structured xref metadata in the Markdown IR and then lowers that metadata into a concrete destination path in `src/markdown/xref-resolution.ts`.

That lowering step is responsible for:
- source-shaped vs site-shaped routing
- family-aware routing for page, image, attachment, and example targets
- ROOT-module omission when a site flavor requires it
- fallback to source-shaped destinations for unknown families

The renderer then formats the already-resolved destination as Markdown link syntax.

#### Why

When xref routing logic lives inside a string renderer, it becomes hard to test, hard to reuse, and easy to couple to unrelated formatting concerns.

Separating the lowering phase keeps:
- routing policy testable in direct unit assertions
- renderer logic narrower
- Antora-specific semantics inspectable after conversion

#### How

Keep structured xref target metadata in `src/markdown/ir.ts`.

Resolve destinations through `src/markdown/xref-resolution.ts` before link serialization in `src/markdown/render/markdown.ts`.

Do not duplicate family routing or ROOT-module omission logic in multiple renderers.

#### Links

- [[Markdown IR is the canonical render boundary]] - Xref metadata survives until the lowering phase.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers should consume resolved destinations, not own route policy.
- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Xref lowering happens after conversion, before final markdown emission.
- src/markdown/xref-resolution.ts - Canonical xref destination lowering logic.

## Include Handling

Include semantics, diagnostics, and provenance survive conversion through a deliberately private metadata transport.

### Include metadata transport is an internal implementation detail

Include metadata transport is an internal implementation detail because the repository’s contract is include semantics, diagnostics, and provenance, not the specific marker shape used while moving that metadata through the converter pipeline.

#### What

The converter currently uses an HTML comment transport to carry include-directive metadata through assembled content until it is rehydrated as semantic IR nodes.

That transport is intentionally private. The supported behavior is:
- include directives remain inspectable in the Markdown IR
- diagnostics survive expansion and normalization
- provenance remains available for validation and reporting

The exact wire format is isolated in `src/exporter/include-metadata.ts`.

#### Why

If general conversion logic knows too much about the private marker shape, even small internal refactors become risky and noisy.

Isolating the transport keeps:
- include behavior stable while internals evolve
- tests focused on semantic outcomes rather than wire-format leakage
- future transport changes possible without rewriting unrelated parser code

#### How

Keep marker encode/decode logic in one internal module.

Do not let renderer, inspection helpers, or general block parsing depend on raw marker syntax.

Preserve existing include semantics, diagnostics, and provenance when refactoring the transport layer.

#### Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - Include transport sits inside the converter, not outside the pipeline boundary.
- [[Reference corpus should cover navigation xrefs includes and admonitions]] - Compatibility coverage should pin include behavior, not private marker syntax.
- src/exporter/include-metadata.ts - Private include transport implementation.

## Testing And Validation

Golden fixtures pin the render contract. Inspection helpers expose the same normalized semantics to CI and release validation.

### Testing relies on golden fixtures and deterministic snapshots

Testing relies on golden fixtures and deterministic snapshots because Markdown export regressions are easiest to detect at the exact-output boundary. Structural tests remain useful, but the frozen render contract is enforced through fixture-based expected outputs.


#### What


The repository uses Vitest for unit, integration, and golden-output tests. Each fixture contains one AsciiDoc input and one expected Markdown output per supported flavor.


The test suite separates concerns:
- unit tests for IR nodes and normalization
- renderer tests for flavor behavior
- integration tests for exporter wiring
- fixture golden tests for exact output
- validation-helper tests for reusable inspection surfaces


#### Why


A Markdown exporter can appear correct while drifting in whitespace, fallback behavior, escaping, or flavor-specific syntax. Exact-output fixtures make those regressions visible and reviewable.


This also supports deterministic CI and safer refactoring.


#### How


Place fixtures under `tests/fixtures/**` with `input.adoc` and `expected.<flavor>.md` files.


Use `vitest.config.ts` with `@vitest/coverage-v8` and keep render tests stable enough to run in CI without regeneration side effects.

When a fixture asserts diagnostics or validation metadata, keep those expectations explicit and separate from rendered Markdown snapshots so output stability and diagnosability are both reviewable.


Do not rely only on broad smoke tests.


#### Links


- [[Markdown IR is the canonical render boundary]] - Normalized IR is what the render contract tests exercise.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Each flavor needs explicit golden outputs.
- [[Inspection helpers expose normalized validation surfaces]] - Validation helpers should be tested as reusable contract surfaces.
- src/markdown/normalize.ts - Normalization behavior needs unit coverage.
- tests/integration/fixture-golden.test.ts - Exact-output contract tests.
- vitest.config.ts - Coverage and test configuration.

### Inspection helpers expose normalized validation surfaces

Inspection helpers expose normalized validation surfaces because downstream tooling should inspect include diagnostics and xref targets through a stable API instead of reimplementing tree traversal over Markdown IR nodes. Validation consumers need durable semantics, not knowledge of every recursive block shape.

#### What

The repository exposes helper functions that consume a Markdown document and return normalized inspection data:
- include directives
- include diagnostics
- xrefs
- xref targets
- combined inspection reports

These helpers should normalize the document first and then traverse the full recursive block structure.

Their output order should follow normalized document order so JSON reports, CLI output, and release validation remain deterministic without extra consumer-side sorting.

The inspection API exists for validation and reporting, not rendering.

#### Why

Validation logic that reimplements traversal outside the library will drift from the canonical IR semantics. That creates inconsistent CI checks, release validation, and user tooling.

A first-class inspection layer keeps diagnostics and family-aware xref metadata reusable across:
- CI validation
- release checks
- editor or CLI reporting
- downstream automation

#### How

Keep the helper surface in `src/markdown/include-diagnostics.ts` or an equivalent inspection-focused module.

Helpers should:
- accept a Markdown document
- normalize before inspection
- recurse through supported block and inline containers
- return structured data instead of formatted strings

If multiple validation consumers need the same traversal, add one combined inspection report helper rather than making each consumer stitch together separate passes.

When repository automation needs machine-readable output, provide one maintained script example that serializes the combined inspection report as JSON instead of leaving each CI pipeline to invent its own formatting layer.

If CI consumers need native platform feedback, keep that as an explicit alternate output mode over the same normalized inspection report rather than a separate ad-hoc validation implementation. For example, GitHub Actions annotations should be emitted from the same inspection data that powers the JSON report.

The repository currently treats Bun as the primary development runtime for the inspection script, while npm remains the publish channel rather than a separate validation implementation path.

Do not mix inspection helpers into renderer policy or export conversion logic.

#### Links

- [[Markdown IR is the canonical render boundary]] - Inspection helpers consume normalized semantic nodes.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Fixtures and validation helpers should reinforce the same contract.
- [[Release and package identity use scoped npm publishing]] - Release validation can use these helpers before publish.
- src/markdown/include-diagnostics.ts - Inspection helper implementation.
- scripts/inspection-report.ts - Machine-readable JSON reporting example for CI flows.
- README.md - Public usage examples for validation and reporting.

## Release And Tooling

Scripts, workflows, and referenced files must stay in lockstep so release readiness is observable, not aspirational.

### Repository scripts and referenced files must stay in lockstep

Repository scripts and referenced files must stay in lockstep because a package cannot be considered buildable, testable, or publishable when its scripts, metadata, and documentation refer to files that do not exist. Self-consistency is a release prerequisite, not optional polish.

#### What

The repository must keep these layers aligned:
- `package.json` scripts and publish metadata
- CI workflow commands
- README developer commands
- Makefile delegate targets
- test assumptions about repository files
- actual tracked files in the tree

Examples include build config files, formatter config, CLI bin files, Makefiles, and license files.

#### Why

A repository can look structurally mature while still failing immediately in CI or during local setup if scripts point to missing files. This erodes trust and makes every downstream review noisy.

Self-consistency also keeps documentation honest and prevents tests from asserting policy against artifacts that are not present.

#### How

Whenever a script, bin entry, test, or README command references a file, verify that the file exists in the repository and is included in packaging rules when required.

If a file is intentionally deferred, remove or narrow the reference until the file lands.

Treat missing referenced files as blocking issues for the current phase.

#### Links

- [[Release and package identity use scoped npm publishing]] - Publish readiness depends on file and script alignment.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Test infrastructure must exist, not only be described.
- package.json - Script and publish metadata source.
- .github/workflows/ci.yml - CI command contract.
- README.md - Developer command surface.
