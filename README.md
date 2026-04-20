# @wsmy/antora-markdown-exporter

Antora Assembler based Markdown exporter scaffold with semantic IR and a first GitHub Flavored Markdown rendering path.

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
  renderGfm,
} from "@wsmy/antora-markdown-exporter";

const ir = convertAssemblyToMarkdownIR("== Sample document\n\nHello world.");
const normalized = normalizeMarkdownIR(ir);

console.log(renderGfm(normalized));
```

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

## Release

```bash
make release
```

`make release` delegates to `npm publish`, so it should only be run when the package is ready to publish.

## Package

This repository is shaped as a library-first package with a small CLI entrypoint. The published package exposes the core markdown pipeline API and a scaffolded Antora extension helper under `./extension`.
