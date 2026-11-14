# 0072 — The rail has two layouts, and the layout is the owner's, in this browser

**Status:** proposed · **Date:** 2026-11-13 · **Decided by:** David, 13 de noviembre de 2026,
planificando el sprint 37 — his request, in his words: «dar al usuario la posibilidad de personalizar
la barra de secciones (decidir si quiere que esta barra de secciones se muestre fija en el lado
izquierdo o si prefiere que se muestre como un menú radial […]). La imagen central nunca desaparece y
el menú no evita que el usuario pueda ver prácticamente todo el contenido del editor»; asked which bar,
his decision: «todo el raíl se vuelve radial, y lo hace con un modelo que no esconde nada»; and his
answers on the hub's place («en una franja propia de 56 px […] centrado en vertical en la franja y solo
el abanico abierto se dibuja sobre la página como cromo […]; al cerrarse no queda ni un píxel sobre el
lienzo»), on what opens it («el abanico abre tras 100 ms de puntero quieto sobre el eje, no al cruzarlo
[…] y gracia al salir (150 ms antes de plegarse) […]. Las dos cifras entran en motionBudget como
constantes con nombre»), on where the choice is kept («Solo en este navegador») and on the default («El
raíl fijo sigue siendo la opción por defecto y el radial es elección del dueño en este navegador»); and
his adjustment approving the plan: «la caja que se pulsa no viaja; viaja lo que se ve». · **Recorded by
development at his instruction, with the standing note that development does not sign.** ·
**Relates to:** [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) (§2–§4:
a setting of the person, outside the document, at the foot of the rail — the layout switch is its
twin), [ADR 0042](0042-the-application-fits-a-phone.md) (§2: the phone's rail is a bottom bar, which
this does not touch), [ADR 0052](0052-the-keyboard-enters-a-section-and-the-bar-acts-on-the-words-the-hand-chose.md)
(the rail is the editor's one `nav`, in both layouts), [ADR 0071](0071-an-instruction-lives-in-the-help-line-and-never-over-the-page.md)
(nothing of the menu is drawn over the page at rest). · **Touches:** `apps/editor` only — the editor's
shell. The published page does not change by a byte, and no golden moves.

## Context

The editor's rail is an 80 px column on the left of the canvas: «Secciones», «Estilo», «Páginas»,
«Menú», «Compartir», «Fotos», and «Diseño» and «Listas» while the design tools are on, with the
design-tools switch at its foot. «Secciones» is the canvas itself; every other item opens its panel
beside the canvas. On a phone it is a bar along the bottom (ADR 0042).

David asked for the owner to choose how the rail is shown: fixed, as it is, or a radial menu that
appears over the editor around a central «Secciones» that never disappears, without stopping the owner
from seeing practically all of the editor. The canvas is an `<iframe>`, and a pointer inside it is
heard by nobody in the editor's own document — so «the pointer approaches the left edge» cannot be
heard over the page; it can only be heard over something of the editor's.

## Decision

### 1. Two layouts, one rail, and the fixed one is the default

The rail has two layouts. **Fixed** is the rail as it was, and every editor opens in it until its owner
chooses otherwise. **Radial** is a strip 56 px wide where the rail was, and in its vertical middle
**the hub: the tool that is open** — its icon on the brand's tint and its word under it, ringed by one
dot per tool so that it reads as more than one button. The dots never move.

The radial menu adds no capability and removes none: the same tools open the same panels, beside the
canvas, as the fixed rail opens them. On a phone (≤ 720) neither the menu nor its switch is offered
and the rail is ADR 0042's bottom bar; widening the window brings back the layout the owner chose.

### 2. The fan opens on intent and folds with grace, by two named times

Resting the pointer on the hub for **100 ms** (`HUB_INTENT_MS`) within the drag's own threshold of where
it stopped — or pressing the hub — fans the rail's tools out to its right as pills on an arc, each with
its icon and its word. A pointer crossing the edge on its way elsewhere opens nothing. Pressing a pill
makes it the hub and opens its panel; pressing the hub again folds the fan, and a hand resting on it
after that press does not open it again until it has left. Leaving the strip and the fan folds it after
**150 ms** (`FAN_GRACE_MS`), so crossing the gap from the hub to a pill, or brushing past the arc, does
not. Both times are named constants of `editor/radialMenu.ts`, held under the interaction cap by
`test/motionBudget.test.ts`, and the shell times nothing with a number.

The fan is **open for a context**: the tool, the design tools and the device it was opened over. Any
of them changing — a panel closed by its own cross, the tools switched off, the canvas sent to the
phone view — closes it by construction, so a fan whose pills say something no longer true is never on
the screen.

### 3. Nothing of the menu is over the page at rest, and the open fan is bounded

The hub lives in the strip, which is the editor's chrome and not the page: **closed, the menu covers
not one pixel of the canvas**, and the strip gives the canvas the 24 px the rail took. Open, the fan is
chrome drawn over the page's left edge, **bounded by its hull**: a circle around the hub that just holds
the farthest pill, to which the fan's element is clipped. `clip-path` clips hit-testing too, so the page
beyond the arc stays under the pointer while the fan is open, and leaving the hull onto the canvas is a
`pointerleave` the editor hears. With six tools the fan is 276 × 261 px; with eight, 314 × 330 (the
pure module's numbers, asserted by its own test).

### 4. The box that is pressed never travels

Each pill is a `<button>` at its final place from its first frame; what will move (sprint 37 día 5) is
the face drawn inside it. A hand that already knows where «Estilo» lands is never early.

### 5. The choice is the owner's, in this browser, and nowhere else

`retorika.rail.v1` in `localStorage`, beside the design tools' and for their reasons (ADR 0025 §2–§3):
not a field of the stored session, not a word of the document, so switching it never reaches a save and
«Volver a empezar» does not change how the editor is laid out for the person using it. The fixed rail
leaves no key. The switch — «Menú radial», at the rail's foot under the design-tools switch, in both
layouts — says where it is kept («Se guarda en este navegador, no en tu cuenta»), and «No se recordará»
under its word only when the radial menu is on and this browser refused to keep it. An account column,
like `accounts.design_tools`, is named in the backlog and not built.

### 6. The switch of layout is seen

The rail switched away from fades where it stood (a copy, as a closing panel's is drawn) while the
other rises into place; the canvas takes its new room once. Under reduced motion it simply changes.

## What this does not decide

- ~~**The keyboard and the finger on the hub**~~ — decided on sprint 37 día 3; see the note below.
- **The second level** — the page's sections around «Secciones», and the way back to the tools — which
  is ADR 0073's (sprint 37 día 4).
- **How the fan moves**: the pills sprouting from the hub, the change of ring as a named scene. That is
  motion, which lives in REVIEW's budget (ADR 0015), not here.
- **Where the choice is kept beyond this browser.**

## Consequences

- `apps/editor/src/editor/railLayout.ts` and `radialMenu.ts` (new, pure, each with its test);
  `EditorShell.tsx` gains `RadialRail`, `RailLayoutSwitch` and `RailLeaves`; `leaving.ts` a `rail` kind;
  `Variants.tsx` holds the layout beside the design tools; six keys in `es.json`.
- **The fixed rail is 65 px taller** with the layout switch at its foot — 51 px of switch and the
  rail's 14 px gap, measured on 13 November 2026 at 1280 × 720 with the design tools on, where the
  rail's content went from 743 to 808 px in 662 of room: it scrolled 81 px to reach its last control
  and now scrolls 146. The plan had estimated 45. The backlog's row on the rail's height carries the
  numbers; the radial layout is itself the relief, its strip needing only the hub and the two
  switches.
- Day by day in `docs/design/REVIEW.md`, sprint 37.

## Note — the keyboard and the finger (14 November 2026, sprint 37 día 3)

David's rules of 13 November, as built: «teclado: enfocar el eje abre, flechas recorren el arco, Intro
elige, Escape pliega y devuelve el foco al eje; táctil por toque (uno abre, otro cierra); Alt+F10 y la
línea de ayuda siguen diciendo las teclas».

1. **The keyboard arriving on the hub opens the fan** — `:focus-visible`, so a press with the mouse,
   which also focuses the hub, does not open it twice. **A focus the code gives back never opens it**:
   a pill chosen, the fan folded by Escape, a panel closed all put the keyboard on the hub, and the
   hub is told so for the length of that focus (`focusQuietly`).
2. **The pills are one Tab stop**, the open tool's until an arrow moves it — ADR 0052's roving rule,
   once more. From the hub an arrow enters by the open tool, or opens the closed fan on it; ↑ ↓ ← →
   walk the arc and wrap at its ends, as a menu's do (`popupKeyAction`'s reason); Home and End go to
   the ends; Enter and Space press the pill, as a button is pressed; Escape folds and leaves the
   keyboard on the hub. Tab is never taken: **leaving the hub and its pills folds the fan** — Tab past
   the stop, Shift+Tab past the hub, a press anywhere else. All of it is one pure function,
   `fanKeyAction`, beside `popupKeyAction` in `sectionKeys.ts`.
3. **A finger never arms the intent**: a tap opens, a tap folds, a finger held on the hub opens it
   once. A tap on the canvas folds the fan by two roads, because browsers differ: Chromium gives a
   tapped button the focus, and the hub losing it is enough; Safari gives it none, and there the
   editor's window losing the focus to the canvas's frame is what is heard. Both are walked.
4. **In the radial layout a rail panel closes on Escape**, and however a panel closes — Escape, its
   cross, the pill «Secciones» — a keyboard left on the page's body comes back to the hub. Not an
   Escape typed in a field of the panel, which is the field's, nor one inside a dialog the panel
   opened. **The fixed rail keeps what it had** — no Escape on a rail panel, and the focus falls to the
   body when its cross is pressed — and aligning the two is named in the backlog, not done here.
5. **The help line says the hub's keys** while the keyboard is on the hub or a pill: «En el menú
   radial: ↑ ↓ recorrerlo · Intro: abrir la herramienta · Esc: cerrarlo» — `KeyboardPlace` «hub»,
   quiet like every key the line says (ADR 0071), and nothing on a touched screen. Alt+F10 keeps its
   one meaning, the text bar's; the hub is not the bar.
