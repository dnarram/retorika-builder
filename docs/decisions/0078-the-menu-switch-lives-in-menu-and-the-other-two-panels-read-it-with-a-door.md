# 0078 — The menu's switch lives in «Menú», and the other two panels read it with a door

**Status:** proposed · **Date:** 2026-11-18 · **Decided by:** David, 18 de noviembre de 2026, opening
sprint 39 — his answer A1 to the inventory's one true duplicate, with one condition: «donde estaba la
casilla queda una línea de lectura con su puerta. En «Páginas», por fila: «En el menú» / «Fuera del
menú» + «Cambiar», que abre «Menú» con el foco en la fila de esa página. En «Campos» igual para la
sección («En el menú se lee «X»» + «Cambiar»). Un solo control escribe, nadie pierde el estado de
vista, y el segundo paso es un clic que aterriza en el sitio exacto, con «Se lee como…» al lado. Las
notas «quedan {n}» se van con las casillas»; and his adjustment 1 approving the plan: «el foco no puede
caer en el vacío: va a la fila (tabindex -1) y su nota dice por qué no se cambia ahí». ·
**Recorded by development at his instruction, with the standing note that development does not sign.** ·
**Amends:** [ADR 0043](0043-the-menu-splits-in-two-and-the-owner-chooses.md) §3 and its
«Consequences» («a switch where the section's fields are, and one per row in «Páginas»») ·
**Relates to:** [ADR 0057](0057-the-header-is-the-owners.md) (the «Menú» panel, where the switch now
lives beside «Se lee como…»), [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md)
(a control that cannot do anything is worse than no control), [ADR 0071](0071-an-instruction-lives-in-the-help-line-and-never-over-the-page.md)
(a name is not an instruction) · **Touches:** `apps/editor` only. No schema, no renderer, no golden:
`inMenu` is read and written exactly as before, by one control instead of three.

## Context

Sprint 23 gave the owner the switch «aparece en el menú» in the two places the decision seemed to be
made: a section's fields and a page's row in «Páginas» (ADR 0043 §3). Sprint 30 gave the header its own
panel, «Menú», and drew the switch there too, beside «Se lee como…» (ADR 0057), noting «two places, one
verb, one state». The inventory of 18 November 2026 counted what that had become: **three visible
controls writing two keys** — the checkbox in «Páginas» and the row's checkbox in «Menú» both call
`setPageInMenu`; the checkbox in «Campos» and the row's checkbox in «Menú» both call `setSectionInMenu`
— and, beside the two that were not in «Menú», three sentences counting what the menu had left
(`menuState.ts`), a second module asking the renderer the questions `headerState.ts` already asked.

An owner who comes from Canva or Word asks «quiero que esta página no salga en el menú» and looks in
«Menú». The two other switches were where the page and the section are *managed*, not where the menu
is; and the sentence they carried — «En el menú quedan 2 secciones» — described a strip the owner could
not see from that panel.

## Decision

### 1. One switch, in «Menú»

A page's `inMenu` and a section's are switched in the «Menú» panel and nowhere else, in the row that
also holds «Se lee como…». ADR 0043 §3's «a switch where the section's fields are, and one per row in
«Páginas»» is withdrawn; what §3 decides — visibility only, absent means in, converting carries the
answer — stands.

### 2. The two other panels read it, in a line, and open the door

Where the checkbox was, «Páginas» and «Campos» draw a **line** and a **door**:

- the line says what «Menú» holds for that page or section — «En el menú», «Fuera del menú», for a
  section «En el menú se lee «Carta».» (the one thing an owner cannot otherwise see of a menu that
  writes itself); for the button's destination, «Está en el botón, así que no se repite en el menú»;
  and for a row that has no switch, **why**: «Inicio aparece cuando no estás en ella», «Es la portada»,
  «Una página por ficha no entra en el menú»;
- the door opens «Menú» with the keyboard on that row's switch. Its verb is **«Cambiar»** where a switch
  waits and **«Ver en «Menú»»** where only a reason does: a verb that promised a change the row cannot
  make would be the dead button this editor refuses.

Both read `headerStateFor`, the object «Menú» draws its rows from, so the line and the row cannot
disagree. The sentences that counted what the menu had left go with the checkboxes; what they said is
said once, under the switch, by the state «Menú» already drew — and a menu drawn under the threshold
because the owner curated says so there («Aparece porque lo has decidido tú», ADR 0043 §5's promise).

### 3. The door always lands on something

A row with a switch gives the keyboard to the switch. A row without one — Inicio, a page drawn per
entry, a cover, a footer, an avance, the section that opens its page — is focusable by script
(`tabindex="-1"`, never a Tab stop) and takes the focus itself, with its reason beside it. A focus that
fell on the document after a press that promised a place would be a keyboard user lost.

### 4. Nothing reachable in one step takes two without saying so

From «Páginas» or «Campos», switching now takes a press on the door and a press on the switch where it
took one press. David decided it with the condition above: the second step is one press that lands
exactly where the decision is made, with «Se lee como…» beside it, and the state is read without
leaving the panel.

## What this does not decide

- Where the focus goes when «Menú» is closed with its cross. Measured on the day: the button leaves with
  the panel and the focus falls on the document; the fixed rail does not take it back (backlog, sprint
  37). Written as it is, not changed.
- Whether «Campos» is the right name for the section's drawer (sprint 39 día 4 looks at every word).

## Consequences

- `apps/editor`: `MenuPanel` names each row (`data-menu-row`) and takes `focusBlock` for a page or a
  section as it took it for the brand (ADR 0070 §5); `PagesPanel` and `FieldsPanel` draw the line and the
  door and lose their switches; `menuState.ts` and fifteen locale keys go; `headerState.ts` gains
  `menuLineFor`, `rowReasonText` and the «decidido tú» status.
- `test/localeKeys.test.ts` holds every key of `es.json` to a reader, with the three keys nobody read
  before this day listed and not cleaned (David's adjustment 1: «el día 1 es solo el interruptor»).
- Notes in ADR 0043 and ADR 0057. The walks of sprint 23 días 3 and 4 switch through «Menú»; a new walk
  measures where the door lands, for a page with a switch, the page in the button, Inicio and the cover.
