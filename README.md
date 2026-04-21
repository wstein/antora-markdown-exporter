# @wsmy/antora-markdown-exporter

Antora Assembler based Markdown exporter scaffold with semantic IR, explicit flavor capabilities, and renderer profiles for GitHub Flavored Markdown, CommonMark, GitLab Flavored Markdown, and a strict canonical mode.

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

For machine-readable CI output, the repository also ships a Bun-native example script:

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

Current scaffold coverage includes headings, paragraphs, inline links, dedicated xref nodes with inspectable Antora target metadata and first-class family kinds, dedicated anchor and page-alias nodes, images, ordered and unordered lists, nested lists, thematic breaks, aligned tables, raw HTML nodes, footnote placeholders, fenced code blocks with dedicated callout-list nodes, block quotes, dedicated admonition nodes, and recursive include inlining with dedicated include-directive metadata, for both `partial$` and relative include paths, including tagged-region selection, multi-tag extraction, overlapping-tag precedence, open-ended and stepped line-range unions, invalid-selector diagnostics, indentation, and `leveloffset`, when source-path context is available. Flavor policies can now render page-family xrefs either as source-shaped `.adoc` destinations or as site-shaped Antora-style routes, including `_images`, `_attachments`, and `_examples` asset families where configured.

### Extension scaffold

```ts
import { createAntoraExtensionScaffold } from "@wsmy/antora-markdown-exporter";

const extension = createAntoraExtensionScaffold();
console.log(extension.kind);
```

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
bun run inspect:report -- tests/fixtures/sample/input.adoc
bun run inspect:report -- --stdin --source-path /virtual/page.adoc < tests/fixtures/sample/input.adoc
make format
make fix
```

The primary development path uses Bun through the Makefile delegate targets. npm remains available as an explicit alternate path when needed:

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
