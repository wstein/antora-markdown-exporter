---
id: 20260422032800
aliases: ["No default index generation", "Index generation is optional", "Indexterm support is not a default exporter requirement"]
tags: ["architecture", "antora", "scope", "index", "asciidoctor"]
target: current
---
Index generation is outside the default Antora exporter scope because Antora does not inherently build a traditional AsciiDoc index page during assembly. Although `indexterm::[]` is parsed by Asciidoctor, the assembler does not turn that into a site index by default, so the exporter should not implement index generation unless the repository explicitly adopts that feature.

## What

The default exporter scope does not include building a traditional back-of-book or site index from `indexterm::[]` entries.

Current boundary:

- Asciidoctor can parse `indexterm::[]`
- Antora Assembler does not normally materialize a site-wide index from those terms
- the exporter therefore does not need index generation as part of the normal markdown contract

## Why

Treating index generation as implicit exporter scope would overstate what Antora supplies and would introduce a feature family with its own data model, rendering rules, and proof obligations.

That work is valid only if the repository explicitly chooses it.

Until then, the honest default is:

- no implied site index generation
- no hidden `indexterm::[]` support claims beyond what assembled content actually preserves

## How

Do not describe index generation as part of baseline exporter completeness.

If the repository ever adopts index support, define it as an explicit feature with:

- a dedicated semantic representation
- clear rendering expectations
- documentation updates
- dedicated tests and support-matrix entries

## Links

- [[Converter coverage should be published as a support matrix]] - Optional scope should not be implied as baseline support.
- [[Documentation claims should distinguish implementation test and workflow evidence]] - Index claims would need explicit proof surfaces.
- [[Strict architecture must be extended without weakening invariants]] - New feature families should extend the architecture explicitly.
- docs/modules/manual/pages/index.adoc - Operator-facing support boundaries.
