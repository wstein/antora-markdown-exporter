# @wsmy/antora-markdown-exporter

Antora Assembler based Markdown exporter scaffold with semantic IR, explicit flavor capabilities, transparent fenced extension preservation, centralized fallback policy, and renderer profiles for GitHub Flavored Markdown, CommonMark, GitLab Flavored Markdown, and a strict canonical mode.

## Install

```bash
npm install @wsmy/antora-markdown-exporter
```

## Usage

### Library

```ts
import {
  collectMarkdownInspectionReport,
  convertAssemblyToMarkdownIR,
  collectIncludeDiagnostics,
  collectXrefTargets,
  normalizeMarkdownIR,
  renderMarkdown,
  renderGfm,
} from "@wsmy/antora-markdown-exporter";

const ir = convertAssemblyToMarkdownIR("== Sample document\n\nHello world.");
const normalized = normalizeMarkdownIR(ir);
const includeDiagnostics = collectIncludeDiagnostics(normalized);
const xrefTargets = collectXrefTargets(normalized);

console.log(renderGfm(normalized));
console.log(renderMarkdown(normalized, "commonmark"));
console.log(includeDiagnostics);
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
  collectIncludeDiagnostics,
  collectMarkdownInspectionReport,
  collectXrefTargets,
  convertAssemblyToMarkdownIR,
} from "@wsmy/antora-markdown-exporter";

const document = convertAssemblyToMarkdownIR(
  "== Sample\n\ninclude::partials/snippet.adoc[lines=1..5..0]",
  { sourcePath: "/virtual/project/page.adoc" },
);

for (const entry of collectIncludeDiagnostics(document)) {
  console.error(
    `[include:${entry.target}] ${entry.diagnostic.code}: ${entry.diagnostic.message}`,
  );
}

for (const target of collectXrefTargets(document)) {
  console.log(
    `[xref:${target.family?.kind ?? "page"}] ${target.raw} -> ${target.path}`,
  );
}

const report = collectMarkdownInspectionReport(document);
console.log(report.includeDirectives.length, report.xrefs.length);
```

Inspection helpers normalize before traversal and return entries in document order, so the combined report is stable enough for CI, release validation, and snapshot-style contract tests.

### CI And Release Validation

```ts
import {
  collectMarkdownInspectionReport,
  convertAssemblyToMarkdownIR,
} from "@wsmy/antora-markdown-exporter";

const document = convertAssemblyToMarkdownIR(source, { sourcePath });
const report = collectMarkdownInspectionReport(document);

if (report.includeDiagnostics.length > 0) {
  for (const entry of report.includeDiagnostics) {
    console.error(
      `[validation:${entry.target}] ${entry.diagnostic.code}: ${entry.diagnostic.message}`,
    );
  }
  process.exitCode = 1;
}

for (const target of report.xrefTargets) {
  console.log(`[xref:${target.family?.kind ?? "page"}] ${target.raw}`);
}
```

For machine-readable CI output, the repository also ships a Bun-native example script. JSON and GitHub Actions modes are alternate serializations of the same normalized inspection report.

```bash
bun run inspect:report -- tests/fixtures/includes-invalid-steps/input.adoc \
  --fail-on-diagnostics > inspection-report.json
```

The same script can stream AsciiDoc from stdin in CI without creating a temporary file:

```bash
cat generated-page.adoc | bun run inspect:report -- --stdin \
  --source-path /workspace/modules/ROOT/pages/generated-page.adoc \
  --fail-on-diagnostics > inspection-report.json
```

When a workflow wants GitHub Actions annotations instead of JSON, use the alternate format:

```bash
bun run inspect:report -- tests/fixtures/includes-invalid-steps/input.adoc \
  --format github-actions \
  --fail-on-diagnostics
```

Current GitHub Actions mode emits `::error` annotations for hard include diagnostics and `::warning` for degradations that still preserve usable output, such as an empty tag selection.

Example GitHub Actions step using the Makefile delegate target, artifact upload, and native annotations:

```yaml
- name: Generate inspection report
  run: |
    make inspect-report INPUT=tests/fixtures/includes-invalid-steps/input.adoc \
      > inspection-report.json

- name: Upload inspection report
  uses: actions/upload-artifact@v4
  with:
    name: inspection-report
    path: inspection-report.json

- name: Emit inspection annotations
  run: |
    bun run inspect:report -- tests/fixtures/includes-invalid-steps/input.adoc \
      --format github-actions \
      || true
```

The emitted JSON contains the normalized inspection report plus the resolved input and source paths:

```json
{
  "inputPath": "/abs/path/tests/fixtures/includes-invalid-steps/input.adoc",
  "sourcePath": "/abs/path/tests/fixtures/includes-invalid-steps/input.adoc",
  "report": {
    "includeDirectives": [
      {
        "type": "includeDirective",
        "target": "partials/snippet.adoc",
        "attributes": {
          "lines": "1..5..0;1..5..bad"
        }
      }
    ],
    "includeDiagnostics": [
      {
        "target": "partials/snippet.adoc",
        "diagnostic": {
          "code": "invalid-line-step",
          "message": "include line steps must be positive integers",
          "source": "1..5..0"
        }
      },
      {
        "target": "partials/snippet.adoc",
        "diagnostic": {
          "code": "invalid-line-range",
          "message": "include line selectors must be positive integers or ranges",
          "source": "1..5..bad"
        }
      }
    ],
    "xrefTargets": [],
    "xrefs": []
  }
}
```

Current scaffold coverage includes headings, paragraphs, inline links, dedicated xref nodes with inspectable Antora target metadata and first-class family kinds, dedicated anchor and page-alias nodes, images, ordered and unordered lists, nested lists, thematic breaks, aligned tables, policy-gated raw HTML fallback nodes, footnote placeholders, fenced code blocks with dedicated callout-list nodes and verbatim language-tag preservation for transparent extensions such as `mermaid`, block quotes, dedicated admonition nodes, and recursive include inlining with dedicated include-directive metadata, for both `partial$` and relative include paths, including tagged-region selection, multi-tag extraction, overlapping-tag precedence, open-ended and stepped line-range unions, invalid-selector diagnostics, indentation, and `leveloffset`, when source-path context is available. Flavor policies can now render page-family xrefs either as source-shaped `.adoc` destinations or as site-shaped Antora-style routes, including `_images`, `_attachments`, and `_examples` asset families where configured.

### Extension scaffold

```ts
import { createAntoraExtensionScaffold } from "@wsmy/antora-markdown-exporter";

const extension = createAntoraExtensionScaffold();
console.log(extension.kind);
```

`createAntoraExtensionScaffold()` is intentionally scaffolded metadata, not a full Antora extension registration contract yet.

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
make inspect-report INPUT=tests/fixtures/sample/input.adoc
bun run inspect:report -- tests/fixtures/sample/input.adoc
bun run inspect:report -- --stdin --source-path /virtual/page.adoc < tests/fixtures/sample/input.adoc
make docs-generate
make docs-check
make format
make fix
```

### Generated architecture documentation

[`docs/architecture.md`](docs/architecture.md) is a derived, read-only narrative view over the repository's atomic notes. The notes in [`notes/`](notes) remain the canonical source of truth for architectural decisions, invariants, and rendering policy. The generator sequences a curated set of notes into a human-readable order without summarizing or paraphrasing, so the narrative stays faithful to authored intent.

Regenerate the file after any change to the referenced notes:

```bash
bun run docs:generate
```

CI runs `bun run docs:check` to fail fast when the committed file drifts from the current note corpus.

The primary development path uses Bun through the Makefile delegate targets. npm remains available as an explicit alternate path when needed and remains the publish channel used by `make release`:

```bash
make install
make check
make PM=npm install
```

Each target is a thin delegate to the matching package-manager script.

`make integration` runs the broader integration suite. `make reference` runs only the provenance-locked compatibility cases, including recursive include inlining, stepped and open-ended include slicing, anchor and alias preservation, component/module/version-aware xrefs, family-aware site routing, aligned tables, admonitions, mixed block sequences, and visible unsupported fallbacks where support is still intentionally deferred.

## Release

```bash
make release
```

`make release` delegates to `npm publish`, so it should only be run when the package is ready to publish.

## Package

This repository is shaped as a library-first package with a small CLI entrypoint. The published package exposes the core markdown pipeline API and a scaffolded Antora extension helper under `./extension`.
