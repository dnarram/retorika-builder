# 0075 — The palette keeps its origin, and the label is computed

**Status:** proposed · **Date:** 2026-11-16 · **Decided by:** David, 16 de noviembre de 2026,
planificando el sprint 38 — his answer to where the origin of a palette lives, with its condition:
«el origen dice de dónde salió la paleta, pero la etiqueta se calcula. «{nombre}, personalizada» cuando
kind es palette y algún valor difiere del catálogo; «De tu logo» cuando kind es logo; si el dueño cambia
el logo, el origen no se reescribe solo. down borra la clave y no toca los colores»; and his adjustment
approving the plan: «el generador no escribe palette (ausente = arranque, es lo que ya significa en toda
web anterior a 1.20.0); solo una elección del dueño en Estilo escribe { kind: "palette", id }.
isUntouchedStart = palette ausente y los seis colores iguales a Neutra. Una web antigua con Neutra
elegida a mano antes de 1.20.0 cae como «intacta» y se repinta con deshacer: es la lectura honesta y la
ADR 0075 lo dice como límite conocido.» · **Recorded by development at his instruction, with the standing
note that development does not sign.** · **Relates to:**
[ADR 0074](0074-the-fill-keeps-the-brands-colour-and-the-text-takes-its-sibling.md) (the same
migration), [ADR 0041](0041-the-proposals-start-neutral-and-the-palette-is-chosen-afterwards.md) (§4:
«nothing is stored» — now something is, and it is not the tick). · **Touches:** `packages/schema`
(1.20.0, migration 0021). Nothing reads it yet: «Estilo» does from sprint 38 día 3.

## Context

A theme keeps values, not identities: the panel deduces which palette is ticked by matching all six
colours (`identifyPalette`), and that was enough while every theme came from a palette as written.
Sprint 38 makes two kinds of theme that matching cannot name: a palette whose owner moved one colour
(«Terracota cálida, personalizada») and a palette derived from a logo, whose values are in no catalog.
And it adds a rule that needs to know whether anybody chose the colours at all: a logo uploaded after
the site was generated repaints a site still in its untouched start, and only offers itself to one whose
owner picked a palette.

## Decision

### 1. `doc.palette`: where the colours came from, never what to call them

An optional `palette` beside the theme, one of three kinds:

- `{ kind: "palette", id }` — **the owner chose this predefined palette in «Estilo»**. The colours may
  have moved since.
- `{ kind: "logo" }` — the colours were derived from the owner's logo.
- `{ kind: "own" }` — the owner made the palette themselves.

**The label is computed, never stored**: «{nombre}» when the kind is `palette` and the six colours are
the catalog's, «{nombre}, personalizada» when any differs, «De tu logo» for `logo`, the owner's own for
`own`. One source for what the owner sees, read from the values and the origin together, so it cannot
go stale.

### 2. Absent means nobody chose

**The generator never writes the default.** A site that starts in «Neutra» carries no `palette`; a site
whose owner picks «Neutra» in «Estilo» carries `{ kind: "palette", id: "neutral" }`. The two must stay
apart, because a logo uploaded later repaints the first, as one step the owner can undo, and only offers
itself to the second. A site generated from a logo carries `{ kind: "logo" }`: that is not a default but
where colours in no catalog came from. Every document written before 1.20.0 has no `palette`, and absent
means exactly what it always meant there: nobody is recorded as having chosen.

### 3. Changing the logo does not rewrite the origin

The origin says where the colours came from when they came. A new logo does not quietly turn a palette
the owner chose into «De tu logo»; whether a new logo repaints a site is ADR 0076's rule, and it reads
this field to decide.

### 4. Down is lossy, and says so

Migration 0021's `down` removes `palette` (and ADR 0074's pair) and keeps the six colours: 1.19.0 has
nowhere to keep an origin, and the colours are the site.

## Known limit

**A site whose owner picked «Neutra» in «Estilo» before 1.20.0 reads as untouched.** Nothing in a
1.19.0 document tells it apart from one never touched — the values are the same and no origin was kept —
so a logo uploaded to it later repaints it, as one history step with «Deshacer». That is the honest
reading of what the document holds, and it is written here rather than guessed around.

## What this does not decide

- How «Estilo» shows the origin and the label (sprint 38 días 3 and 6).
- What a logo uploaded later does (ADR 0076, sprint 38 día 3).
- An origin per page: a theme is the document's, and so is its origin.

## Consequences

- `packages/schema`: `paletteOriginSchema` and `PaletteOrigin`, `palette` on the document, version
  1.20.0, migration 0021 with its round-trip and the corpus claim (one fixture carries it:
  `logo-amarillo`, `{ kind: "logo" }`).
- A note in ADR 0041 §4 and in `packages/tokens/src/restyle.ts`'s `identifyPalette`, which becomes the
  fallback for a document with no origin.
