---
id: 20260421071100
aliases: ["Mermaid passthrough policy", "Fenced extension preservation", "Code block language invariance"]
tags: ["markdown", "renderer", "extensions", "policy"]
target: current
---
Transparent fenced extensions preserve authored language semantics because valid code blocks with declared languages represent intentional author input that downstream Markdown renderers may interpret, and rewriting or downgrading those language tags introduces unnecessary information loss.

## What

The repository treats fenced code blocks with explicit language identifiers, for example `mermaid`, as transparent extensions.

These blocks are:

- represented as normal `codeBlock` nodes in the IR
- rendered with their original language tag unchanged
- not treated as unsupported constructs
- not downgraded to generic or plain text code blocks

Example:

```adoc
[source,mermaid]
----
graph TD
  A --> B
----
```

must render as:

```md
```mermaid
graph TD
  A --> B
```
```

## Why

A fenced code block with a language tag:

- already has a valid semantic representation
- is safe to preserve as text
- may be interpreted by downstream renderers such as GitHub or GitLab

Downgrading it to a generic language or emitting an unsupported marker:

- destroys author intent
- removes useful information
- reduces compatibility with capable renderers
- violates the goal of least-loss conversion

Preserving the language tag is the most faithful and least lossy transformation.

## How

Renderer rules:

- if a node is a valid `codeBlock`, preserve the language string verbatim
- do not rewrite known or unknown languages
- do not convert language identifiers to `text` or other generic values
- do not emit unsupported fallback for valid code blocks

Fallback behavior applies only when:
- the block itself is invalid
- the construct is not representable as a code block
- policy explicitly forbids the entire construct class

This rule is independent from raw HTML fallback and must not be implemented through HTML passthrough.

## Links

- [[Strict architecture must be extended without weakening invariants]] - This is a controlled extension, not a relaxation.
- [[Raw HTML is a controlled fallback not a default rendering path]] - Distinguishes HTML fallback from fenced extension preservation.
- [[Flavor renderers are syntax adapters over one semantic layer]] - Renderers must preserve IR semantics.
- src/markdown/render/markdown.ts - Code block rendering logic.
