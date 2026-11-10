# 0070 — The brand has its place in its line

**Status:** proposed · **Date:** 2026-11-10 · **Decided by:** David, 10 de noviembre de 2026,
planificando el sprint 35 — his second and third decisions, in his words: «Al principio, en medio o al
final de su línea» — `start` (today), `center` («la marca en el centro con el menú de páginas a su
izquierda y secciones/botón a su derecha, la composición «logo en medio» de 2026») and `end` («la marca
a la derecha, los menús a la izquierda»), «vale en los tres diseños; en «apilada» mueve la línea propia
de la marca», amending ADR 0060's refusal; and «Sí: arrastrar a zona y estirar el logo» — the brand
becomes a grip, amending ADR 0066. · **Recorded by development at his instruction, with the standing
note that development does not sign.** · **Amends:**
[ADR 0060](0060-each-menu-has-its-place-and-the-places-are-the-zones.md) («What this does not decide»:
«the brand and the button each with a place of their own: refused» — the brand now has one; the button
still does not), [ADR 0066](0066-a-menu-is-dragged-to-its-zone.md) (§: «the brand and the button are
still never grips» — the brand is one from sprint 35 día 6; the button still is not). · **Relates to:**
[ADR 0057](0057-the-header-is-the-owners.md) (§7, the three layouts, which stay),
[ADR 0069](0069-the-brand-has-a-size-in-the-systems-words.md) (the size, the same day and migration),
[ADR 0067](0067-the-bar-folds-where-its-words-do-not-fit.md) (the fold's line is additive and the place
does not change it). · **Touches:** `packages/schema` (1.19.0, migration `0020`), `packages/renderer`
(the bar's markup for «en medio», the stylesheet), the editor's «Menú» panel and canvas (días 5 and 6).

## Context

Where the brand sits was the layout's: at the start of the one line (`brand-left`), on the one centred
line (`centered`), or centred on a line of its own (`stacked`) — ADR 0057 §7. ADR 0060, giving each
menu its place, refused «the brand and the button each with a place of their own (four selectors)»,
because the checkbox «La marca y el botón van con el menú de páginas» covered the one case that mattered
then without opening 256 combinations. David's brief for sprint 35 asks for the brand's own place, and
the plan put the question to him with the cost named.

## Decision

### 1. Three words, in the brand's own line

`header.brand.place` is `start`, `center` or `end` — the same three words as the strip's `align`. The
line is the bar's one line in `brand-left` and `centered`, and the brand's own line in `stacked`.
**Absent is the layout's own place**: the start, or the centre of the stacked brand's line — derived by
the renderer where `align`'s default is derived, so no saved site moves. The attribute is written only
when the word is the owner's.

### 2. «En medio» on a one-line bar is between the pages' menu and the rest, in the document

A true centring (`1fr auto 1fr`) would need a wrapper around the sections and the button that the DOM
does not have and the canvas's patch does not know. Instead the pages' menu comes out of the strip and
stands bare before the brand, **in the document as on the screen**, and the brand takes the free space
either side of it: the order the eye reads — pages, brand, sections, button — is the order a keyboard
walks. The strip, with the sections alone, stays where it was. Costs named: a keyboard meets the pages
before the brand on that form; the rail's hide rules, the fold's estimate and the canvas's patch keys
read a bare `nav` beside the strip's. The fold's line is the same sum: the order of its items changes
no width.

### 3. «Al final» puts the brand after the strip and the button

By the stylesheet's `order`, with the free space before it: the menus keep to the start and the brand
is at the end, which is David's sentence. Under `end` and under `center` the strip's `align` is inert
— the free space is the brand's — and the panel will say so, as it says of `brandWithPages` where it
does nothing.

### 4. The phone keeps `end` and derives `center` to `start` (rule 7)

At the end, the brand stays at the right with «Menú» first, the ellipsis still its own. In the middle,
the bare pages' menu is hidden with the strip and the brand is first again: between a button and «Menú»
at 320, a brand centred by its two neighbours is off-centre by their widths and reads as a mistake.

### 5. The brand is a grip, the button is not (amends ADR 0066)

From sprint 35 día 6 the brand is dragged to the three zones of its line, as a menu is dragged to its
place (ADR 0066): past the threshold the zones are drawn, a drop writes the word, Escape writes nothing;
pressed without moving it keeps today's meaning — inert in the canvas, home on the published page. The
logo's edge stretches through the three sizes of ADR 0069 with a label saying which. The button stays as
ADR 0066 left it: never a grip. **No new key**: no menu is placed by keys in the canvas today, and the
brand's keyboard route is the panel's three segments, radios the arrows walk.

## What is preserved

The three layouts of ADR 0057 §7 and `brandWithPages` (ADR 0060 §4): a brand that went to a rail with
the pages has no place in the bar, and `place` is inert there, as `brandWithPages` is inert where the
pages are in the bar — a key that does nothing is not an error. The fold's bound (ADR 0067). The audit's
checks: the bare menu carries its `data-part`, so each menu is still announced once.

## What is lost, and it is named

The strip's `align` under `end` and `center`. And ADR 0060's reason for refusing a place — the
combinations — is paid in part: the a11y suite gains a twin of twelve documents rather than a
dimension of the matrix, and the menu audit does not change.

## What this does not decide

- **A true centring of the brand** on a one-line bar, which needs a wrapper node.
- **`center` on a phone**, derived to the start today.
- **A place for the button**, still refused as ADR 0060 refused it.
- **A keyboard chord** for the brand in the canvas.

## Consequences

Schema 1.19.0 shares migration `0020` with ADR 0069. `headerNodes` draws the bare pages' menu for
«en medio» on a one-line bar; `railCss` hides it where the pages stand in a rail; the phone hides it
with the strip. The editor's half is días 5 and 6 of sprint 35.
