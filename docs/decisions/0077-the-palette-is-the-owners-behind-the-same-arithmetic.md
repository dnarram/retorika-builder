# 0077 — The palette is the owner's: their own and retouched, behind the same arithmetic

**Status:** proposed · **Date:** 2026-11-17 · **Decided by:** David, 16 de noviembre de 2026, opening
sprint 38 — his points 3 and 4, a palette of the owner's own without a logo and a predefined palette
retouched without losing the rest; his answer P6, «lo inválido no nace», with two conditions: «el tope se
ve antes de tocarlo (la pista del deslizador pinta la zona que no se alcanza, rayada o atenuada, con title
«Por aquí deja de leerse sobre {par}»), para que un deslizador que se para no parezca roto; y un arrastre
del deslizador es un solo paso de historia al soltar, no uno por fotograma (Deshacer devuelve el color de
antes del gesto). Teclado: flechas mueven el tono en pasos fijos dentro del rango, Inicio/Fin a los
extremos legibles»; and P5, left to the plan in his words («decide tú»): one colour is enough. ·
**Recorded by development at his instruction, with the standing note that development does not sign.** ·
**Amends:** `docs/design/REVIEW.md` («Not implemented, and not planned: mockup 13's «Avanzado: colores
exactos y tamaños»») and [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md) ·
**Relates to:** [ADR 0074](0074-the-fill-keeps-the-brands-colour-and-the-text-takes-its-sibling.md) (the
fill and its ink), [ADR 0075](0075-the-palette-keeps-its-origin-and-the-label-is-computed.md) (the origin
and the computed label), [ADR 0076](0076-the-logos-colours-are-the-sites.md) (the logo's palette and the
gate that judges the theme) · **Touches:** `apps/editor` only. No schema, no renderer, no golden: a theme
moved by hand is six colours and an origin, which 1.20.0 already holds.

## Context

Until sprint 38 an owner's colours were one of the predefined palettes, picked whole. A colour picker was
refused in writing since sprint 6 — «a palette that is not contrast-tested cannot ship»; a picker is «a
machine for producing exactly that» — and ADR 0026 kept that refusal when it admitted the exact value
behind the design tools. Sprint 38 día 2 built the arithmetic the refusal was waiting for:
`validateTheme`, which judges every pair a palette is held to, the fixed bar's glass included, and
`legibleSteps`, which says for one colour which lightnesses and hues keep every pair it is part of
readable. Día 3 made the download gate judge the theme.

## Decision

### 1. Every colour of the chosen palette can be moved, and nothing unreadable can be written

The colours the page paints with — the fill when the palette has one, the primary, the secondary, the
grey, the ground and the text — each open a field from «Cambiar» in «Estilo». The accent is in no pair and
no rule reads it, so it is not offered. The fill's ink is never edited: it is recomputed, black or white
or the palette's own, whichever reads on the fill, and the field says so.

### 2. Two sliders that cannot reach what breaks a pair, with the stop painted

Lightness (0–100) and hue (0–355 in fives), in OKLCH, from the colour the gesture started on. A slider
stands only on steps that keep every pair the colour is part of at 4.5:1; **the steps it cannot reach are
striped on its track before the hand gets there**, and over each run a strip carries the title — «Por aquí
deja de leerse sobre el fondo» when the colour is the words, its mirror («Por aquí el texto deja de leerse
encima») when the colour is the ground — and takes the press, so a click there moves nothing. A drag into
the unreachable stays on the last step it could reach. The platform's thumb and focus ring stay.

### 3. A drag is one step; a run of arrows is one step

While the hand is on a slider, the canvas shows each step as chrome (the theme's previewer, sprint 38 día
6) and the document does not move; on release, one write — «Deshacer» brings back the colour from before
the gesture. The arrows walk the legible steps one at a time, skipping the unreachable; Home and End go to
the legible extremes; an arrow on the last legible step changes nothing. Each press writes, so the canvas
shows where the keyboard is, and the run is one amendable step of history — the letter chooser's shape,
under its own cause — closed after 300 ms of quiet or when the slider loses the focus.

### 4. The wheel and the hex are judged on their change

They can ask for anything, so they are judged before anything is written: a colour that breaks a pair is
not written, the field says the pair and its figure («Sobre el fondo: 1,3; necesita 4,5»), and «Ajustar»
writes the legible lightness nearest the colour asked for.

### 5. A palette retouched is still that palette; a palette of one's own starts from one colour

A colour moved keeps the theme's origin, so the label is computed as ADR 0075 says: «Vino tinto,
personalizada», with «Volver a la original». «Tu paleta» without colours asks for one — the brand's — and
`derivePalette` makes the other five from it, every pair proved, origin `own`; each is then movable like
any other. One palette per site: the theme is the document's.

## The picker REVIEW refused, and this one

**The refusal stands for what it refused**: a free colour control with nothing in front of it. What this
ADR admits is a picker **with a net** — every colour it can write is proved by the same arithmetic the
predefined palettes are proved by, before it is written, and the gate judges the theme again at the
download. It is not behind the design tools, unlike ADR 0026's exact value, because it cannot produce an
exception: it produces a palette, and every palette is held to 4.5.

## Known limits

- **Chroma is the colour's own.** The sliders move lightness and hue; a colour taken to an extreme loses
  the chroma the screen cannot show there, and a later gesture starts from what was written. «Deshacer»
  and «Volver a la original» bring it back.
- **The wheel previews nothing.** Its platform picker shows the colour; the canvas changes when the colour
  is accepted.
- **A logo palette moved by hand is the dark card when its ground is dark**: the origin says «logo» and not
  which of the two.

## What this does not decide

- How «Estilo» presents the palettes: sprint 38 días 5 and 6.
- An exact colour on one element: ADR 0026, unchanged.

## Consequences

- `apps/editor`: `colourField.ts` (the steps, where the hand and the arrows land, the zones and their
  sentences, «Ajustar»), `ColourField.tsx`, the `adjustColour` cause and `settleColour` in the history,
  the chosen card showing the colours the site wears and carrying its origin, the card named «{nombre},
  personalizada» outright, and a token `--ui-unreachable` (4.01:1 on the track, 4.76:1 on a panel).
- Notes in REVIEW's entry on mockup 13's «Avanzado» and in ADR 0026.
