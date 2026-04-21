---
id: 20260420194500
aliases: ["Raw HTML fallback policy", "HTML passthrough rules", "Markdown HTML handling"]
tags: ["markdown", "fallback", "html", "renderer", "policy"]
target: current
---
Raw HTML is a controlled fallback mechanism for constructs that Markdown cannot represent cleanly, not a default rendering path. It must be explicitly gated by flavor policy and used only after semantic Markdown fallbacks are exhausted.

## What

The repository supports raw HTML emission as a fallback in Markdown output, but only under explicit conditions.

Raw HTML is not part of the semantic Markdown IR. Instead, it appears as a fallback strategy when:
- a construct cannot be represented in Markdown
- semantic fallback would lose too much structure
- the selected flavor policy allows HTML emission through `src/markdown/fallback.ts`

Fallback priority must be:

1. semantic Markdown representation
2. explicit unsupported marker
3. raw HTML fallback
4. fenced source fallback (e.g. asciidoc)

## Why

Markdown portability depends on avoiding assumptions about HTML rendering and sanitization.

Although CommonMark and GFM allow raw HTML syntactically, real platforms apply filtering, sanitization, or partial support. Blind HTML emission introduces:
- non-portable output
- silent rendering differences
- hidden security constraints
- unpredictable behavior across platforms

A controlled fallback ensures:
- deterministic output
- visible degradation
- testable behavior
- clear reviewer intent

## How

Represent HTML fallback explicitly in the IR or fallback layer:

- use a dedicated node or fallback descriptor
- attach a reason for the fallback
- annotate block-level raw HTML when it is emitted as a generic fallback

Example:

```md
<!-- fallback: raw_html reason=html-block -->
<div>raw</div>
<!-- /fallback: raw_html -->
```

Flavor policies must define whether HTML is:

- forbidden
- allowed for a safe subset
- fully allowed

Default behavior:

- strict -> forbid block and inline raw HTML, and emit visible unsupported markers instead
- gfm -> allow policy-mediated inline raw HTML and annotated block-level raw HTML fallback
- commonmark -> allow policy-mediated inline raw HTML and annotated block-level raw HTML fallback
- gitlab -> allow policy-mediated inline raw HTML and annotated block-level raw HTML fallback

Do not use raw HTML for core constructs such as headings, lists, links, or paragraphs.

## Links

- [[Markdown IR is the canonical render boundary]] - Raw HTML must not bypass semantic representation.
- [[Fallback selection is centralized across markdown flavors]] - HTML allowance and visible degradation should flow through one fallback layer.
- [[Flavor renderers are syntax adapters over one semantic layer]] - HTML usage depends on flavor policy.
- [[Reference tests check semantic invariants not exact bytes]] - HTML fallback must remain visible and testable.
- src/markdown/fallback.ts - Fallback selection logic.
