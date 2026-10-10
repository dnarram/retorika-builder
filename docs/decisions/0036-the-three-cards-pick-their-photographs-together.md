# 0036 — The three cards pick their photographs together

**Status:** **accepted** · **Date:** 2026-10-09 · **Accepted:** 2026-10-10 ·
**Proposed by:** development, sprint 16 day 1, with the measurement ADR 0011's own reason asked for
and never got ·
**Accepted by:** **David, 10 October 2026** — «Firma los ADR 0036 y 0037 por mi», opening sprint 17
day 3. **Recorded by development at his instruction, which is said out loud because the standing
rule is that development does not sign.** The decision is his; the keystrokes are not, and anybody
reading this later should be able to tell the difference without asking. ·
**Amends:** [ADR 0011](0011-sample-photos-per-sector.md), the «at least eight» clause ·
**Built:** sprint 17 day 2, before the signature — the code landed with this ADR still `proposed`,
which is recorded in the pull request and in `docs/tasks/backlog.md` rather than tidied away.

## Context

ADR 0011 asked for a minimum and said why:

> **At least eight photos per sector,** so the three variants and "volver a generar" do not repeat
> themselves.

«Volver a generar» no longer exists — a deterministic generator has no regenerate button, which is
why one was refused when it was proposed — so the whole of that reason now rests on the three cards
of «elige por dónde empezar», the screen where the three sit side by side and the cover is the
biggest thing on each.

**Measured on 8 October 2026 with the nine approved photographs: two of the three cards show the
same photograph for 39.4% of business names — 787 of 2000.** That is not a bad hash. Three
independent uniform draws from nine repeat 30.86% of the time
(`(9 × 8 × 7) / 9³ = 0.6914`), so about 31% is the floor a perfect hash would give. The defect is
not the quality of the draw, it is that **there are three independent draws rather than one draw
without replacement.**

So the minimum does not buy what it was asked to buy, and **a bigger bank makes repetition rarer
and never impossible**: 14.5% at twenty photographs, 5.9% at fifty. Raising the minimum cannot fix
this. The rule is still worth keeping for what it does buy — it is what stops a sector shipping with
two photographs and showing one of them on every card — and ADR 0011's stated reason has to move
somewhere that can hold it.

## Decision

**The three cards are picked together, as one draw without replacement.**

> **Built and measured, 10 October 2026 (sprint 17 day 2).** The rate this ADR was written about was
> re-measured first and reproduced exactly — 787 of 2000, 39.4% — and is now **0 of 2000**. The test
> that landed asserts the property over two hundred business names per filled sector, not the
> percentage, for the reason the last consequence below gives.

- `sampleImageFor(sector, seed, options?)` in `packages/photobank/src/index.ts` takes an optional
  `avoid: readonly string[]` of bank ids. It hashes the seed exactly as today (`pickIndex`, FNV-1a,
  no clock, no randomness, over the id-sorted list) and then walks forward from that index to the
  first record whose id is not in `avoid`, wrapping once. With every id avoided it returns the
  hashed one, because a photograph is better than none and the alternative is an exception on a
  screen.
- `generateVariants` in `packages/generator/src/index.ts` owns the exclusion: it builds the three in
  order and passes each one the ids the earlier ones chose. `generate(answers, variant)` called on
  its own — one variant, no siblings — behaves exactly as it does today, which matters because that
  is the entry point the tests and the editor's own «añadir sección» paths use.
- A sector holds zero photographs or at least eight (ADR 0011, enforced by `bank.test.ts`), so with
  any bank at all the three cards are now always three different photographs. The guarantee is
  stated as «never two the same when the sector has three or more», not «eight is enough».

**It stays deterministic.** Same answers, same site: the walk is a pure function of the seed, the
sorted bank and the ids already chosen, and the order the three are built in is fixed by `VARIANTS`.
`INV_5` and the golden corpus are untouched — no golden fixture is generator output for a sector
with photographs.

## Alternatives, and why not

**Raise the minimum.** The measurement above is the answer: it reduces the rate and never reaches
zero, and ADR 0011 already asks for eight on other grounds.

**A better hash.** Independence is the problem, not uniformity. A perfect hash still repeats 31% of
the time with nine.

**Offset by variant index** — v1 takes the hashed photograph, v2 the next, v3 the one after. It needs
no new parameter and no contract change, and it is rejected on the bank's own contents: the records
are sorted by id, ids are assigned in approval order, and approval order follows the generation
batch. `restaurante-bar.01` and `.02` are both «mesa de madera con mantel de lino… copa de vino
tinto y pan», two frames of one prompt. An offset would guarantee the three cards are three adjacent
ids, which is the one arrangement most likely to show the same scene three times — distinct records
and an indistinguishable screen, which is worse than the honest repeat it replaces because nothing
would report it.

## Consequences

- `sampleImageFor`'s signature changes. It is called in one place today
  (`packages/generator/src/sections.ts`, the cover) plus its own tests; the parameter is optional, so
  no call site is forced to change.
- `generateVariants` stops being `VARIANTS.map(...)` and becomes a fold that carries the chosen ids.
  That is the whole cost, and it is the right place: the three cards are a property of the screen
  that shows three, not of any one of them.
- A gallery of eight photographs in one section would want the same treatment — eight draws, not
  eight independent hashes. Nothing generates one today (a generated site carries exactly one
  photograph, on the cover), so this ADR does not build it; when a section does, `avoid` is already
  the shape it needs.
- The measurement is repeatable: the 39.4% came from 2000 business names, and the test that lands
  with this asserts the property instead — three or more photographs, three different cards — because
  a percentage in a test is a number that goes stale, and the property is what was actually promised.

## What this does not decide

- **How many photographs a sector should hold.** Eight stands, for the reason that survives.
- **Which photograph suits which composition.** «Con foto grande» shows the cover at 1344 px and the
  other two at 664 px, so a photograph can be right for one card and wrong for another; nothing here
  knows that, and deciding it would need something in the record a reviewer writes.
  [ADR 0035](0035-the-bank-has-a-floor-and-the-nine-are-regenerated.md) settles the resolution those
  widths demand, which is a different question from which frame goes where.
