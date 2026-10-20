# 0050 — A hand-designed section is a fine grid, and the hand decides where

**Status:** proposed · **Date:** 2026-10-20 · **Decided by: David**, 20 de octubre de 2026, opening
sprint 25 with one request — «quiero que al arrastrar un elemento visual este **se quede en la
posición donde se deja** […] que las cajas que limitan el tamaño del objeto visual sea **ajustable al
arrastrar los bordes** […] buscamos que todas estas ediciones sean **instintivas** (familiar para
usuarios de aplicaciones tipo Canva y Word)» — and, given three models with their cost, choosing the
one that keeps rule 4: «**rejilla fina, mano libre**», with four conditions on the grid, two more
decisions (overlaps are allowed; a run of arrows is one step) and eight adjustments while approving
the plan, each quoted where it lands below · **Recorded by development, which does not sign** ·
**Relates to:** [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) §7
(escalation copies the catalog's layout), [ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md)
§1, [ADR 0048](0048-the-first-drag-puts-an-element-in-the-grids-nearest-cell.md) §1, §4, §5 and §8,
[ADR 0049](0049-the-arrows-move-it-and-say-so-and-one-finger-still-scrolls.md) §1 and §4 — the three
of sprint 24 that this sprint amends, each on the day its amendment lands ·
**Touches:** `packages/schema` (schema 1.12.0, migration 0013), `packages/renderer`,
`packages/catalog` (a type), `apps/editor`, `docs/document-rules.md` (a third note under rule 4)

## Context

**Rule 4 was asked about for the third time, and this time by the owner of the product.** «Positions
are relative to the section's grid, never absolute on the page» comes from the approved advanced
dossier (§6) and was refused to two real owners, on 27 and 30 September 2026, with the note under
the rule saying both times that the next request would need an ADR before any code
(`docs/document-rules.md`). David's request is that third time: an element that stays where the
hand lets go of it, boxes that stretch by their edges, the gestures of Canva and Word.

**What was put in front of him, with the cost of each.** A fixed canvas like Canva's — positions
in pixels — publishes a page that breaks at every width the canvas was not, amends the dossier, and
converts every stored document: two sprints. A finer grid — the same twelve bands and eleven
gutters, with a unit small enough that snapping is invisible — keeps the published page a grid that
reflows, keeps rule 4, and costs one schema version. He chose the grid, with four conditions that
are answered by measurement below, not by argument.

**What the twelve-column grid of sprint 24 got wrong is the step, not the model.** A column is
75–100 px wide where somebody drags; an element let go eleven pixels past a line jumps to the next
one, and the gesture reads as the page resisting the hand. «No me convence el arrastre mediante
rejilla» is a sentence about that jump.

## Decision

### 1. A hand-designed section is drawn on ninety-six units, eight to a catalog column

`FINE_COLUMNS = 96`, `FINE_PER_COLUMN = 8`. A free section's placements — `column`, `columnSpan` —
are written in these units; `sectionLayoutSchema.grid.columns` is the literal 96, so a stored
layout is always the fine grid and never the catalog's twelve. **The catalog does not change**: its
presets still declare their slots on `GRID_COLUMNS = 12` (`CatalogLayout`, a type of its own so that
a twelve-column layout cannot reach a document by accident), and `escalate` converts on the way in
— `(c − 1) · 8 + 1` and `s · 8`, an integer multiplication, exact.

**David's condition 1 — «verifica el paso»** — measured in Chromium on 20 October 2026, default
scale (`space.xl` 48, `space.md` 16), one unit being (content width − 11 · 16) / 96:

| Where | Section | Unit |
|---|---|---|
| Editor, window 1440, no panel | 1168 px | **9.3 px** |
| Editor, window 1440, panel of 340 open | 948 px | **7.0 px** |
| Editor, window 1280, no panel | 1008 px | 7.7 px |
| Editor, window 1280, panel open | 788 px | 5.4 px |
| Editor, window 1024, no panel | 752 px | 5.0 px |
| Editor, window 1024, panel open (canvas zoomed to 0.738) | 721 px | 4.7 px in the frame, 3.5 on screen |
| Published at 1280 | 1280 px | 10.5 px |
| Published at 1440 | 1440 px | 12.2 px |
| Published at 1920 | 1920 px | 17.2 px |

With the panel open at 1440 the section is 948 and not 828: the row's side margin drops from
`px-24` to `px-6` when a panel opens (`EditorShell.tsx`), so 1440 − 80 − 2·24 − 24 − 340 = 948. The
plan's first table said 948 by arithmetic; the figure here is read off `getBoundingClientRect`. With
48 units instead of 96 the step would be 14–19 px where somebody drags, which is visible; 96 is the
decision.

### 2. The gutters are tracks, and the document never names one

A `gap` between ninety-six tracks would be ninety-five gutters, and a free section would stop
lining up with the catalog's beside it. So the stylesheet of a free section declares **107 tracks**
— eight units of `minmax(0, 1fr)`, a gutter of `var(--space-md)`, eight more, and so on — with
`column-gap: 0` (`fineTemplateColumns`). The twelve bands and the eleven gutters are the pixels they
always were.

**The document holds units and never a track.** Unit `f` is on CSS line `(f − 1) + ⌊(f − 1) / 8⌋ + 1`
and a span that crosses a gutter takes it with it; `fineTrack`, `fineTrackSpan` and their inverses
live in `packages/schema/src/fineGrid.ts` and are the only translation — the renderer, the editor's
drag and the walks that read `grid-column` back all import them, so none of the three can put an
element somewhere the other two do not.

**`minmax(0, 1fr)` and not `1fr`** (David's adjustment 2): `1fr` is `minmax(auto, 1fr)`, and a long
word or a photograph with an intrinsic width inflates every unit it crosses while the other
ninety-five shrink to pay for it. With a floor of zero every unit is the same width whatever is in
it — the browser suite measures all ninety-six against the first — and an image keeps `width:
100%` of its area, which is what the shared stylesheet already gives it.

### 3. Rows are eight-pixel steps, aligned to the top, and the migration is honest about what that moves

A free section has `grid-auto-rows: minmax(8px, auto)`, `row-gap: 0` and `align-items: start`
(`ROW_STEP_PX = 8`). **Pixels and not a fraction of the width** (David's condition 3, «prefiero
filas finas»): a height derived from the width needs `vw`, which drags the scrollbar in, or a
defined height, which a section does not have. Eight pixels are the same on the published page and
in the editor, and with a unit of 7–10 px the cells are nearly square where somebody drags. A row
with more content than its span grows and pushes what is below it; nothing is ever clipped.

**What a stored layout becomes** (migration 0013): columns ×8, exact. Rows take the theme's rhythm
— the catalog's rows had `space.md` of gap between them and a free section's have none, so each row
is followed by as many empty eight-pixel rows as that gap was tall (`gapRowsFor`: 16 px is two
rows). Exact in the default scale; within 4 px in the compact (12 px rounds to two rows) and the
generous (24 is three). **Two things move, and both are named rather than glossed.** A short text
beside a taller photograph stops being centred in its row and sits at the top of it
(`center → start`); and the spare height of that photograph, which a content-sized grid spread over
the three rows it spanned, is now spread over seven. **Measured on `cover-and-services` at 1280**:
the photograph (438 px) does not move; the headline goes up 27 px, the tagline up 9, the body down 9
and the button down 27 — a redistribution inside the photograph's height, not a change to it. The
browser suite asserts the exact half (nothing moves sideways; a section of stacked texts does not
move at all, rows included) and reports the other. Two corpus fixtures carry a layout and both
moved; the diff is in the pull request. Pre-launch, no client site does.

**A section escalated from now on is measured, not converted** — día 2 of the sprint: the editor
reads each placed element's box off the live section and hands the rows to `escalate`, so the eight
pixel rows are the real ones from the first second and the photograph's case above does not arise.
**And in other widths the text pushes and the vertical drifts** (David's adjustment 1): a row is
eight pixels only until its text wraps differently, and then it is as tall as the text. The editor
readjusts a text's `rowSpan` to its content after an edit so that, in the editor, rows stay eight
pixels; on a visitor's screen of another width the section is still a grid that reflows, which is
the model chosen over the fixed canvas and the reason the page never breaks there.

### 4. The mobile patch is untouched, and on a phone the fine grid steps aside

«Foto menor» is a fraction of twelve over a one-column page (`breakpointPatchSchema.columnSpan`,
`breakpointCss`), and twelve is still what it is a fraction of: the patch, its control and its
label do not change. Under 720 px the shared block already puts every child on `grid-column: 1 /
-1` and `grid-row: auto`; the free section's own override gives back one column, the theme's
`row-gap` and `grid-auto-rows: auto` (David's adjustment 4) — otherwise the desktop's empty rows
would open holes down the single column. Rule 7 reorders, so no two boxes intersect on a phone, and
the browser suite asserts it on the published page; the editor's mobile walk will on día 7.

### 5. Until día 3 the drag and the keyboard still snap to twelve, and the edge is one file

The model lands first and alone — schema, migration, renderer, the editor's reading of the document
— so that a deployed site is never half-converted. `dragGrid.ts` and the arrows still choose the
nearest catalog column until día 3 teaches them the fine grid; `apps/editor/src/editor/coarseBoundary.ts`
is where the two meet, in two functions, and it says in its header that it exists to be deleted.
The panel's four steppers count in units from today, stepping sideways by a catalog column of eight
and clamping at the edge so the last unit is reachable; `MAX_ROW` is 400 eight-pixel rows.

### 6. What the rest of the sprint decides, decided now

Each of these lands on its own day and amends the sprint-24 decision it names there; they are
written here so that no day invents them.

- **Día 3 — the element follows the hand and stays where it is let go**, within one unit and one
  row, with no ghost and no stripes; a held click drags without choosing first (amends ADR 0047 §1
  and ADR 0048 §5, §8); the dragged element carries a `z-index` for the gesture (adjustment 5) and
  the three-pixel threshold is screen pixels divided by the canvas zoom (adjustment 3). **Overlaps
  are allowed** (amends ADR 0048 §4): the stacking order is the document's, the later element on
  top, no «bring to front» this sprint; text over text is a **warning** in the review before
  download, never a block; on a phone the overlap does not exist and the walk asserts it.
- **Día 4 — the edges resize**, with a cursor in a zone of ±6 px around the border, also while
  writing, as in Word; while writing the zone is asymmetric, 6 px outside and 2 inside, so a click
  on the first or last letter still places the caret (adjustment 8). A photograph's area grows
  without stretching it (`height: auto`).
- **Día 5 — alignment guides** to the edges and centres of neighbours and the centre of the
  section, winning within 6 screen pixels.
- **Día 6 — arrows move one unit and `Shift` eight** (amends ADR 0049 §1); a run of presses is one
  history step, written on `keyup` or after 300 ms without a press (amends ADR 0049 §4); the
  announcement changes unit to pixels from the section's content edge, read off the measured box.
- **Día 7 — touch handles** on the chosen element only, eight targets of ≥ 44 px, corners only on a
  small element, drawn inward at the section's edge (adjustment 6); one finger still scrolls.

**Rule 4 is not amended.** A placement is a column, a span and a row on the section's grid; there
is still no `x` and no `y` anywhere, and `docs/document-rules.md` gains a third note under the rule
saying that the third request was the product owner's and the answer was to make the grid finer.

## Three things only a browser could say

- **The step, and the 948.** The plan's table computed the panel-open width as 948 by subtracting
  the panel; David's reading of the same margins gave 828. Chromium gave 948, because the row's
  side padding changes with the panel — a thing nobody remembers while doing arithmetic.
- **Escalating moves nothing sideways, to the pixel, across a whole site** — every element's left
  edge and width equal before and after, in `cover-and-services`. And a section of stacked texts
  does not move at all, rows included: the rhythm `gapRowsFor` writes is the gap the catalog drew.
  The plan had claimed «nothing moves *up*» either; the browser showed the centred headline moving
  up to the top of its row, which is what `start` means, and the claim was narrowed to what is
  exact rather than kept.
- **An empty row is exactly eight pixels where nothing spans it, and a gutter track is exactly
  the theme's gap**, read off `grid-template-rows` and `grid-template-columns`; ninety-six units
  within a tenth of a pixel of each other with a photograph inside one of them, which is the
  `minmax(0, 1fr)` doing its work. Where a photograph spans the empty rows they grow to carry its
  height — 44.5 px each in the cover — which is §3's redistribution seen from the rows' side.

## What is preserved

- The seven rules, rule 4 included; the published page is still a grid that reflows at every width.
- The catalog's twelve columns and its eighty-eight `column:` declarations, untouched.
- The mobile patch in twelfths, its three controls and their labels.
- `escalate` → `revert` round-trips exactly (`INV_3A`, `INV_3B`), with the layout dropped by rule 1.
- Seventeen of the nineteen golden files, byte for byte: the fine grid's rules are emitted only
  for a document that has a free section.

## What is lost, and it is named rather than glossed

- **A stored free section's vertical is converted, not measured.** `center → start`, and the
  spread of a tall photograph's spare height over more rows; §3 names both, migration 0013's header
  names both, and the two fixtures' diffs are reviewed in the pull request.
- **«Escalating changes not one byte of the page» stops being true**: it changes the bytes and not
  the pixels (`rb-free`, the inline tracks, the stylesheet block). `escalationChrome.test.ts` is
  rewritten to say so, and the frame reloads on escalation on its own now.
- **`down` for 1.12.0 is lossy**, and says so: a unit somebody dragged to becomes the column it
  falls in, which is the most 1.11.0 can express.
- **The ~260 bytes of the fine grid's rules**, once per document that has a free section, and
  `grid-column` values of three digits in those sections.

## What this does not decide

- Nothing about pages, lists or the inside of a list item: a list is placed as one element and its
  lines flow inside it, as before.
- No «bring to front» and no stacking order of the document's own: this sprint stacks in document
  order and says so; a later decision may add a control, and it will need a field.
- No resizing by keyboard on the canvas: the panel's steppers are the keyboard's way to a width.
- Nothing about a fixed canvas: it was offered, costed and refused.

## Consequences

- Schema 1.12.0, migration 0013 with a round trip and the affected set counted; `pnpm schema:guard`.
- `packages/schema/src/fineGrid.ts` is the one translation between units and tracks; anything that
  reads or writes `grid-column` for a free section imports it.
- The e2e walks' `placedIn` reads units through `fineColumnOf`/`fineSpanOf`; the day-8 and day-9
  walks of sprint 24 count in units of eight until día 3 rewrites them.
- Días 2–7 of the sprint each amend the ADR they name, in that ADR, on their day.

## Amendment — escalating measures the live section, and the return asks the history (día 2, 20 October 2026)

§3 said a section escalated from now on would be **measured rather than converted**, and named what
the conversion could not reproduce. This is that half, built, with what the browser had to say about
it.

### 1. The vertical comes from the boxes, the horizontal still from the conversion

`escalate(section, preset, gapRows, boxes?)` takes what each placed element's box measured on the
live page — `top` relative to the section's **content** box, and `height`, both in the frame's own
pixels — and writes `row = 1 + round(top / 8)` and `rowSpan = ceil(height / 8)` (`measuredToFine`).
Sideways nothing is measured: column `c` is still unit `(c − 1) · 8 + 1`, because that conversion is
exact and a measurement would only add error to it.

**The row rounds and the span ceils, and the asymmetry is the decision.** A row is the nearest
eight-pixel line to where the element's top was, so the worst error is four pixels — half a row. A
span of `round(height / 8)` would be up to four pixels *shorter* than its content, and a grid row
that cannot hold what sits in it grows: every element below would be pushed down by somebody else's
rounding, and the pushes would add up down the section. `ceil` leaves the area at most seven pixels
taller than the content — invisible, a grid area has no border — and keeps every row at its
eight-pixel minimum, so a top measured here is a top on the page.

**The fallback is per element, not per call.** An element nothing could measure keeps the theme's
rhythm: a hidden one, which rule 3 keeps in the document and the renderer draws nowhere, and every
element of a caller with no page at all (migration 0013, every test with no browser). Both doors of
the offer — the canvas's and the «Diseño» panel's — measure through the same function, so they
cannot write different rows for the same section.

### 2. «Did anybody lay this out by hand» stops being a comparison

`revertImpact` used to derive `dropsPlacements` by re-drawing the catalog's layout and comparing it
with what the document stored. A measured escalation ends that: a photograph of 438 px is fifty
rows where the rhythm would have said seven, so a section escalated and touched by nobody matches no
re-derivation, and the dialog would have warned about work nobody did — on every escalation.

So the verb is **told**: `revertImpact(doc, sectionId, preset, { placementsMoved })`, and the
editor's undo history answers it (`wasPlacementEverMoved`). It is the honest source — it holds the
act rather than a guess about the result — and the one place that cannot drift from what happened.

**What that costs, named:** moving an element and moving it back used to read as lossless again, and
now warns. With ninety-six units and measured rows, landing back on the same four numbers by hand is
not something that happens, so the cleverness was buying nothing; and of the two ways to be wrong,
warning about work that was undone costs a click while staying silent about work that exists costs
the work.

### 3. Three things only a browser could say, and all three were defects

- **The boxes never arrived, and nothing looked wrong.** The first version asked `liveDoc()` for the
  document to measure. The chrome is wired into a frame **before** it becomes the visible one, so a
  handler created there captured a render in which the live slot was still the *other* frame:
  `liveDoc()` answered with the document that does not hold the section, the measurement came back
  empty, and the escalation fell back to the rhythm — a section that looked correctly escalated and
  had derived rows. Chromium said it in one number: the headline's row came out 1 where its box said
  4. The document to measure is an argument now, and whoever is inside the frame passes its own.
- **The web font moves the measurement.** The walk measured the cover's headline at 46 px with the
  fallback face and 52 with EB Garamond applied, and accused the escalation of having stretched it.
  The walk waits for `document.fonts.ready`; the editor cannot wait inside a click, so a face that
  arrives after the press leaves the rows a few pixels out — named here with the other vertical
  drifts, and not worth delaying the act for.
- **The editor's own chrome stole a row.** «+ Añadir línea» is a grid child with `grid-column: 1 /
  -1` and no row of its own. On the catalog's content rows auto-placement put it after the content;
  on eight-pixel rows it takes the first row where the full width is free, which is a **gap above
  its own list** — and then grows that row to its own height and pushes the list down 33 px. Grid
  chrome is placed explicitly now, in the first row below every placement (`rowBelowPlacements`).
  Day 1 had already paid for the sideways half of this (the same pill spilling 72 px out of an
  eight-pixel cell); this is the vertical half, and the rule is now written down: **a chrome child
  of a free section needs both its column and its row.**

### 4. What this does not change

The migration's conversion, the goldens, the published bytes: nothing here reaches the renderer. A
document escalated before día 2 keeps the rows migration 0013 wrote, and nothing re-measures it —
the day it is dragged, the hand decides those rows anyway. The announcement in pixels and the
`rowSpan` the editor readjusts after a text edit stay where the plan's own adjustment 1 put them,
día 3 and día 6: the second one has to fold into the typing's own history step rather than open one
per keystroke, which is a decision about the history and not about the measurement.

## Amendment — the element follows the hand and stays where it is let go (día 3, 20 October 2026)

§6 named what día 3 would decide; this is it, built, and it amends three of sprint 24's decisions.
The request it answers is the one that opened the sprint: «quiero que al arrastrar un elemento
visual este **se quede en la posición donde se deja**».

### 1. The element is the preview, so the ghost is gone (amends ADR 0048 §5)

While the hand holds it, the element itself travels on a `transform` — chrome, never the document,
the same way the floating bar moves — by the distance the hand has travelled rather than to where
the pointer is, so the grip stays where it was taken. On release the placement is written once, in
the unit and row nearest the element's own top-left corner.

Yesterday's ghost existed **because** the twelve-column snap moved the element somewhere else on
release: the honest preview was the destination's rectangle, not the element under the hand. With a
unit of 7–10 px the destination *is* where the hand is — the walk measures it at **six pixels or
better**, which is half a unit sideways and half a row down — so the element is the preview, and a
second thing on screen saying the same would be noise. For the same reason the twelve stripes no
longer come up during a drag: they answer «which column will this land in», and the answer is now
«where your hand is». The panel's own stripes stay, because the twelve bands are still real — they
are where the gutters are.

`.rb-moving` carries a `z-index` for as long as the gesture lasts (David's adjustment 5): a
`transform` makes the element its own stacking context, and without a layer of its own it would
travel *under* every sibling that comes after it in the document.

### 2. Overlapping is allowed (amends ADR 0048 §4)

`dropAt` no longer takes the section's other placements, which is the strongest way to say it cannot
refuse for being occupied, and `arrowDrop` does not either: what the pointer may drop on top of, the
keyboard may walk onto. The stacking order is the document's own — the later element paints on top,
which is what CSS grid already did and what the renderer's `.rb-panel` already assumed — and there
is no «bring to front» this sprint. Día 5 adds the one warning the owner needs: two **texts** on top
of each other are illegible, and the review before the download says so.

The only refusal left is the floor on rows (four hundred of eight pixels, 3200 px of section). With
no ghost to carry the sentence, the live region says it: «nothing happened» is the one answer a drag
must never give silently, which is ADR 0048 §4's principle outliving its refusal.

### 3. A held click drags, whether or not the element was chosen (amends ADR 0047 §1, ADR 0048 §8)

Sprint 24 required a text to be chosen before it could be dragged, because a drag over a text
selects words. What tells the two apart is **movement**, which the browser can be asked about, so
the precondition was guarding an ambiguity that is already resolved by the time it matters. A click
that does not move still chooses; a second click still writes; and **inside a text being written in
a drag still selects words**, which is the one place the ambiguity is real and is exactly how Word
behaves. The walk asserts all three, and that a drag across an unchosen headline leaves **no
selection** behind — the range the first pixels make is dropped when the gesture arms, and
`user-select: none` keeps it from growing.

**And the element it drops is the chosen one.** Canva and Word both do it, it makes the gesture
finish rather than stop, and it is what gives día 4's edges something to take hold of without a
click nobody would think to make. A text chosen this way is one click from being written in, which
is ADR 0047's two states exactly as drawn.

### 4. Three pixels of the screen, and rows read off the browser

**The threshold is divided by the canvas zoom** (David's adjustment 3): inside the frame everything
is in the document's own pixels, so three of them are 2.2 under the hand at a zoom of 0.74 and the
gesture armed sooner than anybody meant. `zoomOf` reads the zoom from the frame itself — its scaled
box against its unscaled viewport — and `isDragBeyond` takes the threshold as an argument.

**Both axes are read off the resolved tracks** (David's adjustment 1): `getComputedStyle` gives the
107 column widths and every row the grid has, implicit ones included, and `fineColumnAt` walks them
through `fineTrack` so the gutters' rule lives in one place. For the rows this is the correction
itself — with `minmax(8px, auto)` a row holding a text taller than its span grows, so `y / 8` is not
the row it looks like. The unit test holds the real shape of a measured cover (52, 8, 8, 31, …) and
asserts that a point fifty pixels down is row 2, where the division would have said row 7.

### 5. What this does not change, and what it deleted

The catalog's sections still ask before being designed by hand (ADR 0048 §7); a phone still reorders
and still keeps its ghost, which is the one place a ghost is the honest preview, because there the
gesture means «change the order» and not «stay where I put you» (ADR 0049 §7, rule 7). The arrows
still move by a whole catalog column — `ARROW_UNITS` — and still announce in twelfths, because a
press worth a ninety-sixth would be a control nobody could cross a section with; día 6 makes a press
one unit, `Shift` eight, the run one history step and the announcement pixels, which is where
David's conditions put them.

`apps/editor/src/editor/coarseBoundary.ts` is deleted, as its own header said it would be: the
editor speaks the document's units everywhere now. `editor.drag.occupied` is deleted too — an
interface sentence for a refusal that no longer exists.
