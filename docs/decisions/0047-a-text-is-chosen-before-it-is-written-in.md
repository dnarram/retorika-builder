# 0047 — A text is chosen before it is written in

**Status:** proposed · **Date:** 2026-10-19 · **Decided by: David, 17 de octubre de 2026**, reviewing
the sprint 24 plan: *«El umbral de 3 px no separa mover de editar, porque seleccionar texto
arrastrando también supera 3 px. Define dos estados explícitos»* — together with the two mitigations
he required when approving it, and his instruction that **this change travels in its own pull request,
before the drag** · **Recorded by development, which does not sign** · **Relates to:**
[ADR 0027](0027-a-mark-moves-with-the-text-under-it.md) (the capture, untouched),
[ADR 0024](0024-formatting-inside-a-text-is-designed-and-waiting.md),
[ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md),
[ADR 0032](0032-typography-per-element-with-the-faces-that-travel.md),
[ADR 0040](0040-a-page-per-entry-is-drawn-not-stored.md) §5 (amended below) ·
**Touches:** `apps/editor`

## Context

**One gesture meant two things, and that is why the drag had nowhere to live.** Since sprint 2
`wireEditing` has set `contentEditable = "true"` on every `[data-id]` in the canvas the moment the
frame is wired. So a click placed a caret and a drag selected words — and David's fourth request for
this sprint is to *«mover cualquier elemento visual arrastrando con el ratón sin asas»*.

The plan's first answer was a 3-pixel threshold to tell a drag from a click. **He refused it with the
measurement that disproves it**: selecting text by dragging passes 3 px too, so the threshold
separates nothing. There is no gesture to spare while every text is permanently editable.

## Decision

### 1. Two explicit states, and the gesture into each one is named

| | Entered by | A drag | The arrows | Left by |
|---|---|---|---|---|
| **chosen** | one click, or Tab | will move the element (ADR 0048) | will move it a cell (ADR 0048) | Esc, or choosing another |
| **writing** | a second click, a double click, or Intro | selects text | move the caret | Esc, or Intro |

`Shift` with an arrow belongs to **writing**, where it extends the selection, and never moves the
element. Every modifier is refused, which is the rule `sectionKeyAction` already applies to the
canvas: a shortcut that fires on a superset of what it claims is how an editor eats a keystroke that
was not for it.

### 2. `contentEditable` stops being permanent

The attribute arrives when somebody starts writing and leaves when they stop. **Everything else it
was quietly doing is taken over explicitly**, because an attribute that carried four jobs loses all
four at once:

| What the attribute did | What does it now |
|---|---|
| made the text editable | `startWriting`, on the gesture that asks for it |
| **put the text in the tab order** | `tabindex="0"`, set where the attribute used to be |
| **carried the hover affordance** — the dashed outline that says «this can be changed» | the marker `data-rb-text`, which the stylesheet now selects |
| let `focusLineAfterChange` find the words in a line that had just appeared | the same marker |

The third row is the one worth naming: a page of texts with no sign that any of them can be changed
would have been a regression nothing in the suite measures.

### 3. The two mitigations, because the main audience is a pyme with no tutorials

Both are David's, required when approving the sprint — the states cost everybody one click more than
before, and that cost falls on somebody who was never told there are states:

- **A second click on the text already chosen starts writing**, at any speed. Two clicks of any kind
  arrive at writing, so the browser's own double click needs no handler: it *is* this sequence.
- **The chosen state says so on screen**, in the section's own chrome: «Doble clic o Intro para
  escribir». **The words are widened from the ones he gave** — «del tipo "Doble clic para
  escribir"» — because a keyboard reaches this state too, and a hint that named only the pointer
  would be the mirror of the handle this repository already refuses: an instruction that does not
  exist for somebody without a mouse. It is the chosen text's own `aria-describedby`, so a screen
  reader is told the same sentence the eye gets.

### 4. The keyboard is the same model, not a second one beside it

**Focus means chosen.** Arriving at a text by Tab chooses it, exactly as clicking does; Intro writes,
Escape puts the original words back, Escape again gives the keyboard to the section. The tab stops
are **the same ones as before today**, because a text was reachable by Tab precisely by being
editable.

What changes is what arriving means, and it is safer than what it replaces: Tab used to land
*inside* an editable field that selected all of itself, where one stray keystroke replaced a whole
heading.

### 5. Escape ends the edit without blurring

Until today Escape blurred, because being focused *was* being editable and there was no state to come
back to. There is now, so Escape stops the writing and leaves the text chosen and focused. Blurring
would strand the keyboard on the document body with the outline still drawn — for exactly the person
who cannot see where focus went.

### 6. What the editor tells an owner changes, and that is part of this decision

`editor.editHint` said **«Haz clic en cualquier texto para cambiarlo»** and now says **«Haz doble
clic»**. The old sentence was the product's own instruction and it became false today; changing the
behaviour and leaving the sentence would have been the interface promising something the code refuses
(`docs/design/REVIEW.md`'s own standing rule).

**This amends [ADR 0040](0040-a-page-per-entry-is-drawn-not-stored.md) §5** in one clause. That
decision unwraps a card's title link in the canvas so «the click edits»; the click now chooses and
the second one edits. The reason the anchor is unwrapped is untouched — an `<a>` inside a
`contentEditable` is a caret trap, measured — and so is everything else in §5.

## Three things only a browser could say

Each of these was found by the walk going red, and each would have shipped:

1. **A focusable element is focused on `mousedown`, before `click`.** Arriving at a text chooses it,
   so by the time the click ran the text was already chosen and *every first click looked like a
   second one*: one click went straight to writing and the first state was unreachable. The gesture
   is now judged by what was chosen when it **started**, read at `pointerdown`.
2. **Entering writing from a text that already has focus fires no `focus` event.** The capture and
   the select-all lived in that listener, so neither ran: typing would have appended to a heading
   instead of replacing it, and ADR 0027's marks would have been read from a text that had already
   moved. Both paths now call `beginWriting` explicitly.
3. **Taking `contenteditable` off the focused element drops focus to the body**, and the blur that
   follows was re-drawing «chosen» — so releasing the choice put the outline straight back. Stopping
   writing now does one thing only, and each caller re-draws what it needs.

## What is preserved

- **ADR 0027's capture, exactly.** `beforeinput`, the anchored offsets, the fallback to the diff, the
  commit on blur, the non-breaking spaces, the bound-entry destination: untouched. What changed is
  *when the attribute exists*, not what happens while it does.
- **One history step per edit**, and `alreadySays`.
- **The floating toolbar** opens on a chosen text and stays through the rebuild, as it did.
- **A new line is written in immediately.** Somebody who just pressed «Añadir» is about to type;
  charging them a second click for a line the editor itself put there would be the states billing for
  a choice nobody made.
- **Paste is still forced to plain text**, and a link or button still refuses to be emptied.

## What is lost, and it is named rather than glossed

- **One click more to write, for everybody.** That is the price of having a gesture left for the
  drag, and the two mitigations are what keep it from being a wall.
- **Eighteen walks rewritten by hand**, plus sixteen that clicked the editor's own instruction by its
  words. Counted in the pull request, which is why this change travels alone.
- **The hover affordance now hangs on a marker**, so a text that somehow lost `data-rb-text` would
  look inert rather than editable. It is set in the same loop that wires the editing, so there is no
  path where one exists without the other.

## What this does not decide

- **The drag.** Dropping, the grid snap, what «occupied» means and what happens at the ends are
  ADR 0048, the next day. The arrows are left alone today precisely because they are its.
- **Touch.** A long press and `touch-action` are two days away, with the mobile semantics.
- **Whether Tab should walk a section's insides before the section is chosen.** Open in
  `docs/tasks/backlog.md` since sprint 19. This day neither answers it nor makes it worse — the stops
  are the same ones — and from here they can be taken away in one line.

## Consequences

- `apps/editor/src/editor/twoStates.ts` (new): the judgement — which press means what, and when a
  click writes instead of choosing.
- `apps/editor/src/questionnaire/Editor.tsx`: `markChosen`, `startWriting`, `stopWriting`, the
  `pointerdown`/`click` pair, the keys through `textKeyAction`, `beginWriting`, the restoration after
  a rebuild, `focusLineAfterChange`, and the canvas stylesheet's three looks — dashed on hover, solid
  when chosen, solid with a caret when writing.
- `apps/editor/src/locales/es.json`: the hint, and the corrected instruction.
- The e2e: two walks for the model itself, one with the pointer and one with the keyboard alone;
  `clickToEdit` now asserts both states on the way in; `editHint` is one helper where sixteen
  locators used to spell a sentence.
- The record is `docs/design/REVIEW.md`, sprint 24.
