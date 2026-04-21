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
  convertAssemblyToMarkdownIR,
  normalizeMarkdownIR,
  renderMarkdown,
  renderGfm,
} from "@wsmy/antora-markdown-exporter";

const ir = convertAssemblyToMarkdownIR("== Sample document\n\nHello world.");
const normalized = normalizeMarkdownIR(ir);

console.log(renderGfm(normalized));
console.log(renderMarkdown(normalized, "commonmark"));
```

Current scaffold coverage includes headings, paragraphs, inline links, dedicated xref nodes with inspectable Antora target metadata, dedicated anchor and page-alias nodes, images, ordered and unordered lists, nested lists, thematic breaks, aligned tables, raw HTML nodes, footnote placeholders, fenced code blocks with dedicated callout-list nodes, block quotes, dedicated admonition nodes, and recursive include inlining with dedicated include-directive metadata, for both `partial$` and relative include paths, including tagged-region selection, multi-tag extraction, line ranges, indentation, and `leveloffset`, when source-path context is available. Flavor policies can now render page-family xrefs either as source-shaped `.adoc` destinations or as site-shaped `.html` routes while leaving non-page families source-visible.

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

`make integration` runs the broader integration suite. `make reference` runs only the provenance-locked compatibility cases, including recursive include inlining, anchor and alias preservation, component/module/version-aware xrefs, aligned tables, admonitions, mixed block sequences, and visible unsupported fallbacks where support is still intentionally deferred.

## Release

```bash
make release
```

`make release` delegates to `npm publish`, so it should only be run when the package is ready to publish.

## Package

This repository is shaped as a library-first package with a small CLI entrypoint. The published package exposes the core markdown pipeline API and a scaffolded Antora extension helper under `./extension`.
