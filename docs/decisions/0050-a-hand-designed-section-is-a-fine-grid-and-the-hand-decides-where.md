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

## Amendment — the edges of the box stretch it (día 4, 20 October 2026)

§6 named día 4 in a sentence; this is it. The request is the second half of what opened the sprint:
«quiero además que las cajas que limitan el tamaño del objeto visual (el recuadro azul) sea
**ajustable al arrastrar los bordes**, bien para agrandarlo o bien para reducirlo (parecido a como
funcionan los cuadros de texto insertados en un documento de Word)».

### 1. A zone and a cursor, no handles with a mouse

Six pixels either side of the border of the element the hand is already working on — the chosen one,
written in or not — and the pointer changes to one of the platform's four (`ew-resize`, `ns-resize`,
`nwse-resize`, `nesw-resize`). That is David's own prescription, and the reason is in it: «para que
se descubra sin explicación». Eight squares drawn around every chosen element would say the same
thing louder and would be in the way of the page they sit on; touch cannot use a six-pixel zone at
all and gets real handles on día 7.

**The far edge stays put**, which is the whole behaviour of a box's border: pulling the left one
moves the start and shortens the span by as much, so the right edge does not budge. **Clamped, never
refused**, exactly as a drop is: a hand that pulls past the grid's edge means «as far as it goes»,
and an element never becomes thinner than one unit or shorter than one row — pulling the left border
past the right one leaves a box one unit wide rather than an inverted one.

**The zone is asymmetric while writing: 6 px outside and 2 inside** (David's adjustment 8), so a
click on the first or the last letter still places the caret; and both numbers are divided by the
canvas zoom (adjustment 3), so six pixels are six pixels under the hand at every window width.

### 2. Wired on the section, in the capture phase — and both halves are the design

**On the section**, because the zone reaches *outside* the element: a `pointermove` three pixels past
a headline's border is delivered to the section, not to the headline, so an element-level listener
cannot show the cursor there. The first version was element-level and the walk found the outer half
of the zone dead — the cursor stayed `text` where David had asked for `ew-resize`.

**In capture**, because the press has to beat everything else that would take it: choosing, starting
to write, closing a menu, arming the drag. A capture listener on the section runs before any of them
and `stopPropagation` ends the argument. The plan listed this as a risk — «un `pointerdown` en la
zona debe ganar al clic que elige» — and this is the answer: not a race settled by registration
order, but a phase.

The cursor is set on the section *and* on the element, because a cursor on the parent is overridden
by any child with one of its own — which every text has while it is being written in.

### 3. The preview is the real grid area, and resizing while writing commits the words first

**The live preview rewrites the element's own inline `grid-column`/`grid-row`** — the renderer's own
form, tracks and gutters included — so the grid reflows as the hand moves: a text rewraps as it
narrows, a photograph's area grows without the photograph stretching (`height: auto` on
`.rb-section img`). A transform would show the same element scaled, which is a picture of something
that will not happen. The plan's own risk here was that the reflow moves the target under the
pointer; the walks pull in ten steps and land where they aimed, in both axes, so it does not.

**Resizing a text while writing in it commits the text first.** A text being written in holds the
person's letters in the DOM and nowhere else — this editor commits on blur — and writing a placement
rebuilds the frame, which would throw them away. So the gesture blurs the element (the ordinary
commit path), writes the placement, and picks the writing up again on the other side of the rebuild
(`keepWriting`): one gesture, two acts, in the order that cannot lose anything. The walk types
«Mesas en la plaza», pulls the right border a column wider, and finds the words intact and the
caret still in them.

### 4. Each border takes its own reading, which Chromium had to correct

A left border aims at the unit whose **left** edge is nearest; a right border at the unit whose
**right** edge is nearest — and between those two units there can be a gutter of sixteen pixels. One
reading for both borders made a resize of two catalog columns land **63 units where the hand had
asked for 64**, measured. Vertically it is the same shape without the gutter: the bottom of row 7 is
the top of row 8, and a border that confused them grew the element by a row nobody pulled it over.
`fineColumnAt`/`fineLastColumnAt` and `rowAt`/`lastRowAt` are the four readings, all one walk of the
resolved tracks.

### 5. What the keyboard has, and what the walks had to learn

Nothing new: the «Colocación» panel's four steppers count in fine units since día 1 and
`Shift+arrow` widens and narrows (ADR 0049 §1), so the gesture has the equivalent WCAG 2.1.1 asks
for. Día 6 is where the arrows become one unit with `Shift` for eight.

Two things the walks measured rather than assumed. **A photograph's own box ends four pixels above
the bottom of its area** — fifty rows of eight for 396 px of photograph — so pulling from its
visible border asks for one row less than the round arithmetic, and that gap *is* «crece sin
estirarse». And **reading the placements in the same breath as a gesture reads a half-replaced
frame**: every gesture writes a placement, which replaces the `srcDoc`, so the walks poll.

## Amendment — the guides, and the one overlap that warns (día 5, 20 October 2026)

Two things David asked for on the same day he chose the fine grid: «Sí, guías de alineación», and —
when he allowed overlapping — «Texto sobre texto avisa […] no un bloqueo». They are the two halves
of making ninety-six units usable by hand: the guides let the eye line things up that the hand
cannot hit, and the warning catches the one thing the freedom costs.

### 1. The guides: neighbours' edges and centres, and the centre of the section

`guidesFor` takes the lines of the thing being moved that are **live** — a drag offers three per
axis (left, centre, right), a resize offers only the border being pulled — and answers with how far
to shift and which line to draw. The candidates are each neighbour's two edges and its middle on
each axis, plus **the section's own centre along x**. Within six screen pixels (divided by the
canvas zoom, adjustment 3) the guide wins; outside it the fine grid decides exactly as before.

**No vertical candidate for the section itself, and that is deliberate**: a section's height is its
content's, so its vertical centre moves while the thing being dragged is still in the air, and a
magnet to a line that moves with you is not a guide. Horizontally the content box is fixed by the
canvas, so its centre is a real place to put something.

Each axis is decided on its own — a drag can snap sideways and stay free vertically, which is what
lining up a column of texts feels like — and a neighbour's line wins a tie against the section's
centre: lining up with something on the page is a stronger intention than lining up with the middle
of nothing. The lines are drawn as `.rb-guide`, one pixel of brand blue, `position: absolute` inside
the section (so they take no row of the grid they are drawn over — día 2's lesson) and
`pointer-events: none`, because a line that could swallow the pointer would end the gesture it is
guiding. A resize only offers the axes its border owns: a right border has something to say about
columns and nothing about rows.

### 2. A span of N units is not a fixed width, which the walk found

**The finding of the day, and it belongs to §2's decision rather than to the guides.** An element's
rendered width is its units *plus however many gutters it happens to cross*: the generated cover's
button is 24 units wide, which is 256 px starting at unit 1 (two gutters inside) and 272 px starting
at unit 38 (three). So the magnet centres the box it measures, the drop keeps the **span** — a drag
moves an element, it never resizes it (día 3) — and the box can therefore come to rest up to a
gutter wider than it was, with its centre eight pixels off the line.

Measured: a button magnetised to the section's centre lands with its left edge within half a unit of
where the guide put it, and its centre within **thirteen pixels** — half a unit plus half a gutter —
of the line. That is the honest tolerance, and it is the direct consequence of keeping the catalog's
gutters to the pixel. Making the drop preserve the rendered width instead would mean a drag that
quietly changes a span, which is the one thing this gesture has promised not to do since día 3.

### 3. Text over text warns, and nothing else does

`overlappingTexts(doc)` lives in `packages/schema` — it is a statement about the document — and
lists every pair of **text** elements whose placements overlap in a hand-designed section, in
document order, with the words of both so the dialog can name them. Four exclusions, each a
decision:

- **Only text over text.** A photograph under a heading is design, and the renderer already draws a
  panel behind those words to keep them legible (`panelArea`). Two sentences competing for the same
  pixels fail for a reason no palette can fix: there is no contrast between a sentence and another
  sentence.
- **Only what the page draws**: a hidden element renders as nothing, and warning about an overlap
  nobody can see would be warning about the document rather than about the site.
- **Only a free section**, because only there does the document hold placements at all.
- **Only pairs, each once**: three texts in one place are three findings, and naming one twice would
  read as two problems.

It is the **last** of the four warnings and it never blocks, which is David's condition: the owner
put it there with their own hand and the canvas showed it happening, so it is the least likely of
the four to be news. The dialog quotes both texts and explains the asymmetry in one line, because
without that the warning would look arbitrary.

**And `overlaps` is now one function.** The renderer's `intersects` (for the legibility panel), the
editor's own (for the drag) and this one were three copies of «these two share a cell»; the
definition lives in the schema and all three import it.

### 4. What the day cost in records, and what the guard caught

The warning's dialog is the **ninth** `aria-modal` dialog, and `modalTrap.test.ts` refused the
change until the count and **four** records that name it were updated — `useFocusTrap.ts`,
`modalTrap.test.ts` itself, `docs/tasks/backlog.md` and
`docs/tasks/el-recorrido-de-la-cuenta.md`. That guard exists because the backlog «said five for
five days after the sixth was written»; this is the second time it has stopped the same drift.

Two walk-level corrections worth keeping: a walk that measures a guide must work in **one**
coordinate space — the first version measured the section's centre inside the frame while the mouse
and `boundingBox()` speak in the page's, which moved the drag 176 px and read a horizontal guide as
a vertical one — and the download gate's dialogs are not all `role="alertdialog"`, so a walk that
scopes to that role waits thirty seconds for a button that is on screen.

## Amendment — the keyboard counts in units, and a run is one movement (día 6, 20 October 2026)

§6 named día 6 in three clauses; this is all three, and they amend ADR 0049 twice more.

### 1. One unit per press, eight with `Shift` — and `Shift` stops resizing

A press is now the finest thing the document can express, which is what makes the keyboard equal to
the hand on a grid of ninety-six; `Shift` is the catalog column, for crossing a section without
fifty presses. Vertically the same two sizes: a row, or eight.

**That takes something away, and it is named rather than quietly dropped.** `Shift+Arrow` used to
widen and narrow (ADR 0049 §1) — the only keyboard resize on the canvas — and it cannot mean two
things. Resizing by keyboard belongs entirely to the «Colocación» panel's four steppers, which have
counted in these units since día 1 and were always the single-pointer alternative WCAG 2.5.7 asks
for. Sideways a run is **clamped** rather than refused: refusing the fortieth press while accepting
the thirty-ninth would make a held key stop dead for no visible reason, and «as far left as it
goes» is what the hand means. Rows keep the one refusal there is, the interface's own floor.

### 2. A run of presses is one movement and one step of history

David's condition: «Las pulsaciones seguidas son un solo paso del historial […] se escribe al soltar
la tecla (o tras ~300 ms sin pulsar)». `arrowRun.ts` accumulates the presses — pure, with the clock
as an argument, so «the hand has paused» is a tested decision rather than a `setTimeout` somebody
has to trust — and the placement is written once, on `keyup` or after 300 ms of quiet, whichever
comes first. A `blur` flushes too, which is the net for the press whose `keyup` never arrives
because the window changed with the key held down.

Fifty presses to cross a section would otherwise be fifty documents, fifty re-parses of the canvas
and fifty entries to undo one gesture through. It also retires the lost keypress of ADR 0049 §4:
there is no rebuild to lose a press to until the hand stops.

**Previewed on the element's own grid area, not on a `transform`** — a departure from the plan's
letter, with día 5's finding as the reason: an element that crosses a gutter gets wider, so a
transform would show the eye a box the document is not going to produce. Rewriting the inline area
reflows the grid, which is cheap inside one document; it is the rebuild of the whole `srcDoc` that
is not, and that is what the run defers.

### 3. The announcement is pixels, from the measured box

«Columna 3 de 12» meant something on the catalog's grid and nothing on a grid of ninety-six;
«columna 25 de 96» would be arithmetically true and useless, since nobody counts in ninety-sixths.
So the live region says «A 312 px del borde izquierdo y 96 del superior» — what a person beside the
screen would say — and the numbers come from the element's **measured box** (David's adjustment 1),
not from unit × column: a row is eight pixels only until a text makes it taller, so the arithmetic
would describe a page the browser is not drawing. **One sentence per run**, not per press: a held
key is one movement, and twenty sentences for one gesture is noise rather than information.

### 4. A text's rows follow its content, in the same step as its words

> **Amended on sprint 28 día 7 (26 October 2026)** — the readjustment this section describes is
> gone; a span is a minimum and the row grows to its content. The amendment at the end of this
> document has the measurements that decided it.

The third clause of David's adjustment 1. A free section's rows are eight real pixels and a text's
height is its content's, so typing changes how many rows it needs; left alone, the row grows past
its minimum and pushes everything under it down — the accumulation `measuredToFine` ceils to avoid
— and the editor's idea of where things are drifts from the page. So the commit measures the
element it has just finished with and carries the span **in the `editText` step itself**: one letter
must not cost two presses of «Deshacer». `editText` now opens no step when neither the words nor the
rows changed, and one when either did — narrowing a text's box rewraps it without touching a letter,
and the rows it then needs are different.

### 5. And the panel says what a unit is

Four numbers counted in units of ninety-six with nothing on screen explaining them is a number
somebody has to guess the meaning of, so «Colocación» now carries one line: ninety-six units a
section, eight to a catalog column, which is what one press of a stepper moves; rows of eight
pixels; and what the canvas's arrows are worth, because the two controls are the same act and a
person who finds one should know about the other.

## Amendment — the handles a finger can take, and the phone that inherits no overlap (día 7, 20 October 2026)

Two of David's four conditions close here, and neither of them is visible on this machine: condition
4, «Redimensionar en táctil: asas solo sobre el elemento elegido», and condition 3, «Móvil no hereda
el solape».

### 1. Forty-four pixels, on the chosen element, and only where there is a finger

A finger is about eleven millimetres wide, so the ±6 px zone of día 4 is not a target it can hit at
all — it would only steal the drag the finger already has. Under `(pointer: coarse)` the chosen
element therefore gets real handles: **forty-four pixels**, which is WCAG 2.5.5's number and the one
both Apple and Google publish. The dot that is *drawn* is twelve; what is forty-four is the thing a
hand has to land on, which is the distinction a design that drew twelve-pixel squares would get
wrong.

**Where they go is arithmetic, in `handles.ts`, decided without a DOM** — `handlesFor({box, host})` —
and two of David's adjustments live in that function because both are about a handle that would
otherwise be unusable:

- **A small element gets corners only.** Eight targets of forty-four on a button of 60 × 30 bury the
  button. The test is the **box's** size and not one side's, and the suite is what taught that: a
  first version asked each side about its own length, so a text of 528 × 52 was given a top and a
  bottom midpoint — forty-four pixels tall each, centred on edges fifty-two apart, so between them
  they covered the element and a finger aiming at its middle landed on a handle. **It stopped being
  draggable at all, only resizable**, and the sprint 24 touch walk caught it by asking for a drag of
  one column and getting nothing. So the midpoints arrive only when the box is two targets across in
  **both** directions, which is the same number twice over: a midpoint pair takes a target's width
  out of the middle, so what is left has to be a target too. The four corners are never withdrawn —
  they are the pair of axes every box has — and they leave the middle clear whenever the box is wider
  than one target. Smaller than that they meet over it: such an element is moved from «Colocación» or
  with the arrows, which is said here rather than solved by taking away the only handles it has.
- **At the edge they are drawn inward.** `html, body { overflow-x: clip }` eats whatever leaves the
  page, so a target centred on a border is clamped into the section rather than losing half of
  itself. With the padding a section carries this rarely bites; on a full-bleed one it is the
  difference between eight handles and six.

**Asked of the browser once, and measured before being written**: with Playwright's `hasTouch` and no
`isMobile`, Chromium answers `(pointer: coarse)`, `(hover: none)` and one touch point — so the walks
run a *tablet*, desktop width with a finger, which is the hard case rather than a phone. **With a
mouse there are no handles**, which is David's own sentence and the reason the canvas stays quiet:
eight squares around everything chosen is the editor shouting that something can be stretched
instead of answering when the hand asks.

They are `aria-hidden`. Resizing by keyboard is the «Colocación» panel's four steppers — the
single-pointer alternative WCAG 2.5.7 asks for, in these units since día 1 — and eight nameless divs
in the accessibility tree would be noise laid over the element they belong to.

### 2. A handle is a second door to the same gesture, not a second gesture

The press body of día 4 is now `begin(edge, el, event)`, and it has two callers: the section's
capture listener, which finds an edge within six pixels, and a handle, which already knows its own.
Everything after that is the same code — the same live preview on the element's real grid area, the
same `resizeTo`, the same single `setPlacement`, the same «commit the words first» when the element
is being written in. The handles are removed while the pull lasts: they would be stale the moment the
box starts changing, and a finger holding one does not need to see the other seven.

They are painted from `markChosen` — nothing chosen means none of them — and again when a pull ends,
because a committed resize rebuilds the frame and a cancelled one has to be put back by somebody.

**One painter per document, and that is a correction CI had to force.** The first version kept a
single slot holding «the painter of whatever was wired last», which is wrong in this editor for a
reason that predates the handles: an edit is shown by building the next version of the page in a
**buffered** frame and swapping it in, so for a few milliseconds there are two live documents.
Choosing an element in the visible one then repainted the handles into the buffered one — the
element the hand had just chosen showed none, and nothing put them back until the next choice. This
machine never saw it, because the swap always finished first; CI, which is faster, failed both touch
walks on it. The painters live in a `WeakMap` keyed by document now, so «repaint the handles» is
asked of the document the choosing happened in, which is the only form of that question with one
right answer. The walks say *which* document the handles are in when they fail — «live:0
buffered:8» is the sentence that would have taken an hour off finding this.

### 3. `touch-action: none` on the handles and on the chosen element, and on nothing else

The promise of ADR 0049 §7 now has eight new elements that depend on it: declare that property one
level up — on the section, or on `[data-id]` — and a phone's canvas stops scrolling, which nobody
sees with a mouse. So the walk asserts again that one finger scrolls the canvas **with the handles
drawn**, and it first asks the page what is under the finger, so that it can never end up quietly
asserting that the chosen element scrolls the page.

**In the mobile view no handles are drawn at all.** A section there is one column and the gesture
reorders (rule 7): a handle that stretched a width would be lying about what the published page does
with it.

### 4. What a vertical pull actually moves, which the walk had to learn

Found while writing it, and worth saying plainly: **a text's blue box is its content, and its area
can be taller.** With `align-items: start` (§3) an element measures what its content measures, while
its rows are whatever was written for it — and this cover's headline arrived with twelve rows for
fifty-two pixels of text, because the measurement that escalated it ran before the face did (the
typography race §3 already names, and a real hand meets it the same way). So a short pull downwards
lands inside space that was already reserved and changes nothing anybody can see.

The walk therefore measures **the bottom of the area**, read off the section's resolved tracks, and
asserts it ends where the hand did, to within one row. Counting rows would have produced a number
that means nothing. A vertical pull on a text reserves space; what is drawn is still the content's,
and no border ever clips a word.

### 5. The phone inherits no overlap, and the walk measures it

Overlapping has been allowed since día 3 and the stacking order is the document's own. On a phone
there is nothing to stack: rule 7's shared block puts every child on `grid-column: 1 / -1` and
`grid-row: auto`, so the grid gives each one its own row. **That is now asserted rather than
believed** — the walk overlaps two elements on the desktop with the pointer, confirms the crossing
with the schema's own `overlaps`, switches to the mobile view and measures every pair of boxes. It is
the defect finding 1 of PR #6 fixed, and a grid of ninety-six is exactly the kind of change that
could have given it back.

**Its first version reported the defect that did not exist**, and that is the harness lesson of the
day: the device switch replaces the preview's document, and measuring in the next breath measures the
desktop one — the trap of día 2, in a new place. The walk now waits until the section resolves to a
single track before it believes it is on a phone.

## Amendment — one painter per document, under one document (sprint 26 día 7, 22 October 2026)

The día 7 amendment above keeps the handle painters in a `WeakMap` keyed by document, because under
the editor's `swap` route two documents are alive during a buffered swap and «the painter of
whatever was wired last» was the wrong one — CI forced the correction. Under `patch` (ADR 0051,
the default since sprint 26 día 5) there is one document per session, `redrawChrome` calls its
painter after every patch, and `observeSections` keeps one `ResizeObserver` per document that a
structural patch asks to observe the sections it inserted. The map is correct under both routes
and costs nothing; it reduces to one ref when `swap` retires on sprint 27 día 1, which
`docs/tasks/swap-route-retirement.md` names. **What this amendment corrects in the record:** «the
device switch replaces the preview's document», said in the day's harness lesson, is `swap`'s;
under `patch` the switch changes only the canvas's width, which is the measurement sprint 25's
closing walk makes under either route.

## Amendment — a row is a minimum, and the content pushes (sprint 28 día 7, 26 October 2026)

**Decided by David**, 26 October 2026, given three repairs with their cost and choosing the third:
«rowSpan es un mínimo, el contenido manda y empuja», with three conditions, each answered below.
Recorded by development, which does not sign. Amends §3 of the decision («the editor readjusts a
text's `rowSpan` to its content after an edit so that, in the editor, rows stay eight pixels») and
§4 of the día 6 amendment, which built that readjustment; §5's line in the panel changes one clause.

### 1. What was measured, and why the readjustment was the defect

Sprint 28 día 1 left one measurement open at David's request: the symptom a fixed layout width
would have cured, read in screen pixels before deciding whether to build it. Hand-designed cover,
window 1280 × 900, «Diseño» open: the panel takes the section from 912 to 692 px and the headline
wraps to two lines (52 → 104 px). Commit it there and the readjustment wrote **13 rows where there
were 7**. Close the panel: the headline fits one line again, the six rows stay, and the subheadline
sits **52 px** under it where it had been flush. His threshold was 8; 52 is a defect of this ADR.

And on the way, with the panel still open: one more letter in the two-line headline took the gap
to the subheadline from **48 px to 0**. The readjustment fitted the span to the grown text — 13
rows of 8 for 104 px — and the two empty rows that had been the gap were inside that span now. The
same mechanism from the other side: a span written to match one width's content is wrong in every
other width, and the panel is a second width inside the editor itself.

### 2. The decision: the span is a floor, the row is as tall as what it holds

`grid-auto-rows: minmax(8px, auto)` already said it for the published page (§3): a row with more
content than its span grows and pushes what is below it. The editor now says the same. The commit
of a text carries the words and only the words; `rowsFor`, the fourth argument of `onEditText`, the
`rowSpan` of the `editText` action and `withRowSpan` are gone. A text wider than its box in one
width and narrower in another leaves its rows alone, and the row does the work in both. **Rule 4
is still not amended**: a placement is a column, a span and a row on the section's grid; what
changes is who is responsible for the vertical slack, and it is the grid, as it always was on a
visitor's screen.

What this gives up, said plainly: in the editor the rows under a wrapped text are no longer eight
pixels each — the three rows of a four-line body measure about nineteen. That is the price of a
section that reads the same with and without a panel, and the next clause is what makes it safe.

### 3. His condition 2 — nothing reads «row × 8», verified before removing anything

- `rowAt` / `lastRowAt` (`dragGrid.ts`) walk `metrics.rows`, which `gridMetrics` reads off
  `getComputedStyle(section).gridTemplateRows` — the resolved tracks, grown rows included; only a
  point **below the last row** is extrapolated in steps of `ROW_STEP_PX`, which is what a new row
  measures.
- The announcement («A 312 px del borde izquierdo y 96 del superior») comes from the chosen
  element's measured box against the section's content box (`announceText`), as §3 of día 6 said.
- The guides line up against neighbour `getBoundingClientRect`s (`neighbourRects`), never a row.
- A resize by the edges goes through the same `rowAt`/`lastRowAt`.

Sabotaged — `rowAt` made to read eight pixels a row — the walk's drop under a grown body landed
**184 px** below where the hand let go of it, 40; so the assertion sees what the condition fears.

### 4. His condition 3 — the walk, and what it saw red

«sprint 28 día 7 — una fila es un mínimo», 1280 × 900, one walk with five assertions and a premise:
with «Diseño» open the headline is two lines (asserted, or there is nothing to measure); one more
letter keeps the gap to the subheadline within a row of what it was; a body grown to four lines
keeps its gap to the button within a row and the button comes down with it; the button dropped
40 px under that grown row lands within a row of the hand and not a pixel sideways; and the panel
closed gives back the gap measured before it opened, within a row. Against the editor before the
fix the first gap went red with the measured number — «0 px donde estaba en 48» — and the same red
returned when the readjustment was put back by hand after the fix. The sprint 25 día 6 walk that
asserted the readjustment now asserts the rows stay put through a long edit and its undo.

### 5. What this leaves open, named

The fixed layout width David asked about on día 1 is **not built**, and this symptom no longer
asks for it: with the span a floor, a text that wraps differently between panel states moves only
what is under it, by what it grew. Its price stays in the record for the day another symptom asks —
0,707 at 1024, 0,782 at 1280, 0,834 at 1600 — in `docs/tasks/backlog.md`.

**Found on the sprint 28 close (27 October 2026), and not decided here.** Escalation still measures
the live boxes (día 2's amendment), so a section escalated **with a panel open** writes the panel's
width into its rows: at 1280 with «Diseño» open the cover's headline is two lines and gets 13 rows,
and the gap to the subheadline is 16 px; with the panel closed the headline is one line and the gap
is **95**. This amendment's decision was the readjustment on a commit; how a section is measured
when it escalates is a decision of its own, and the backlog's row on the fixed layout width holds the
two repairs and their price.
