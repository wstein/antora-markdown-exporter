# @wsmy/antora-markdown-exporter

Antora Assembler based Markdown exporter with semantic IR and multi-flavor rendering.

## Install

```bash
npm install @wsmy/antora-markdown-exporter
```

## Usage

### Library

```ts
import { registerAntoraExtension } from "@wsmy/antora-markdown-exporter";

const extension = registerAntoraExtension();
console.log(extension.name);
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
```

The Makefile uses an explicit package manager setting. It defaults to Bun and can be overridden when needed:

```bash
make PM=npm install
make PM=npm test
```

## Package

This repository is shaped as a library-first package with a small CLI entrypoint. The published package exposes the core module API and the Antora extension entrypoint under `./extension`.
