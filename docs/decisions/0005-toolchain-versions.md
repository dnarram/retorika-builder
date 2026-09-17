# 0005 — The toolchain is pinned exactly

**Status:** accepted · **Date:** 2026-09-17

## Context

Phase 0 fixed a toolchain without writing down why those versions, or what "those versions"
even means once a caret range is involved. Three of the four are very recent majors, which makes
the question sharper rather than academic.

## Decision

**Pin exactly. No ranges, anywhere.** Each pin below was checked against its registry on
**2026-09-17**, and that date is part of the record — a pin with no check date is a guess that
has aged.

| Tool | Pin | Checked against |
|---|---|---|
| Node | `24.21.0` "Krypton" | `nodejs.org/dist/index.json`. The active LTS line. Node 26.9.0 shipped 2026-09-16 and is still Current; it does not enter LTS until October |
| pnpm | `12.4.2` | npm registry `latest` |
| TypeScript | `7.0.2` | npm registry `latest`. The stable line runs 5.9.3 → 6.0.3 → 7.0.2 |
| Vitest | `5.0.1` | npm registry `latest`. 4.1.11 and 3.2.7 are the prior majors |

Node lives in `.nvmrc` and `engines`; pnpm in `packageManager` and `engines`, with
`engine-strict=true` making both an error rather than a warning. CI reads all of them from those
same fields, so the laptop and the build cannot drift.

### Why exact rather than a range

- **The same bytes here and in CI.** With a caret range, the machine that finds a bug and the
  machine that is supposed to reproduce it are not necessarily running the same compiler.
- **These are very recent majors, and that is precisely the argument.** TypeScript 7 is the
  native port. Vitest 5 is new enough that it removed `vitest.workspace.ts` — a change this
  project hit during phase 0 and had to work around. A caret range would have delivered that
  silently, to whoever installed next, instead of as a reviewed line in a diff.
- **An upgrade should have an author, a date and a diff.** Exact pins make raising a version a
  deliberate commit rather than something that merely happened.

### Newest is not the same as right

`@types/node` is pinned to **24.13.5**, deliberately *not* the registry's `latest`, which was
22.20.3 on the day it was chosen. That package's `latest` tag does not track the newest
version — it has to match the Node major in use — so taking `latest` on faith would have typed
the project against a runtime it does not run on.

`@vitest/coverage-v8` is pinned to **5.0.1** for the same class of reason: a coverage provider
must match its Vitest major, and it being `latest` today is a coincidence, not the criterion.

So the rule is not "pin whatever `latest` says". It is: **pin exactly, record what the pin was
checked against, and state why that version rather than the newest.**

## Consequences

- Raising a pin is a commit that can be reviewed and reverted.
- **CI is what makes raising them safe, and that is the point of pinning at all.** Until the
  Part 9.2 workflow existed, the proof that an upgrade broke nothing was somebody running the
  tests and reporting back. From now on it is the eight jobs staying green — a claim nobody can
  make carelessly. An exact pin with no trustworthy way to move it is how a project ends up
  three majors behind and unable to catch up; the pins and the CI are one decision, not two.
- The check dates in the table go stale on purpose. When they look old, re-check and say so in
  a new revision of this ADR rather than editing the dates in place.
