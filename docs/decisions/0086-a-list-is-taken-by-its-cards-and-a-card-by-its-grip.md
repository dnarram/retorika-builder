# 0086 — A list is taken by its cards, and a card by its grip

**Status:** proposed · **Date:** 2026-11-25 · **Decided by:** David, 25 de noviembre de 2026,
planning sprint 41 «Estirar, agrandar y mover» — of three ways into a list he chose *«Bloque agarrable y
tarjetas en orden»*: the list grabbable by any of its cards and stretched as a block, a card dragged
within its list changing order, the inside of a card left as the catalog draws it — and, rejecting the
first plan, his adjustment 3 on the bound list (*«Dime qué hace el arrastre de una tarjeta en una lista
vinculada a otras secciones»*), which the card's grip answers on día 8. He moved this day from Sonnet to
Opus: *«toca `wireDragging` y el umbral entre clic y arrastre de todo el lienzo»*. · **Recorded by
development, with the standing note that development does not sign.** · **Relates to:**
[ADR 0048](0048-the-first-drag-puts-an-element-in-the-grids-nearest-cell.md) («a nested element moves
with its list»), [ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md) (the two states),
[ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md) día 3 (a held
click drags), [ADR 0033](0033-reusable-content-and-the-template-that-is-one-item.md) (a bound list's one
order) · **Touches:** `apps/editor` only. The published page does not change by a byte.

This ADR is written in two halves. **Día 1b** (this section) is the block; **día 8** adds the card's
grip and the bound list, as an amendment below.

## Context

In a hand-designed section a list is placed as one element and its cards flow inside it (ADR 0048,
ADR 0050 «nothing inside lists»). The cards' title, words and photograph carry a `data-id` of their own
so they can be chosen and written in, and they have no placement. The drag found its element by
`closest("[data-id]")`, so a press on a card's title found the title, looked for its placement, found
none, and did nothing. «Qué hago» could be carried only by the gaps between its cards — a few pixels of
padding nobody aims at.

## Decision

### 1. A press takes hold of the placed element it sits in

Every pointer handler of the drag asks `heldBy`: the element pressed if its section places it, and
otherwise the placed element it sits inside, climbed by `[data-id]` to the section's own child. So a
card's title, words or photograph is a handle for its whole list; what is inside the card stays where
the catalog draws it. The gesture's state lives on the list, whichever child the next event lands on.

### 2. The pointer is captured when the gesture arms, not on the press

A placed element captures the pointer on `pointerdown`, as it did. A press that came through a card
captures it **when the drag arms** — past the three screen pixels of ADR 0050 día 3 — because a capture
on the press retargets the click: the click that should choose the card's title would be a click on its
list, and the second click would never start writing. **A click that does not move still chooses the
card's text, and a second one writes** (ADR 0047), which the walk asserts and a sabotage of this clause
turns red.

### 3. The card's own buttons are never the start of a drag

A press on the editor's chrome inside a card — «Poner esta línea antes», «después», «Quitar» — is the
button's, and the drag returns before taking hold of anything. **This was a defect on `main` before
today, found by sabotaging this clause**: in a hand-designed section those three buttons resolved to
the list, the list captured the pointer on the press, and the click was lost — the arrows of a card
did nothing there. The walk presses «Poner esta línea después» in a hand-designed section and reads the
order changed.

### 4. What does not change

- **Writing wins**: inside a text being written in, a drag still selects words.
- **The list is what is chosen after the drop**, as any dropped element is (ADR 0050 día 3), and a run
  of arrows on the chosen list moves it — the keyboard's way, unchanged.
- **A catalog section** still answers a drag with the «Diseñar a mano» offer, anchored on the card's
  text when that is what the hand pressed.
- **A finger** drags a list by a card when the list or that card's text is chosen.

## What is lost, and it is named

- **A card's text can no longer be dragged to select words without writing in it first** — it never
  could be dragged anywhere else either; now the drag means the list.
- **No keyboard path from a card's text to its list.** Tab reaches the list itself, and the arrows move
  it; a chosen card's title does not forward the arrows to its list.

## What this does not decide

- The card's grip and a card dragged to another place in its list — día 8, amending this ADR.
- Stretching the list from a card's edge — día 2 decides what the edges of a chosen element are.

## Consequences

- `apps/editor/src/questionnaire/Editor.tsx`: `heldBy` in `wireDragging`; the drag state gains
  `capture` and `pressed`; the chrome guard on `pointerdown`.
- The e2e walk «sprint 41 día 1b — la lista se coge por cualquier tarjeta»: carried down by the first
  card's title, nobody else moved, no selection left, the list chosen, one «Deshacer»; a still click
  chooses the title and a second writes; «Poner esta línea después» works in the hand-designed section.
  Three sabotages, each red: no climb, capture on the press, no chrome guard.
- The record is `docs/design/REVIEW.md`, sprint 41 día 1b.
