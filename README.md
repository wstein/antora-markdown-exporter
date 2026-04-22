# @wsmy/antora-markdown-exporter

Antora Assembler based Markdown exporter with semantic IR, inspection surfaces, and explicit Markdown flavor rendering.

The package consumes assembled Antora/Asciidoctor output, maps that structure into a semantic Markdown IR, and renders explicit Markdown flavors without trying to recreate a full AsciiDoc parser.

## Install

```bash
npm install @wsmy/antora-markdown-exporter
```

## Antora Site Quick Start

Use this path if you are integrating the exporter into an Antora site and do not need this repository's contributor tooling.

1. Install the package in your Antora site project.
2. Export the extension entrypoint from your Antora runtime setup:

```ts
import { register } from "@wsmy/antora-markdown-exporter/extension";

export { register };
```

3. Keep exporter defaults in Antora-owned config:

```yaml
asciidoc:
  attributes:
    markdown-exporter-flavor: gfm
    markdown-exporter-xref-fallback-label-style: fragment-or-basename
```

4. Keep assembly partitioning in Assembler config:

```yaml
assembly:
  root_level: 1
```

That is the standard integration path. Repository commands such as `make markdown`, `bun run export:modules`, `make test`, and `make pdf` are contributor conveniences for this package repository, not requirements for a normal Antora site.

## Quick Start

```ts
import {
  convertAssemblyStructureToMarkdownIR,
  extractAssemblyStructure,
  normalizeMarkdownIR,
  renderGfm,
} from "@wsmy/antora-markdown-exporter";

const structured = extractAssemblyStructure("== Sample document\n\nHello world.");
const ir = convertAssemblyStructureToMarkdownIR(structured);
const normalized = normalizeMarkdownIR(ir);

console.log(renderGfm(normalized));
```

## Library

```ts
import {
  collectMarkdownInspectionReport,
  convertAssemblyStructureToMarkdownIR,
  collectXrefTargets,
  extractAssemblyStructure,
  normalizeMarkdownIR,
  renderMarkdown,
  renderGfm,
} from "@wsmy/antora-markdown-exporter";

const structured = extractAssemblyStructure("== Sample document\n\nHello world.");
const ir = convertAssemblyStructureToMarkdownIR(structured);
const normalized = normalizeMarkdownIR(ir);
const xrefTargets = collectXrefTargets(normalized);

console.log(renderGfm(normalized));
console.log(renderMarkdown(normalized, "commonmark"));
console.log(xrefTargets);
console.log(collectMarkdownInspectionReport(normalized));
```

The semantic IR remains the canonical render boundary. Valid fenced code blocks stay valid semantic `codeBlock` nodes even when their language tag is an extension such as `mermaid` or an unknown downstream language.

For example, this AsciiDoc:

```adoc
== Architecture diagram

[source,mermaid]
----
graph TD
  A --> B
----
```

renders as:

````md
# Architecture diagram

```mermaid
graph TD
  A --> B
```
````

This differs from controlled fallback behavior. Raw HTML and unsupported constructs still flow through explicit policy decisions, while valid fenced blocks preserve their authored language tag verbatim.

## Render Contract

The renderer works with four explicit categories:

- native markdown: semantic nodes that map directly to supported Markdown output
- transparent extensions: valid semantic nodes, such as fenced `codeBlock` nodes with authored language tags like `mermaid`, that remain verbatim instead of degrading
- controlled fallback: policy-mediated degradation paths such as unsupported markers or raw HTML fallback when a flavor allows it
- unsupported degradation: visible fallback for malformed or unrepresentable constructs when no semantic or policy-preserving path exists

This keeps valid author intent separate from fallback. A preserved ` ```mermaid ` fence is not raw HTML passthrough, and it is not an unsupported block.

## Validation Helpers

```ts
import {
  collectMarkdownInspectionReport,
  collectMarkdownInspectionRagDocument,
  collectXrefTargets,
  convertAssemblyStructureToMarkdownIR,
  extractAssemblyStructure,
} from "@wsmy/antora-markdown-exporter";

const structured = extractAssemblyStructure(
  "== Sample\n\nSee xref:install.adoc#cli[install].",
  {
    sourcePath: "/virtual/project/page.adoc",
    xrefFallbackLabelStyle: "fragment-or-basename",
  },
);
const document = convertAssemblyStructureToMarkdownIR(structured);

for (const target of collectXrefTargets(document)) {
  console.log(
    `[xref:${target.family?.kind ?? "page"}] ${target.raw} -> ${target.path}`,
  );
}

const report = collectMarkdownInspectionReport(document);
const rag = collectMarkdownInspectionRagDocument(document);
console.log(report.xrefs.length, report.xrefTargets.length);
console.log(rag.entries);
```

Inspection helpers normalize before traversal and return entries in document order, so the combined report is stable enough for CI, release validation, and snapshot-style contract tests.
`collectMarkdownInspectionRagDocument(document)` narrows that same normalized surface into deterministic ordered entries for agentic retrieval and prompt assembly without reparsing rendered Markdown. The RAG document now includes headings, anchors, page aliases, and best-effort source locations alongside xrefs so chunking and retrieval can stay on the semantic side of the pipeline.

When unlabeled xrefs need a different display form, the structured extractor and extension runtime also accept `xrefFallbackLabelStyle`. Use `fragment-or-basename` for labels like `setup`, or `fragment-or-path` for labels like `guide/setup`.

## CI And Release Validation

```ts
import {
  collectMarkdownInspectionReport,
  convertAssemblyStructureToMarkdownIR,
  extractAssemblyStructure,
} from "@wsmy/antora-markdown-exporter";

const document = convertAssemblyStructureToMarkdownIR(
  extractAssemblyStructure(source, { sourcePath }),
);
const report = collectMarkdownInspectionReport(document);

for (const target of report.xrefTargets) {
  console.log(`[xref:${target.family?.kind ?? "page"}] ${target.raw}`);
}
```

For machine-readable CI output, the repository also ships a Bun-native example script. JSON and GitHub Actions modes serialize the normalized inspection report directly, and `rag-json` emits the agent-oriented inspection shape with document metadata, headings, anchors, page aliases, xrefs, and best-effort source locations.

```bash
bun run inspect:report -- modules/ROOT/pages/guide.adoc > inspection-report.json
```

The same script can stream AsciiDoc from stdin in CI without creating a temporary file:

```bash
cat generated-page.adoc | bun run inspect:report -- --stdin \
  --source-path /workspace/modules/ROOT/pages/generated-page.adoc \
  > inspection-report.json
```

When a workflow wants GitHub Actions annotations instead of JSON, use the alternate format:

```bash
bun run inspect:report -- modules/ROOT/pages/guide.adoc \
  --format github-actions
```

For deterministic agent-oriented JSON instead of the full validation report:

```bash
bun run inspect:report -- modules/ROOT/pages/guide.adoc \
  --format rag-json
```

Current GitHub Actions mode emits one summary annotation with normalized report counts.

Example GitHub Actions step using the Makefile delegate target, artifact upload, and native annotations:

```yaml
- name: Generate inspection report
  run: |
    make inspect-report INPUT=modules/ROOT/pages/guide.adoc \
      > inspection-report.json

- name: Upload inspection report
  uses: actions/upload-artifact@v4
  with:
    name: inspection-report
    path: inspection-report.json

- name: Emit inspection annotations
  run: |
    bun run inspect:report -- modules/ROOT/pages/guide.adoc \
      --format github-actions \
      || true
```

The emitted JSON contains the normalized inspection report plus the resolved input and source paths:

```json
{
  "inputPath": "/abs/path/generated-page.adoc",
  "sourcePath": "/workspace/modules/ROOT/pages/generated-page.adoc",
  "report": {
    "xrefTargets": [
      {
        "raw": "install.html#cli",
        "path": "install.adoc",
        "fragment": "cli"
      }
    ],
    "xrefs": [
      {
        "type": "xref",
        "url": "install.adoc#cli",
        "target": {
          "raw": "install.html#cli",
          "path": "install.adoc",
          "fragment": "cli"
        },
        "children": [
          {
            "type": "text",
            "value": "install"
          }
        ]
      }
    ]
  }
}
```

The Antora extension registration path goes through structured extraction and lowering rather than a text parser. The root package also publishes `assemblyStructureInvariants` and `assemblyStructureSpecification` so adapter-boundary rules are visible as code. For the detailed support matrix, workflow proof, and evidence surfaces, use the operator manual and architecture docs.

## Extension

```ts
import { register } from "@wsmy/antora-markdown-exporter/extension";

export { register };
```

The extension entrypoint delegates to `@antora/assembler.configure()` using the repository’s Markdown converter, matching the Antora Assembler custom exporter contract.

## Terminology Bridge

These docs use a few repository-local phrases for precision, but the Antora concepts stay primary.

| Standard Antora concept | Secondary repository shorthand |
| --- | --- |
| Antora Assembler extension/exporter | extension/runtime path |
| Assembler config such as `assembly.root_level` | export partitioning policy |
| Playbook `asciidoc.attributes` for exporter defaults | exporter display policy |
| Assembled AsciiDoc from Antora | assembled source buffer |
| Semantic conversion stages after assembly | semantic pipeline |

If you are coming from normal Antora usage, read the left column first. The right column is repository shorthand, not a replacement vocabulary.

## CLI

```bash
npx antora-markdown-exporter --help
```

## Development

```bash
make install
make build
make test
make unit
make integration
make reference
make pdf
make markdown
make inspect-report INPUT=modules/ROOT/pages/guide.adoc
bun run inspect:report -- modules/ROOT/pages/guide.adoc
bun run inspect:report -- --stdin --source-path /virtual/page.adoc < guide.adoc
make format
make fix
```

The primary development path uses Bun through the Makefile delegate targets. npm remains available as an explicit alternate path when needed, while package publication happens from the tag-triggered release workflow rather than from an ad-hoc local `npm publish`:

```bash
make install
make check
make PM=npm install
```

Documentation publication follows the same operating model. `make docs` builds the local Antora site into `build/site`, generates Assembler-driven PDFs at `build/site/antora-markdown-exporter/documentation.pdf`, `build/site/antora-markdown-exporter/architecture.pdf`, `build/site/antora-markdown-exporter/manual.pdf`, and `build/site/antora-markdown-exporter/onboarding.pdf`, and `.github/workflows/pages.yml` deploys that site to `https://wstein.github.io/antora-markdown-exporter` only after a successful tag-triggered `Release` workflow has already fast-forwarded `main` to the published commit.

Each target is a thin delegate to the matching package-manager script.

`make integration` runs the broader integration suite. `make reference` runs the curated compatibility cases for realistic Antora content.

To export the main Antora modules to Markdown using the repository pipeline, run:

```bash
make markdown
```

This emits flat Assembler exports under `build/markdown/documentation.md`, `build/markdown/architecture.md`, `build/markdown/manual.md`, and `build/markdown/onboarding.md` through the same structured conversion path as the library API: structured extraction, IR lowering, normalization, and flavor rendering. It also materializes a review bundle under `build/markdown/review-bundle/.github/workflows/` so exported docs ship with `release.yml` and `pages.yml`. The repository tracks `assembly.root_level: 1` in [antora-assembler.yml](./antora-assembler.yml), and it now keeps exporter display defaults in [antora-playbook.yml](./antora-playbook.yml) under `asciidoc.attributes.markdown-exporter-flavor` and `asciidoc.attributes.markdown-exporter-xref-fallback-label-style`. The direct `bun run export:modules` script reads those Antora-owned defaults, while `make markdown` remains an explicit convenience task that requests `multimarkdown`. Both flavors still write `.md` files. Use `--root-level 0` when you want the single combined `index.md` export instead of one export per top-level navigation entry. The default CLI output is a human-readable summary. If automation needs machine-readable output, run `bun run export:modules -- --json`. Use `bun run export:modules -- --flavor gitlab`, `bun run export:modules -- --flavor gfm`, `bun run export:modules -- --xref-fallback-label-style fragment-or-path`, or an alternate `--output-root` when you need a different target.
When the exporter writes assembled pages directly, Antora page links are rewritten to the matching exported `.md` files instead of leaking site `.html` URLs into the review artifacts.

To build only the assembled module PDFs without rebuilding the full Antora HTML site, run:

```bash
make pdf
```

## Release

```bash
make release VERSION=v0.1.0
```

The repository now uses a `develop` / `main` / semver-tag release model:

- `develop` is the integration branch for normal change flow
- `main` tracks published history
- semver tags such as `v0.1.0` are the publish trigger

From a clean `develop` worktree, `make release VERSION=v0.1.0` starts the release candidate by updating version files, committing `chore(release): start v0.1.0`, and pushing `develop`.

After the candidate commit has passed CI on `develop`, rerun:

```bash
make release VERSION=v0.1.0 YES=1
```

With the same version, the release wizard switches to finalize mode, creates the tag, and pushes only the tag. The tag-triggered GitHub Actions workflow validates the tagged commit, publishes `@wsmy/antora-markdown-exporter`, attaches release assets, and fast-forwards `main` to the released commit.

After a tag-triggered `Release` workflow completes successfully, the separate Pages workflow rebuilds the Antora site from `main` and publishes the resulting static site to GitHub Pages at `https://wstein.github.io/antora-markdown-exporter`.

## Package

This repository is shaped as a library-first package with a small CLI entrypoint. The published package exposes the core markdown pipeline API and a real Antora extension entrypoint under `./extension`.

The root package also publishes a stable Antora module-export library surface. Use `resolveAntoraMarkdownExportDefaults(...)` when you want Antora-owned defaults from the playbook and Assembler config, and use `exportAntoraModules(...)` when you want the package to drive Antora Assembler and write one Markdown export per configured assembly root.

For contributor-first guidance, use the onboarding guide. For operator workflows, support boundaries, and workflow evidence, use the operator manual and architecture guide.
