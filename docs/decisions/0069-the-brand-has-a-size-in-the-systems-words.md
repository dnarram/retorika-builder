# 0069 — The brand has a size, in the system's words

**Status:** proposed · **Date:** 2026-11-10 · **Decided by:** David, 10 de noviembre de 2026,
planificando el sprint 35 — his first decision, in his words: «Tres tamaños con nombre», for the logo
(pequeño, normal, grande) and for the business name (cuerpo, subtítulo, título, «los tokens de la
escala»), with «normal» being today's so that no saved site changes; «regla 6: referencias al sistema»;
and the exact pixel staying the design tools' marked exception, as the brand's letter already is. ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** · **Relates to:** [ADR 0057](0057-the-header-is-the-owners.md) (§6, the brand),
[ADR 0059](0059-the-logo-travels-like-a-photograph.md) (the logo's file and its kept size),
[ADR 0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md) (the bar's estimate counts
the logo), [ADR 0067](0067-the-bar-folds-where-its-words-do-not-fit.md) (the fold counts the brand),
[ADR 0070](0070-the-brand-has-its-place-in-its-line.md) (the place, the same day). · **Touches:**
`packages/schema` (1.19.0, migration `0020`, shared with ADR 0070), `packages/renderer`, the goldens of
every site with a header, a new corpus document (`marca-grande`).

## Context

The logo has been drawn 40 px tall since the bar existed (ADR 0057 §6), and the business name at the
reading size in the heading's face and weight (ADR 0063). Neither was the owner's to change: the only
size on the brand was the file's own pixels (ADR 0059's note, sprint 30 día 7), kept so a browser
knows the logo's ratio before its bytes arrive, and the one exception, an exact font size on the brand
through the design tools (`header.style.brand.fontSize`, rule 6). David's brief for sprint 35: «que el
logo y el nombre del negocio puedan ser editables en cuanto a tamaño y localización en la sección
Menú».

The constraints that shape the answer, all already written down: the phone's bar stays at or under 72
px (sprint 30's bound, the audit's check 3); the bar's estimate (`--rb-bar-h`) has to be the drawn bar
to within a pixel, because the transparent cover's room and check 11 read it (ADR 0063, 0067); the
fold's estimate has to stay at or over the real break (ADR 0067); and rule 6: a style is a reference to
the system, and an exact value is a marked exception.

## Decision

### 1. Three words for the logo, three tokens for the name

`header.brand.logoSize` is `sm`, `md` or `lg`; `header.brand.nameSize` is `body`, `subheading` or
`heading`. **Words and tokens, never pixels.** The renderer owns the logo's heights — `LOGO_HEIGHTS`,
28 / 40 / 56 px — and the editor says them from there; the name's three are the scale's own tokens, so
a name at the heading's size is as big as the page's headings on every scale. `md` and `body` are what
every bar drew before the words existed, and the absent key means exactly that: **no saved site changes
by this decision**, and the markup of a bar without the words is byte for byte what it was (no
attribute is written for a default).

### 2. A size needs the thing it sizes

`logoSize` is refused without a logo, `nameSize` without `name: true` — the rule ADR 0068 set for
`progress`: the state nobody can see is a state nobody can save. Removing the logo in the editor takes
`logoSize` with it; unticking the name takes `nameSize`.

### 3. The phone derives, by the token (rule 7)

The large logo on a phone is drawn at `min(56px, calc(71px - 2 * var(--space-sm)))`: the most the bar
can give it and stay under 72 with its padding and its hairline — 56 at the compact scale, 55 at the
default, 47 at the generous — worked out from the same `space.sm` the bar pads with rather than written
as a table. The heading-sized name is drawn at the subheading's size on a phone: the generous scale's
heading is 48 px, and 48 × 1.3 of line plus the bar's padding is 87, over 72. And a wide mark at the
large size is shown whole rather than deforming the line (`max-width: 100%; object-fit: contain`): a
4 : 1 mark at 55 px is 220 px beside a button, «Ir a…» and «Menú».

### 4. The estimates count the words, with the stylesheet's own expressions

`barEstimate` and `barLines` read the logo's height and the name's token through the same two helpers
the stylesheet writes with (`logoHeightCss`, `brandSizeToken`), so `--rb-bar-h` is the drawn bar to
the pixel at every size and the fold moves with the brand: a square logo from 40 to 56 moves the fold
16 px; a heading-sized name moves it by its glyphs. The corpus's `marca-grande` — the logo site with
`lg`, `heading` and `center` — folds at 1078, and the owner will be told so by the panel.

### 5. The rules are always in the sheet, in both targets

Every rule for the words travels with every site that draws a header, whether or not the document
carries a word: the editor's «Menú» panel previews a word by writing its attribute on the canvas's bar
before the document has it (David's adjustment 3 to the sprint's plan), so the canvas needs the rules
for words its document does not carry yet — and the published page and the canvas are one sheet
(CLAUDE.md: two renderers diverge). The four goldens with a header move by one identical block of
sixteen lines; no site's bar matches a rule it has no word for.

### 6. The exact size still wins

The name's size goes on `.rb-brand`, where the design tools' exact size is written (`PART_SELECTOR`),
after the bar's «small» — which does not scale a chosen size again — and before the rule-6 block, so
an exact pixel on the brand wins by order as it always has. The logo gets no exact pixel (below).

## What is preserved

The 72 px phone bar, in the stylesheet and in the audit; the estimate's bound of ADR 0067 (the browser
test of forms gains the large logo and the heading-sized name, within −1 and +16); the script, which
reads `offsetHeight` and needs no byte (ADR 0058); CLS: `width` and `height` on the `<img>` with a CSS
height and `width: auto` keep the ratio at every size; every saved site's bytes but the sixteen lines.

## What is lost, and it is named

A logo kept without its file size (before 1.16.0) says only how tall it is drawn: its `height`
attribute follows the word, as it followed the 40 before. The name at a size of its own is not scaled
by the bar's «small»: the owner chose the size, and the panel says so.

## What this does not decide

- **A free pixel size for the logo.** David's decision was three words; the exact pixel exists for the
  name through the design tools and not for the logo. A fourth word, or the logo's own exception, is a
  decision of its own.
- **The phone's `object-fit`** is a derivation (rule 7), not an owner's choice.

## Consequences

Schema 1.19.0 with migration `0020` (`up` seals; `down` drops the three words and keeps the name and
the logo). `motion.test.ts`'s count of the two sheets' differences is unchanged: the block is in both.
The editor's half — the three segments in «Menú», the notes that read `LOGO_HEIGHTS`, the preview on
hover, the logo's edge drag — is sprint 35's días 5 and 6.
