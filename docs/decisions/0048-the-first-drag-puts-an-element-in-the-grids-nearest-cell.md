# 0048 — The first drag puts an element in the grid's nearest cell

**Status:** proposed · **Date:** 2026-10-19 · **Decided by: David**, 17 de octubre de 2026: *«En el
editor dentro de una sección quiero poder mover cualquier elemnto visual arrastrando con el ratón sin
asas para ajustar su posicion en la pagina»*, and, choosing among three ways of answering it,
**«arrastrar con imán a la rejilla»** — plus the three decisions he took while reviewing the plan:
**a drop on an occupied cell is refused and the element returns**, the ghost shows the result
**before** letting go «también cuando se rechaza», and «ocupada» has the exact definition quoted in
§3 · **Recorded by development, which does not sign** · **Relates to:**
[ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md) (the precondition),
[ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) §7 (the escalation
is offered, never done), [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md),
[ADR 0014](0014-deleting-a-section-never-asks.md) (one gesture, one step) ·
**Touches:** `apps/editor`

## Context

**Two real owners asked to move things freely and were refused in writing, twice.** The record of the
second refusal is the sentence that matters: it «does not say the grid is missing, it says **the grid
that was built did not read as the answer to "I want to move this"**». Four stepper buttons under a
panel are that grid; a hand on the thing itself is what the question was about.

It could not be built until yesterday. Every text in the canvas was permanently `contentEditable`, so
a drag over one selected words: there was no gesture to spare. The plan's first answer was a 3-pixel
threshold and David refused it with the measurement that disproves it — selecting text by dragging
passes 3 px too — so [ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md) split the gesture
into two states first, in its own pull request, and this is what that bought.

## Decision

### 1. Rule 4 is not amended, and this drag is the reason it does not need to be

An element is let go anywhere and lands in the **nearest** of the section's twelve columns and the
nearest of its rows. Nothing produced here is an `x` or a `y`: `dropAt` returns a column and a row,
and `setPlacement` accepts nothing else. «La colocación libre siempre ocurre dentro de la rejilla de
la sección, nunca sobre coordenadas absolutas» (advanced dossier §6) is kept by construction rather
than by discipline.

**Nearest and not «the band the point is inside»**, because David chose «imán»: a magnet pulls to the
closest line, so an element let go in the right half of a column's band snaps to the next one.
Flooring would mean an element that never moves as far as the hand took it, which reads as the drag
resisting.

### 2. The browser's own drag-and-drop never appears

`preventDefault` on `dragstart` and `draggable = false` on every image and link in the canvas. They
are what a browser drags by itself, and it would turn a gesture about position into a copy of an
image or a shortcut to a URL.

### 3. «Occupied» has an exact definition, and it is by rectangles

> The destination is occupied when **the complete destination rectangle — column, width, row,
> height — intersects another element's, excluding the dragged element itself.**

David's own words, given for a reason: **moving something one column right overlaps its own cells and
must not be refused**, and that is the commonest drag there is. The exclusion is by element id and
happens **inside** `dropAt` rather than in the caller, so it cannot be forgotten.

Two unit tests, which he also asked for by name: the one-column shift over itself, which is accepted,
and a partial overlap with another element, which is refused. Both are in
`apps/editor/test/dragGrid.test.ts`, and the first is also walked in a real browser.

### 4. Refuse and return — an interface rule, stricter than the document, and it says so

`setPlacement`'s own note records that **two elements may end up in the same cell and that it is
allowed**: CSS grid stacks them, the schema has never forbidden it, and overlapping on purpose is a
real technique. So this refusal is the **interface's**, not the model's: a drag is a gesture about
position, and one that silently stacks two things produces a result nobody can see.

Stacking on purpose stays available through the four «Colocación» buttons — which is also the second
reason to keep them, beside the first one in §7.

**Below the last row, the section grows.** Rows have no ceiling in the document model, so the limit
here is the interface's own `MAX_ROW` of 24, and past it the answer is no rather than a clamp that
would put the element somewhere nobody asked for. **Past the right edge it clamps instead of
refusing**, because overshooting the twelfth column means «as far right as it goes» rather than a
mistake.

### 5. The ghost shows the result before letting go, including when the answer is no

Drawn inside the section, on the twelve stripes of rule 4 — the same stripes the Diseño panel already
draws, now shown by the drag itself so the answer to «where will this land» is there even with the
panel shut. A free destination is dashed brand blue; a refused one is solid danger red **and carries
the reason in words**: «Aquí ya hay otro elemento», «La sección no crece más hacia abajo».

**The element itself does not follow the pointer**, and that is a decision rather than a shortcut: an
element's rendered width **is** its column span's width, so one dragged under the pointer would be
drawn at the size it has rather than the size it would get. A preview that lies about the result is
worse than none. The element dims; the ghost is drawn at the destination's real rectangle.

### 6. One drag is one step of history, written on `pointerup`

Never on `pointermove`, and there is a technical reason underneath the product one: every edit
replaces the whole `srcDoc`, which destroys the injected chrome — the listeners of this very drag
included. A refusal writes nothing at all, so Ctrl+Z after a refused drag takes back whatever came
before it, which is the only honest thing it can mean.

### 7. The escalation is still offered and never done on its own

ADR 0025 §7 is not amended. A drag in a section the catalog draws **moves nothing and asks the
question instead**, through the same offer the section's own «A mano» button opens — one door, not a
second copy of it. «No se mueve nada al empezar» is that offer's own promise, and a drag that quietly
rewrote a preset's layout would break it.

**The drag is behind the design tools**, like the four arrows that ask the same question with a
keyboard: a placement is a design-tools idea (ADR 0026's line).

**WCAG 2.5.7 (Dragging Movements, AA since 2.2)** asks that a drag have a single-pointer alternative.
The four «Colocación» buttons are it, and they were there first.

### 8. The precondition is applied where the ambiguity is

A **text** must be chosen before it can be dragged — one click chooses, and the drag is then
unambiguous (ADR 0047). An **image** has no competing gesture, so it drags straight away. Requiring a
choice there would be charging for a precondition that protects nothing.

Inside a text being **written in**, a drag selects words, as it always has. Writing wins.

## Three things only a browser could say

1. **The click that follows a drag closed the offer the drag had just opened.** `wireSelection`
   closes an open popup on any click outside it — correctly — and a `pointerup` still produces one.
   So the gesture that asked the question also dismissed it, and nobody would ever have read the
   offer. A drag is not a click, even when all it did was ask.
2. **A text stays chosen after a drag**, so the next click on it is the *second* one and starts
   writing. The walk pressed it, got a caret, and no drag armed. That is right — dragging straight
   from the chosen state is what a hand does — and it is written down because it reads as a bug
   until it is read as the two states doing their job.
3. **A section's rows are measured, not computed.** `.rb-section` is twelve `1fr` columns, so a
   column's width is arithmetic; its rows are **implicit and sized by their content**, and
   `grid-template-rows` resolves to the used pixel heights. A module that assumed uniform rows would
   snap to the wrong row on every section whose first row is a headline and whose second is a
   photograph, which is most of them.

## What is preserved

- **Rule 4**, unamended and unamendable from here: no coordinate reaches the document.
- **Rule 1**: a placement references an element and never contains it.
- **The four «Colocación» arrows**, for stacking on purpose and for WCAG 2.5.7.
- **ADR 0025 §7's offer**, with its promise that nothing moves until it is accepted.
- **ADR 0047's two states**, which this rests on rather than changes.
- **A nested element** — a gallery card, a line of a list — has no placement and moves with its
  list. The drag does not start there, which is also what `setPlacement` would refuse.

## What is lost, and it is named rather than glossed

- **The element does not travel under the pointer**, for the reason in §5. Somebody used to a free
  canvas will notice; the ghost is what answers them.
- **A refusal is explained only while the hand is still down.** The ghost says why, and once it is
  released there is no toast repeating it. Deliberate — nothing happened, and a toast about nothing
  is noise — but it is a thing to watch in a session.
- **Touch does nothing yet.** A `pointerdown` whose `pointerType` is `touch` is ignored, so one
  finger still scrolls the canvas. The long press and `touch-action` on the one chosen element are
  the next day's, with the mobile semantics.
- **No keyboard equivalent arrived with it today.** The four arrows are the standing answer; the
  arrows *on the element* — «Columna 3 de 12, fila 2» announced in the parent document — are día 9's,
  and the house rule that a pointer gesture needs a keyboard one is met in the meantime by controls
  that already exist rather than by a promise.

## What this does not decide

- **The arrows on a chosen element**, their announcement and where it lives. Día 9, and ADR 0047 left
  every arrow alone precisely so this day could not pre-empt it.
- **Touch and the mobile semantics** — in the mobile view the same gesture must reorder rather than
  place, because rule 7 admits only hide, reorder and resize.
- **Whether a drop may resize.** It may not: a drag moves an element and keeps both of its spans.
  Widening stays the arrows' own job.

## Consequences

- `apps/editor/src/editor/dragGrid.ts` (new): the judgement — the metrics' shape, the nearest cell,
  the exact overlap, and what a drop does. No DOM, so it is tested as arithmetic.
- `apps/editor/src/questionnaire/Editor.tsx`: `gridMetricsOf` (measured in the browser), `drawGhost`,
  `wireDragging`, the stripes shared with the panel's own class, and the door to ADR 0025's offer
  published for the drag to use.
- `apps/editor/src/locales/es.json`: the two refusals, in words.
- The e2e: a walk that escalates a section, drags an element one column over its own cells, undoes
  it in one step and has a refusal explained; and one that holds the precondition — a text nobody
  chose does not drag.
- The record is `docs/design/REVIEW.md`, sprint 24.
