# 0071 — An instruction lives in the help line, and never over the page

**Status:** proposed · **Date:** 2026-11-11 · **Decided by:** David, 11 de noviembre de 2026,
planificando el sprint 36 — his rule, in his words: «los textos con instrucciones, sin importar si está
en modo escritorio o en modo móvil, no deben cubrir la página a ser editada»; his answer on where the
line goes («al pie del área del lienzo, como barra de estado»; on a phone above the card) with three
conditions (fixed 32 px and one line with an ellipsis so a message never moves the canvas; the one
`aria-live="polite"` region of instructions, where `announce` writes; download errors stay dialogs — the
line informs, it does not block); his answer on the notes inside the popups («Aspecto» and the «A mano»
offer to the line; the text bar keeps a two-character badge with the sentence as its name); and his
adjustment approving the plan: two children, a live one and a quiet one. · **Recorded by development
at his instruction, with the standing note that development does not sign.** · **Amends:**
[ADR 0042](0042-the-application-fits-a-phone.md) (§2's table: «the toast clears the bottom bar; the key
legend is not drawn where there is no keyboard» — the toast is the line now, and the legend is the
line's contextual keys), [ADR 0052](0052-the-keyboard-enters-a-section-and-the-bar-acts-on-the-words-the-hand-chose.md)
(§7: the key legend `.rb-keys` drawn in the frame's corner — said by the line instead). ·
**Relates to:** [ADR 0049](0049-the-arrows-move-it-and-say-so-and-one-finger-still-scrolls.md) (the
announce region outside the canvas, which the line's live child now is), [ADR 0053](0053-chrome-is-drawn-in-screen-pixels-and-an-element-too-small-on-screen-keeps-its-corners.md)
(the chrome drawn inside the frame, which no longer includes a word of instruction), [ADR 0014] (the
delete notice and its undo, whose lifetime does not change), [ADR 0066](0066-a-menu-is-dragged-to-its-zone.md)
(the drop zones, whose names stay where they are). · **Touches:** `apps/editor` only — the editor's shell
and canvas chrome. The published page does not change by a byte, and no golden moves.

## Context

The editor had grown eight ways of telling the person what to do, and six of them were drawn over the
page being edited: the key legend fixed in the frame's corner (`.rb-keys`, ADR 0052 §7), the chosen
text's «Doble clic o Intro para escribir» at the foot of its section (`.rb-hint`, ADR 0049, drawn on a
phone too), «Arrastra arriba o abajo para cambiar el orden» across the row a phone's finger was moving,
the note inside the «Aspecto» menu, the explanation inside the «A mano» offer, and «Este texto aparece
en {n} sitios» inside the text bar; and, outside the frame but fixed over the card, the delete notice
with its «Deshacer». A seventh — the strip «Haz doble clic en cualquier texto…» — sat in the flow at
the top of the card, covering nothing but scaling with the zoom and taking 187 px of a 320 × 568 phone's
page. No guard measured any of them against the page, and none measured anything on a phone.

David's rule for sprint 36 names the defect: a line of advice over the page is drawn over the thing
it is advising about. The place for it is the chrome.

## Decision

### 1. One row, outside the card, in the two places the card is not

The help line is a row of the editor's chrome, **32 px tall, fixed**, drawn by the shell at the foot of
the canvas area on a desktop — a status bar, the pattern of the tools people already know — and above
the card on a phone, where the foot of the screen is the rail's and the sheet's. It is a child of the
column that holds the canvas area, so its height comes out of the area's and the card is laid out that
much shorter; it is never positioned over the card, at any width. Its text is **one line with an
ellipsis** and the whole sentence in `title`, so a message that changes cannot move the canvas by a
pixel (David's condition). The e2e asserts this at 320, 390, 768, 1024 and 1280: the line's box and the
card's never intersect, the line measures 32 in every state, and the card's box is the same before and
after each message.

### 2. Every instruction is said there, and the frame draws none

What moved, and what the frame keeps in its place:

| Was | Is |
|---|---|
| `.rb-keys`, eight lines fixed in the corner from a section's first focus until Escape | the keys of **the place the focus is in now** — the section's, the text bar's, its grip's, the text being written in — read from the frame's own focus events; nothing where the place has no keys of its own; none on a touched screen |
| `.rb-hint` at the section's foot, also on a phone | the sentence in the line; in the frame only an `sr-only` description for the chosen element's `aria-describedby`, which cannot point across documents — the same function writes both, so they cannot disagree |
| the words in the refused drag's ghost | the ghost, red and wordless; the line says the sentence while it is drawn |
| the note under the «Aspecto» choices | the line, while the menu is open; the menu keeps its choices |
| the explanation in the «A mano» offer | the line, while the offer is open; the offer keeps its question and its two answers |
| `.rb-toolbar-notice`, a full line of the text bar | a badge of two characters in the bar — «×3» for «aparece en 3 sitios», «≡» for «viene de la lista» — with the whole sentence as its name and `title`; the line says it in full while the bar is open |
| the delete notice, `fixed` over the card | the line's live voice, with «Deshacer» and the cross beside it; it still arrives rising and leaves as a copy sinking (sprint 35 día 2), and its lifetime is ADR 0014's as before |
| the strip at the top of the card | the line's text at rest; the card has its height back |

The drop zones (ADR 0066) keep their names: a zone's name says what the zone is, as a button's label
says what the button does; it is not an instruction. A test holds the editor and the shell to reading
none of the instruction keys — they are read by `helpLine.ts` and `HelpLine.tsx` and nowhere else —
so that the one way an instruction could be drawn over the page again is closed at the source.

### 3. Two voices, and a closed priority

The line has two children, both always in the page. The **live** one (`role="status"
aria-live="polite" aria-atomic="true"`) carries what the person did not see coming: a move's
announcement (`announce`, ADR 0049 — its invisible `sr-only` region is gone; this is the one live
region of instructions the editor has), the delete notice, a download refusal or a photograph's
error. The **quiet** one (`aria-live="off"`) carries what changes with the focus — the idle
sentence, the keys, the chosen element's hint, a popup's note, the bound text's sentence, the count of
example texts left — which already reaches a screen reader by its own path and would be a reader
talking without pause if it were live (David's adjustment). The live child is shown while it has text;
the quiet one is hidden under it, not emptied. A pure function (`helpLineFor`) picks each child's text
from the editor's state by a closed priority: live — a fresh announcement (four seconds) over the
notice over an error; quiet — the refused drag over the keys of a control (a section, the bar, its
grip) over a popup's note over the bound text's sentence over the keys of a text being written (the
sentence is what has to be read before the first keystroke) over the chosen hint over the example-text
count over rest. The unit test is the table, and
the walk asserts that choosing a text, five Tabs and opening a menu leave the live child untouched
while deleting a section changes it.

### 4. The canvas is read, not asked

The popups, the refused drag and the bound bar are chrome drawn by a dozen places in the canvas
wiring, each able to open or close them. Rather than have each remember to tell the line, one
`MutationObserver` on the frame's body reads whether they are there and the line says the words; the
keyboard's place comes from the frame's focus events and the chosen element from the one function that
marks it. The observer writes through a setter that drops a read that changed nothing, so firing on
every patch is not a render on every patch.

## What this does not decide

- **The one live region still inside the frame**: the section's name said when it is chosen («Qué
  hago: elegida», `.rb-announce`, ADR 0049), which is the focused document's own state rather than an
  instruction and is invisible. Whether it too should be the line's is David's to say; the walk that
  counts the frame's live regions at one stays as it was.
- **A phone with a sheet open at 320 × 568**: the sheet, capped at 70 % of the viewport (ADR 0042),
  reaches above the line there, as it reaches over the canvas; at 390 × 844 the line stays in view
  above it, and the walk asserts that width. The sheet is a panel, not an instruction, and its cap is
  ADR 0042's.
- **Any motion of the line**: today its text changes without a transition. What arrives through the
  live child will reveal by words and what changes in the quiet one will cross-fade, under sprint 36's
  motion budget, and that is REVIEW's to record (ADR 0015), not this ADR's.
- **The glyph «≡»** for a text that comes from a list: two characters was David's; which two was
  development's, and is one pull request from changing.

**Still `proposed`.** This ADR until David signs it.
