# 0083 — An exact letter above the heading comes down to it on a phone

**Status:** proposed · **Date:** 2026-11-25 · **Decided by:** David, 25 de noviembre de 2026,
approving the sprint 41 plan «Estirar, agrandar y mover», which carried this as decision *e* of the
defaults he could veto — *«En el móvil, una letra exacta mayor que el titular del tema baja al
titular»* — and as día 1a, a blocking advisory in its own pull request, merged before día 2 turns an
exact letter into a gesture. · **Recorded by development, with the standing note that development does
not sign.** · **Relates to:** [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md)
(an exact value is a marked exception), [ADR 0030](0030-one-breakpoint-bucket-and-the-width-the-gate-measures.md)
(one bucket, under 720 px), [ADR 0069](0069-the-brand-has-a-size-in-the-systems-words.md) (the brand's
name already steps down on a phone) · **Touches:** `packages/renderer` only. **One golden is new —
`letra-exacta-grande`; the other 26 are byte-identical.**

## Context

**Nothing in the stylesheet ever made an exact letter smaller on a phone.** The three size tokens are
flat rem (`packages/tokens/src/scales.ts`), `styleDeclarations` writes an exact length as it is, and the
shared block under 720 px reflows the grid and never touches `font-size`. So a letter typed into
«Tamaño» → «Exacto» was the same number of pixels on every screen, and the toolbar admits up to 200.

**Measured in Chromium on the new fixture, a 96 px headline on a 390 phone:** four lines, 441 px of
headline, and «Reformamos» hyphenated over three of them — «Refor- / ma- / mos / tu casa». The same
document with the cap: two lines, 92 px, no word broken. On a computer the 96 px are what the owner
wrote and nothing changes there.

It was a defect before this sprint, and sprint 41 is about to make it common: día 2 turns the corner
of a text into a gesture that writes exactly this kind of value with a hand rather than a keyboard. So
the cap lands first and alone, as a blocking advisory gets its own pull request.

## Decision

### 1. Above the theme's heading, the heading; at it or below it, nothing

For every element whose `style.fontSize` is exact and **larger than the theme's `size.heading`**, the
stylesheet adds, under `@media (max-width: 720px)`, the same `(0,3,0)` selector with `font-size:
var(--size-heading)`. Equal to the heading is not above it, and a letter under it is the owner's to
keep on every screen. A reference is never touched: the three tokens are the system's own sizes and
already the same on a phone.

**The heading and not a fraction of the exact value**: the heading is the largest letter the system
draws at every width, the brand's name answers the same phone the same way (`brandSizeToken`, ADR
0069), and a proportional rule (say 60 %) would still let a 200 px letter be 120 on a 390 phone. The
heading is read from the theme each time the page is drawn — compact 32, default 40, generous 48 — so a
theme change moves the cap with it, which is rule 6's own promise.

### 2. After the rules it patches, with no `!important`

A media query adds no specificity, so the same selector wins only by coming later. The block follows
the per-element rules, under its own comment, inside `elementStyleCss`. Nothing in it carries
`!important`, which is the promise the per-element block has made since sprint 9.

### 3. Only for the documents that carry one

A document with no exact letter above its heading publishes exactly the bytes it did: the block, its
comment and the call to `tokenPx` are absent. The corpus holds no exact letter at all — the one exact
length in it, 28 px in `estilo-por-elemento`, is a corner's radius — so all 26 goldens are
byte-identical and `letra-exacta-grande` is the new fixture: an exact 96 px headline and 56 px card
title (above), a 40 px services headline (equal) and a 28 px body (below).

## What changes for a saved site

**A saved site whose owner wrote a letter above the heading changes on a phone**, at its next download
or publication: that letter comes down to the heading there. This ADR is the written decision that
sprint's rule asks for when a saved site changes appearance. The canvas shows it in «Ver en móvil»,
because it draws with the same stylesheet.

## What is preserved

- **Rule 6**: an exact value is still written as it was, and still published as it was above 720 px.
- **Rule 7**: the per-element style block stays disjoint from `display`, `order`, `width` and the grid.
- **INV_5**: the cap is a function of the document and its theme, in document order.
- **Every corpus site, byte for byte.**

## What is lost, and it is named

- **A deliberately huge letter on a phone.** An owner who wanted a 96 px word on a 390 screen no
  longer gets it. That word broke in three; there was no version of it worth keeping.
- **The download gate's commonest overflow.** «Algo se sale en el móvil» was most easily reached with a
  200 px letter; it is now reached with spacing (`padding`) and the two walks that used the letter use
  the spacing. The gate itself does not change.

## What this does not decide

- A letter that scales between widths (`clamp()`), or a mobile size of the owner's own — rule 7 admits
  hide, reorder and narrow, and a fourth adjustment would need its own ADR.
- Whether «Exacto» in the toolbar should say what happens on a phone. Nothing on screen claims
  otherwise, and «Ver en móvil» shows it.
- **The header's own letter.** `header.style` admits an exact `fontSize` per part since sprint 32, and
  «Menú» lets the owner write up to 200 px there (`MenuPanel.tsx`). The header is outside rule 7 and
  has its own phone derivations and fold (ADR 0067), so this cap does not reach it, and nothing
  measured today says what a 200 px brand name does to a phone's bar. Named in the backlog for
  sprint 41's close rather than decided here.

## Consequences

- `packages/renderer/src/build.ts`: `elementStyleCss` collects the caps and emits them after its rules.
- `packages/renderer/test/element-style.test.ts`: the block's contents, per scale written out, never a
  reference or another property, never a hidden element, absent from every other corpus document, no
  `!important` and after the rules. Three sabotages, each red: `>=` for `>`, no threshold, the block
  before the rules.
- `packages/renderer/test/element-style.browser.test.ts`: 40 px at 390 and the written sizes at 1280,
  with no word broken at 390.
- `fixtures/documents/letra-exacta-grande.json` and its golden.
- `apps/editor/e2e/critical-flows.e2e.test.ts`: the sprint 10 walk and the download gates' document
  overflow by spacing; the sprint 10 walk asserts that the 200 px letter alone no longer opens the gate.
- `docs/document-rules.md`: a note under rule 6's five properties.
- The record is `docs/design/REVIEW.md`, sprint 41 día 1a.
