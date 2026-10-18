# 0046 — The gallery ships the faces, so the letter can be named

**Status:** proposed · **Date:** 2026-10-18 · **Decided by: David, 17 de octubre de 2026**, opening
sprint 24: *«Quiero poder seleccionar la fuente de letra exacta para la página y/o cualquier texto
(ten en cuenta que la fuente es uno de los elementos visuales más importantes del branding
corporativo)»*, and, choosing among three ways of answering it, **«una galería de fuentes que
enviamos»** — chosen by their real names, headings and text separately, and only the ones the site
uses travel · **Recorded by development, which does not sign** · **Relates to:**
[ADR 0028](0028-typography-needs-a-decision-from-direction.md) (ship the faces),
[ADR 0032](0032-typography-per-element-with-the-faces-that-travel.md) (two references per text),
[ADR 0045](0045-the-serif-this-product-ships-reserves-no-name.md) (no reserved name),
[ADR 0011](0011-sample-photos-per-sector.md) (a licence read and dated),
[ADR 0001](0001-static-published-sites.md) · **Touches:** `packages/renderer`,
`packages/publisher`, `scripts/size-budget.ts`, `apps/editor`

## Context

Three type pairs, named by character — «Editorial y serena», «Moderna y clara», «Clásica y seria» —
and the reason written beside them was that **a font might not reach the visitor**: a stack is a list
of wishes, and a page that names a family nobody has installed shows whatever the machine happens to
have. ADR 0028 removed that reason for two families by shipping their faces; the rule stayed.

What made it a promise rather than a preference is the approved advanced dossier §4, which offers
«tipografías propias» in the state it describes as switched on, and the backlog row open since
incidencia #9. David's request is that row, and his own answer to it is the one this records.

Before this day `SHIPPABLE_FAMILIES` was **two rows**, and its safety property was already the right
one: *a document may **choose** a row from this table and can never **name** a file.*

## Decision

### 1. A family is chosen by its real name, because we ship it

«Named by character, never by font» existed because the face might not arrive. **Sending it is what
makes naming it honest**, and from here on the gallery names Figtree, Spectral and the rest.

The three pairs stay, unchanged and first: an owner who wants «Clásica y seria» and no further
questions still gets one click, and the gallery is what sits underneath for the owner who has a
brand to match. Naming a family is **not** an exception to document rule 6 — the theme still holds a
reference to a stack this product composed, not an exact value the owner typed.

### 2. The gallery is a closed table in the renderer, eight families, alphabetical

`SHIPPABLE_FAMILIES` grows from two rows to **eight**, sixteen faces. What does not change is the
property: **a document selects a row; it can never name a file.** Nothing in a document is joined to
a path, here or in the editor's `fonts/[file]` route, whose servable set is derived from this same
table and therefore grows with it rather than beside it.

**Alphabetical by family**, which is a decision and not the order they were added in: it is the
order a published page emits its `@font-face` rules in, so `INV_5` and the golden corpus depend on
it being stated.

**One guard changed direction, and that is the real cost of this decision.** The old drift test said
every row must be named first by some type pair — true while the table *was* the pairs' two
families, where a row nobody named meant bytes nobody could ever see. The gallery is precisely a row
no pair names. So it is replaced by three guards that hold with eight rows and would have held with
two:

- **Every row is reachable by a document**, and selecting it brings that row's faces and nothing
  else: a row with a name no document could match fails.
- **Every file is named after its own family**, kebab-cased, `@fontsource`'s own convention — so a
  typo in either half no longer agrees with the other. *This was found by sabotage*: the reachability
  test builds its document out of the table's own name, so a row misspelled in one place validates
  itself. A test that cannot fail is not a test.
- **Every row against the package's `metadata.json`** in `packages/publisher/test/fonts.test.ts`,
  which is the only place that may read it: the renderer imports nothing outside schema and catalog,
  because everything there travels to the client's site.

### 3. Four filters, and a family enters only through all four

A family enters the gallery when, **read from its own `@fontsource` `metadata.json` and its `LICENSE`
on 18 October 2026**:

1. **The licence is OFL 1.1**, declared and present as text, so a client may redistribute the bytes
   from their own domain. ADR 0011's discipline for a photograph, applied to a face.
2. **It declares no Reserved Font Name** on its copyright line (ADR 0045). The latin slice in woff2
   is a *Modified Version* twice over, and §3 would not let a reserved name travel with it.
3. **It has a latin subset and real 400 and 700.**
4. **Its name matches `/^[A-Za-z][A-Za-z0-9]*(?: [A-Za-z0-9]+)*$/`**, the pattern `escape.ts` admits:
   no apostrophe, no hyphen, no accent. A family whose own name cannot be emitted safely is a family
   this product does not offer.

**The eight, measured gzipped — which is how the budget weighs — from the installed packages:**

| family | kind | faces 400+700 | with its licence | version |
|---|---|---|---|---|
| Bitter | serif (slab) | 36.3 KB | 38.3 | v42 |
| DM Sans | sans | 27.8 | 29.8 | v17 |
| EB Garamond | serif (old-style) | 48.0 | 50.0 | v33 |
| Figtree | sans | 22.2 | 24.1 | v9 |
| Inter | sans | 46.9 | 48.8 | v20 |
| Libre Baskerville | serif (transitional) | 39.6 | 41.5 | v24 |
| Spectral | serif (screen) | 43.7 | 45.7 | v15 |
| Work Sans | sans (grotesque) | 39.8 | 41.7 | v24 |

Four sans and four serifs, chosen for a **spread of character** rather than for the eight lightest:
an owner matching a brand needs a geometric and a grotesque to be different things, not two near
neighbours. The same survey measured and did not ship Karla, Nunito Sans, Manrope, Public Sans,
Source Sans 3, Libre Franklin and Rubik among the sans, and Source Serif 4 and Crimson Pro among the
serifs — all of which passed the licence filter. **Lora and Merriweather failed filter 2**, which is
where ADR 0045 found the question in the first place.

### 4. Both weights are required, and no family enters on one

Filter 3 could have been relaxed: admit a display family with only 400, for headings, with
`font-synthesis: none` so no browser invents a bold. It is refused.

`--font-heading` is read by `h1`, `h2` and `h3` — **700** by the browser's own default — and by
`p.rb-subtitle`, the cover's tagline, which is **400**. A one-weight family would therefore mean one
thing in a headline and another in the line under it, or else headings that stop being bold without
the owner having asked for that. **The owner's choice has to mean the same thing everywhere it
lands.**

The cost is named: **the gallery has no display family**, which is the kind a brand often uses for a
single headline. A family that fails only this filter is a reopening condition for this ADR, not a
thing to quietly let through.

### 5. The weight budget splits in two, with both numbers measured

Until today the faces counted inside **80 KB of «our own bytes»** — a number chosen in sprint 11 so
that «a third family cannot slip in without it being seen». The gallery lets a theme name a shipped
family for the heading **and** for the body, so the worst case doubles, and raising the 80 would have
retired the only number here that protects the part we author: our own bytes measure **7.1 KB**, and
inside a budget of 120 nothing could ever have fired it.

So, measured gzipped on 18 October 2026:

- **`MAX_FONT_GZIP_BYTES` = 115 KB, the faces on their own line.** A bundle carries **at most two
  families** — the schema holds exactly two font tokens, the renderer ships a face only for a token's
  first family, and sprint 24 decided against a third slot — so the ceiling is sized from the
  heaviest pair the table can produce: **EB Garamond and Inter, 98.7 KB** with both licences. 115
  leaves 16.3 KB over it. Every site on «Clásica y seria» measures 50.0 KB today.
- **`MAX_BUNDLE_GZIP_BYTES` = 20 KB, faces excluded**, where the heaviest bundle of ours measures
  7.1 KB. Roughly 2.8× the worst case: an uncompressed asset or a second stylesheet fires it, where
  the old 80 could not.

**The number that protects the page stays honest and the cost of the letter becomes explicit.** The
per-page allowance keeps growing the second number only: a face is counted once per site, however
many pages name it.

### 6. Half a megabyte of generated base64, and it is measured rather than assumed

`packages/publisher/src/fontData.ts` carries the faces as base64 because three ways of reading them
from `node_modules` each passed every test and failed inside Next's bundled server runtime. Eight
families make that file **456.6 KB, 24 entries**, against 139.7 KB and 6.

The risk named in the plan was the download server's start-up, so it was measured, three boots each,
on this machine on 18 October 2026:

| | `fontData.ts` | Next's own «Ready in» | first 200 on a face | warm | `.next/server` |
|---|---|---|---|---|---|
| two families | 139.7 KB | 55, 57, 56 ms | 0.29 s | 2 ms | 57 560 KB |
| eight families | 456.6 KB | 58, 56, 56 ms | 0.29–0.30 s | 2 ms | 58 192 KB |

**No measurable start-up cost**: the two ranges overlap, and the 0.29 s is the time to spawn `curl`,
not the server's. What the bytes do cost is **632 KB in the built server output** and 317 KB in the
repository. In the client's ZIP they cost nothing: only the faces the theme names travel.

## What is preserved

- **The owner gets the letter they chose, on every machine**, which is ADR 0028's whole point.
- **A document never names a file.** Eight rows, same property, same guard.
- **A face never travels without its licence**, and `buildSite` still refuses a face without one.
- **A site that needs no face carries no font bytes at all** — seventeen of the nineteen corpus
  documents, sixteen of them measuring 1.9–2.6 KB of ours and the thirteen-page one 23.3.
- **The three pairs**, their names and their stacks, untouched. Nothing migrates and no golden moves.

## What is lost, and it is named rather than glossed

- **Six of the eight rows are reachable by no interface yet.** The engine lands today and the gallery
  the owner reads lands tomorrow (sprint 24 día 6). Until then those bytes are in the repository and
  in no ZIP. This is exactly what the retired guard used to forbid, and the honest thing is that it
  was retired on purpose and the condition moved: **the editor's gallery must offer every row**, and
  that is día 6's assertion, not a thing to remember.
- **Eight families is a commitment, not a catalogue.** ADR 0045 has just shown what removing one
  costs: a schema migration, because a theme stores the resolved stack. A family added here can be
  taken out again only at that price.
- **No display family**, as §4 says.
- **The licence reading is dated, not continuous.** It is read from the pinned version, and the pins
  are exact — in `packages/publisher/package.json` and in the root's — so a different face cannot
  arrive under a reading made of another one.

## What this does not decide

- **The gallery the owner sees**: specimens, the two choices for headings and text, and how the
  floating toolbar's two references become the two the owner chose. Sprint 24 día 6.
- **A third slot.** `font.accent` was asked and refused by David: it is a new key in a `strictObject`
  that demands all of them — a migration, a version bump, nineteen goldens moving — and a third
  family in the ZIP of whoever used it.
- **Which family an owner should use.** The product offers eight and recommends three pairs.
- **Windows.** ADR 0028's table still reads «not measured» where Windows should be, and
  `fixtures/font-check.html` is still the procedure. It now covers eight families rather than two.

## Consequences

- `packages/renderer`: `SHIPPABLE_FAMILIES` is eight rows; three comments corrected, including one
  that still explained the table by Playfair Display's reserved name.
- `packages/publisher`: `FONT_SOURCES` is sixteen entries with eight licence paths; `fontData.ts`
  regenerated to 24 entries; the package's own `package.json` declares all eight, pinned exactly —
  it did not, and the lockfile already did, which `pnpm install --frozen-lockfile` would have caught
  in CI.
- `scripts/size-budget.ts`: two budget lines, each with its measurement written beside it.
- `apps/editor`: the `fonts/[file]` route's servable set grows by construction; its comment said
  «four entries today».
- Tests: one drift guard replaced by three; a new test reads each package's `metadata.json` and
  asserts the four filters over every row.
- The record is `docs/design/REVIEW.md`, sprint 24, and the backlog's «tipografías propias» row is
  struck on the sprint's last day, when the owner can actually choose one.
