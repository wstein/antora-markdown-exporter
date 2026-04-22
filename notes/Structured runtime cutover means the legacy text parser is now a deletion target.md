---
id: 20260422050000
aliases: ["Legacy parser deletion target", "Structured runtime cutover", "Delete text parser after cutover"]
tags: ["architecture", "runtime", "cleanup", "exporter", "rewrite"]
target: current
---
Structured runtime cutover means the legacy text parser is now a deletion target because the shipped extension path no longer needs it to render assembled Markdown output. Once the runtime uses structured extraction and lowering end to end, keeping the text parser around stops being architectural caution and starts being regression risk.

## What

The runtime path in `src/extension/index.ts` now follows this sequence:

- assembled AsciiDoc input
- `extractAssemblyStructure(source, { sourcePath })`
- `convertAssemblyStructureToMarkdownIR(document)`
- `normalizeMarkdownIR(document)`
- `renderMarkdown(document, flavor)`

That is the runtime boundary contributors should preserve.

## Why

If the repository keeps treating the legacy text parser as an acceptable fallback after cutover:

- contributors can accidentally route new behavior through the wrong abstraction
- tests can pass while the deletion target quietly survives in package surfaces
- the rewrite stalls in a mixed state where both architectures appear legitimate

The right pressure after cutover is deletion pressure.

## How

Use repository-contract tests and architecture docs to make the intended runtime path explicit.

Then remove the legacy parser in slices:

- first delete extension and operator-path dependencies on it
- then delete overlapping tests that only validate text parsing
- finally delete the parser modules themselves once structured-path parity is proven

Do not add a new fallback from the extension back to `convertAssemblyToMarkdownIR`.

## Links

- [[Repository-owned assembly structure formalizes the exporter adapter boundary]] - Defines the structured handoff contract.
- [[Asciidoctor structural extraction should replace legacy text parsing incrementally]] - Explains the extraction layer that made cutover possible.
- src/extension/index.ts - Shipped structured runtime entrypoint.
- src/adapter/asciidoctor-structure.ts - Structured extraction from assembled content.
- src/exporter/structured-to-ir.ts - Structured lowering into Markdown IR.
