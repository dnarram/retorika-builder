# 0006 — Coverage is a ratcheted floor, not a target

**Status:** accepted · **Date:** 2026-09-17

## Context

Part 9.2 of the protocol asks the `unit` job for "Vitest con umbral de cobertura". No threshold
existed, and inventing a number is how coverage gates go wrong: a figure nobody chose on
evidence is a figure everybody feels free to lower the first time it is inconvenient. Which is
what happens to coverage thresholds — the gate turns red at an awkward moment, the number comes
down by five, and the gate has quietly stopped meaning anything.

## Decision

**A measured floor, on the core packages only, that can only ever go up.**

- **Measured, not chosen.** The floor was taken from an actual run on 2026-09-17 and set just
  below it, rounded down: lines 92, functions 95, branches 78, statements 90, against measured
  92.17 / 95.08 / 78.28 / 90.09.
- **Core packages only**: `packages/schema`, `packages/renderer` and `packages/catalog`.
  `scripts/` and the fixtures would distort the number in both directions, and the floor is
  meant to measure the code that ships. `packages/schema/src/testing.ts` is excluded as test
  scaffolding — counting it would have the tests testing themselves.
- **The floor only rises.** Raising a number needs no ceremony. **Lowering one requires its own
  ADR**, saying what became untestable and why.

### And the rule is enforced, not merely written

A rule that lives only in prose is a rule that gets broken — this project has already watched
one piece of hand-maintained documentation drift three times. So the clause above is backed by
`scripts/coverage-ratchet.ts`, which runs both as the sixth pre-commit hook and in the `guards`
CI job, and fails when any number goes down.

That guard decides the file layout. It compares two versions of the thresholds and one of them
is not on disk — it comes out of git. So the numbers live in **`coverage-thresholds.json`**,
readable without evaluating anything, and `vitest.config.ts` imports it. Reading them by
executing a `vitest.config.ts` checked out from another revision would be fragile, and would
also mean running code from a branch in order to decide whether to trust that branch.

Locally there is no base branch, so the hook compares the file against `HEAD`. When there is
genuinely nothing to compare it says so and passes, leaving the blocking case to CI where a real
diff range exists. A hook that fails every time is a hook that gets bypassed with `--no-verify`,
and that is how a guard is lost.

## Consequences

- **Coverage is a floor against regressions, never a target.** This project's quality guarantee
  is the invariants of Part 8.2. A hundred per cent coverage with an invariant broken would be
  worth nothing, and chasing the last few per cent would buy tests written to satisfy a counter.
- The number will drift upward as the core packages grow, and that is fine. Nobody is obliged to
  raise it; nothing is allowed to lower it silently.
- A genuine need to lower it — a package deleted, a whole area moved behind an integration
  test — is not forbidden. It just has to be argued in a file, which is the entire point.
