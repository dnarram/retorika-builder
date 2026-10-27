# 0055 — The gallery is navigated: forty families, one table, and each one's substitute

**Status:** proposed · **Date:** 2026-10-27 · **Decided by: David, 27 de octubre de 2026** — planning
sprint 29: *«unas cuarenta familias»* that *«se navegan, no se recorren»*, each entering with *«su
sustituta más cercana»* so that a future retirement *«sea una migración mecánica como la 0012 y no una
decisión»*; and, on día 2, four answers to what the survey found (below) · **Recorded by development,
which does not sign** · **Relates to:**
[ADR 0046](0046-the-gallery-ships-the-faces-so-the-letter-can-be-named.md) (amends §2, and the reading
of §3), [ADR 0045](0045-the-serif-this-product-ships-reserves-no-name.md) (amended the same day: a
licence is read from its holders), [ADR 0028](0028-typography-needs-a-decision-from-direction.md),
[ADR 0001](0001-static-published-sites.md) · **Touches:** `packages/schema`, `packages/renderer`,
`packages/tokens`, `packages/publisher`, `scripts/`, `apps/editor`

## Context

The CEO asked, through David, for «una muy amplia selección de fuentes» for headings and text. Sprint
29 día 1 made the gallery a dialog that is searched and filtered rather than scrolled, so that the panel
no longer grows with the table. This ADR is what grows the table.

Until today the gallery was **four parallel copies of eight names**: the tokens' `GALLERY_FAMILIES`,
the renderer's `SHIPPABLE_FAMILIES`, the publisher's `FONT_SOURCES` and the generated `fontData.ts`, held
level by tests. Every other name in them was already a function of the family's own — the file
`<slug>-latin-<weight>-normal.woff2`, the package `@fontsource/<slug>`, the licence
`fonts/OFL-<Name>.txt`. At forty families, four copies is four places for a row to go wrong.

And a row is expensive to take back. A theme stores the resolved stack, so retiring a family is a schema
migration: `0012` for Playfair Display (ADR 0045), and — found by this ADR's own survey, the same day —
`0014` for Libre Baskerville.

## Decision

### 1. One table, in `@retorika/schema` (amends ADR 0046 §2)

`packages/schema/src/fontGallery.ts` holds `FONT_GALLERY`: per row the **family**, its **kind** and its
**substitute**, alphabetical. The three copies become derivations:

- **The renderer** derives `SHIPPABLE_FAMILIES` — two faces per row, 400 and 700, named from
  `fontFamilySlug(family)`. It keeps what ADR 0046 §2 gave it: the derivation of faces and the only
  `url()` this product emits.
- **The tokens** derive `GALLERY_FAMILIES` — the stack is the family, then its species' fallback chain,
  except where a type pair already names the family first, whose stack is kept verbatim (EB Garamond,
  Inter).
- **The publisher** derives `FONT_SOURCES` from the renderer's table.

**Why schema.** It is the one package every reader may import: the renderer admits only schema and
catalog, because everything there travels to the client's site; tokens admits only schema; and tokens
cannot import the renderer, whose tests import tokens — a cycle under `tsc --build`. Catalog is about
sections. `FONT_GALLERY` is **not** part of `documentSchema`: the snapshot does not move, and no
migration is needed for the table itself.

**The safety property does not change.** A document *chooses* a row by exact equality of its stack's
first family; it can never *name* a file. `FONT_FAMILY_PATTERN` — filter 4 of ADR 0046 §3 and the
renderer's lock on what it emits — moves to `fontGallery.ts`, and `escape.ts` imports it, so the filter
and the lock are one regex.

**Nothing an existing document holds moves.** The eight stacks and sixteen sources the derivations
produce for the families shipped before today were compared with the hand-written ones, byte for byte,
on 27 October 2026: no difference. No golden moves.

### 2. Four species, and the generic keyword each falls back to

`FONT_KINDS = sans, serif, slab, display`. `slab` and `display` are ours, not Google's: Google files a
slab under `serif` and most headline families under `sans-serif`, and «de cartel» is a judgement about
where a family is meant to be used. `GENERIC_OF` decides how a stack ends when no face arrives — a slab
falls back as a serif, a headline family as a sans.

**Bitter is refiled from serif to slab.** Its stack is unchanged, because a slab falls back as a serif.
What changes is the chip it is found under.

**The chooser's chips are derived from the species the table actually has**, in that order:
«Remates gruesos» enters today with the slabs, and «De cartel» will enter on día 3 with the first headline
family. No chip can narrow the list to nothing.

### 3. Every row enters with its substitute

David's condition: the **closest family of the same species, already in the table**, written when the
row enters rather than argued when it leaves. A test holds it over every row: the substitute exists, is
of the same kind, and is not the row itself. With it written down, retiring any family is the migration
`0014` already is: the retiring row's whole stack becomes its substitute's, matched exactly.

**Inter, Roboto and Open Sans are near neighbours**, and David asked that each one's substitute be
found among the other two: Inter and Roboto name each other, and Open Sans names Roboto.

### 4. The composition, and a quota on the sans

The target is **about fourteen sans, ten serifs, five slabs and six headline families**, all with real
400 and 700 — ADR 0046 §4 stands, including for «de cartel». **The sans are capped at fourteen**
(David), and a test holds the cap.

**Día 2 is twenty-five rows**:

- **Fourteen sans**, the whole quota: the four shipped before today, six of ADR 0046's nine that
  «passed», and the four the clients ask for most.
- **Seven serifs.**
- **Four slabs.**

| family | kind | substitute | faces 400 + 700 + licence, KB | |
|---|---|---|---|---|
| Aleo | slab | Bitter | 31.3 | new |
| Bitter | slab | Zilla Slab | 38.3 | refiled from serif |
| Crimson Pro | serif | EB Garamond | 38.2 | new (ADR 0046's nine) |
| DM Sans | sans | Poppins — DM Sans was drawn from it | 29.8 | |
| EB Garamond | serif | Crimson Pro | 49.9 | |
| Figtree | sans | DM Sans | 24.1 | |
| Fraunces | serif | Crimson Pro | 37.3 | new |
| Gelasio | serif | Libre Caslon Text | 40.4 | since ADR 0045's amendment |
| Inter | sans | Roboto | 48.8 | |
| Karla | sans | Work Sans | 27.8 | new (the nine) |
| Libre Caslon Text | serif | EB Garamond | 51.0 | new |
| Libre Franklin | sans | Public Sans | 33.1 | new (the nine) |
| Manrope | sans | Figtree | 29.6 | new (the nine) |
| Montserrat | sans | Poppins | 38.7 | new — see §5 |
| Newsreader | serif | Spectral | 47.1 | new |
| Nunito Sans | sans | Figtree | 29.1 | new (the nine) |
| Open Sans | sans | Roboto | 38.0 | new — see §5 |
| Poppins | sans | Montserrat | 17.3 | new — see §5 |
| Public Sans | sans | Libre Franklin — drawn from it | 30.5 | new (the nine) |
| Roboto | sans | Inter | 45.1 | new — see §5 |
| Rokkitt | slab | Zilla Slab | 28.2 | new |
| Rubik | sans | Nunito Sans | 39.1 | new (the nine) |
| Spectral | serif | Newsreader | 45.7 | |
| Work Sans | sans | Karla | 41.7 | |
| Zilla Slab | slab | Bitter | 53.3 | new |

Of ADR 0046's nine, **two are not here**. Source Sans 3 reserves ‘Source’ in its own google/fonts
licence. Source Serif 4 is out on a discrepancy: google/fonts' text reserves nothing, and Adobe's
reserves ‘Source’ (ADR 0045, amended).

**Día 3 closes the list.** It adds about three serifs, one slab and six headline families, and no sans
unless one leaves to make room.

### 5. The survey, dated — and what it overturned

`pnpm fonts:survey` (`scripts/survey-fonts.ts`) reads each candidate's published tarball without
running anything. It runs `npm pack --ignore-scripts` into a temporary directory and reads only
`metadata.json`, the `LICENSE` and the two latin woff2 into memory, with a thirty-line ustar reader.
Nothing is written to the repository. Weights are gzipped the way `scripts/size-budget.ts` weighs them.

**Filter 2 is read from the holders, as ADR 0045's amendment requires.** That means google/fonts'
`OFL.txt` at commit `e7db6ca`, and the licence in the author's own repository. The reserved name is
compared with the name we would present.

**The Bitter reading, dated 27 October 2026 (David):** its holders reserve «Bitter Pro», and we present
«Bitter»; §3 restricts the reserved string, so Bitter stays. The same reading admits «Lexend» beside
«RevReading Lexend».

**109 candidates, 78 admitted** — the whole table is the appendix below:

| species | admitted | out, and why |
|---|---|---|
| sans | 37 of 42 | Lato, Raleway, IBM Plex Sans («Plex»), PT Sans, Source Sans 3 («Source»): reserved names |
| serif | 19 of 30 | Libre Baskerville, Lora, Merriweather, Domine, IBM Plex Serif, PT Serif: reserved names; Playfair Display and Source Serif 4: discrepancy; DM Serif Display, Instrument Serif, Young Serif: no real 700 |
| slab | 7 of 16 | Arvo, Josefin Slab, Kreon, Noticia Text: reserved names; Alfa Slab One, Bree Serif, Crete Round, Patua One: reserved and no real 700; Roboto Slab: Apache 2.0 |
| display | 15 of 21 | Anton, Archivo Black, Bebas Neue: no real 700; Abril Fatface: reserved and no 700; Comfortaa: reserved; Passion One: discrepancy |

**What it overturned.** The plan expected Roboto to fall on its licence and Montserrat, Poppins and Lato
on reserved names. **Roboto is OFL now, and Montserrat and Poppins reserve nothing**, in either reading.
Only Lato does. David's decision 2 had a line ready for the gallery: «Montserrat, Poppins, Lato y otras
no se incluyen por su licencia». On those facts it would have lied, so his answer was to admit all four
families the clients ask for most — Montserrat, Poppins, Roboto, Open Sans — **inside the sans quota**.
Día 3's line names the families that really reserve their names.

**The cost of ADR 0046 §4, measured over «de cartel».** Fifteen headline families have both weights:
Oswald, Syne, Big Shoulders Display, Bricolage Grotesque, Unbounded and ten more. Bebas Neue, Anton and
Archivo Black do not, and stay out.

**For sprint 30, the whole face of the reserved names asked for most** — every subset of 400 and 700,
with the licence. That is what shipping them «whole» would mean, and it is **still a format conversion**,
which ADR 0045 §4 says does not cure §3:

| family | latin 400 + 700 + licence | every subset | difference |
|---|---|---|---|
| Lato | 47.5 KB | 58.5 KB | +11.0 |
| Playfair Display | 45.9 | 104.9 | +59.0 |
| Raleway | 46.0 | 144.7 | +98.7 |
| Lora | 43.1 | 174.4 | +131.2 |
| Merriweather | 97.5 | 280.6 | +183.2 |

### 6. The bytes, one module per package

`scripts/generate-font-data.ts` now writes `packages/publisher/src/fontData/<slug>.ts`, one per package,
and an `index.ts` that imports them all statically. `fontDataFor` stays synchronous and its callers do
not change. `fontData.ts`, a single module of 467 KB, is gone.

- **Today:** twenty-five modules of 27 to 76 KB, 1.3 MB in all, marked `linguist-generated`.
- **Kept in step:** the generator removes the module of a package the table no longer names, and a test
  refuses an orphan, reading the directory and not the index.
- **The output is already biome-formatted**, so a regeneration is a clean diff.
- **If the server's start-up ever moves**, the index leaves room for a lazy `import()` per family
  without touching a caller. The measures ADR 0046 §6 took — three boots, the first cold 200 and the
  built output — are taken on día 3, with all forty families in place.

### 7. The faces' ceiling checks itself

`scripts/size-budget.ts` now weighs every family as a ZIP carries it, faces and licence. It prints the
heaviest pair of distinct families and **fails if `MAX_FONT_GZIP_BYTES` is below it** («the ceiling is
below the heaviest pair the table can produce»).

Measured today, the heaviest pair is **Zilla Slab and Libre Caslon Text, at 104.3 KB**; it was EB
Garamond and Inter, at 98.7. The ceiling rises from **115 to 120 KB**, keeping about the 16 KB margin of
ADR 0046 §5. A heavier family is then a red line with its own number beside it.

## What is preserved

- **A document chooses a row and never names a file**, and the one `url()` is still minted in
  `escape.ts`.
- **Every stack a document already holds**, byte for byte; no migration for the table, no golden moved.
- **A face never travels without its licence**, now the holders' text (ADR 0045, amended).
- **A site that names no shipped family carries no font bytes at all.**

## What is lost, and it is named

- **Seventeen families are a commitment.** Each can be taken back only by a migration — mechanical now,
  with its substitute written, but a migration.
- **Bitter's chip moves**, from «Con remates» to «Remates gruesos», for anyone who looked for it there.
- **The plan's line about Montserrat and Poppins** is not written; día 3 writes a true one.
- **1.3 MB of generated base64 in the repository**, against 467 KB, and about 2.1 MB at forty by the
  same average.

## What this does not decide

- **Which of the remaining admitted families enter on día 3**, and their substitutes — that half of día 3
  is judgement, and starts with this survey on the table.
- **Shipping a reserved family whole** (sprint 30, with the numbers above).
- **Own fonts** — ADR 0056, día 4.

## Consequences

- `packages/schema`: `fontGallery.ts` (the table, `FONT_KINDS`, `GENERIC_OF`, `FONT_FAMILY_PATTERN`,
  `fontFamilySlug`) and its tests; exported from the index.
- `packages/renderer`: `SHIPPABLE_FAMILIES` derived; `escape.ts` imports the pattern.
- `packages/tokens`: `GALLERY_FAMILIES` derived; `kind` is a `FontKind`.
- `packages/publisher`: `FONT_SOURCES` derived; `fontData/` split; seventeen packages pinned exactly in
  its manifest and the root's, which a new test reads; seventeen holders' licences in `licences/`.
- `scripts/`: `survey-fonts.ts` (`pnpm fonts:survey`); `generate-font-data.ts` writes the split;
  `size-budget.ts` checks its ceiling; `fetch-font-licences.ts` reports GitHub's rate limit rather than
  passing it for a missing licence, and takes an optional `GITHUB_TOKEN`.
- `apps/editor`: the chips derived from the species present, with «Remates gruesos» and «De cartel» in
  `es.json`. **The chooser's list scrolls in a `div`, not in its `fieldset`**: with twenty-five rows
  the list first outgrew its box, and Chromium, which lays a scrolling fieldset out correctly, painted
  its positioned rows past the clip and over «Hecho», which lost its click — found by the e2e, measured
  with `elementFromPoint`. The e2e's list of families is derived from the table, with a literal floor
  and four names, and the walk now asserts that opening the chooser does not fetch the foot of the
  list, walking it down a row at a time.
- The record is `docs/design/REVIEW.md`, sprint 29 día 2.

## Appendix — the survey, 27 October 2026

The output of `GITHUB_TOKEN=… pnpm fonts:survey`, unedited except for the heading levels. «google/fonts»
and «author» are the two readings of filter 2; «@fontsource line» is what the package's own `LICENSE`
says, kept as the evidence of ADR 0045's amendment and never decisive.


Gzipped with `zlib.gzipSync`, as `scripts/size-budget.ts` weighs. «total» is the latin 400 + 700 + the holders' licence that travels beside them. google/fonts read at e7db6ca.


### sans — 37 admitted of 42

| family | Google category | OFL 1.1 | google/fonts | author | @fontsource line | latin 400+700 | name | 400 KB | 700 KB | licence KB | total KB | npm | Google | verdict | substitute |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Albert Sans | sans-serif | yes | no | no | no | yes | yes | 9.8 | 10.1 | 1.9 | 21.8 | 5.3.0 | v4 | admitted |  |
| Archivo | sans-serif | yes | no | no | no | yes | yes | 14.4 | 14.2 | 1.9 | 30.5 | 5.3.0 | v25 | admitted |  |
| Barlow | sans-serif | yes | no | no | no | yes | yes | 21.7 | 22.3 | 1.9 | 45.9 | 5.3.0 | v13 | admitted |  |
| Be Vietnam Pro | sans-serif | yes | no | no | no | yes | yes | 20.7 | 21.7 | 1.9 | 44.3 | 5.3.0 | v12 | admitted |  |
| Cabin | sans-serif | yes | no | no | no | yes | yes | 16.3 | 16.1 | 2.0 | 34.4 | 5.3.0 | v35 | admitted |  |
| DM Sans | sans-serif | yes | no | no | no | yes | yes | 13.8 | 14.0 | 2.0 | 29.8 | 5.3.0 | v17 | admitted | Poppins |
| Epilogue | sans-serif | yes | no | no | no | yes | yes | 14.0 | 14.3 | 1.9 | 30.2 | 5.3.0 | v20 | admitted |  |
| Figtree | sans-serif | yes | no | no | no | yes | yes | 11.1 | 11.1 | 1.9 | 24.1 | 5.3.0 | v9 | admitted | DM Sans |
| Fira Sans | sans-serif | yes | no | not located | no | yes | yes | 23.3 | 24.5 | 1.9 | 49.7 | 5.3.0 | v18 | admitted |  |
| Hanken Grotesk | sans-serif | yes | no | no | no | yes | yes | 13.2 | 13.5 | 1.9 | 28.6 | 5.3.0 | v12 | admitted |  |
| Heebo | sans-serif | yes | no | no | no | yes | yes | 11.7 | 12.0 | 2.0 | 25.6 | 5.3.0 | v28 | admitted |  |
| IBM Plex Sans | sans-serif | yes | **reserves** | **reserves** | no | yes | yes | 22.1 | 22.3 | 2.0 | 46.3 | 5.3.0 | v23 | out — Reserved Font Name |  |
| Instrument Sans | sans-serif | yes | no | no | no | yes | yes | 16.5 | 16.6 | 1.9 | 35.1 | 5.3.0 | v4 | admitted |  |
| Inter | sans-serif | yes | no | no | no | yes | yes | 23.1 | 23.7 | 1.9 | 48.8 | 5.3.0 | v20 | admitted | Roboto |
| Jost | sans-serif | yes | no | no | no | yes | yes | 9.2 | 10.3 | 1.9 | 21.4 | 5.3.0 | v20 | admitted |  |
| Karla | sans-serif | yes | no | no | no | yes | yes | 12.9 | 13.0 | 1.9 | 27.8 | 5.3.0 | v33 | admitted | Work Sans |
| Kumbh Sans | sans-serif | yes | no | no | no | yes | yes | 12.7 | 12.8 | 2.0 | 27.5 | 5.3.0 | v27 | admitted |  |
| Lato | sans-serif | yes | **reserves** | **reserves** | **reserves** | yes | yes | 23.0 | 22.5 | 1.9 | 47.5 | 5.3.0 | v25 | out — Reserved Font Name |  |
| Lexend | sans-serif | yes | no | no | no | yes | yes | 14.2 | 14.5 | 2.0 | 30.6 | 5.3.0 | v26 | admitted |  |
| Libre Franklin | sans-serif | yes | no | no | no | yes | yes | 15.5 | 15.6 | 2.0 | 33.1 | 5.3.0 | v20 | admitted | Public Sans |
| Manrope | sans-serif | yes | no | no | no | yes | yes | 13.8 | 13.9 | 1.9 | 29.6 | 5.3.0 | v20 | admitted | Figtree |
| Montserrat | sans-serif | yes | no | no | no | yes | yes | 18.4 | 18.4 | 1.9 | 38.7 | 5.3.0 | v31 | admitted | Poppins |
| Mulish | sans-serif | yes | no | no | no | yes | yes | 13.1 | 13.0 | 1.9 | 28.0 | 5.3.0 | v18 | admitted |  |
| Noto Sans | sans-serif | yes | no | no | no | yes | yes | 12.8 | 13.2 | 1.9 | 27.9 | 5.3.0 | v42 | admitted |  |
| Nunito | sans-serif | yes | no | no | no | yes | yes | 16.0 | 15.9 | 1.9 | 33.7 | 5.3.0 | v32 | admitted |  |
| Nunito Sans | sans-serif | yes | no | no | no | yes | yes | 13.6 | 13.5 | 1.9 | 29.1 | 5.3.0 | v19 | admitted | Figtree |
| Onest | sans-serif | yes | no | no | no | yes | yes | 14.4 | 15.1 | 1.9 | 31.5 | 5.3.1 | v11 | admitted |  |
| Open Sans | sans-serif | yes | no | no | no | yes | yes | 18.2 | 17.8 | 1.9 | 38.0 | 5.3.0 | v44 | admitted | Roboto |
| Outfit | sans-serif | yes | no | no | no | yes | yes | 13.6 | 13.6 | 1.9 | 29.1 | 5.3.0 | v15 | admitted |  |
| Plus Jakarta Sans | sans-serif | yes | no | no | no | yes | yes | 11.6 | 12.0 | 1.9 | 25.5 | 5.3.0 | v12 | admitted |  |
| Poppins | sans-serif | yes | no | no | no | yes | yes | 7.7 | 7.7 | 1.9 | 17.3 | 5.3.0 | v24 | admitted | Montserrat |
| PT Sans | sans-serif | yes | **reserves** | **reserves** | no | yes | yes | 44.5 | 46.1 | 2.0 | 92.6 | 5.3.0 | v18 | out — Reserved Font Name |  |
| Public Sans | sans-serif | yes | no | no | no | yes | yes | 14.3 | 14.3 | 1.9 | 30.5 | 5.3.0 | v21 | admitted | Libre Franklin |
| Raleway | sans-serif | yes | **reserves** | **reserves** | **reserves** | yes | yes | 21.9 | 22.1 | 2.0 | 46.0 | 5.3.0 | v37 | out — Reserved Font Name |  |
| Red Hat Display | sans-serif | yes | no | no | no | yes | yes | 13.7 | 14.4 | 1.9 | 30.0 | 5.3.0 | v21 | admitted |  |
| Roboto | sans-serif | yes | no | no | no | yes | yes | 21.4 | 21.7 | 1.9 | 45.1 | 5.3.0 | v51 | admitted | Inter |
| Rubik | sans-serif | yes | no | no | no | yes | yes | 18.5 | 18.7 | 1.9 | 39.1 | 5.3.0 | v31 | admitted | Nunito Sans |
| Schibsted Grotesk | sans-serif | yes | no | no | no | yes | yes | 23.8 | 24.6 | 1.9 | 50.3 | 5.3.0 | v7 | admitted |  |
| Sora | sans-serif | yes | no | no | no | yes | yes | 14.4 | 14.8 | 1.9 | 31.1 | 5.3.0 | v17 | admitted |  |
| Source Sans 3 | sans-serif | yes | **reserves** | **reserves** | no | yes | yes | 15.4 | 15.3 | 2.0 | 32.6 | 5.3.1 | v20 | out — Reserved Font Name |  |
| Urbanist | sans-serif | yes | no | no | no | yes | yes | 11.7 | 11.8 | 1.9 | 25.4 | 5.3.0 | v18 | admitted |  |
| Work Sans | sans-serif | yes | no | no | no | yes | yes | 19.4 | 20.4 | 1.9 | 41.7 | 5.3.0 | v24 | admitted | Karla |

### serif — 19 admitted of 30

| family | Google category | OFL 1.1 | google/fonts | author | @fontsource line | latin 400+700 | name | 400 KB | 700 KB | licence KB | total KB | npm | Google | verdict | substitute |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alegreya | serif | yes | no | no | no | yes | yes | 22.4 | 23.8 | 1.9 | 48.1 | 5.3.0 | v41 | admitted |  |
| Bodoni Moda | serif | yes | no | no | no | yes | yes | 14.2 | 14.7 | 1.9 | 30.8 | 5.3.0 | v28 | admitted |  |
| Brygada 1918 | serif | yes | no | no | no | yes | yes | 13.5 | 13.7 | 1.9 | 29.1 | 5.3.0 | v27 | admitted |  |
| Cardo | serif | yes | no | no | no | yes | yes | 15.2 | 18.8 | 1.9 | 35.9 | 5.3.0 | v21 | admitted |  |
| Cormorant Garamond | serif | yes | no | no | no | yes | yes | 22.4 | 21.8 | 1.9 | 46.1 | 5.3.0 | v21 | admitted |  |
| Crimson Pro | serif | yes | no | no | no | yes | yes | 17.9 | 18.3 | 1.9 | 38.2 | 5.3.0 | v28 | admitted | EB Garamond |
| Crimson Text | serif | yes | no | no | no | yes | yes | 24.6 | 25.0 | 1.9 | 51.5 | 5.3.0 | v19 | admitted |  |
| DM Serif Display | serif | yes | no | no | no | **no** | yes | 24.2 | 0.0 | 2.0 | 26.2 | 5.3.0 | v17 | out — no real 700 |  |
| Domine | serif | yes | **reserves** | **reserves** | no | yes | yes | 17.3 | 17.9 | 2.0 | 37.2 | 5.3.0 | v25 | out — Reserved Font Name |  |
| EB Garamond | serif | yes | no | no | no | yes | yes | 23.3 | 24.7 | 1.9 | 49.9 | 5.3.0 | v33 | admitted | Crimson Pro |
| Faustina | serif | yes | no | no | no | yes | yes | 14.5 | 14.4 | 1.9 | 30.8 | 5.3.0 | v23 | admitted |  |
| Frank Ruhl Libre | serif | yes | no | no | no | yes | yes | 15.0 | 15.1 | 2.0 | 32.1 | 5.3.0 | v23 | admitted |  |
| Fraunces | serif | yes | no | no | no | yes | yes | 17.6 | 17.8 | 1.9 | 37.3 | 5.3.0 | v38 | admitted | Crimson Pro |
| Gelasio | serif | yes | no | no | no | yes | yes | 19.1 | 19.4 | 1.9 | 40.4 | 5.3.0 | v14 | admitted | Libre Caslon Text |
| IBM Plex Serif | serif | yes | **reserves** | **reserves** | no | yes | yes | 19.1 | 19.5 | 2.0 | 40.6 | 5.3.0 | v20 | out — Reserved Font Name |  |
| Instrument Serif | serif | yes | no | no | no | **no** | yes | 20.6 | 0.0 | 1.9 | 22.5 | 5.3.0 | v5 | out — no real 700 |  |
| Libre Baskerville | serif | yes | **reserves** | **reserves** | no | yes | yes | 19.6 | 19.9 | 2.0 | 41.6 | 5.3.0 | v24 | out — Reserved Font Name |  |
| Libre Caslon Text | serif | yes | no | no | no | yes | yes | 24.4 | 24.7 | 1.9 | 51.0 | 5.3.0 | v5 | admitted | EB Garamond |
| Literata | serif | yes | no | no | no | yes | yes | 19.9 | 21.5 | 1.9 | 43.4 | 5.3.0 | v40 | admitted |  |
| Lora | serif | yes | **reserves** | **reserves** | **reserves** | yes | yes | 20.7 | 20.5 | 1.9 | 43.1 | 5.3.0 | v37 | out — Reserved Font Name |  |
| Merriweather | serif | yes | **reserves** | **reserves** | **reserves** | yes | yes | 48.0 | 47.5 | 1.9 | 97.5 | 5.3.0 | v33 | out — Reserved Font Name |  |
| Newsreader | serif | yes | no | no | no | yes | yes | 22.0 | 23.2 | 1.9 | 47.1 | 5.3.0 | v26 | admitted | Spectral |
| Noto Serif | serif | yes | no | no | no | yes | yes | 14.1 | 14.9 | 1.9 | 30.9 | 5.3.0 | v33 | admitted |  |
| Petrona | serif | yes | no | no | no | yes | yes | 23.3 | 23.5 | 1.9 | 48.7 | 5.3.0 | v38 | admitted |  |
| Playfair Display | serif | yes | **reserves** | no | **reserves** | yes | yes | 21.3 | 22.6 | 1.9 | 45.9 | 5.3.0 | v40 | out — discrepancy between google/fonts and the author's licence |  |
| PT Serif | serif | yes | **reserves** | **reserves** | no | yes | yes | 32.4 | 28.9 | 1.9 | 63.2 | 5.3.0 | v19 | out — Reserved Font Name |  |
| Source Serif 4 | serif | yes | no | **reserves** | no | yes | yes | 19.6 | 21.2 | 1.9 | 42.8 | 5.3.1 | v15 | out — discrepancy between google/fonts and the author's licence |  |
| Spectral | serif | yes | no | no | no | yes | yes | 21.2 | 22.5 | 1.9 | 45.7 | 5.3.0 | v15 | admitted | Newsreader |
| Vollkorn | serif | yes | no | no | no | yes | yes | 24.9 | 26.5 | 2.0 | 53.3 | 5.3.0 | v30 | admitted |  |
| Young Serif | serif | yes | no | no | no | **no** | yes | 26.4 | 0.0 | 1.9 | 28.3 | 5.3.0 | v2 | out — no real 700 |  |

### slab — 7 admitted of 16

| family | Google category | OFL 1.1 | google/fonts | author | @fontsource line | latin 400+700 | name | 400 KB | 700 KB | licence KB | total KB | npm | Google | verdict | substitute |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Aleo | serif | yes | no | no | no | yes | yes | 14.5 | 14.9 | 1.9 | 31.3 | 5.3.0 | v16 | admitted | Bitter |
| Alfa Slab One | display | yes | **reserves** | **reserves** | **reserves** | **no** | yes | 18.6 | 0.0 | 2.0 | 20.6 | 5.3.0 | v21 | out — Reserved Font Name; no real 700 |  |
| Arvo | serif | yes | **reserves** | not located | no | yes | yes | 16.9 | 17.0 | 1.9 | 35.8 | 5.3.0 | v23 | out — Reserved Font Name |  |
| Bitter | serif | yes | no | no | no | yes | yes | 18.2 | 18.2 | 1.9 | 38.3 | 5.3.0 | v42 | admitted | Zilla Slab |
| Bree Serif | serif | yes | **reserves** | **reserves** | **reserves** | **no** | yes | 10.1 | 0.0 | 1.9 | 12.1 | 5.3.0 | v18 | out — Reserved Font Name; no real 700 |  |
| Crete Round | serif | yes | **reserves** | **reserves** | **reserves** | **no** | yes | 11.2 | 0.0 | 1.9 | 13.2 | 5.3.0 | v16 | out — Reserved Font Name; no real 700 |  |
| Hepta Slab | serif | yes | no | no | no | yes | yes | 21.0 | 22.2 | 1.9 | 45.1 | 5.3.0 | v25 | admitted |  |
| Josefin Slab | serif | yes | **reserves** | **reserves** | **reserves** | yes | yes | 11.6 | 11.1 | 2.0 | 24.7 | 5.3.0 | v29 | out — Reserved Font Name |  |
| Kreon | serif | yes | **reserves** | **reserves** | **reserves** | yes | yes | 15.3 | 15.2 | 1.9 | 32.5 | 5.3.0 | v40 | out — Reserved Font Name |  |
| Noticia Text | serif | yes | **reserves** | **reserves** | **reserves** | yes | yes | 22.1 | 21.8 | 1.9 | 45.9 | 5.3.0 | v16 | out — Reserved Font Name |  |
| Patua One | display | yes | **reserves** | **reserves** | **reserves** | **no** | yes | 12.6 | 0.0 | 1.9 | 14.5 | 5.3.0 | v22 | out — Reserved Font Name; no real 700 |  |
| Podkova | serif | yes | no | no | no | yes | yes | 13.8 | 14.6 | 2.0 | 30.5 | 5.3.0 | v33 | admitted |  |
| Roboto Slab | serif | **no** | — | — | no | yes | yes | 13.7 | 13.9 | 3.9 | 31.4 | 5.3.0 | v36 | out — licence Apache-2.0 |  |
| Rokkitt | serif | yes | no | no | no | yes | yes | 13.1 | 13.1 | 2.0 | 28.2 | 5.3.0 | v39 | admitted | Zilla Slab |
| Solway | serif | yes | no | no | no | yes | yes | 20.8 | 21.3 | 1.9 | 44.0 | 5.3.0 | v19 | admitted |  |
| Zilla Slab | serif | yes | no | no | no | yes | yes | 25.9 | 25.5 | 1.9 | 53.3 | 5.3.0 | v12 | admitted | Bitter |

### display — 15 admitted of 21

| family | Google category | OFL 1.1 | google/fonts | author | @fontsource line | latin 400+700 | name | 400 KB | 700 KB | licence KB | total KB | npm | Google | verdict | substitute |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Abril Fatface | display | yes | **reserves** | **reserves** | **reserves** | **no** | yes | 12.9 | 0.0 | 1.9 | 14.8 | 5.3.0 | v25 | out — Reserved Font Name; no real 700 |  |
| Anton | sans-serif | yes | no | no | no | **no** | yes | 18.2 | 0.0 | 2.0 | 20.2 | 5.3.0 | v27 | out — no real 700 |  |
| Antonio | sans-serif | yes | no | no | no | yes | yes | 10.8 | 10.8 | 2.0 | 23.6 | 5.3.0 | v22 | admitted |  |
| Archivo Black | sans-serif | yes | no | no | no | **no** | yes | 18.2 | 0.0 | 2.0 | 20.2 | 5.3.0 | v23 | out — no real 700 |  |
| Barlow Condensed | sans-serif | yes | no | no | no | yes | yes | 20.7 | 21.9 | 1.9 | 44.6 | 5.3.0 | v13 | admitted |  |
| Bebas Neue | sans-serif | yes | no | no | no | **no** | yes | 13.5 | 0.0 | 1.9 | 15.4 | 5.3.0 | v16 | out — no real 700 |  |
| Big Shoulders Display | display | yes | no | no | no | yes | yes | 14.2 | 14.1 | 1.9 | 30.2 | 5.3.0 | v21 | admitted |  |
| Bricolage Grotesque | sans-serif | yes | no | no | no | yes | yes | 21.9 | 21.9 | 1.9 | 45.7 | 5.3.0 | v9 | admitted |  |
| Cinzel | serif | yes | no | no | no | yes | yes | 13.8 | 14.9 | 1.9 | 30.6 | 5.3.0 | v26 | admitted |  |
| Comfortaa | display | yes | **reserves** | **reserves** | **reserves** | yes | yes | 13.3 | 13.1 | 2.0 | 28.4 | 5.3.0 | v47 | out — Reserved Font Name |  |
| Darker Grotesque | sans-serif | yes | no | no | no | yes | yes | 12.8 | 13.0 | 1.9 | 27.8 | 5.3.0 | v10 | admitted |  |
| Familjen Grotesk | sans-serif | yes | no | no | no | yes | yes | 11.4 | 11.6 | 1.9 | 24.9 | 5.3.0 | v11 | admitted |  |
| Fredoka | sans-serif | yes | no | no | no | yes | yes | 15.7 | 15.5 | 1.9 | 33.2 | 5.3.0 | v17 | admitted |  |
| League Spartan | sans-serif | yes | no | no | no | yes | yes | 12.5 | 12.6 | 1.9 | 27.1 | 5.3.0 | v15 | admitted |  |
| Oswald | sans-serif | yes | no | no | no | yes | yes | 12.0 | 12.4 | 2.0 | 26.3 | 5.3.0 | v57 | admitted |  |
| Passion One | display | yes | **reserves** | no | **reserves** | yes | yes | 7.4 | 7.3 | 1.9 | 16.6 | 5.3.0 | v20 | out — discrepancy between google/fonts and the author's licence |  |
| Space Grotesk | sans-serif | yes | no | no | no | yes | yes | 13.1 | 12.6 | 2.0 | 27.6 | 5.3.0 | v22 | admitted |  |
| Syne | sans-serif | yes | no | no | no | yes | yes | 13.0 | 13.8 | 1.9 | 28.7 | 5.3.0 | v24 | admitted |  |
| Teko | sans-serif | yes | no | no | no | yes | yes | 7.6 | 7.1 | 1.9 | 16.6 | 5.3.0 | v23 | admitted |  |
| Unbounded | sans-serif | yes | no | no | no | yes | yes | 19.5 | 20.6 | 1.9 | 42.0 | 5.3.0 | v12 | admitted |  |
| Yanone Kaffeesatz | sans-serif | yes | no | no | no | yes | yes | 14.9 | 14.3 | 2.0 | 31.1 | 5.3.0 | v34 | admitted |  |

### The whole face of the reserved names most asked for (for sprint 30)

| family | latin 400+700 + licence KB | every subset of 400+700 + licence KB | difference KB |
|---|---|---|---|
| Lato | 47.5 | 58.5 | +11.0 |
| Raleway | 46.0 | 144.7 | +98.7 |
| Lora | 43.1 | 174.4 | +131.2 |
| Merriweather | 97.5 | 280.6 | +183.2 |
| Playfair Display | 45.9 | 104.9 | +59.0 |

### Out on a discrepancy, with both texts

- **Playfair Display**
  - google/fonts `ofl/playfairdisplay/OFL.txt`: «Copyright 2017 The Playfair Display Project Authors (https://github.com/clauseggers/Playfair-Display), with Reserved Font Name "Playfair Display"»
  - author `https://github.com/clauseggers/Playfair`: «Copyright 2005–2023 The Playfair Project Authors (https://github.com/clauseggers/Playfair)»
- **Source Serif 4**
  - google/fonts `ofl/sourceserif4/OFL.txt`: «Copyright 2014 The Source Serif 4 Project Authors (https://github.com/adobe-fonts/source-serif)»
  - author `https://github.com/adobe-fonts/source-serif`: «Copyright 2014 - 2023 Adobe (http://www.adobe.com/), with Reserved Font Name ‘Source’. All Rights Reserved. Source is a trademark of Adobe in the United States and/or other countries.»
- **Passion One**
  - google/fonts `ofl/passionone/OFL.txt`: «Copyright (c) 2011 Fontstage (info@fontstage.com), with Reserved Font Names, 'Passion'»
  - author `https://github.com/googlefonts/googlefontdirectory-hg`: «Apache License Version 2.0, January 2004 http://www.apache.org/licenses/ TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION 1. Definitions. "License" shall mean the terms and conditions for use, reproduction, and distribution as defined by Sections 1 through 9 of this document. "Licensor" shall mean the copyright owner or entity authorized by the copyright owner that is granting the License. "Legal Entity" shall mean the union of the acting entity and all other entities that control, are controlled by, or are under common control with that entity. For the purposes of this definition, "control" means (i) the power, direct or indirect, to cause the direction or management of such entity, whether by contract or otherwise, or (ii) ownership of fifty percent (50%) or more of the outstanding shares, or (iii) beneficial ownership of such entity. "You" (or "Your") shall mean an individual or Legal Entity exercising permissions granted by this License. "Source" form shall mean the preferred form for making modifications, including but not limited to software source code, documentation source, and configuration files. "Object" form shall mean any form resulting from mechanical transformation or translation of a Source form, including but not limited to compiled object code, generated documentation, and conversions to other media types. "Work" shall mean the work of authorship, whether in Source or Object form, made available under the License, as indicated by a copyright notice that is included in or attached to the work (an example is provided in the Appendix below). "Derivative Works" shall mean any work, whether in Source or Object form, that is based on (or derived from) the Work and for which the editorial revisions, annotations, elaborations, or other modifications represent, as a whole, an original work of authorship. For the purposes of this License, Derivative Works shall not include works that remain separable from, or merely link (or bind by name) to the interfaces of, the Work and Derivative Works thereof. "Contribution" shall mean any work of authorship, including the original version of the Work and any modifications or additions to that Work or Derivative Works thereof, that is intentionally submitted to Licensor for inclusion in the Work by the copyright owner or by an individual or Legal Entity authorized to submit on behalf of the copyright owner. For the purposes of this definition, "submitted" means any form of electronic, verbal, or written communication sent to the Licensor or its representatives, including but not limited to communication on electronic mailing lists, source code control systems, and issue tracking systems that are managed by, or on behalf of, the Licensor for the purpose of discussing and improving the Work, but excluding communication that is conspicuously marked or otherwise designated in writing by the copyright owner as "Not a Contribution." "Contributor" shall mean Licensor and any individual or Legal Entity on behalf of whom a Contribution has been received by Licensor and subsequently incorporated within the Work. 2. Grant of Copyright License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare Derivative Works of, publicly display, publicly perform, sublicense, and distribute the Work and such Derivative Works in Source or Object form. 3. Grant of Patent License. Subject to the terms and conditions of this License, each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable (except as stated in this section) patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer the Work, where such license applies only to those patent claims licensable by such Contributor that are necessarily infringed by their Contribution(s) alone or by combination of their Contribution(s) with the Work to which such Contribution(s) was submitted. If You institute patent litigation against any entity (including a cross-claim or counterclaim in a lawsuit) alleging that the Work or a Contribution incorporated within the Work constitutes direct or contributory patent infringement, then any patent licenses granted to You under this License for that Work shall terminate as of the date such litigation is filed. 4. Redistribution. You may reproduce and distribute copies of the Work or Derivative Works thereof in any medium, with or without modifications, and in Source or Object form, provided that You meet the following conditions: (a) You must give any other recipients of the Work or Derivative Works a copy of this License; and (b) You must cause any modified files to carry prominent notices stating that You changed the files; and (c) You must retain, in the Source form of any Derivative Works that You distribute, all copyright, patent, trademark, and attribution notices from the Source form of the Work, excluding those notices that do not pertain to any part of the Derivative Works; and (d) If the Work includes a "NOTICE" text file as part of its distribution, then any Derivative Works that You distribute must include a readable copy of the attribution notices contained within such NOTICE file, excluding those notices that do not pertain to any part of the Derivative Works, in at least one of the following places: within a NOTICE text file distributed as part of the Derivative Works; within the Source form or documentation, if provided along with the Derivative Works; or, within a display generated by the Derivative Works, if and wherever such third-party notices normally appear. The contents of the NOTICE file are for informational purposes only and do not modify the License. You may add Your own attribution notices within Derivative Works that You distribute, alongside or as an addendum to the NOTICE text from the Work, provided that such additional attribution notices cannot be construed as modifying the License. You may add Your own copyright statement to Your modifications and may provide additional or different license terms and conditions for use, reproduction, or distribution of Your modifications, or for any such Derivative Works as a whole, provided Your use, reproduction, and distribution of the Work otherwise complies with the conditions stated in this License. 5. Submission of Contributions. Unless You explicitly state otherwise, any Contribution intentionally submitted for inclusion in the Work by You to the Licensor shall be under the terms and conditions of this License, without any additional terms or conditions. Notwithstanding the above, nothing herein shall supersede or modify the terms of any separate license agreement you may have executed with Licensor regarding such Contributions. 6. Trademarks. This License does not grant permission to use the trade names, trademarks, service marks, or product names of the Licensor, except as required for reasonable and customary use in describing the origin of the Work and reproducing the content of the NOTICE file. 7. Disclaimer of Warranty. Unless required by applicable law or agreed to in writing, Licensor provides the Work (and each Contributor provides its Contributions) on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied, including, without limitation, any warranties or conditions of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A PARTICULAR PURPOSE. You are solely responsible for determining the appropriateness of using or redistributing the Work and assume any risks associated with Your exercise of permissions under this License. 8. Limitation of Liability. In no event and under no legal theory, whether in tort (including negligence), contract, or otherwise, unless required by applicable law (such as deliberate and grossly negligent acts) or agreed to in writing, shall any Contributor be liable to You for damages, including any direct, indirect, special, incidental, or consequential damages of any character arising as a result of this License or out of the use or inability to use the Work (including but not limited to damages for loss of goodwill, work stoppage, computer failure or malfunction, or any and all other commercial damages or losses), even if such Contributor has been advised of the possibility of such damages. 9. Accepting Warranty or Additional Liability. While redistributing the Work or Derivative Works thereof, You may choose to offer, and charge a fee for, acceptance of support, warranty, indemnity, or other liability obligations and/or rights consistent with this License. However, in accepting such obligations, You may act only on Your own behalf and on Your sole responsibility, not on behalf of any other Contributor, and only if You agree to indemnify, defend, and hold each Contributor harmless for any liability incurred by, or claims asserted against, such Contributor by reason of your accepting any such warranty or additional liability. END OF TERMS AND CONDITIONS APPENDIX: How to apply the Apache License to your work. To apply the Apache License to your work, attach the following boilerplate notice, with the fields enclosed by brackets "[]" replaced with your own identifying information. (Don't include the brackets!) The text should be enclosed in the appropriate comment syntax for the file format. We also recommend that a file or class name and description of purpose be included on the same "printed page" as the copyright notice for easier identification within third-party archives. Copyright [yyyy] [name of copyright owner] Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.»
