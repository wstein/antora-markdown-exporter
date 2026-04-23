---
id: 20260420193000
aliases: ["Assembler direct converter pipeline", "Exporter pipeline", "Antora Markdown pipeline"]
tags: ["architecture", "antora", "exporter", "markdown", "typescript"]
target: current
---
The exporter pipeline uses Antora Assembler to produce assembled AsciiDoc and then hands that document to a direct TypeScript conversion pipeline rather than routing through Pandoc or DocBook. This preserves deterministic control over semantics, fallbacks, and flavor-specific rendering.


## What


The repository adopts a four-stage export pipeline:


1. Antora Assembler builds the assembled source document.
2. The repository-owned extractor turns assembled source into structured assembly data.
3. Structured conversion maps that repository-owned structure into the Markdown semantic layer.
4. Flavor renderers serialize that semantic layer into concrete Markdown output.


The converter is direct by design. External document-conversion tools are excluded from the core contract.


## Why


The project targets deterministic, reviewable Markdown output. A direct converter keeps semantic decisions inside the repository, makes fallback behavior testable, and avoids hidden behavior from general-purpose conversion tools.


This also keeps Antora-specific concerns near the extension boundary while preserving a stable internal render contract.


## How


Implement the Antora integration in `src/extension/**`, structural extraction in `src/adapter/**`, and semantic conversion plus rendering in `src/exporter/**` and `src/markdown/**`.


Treat the assembled AsciiDoc document as the last Antora-facing artifact. After that point, all decisions must move through repository-owned structure and the Markdown semantic layer in `src/adapter/**` and `src/markdown/**`, including dedicated xref target metadata, dedicated anchors, page-alias metadata, images, admonitions, aligned tables, callouts, and any include metadata or diagnostics the repository deliberately preserves for inspection. Renderers should serialize the assembled hrefs they receive without reconstructing Antora routing policy after assembly.


Do not add Pandoc, DocBook, or HTML-to-Markdown fallback chains to the primary path.


## Links


- [[Markdown IR is the canonical render boundary]] - The semantic layer formalizes the direct conversion contract.
- [[Repository-owned assembly structure formalizes the exporter adapter boundary]] - Structured extraction creates the stable handoff into semantic conversion.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderer implementations depend on this pipeline boundary.
- [[Xref destinations come from assembled hrefs]] - The repository now preserves assembled hrefs instead of rebuilding routes after conversion.
- src/extension/index.ts - Antora extension registration entrypoint.
- src/adapter/asciidoctor-structure.ts - Assembled-source to repository-owned structured extraction.
- src/exporter/structured-to-ir.ts - Structured assembly to Markdown IR conversion boundary.
