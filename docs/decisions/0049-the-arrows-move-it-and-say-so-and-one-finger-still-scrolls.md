# 0049 — The arrows move it and say so, and one finger still scrolls

**Status:** proposed · **Date:** 2026-10-19 · **Decided by: David**, 17 de octubre de 2026, as part
of the sprint 24 plan — the keyboard equivalent on **the same day** as the drag, «cada movimiento por
teclado se anuncia en una región aria-live» — and in two corrections while approving it: **the
announcement must live in the parent document**, «porque cada flecha reemplaza el `srcDoc` y los
lectores de pantalla no anuncian regiones recién creadas», and **the walk must assert that three
arrows produce three movements without choosing the element again** · **Recorded by development,
which does not sign** · **Relates to:**
[ADR 0048](0048-the-first-drag-puts-an-element-in-the-grids-nearest-cell.md) (the drag),
[ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md) §1 (amended in one clause),
[ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md),
[ADR 0030](0030-one-breakpoint-bucket-and-the-width-the-gate-measures.md) · **Touches:** `apps/editor`

## Context

Yesterday's drag had three halves missing, and the plan named them before it was built: a keyboard
that can do what the hand can (**WCAG 2.1.1**, and the house rule that «un asidero que solo responde
a un puntero no existe para quien no tiene puntero»), a finger that still scrolls the page, and an
answer to what a drag means on a phone — the question sprint 17 left open when it withdrew the corner
handles.

## Decision

### 1. The arrows move the chosen element, and `Shift` sideways resizes it

One cell per press. `Shift+ArrowRight` widens by a column and `Shift+ArrowLeft` narrows by one.

**This amends [ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md) §1 in one clause and only
in one state.** That decision refuses every modifier, Shift included, because «Shift+Arrow is a
selection gesture everywhere» — true wherever there is a caret, and there is none in «chosen». While
**writing**, every modifier still goes straight to the browser, untouched.

**Vertical with `Shift` does nothing.** «One row taller» is a different kind of change — a row's
height is its content's — and the panel's own stepper owns `rowSpan`. Half a pair here would read as
the other half being broken.

### 2. One refusal for the hand and the keyboard

A cell another element holds is refused for an arrow exactly as it is for a drop (ADR 0048 §4), and
`arrowDrop` answers in the same words `dropAt` does. Otherwise the keyboard would quietly do what the
hand is told it may not. The four «Colocación» buttons stay the way to stack on purpose, which is the
same split as yesterday.

At the edges a press does **nothing** rather than being clamped: a clamp answers a deliberate press
with a move nobody asked for.

### 3. The announcement lives in the editor's document, not in the canvas

David's correction, and it is a defect it would have shipped. Every arrow is an edit and every edit
replaces the canvas's whole `srcDoc`, so a region inside the frame would be a **freshly created**
region on every move — and a screen reader does not announce the contents of a region that has just
appeared. The region is a `role="status"` with `aria-live="polite"` in the editor's own chrome, which
survives the rebuild, and it says «Columna 3 de 12, fila 2».

**Two sentences for two acts**: where it went, or how wide it is now. A move that said «ancho 4» every
time would bury the number that changed under one that did not.

**And the same sentence twice is made audible twice.** A live region announces a *change*, so two
refusals in a row would be read once; a counter's parity appends a zero-width space, which no screen
reader reads out and which makes the second a change like any other.

### 4. The keyboard comes back to the element it just moved

Every arrow replaces the frame, so the node that had the keyboard is gone by the time the new document
is wired. A flag that **only an arrow sets** asks for the focus back; an edit made with a swatch or a
verb still leaves the keyboard where the hand was, which is why the restoration does not simply focus
on every rebuild.

**What this costs, named rather than glossed: a press that arrives while the frame is being rebuilt is
lost.** Holding an arrow down does not walk an element across the grid. That is ADR 0001's
architecture showing through — a published page with no runtime means the canvas is a document the
editor rewrites — and the honest answer today is to say so rather than to buffer keystrokes into a
queue nobody has asked for.

### 5. Anything placed is focusable, not only a text

`wireEditing` makes a **text** focusable; nothing made a photograph one, so the arrows had nothing to
act on and WCAG 2.1.1 was met only through the panel. Every placed element now carries `tabindex="0"`,
and **arriving by Tab chooses it**, which is the rule a text already followed.

A click on a photograph still opens «Cambiar foto», untouched. So an image is chosen by Tab or by the
start of a drag, and that asymmetry is deliberate: the picker is the commonest thing to want from a
photograph and it was there first.

**Escape releases anything chosen**, which a photograph had no way to do: `wireEditing` gives a text
its two meanings of Escape and wires no image, so a chosen one kept its outline and kept the arrows.

### 6. Touch: `touch-action: none` on the chosen element and nowhere else

David offered two shapes — «arranca con pulsación larga, **o** solo sobre el elemento ya elegido» —
and this is the second, because the first cannot be made honest in a browser: a touch's gesture is
decided at `touchstart`, so a `touch-action` set when a long press fires arrives after the page has
already agreed to scroll. Declared on the chosen element instead, the gesture is unambiguous from the
first move, **on that element and nowhere else**.

A tap is what chooses, so touch needs no new gesture: tap once, then drag. **And one finger still
scrolls the canvas**, which the walk measures rather than assumes — that assertion is what keeps
`touch-action: none` from spreading across the page.

### 7. On a phone the same gesture reorders, because rule 7 says so

In the mobile view a section is one column: the renderer emits
`.rb-section > * { grid-column: 1 / -1 !important; grid-row: auto !important }`. There is no column to
move between, and rule 7 admits exactly three adjustments — hide, reorder, narrow. So the drag means
the one of the three it can mean: **up or down changes the reading order, and sideways does nothing.**

- **`moveUpOnMobile` is the verb**, so dragging down is the neighbour below moving up: one verb, one
  history step, and no second function in the schema to keep level with the first.
- **The ghost is drawn over the element it would trade places with**, not over a cell that does not
  exist here, and **the twelve stripes stay away** — they answer «which column», and there is one.
- One step per release. Travelling further is repeating the gesture.

## Three things only a browser could say

1. **The restoration was clearing the choice for anything that was not a text.** ADR 0047's code read
   `EDITABLE_TAGS` there because only a text could be chosen when it was written; a photograph can be
   from today, so the first arrow moved it and the rebuild then *unchose* it — three presses, one
   movement. **This is exactly the assertion David asked for**, and it is the only way the defect was
   ever going to be seen.
2. **`device` was frozen inside the listeners' closure.** Turning the design tools on replaces the
   document, so a gate read at wiring time stays true; switching to the phone only changes the canvas
   card's width, so the drag kept the `device` it was wired with and drew the twelve stripes on a
   one-column page. It is read from a ref now.
3. **A bare `touchscreen.tap(x, y)` scrolls nothing into view.** A walk lesson rather than a product
   one, recorded because it cost an hour: the tap reached no element at all and the instrumented run
   showed exactly one `pointerdown` — the scroll's.

## What is preserved

- **ADR 0047's two states**, including Escape's two meanings inside a text.
- **ADR 0048's refusal, ghost and single history step**, now shared by the keyboard.
- **The four «Colocación» arrows**, for stacking on purpose and for WCAG 2.5.7.
- **Rule 4**: an arrow produces a column and a row, never a coordinate.
- **Rule 7**: the phone hides, reorders and narrows, and this adds nothing to that list.
- **One finger scrolls the canvas**, measured at every width the mobile walk visits.

## What is lost, and it is named rather than glossed

- **A press during the rebuild is lost** (§4). Holding an arrow down does not walk an element.
- **No long press on touch** (§6), so a photograph on a phone is chosen by tapping it — which opens
  the picker — and therefore cannot be dragged there yet. The panel's arrows are its keyboard, and
  the ordering gesture works on the elements a tap can choose.
- **`rowSpan` is not on the keyboard**, by §1's own argument.
- **The announcement is Spanish only**, like every other string in the interface, and lives in
  `es.json` where the next language will find it.

## What this does not decide

- **The closing day**: axe at 390 over the panels this sprint moved, the keyboard-only walk, the
  weights, Lighthouse, the golden diff and the sprint's record in `docs/design/REVIEW.md`.
- **Whether Tab should walk a section's insides before the section is chosen**, open in
  `docs/tasks/backlog.md` since sprint 19 and now carrying one more stop per placed element.

## Consequences

- `apps/editor/src/editor/dragGrid.ts`: `arrowAction`, `arrowDrop`, `announceText`, `reorderAt` — the
  judgement, with no DOM, tested as arithmetic (16 cases).
- `apps/editor/src/questionnaire/Editor.tsx`: the live region and its repeat counter, the arrows on
  the chosen element, the focus that comes back, `tabindex` on anything placed, Escape's release for
  a non-text, `touch-action` on the chosen element, the mobile branch of the drag, and `device` read
  from a ref.
- `apps/editor/src/locales/es.json`: the two sentences, the hint for a movable element and the
  phone's own line.
- The e2e: three arrows and three movements with the announcement read **outside** the canvas; a
  finger that scrolls and then drags; and the phone reordering while sideways does nothing.
- The record is `docs/design/REVIEW.md`, sprint 24.
