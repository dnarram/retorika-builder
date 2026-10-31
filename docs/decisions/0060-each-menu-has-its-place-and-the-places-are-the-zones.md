# 0060 — Each menu has its place, and the places are the zones

**Status:** proposed · **Date:** 2026-10-31 · **Decided by:** David, 30 de octubre de 2026, al
aprobar el plan del sprint 31 — the four decisions he took while planning (a selector of fixed places
that are the zones of a future drag; the side column as a fixed rail with the content keeping its
width free; the brand and the button going with the pages behind a checkbox; of the section
navigator's dispositions, only the column and the «Ir a…» disclosure) and the four adjustments he
made approving it. · **Recorded by development at his instruction, with the standing note that
development does not sign.** · **Amends:** [ADR 0057](0057-the-header-is-the-owners.md) (§7: the
header is no longer always «the bar before `<main>`»; and its «What this does not decide»). ·
**Relates to:** [ADR 0058](0058-a-published-page-carries-one-script-and-it-is-constant.md) (the
script reads across the page now), [ADR 0061](0061-the-canvas-lays-out-at-1280-and-scales.md) (the
canvas that shows a rail as a visitor at 1280 sees it), [ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md)
(placement inside a section, which this is not) · **Touches:** `packages/schema` (1.17.0, migration
`0018`), `packages/renderer`, `apps/editor` (the state the «Menú» panel reads).

## Context

ADR 0057 made the header the owner's: two menus, each shown or not, labelled, ordered, with a brand
and a button, three layouts of one bar and a look by tokens. Every one of those things sat in the same
place — a bar above `<main>`. David's request for sprint 31, in his words: the pages menu and the
section navigator «pasen a tratarse como dos elementos completamente independientes entre sí, cada
uno con su propia posición dentro de la página, no atados a una única cabecera superior».

Two readings were costed before planning, and he chose. **Draggable, like an element of a free
section**, was refused: a menu belongs to the whole site and to no section, so a position on the
canvas would be a coordinate of the page — the thing rule 4 has refused three times (27 and 30
September, 20 October 2026) — and its contrast and its overflow could not be proved for an arbitrary
place. **A selector of fixed places** was chosen, with his condition: the places of the selector are
exactly the zones a future drag gesture will drop a menu on, so the gesture, when it comes, is a way of
choosing a place and never a way of making one.

## Decision

### 1. Each menu has a place from a closed vocabulary, and every word is a zone

`header.pages.position` is `bar`, `left` or `right`. `header.sections.position` is `bar`, `row`,
`left`, `right` or `fold`. **No position will exist without a zone to drop a menu on, and no zone
without a position** — written here so that a future place is added to both or to neither. A place is
a reference to a zone of the page, never a coordinate: rule 4 is not amended, and rule 5 keeps the
reading ADR 0057 gave it, a set of references and preferences outside the pages.

An absent position is the bar, which is the header as it was. `sections.row: "own"`, the one place key
1.16.0 had, is absorbed: it is `position: "row"` from 1.17.0, and migration `0018` moves the one corpus
fixture that carried it. `"shared"` was the bar, which an absent position already means.

`sections.mobile` gains `fold`: on a phone the sections become a row under the bar, nothing, or the
«Ir a…» disclosure beside «Menú» — whatever their place on a wide screen. The disclosure itself,
`fold` at any width, is drawn from día 3; until then the renderer refuses a document that names it with
an explicit error, because an empty place is what would be published otherwise, and nothing in the
editor can write it before the panel of día 5.

### 2. The rail is one mechanism for both menus

A menu placed `left` or `right` gets a copy in a **rail**: a column fixed beside the content, the
height of the window, **240 px wide**. On the same side the two menus stack in one rail, the pages
first, told apart by a rule above the second rather than beside it. On opposite sides there are two
rails and three columns.

- **`<main>` and the bar both keep the rail's width free**, so a full-height column never covers the
  brand or the first section. The rails are fixed, so the header's own margin does not move them.
- **`overflow: hidden auto` and not `auto`**: one non-visible axis turns the other `auto`, and a box
  that scrolls sideways exempts what is inside it from the overflow walk. A rail scrolls down when its
  entries outgrow the window, and never across.
- **The bar's scheme**, background and words, because a rail is the bar standing up. A `transparent`
  bar's rail is `surface`: nothing lies under a column to show through. Rule 6's «Barra» part dresses
  the rail too, and only in a document that has one, so a saved site without a rail keeps its bytes.
- **z-index 2**, under the skip link's 3: the first Tab stop is drawn over a rail on the left.
- **In the document, after the bar and before `<main>`**, inside the `<header>`: one banner holds the
  whole of the site's navigation, and a keyboard reaches the skip link, the bar, the rails and then the
  page — the order the eye reads a page with a column beside it, on either side.

### 3. The bar keeps every copy, because the bar is where a rail falls

Rails stand from **1024 px** up (`RAIL_FOLD_WIDTH`). Under it every rail falls into the bar, and the
brand and the button come back with the pages. Two rails on opposite sides need **1248 px**
(`TWO_RAILS_FOLD_WIDTH`) for the same content width between them; between 1024 and 1247 the sections'
rail falls first. The numbers are the floor the overflow suite already proves: 1024 − 240 = 784 and
1248 − 480 = 768, never under 768 of content.

So **the bar keeps every copy it had** — the wide strip with both menus, the button, the phone's
`<details>`, the row — and which copy is seen at a width is `display: none`, the one way to take a
landmark out of the accessibility tree. The rail is hidden by default and shown from its width up, so
on a tablet or a phone no rail exists for anybody and the phone's header is exactly the one ADR 0057
drew: the pages fold into «Menú» however they sit on a wide screen. The thresholds live in the
header's own `@media` blocks: rule 7 does not reach the header (ADR 0057), and the document keeps its
one breakpoint.

### 4. The brand and the button may go with the pages

`header.brandWithPages` — «La marca y el botón van con el menú de páginas» — takes the brand and the
button into the pages menu's rail, the brand first and the button last. **Only where the pages menu is
drawn in a rail**: with the pages in the bar or switched off, the brand stays in the bar and the key
does nothing, which is not an error. Under 1024 they are back in the bar with everything else.

### 5. A bar with nothing left collapses, and is still the header

When every menu of a page stands in a rail and the brand and the button went with the pages or were
never there, the bar has nothing to draw on a wide screen: `data-bar="none"` takes its padding, its
line, its background and its shadow away, and no anchor keeps room for it. It is still the `<header>`
— the element that holds the rails and the copies they fall back to — and at the widths where the
rails stand it is no height at all. With two rails it collapses only from 1248, since under it the
sections are back in it.

### 6. The script reads across the page

ADR 0058's script found the bar and read only inside it. A menu in a rail is the header's child and not
the bar's, and the disclosure of día 3 stands apart from both: the script now reads the disclosures
(`details.rb-nav-narrow`, `details.rb-nav-fold`) and the section links across the page, marks every
copy of the entry in view, and keeps its observer clear of the bar only when the bar is fixed over the
page. It still measures the bar for `--rb-header-h`, and a rail takes no height, so a header whose
menus all stand in rails measures 0 and no anchor lands under a ghost. One constant string, nothing of
the document in it, **815 bytes gzipped** of the 2 KB (794 before).

## What is preserved

- **Every saved site publishes what it published.** An absent position is the bar; the one stored
  place key is moved by `0018` to the word that means the same; the rail's stylesheet travels only in
  a document that uses a rail. The four goldens with a header move by the script's bytes, the
  attributes' words (`data-pages="bar"`, `data-sections="bar"` for `"shared"`, `"row"` for `"own"`) and
  one selector that names the row; the eighteen without one do not move.
- **The phone**, exactly: rails do not exist under 1024.
- **Rules 4, 5 and 7**, unamended (above).
- **One banner, two `<nav>` with distinct names at every width**, the copies alternated by
  `display: none`.

## What is lost, and it is named

- **The header is no longer one bar above `<main>`**: ADR 0057 §7's shape gains up to two rails after
  the bar, and a bar that may be no height at all.
- **A page that uses a rail carries a second copy of each placed menu** in its markup, as the phone's
  `<details>` already did for the pages.

## What this does not decide

- **The drag gesture itself**: another sprint, on these zones.
- **Dots like a slideshow, and a floating pill at the bottom**, refused to the backlog with David's
  reasons: dots cannot be read on a touch screen without a visible label; the pill collides with
  Safari's bottom bar and with third-party widgets, and the row and the disclosure already do its
  work.
- **A pages menu at the bottom of the page**: nobody asked for it, and it meets what the pill meets.
- **The brand and the button each with a place of their own** (four selectors): refused; the checkbox
  covers the column with a logo without opening 256 combinations.
- **A look of the rail's own**, apart from the bar's: the rail is the bar's, and rule 6's parts stay
  five.
- **A mobile patch of the header** (rule 7): still its own derivation; the two new widths are the
  header's own `@media` blocks, not `breakpoints`.

## Consequences

- `packages/schema`: `PAGES_POSITIONS`, `SECTIONS_POSITIONS`, `SECTIONS_ON_MOBILE` with `fold`,
  `brandWithPages`; `sections.row` and `SECTIONS_ROWS` gone; 1.17.0; `migrations/0018-each-menu-has-its-place.ts`
  with its tests; the snapshot; `cabecera-con-marca.json` at 1.17.0.
- `packages/renderer`: `header.ts` — the settings, the rails, `data-pages`/`data-sections`/
  `data-rails`/`data-brand`/`data-bar`, the rail's stylesheet (`railCss`), `RAIL_WIDTH`,
  `RAIL_FOLD_WIDTH`, `TWO_RAILS_FOLD_WIDTH` exported; `headerScript.ts`; tests in `header.test.ts`,
  `headerScript.test.ts`, `menu.test.ts`; the goldens, diff read.
- `apps/editor`: `headerState.ts` reads the places and gains `pagesPositionPatch`,
  `sectionsPositionPatch` and `brandWithPagesPatch`; «Secciones en su propia fila» writes
  `position: "row"`. The panel's «Dónde va» is día 5's.
- Day by day in `docs/design/REVIEW.md`, sprint 31 día 2.
