---
id: 20260420193200
aliases: ["Flavor renderer boundary", "Markdown flavor adapters", "Syntax adapters", "GLFM", "glfm"]
tags: ["markdown", "renderer", "flavors", "architecture"]
target: current
---
Flavor renderers are syntax adapters over one normalized semantic layer rather than independent document translators. Each renderer may differ in syntax choices and supported constructs, but it must not redefine document meaning.


## What


The repository supports multiple Markdown flavors such as GFM/GLFM, CommonMark-oriented output, and a stricter canonical flavor. Each flavor renderer serializes the same normalized IR using flavor capabilities and render policy.


GLFM and GFM share core Markdown features based on the CommonMark specification, but each has its own extensions. GLFM includes GFM extensions and also adds GitLab-specific enhancements, while GFM remains the baseline GitHub-compatible syntax. This distinction matters when renderer behavior or fallback policy differs by platform support.


Flavor-specific behavior includes constructs such as admonition syntax, table emission, fence style, heading ID behavior, and HTML tolerance.


## Why


If each renderer makes its own semantic decisions, the project will drift into inconsistent output and impossible-to-explain regressions. A syntax-adapter model keeps meaning centralized and renderer logic narrow.


This makes new flavors additive instead of invasive.


## How


Implement flavor specs in `src/markdown/flavor.ts` and concrete renderers in `src/markdown/render/**`.


Keep flavor support, render policy, escaping, and fallback rules explicit. Unsupported constructs must degrade deterministically and visibly.


Do not allow renderer-local semantics that bypass the IR or normalization passes.


## Links


- [[Markdown IR is the canonical render boundary]] - Semantic meaning is defined upstream of flavor rendering.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Per-flavor golden outputs verify this boundary.
- src/markdown/flavor.ts - Flavor capability and policy definitions.
- src/markdown/render/gfm.ts - GFM renderer.
- src/markdown/render/commonmark.ts - CommonMark-oriented renderer.
- src/markdown/render/strict.ts - Strict canonical renderer.
