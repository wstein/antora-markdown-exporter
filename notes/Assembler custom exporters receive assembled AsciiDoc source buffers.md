---
id: 20260422035500
aliases: ["Documented assembler handoff", "Assembler source-buffer handoff", "Custom exporter handoff format"]
tags: ["architecture", "antora", "assembler", "exporter", "handoff"]
target: current
---
Assembler custom exporters receive assembled AsciiDoc source buffers because the documented Antora Assembler custom exporter API passes an assembly file to the converter and the converter typically consumes `file.contents` as AsciiDoc source.

## What

The documented custom exporter handoff is an assembly file passed to:

- `convert(file, convertAttributes, buildConfig)`

In that API, the exporter typically consumes:

- `file.contents` as the AsciiDoc source buffer
- `convertAttributes` as the AsciiDoc attributes for conversion
- `buildConfig` as the command and working-directory context

This is the current documented external handoff format for an Assembler exporter extension.

## Why

The repository should not describe a structural-document or AST handoff as though it were already the documented Assembler extension contract.

If docs blur that distinction:

- the current implementation becomes harder to evaluate honestly
- future refactors look like bug fixes instead of architecture changes
- contributors can confuse an internal target design with an upstream API guarantee

## How

Document the current external boundary as:

- source pages
- Assembler
- assembled AsciiDoc document
- exporter conversion callback

Treat any richer structural representation as a repository-owned adapter stage unless and until the upstream extension API provides it directly.

## Links

- [[Exporter pipeline uses Assembler and a direct TypeScript converter]] - The pipeline starts from Assembler-produced assembly documents.
- [[Documentation claims should distinguish implementation test and workflow evidence]] - The handoff contract should be described with the same precision as other major claims.
- src/extension/index.ts - Repository entrypoint that delegates to `@antora/assembler.configure()`.
- https://docs.antora.org/assembler/latest/custom-exporter-extension/ - Documented custom exporter API.
