---
id: 20260420194600
aliases: ["Extended Markdown syntax guide", "Markdown feature catalog", "Non-normative syntax reference"]
tags: ["markdown", "specification", "compatibility", "features"]
target: current
---
The Markdown Guide Extended Syntax page is a capability reference describing commonly used Markdown extensions, not a formal specification. It should inform feature discovery and fallback design, but must not define the repository's rendering contract.

## What

The Markdown Guide Extended Syntax aggregates features such as:
- tables
- task lists
- strikethrough
- footnotes
- definition lists
- emoji and formatting extensions

These features originate from multiple ecosystems including GFM, Markdown Extra, and other implementations.

The guide is descriptive and cross-platform, not normative or enforceable.

## Why

Different Markdown platforms implement different subsets of extended syntax, often with incompatible rules.

Treating the guide as a specification would lead to:
- inconsistent rendering across flavors
- unclear fallback behavior
- unstable output contracts
- feature creep without test coverage

The repository instead defines:
- a semantic IR
- a flavor capability model
- transparent extension preservation for valid semantic constructs
- explicit fallback policies

This ensures deterministic behavior independent of informal feature lists.

## How

Use the guide to classify features into tiers:

- core constructs -> already covered by IR
- widely supported extensions -> candidates for implementation
- fragmented extensions -> require IR design before implementation
- cosmetic or platform-specific features -> low priority

Map features to explicit flavor capabilities rather than enabling them globally.

When a feature already fits an existing semantic node, such as a fenced code block with an authored language tag, preserve it through the IR instead of forcing it into fallback.

Example capability flags:

- supportsTables
- supportsTaskLists
- supportsStrikethrough
- supportsFootnotes
- supportsDefinitionLists

Do not implement a feature without:
- IR representation
- normalization rules
- renderer support
- test coverage

## Links

- [[Flavor renderers are syntax adapters over one semantic layer]] - Features must map through flavor capabilities.
- [[Transparent fenced extensions preserve authored language semantics]] - Valid fenced extensions should be preserved semantically instead of downgraded.
- [[Testing relies on golden fixtures and deterministic snapshots]] - Every feature requires deterministic tests.
- [[Reference corpus should cover navigation xrefs includes and admonitions]] - Real usage drives feature selection.
- src/markdown/flavor.ts - Capability definitions.
