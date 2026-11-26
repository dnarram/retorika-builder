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
