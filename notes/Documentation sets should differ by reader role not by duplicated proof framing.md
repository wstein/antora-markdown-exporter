---
id: 20260422150000
aliases: ["Documentation role split", "Doc role differentiation", "Onboarding manual architecture separation"]
tags: ["docs", "architecture", "onboarding", "manual"]
target: current
---
Documentation sets should differ by reader role, not by repeatedly restating the same proof framing with slightly different labels. This repository needs auditable claims, but it also needs a readable first path for contributors and a task-first path for operators.

## What

The documentation set should be split this way:

- onboarding is chronological and action-oriented
- manual is task-first and operational
- architecture is formal, evidence-heavy, and complete

Each document can still mention status, support, and proof when needed, but those concepts should have one canonical home instead of competing introductions in every document.

## Why

Without role separation:

- onboarding becomes heavier than a first-day contributor needs
- the manual spends too much time justifying architecture instead of helping operators act
- architecture loses its value as the single canonical source for invariants, proof surfaces, and evidence-ledger detail

The project should still be auditable, but it should not make every reader walk through the full evidence model before they can do basic work.

## How

Apply these rules:

- onboarding should start with the first build, first test run, first change, and where code goes
- manual should focus on prerequisites, commands, troubleshooting, validation, and release operations
- architecture should keep the full claim-status grammar, proof matrix, evidence ledger, and adapter-contract formalism
- prose should state principles directly first, then attach traceability second

That means:

- keep only a minimal status-marker note in onboarding
- keep a short legend near support and proof sections in the manual instead of using status grammar as the whole frame
- keep the full formal grammar and evidence model in architecture

## Links

- docs/modules/onboarding/pages/index.adoc - Contributor-first path and routing guidance.
- docs/modules/manual/pages/index.adoc - Operator-first commands, support matrix, and troubleshooting.
- docs/modules/architecture/partials/01_introduction_and_goals.adoc - Canonical home for claim-status grammar.
- docs/modules/architecture/partials/10_quality_requirements.adoc - Canonical proof matrix and evidence ledger.
