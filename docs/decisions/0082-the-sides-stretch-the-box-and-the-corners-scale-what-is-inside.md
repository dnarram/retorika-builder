# 0082 — The sides stretch the box, and the corners scale what is inside

**Status:** proposed · **Date:** 2026-11-25 · **Decided by:** David, 25 de noviembre de 2026,
planning sprint 41 «Estirar, agrandar y mover» — asked what «agrandar y empequeñecer» should do beyond
what the edge already does with the box, he chose three things at once and wrote the third himself:
*«La foto toma el alto que le des»*, *«La esquina de un texto escala la letra»*, and *«La esquina de
la foto escala la foto (puede hacerla más pequeña o más grande). De igual modo funciona la caja para
los distintos elementos (estilo Canva)»*. The plan put this day first and alone, as a change to the
interaction model gets its own pull request before anything is built on it, and he approved it so.
· **Recorded by development, with the standing note that development does not sign.** ·
**Amends:** [ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md)
día 4 §1 (what a corner does) and día 7 §1 (what a finger's corner handle does) ·
**Relates to:** [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md)
(an exact letter is a marked exception), [ADR 0083](0083-an-exact-letter-above-the-heading-comes-down-to-it-on-a-phone.md)
(what that letter does on a phone, landed the day before on purpose),
[ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md) (the two states the gesture respects) ·
**Touches:** `apps/editor` only. The published page does not change by a byte; the document gains
nothing a toolbar could not already write.

## Context

Since sprint 25 the eight points of a chosen element's box did one thing: stretch it. A side moved
one line of the grid area, a corner moved two — and a headline pulled by its corner came out as the
same forty-pixel letter in a box twice the size, with the words rewrapped. That is what a box does
in Word, and it is not what a hand means at a corner in Canva, which is the application David named
twice: there a corner scales **the thing**, and the box follows.

Sprint 40's inventory listed it as the gap in the first row: «textos, botones, enlaces, mapa — borde
±6 px, 4 lados y esquinas; altura solo suelo», and no way to make the letter bigger but the toolbar's
«Tamaño» and its «Exacto» field — a number typed, never a hand.

## Decision

### 1. A side stretches the box; a corner scales what is inside, by role

`cornerMeaning(role)` decides what a corner holds:

| Role | A corner scales |
|---|---|
| `heading`, `subheading`, `body`, `button`, `link`, `map` | **the letter**, and the box with it |
| `image` | **the photograph**, with its shape |
| `list`, `field`, `embed` | **the box on both axes** — what the corner did until today |

By role and not by tag, because the role is what the document promises an element is (rule 2). A
button's pill grows with its letter because its padding is the system's and its height is its line;
a list's cards fix their own letter, so a letter on the list would change nothing anyone can see.

The four sides are untouched: `resizeTo`, the ±6 px zone, the asymmetric zone while writing, the
four cursors, the guides — ADR 0050 día 4 as it stands.

### 2. One factor, from the hand's travel along the diagonal

The opposite corner stays where it is. The factor is the projection of the hand's travel, from the
press to now, onto the box's diagonal from that anchor to the corner held: outwards along it is more
than one, inwards less, and a hand that wanders across the diagonal changes nothing (`scaleFactor`).
One number for both axes is the whole difference between a corner and a side — a side's hand is read
against a grid line, a corner's against the box it holds.

Both spans take the factor, rounded, never under one unit or one row; from the north-west, north-east
and south-west corners the start moves so the far edge does not, exactly as a side's `resizeTo`
moves it. **Clamped, never refused**, as every gesture on this grid: at the section's edge the span
stops, and the factor the letter was given is then not the factor the box gets, which is the honest
answer there (`scaledBox`).

**No guides for a corner that scales.** The result is a size, not a line to line up with; the
guides stay for the sides.

### 3. The letter: a marked exception, the reference when the hand lands on one, nothing when it was already there

The letter as the browser draws it is the base — whatever the document says, since a headline with
no size of its own draws at the heading's — and the scaled letter is `basePx × factor`, between a
floor of **12 px** and the toolbar's own ceiling of 200, rounded to a pixel and stored as the exact
value rule 6 already admits for `fontSize`, `exception: true` (`scaledLetter`). The toolbar admits 8
by typing; a hand that slipped is not a number typed on purpose, and 12 is the floor the plan put to
David as default *d*.

**Within two pixels of one of the theme's three sizes the reference is written instead** — rule 6's
first arm, which follows the theme's scale forever. And a hand that lands on the size the element
already draws, with no size of its own, writes **nothing**: a corner barely touched leaves no
exception behind. The three sizes are read from the theme in pixels each time, so the magnet knows
where the generous scale's 48 is as well as the default's 40.

The box follows the letter's factor and not the hand's: past the floor or the ceiling the box stops
with the letter. A headline of two lines of twelve words is two lines of twelve words, bigger — the
walk asserts the line count — and `text-wrap: balance` and the rounding to units may move one line
on some sentence; the walk measures it on the generated cover and found none.

### 4. One gesture, one step

`shapeElement` in the history composes `setPlacement` and `setElementStyle` into one snapshot, with
`setPlacement`'s cause, so one «Deshacer» gives back the letter and the box together — half of it
back would be a letter of forty pixels in a box made for sixty — and `wasPlacementEverMoved` sees a
scale as the hand laying the section out, which it is. The two schema verbs each return the identical
document when nothing changed, so a corner barely touched opens no step. A text being written in
commits its words first and is picked up again after, as ADR 0050 día 4 has it for a side.

### 5. The preview is the element's own letter and grid area, and the sentence comes after

While the hand holds the corner the element's inline `font-size` and grid area are rewritten, so the
words rewrap at their new size exactly as the page will draw them — a `transform` would show a
picture of something that will not happen — and both are put back on release, committed or not, so
the committed size comes from the document and never from the preview. The help line's live child
says what the hand made, once per gesture: «Letra: 52 px», «Letra: Mediano», «Foto: 284 × 213 px».
The «Colocación» panel's one line of help gains the sentence that says a side stretches and a corner
scales.

## What is preserved

- **Rule 4**: a scale writes a column, a span and a row; no pixel of position reaches the document.
- **Rule 6**: a letter is a reference or a marked exception, as the toolbar writes them; the magnet
  prefers the reference. ADR 0083's cap applies to what a hand writes exactly as to what was typed.
- **ADR 0047's two states**: a corner is taken on the chosen element, or the one being written in.
- **The sides, the cursors, the zone and the guides** of ADR 0050 día 4.
- **The touch handles** of ADR 0050 día 7: `handles.ts` does not change. A finger's corner handle is
  a second door to the same `begin`, so it scales where the mouse's corner does.
- **The published page**, byte for byte: the document gains only values the toolbar could write.

## What is lost, and it is named

- **Stretching a text's or a photograph's box diagonally in one pull.** Two sides, one after the
  other, do it; the corner means something else now. For a list or a field it means what it did.
- **With a finger, a small element can only be scaled.** `handles.ts` gives an element under two
  targets across corners only, and a corner now scales; such an element is stretched from
  «Colocación», which ADR 0050 día 7 already named as its way. Side handles on low, wide boxes
  would amend ADR 0053's targets and were costed at a quarter of a day; not built.
- **A text's box no longer stays while its letter changes** — the box follows. «Tamaño» in the
  toolbar still changes the letter alone.

## What this does not decide

- **The photograph's own height** — «la foto toma el alto que le des» — and the point that survives
  its crop: días 4 and 5, with the schema field that makes «given a shape» a stored fact.
- **Scaling from the keyboard**: día 6, which amends this ADR with `+`, `−` and `E`.
- **The first corner pulled in a section the catalog draws**: día 3, the door where the hand is.

## Consequences

- `apps/editor/src/editor/cornerMeaning.ts` and `scaleBox.ts` (new, pure): the table, the factor,
  the letter and the box; `test/scaleBox.test.ts`.
- `apps/editor/src/editor/documentHistory.ts`: the `shapeElement` action; `test/documentHistory.test.ts`.
- `apps/editor/src/questionnaire/Editor.tsx`: `wireResizing` routes a corner of a text or a
  photograph to the scale, previews the letter, announces; `Variants.tsx` dispatches.
- `apps/editor/src/locales/es.json`: `editor.scale.letter`, `.letterRef`, `.photo`; the sentence in
  `editor.design.placementHelp`.
- The e2e walk of ADR 0050 día 7 («el elegido enseña asas…») stretched the headline by its `se`
  handle and asked for sixteen exact units; it came out 65 of 64 against this day, which is the
  corner scaling. It now scales the letter by that handle (× 1.3, the box following, one «Deshacer»
  for both) and stretches the **photograph** by its bottom handle — the side handle a headline is
  too low to offer — with the area's bottom still ending where the finger did.
- The e2e: «sprint 41 día 2» — the letter × 1.3 with the box and the same lines, from the document
  and not the preview, one «Deshacer» for both, the side leaving the letter alone, the magnet writing
  `size.subheading` from the north-west corner with the far edge still, the words intact while
  writing, the photograph's corner keeping its shape. `pull` and `cursorOn` hoisted from sprint 25
  día 4's walk to the file. Three sabotages: two steps in the reducer (red in the unit tests and the
  walk), the right side routed to scale (red in the walk), the factor reading `x` alone (red in the
  unit test; the walk pulls along the diagonal, where `x` alone agrees).
- The record is `docs/design/REVIEW.md`, sprint 41 día 2.

## Amendment — the keyboard: `+`, `−` and `E` (sprint 41 día 6, 26 November 2026)

Decided by David planning the sprint: *«`+` y `−` escalan, `E` estira»*, after being told that no
modifier is free for the arrows — Alt+arrows is back and forward on Windows, Control+arrows is Spaces
on the Mac, ⌘+arrows the ends of a line, and Shift already means «eight at a time» (ADR 0050 día 6).

- **`+` and `−` scale the chosen element a tenth a press** (`stretchKeys.ts`): what its corner scales,
  by the same functions — a text's letter and box (`scaledLetter`, `scaledBox` from the south-east
  corner, the north-west one still), a photograph with its shape, a list's or a field's box. `=` and
  `_` are the same keys unshifted on a US layout, and the numeric pad's report `+` and `-`.
- **`E` enters «estirando»**, where the arrows change the width and the height with the top-left
  corner still, one unit or row a press and eight with Shift; `E`, Escape or Intro leave it, and so
  does losing the focus. A photograph's stretch gives it a shape (ADR 0084). The help line says
  «Estirando: ← → el ancho, ↑ ↓ el alto · Mayús: de 8 en 8 · Esc: terminar» while it lasts, and the
  chosen element's hint gains «E: estirarlo · + y −: agrandarlo o empequeñecerlo».
- **A run is one step**, written on `keyup`, after `RUN_IDLE_MS` of quiet or on blur, as a run of
  moving arrows is; one sentence per run in the live child.
- **Inside a text being written they are letters**: the canvas leaves a `contentEditable` alone
  before asking. **In a section the catalog draws the first key asks**, the offer día 3's gesture
  opens; the key lands nothing on «sí» — the hand presses again.

Measured: `+` held three times on the generated cover's headline is one step, 40 → 53 px with the box
following and the keyboard still on it; `−` 53 → 48; two «Deshacer» give back 40 and the placement.
`E` and eight held left arrows on the photograph: eight units narrower, the same column, the same
height within 2 px; Escape leaves the mode and the photograph stays chosen. ADR 0050's «no resizing
by keyboard on the canvas» closes here.

## Close note — «sí» to an offer a key asked for (sprint 41 día 12, 27 November 2026)

Found by the close's tour, keyboard only: `+` on a chosen headline of a catalog cover opens the offer, as
día 6 says; its «sí», pressed with the keyboard, armed the return to the section's «A mano» verb — which is
not drawn once the section is hand-designed — so the keyboard fell to the section, and the next `+`
reached nothing. The headline was still chosen; nothing said where the keyboard had gone. The element that
asked is remembered now (`offerAskedBy`), and «sí» gives the keyboard back to it, still chosen, so the next
`+` grows it (40 → 44 px). The pointer's door (día 3) was never affected: a held element keeps its own
return. A walk asserts it; sabotaged back to the old return, it is red at the focus.
