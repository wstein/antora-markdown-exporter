---
id: 20260421082500
aliases: ["Docs coverage for transparent extensions", "Mermaid documentation rule", "Transparent extension explanation"]
tags: ["docs", "extensions", "markdown", "architecture"]
target: current
---
Generated docs should explain transparent extensions as a separate contract category because valid authored constructs such as Mermaid fenced blocks are preserved intentionally and should not be confused with fallback behavior or unsupported degradation.

## What

The generated architecture guide should explicitly describe transparent extension preservation alongside:
- native markdown constructs
- fallback policy
- unsupported degradation

Mermaid is the primary example:
- it is preserved as a valid fenced code block with its authored language tag
- it is not raw HTML fallback
- it is not downgraded to plain code
- it is not emitted as unsupported

## Why

Without this distinction, readers may assume that anything outside baseline CommonMark is handled through fallback. That is inaccurate and would misrepresent the repository's renderer contract.

Transparent extension preservation is an intentional capability and should be documented as such.

## How

Include a short section in generated architecture docs that explains:
- what transparent extensions are
- why they differ from fallback
- why preserving authored code-block language tags is the least lossy rule

Keep Mermaid as the motivating example.

## Links

- [[Transparent fenced extensions preserve authored language semantics]] - Canonical note for the Mermaid rule.
- [[Transparent extensions are not fallback mechanisms]] - Distinguishes extension preservation from degradation.
- docs/architecture.md - Generated narrative should include this contract category.
