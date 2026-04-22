# @wsmy/antora-markdown-exporter

Antora Assembler based Markdown exporter with semantic IR, inspection surfaces, and explicit Markdown flavor rendering.

The package exposes explicit flavor capabilities, transparent fenced extension preservation, centralized fallback policy, and renderer profiles for GitHub Flavored Markdown, CommonMark, GitLab Flavored Markdown, and a strict canonical mode. It consumes assembled Antora/Asciidoctor output and maps that already-resolved structure and metadata into the repository’s Markdown IR instead of trying to recreate the full AsciiDoc parser.

## Status Markers

This repository uses a small claim-status grammar in its docs:

- `Implemented`: present in repository code
- `Test-enforced`: pinned by automated tests
- `CI-enforced`: executed or guarded by repository workflows
- `Intended`: documented design direction that is not yet fully enforced

The operator manual publishes the fuller proof matrix, support matrix, evidence ledger, and prerequisites matrix.

## Install

```bash
npm install @wsmy/antora-markdown-exporter
```

## Usage

### Library

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

The semantic IR remains the canonical render boundary. Valid fenced code blocks stay valid semantic `codeBlock` nodes even when their language tag is an extension such as `mermaid` or an unknown downstream language. That preservation path is not fallback.

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

### Render Contract

The renderer works with four explicit categories:

- native markdown: semantic nodes that map directly to supported Markdown output
- transparent extensions: valid semantic nodes, such as fenced `codeBlock` nodes with authored language tags like `mermaid`, that remain verbatim instead of degrading
- controlled fallback: policy-mediated degradation paths such as unsupported markers or raw HTML fallback when a flavor allows it
- unsupported degradation: visible fallback for malformed or unrepresentable constructs when no semantic or policy-preserving path exists

This keeps valid author intent separate from fallback. A preserved ` ```mermaid ` fence is not raw HTML passthrough, and it is not an unsupported block.

### Validation Helpers

```ts
import {
  collectMarkdownInspectionReport,
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
console.log(report.xrefs.length, report.xrefTargets.length);
```

Inspection helpers normalize before traversal and return entries in document order, so the combined report is stable enough for CI, release validation, and snapshot-style contract tests.

When unlabeled xrefs need a different display form, the structured extractor and extension runtime also accept `xrefFallbackLabelStyle`. Use `fragment-or-basename` for labels like `setup`, or `fragment-or-path` for labels like `guide/setup`.

### CI And Release Validation

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

For machine-readable CI output, the repository also ships a Bun-native example script. JSON and GitHub Actions modes are alternate serializations of the same normalized inspection report.

```bash
bun run inspect:report -- tests/fixtures/xrefs/input.adoc > inspection-report.json
```

The same script can stream AsciiDoc from stdin in CI without creating a temporary file:

```bash
cat generated-page.adoc | bun run inspect:report -- --stdin \
  --source-path /workspace/modules/ROOT/pages/generated-page.adoc \
  > inspection-report.json
```

When a workflow wants GitHub Actions annotations instead of JSON, use the alternate format:

```bash
bun run inspect:report -- tests/fixtures/xrefs/input.adoc \
  --format github-actions
```

Current GitHub Actions mode emits one summary annotation with normalized report counts.

Example GitHub Actions step using the Makefile delegate target, artifact upload, and native annotations:

```yaml
- name: Generate inspection report
  run: |
    make inspect-report INPUT=tests/fixtures/xrefs/input.adoc \
      > inspection-report.json

- name: Upload inspection report
  uses: actions/upload-artifact@v4
  with:
    name: inspection-report
    path: inspection-report.json

- name: Emit inspection annotations
  run: |
    bun run inspect:report -- tests/fixtures/xrefs/input.adoc \
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

Current structured converter coverage includes headings, paragraphs, inline links, dedicated xref nodes, dedicated anchor and page-alias nodes, images, ordered and unordered lists, thematic breaks, aligned tables, policy-gated raw HTML fallback nodes, fenced code blocks, block quotes, and dedicated admonition nodes. The extension/runtime path now goes through structured extraction and lowering rather than the removed text parser.

### Extension

```ts
import { register } from "@wsmy/antora-markdown-exporter/extension";

export { register };
```

The extension entrypoint delegates to `@antora/assembler.configure()` using the repository’s Markdown converter, matching the Antora Assembler custom exporter contract.

### CLI

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
make inspect-report INPUT=tests/fixtures/sample/input.adoc
bun run inspect:report -- tests/fixtures/sample/input.adoc
bun run inspect:report -- --stdin --source-path /virtual/page.adoc < tests/fixtures/sample/input.adoc
make format
make fix
```

The primary development path uses Bun through the Makefile delegate targets. npm remains available as an explicit alternate path when needed, while package publication happens from the tag-triggered release workflow rather than from an ad-hoc local `npm publish`:

```bash
make install
make check
make PM=npm install
```

Documentation publication follows the same operating model. `make docs` builds the local Antora site into `build/site`, generates module PDFs at `build/site/antora-markdown-exporter/architecture.pdf`, `build/site/antora-markdown-exporter/manual.pdf`, and `build/site/antora-markdown-exporter/onboarding.pdf`, and `.github/workflows/pages.yml` deploys that site to `https://wstein.github.io/antora-markdown-exporter` only after a successful tag-triggered `Release` workflow has already fast-forwarded `main` to the published commit.

Each target is a thin delegate to the matching package-manager script.

`make integration` runs the broader integration suite. `make reference` runs only the provenance-locked compatibility cases, including recursive include inlining, stepped and open-ended include slicing, anchor and alias preservation, component/module/version-aware xrefs, family-aware site routing, aligned tables, admonitions, mixed block sequences, and visible unsupported fallbacks where support is still intentionally deferred.

To export the main Antora modules to Markdown using the repository pipeline, run:

```bash
make markdown
```

This emits flat module documents under `build/markdown/architecture.md`, `build/markdown/manual.md`, and `build/markdown/onboarding.md` using the same assembled module sources as the repository PDFs and the same conversion path as the library API: AsciiDoc to IR mapping, normalization, and flavor rendering. The default CLI output is a human-readable summary. If automation needs machine-readable output, run `bun run export:modules -- --json`. The export path does not post-process rendered Markdown. If output needs improvement, fix the converter or renderer. Use `ARGS="--flavor gitlab"` or an alternate `--output-root` when you need a different target.

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
