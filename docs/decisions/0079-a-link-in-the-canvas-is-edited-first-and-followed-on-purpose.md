# 0079 — A link in the canvas is edited first, and followed on purpose

**Status:** proposed · **Date:** 2026-11-20 · **Decided by:** David, 20 de noviembre de 2026,
planning sprint 40 — his answer to encargo 4 («Los enlaces se editan»), option 1 with two conditions:
*«Dentro de una sección, clic edita; probar va aparte: 1.er clic elige, 2.º escribe, como con tel:. La
barra de texto gana un destino con lista de páginas y secciones en vez de texto libre, y un botón «Ir»
que lleva el lienzo; Ctrl/Cmd+Intro también va. El menú de la cabecera sigue navegando (ADR 0066) y se
edita en «Menú». Además, el botón de la barra deja de navegar al pulsarlo, como dice ADR 0066 §1, y la
caminata e2e :1562 gana un botón que apunta a ./pagina.html para que vea el defecto»*; and, asked
whether the brand follows the same sentence of ADR 0066 §1: *«Sí, la marca elige la cabecera»*. ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** · **Amends:** [ADR 0066](0066-a-menu-is-dragged-to-its-zone.md) §1 (the code catches up with
it), [ADR 0060](0060-each-menu-has-its-place-and-the-places-are-the-zones.md) (what a header link does
in the canvas, for the button), the sprint 30 día 3 reading of ADR 0057 («a button is a header link
like any other to the canvas») · **Relates to:** [ADR 0047](0047-a-text-is-chosen-before-it-is-written-in.md)
(the two states this rests on), [ADR 0040](0040-a-page-per-entry-is-drawn-not-stored.md) (a card's
title link is unwrapped; a hand-typed link to a ficha), [ADR 0071](0071-an-instruction-lives-in-the-help-line-and-never-over-the-page.md)
(where the key is named), [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md)
(absent, not disabled) · **Touches:** `apps/editor` only. **No golden moves; the published site is
untouched.**

## Context

The canvas has cancelled every real navigation of its frame since sprint 5, when a menu entry nested
an editor inside the editor. What a click on a link *did* instead was decided from **where the link
went**: `wireLinks` asked `canvasLinkTarget` for the destination, and a page, a ficha, or a section of
another page moved the canvas there — wherever the link sat. The one exception was written as a
guard rather than as a rule: a `#sec-x` on the same page, outside the header, did nothing, «because an
owner's own button inside a section is pressed to edit its words» (sprint 30 día 3).

That sentence was the rule, and it was true of one case. A button an owner had pointed at a page, a
button «A página» had rewritten from `#sec-x` to `./carta.html` (`conversion.ts`), and every avance's
«Ver más» — all links inside a section that point at a page — took the owner to that page on the first
click, before the second click that writes (ADR 0047). The owner's words: «al intentar editar un enlace
en el lienzo, me lleva a la página y no puedo editarlo». The walk that guards «a link's label can still
be edited» used the contact section's `tel:` button and never saw it.

Two more things did not match their own record. ADR 0066 §1 wrote «the brand and the button keep
choosing the header», and the header's click handler skipped every `<a>` — so the bar's button and the
brand on any page but the first fell to `wireLinks` and navigated like an entry. And the one control
the text bar had for a link, «Enlace», opened «Campos» on the whole section, where the destination was
a free text box.

## Decision

### 1. Inside a section, a click on a link edits it — whatever it points at

`canvasLinkPress` (`apps/editor/src/editor/canvasLinks.ts`) decides by **where the link is**, and
`wireLinks` only executes. Inside a section the answer is `edit`: the click is the two states' —
the first chooses, the second writes — exactly as a `tel:` button already behaved. The destination
does not enter into it: a page, a ficha, a section, a phone, the outside.

The frame still never navigates (`preventDefault` stays, and the regression walk of sprint 5 still
waits for the navigation that must not come).

### 2. Going where a link leads is a press of its own: «Ir», and Ctrl/Cmd+Intro

The text bar of a button or a link gains **«A dónde lleva»** where «Enlace» stood: a `<select>` of
the site's own places — the sections of this page («En esta página») and the other pages («Otras
páginas»), written as the renderer writes them (`#sec-x`, `./slug.html`, `./index.html` for the first
page) so the document never learns a second form — and the door to «Campos» for what is typed free
(«Un teléfono, un correo o un enlace de fuera…»), which keeps `listDeadDestinations` with one source to
chase. When the link points at none of the options, a disabled option shows what it points at, so the
box never claims a page it is not on (the measures' own `exact` pattern). Choosing writes the href
through `fillSlot`, one step of history, with the words the document holds at that moment.

Beside it, **«Ir»** takes the canvas where the link leads — the page, the ficha, or the section,
through the same `goToDestination` a header entry uses — and only where there is somewhere in the
site to go; for the outside (`http`, `https`) the button is **«Abrir»**, a new tab; for a phone or an
address there is neither: absent, not disabled (ADR 0025). From the keyboard, **Ctrl+Intro or
Cmd+Intro on a chosen link** goes there (`textKeyAction`, the one modified press that module takes;
Intro alone writes, as it did), and the help line names the key by the machine, between «escribir» and
«moverlo» (ADR 0052 §3, ADR 0071) — and names none on a touched screen, where the bar's «Ir» is the
way there.

### 3. The header's button and its brand choose the header

As ADR 0066 §1 wrote. Both are links, and both now reach `selectHeader` through `wireLinks`: the
header is chosen, «Menú» opens — where the button's destination («Botón destacado») and the brand are
shaped — and the frame neither navigates nor scrolls. The brand on the first page is no link and
chose the header already. A double click on the brand still opens «Menú» at the brand's block (ADR
0070 §5).

What this changes for sprint 30 día 3's walk: pressing «Reservar» no longer takes the canvas to the
contact section; the sections menu's entries do, as they always did.

### 4. A header entry follows

The menu in the preview is the one place where a click is navigation the owner means: an entry takes
the canvas to its page or its section (ADR 0060, ADR 0066), «Menú» is where its words are edited, and
the help line says so while «Menú» is open. Unchanged.

## What is preserved

- **ADR 0047's two states** on every text, links included; Intro writes.
- **ADR 0040**: a card's title link is unwrapped before it is editable; a hand-typed link to a ficha
  is edited like any other link inside a section, and «Ir» moves the canvas to the ficha.
- **The frame never navigates** (sprint 5), asserted as before.
- **One source for destinations** (`listDeadDestinations`): the bar writes the renderer's own forms,
  and the free box stays in «Campos».
- **The published site, byte for byte**: `apps/editor` only.

## What is lost, and it is named

- **One click less to a page from a section's button.** Going where a link leads is now one press
  more («Ir», or the modified Intro). The entries of the menu keep the one-click way.
- **«Reservar» as a shortcut to the contact section in the canvas.** It chooses the header instead;
  the sections menu entry does what the button did, when the section is in the menu.
- **The word «Enlace» in the bar**, and its key.

## What this does not decide

- **Links inside a text** (`MARKS` are `strong` and `em`): no inline anchor exists in the model.
- **A page picker in «Campos»**: the panel keeps its free text box with the dead-link check.
- **Entries edited in the canvas**: a header entry's words are «Menú»'s.

## Consequences

- `apps/editor/src/editor/canvasLinks.ts`: `LinkPlace`, `CanvasLinkPress`, `canvasLinkPress`,
  `opensOutside`. `twoStates.ts`: `go`. `textToolbar.ts`: `destination` for `link`. `helpLine.ts`:
  `chosen.goes`, `chosenHint(chosen, platform)`. `Editor.tsx`: `goToDestination` shared by
  `wireLinks`, «Ir» and the keyboard; `selectHeaderNow`; the «A dónde lleva» group. `es.json`: seven
  keys in, one out.
- Tests: `canvasLinks.test.ts`, `twoStates.test.ts`, `textToolbar.test.ts`, `helpLine.test.ts`; e2e:
  the converting describe gains three walks (a `./pagina.html` link edited with two clicks and the
  canvas staying; «Ir» and Ctrl/Cmd+Intro; the button and the brand choosing the header), and sprint
  30 día 3's step 1 reads the new behaviour.
- The record is `docs/design/REVIEW.md`, sprint 40 día 2, with the bar captured before and after.

## Amendment — a destination typed without its scheme (sprint 42 día 1, 28 November 2026)

**What was measured.** «612 345 678» typed into «A dónde lleva» was stored as written and published as
`href="612 345 678"`: from `file://` the visitor landed on `…/612 345 678`. Nothing warned in «Campos»
and the download passed, because `isDead` held that «everything else is never dead» and bare relative
paths were «a shape nothing in this repository emits» — which «Campos» has emitted since sprint 3 día 4.
And a destination the gate did catch (`#nada`) reached the owner as the server's 400 read as a network
error: «No se ha podido descargar. Vuelve a intentarlo».

**What is decided**, under David's adjustment 1 of the sprint 42 plan:

1. **The dead list is closed**: empty, `#`, `javascript:`, `data:`, `vbscript:`, `file:`, a scheme with
   nothing after the colon, an anchor or a bundle link that does not resolve, and a bare relative path.
   Every other scheme with something behind it lives (`geo:`, `whatsapp:`, `tg:`, `facetime:`, `sms:`,
   `https:`…): the gate cannot resolve them and must not block a download that works. On the corpus the
   new list changes the verdict of nothing but `xss-attempt`'s two `javascript:` buttons, and a test
   fixes that count.
2. **Three shapes are read, and no more** (`normaliseDestination`): digits → `tel:` with the leading `+`
   kept and no country code invented; one `@` → `mailto:`; `dominio.tld` → `https://`. «Campos» writes
   the normalised href as the owner types; what is not read is kept as typed and the row says it leads
   nowhere.
3. **The gate says it before the request**, third among the blocks (`deadDestinations`), with each
   button's words, its section and page, and what it leads to. What the schema reads is offered as
   **«Arreglarlos»**: one `fixDestinations` step of history across every section, after which the gate
   runs again on the fixed document. What it cannot read has «Ir a «Campos»», which opens the drawer
   with the keyboard in that link's box. No «Descargar igualmente»: the route would refuse.
4. **A 400 is said as a refusal of the document**, never as the network: the route names the one
   refusal the owner can meet in an `X-Retorika-Refusal` header, and the help line says «la web tiene un
   botón que no lleva a ningún sitio» for it and «no es un fallo de la conexión» for the rest. «Vuelve a
   intentarlo» stays for 5xx and a failed fetch.
5. **A hidden link never counts** — it already did not; now a test asserts it, because day 5's «Quitar
   esos enlaces» hides links and must leave the download open.

**What this does not decide:** a closed vocabulary of destinations in the box (WhatsApp, SMS, a new tab,
a file) — sprint 42 día 6, ADR 0089; the header's button, whose href the renderer derives; a plain-words
rendering of a stored `tel:` in the box (the box shows the href that will be published).
