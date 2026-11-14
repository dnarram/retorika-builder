# 0073 — The hub is the open tool, and «Secciones» has a second level

**Status:** proposed · **Date:** 2026-11-14 · **Decided by:** David, 13 de noviembre de 2026,
planificando el sprint 37 — his model for the radial rail, in his words: «El eje es la herramienta
activa. […] Secciones tiene segundo nivel. Con «Secciones» como eje, pasar sobre él no despliega las
herramientas sino las secciones de la página (tope 8, segundo arco hasta 16, la web de 12 como sujeto):
pasar resalta la sección en el lienzo, pulsar la elige y la lleva a la vista; el último radio es
«Herramientas», que gira el abanico de vuelta al primer anillo. Los dos anillos nunca conviven»; and
his answer on the arcs: «Hasta 8 secciones en un arco; de 9 a 16, un segundo arco a radio mayor (+56 px)
[…]; más de 16 no cabe y el control lo dice […], sin ofrecer el radial». · **Recorded by development at
his instruction, with the standing note that development does not sign.** · **Relates to:**
[ADR 0072](0072-the-rail-has-two-layouts-and-the-layout-is-the-owners-in-this-browser.md) (the radial
rail this is the second level of), [ADR 0052](0052-the-keyboard-enters-a-section-and-the-bar-acts-on-the-words-the-hand-chose.md)
(choosing a section leaves the keyboard where ↑ ↓ and Intro would), [ADR 0071](0071-an-instruction-lives-in-the-help-line-and-never-over-the-page.md)
(the pointing is chrome, not an instruction). · **Touches:** `apps/editor` only. The published page does
not change by a byte, and no golden moves.

## Context

ADR 0072 made the hub of the radial rail the tool that is open, and its fan the rail's tools. The fixed
rail's «Secciones» opens no panel — it *is* the canvas — so in the radial rail it was the one tool whose
pill did nothing a glance at the canvas did not. David's model gives it what the canvas cannot: a list
of the page's sections, around the hub, to see, point at and go to.

## Decision

### 1. With «Secciones» as the hub, the fan is the page's sections

Opening the fan — by intent, by focus, by a press, by a tap, as ADR 0072 has it — while «Secciones» is
the hub shows **the open page's sections**, in the page's order, by the names the catalog gives them, and
**«Herramientas»** as the last pill. With any other tool as the hub, the fan is the tools, as before.

### 2. Eight on one arc, sixteen on two, and none above

Up to eight sections and «Herramientas» share one arc. **From nine, two arcs**: the first eight sections
on an inner arc and the rest, with «Herramientas», on an outer arc **56 px further out**. The outer arc
keeps the inner one's rows — its pills sit at the heights of the inner arc's bottom rows — so each outer
pill shares its height with one inner pill and no other, and **«Herramientas» is the last pill and the
lowest**. The inner pills are 96 px wide and sit on their arc by their middle: that is what the 56 px
leave between an inner pill and the outer one beside it. The outer pills are 150 px. A name too long for
its pill is cut, and said whole in the pill's `title` and in its accessible name, which also says which
of how many it is («Portada, sección 3 de 12»: two sections can share a name). **Above sixteen sections
the ring is not offered**: the fan opens on the tools, and the «Menú radial» switch's `title` says why.

Measured from the module, which a test holds to its own properties rather than to these numbers: twelve
sections give a fan of 360 × 266 px; sixteen, 360 × 300. Every count from one to sixteen fits the
shortest studio row (542 px, a 1024 × 600 window), with no two pills closer than their gap.

### 3. Pointing draws the section in the canvas, as chrome

The pointer on a section's pill, or the keyboard on it, outlines that section in the canvas **dashed** —
«you could», the pair the texts already use with the chosen section's solid «this is it». It is a class
on the frame's section, never a patch: the document's edit serial does not move, and the redraw after
anything that rebuilds the section draws it again. One section at a time; none when the fan folds or
shows the tools.

### 4. Pressing a section's pill goes to it and chooses it

The path a section entry of the header's own menu already takes in the canvas (sprint 30 día 3): the
canvas scrolls the section to its top and chooses it, and **the keyboard is left on the section**, where ↑ ↓ and Intro would have left it, so
the next arrow moves from there. The fan folds. Nothing is edited.

### 5. «Herramientas» turns the fan back to the tools; the rings never share it

Pressing «Herramientas» shows the tools in the same fan; a keyboard that pressed it lands on the open
tool's pill. From the tools there is no pill back to the sections: choosing «Secciones» makes it the
hub, and opening the hub again shows the sections. **The two rings are never on the screen together.**
How one becomes the other is motion, which REVIEW's budget holds (ADR 0015): a scene of its own from
sprint 37 día 5.

### 6. The fan folds when what it says changes

Opened for the tool, the design tools and the device (ADR 0072), it is now also opened for **the page
and its sections**: another page, a section added, removed or moved, and an open fan is closed by
construction, so its pills never name sections that are not where they say.

## What this does not decide

- **Which section the keyboard enters the ring by.** The first, today; the chosen one would be kinder,
  and the shell does not know which it is.
- **A third level.** A section's own elements are the canvas's, as they always were.
- **The motion of the change of ring** (sprint 37 día 5, REVIEW).

## Consequences

- `radialMenu.ts` places both rings with one function (`fanOf`); the tools ring is unchanged to the
  pixel. `sectionsRing` is new, with its test on the page of twelve and every count to sixteen.
- `Editor.tsx` gives the shell the page's sections and draws the pointing (`rb-pointed`, one rule in
  the canvas's sheet); `EditorShell`'s `RadialRail` shows the ring the hub calls for.
- Four keys in `es.json`. Notes in ADR 0052 (the keyboard after a section is chosen from the rail) and
  ADR 0071 (the fan is a control, not an instruction).
- Day by day in `docs/design/REVIEW.md`, sprint 37.
