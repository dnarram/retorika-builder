# 0013 — "Qué hago" holds one to six cards, and none means no section

**Status:** accepted · **Date:** 2026-09-23 · **Decided by:** the CEO

## Context

[ADR 0010](0010-initial-questionnaire.md) left two questions open: how many suggestions can be
ticked in question 3, and what happens below the list's minimum of two cards. The design session
(`docs/design/HANDOFF.md`, D9) proposed an answer, and reviewing it produced a correction worth
recording.

**D9's premise was wrong.** It argued that a single card would be "stranded in a four-column
grid", leaving a large empty gap, and that the renderer should therefore pick a composition from
the card count. Measured at 1280 against the merged renderer, with the list of
`fixtures/documents/cover-and-services.json`:

| Cards | Card widths | `grid-template-columns` as computed |
|---|---|---|
| 1 | 1184 | `1184px 0px 0px 0px` |
| 2 | 584, 584 | `584px 584px 0px 0px` |
| 3 | 384, 384, 384 | `384px 384px 384px 0px` |

`repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` collapses the empty tracks, so the widths D9
asked for already happen. A renderer that chose a composition from the content would also break
how compositions work here: the composition is a variant stored in the document, and the same
document must not lay itself out differently as the user ticks a box.

## Decision

- **A "Qué hago" section holds between one and six cards.**
  - The **maximum stays 6**, as `packages/catalog` already declares. Beyond that the section
    becomes tiring to read, and the questionnaire's job is to get a site standing, not to
    catalogue a business.
  - The **minimum drops from 2 to 1**. One real service is a legitimate answer, and it is drawn
    full width already.
- **Zero ticked means the section is not generated at all,** exactly as skipping question 3 does
  (ADR 0010). It is not an error and it blocks nothing: the section can be added later from the
  catalog, and nothing the user wrote is destroyed.
- **The card widths are not a product decision.** They come from the stylesheet's `auto-fit`
  rule, and they are covered by the golden corpus and the overflow suite.
- **The "featured card with a photo beside it" is not adopted.** It needs images inside list
  items, which the "Qué hago" task excluded deliberately ("No images in the cards. Images inside
  lists arrive with 'Fotos de trabajos'"). If it is ever wanted, it is a composition of its own
  with its own task.

## Consequences

- **ADR 0010's two open questions are closed.**
- `SERVICES_ITEMS` in `packages/catalog/src/services.ts` says `{ min: 2, max: 6 }` and must
  become `{ min: 1, max: 6 }`. That change belongs to the questionnaire and generator task, with
  its own tests, and is tracked in its own issue — recording a decision and changing a
  cardinality are two different acts.
- The questionnaire's screen for question 3 needs no maximum of its own: the limit is the
  section's, which is where a reader would look for it.

## Evidence from session 1 (26 September 2026)

> One business, run against the deployed editor. ADR 0017 calls the two sessions «two
> experiments of one subject each»; one of them is not a tendency, and nothing below is
> written as one.
> Source: `docs/sessions/2026-09-25-taberna-santo-domingo.md`.

The design review's D9 asked one question that only an owner could answer, and this session
answered it:

- **He did not believe the suggestions came pre-ticked.** They start unticked on purpose, and the
  worry recorded in `docs/design/REVIEW.md` was that someone would scroll past thinking the work
  was done. He did not.
- **He ticked four, and added none of his own.** Four is comfortably inside the 1..6 this ADR
  decided, so the session exercised neither bound: not the single-card floor, and not the six-card
  ceiling. **Nothing here confirms or challenges the cardinality** — it confirms the default state
  is read correctly, which is the part D9 was actually unsure about.
