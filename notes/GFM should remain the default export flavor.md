---
id: 20260422125600
aliases: ["Keep GFM as default", "GFM default flavor policy"]
tags: ["markdown", "flavors", "gfm", "policy"]
target: current
---
GitHub Flavored Markdown should remain the default export flavor even if the repository adds MultiMarkdown later. The current repository story, fixtures, tests, and operator workflow are centered on GFM, so changing the default would be a contract change rather than a neutral extension.

## What

The default flavor policy should remain:

- `gfm` is the default renderer
- additional flavors expand the supported output set
- new flavors do not silently replace the baseline operator contract

## Why

GFM is already the repository’s published baseline in examples, golden fixtures, and operator-facing docs. MultiMarkdown has a broader feature surface, so it should be introduced as opt-in support rather than as the new assumed default.

## Links

- [[MultiMarkdown should be a v0.7 flavor target]] - Future flavor growth does not require a default change.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Default policy belongs in the renderer layer, not the adapter boundary.
