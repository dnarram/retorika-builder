# 0076 — The logo's colours are the site's

**Status:** proposed · **Date:** 2026-11-16 · **Decided by:** David, 16 de noviembre de 2026, opening
sprint 38 — the defect in his words: «Esto es un error de concepto, no un matiz: los colores del logo SON
los colores de marca del usuario, y la web generada tiene que llevarlos siempre que haya un logo, exista o
no una paleta predefinida parecida. Las paletas predefinidas son para quien no trae logo o no quiere
usarlo; nunca deben desplazar a los colores de un logo aportado»; his answer P2, a logo uploaded after the
site was generated applies «si el tema sigue intacto», and otherwise is offered; and his adjustment 1
approving the plan: «el generador no escribe palette (ausente = arranque […]); solo una elección del dueño
en Estilo escribe { kind: "palette", id }. isUntouchedStart = palette ausente y los seis colores iguales a
Neutra». · **Recorded by development at his instruction, with the standing note that development does not
sign.** · **Amends:** [ADR 0010](0010-initial-questionnaire.md) (the logo is the source of the palette —
now literally), [ADR 0015](0015-interface-tokens-are-not-the-sites.md) («whose values come from the
client's own logo» — now true), [ADR 0041](0041-the-proposals-start-neutral-and-the-palette-is-chosen-afterwards.md)
§2 and §5, [ADR 0054](0054-a-published-site-carries-its-own-icon.md) («a logo chooses among those palettes
and never invents one») and [ADR 0059](0059-the-logo-travels-like-a-photograph.md) («the palette the logo
chooses… still an answer rather than a colour») · **Relates to:**
[ADR 0074](0074-the-fill-keeps-the-brands-colour-and-the-text-takes-its-sibling.md) (the role the brand's
colour takes), [ADR 0075](0075-the-palette-keeps-its-origin-and-the-label-is-computed.md) (the origin and
the untouched start) · **Touches:** `packages/generator`, `packages/tokens` (`buildTheme` takes derived
colours), `packages/schema` (`setTheme` writes an origin), `apps/editor`. No golden moves: the corpus is
hand-written.

## Context

Since sprint 6 a logo *chose* a palette: its dominant colour was compared with the predefined palettes'
primaries, and the nearest within ΔE 40 became the site's palette; further away, the site started neutral.
Measured on twelve logos on 16 November 2026: a purple logo got a blue site, a burgundy one a rust site, a
red one Retorika's neutral blue by 0.4 of ΔE, and every yellow, orange, lime or pink one the neutral blue
— while question 1 promised «usamos los de tu sector», untrue since ADR 0041. A logo uploaded later, from
«Menú», never touched the palette at all.

## Decision

### 1. A logo's colours are the site's palette

Question 1 reads the logo's colours — its dominant tint and, when it really has one, a second (at least a
tenth of the counted pixels and ΔE ≥ 20 from the first) — and the generator derives the site's palette from
them with `derivePalette` (sprint 38 día 2): the brand's colour exact as the fill, its sibling where it is
read as text (ADR 0074), the second tint as the secondary and the accent, every pair proved as every
predefined palette's is. The document says where the colours came from: `palette: { kind: "logo" }`. Two
hex strings travel as the answer, never the logo: the generator stays a pure function of its answers.

### 2. Without a logo, or without a colour in it, the untouched start

No logo, or a logo with no colour in it (a black wordmark), and the site starts in «Neutra» as ADR 0041
decided — **with no origin written**: absent means nobody chose (ADR 0075). Question 1 says which happened,
in the owner's words: the logo's colours are the site's; the text takes a darker tone of the colour when it
must, and the buttons and bands carry it as it is; or the logo is black and white and the colours are
chosen later in «Estilo».

### 3. «Estilo» offers the logo's colours first

With a logo whose colours were read, «Estilo» lists «De tu logo» and «De tu logo, oscura» (the same colour
on a dark page, where a light brand is text as it is) before the predefined palettes. «Se parece a
«{nombre}»» names the predefined palette the logo resembles — information, never a choice. Choosing a
predefined palette writes `{ kind: "palette", id }`.

### 4. A logo uploaded later repaints only an untouched site

A logo uploaded from «Menú» or «Fotos» to a site **still in its untouched start** — no origin, and exactly
the neutral colours — gives it the logo's colours as a second history step after the logo's own, and the
help line says so in its live voice with «Deshacer», which takes the colours back and leaves the logo. Asked
of the document as it is once the file has been prepared and read, never of the one the press saw. **Any
other site keeps its palette**: the help line offers, once and in its quiet voice, that the logo's colours
are in «Estilo», with a cross remembered in this browser. Removing the logo leaves the colours: they are
the owner's whether or not the file stays.

### 5. The gate judges the theme

The download gate measures the document's own colours against every pair a palette is held to and blocks
below 4.5, pair by pair in the owner's words. No palette the editor offers can trip it; a document edited by
hand or a defect can, and the filter is the validation, not the trust. A colour *reference* on a button,
proved when the button was the primary, is judged again when the theme gains a fill of its own.

## Known limits

- **A site saved before 1.20.0 with «Neutra» chosen by hand reads as untouched** (ADR 0075's limit): a logo
  uploaded to it later repaints it, with «Deshacer».
- **Saved sites with a logo are not repainted.** Their documents hold the colours of the palette the logo
  chose then; the editor offers the logo's colours once instead. How many such sites exist is a question
  for the database, not the repository.

## What this does not decide

- A palette of the owner's own, and retouching one colour of a palette: sprint 38 día 7, ADR 0077.
- How «Estilo» presents the palettes: sprint 38 días 5 and 6.

## Consequences

- `packages/generator`: `Answers.logoColours` replaces `logoPaletteId`; `themeFor` derives; the document
  carries `palette: { kind: "logo" }` only with a logo's colours. `packages/tokens`: `buildTheme` takes
  derived colours. `packages/schema`: `setTheme` takes an optional origin, and a new origin for the same
  colours is a change.
- `apps/editor`: `logoColoursOf` and `dominantColours`; `paletteForLogo` and `paletteFromLogoFile` retired;
  `logoColours.ts` (the untouched start, the logo's palettes, the offer); the help line's colours notice and
  offer; «De tu logo» in «Estilo»; `reviewTheme` and the theme dialog in the gate.
- Notes in ADR 0010, 0015, 0041, 0054 and 0059.

## Note — sprint 40 día 3: the second ink is read by families of hue

**The defect, measured.** David, opening sprint 40: «He probado con el logo DNR y el editor no capta
ningún naranja.» His logo is navy letters and an orange line. Sampled as the editor samples it (64×64 in
Chromium), the orange was **29.5 % of the counted pixels, split across 35 eight-level buckets, the largest
8.2 %**; on his flat export, 30.1 % across 46, the largest 7.0 %. The rule of día 2 — the most populous
bucket holding a tenth of the counted pixels and ΔE 20 from the first — lost it, and `derivePalette`
turned the accent 150° from the navy: the site came out navy and brown. Extraction, not threshold: a
texture, a gradient or a thin stroke splits an ink across buckets, and no share asked of one bucket keeps
it without also keeping stray pixels.

**What reads it now** (`dominantColours`, `secondInk`): the first colour is unchanged — the most populous
bucket — so no site «De tu logo» moves its brand colour. The buckets with a visible colour (OKLCH chroma
0.04 or more) are grouped by hue in bands of 30°; the first colour's band and its two neighbours are its
own; the most populous other band holding **5 %** of the counted pixels is the second ink, when its colour
stands ΔE 20 from the first. **Its colour is the family's most populous bucket** — the flat colour of the
stroke — when that bucket holds a fifth of the family, and the family's mean only when none does (David's
condition). A grey first colour has no band, and any band may be the second.

| Logo | First | Second, before | Second, now |
|---|---|---|---|
| DNR, flat export (local only) | `#152642` | none | `#954C23`, ΔE 0.5 from `#944C23` |
| DNR, «Medio» finish (local only) | `#162642` | none | `#944C23`, hue 47.8° |
| `logo-dos-tintas.png` (the stand-in) | `#152542` | none | `#934B23` |
| Retorika's mark | `#0165FB` | none | `#F12D66` (mean; largest bucket 16 % of its family) |
| Retorika's wordmark | `#011736` | none | none (pink 3.3 %) |
| The four flat logos of the repository | unchanged | none | none |

**The brand's reference hex is not in its files.** David gave `#B95319` for the orange (light version)
and `#E65F19` (dark). Neither DNR file contains it: the nearest opaque orange pixel is ΔE 11.2 from
`#B95319`, the family's most populous bucket ΔE 18.8, the orange's OKLCH lightness 0.46–0.52 against
0.56. His decision: the test asserts the file's own colour, `#944C23` ± 5, and this note says so.

**His files never enter the repository** (his adjustment 5): the table above for them is measured by
`apps/editor/brand/dnrLogo.brand.test.ts`, a project that exists only with `RETORIKA_BRAND_LOGOS`. The CI
reads 64×64 samples of the repository's own logos (`pnpm logo:samples`) and the synthetic stand-in.

**What a saved site sees.** The theme stored is not recomputed: colours travel as two hex strings. But the
editor reads the logo's bytes again when a site opens, so a site «De tu logo» whose logo has a textured
second ink reads «De tu logo, personalizada» from today, its «De tu logo» card offers the new palette,
and the help line offers it once (§3 of this ADR). The published site does not change a byte until the
owner takes it. David accepted this with his answer.
