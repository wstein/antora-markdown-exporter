---
id: 20260421064500
aliases: ["Central fallback policy", "Markdown fallback layer", "Flavor fallback policy"]
tags: ["markdown", "fallback", "renderer", "architecture"]
target: current
---
Fallback selection is centralized across markdown flavors because unsupported markers, raw HTML allowance, and visible degradation must follow one policy layer instead of drifting across individual renderers. Transparent extensions remain outside that fallback path.

## What

The repository now routes block fallback markers, inline fallback markers, and raw HTML allowance decisions through `src/markdown/fallback.ts`.

That layer decides:
- how unsupported blocks render
- how unsupported inline degradation renders
- when raw HTML is preserved
- when raw HTML is rejected visibly
- when generic raw HTML blocks receive explicit fallback annotations

Flavor renderers consume that policy instead of reimplementing it.

Valid semantic nodes such as fenced `codeBlock` nodes with language tags, including `mermaid` and unknown downstream identifiers, are transparent extensions rather than fallback cases.

## Why

If each renderer owns its own fallback logic, behavior will drift across flavors and raw HTML policy will become implicit again.

Centralizing fallback selection keeps:
- unsupported output deterministic
- raw HTML policy explicit
- renderer code narrower
- tests focused on one contract surface

## How

Keep fallback helpers in `src/markdown/fallback.ts`.

Use renderer unit tests and integration tests to verify both allowed and forbidden raw HTML behavior.

Do not reintroduce direct raw HTML pass-through branches in renderers without going through the fallback layer.

Do not route valid semantic constructs through fallback just because a flavor or the exporter does not interpret their meaning. Transparent extension preservation stays upstream of fallback selection.

## Links

- [[Raw HTML is a controlled fallback not a default rendering path]] - Raw HTML policy depends on explicit fallback selection.
- [[Transparent extensions are not fallback mechanisms]] - Valid semantic extensions must stay separate from fallback behavior.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers should delegate fallback policy.
- src/markdown/fallback.ts - Central fallback policy implementation.
