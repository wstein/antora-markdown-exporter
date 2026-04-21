---
id: 20260420193000
aliases: ["Assembler direct converter pipeline", "Exporter pipeline", "Antora Markdown pipeline"]
tags: ["architecture", "antora", "exporter", "markdown", "typescript"]
target: v0.1
---
The exporter pipeline uses Antora Assembler to produce assembled AsciiDoc and then hands that document to a direct TypeScript converter rather than routing through Pandoc or DocBook. This preserves deterministic control over semantics, fallbacks, and flavor-specific rendering.


## What


The repository adopts a three-stage export pipeline:


1. Antora Assembler builds the assembled source document.
2. The TypeScript exporter maps assembled AsciiDoc into a Markdown semantic layer.
3. Flavor renderers serialize that semantic layer into concrete Markdown output.


The converter is direct by design. External document-conversion tools are excluded from the core contract.


## Why


The project targets deterministic, reviewable Markdown output. A direct converter keeps semantic decisions inside the repository, makes fallback behavior testable, and avoids hidden behavior from general-purpose conversion tools.


This also keeps Antora-specific concerns near the extension boundary while preserving a stable internal render contract.


## How


Implement the Antora integration in `src/extension/**` and the assembly conversion boundary in `src/exporter/**`.


Treat the assembled AsciiDoc document as the last Antora-facing artifact. After that point, all decisions must move through the Markdown semantic layer in `src/markdown/**`, including dedicated xref target metadata, dedicated anchors, page-alias metadata, include-directive metadata, images, admonitions, aligned tables, callouts, and recursive include inlining with tagged regions, multi-tag selection, line ranges, indentation, and `leveloffset` handling when source context is available. Renderer flavor policy may then shape page-family xrefs into source-like or site-like destinations without discarding the original Antora coordinates.


Do not add Pandoc, DocBook, or HTML-to-Markdown fallback chains to the primary path.


## Links


- [[Markdown IR is the canonical render boundary]] - The semantic layer formalizes the direct conversion contract.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderer implementations depend on this pipeline boundary.
- src/extension/index.ts - Antora extension registration entrypoint.
- src/exporter/convert-assembly.ts - Assembly-to-IR conversion boundary.
