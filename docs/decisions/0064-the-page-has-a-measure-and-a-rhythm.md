# 0064 — The page has a measure and a rhythm

**Status:** proposed · **Date:** 2026-11-04 · **Decided by:** David, 3 de noviembre de 2026, al
planificar el sprint 32 — of the four pieces the plan put to him beside the menus he chose all four,
and the content's maximum width was the fourth; the rhythm (the sections' vertical room, the reading
text's line, the headings) is the plan's decisions 6 and 7, approved with it; at approval, his
adjustment 5 (§3 below). · **Recorded by development at his instruction, with the standing note that
development does not sign.** · **Relates to:** [ADR 0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md)
(the bar takes the same measure; the button's pill), [ADR 0062](0062-the-published-site-moves-just-enough-without-a-byte-of-script.md)
(the reveal, whose residual it measures), [ADR 0060](0060-each-menu-has-its-place-and-the-places-are-the-zones.md)
(a rail narrows `<main>`), [ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md)
(the fine grid lies inside the padding) · **Closes:** the backlog's row «whether the page should have
a maximum width at all», and its row of the reading text's CLS (`line-height: normal`, 0.009 since
sprint 30) · **Touches:** `packages/renderer`

## Context

A published section was twelve columns across the whole window, `padding: var(--space-xl)` all
round: 48 px with the default scale, at 1280 and at 2560 alike. On a laptop that read well; on a
1680 screen a line of a services intro ran 1584 px, and the cover's words sat as far from each other as
the screen allowed. Paragraphs were set at `line-height: normal`, which is each letter's own ascent
and descent — the 0.009 of text CLS the backlog has carried since sprint 30, because a paragraph
changed height when the site's letter arrived — and headings at the same. Photographs had the medium
radius, the cover's panel had none of the depth a card has, and a section's button was the
`radius-sm` rectangle the bar's had been until ADR 0063.

## Decision

### 1. A measure of 1200 px, by padding, from 1296 up

```css
html { --rb-measure: 1200px; }
.rb-section { padding: calc(1.5 * var(--space-xl)) max(var(--space-xl), calc((100% - var(--rb-measure)) / 2)); }
```

- **By padding, never by `max-width`**: a section's background stays edge to edge and only its
  content centres. No markup changes; the fine grid of a hand-designed section (ADR 0050) is laid inside
  the padding and keeps every placement.
- **At 1280 nothing moves**: `max(48, (1280 − 1200) / 2)` is the 48 the scale already gave, so the
  canvas (which lays out at 1280, ADR 0061), the overflow walk at 1280 and the golden geometry measure
  what they measured. The padding grows from 1296 up. With the `compact` scale (32 px) it is 40 at 1280:
  that one moves by 8 px a side, and it is said here. With `generous` (72 px) nothing moves until 1344.
- **A percentage of padding is a percentage of the containing block**, `<main>`, which a rail already
  narrows: beside a rail the content centres in what `<main>` keeps. Measured at 1680 with one rail:
  `<main>` 1440 wide, content 1200, centred in it within a pixel.
- **The bar takes the same measure**, so its brand lines up with the sections' words at every width.
  The bar's containing block is the `<body>`, not `<main>`, so the rails' widths are taken out:
  `--rb-rail-l` and `--rb-rail-r`, written in the same rules that give the header and `<main>` their
  rail margins (ADR 0060), and 0 where those margins fall. Measured at 1680: brand and the cover's
  content edge at 240 without a rail, at 360 with a left rail; the bar's right content edge on the
  section's within a pixel. A collapsed bar (`collapseBar`, weighing 0,3,0 or more inside the rails'
  `@media`) still wins over the base rule's padding.
- **A constant of the motor**, like `--rb-header-h`, not a token of the document: rule 6 is about what
  the owner chooses (`document-rules.md`, día 7).

### 2. The rhythm

- **A section breathes**: `calc(1.5 * var(--space-xl))` above and below, 72 px with the default
  scale, where it was 48. The phone's shared block (`build.ts`, pinned by `mobile.test.ts`) resets the
  padding with its own shorthand and is unchanged: on a phone a section keeps `space.lg`.
- **Reading text at `line-height: 1.6`**, a number where it was `normal`. It closes the backlog's row
  of the text's CLS as the design decision that row asked for: a number is the same height in the
  fallback letter and in the site's own, so a paragraph has its final height before the letter
  arrives — the bar's lesson of sprint 30 día 7, applied to the page. Lighthouse's CLS on the three
  compositions: 0.004 / 0.004 / 0.004 at the close of día 2, **0.003 / 0.003 / 0.003** now.
- **Headings at `line-height: 1.15`**, with `letter-spacing: -0.01em` at display sizes and
  `text-wrap: balance` where the browser knows it (ignored where it does not).
- **Photographs at `radius.lg`**, a step rounder than the cards around them.
- **A section's button is the bar's pill** (ADR 0063): `999px`, `space.sm space.lg`, the heading
  letter, bold. One site has one idea of a button again; for días 1 and 2 it had two.
- **The cover's panel is a card**: `calc(-1.5 * var(--space-md))` out from the words it holds, and a
  soft shadow of the ink under it (`0 24px 48px -24px`, 40 % ink). Still `color.surface`, still the
  reason words over a photograph have a contrast anyone can guarantee; still hidden on a phone.

### 3. What it moves, named (David's adjustment 5)

**A paragraph grows** from about 1.25 to 1.6 a line, so **a hand-designed section drifts down**: a
paragraph placed by hand is taller and pushes what is under it, and the composition the owner set
moves with it. That is David's decision 1 of the sprint (the new look replaces the old in every site,
saved or new), applied to the reading text, and it is written here rather than discovered. The two
corpus documents with a free section, and the one with exact per-element style, were opened in
Chromium at 1280 before and after:

| Document | Section | Before → after | What moved |
|---|---|---|---|
| `physio-free-cover` | the cover, free | 459 → 507 px | +24 px of padding above; the paragraph 18 → 26 px tall, from the same grid row |
| `hidden-and-embed` | the embed, free | 142 → 190 px | the padding only |
| `estilo-por-elemento` | cover, services | 534 → 582, 220 → 276 px | padding, and every line of text by its new line-height |

In the free cover the paragraph keeps its row (its distance from the section's content edge, 166 → 163
px, moves by the headline's three pixels of line-height) and grows downward by 8 px; nothing was
under it. A composition with a paragraph over another element would see that element pushed by the
paragraph's growth.

**The cover is a little shorter** at every width: its words are set tighter. Measured by
`cover-height.browser.test.ts`'s own documents, whose assertions — the same height with four sources
of four shapes, `object-fit: cover`, the declared ratio — all hold:

| Width | Variant | Section | Image box |
|---|---|---|---|
| 1440 | beside the words | 594 → 588 | 664×498 → 592×444 |
| 1440 | full width | 992 → 944 | 1344×896 → 1200×800 |
| 400 | beside the words | 611 → 593 | 352×264, unchanged |
| 400 | full width | 582 → 563 | 352×235, unchanged |

### 4. What the rhythm found in the editor: the canvas keeps its reading point across a width

The reading text at 1.6 re-flows more when the canvas changes the width it lays out at, and that
happens at the 0.6 floor of ADR 0061: at a 1024 window, opening «Campos» takes the layout from 1253 to
887 px. The sprint 28 walk that holds the edited section still went red at **−205 px** on closing the
panel, and only with this line-height (bisected over five variants of the sheet: without the
paragraphs' 1.6, 0; with everything else of this ADR, −205). Measured in the frame: on closing, the
document is 3305 px with a 1152 px viewport, so the furthest scroll is 2153; the browser stayed at
2239 until that clamp, and **its scroll anchoring adjusted nothing**. Sprint 28 had measured the
anchoring absorbing a width change at 1280 and 1600 (0 px) and trusted it; sprint 31 día 1 had already
found it failing across a patch and built the editor's own reading point for that
(`readingPoint`, `apps/editor/src/editor/readingPoint.ts`).

The same promise is now kept the same way for a width: the editor takes the reading point at every
scroll of the frame while its width is still (`steadyReading`), and when the shell reports a new
desktop layout width it waits until the frame's `innerWidth` has stood still for two animation
frames and puts the point back (`keepReadingAcrossWidth`, `Editor.tsx`). The switch to the phone's
320 is left alone: that is a change of device, not of room. Sabotaged: without the call, the walk is
−205 again. This is editor code in a page-design ADR because the page design is what exposed it;
nothing of it reaches a published site.

**And the landing's sample shows a taller cover.** Its window is a measurement (sprint 23 día 1:
the cover whole, its button, and 101 px of the next section). The cover now ends at 1003 at 1280,
where it ended at 939, so the desktop window goes from 1040 to **1104** (`HERO_WINDOW`,
`landingHero.ts`), which keeps the 101 px; the phone's 844 shows 237 and stays.

### 5. The reveal's residual, measured again

ADR 0062 §1 named it: a child that shows by less than 24 px of the bottom edge at load is mid-fade
for that instant, and axe weighs opacity into a colour. The new padding moved the geometry of one
subject so that one child does exactly that: on Lighthouse's phone the «Ver más» link of the first
«Avance» of `cabecera-con-marca` sits at 825–845 px and read as **2.53:1**, and that subject's
accessibility is **96** (the floor is 95; the other seven are 100). No fade can be made safe by
construction: the lowest opacity at which every proved pair on `color.surface` still clears 4.5 is
**0.98** in `neutral` (its primary is 4.71 opaque), 0.76 to 0.93 in the others. The choice between
keeping the fade (and an axe reading that depends on where a fold falls) and a rise without a fade
is David's, and it is in REVIEW's sprint 32 día 3 as such; the look he merged on día 2 stands until
he makes it. **Made on 4 November 2026, by his delegation: the reveal rises and never fades** (ADR
0062's note of día 4), and the subject is back at 100.

## What is preserved

- **At 1280, the geometry**: the canvas, the overflow walk, the fine grid's columns
  (`fine-grid.browser.test.ts` green unchanged).
- **The phone**: the shared block untouched; the cover's image boxes at 400 unchanged.
- **Every proved pair**: no colour changes here.
- **No schema change**: 1.17.0.

## What is lost, and it is named

- **The layout of a site saved before**, at every width above 1296 and in every section's vertical
  room; a hand-designed composition's vertical positions, by the line-height (§3).
- **Two pixels of reading text per line**, roughly, and the shorter page they made.

## Consequences

- `packages/renderer/src/build.ts`: `--rb-measure`; the section's padding; headings' and paragraphs'
  lines; the photographs' radius; the button; the panel. `header.ts`: the bar's padding with the rails
  taken out; `--rb-rail-l` / `--rb-rail-r` beside the rails' margins.
- Tests: `overflow.browser.test.ts` (at 1680 the content is 1200 ± 1 and centred, the background edge
  to edge; at 1280 the padding is 48; with one rail centred in `<main>`); `header.browser.test.ts`
  (brand and content edges within a pixel at 1680 and 1280, and beside a left rail). Sabotaged:
  `max(` → `min(` turns all six red; without the rails' widths the rail case turns red. (The plan
  expected the 320 overflow walk to go red too; it does not, correctly — the phone's block resets the
  padding.) `links`, `wrapping`, `lists`, `panel`, `header` unit tests: their literals.
- Golden: all twenty-two, the same handful of rules in each; the four with a header also by the bar's
  padding; no markup changes.
- `apps/editor`: `steadyReading` and `keepReadingAcrossWidth` in `Editor.tsx`; `HERO_WINDOW.desktop`
  1104 and its test.
- Day by day in `docs/design/REVIEW.md`, sprint 32 día 3.
