---
id: 20260422233500
title: Review debate on softening the exporter architecture and docs
target: current
---

# Review debate on softening the exporter architecture and docs

## Prompt

Two external review discussions pushed on different weaknesses:

- the architecture review defended the semantic pipeline and direct Assembler integration as deliberate rather than overengineered
- the documentation review argued that repository jargon, mixed personas, and visible unsupported markers make the tool harder to adopt than it needs to be

This note records an internal debate instead of flattening those tensions into one polite summary.

## Debate

### Mira, architecture lead

Position:

- The semantic pipeline is correct and should not be softened into a generic Pandoc-style shortcut.
- The strongest evidence is that deterministic lowering, shared IR, and explicit tests already give the repository a durable control surface that black-box conversion tools would weaken.

Critique of the review:

- The architecture critique overreaches when it treats strictness itself as the problem.
- The real problem is documentation posture, not the IR boundary.

Suggestions:

- Keep the semantic pipeline and direct Assembler integration unchanged.
- Rewrite docs so standard Antora concepts appear before repository shorthand.
- Rate: `9/10`

Response to others:

- I agree with the product concern that site integrators should not see contributor commands first.
- I disagree with any proposal that makes rendered fallback warnings disappear by default. Silent degradation would erase evidence of semantic loss.

### Jonah, product lead

Position:

- The current docs make a normal Antora site integrator pay an unnecessary cognitive tax.
- The review is right that the repository still asks readers to understand contributor tooling too early.

Evidence:

- The README and operator docs spend far more space on `make`, Bun, release flows, and repository exports than on the minimal extension setup path.
- A site integrator should be able to answer one question quickly: how do I wire this into Antora without inheriting the package repo's local workflow.

Suggestions:

- Add a true Antora site quick start that stays inside Antora concepts.
- Split docs by reader persona more aggressively.
- Keep the contributor workflow, but move it out of the first-contact path.
- Rate: `10/10`

Response to others:

- Mira is right that the pipeline itself is not the adoption problem.
- Priya is right that visible unsupported markers are blunt, but I would rather improve explanation and configuration than hide them outright.

### Priya, developer experience lead

Position:

- The review is correct that visible unsupported markers are punishing for readers when the markdown artifact is intended for review or distribution.
- The current posture protects maintainers first and readers second.

Evidence:

- The repo's fallback policy is explicit and testable, which is good.
- But explicitness does not automatically imply the current default is the right one for every export context.

Suggestions:

- Document the current strict fallback policy honestly.
- Explore a future configurable review-oriented mode that preserves inner text while logging loss to CI or stderr.
- Do not implement silent graceful degradation until the policy surface is clearly specified and testable.
- Rate: `7/10`

Response to others:

- Mira is right that silent loss would be a regression.
- Jonah is right that reader experience matters; I just do not want us to trade away evidence integrity in the name of smoothness.

### Samir, QA lead

Position:

- The architecture is defensible because it is provable.
- Any softening proposal that cannot be expressed in fixtures, invariants, or explicit config is likely to create technical debt.

Evidence:

- The strongest repo assets today are exact-output goldens, reference fixtures, and contract tests around the IR and extension boundaries.
- Those tests are why the complexity remains reviewable instead of mystical.

Suggestions:

- Convert the review feedback into sharper docs and notes first.
- Only pursue fallback-mode changes after they are framed as a contract with exact test evidence.
- Add contract tests for any future persona split or Antora-native config path that becomes user-facing.
- Rate: `8/10`

Response to others:

- I support Jonah's persona split because it reduces documentation ambiguity without weakening tests.
- I support Priya's exploration note, but not implementation by anecdote.

## Consensus

The team reached a narrow but real consensus:

1. Keep the semantic pipeline, Assembler integration, and repository-owned IR boundary.
2. Change the docs, not the architecture, as the first response to the critique.
3. Put Antora-native concepts and site-integrator setup ahead of repository contributor tooling in first-contact docs.
4. Treat graceful degradation as a possible future policy option, not a casual default change.
5. Require any future fallback softening to arrive with explicit config semantics, tests, and evidence rules.

## Key Points

- The architecture review was persuasive on engineering durability.
- The documentation review was persuasive on adoption friction.
- The exporter should trust Antora vocabulary first and explain repository shorthand second.
- Repository convenience commands are not the same thing as the public Antora integration contract.
- Reader-facing fallback behavior is still an open design question, but it should be debated as policy, not smuggled in as a renderer hack.

## Potential Future Developments

- A dedicated documentation path for Antora site integrators separate from repository operator guidance.
- A formal fallback-mode design note with exact semantics for strict versus review-oriented export behavior.
- More contract tests proving that Antora-native config remains the policy owner while wrapper scripts stay optional.

## Concrete Suggestions

- Keep the README focused on Antora integration before contributor workflows.
- Add terminology bridges anywhere repository shorthand risks replacing standard Antora language.
- Continue moving export defaults into Antora-owned config rather than wrapper-only flags.
- If graceful degradation is explored, define it in config, tests, and docs before implementation.

## Links

- [README.md](../README.md)
- [docs/modules/manual/pages/index.adoc](../docs/modules/manual/pages/index.adoc)
- [docs/modules/onboarding/pages/index.adoc](../docs/modules/onboarding/pages/index.adoc)
- [[Antora CLI markdown export should be configurable through playbook variables]]
- [[The architecture favors explicit extension over implicit degradation]]
