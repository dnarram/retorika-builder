# 0087 — A section changes page, and is dragged where both show

**Status:** proposed · **Date:** 2026-11-26 · **Decided by:** David, 25 de noviembre de 2026, planning
sprint 41 «Estirar, agrandar y mover»: among what also enters the sprint he chose *«Secciones
arrastradas»* and, asked where, *«En los dos»* — «Páginas» and the canvas — with «a una página
existente», which until now did not exist. · **Recorded by development, with the standing note that
development does not sign.** · **Relates to:** [ADR 0022](0022-a-page-is-born-by-converting-a-section.md)
(a page is born by converting a section), [ADR 0040](0040-a-page-per-entry-is-drawn-not-stored.md) (a page drawn once per
entry), [ADR 0043](0043-the-menu-splits-in-two-and-the-owner-chooses.md) and [ADR 0057](0057-the-header-is-the-owners.md)
(the menu and the header's button follow a section) · **Touches:** `packages/schema` (a verb, no schema
change), `apps/editor`. A saved site does not change by a byte; a moved section is published where it
now is.

This ADR is written in parts. **Día 9** (this section) is the verb and the canvas's list; **días 10a and
11** add the drag in «Páginas» and on the canvas, as amendments below.

## Context

A section could leave its page in one way only: by becoming a page of its own (`sectionToPage`, ADR
0022), which leaves an avance behind. To put «Galería» on the page «Qué ponemos» already had, the owner
had to make a third page and fold it back — which lands the section where the avance was, on the wrong
page. `moveSection` moved a section within its page and nowhere else.

## Decision

1. **`moveSectionToPage(doc, sectionId, pageId, index?)`**, in `conversion.ts` beside the two verbs it
   lives between. The section keeps its id, its layout and its content and lands on the other page — at
   `index`, or last and before a footer that closes the page. One document, so **one step** and one
   «Deshacer». It leaves **no avance**: the owner chose where it goes, and the menu follows it.
2. **Refused rather than guessed**, as `sectionToPage` refuses: the cover, the footer and an avance stay
   on their page (the same three, for the same reasons); a page drawn once per entry, on either side, keeps
   its sections (they read an entry, ADR 0040); and the page it is on and a page that does not exist are
   errors. `pagesToMoveTo` asks the same questions, so the editor offers exactly what the verb accepts.
3. **Every link keeps going where it promised, both ways.** On the old page `#sec-x` becomes
   `./destino.html#sec-x`; on the new page `./origen.html#sec-x` becomes `#sec-x`; on any third page
   `./origen.html#sec-x` becomes `./destino.html#sec-x`; and inside the moved section an anchor to a
   section it left behind becomes `./origen.html#…`, while a link into its new page becomes a plain
   anchor. `listDeadDestinations` finds nothing the move did not find before. The header's button
   needs no rewriting: it names its destination by section id and the renderer builds the href.
4. **«A página» on the canvas.** While the site has no other page the section may go to, there is
   nothing to choose: the button makes a page as it always has, with its old name. Once there is, its
   name is «Llevar esta sección a otra página» and it opens a list — «A una página nueva» while the site
   has fewer than five pages, then «A «{page}»» for each page `pagesToMoveTo` returns. The list is the
   composition menu's chrome and keyboard: it opens on its first choice, the arrows walk it, Escape
   closes it on the button and writes nothing.

## Consequences

- A section can be carried to any ordinary page and back with the same verb, its links following.
- The button changes its name with the state of the site, and says the truth in both: it makes a page
  where that is the only thing it can do, and asks where it is otherwise. A list with one choice would
  have been one press more for every first conversion and the same answer.
- What is **not** here, by name: moving a section to a page per entry, or from one (refused by design,
  ADR 0040); the drag (días 10a and 11).

## Measured

`conversion.test.ts`: placement before the footer and at a clamped index; the three link rewrites and the
untouched link, with no dead destination; the six refusals; the offer equal to what the verb accepts;
there and back. `documentHistory.test.ts`: one step, one «Deshacer». A walk at 1280: «Qué ponemos»
converted with one press; on the gallery the button's name is the list's, Enter opens it on «A una
página nueva» beside «A «Qué ponemos»», Escape closes it on the button and nothing moves; choosing «A
«Qué ponemos»» keeps two tabs, takes the gallery off the home page and its menu entry, and the gallery is
on the other page; one «Deshacer» puts it back in both. **Sabotaged**: the old page's links not rewritten
and the moved section's own anchors not rewritten (two red each); the existing page's choice making a new
page (the walk red at the tab count).

## Amendment — the sections in «Páginas» (sprint 41 día 10a, 27 November 2026)

**Where both show.** «Páginas» lists every page, so it is the one place a section and the page it may
go to are in sight together. Each page now has «Secciones (n)», folded until asked so the panel stays
a list of pages; unfolded, each section is a row with its name — the owner's own word or the short name
of its kind — six dots, «Subir», «Bajar» and, where `pagesToMoveTo` offers any, «A otra página».

**Carried by its dots.** The dots take the `grab` cursor (and `grabbing` while carried) and
`touch-action: none`, so a finger on the phone's sheet carries the row rather than scrolling. While
carried the row is dimmed and a line marks the gap it would land in — the gap nearest the hand,
above any row or below a page's last (`gapAt`). Let go, it writes one step: `moveSection` within its
page, **the carried row counted out** below itself (the gap under the next row is one place down,
since `moveSection` takes the index the section ends at), or `moveSectionToPage` at that gap on
another page, held above a footer that closes it (`dropOf`). A gap on a page it may not go to draws
no line and writes nothing. Escape lets go writing nothing.

**The keyboard has the same answers** — the dots are a pointer's convenience and hidden from the
accessibility tree, as the alternative WCAG 2.5.7 asks for is the three buttons beside them, named
for their row («Subir «Galería»»). After a move the keyboard goes back to the row: to the verb
pressed while it still applies, otherwise to the row's first verb that does; a row sent to another
page unfolds that page and the keyboard lands there. The cover and the footer have no «A otra
página» (absent, not disabled), as the canvas has none for them.

**Also**: `editor.help.keys.grip` said «↑ ↓ mover la sección» on the grip that moves the text bar
(`textGripKeyAction`); it says «↑ ↓ mover esta barra · Esc: volver al texto». And the help line for
«Páginas» adds that sections are moved by their dots.

**Measured.** At 1280 with «Qué ponemos» made a page: «Secciones» folded on both pages; the home's
rows read in the canvas's order; the second row let go above the fifth ends fourth, in the panel and
the canvas; Escape while carrying draws no line and moves nothing; «Subir «…»» from the keyboard moves
it one up with the keyboard still on «Subir»; the cover offers no other page and the gallery does;
the gallery carried above «Qué ponemos» is first on that page and gone from the home's canvas; one
«Deshacer» brings it home; «Bajar» keeps the keyboard; «A otra página» → «A «Qué ponemos»» from the
keyboard lands the row on the other page with the keyboard on it. In a 390 × 844 window, the panel a
sheet, the third row carried above the second is second. **Sabotaged**: the carried row not counted
out (the unit test and the walk red); Escape ignored (red); the keyboard not given back — green for
«Subir» and «Bajar», because React keeps a focused row in the document when it reorders a list, and
red once the walk sent a row to another page, where it is a new element.
