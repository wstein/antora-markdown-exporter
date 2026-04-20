# Reference Fixtures

This directory holds provenance-locked reference inputs used for semantic compatibility testing.

## Rules

1. Local fixtures in `tests/fixtures/**` are byte-exact golden contracts.
2. Reference fixtures in `tests/reference/**` are semantic compatibility cases only.
3. Every manifest entry must record source metadata and a locked `sha256` for the local snapshot.
4. Reference tests may assert structural and fallback invariants, but they must not replace local exact-output assertions.
