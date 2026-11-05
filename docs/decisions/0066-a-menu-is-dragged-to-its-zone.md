# 0066 — A menu is dragged to its zone

**Status:** proposed · **Date:** 2026-11-04 · **Decided by:** David, 4 de noviembre de 2026, al
planificar el sprint 33 — his third decision, «arrastrar a zona», with its four conditions (the gesture
starts on the menu's own ground and never on an entry, with the elements' threshold and two states;
the zones are drawn at the start and lit under the hand, a drop outside or Escape writes nothing, one
step of history; a side the other menu holds stacks the two and the ghost says so first; the live
region names the zone and the panel's cards stay the keyboard's way) — and his second adjustment
approving the plan (the cursor announces the gesture before it starts, in the desktop view only). ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** · **Relates to:** [ADR 0060](0060-each-menu-has-its-place-and-the-places-are-the-zones.md)
(§1: the places are the zones; «What this does not decide»: the gesture itself),
[ADR 0048](0048-the-first-drag-puts-an-element-in-the-grids-nearest-cell.md) and
[ADR 0049](0049-the-arrows-move-it-and-say-so-and-one-finger-still-scrolls.md) (the threshold, the two states,
one finger scrolls), [ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md)
(§6: the threshold divided by the zoom), [ADR 0051](0051-the-canvas-keeps-its-document-and-an-edit-is-a-patch.md) (a drag ends in a
patch), [ADR 0053](0053-chrome-is-drawn-in-screen-pixels-and-an-element-too-small-on-screen-keeps-its-corners.md) (the zones' border and word) ·
**Touches:** `apps/editor` only (`menuDrag.ts`, `wireMenuDrag` in `Editor.tsx`, `es.json`). Nothing
of the renderer, the schema or the published page.

## Context

ADR 0060 gave each menu a place from a closed vocabulary — the pages in the bar or a column; the
sections in the bar, a row, a column or behind «Ir a…» — on David's condition that every word of it
be a zone a future drag would drop the menu on, «so the gesture, when it comes, is a way of choosing
a place and never a way of making one». The «Dónde va» cards of sprint 31 día 5 choose a place with a
click; the gesture was left to another sprint. Opening sprint 33, David asked for it: «arrastrar los
dos menús hasta su sitio».

Three readings were costed before planning. **(b) The menu as an element of a section** — five or
six days, an amendment of rule 5, the undoing of ADR 0060's refusal, and the loss of what a menu has
that an element has not: fixity, the pages, the `banner` before `<main>`, the contrast over a
photograph, the phone's own derivation — refused. **(c) Finer zones first** («bajo la portada», an
«esquina inferior» that is the pill David refused on 30 October) — a day or more per word, refused;
«bajo la portada» goes to the backlog with its cost. **(a) Drag to the zones that exist** — chosen,
with the four conditions below.

## Decision

### 1. The gesture starts on the menu's own ground, never on an entry

A press held on a `nav`'s padding and the gaps between its entries, on a rail's background, on the
sections' row or on «Ir a…»'s summary arms the drag. An entry is a link and keeps doing what a link
does in the canvas, taking it to the section or the page (`wireLinks`); the brand and the button keep
choosing the header. The threshold is the elements' own — three pixels of the hand, divided by the
canvas's zoom so that three pixels on screen are three at every window width (ADR 0050 §6) — and so
are the two states: under the threshold the press is a click, which chooses the header, opens
«Ir a…» or follows the link as before; past it, the click that ends the gesture is the gesture's own
release and is swallowed (`justDragged`, ADR 0048 §2). With a finger, only once the header is chosen,
as an element drags only once chosen (ADR 0049): otherwise one finger scrolls.

### 2. The zones are drawn when the gesture begins, and a drop outside or Escape writes nothing

The moment the threshold is crossed, every place of this menu's vocabulary is drawn on the canvas as
a zone — a dashed box in the chrome's blue with the panel's own word in it; the place the menu is in,
solid and quiet; the one under the hand, filled — and a ghost with the menu's name follows the hand.
**The ghost moves, never the menu**: a menu is a flex child of the bar, a fixed column or a sheet,
and a box that moved under the hand would break the bar it is part of. Letting go on a zone writes
that zone's word through the same patch the «Dónde va» card for it writes (`pagesPositionPatch`,
`sectionsPositionPatch`): one `setHeader`, one step of history, and «Deshacer» puts the menu back in
one press. Letting go off every zone, or on the zone the menu is already in, or Escape at any point,
writes nothing and announces nothing: the zones go and the menu is where it was.

**The zones' geometry comes from the renderer's constants**, never from measuring a rail that may not
be drawn yet: a side is `RAIL_WIDTH` by the window's height; the bar is its own box, or a strip of
the stylesheet's estimate (`--rb-bar-h`) where it has collapsed to nothing; the row is a band under
the bar; «Ir a…» is a pill at `--rb-header-h + space.md` on the side the pages' rail leaves free —
where `foldCss` puts the real one. Where zones overlap, the smaller wins under the hand.

### 3. A side the other menu holds stacks the two, and the ghost says so first

Dropping the sections on the column the pages hold — or the pages on the sections' — produces what
ADR 0060 §2 already decided: one rail, the two menus stacked, the pages first. The ghost's second
line says it before the hand lets go: «Se apila bajo el menú de páginas».

### 4. The live region names the zone, and the cards stay the keyboard's way

A drop is announced in the editor's `role="status"` region as the menu and its new place in the
panel's words: «Menú de páginas: columna izquierda». The gesture is a pointer's; the «Dónde va» cards
are its keyboard equivalent, as they were, and **there are no arrows for a zone**: a zone is not a
cell beside another cell, and an arrow that walked «from the bar to the left column» would be a
second vocabulary of the same five words.

### 5. The hand is told before it pulls

Over every grip of the gesture — a `nav`'s ground, a rail, the row, «Ir a…»'s summary — the cursor is
the open hand (`grab`), and the closed one (`grabbing`) while the gesture lasts; an entry keeps the
pointer a link has. A Canva user discovers that something drags because the cursor changes, and
without it the panel's sentence would be the only hint. In the desktop view only: the phone's bar is
not dragged (below), so nothing there says it is. The cursor is not a length: `chromeScale` is
untouched.

## What this does not do

- **It does not move the menu.** The ghost moves; the menu is redrawn in its new place by the patch
  that follows the drop.
- **It does not create a place.** Every drop writes one of `PAGES_POSITIONS` or `SECTIONS_POSITIONS`;
  no coordinate reaches the document, and rule 4 stands as ADR 0060 left it.
- **It does not exist in the phone view.** No rail stands under 1024 px, and where the sections go on
  a phone is `sections.mobile` — a row, nothing, or «Ir a…» — a choice of the panel's «En el móvil»
  that has no zone on the page. A press on the phone's bar arms nothing, draws nothing, writes
  nothing, and the cursor there is not the open hand.
- **It does not replace the keyboard** (§4).
- **It does not drag with an unchosen finger** (§1, ADR 0049).
- **Finer zones** — «bajo la portada», a corner of the page — are not added: a new word is added to
  the vocabulary and to the gesture at once, or to neither (ADR 0060 §1), and «bajo la portada» is
  in the backlog with its cost.

## What is preserved

- ADR 0060 whole: the vocabulary, the rail, the bar keeping every copy, the collapsed bar, the script
  reading across the page. The gesture reads the vocabulary and writes into it.
- The «Dónde va» cards and their notes: the same patch, the same words, the card marked the moment
  the drop is written, since it reads the document.
- The published page, byte for byte: nothing of the renderer changes, and the goldens say so.
- The elements' drag (ADR 0048–0050): a second wiring on the document, armed only on the header's
  grips, so the two never see one press.

## What is lost, and it is named

- **A press on a menu's ground is no longer only a choice of the header.** Under the threshold it
  still is; past it, it is a drag. The elements' drag made the same trade on sprint 24.
- **A rail that is the window's height is the whole of its zone**, so the left column's zone covers
  the left 240 px of the canvas from top to bottom, over the page's own content. Only while the
  gesture lasts, and only as a drawing: `pointer-events: none`.

## Consequences

- `apps/editor/src/editor/menuDrag.ts` (new, pure): `menuOf`, `zonesFor`, `zoneRects`, `zoneAt`,
  `dropOutcome`, `dropText`, `stackedText`; `test/menuDrag.test.ts`.
- `apps/editor/src/questionnaire/Editor.tsx`: `wireMenuDrag`, wired beside `wireDragging`; the zones,
  the ghost and the cursor in the chrome sheet; `onSetHeader` through `propsNow`.
- `apps/editor/src/locales/es.json`: `editor.menuDrag.*`.
- `test/patchCanvas.test.ts`: the zones and the ghost are chrome in the body, kept across the patch
  the drop writes.
- The walk «sprint 33 día 4 — un menú se arrastra a su zona» at 1440 (the canvas at 0.9125): the
  gap between two entries held, three screen pixels arm nothing and four draw three zones, the left
  column lit, the drop, the announcement, the card, one «Deshacer»; Escape and a drop outside; a
  click on an entry and on the ground; the cursor over both. Sabotaged: without `justDragged` the
  release chooses the header; without the zoom's division the zones appear at three.
- Day by day in `docs/design/REVIEW.md`, sprint 33 día 4. The cases a day's gesture leaves — the
  stack, the collapsed bar, «Ir a…» and the row, a zoom under 1 with a panel open, a finger, the
  phone view, the panel's sentence — are sprint 33 día 5's.

## Note — sprint 33 día 5: the whole gesture, case by case

Each case of the plan's día 5 has its walk («sprint 33 día 5 — el arrastre completo»), and three
things of the gesture changed on measuring them:

- **A cancel is not a release.** `pointercancel` — a finger the browser turned into a scroll, a
  window that lost the pointer — ends the gesture as Escape does, writing nothing. It used to be
  read as a release, which would have written the zone the hand was merely passing over. Measured by
  a cancel dispatched over the right column: nothing written; sabotaged back, `right` written.
- **A chosen header's grips take the finger** (`touch-action: none` on `.rb-header.rb-selected`'s
  `nav[data-part]`, rails, row and «Ir a…»'s summary): §1's rule that a finger drags only a chosen
  header needs it, since a finger's gesture is decided at `touchstart` (ADR 0049). Unchosen, a finger
  on a column scrolls the canvas; chosen, it carries the menu. Sabotaged with `auto`, the finger never
  lights a zone. While the header is chosen, a column that outgrows the window no longer scrolls under
  a finger: the trade ADR 0049 made for the chosen element.
- **The panel says it**, once, under the first «Dónde va» drawn, in the desktop view only: «También
  puedes arrastrar el menú en el lienzo hasta su sitio: cógelo por el hueco entre sus entradas.»

Measured, and as §2 and §3 said: a side the other menu holds stacks the two in one column, pages
first, the ghost saying so before the drop; a collapsed bar's zone is a strip of 1040 × 72 between
the column and the edge, and a drop there gives the bar its height back; «Ir a…» lands where its zone
was drawn, to a pixel at its top and its right — the proof that the zones are the renderer's
constants; a drag from «Ir a…»'s summary never opens it; at 1280 with the panel (a zoom under 0.7) a zone's word
is 12 px of the screen and its 240 px are the column's; in the phone view nothing is drawn, written
or offered; under the legibility floor (887) a drop on a side writes the word and the panel says the
column folds there. «Deshacer» undoes each drop in one press.

**What it cannot reach, measured**: a menu with **one entry** in the bar has no ground to hold — its
`nav` is as big as its one link (0 px² beside it, against the 461 px² of the gap between two entries,
Chromium at 1280). Condition 1 keeps a link a link, so such a menu is moved from the panel's cards, as
before. A grip that started on the entry and became a drag past the threshold would reach it; it is
the one way to, and it is David's to choose (the PR of día 5 asks).

## Note — sprint 33 día 6: the gesture also starts on an entry (condition 1, amended)

**David's decision of 5 November 2026**, answering the question the día 5 note above left him: **yes,
a press on any entry past the threshold starts the drag.** Recorded by development, which does not
sign.

§1 said the gesture starts on the menu's own ground and never on an entry, and día 5 measured what
that left out: a menu of one entry in the bar has no ground at all. The amendment keeps what §1 was
protecting — the link stays a link — by the rule §1 already had: **the two states**. Under the
threshold a press on an entry is the click `wireLinks` follows, and the canvas goes to that page or
section as before; past it, the press is the drag, and the click that ends it is swallowed
(`justDragged`). The brand and the button are still never grips. With a finger, still only once the
header is chosen.

**The cursor over an entry stays the link's hand**, not the open one (§5): what a click there does is
navigate, and the open hand is for the ground, where a press does nothing else. The panel's sentence
says both ways: «cógelo por una de sus entradas o por el hueco entre ellas».

Measured by the walk «sprint 33 día 6 — un menú se coge también por su entrada», at 1440 (1280 at
0.9125): a site with one page besides the home, its pages' menu drawn by «Siempre» — a `nav` exactly as
large as its link —; held on the link and carried 6 px, the three zones; over the left column, lit;
let go, `pages.position = "left"`, the column standing, «Menú de páginas: columna izquierda» in the
status region, and no page navigated to; «Deshacer» puts it back; a press on the link without moving
takes the canvas to that page. Sabotaged back to «never on an entry», no zone is drawn and the walk
is red.

**Two zones follow the estimate that learnt its form the same day** (ADR 0063's note of sprint 33 día
6). A collapsed bar's strip, 1040 × 72 on día 5, is now the bar the menu comes back to — 69.8 px on the
generated site — and the walk asserts that the bar given back measures the strip to a pixel. And
«Ir a…»'s pill is drawn from the bar **without** the sections' row when the sections are the menu
carried: the estimate counts the row on a page that draws one, and the row leaves with the drop.
