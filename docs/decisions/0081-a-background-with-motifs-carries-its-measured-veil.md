# 0081 — A background with motifs carries its measured veil

**Status:** proposed · **Date:** 2026-11-21 · **Decided by:** David, 20 de noviembre de 2026,
planning sprint 40 — his answers to encargo 5 («Un fondo con motivos»): scope *«sección y toda la
web»*; painting *«mosaico o a sangre, lo elige el dueño; sin «fija»»*; legibility *«velo medido por
imagen, con los pares de validateTheme»*, with one condition: *«el panel enseña el motivo ya con su velo
antes de guardar, y si el velo sale por encima de un umbral que tú propongas, una nota en palabras
llanas dice por qué («tu motivo tiene partes muy oscuras y muy claras; con colores más suaves se verá
más»). Nadie debe subir un fondo y no entender por qué apenas se ve»*; bytes *«PNG si tiene alfa, JPEG si
no, ≤ 1600 px»*; and, approving the plan, his adjustments 2 (*«los extremos se miden a la resolución
guardada, no en la muestra de 64×64. Reducir a 64 px promedia los trazos finos: es el mismo fallo del
encargo 1»*), 3 (*«una prueba de que el fondo de toda la web no se pinta entre la foto de la portada y
su texto, y de que el cristal de la barra sigue pasando 4,5 encima del motivo»*) and 4 (*«si no cabe, lo
que se corta es la segunda puerta (el «Fondo» de la sección en «Campos»)»*). · **Recorded by development
at his instruction, with the standing note that development does not sign.** · **Relates to:**
[ADR 0018](0018-own-cover-photo-before-phase-2.md) and [ADR 0059](0059-the-logo-travels-like-a-photograph.md)
(the pipe the picture travels), [ADR 0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md)
(the glass's arithmetic), [ADR 0062](0062-the-published-site-moves-just-enough-without-a-byte-of-script.md)
(why not `fixed`), [ADR 0001](0001-static-published-sites.md) · **Touches:** `packages/schema` (1.22.0,
migration `0023`; the colour arithmetic moves here), `packages/tokens` (re-exports it), `packages/renderer`,
`scripts/size-budget.ts`; the editor's half is día 6. **One golden is new — `fondo-con-motivos`; the
other 25 are byte-identical.**

## Context

An owner asked to put their own motifs under a section or under the whole site: a pattern made in
Canva, a texture of their trade. The page has had one way to put a picture under words since sprint 1
— the cover over its photograph, where a panel of `color.surface` goes under the text (`panelArea`),
because nothing in a palette can prove text against a picture. A motif is different in two ways: it is
lighter than a photograph and the owner wants it *seen*, and it goes under a whole box rather than
under one element.

What a palette proves is text on `color.surface`. The glass bar (ADR 0063) extended that proof with
arithmetic: the surface at 88 % over black and over white — the extremes of whatever scrolls under
it — still clears AA, measured by `mixHex` rather than by axe. A motif has extremes too, and they are
its own.

## Decision

### 1. The model: a picture, its size, how it is painted, and its two extremes

`background` on the document (the site's) and on a section (its own), optional, absent before 1.22.0:
`{ src, width, height, paint: "tile" | "cover", extremes: { darkest, lightest } }`. A record, not bytes,
as a photograph and the logo are: the picture travels the photographs' pipe — this browser's store,
the account's bucket, the ZIP's `assets/` — through the schema's one walk (`imageSourcesOf`, a third
kind, `background`, with its place). `width` and `height` are the pixels the editor saved it at, at
most 1600. `extremes` are the darkest and lightest visible pixels, **read at the saved resolution and
from the saved bytes** (David's adjustment 2: a 64×64 sample averages a thin black line into a grey,
and a veil derived from a grey would leave the line unreadable). The schema refuses extremes the wrong
way round, a vector, and a third way to paint.

### 2. The veil is derived when the page is drawn, never stored

`veilFor` (`packages/schema/src/veil.ts`) finds the least opacity of `color.surface`, in whole
hundredths, at which **every text colour of the surface** — ink, primary, secondary, muted — clears AA
over the surface mixed at that opacity with either extreme: the glass's own arithmetic with the motif's
extremes in place of black and white. The renderer asks it when it draws, so **a palette change is a new
veil** and the document holds no number that could go stale. At 100 the mix is the surface itself and
every pair is a palette's own proof, so a theme `validateTheme` accepts always has an answer. Proved
over the thirteen palettes and the derived wheel for the worst motif there is, black and white in one
picture — and, David's adjustment 3, that the fixed bar's glass still reads over the veiled motif in both
its schemes.

**The arithmetic moved.** `relativeLuminance`, `contrastRatio` and `mixHex` were `tokens`' since sprint
1; the renderer cannot import `tokens` (its allowlist, and `tokens` depends on the schema), so they live
in `packages/schema/src/colour.ts` now and `tokens` re-exports them. No behaviour changed; every proof in
`tokens` reads the same function.

### 3. What the page paints

The picture under the box — `body` for the site, the section's own for a section — and a `::before`
over it and under every word: `color.surface` at the veil's opacity, `pointer-events: none`,
`z-index: -1` under a box that is `isolation: isolate`. That order is the decision: the veil lies above
the box's background and below everything in it — the header and its glass included, so the fixed bar
composes over the veiled motif, which §2 holds readable. Where the site has a picture, `html` takes the
surface so `body`'s does not propagate to the canvas: propagated, `cover` would size against the root
and stretch the picture down the whole document, and the veil could not cover what the canvas paints.

`tile` repeats the picture at its own size, and **half of it on a phone** (rule 7's derivation, in the
stylesheet's own `@media` after the shared one). `cover` fills the box, centred, at every width. **Not
`fixed`** (David's answer): iOS Safari ignores it, and a picture that stays while the page scrolls is a
movement tied to scrolling that `prefers-reduced-motion` would have to switch off.

The cover over its photograph keeps its panel: measured in Chromium, the words sit on the panel over the
photograph, and nothing between them paints the site's picture — only `body` does, under all of it
(David's adjustment 3).

### 4. The owner's bytes

PNG where the picture has transparency, JPEG where it has none, at most 1600 px on a side — the
photographs' bound. Weighed with the photographs on the owner's line of the budget (`pnpm size`), never
against ours. The fixture's motif, 160 × 160 and 3.2 KB, is what a Canva pattern of flat colours comes
to; a photograph used as a motif costs what a photograph costs.

### 5. Schema 1.22.0, migration `0023`

`up` seals and moves nothing: both keys are optional and absent on every document before today. `down`
is lossy and says so: both keys go, the site and the sections keep everything else, and the picture's
bytes stay where they are until the account's reconciliation sees nothing naming them.

## What is preserved

- **ADR 0001 and ADR 0058**: static HTML and CSS; the veil is one rule, no script, no request beyond
  the picture itself, which travels in the ZIP like a photograph.
- **Every saved site, byte for byte**: none holds a background; the 25 corpus goldens do not move.
- **`panelArea`** and the cover over its photograph, exactly as they were.
- **One walk for images** (ADR 0059): the publisher, the download, the account's reconciliation and the
  budget learned the background through `imageSourcesOf` and nowhere else.

## What is lost, and it is named

- **A motif with black and white in it is almost hidden.** The guarantee is measured, and for such a
  picture the veil comes out near 100 (the fixture's navy lines under the neutral palette: 98). That is
  the honest consequence of «nunca nace un fondo ilegible», and día 6 says it in plain words where the
  owner uploads: «tu motivo tiene partes muy oscuras y muy claras; con colores más suaves se verá más».
- **A picture that stays while the page scrolls** — refused, above.
- **The worst pixel decides.** One dark dot in a pale motif costs the veil a dark motif would; the
  extremes are the two pixels, not a distribution. Chosen because a distribution cannot promise what the
  words will sit over, and the words may sit anywhere.

## What this does not decide

- **The editor's half**: the upload, the preview with the veil, the note's threshold (proposed α ≥ 70,
  measured on día 6 with three motifs), «Estilo» for the site and the section's door — día 6, with
  David's adjustment 4: if the day does not fit, the section's door is cut and the PR says so.
- A motif per page; a motif under the header alone; a blend other than the surface's.

## Consequences

- `packages/schema`: `colour.ts`, `veil.ts`, `background.ts`, `setBackground.ts`, `document.ts`
  (both keys, `SCHEMA_VERSION`), `images.ts` (the third kind), migration `0023` with its block in
  `migrations.test.ts`, `test/background.test.ts`, the snapshot.
- `packages/tokens`: `contrast.ts` re-exports the arithmetic; `index.ts` re-exports `veilFor`;
  `test/veil.test.ts`.
- `packages/renderer`: `backgroundCss` and `cssUrl` in `build.ts`; `collectAssets`; `test/background.test.ts`,
  `test/background.browser.test.ts`; `breakpoints.test.ts` reads patches as patches; `panel.test.ts`
  counts the third panel.
- `scripts/size-budget.ts`: the background on the owner's line.
- `fixtures/assets/motivo.png`, `fixtures/documents/fondo-con-motivos.json` and its golden.
- The record is `docs/design/REVIEW.md`, sprint 40 día 5.

## Note — sprint 40 día 6: the editor's half, the threshold measured, and two causes where one was named

**What the editor does** (`photos.ts`'s `prepareBackground`, `backgroundMotif.ts`, `BackgroundBlock.tsx`):
a picture is sniffed by its bytes, drawn to at most 1600 px, encoded PNG when it has any transparency and
JPEG at 0.82 when it has none, refused over 2 MiB once encoded and kept with a note over 300 KB; its
extremes are read **from the encoded bytes decoded again at the saved size** — not from the canvas
before encoding (a JPEG's ringing is published) and never from a sample (David's adjustment 2: 1 px black
lines on white, reduced to 64×64, read `#BFBFBF`, and `backgroundExtremes.test` names that as the case
that must not pass). The panel shows the picture **under the veil the page will draw, before anything is
saved** (David's condition), with a line of the theme's text over both; «Usar este fondo» writes one step
of the history, and the bytes take the photographs' pipe. The block is in «Estilo» for the site, for
everybody, and at the foot of «Campos» for a section.

**The threshold, measured: 70 hundredths** (the motif then shows at 30 % or less). Three motifs drawn for
the purpose, their veils under the thirteen palettes:

| Motif | Extremes | Veils |
|---|---|---|
| Soft cream leaves | `#F2E2C7` / `#E9EFE2` | 0 under seven palettes; 19 (classic-blue), 22 (forest-emerald), 37 (ocean); **75–85** under neutral, olive-sand, and the three dark ones |
| Terracotta waves | `#CF895B` / `#D08A5C` | 49–96 |
| Navy lines, terracotta dots (the corpus's) | `#1A2949` / `#B45309` | 58–98; **98 under the neutral start** |

**Two causes, where David's example named one.** «Tu motivo tiene partes muy oscuras y muy claras» is
true of the navy lines on a light page, and of a cream motif on a dark page. It is **false** of the cream
motif under the neutral start: that motif is already soft, and it needs 82 because the neutral palette's
primary clears only 4.71:1 on white — any tint at all takes it under 4.5. Olive-sand (4.70) and ocean
(5.03) behave the same. Telling that owner to soften a soft motif would send them round in a circle. So
`veilReason` names the cause that is true: the motif's far extreme against the page (contrast ≥ 1.5) on a
light page is «dark», on a dark page «light»; a far extreme within 1.5 of the page is «margin», and the
sentence points at «Colores». Three sentences in `es.json`, each asserted by the walk.

**What this means, said plainly and left to David.** Every site starts on the neutral palette, and under
it nearly every motif is veiled at 80 % or more: the feature shows little until the owner chooses colours
with margin. The guarantee is the one he chose — every text colour readable over every pixel — and it is
measured; whether a site's start should change, or the guarantee be relaxed for motifs (for instance only
`ink` at 4.5, the headings at 3:1 as large text), is his decision, not this note's.

**Cut, and said** (David's adjustment 4 named the section's door as what goes first): the section's
background is in «Campos», reached by «Campos de esta sección»; **no ninth verb «Fondo» was added to the
section's cluster**, whose eight verbs are measured by geometry and by the walks. It is in the backlog for
the close.
