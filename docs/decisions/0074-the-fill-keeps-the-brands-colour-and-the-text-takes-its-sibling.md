# 0074 — The fill keeps the brand's colour, and the text takes its sibling

**Status:** proposed · **Date:** 2026-11-16 · **Decided by:** David, 16 de noviembre de 2026,
planificando el sprint 38 — a fourth option of his own over the three the plan offered, in his words:
«el color del logo se queda exacto y sobre superficie clara, y lo que cambia es su papel. Si no llega a
4,5 como texto sobre la superficie, se usa como relleno (botón destacado, franjas, acentos, la barra si
es de color) con la tinta que sí pasa sobre él (negra o blanca, la que dé más contraste, y ≥ 4,5
medido), y solo para los usos de texto sobre la superficie (enlaces, titulares en color) se deriva un
hermano oscurecido lo mínimo, que el panel nombra»; and, accepting the split of the tokens it costs,
his condition: «con fill, onFill y el origen ausentes, el renderer dibuja exactamente lo de hoy (fill =
primary, onFill la tinta que ya usa el botón). Prueba: todo el corpus migrado a 1.20.0 da goldens byte
a byte iguales, y down devuelve el documento sin las tres claves.» · **Recorded by development at his
instruction, with the standing note that development does not sign.** · **Relates to:**
[ADR 0075](0075-the-palette-keeps-its-origin-and-the-label-is-computed.md) (the origin, in the same
migration), [ADR 0057](0057-the-header-is-the-owners.md) (the primary bar is the fill),
[ADR 0054](0054-a-published-site-carries-its-own-icon.md) (the favicon's disc is the fill),
[ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md) (the review judges
against the fill). · **Touches:** `packages/schema` (1.20.0, migration 0021), `packages/tokens`,
`packages/renderer`, `apps/editor`. **No published byte moves for any site without a fill of its own**:
the twenty-three goldens of the corpus pass unregenerated.

## Context

A logo's colour is the owner's brand, and sprint 38 exists to make the site carry it whenever there is
a logo. Measured on twelve logos on 16 November 2026, four of them — a postal yellow `#FFCD00`, an orange
`#FF7900`, a lime `#84CC16`, a light blue `#1DA1F2` — cannot be read as text on a white page: 1.50, 2.63,
1.98 and 2.83 to 1, under the 4.5 every palette is held to. Until today the theme had one key for the
brand's colour, `color.primary`, and it carried two roles at once: **text** on the surface (the
headings, the links, the brand's name — five rules of the stylesheet) and **fill** (the button, a bar in
the primary, the phone's open menu, the rail and «Ir a…» hanging from it, the favicon's disc — ten rules
and the icon), with `color.surface` as the ink on every fill. The pair that proved the fill,
`surface on primary`, is the same number as `primary on surface`: one value had to be legible as text
and carry white ink over itself, and a yellow is neither.

So the choice was between changing the colour (darken the yellow until it reads, everywhere), changing
the page (a dark surface, on which the yellow reads) or **changing the role**. David chose the role.

## Decision

### 1. Two optional keys: the fill, and the ink drawn on it

`theme["color.fill"]` is the brand's colour, exact, **wherever something is filled**; `theme["color.onFill"]`
is the ink written on it — black or white, the one with more contrast, ≥ 4.5 measured (for any colour
one of the two clears 4.585). `color.primary` keeps the text role alone; for a colour that cannot be read
as text on the surface it holds **a sibling** — the same hue and chroma, its lightness moved the minimum
to clear 4.5 — which the panel names. The keys are **optional and come in a pair**: one without the other
is refused, because a fill with no ink is a button drawn in a colour nobody chose for it.

They live in a list of their own, `FILL_KEYS`, **not in `TOKEN_KEYS`**: everything that list drives — the
`:root` block's nineteen, the toolbar's references, the completeness of a built theme, the test that every
key is declared on every page — must keep meaning «the nineteen every theme has». No predefined palette
carries the pair: a palette fills with its primary and writes on it in its surface, as it always did.

### 2. Absent is exactly today, and that is proven, not argued

The renderer decides between two shapes of the stylesheet in one function (`fillVars`). **Without the
pair** the fill is `var(--color-primary)` and its ink `var(--color-surface)`: the stylesheet every site
published before 1.20.0, byte for byte. **With it**, the `:root` block appends `--color-fill` and
`--color-on-fill` after the nineteen, the filled rules read them, and the primary bar alone is
re-pointed: five rules of the header write the surface on the three coloured bars together, so each is
followed by its primary-bar twin in the fill's ink, at the same weight, and the secondary and ink bars
keep their surface. Migration 0021 seals and writes nothing; the golden corpus migrated to 1.20.0 is
rendered unregenerated, and a twenty-fourth fixture (`logo-amarillo`) is the second shape.

### 3. What is a fill and what is not

The button, the header's button, a bar in the primary scheme and whatever hangs from it, and the
favicon's disc are fills. **The thin marks drawn on a surface bar** — the indicator under the current
entry, the progress line — **are not**: they are read against the surface as an underline is, and in a
yellow they would draw at 1.5:1 on white. They keep the primary, which every theme proves on its surface;
on a coloured bar they are re-pointed to the bar's ink, as before. This is the one place the plan's list
of rules was narrowed, and why.

### 4. The pairs and the review follow the roles

`CONTRAST_PAIRS` gains `onFill on fill`, measured with the pair resolved (`resolveFill`: absent, the fill
is the primary and its ink the surface), so for every palette it is surface on primary measured again.
**`surface on primary` stays**: it is what a fill-less button carries, and the text bar offers it there.
On a button filled with a theme's own fill the one proved colour is the fill's ink, which no reference
names, so **the text bar offers no colour on that button** rather than five unmeasured ones. The review
before a download judges a button's exact words against the fill, a primary bar's words against the
fill, and the button inverted on a primary bar against the fill's ink.

## What this does not decide

- **How the colours are derived from a logo** — the sibling's arithmetic, the surface and the ink, the
  second colour of a logo: sprint 38 día 2, in `packages/tokens`, with the twelve logos pinned.
- **When a logo's colours reach a site** — at question 1, and after it from «Menú»: ADR 0076.
- **A dark surface** as the default for a light brand colour: refused as a default by David; it stays
  an alternative the owner can pick («De tu logo, oscura»).
- **`color.accent`**, which no rule reads and no pair proves, exactly as before.

## Consequences

- `packages/schema`: `FILL_KEYS`, the optional pair with its refinement, `tokenToCssVariable` writing a
  capital as kebab (`--color-on-fill`), `setTheme` counting the pair, version 1.20.0, migration 0021 with
  its round-trip, the snapshot.
- `packages/tokens`: `resolveFill`, `PairKey`, the eighth pair, `withPalette` dropping a fill of the
  theme's own, `withFill` and `withoutFill`.
- `packages/renderer`: `fill.ts`; the `:root` block appends the pair when present; the button, the
  header's button, the primary bar and what hangs from it read `fillVars`; the five shared coloured-bar
  rules gain their primary twins; the favicon resolves the pair. The three engines read the computed
  colours of the button and the bar, with and without a fill (`engines.browser.test.ts`).
- `apps/editor`: `backgroundOf` and `colorRolesFor` read the theme; `styleReview` resolves the fill.
- Notes in ADR 0054 and ADR 0057.

## Note — sprint 40 día 7: the same role change, for a motif (ADR 0081)

The pair this ADR made is used for a second reason since 22 November 2026. A background with motifs
(ADR 0081) is veiled until every text role clears 4.5:1 over the motif's extremes, and a palette whose
text barely clears its plain surface leaves the motif almost hidden — the neutral start's primary,
Retorika's blue `#156FE7`, is 4.71:1 on white. `withTextMargin` (`packages/tokens/src/derive.ts`) moves
each text role under 7:1 to the sibling of its hue that reaches it, by this ADR's own `lightnessFor`, and
when the primary moves it hands the colour it was to `color.fill` with the ink it was written on: the
buttons, bars and favicon keep the colour exactly, as this ADR keeps a logo's. It runs only when an owner
presses «Dar más contraste a los textos» under the background's note; no palette, no generated site and
no saved site changes on its own. Decided by development under David's delegation of 22 November, for
his veto; the reasoning and the measures are in ADR 0081's día 7 note.
