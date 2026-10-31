# 0057 — The header is the owner's: two menus that are chosen, named and dressed

**Status:** proposed · **Date:** 2026-10-28 · **Decided by:** David, 28 de octubre de 2026, al
planificar el sprint 30 — la petición en sus propias palabras: «el apartado anterior a la primera
sección de la página editada en el editor […] el menú de navegación […] dividir ese menú en 2: la
posible creación de un menú para navegar las distintas páginas […] y un navegador para que dentro de
la página abierta el usuario pueda hacer clic y el sistema llevarlo directamente a la sección
clicada. Ambos puntos son opcionales […] Es importante que el usuario tenga completa personalización
de ambos menús». Four decisions of his on planning and six adjustments on approving are quoted where
they bite. · **Recorded by development at his instruction, with the standing note that development
does not sign.** · **Amends:** [ADR 0023](0023-the-menu-and-the-footer-are-derived-chrome.md),
[ADR 0043](0043-the-menu-splits-in-two-and-the-owner-chooses.md) · **Relates to:**
[ADR 0022](0022-a-page-is-born-by-converting-a-section.md),
[ADR 0040](0040-a-page-per-entry-is-drawn-not-stored.md),
[ADR 0016](0016-contact-section-has-links-not-a-form.md) · **Touches:** `packages/schema`,
`packages/catalog`, `packages/renderer`, `apps/editor`

## Context

ADR 0023 made the menu derived chrome — built at render time, never stored — and ADR 0043 split it
into a pages menu and a sections menu and gave the owner one word about it: `inMenu`, whether a
destination appears. Both ADRs wrote down what they refused and why: a label of its own, because «a
label that can disagree with the section it names is the thing *se escribe solo* exists to prevent»;
an order other than the page's, because «a menu that lies about where things are»; and any stored
navigation at all, because rule 5 «leaves nowhere for a site-wide element to live».

David asked for the rest on 28 October 2026: both menus optional and independent, and the owner in
charge of what appears, what it says, how it looks and where it sits. He then named six things a
professional header has that the request did not: a phone layout that folds the pages and keeps the
sections reachable, the active section marked, smooth scrolling that does not hide an anchor under
a fixed bar, an optional fixed header, two `<nav>`s with distinct names, and a look made of tokens
with its contrast checked before download.

So the question ADR 0023 deferred — «a different decision, with a place in the document to store it»
— is being decided. This ADR is that place. Two more follow it in the same sprint and are kept apart
on purpose: the first script a published page carries (ADR 0058) and the logo stored as a photograph
(ADR 0059). One ADR, one decision.

## Decision

### 1. The header is a set of references and preferences, and it lives on the document

```ts
header?: {
  pages?:    { shown?: boolean };
  sections?: { shown?: boolean; row?: "shared" | "own"; mobile?: "row" | "hidden" };
  action?:   { kind: "section"; sectionId } | { kind: "page"; pageId };
  layout?:   "brand-left" | "centered" | "stacked";
  brand?:    { name?: boolean; logo?: { src } };
  sticky?:   boolean;  hairline?: boolean;
  look?:     { background; align; gap; uppercase; hoverUnderline; size };   // read from day 2
  style?:    Partial<Record<"bar"|"brand"|"pagesLinks"|"sectionsLinks"|"action", ElementStyle>>;
}
section.menuLabel?: string;   page.menuLabel?: string;
```

**It is not an element and it holds no content.** ADR 0023 read rule 5 correctly: there is nowhere
for a site-wide *element* to live, and there still is not. What the header holds is a reference —
one destination by id, the way a placement names an element by id — and preferences about how the
two derived menus are drawn. The words a visitor reads are still read off the page and the catalog
when the page is drawn. The one thing with content of its own, the logo, is an image value like a
photograph's and is decided by ADR 0059.

**Absent reproduces what every published site already has.** Every key is optional and every default
is what the renderer did before the object existed: the two menus by ADR 0043's threshold, no brand,
no button, the strip on the page's background with a hairline under it. A document written before
1.15.0 publishes the navigation it published before. Migration `0016` seals and moves nothing; its
`down` drops the header and the labels and says so.

### 2. The words: the kind's short name, never the heading, and the owner's own on top

A section's entry reads **the short name of its kind** from the catalog — «Servicios», «Galería»,
«Contacto», `section.<id>.menuLabel` — and never its heading. A heading is a sentence written for
the top of a block and read in context; a menu entry is the name of a place, read in a strip of five.
«Te esperamos» is a fine heading and a bad entry. A page's entry reads its title, as before.

On top of that, **an owner may write their own label**, two to twenty characters, trimmed, deleted
rather than emptied: `menuLabel` on a section and on a page (the first page's renames «Inicio»).
The derived word is the field's placeholder, so an empty field is honest about what it reads.

**This amends ADR 0043 §3, and David wrote the reason**: what must not lie is the destination, and
the destination is an id. A label cannot go stale, because it is not a copy of anything; if the
section is deleted the entry goes with it, because the entry is the section. What ADR 0023 feared —
«the same words on every page, wrong on all of them the day a page is renamed» — was a menu written
as text. This one is still written as references.

A section with no heading used to lend no entry «for want of a word to call it by». The word is now
its kind's, and it lends one. In the corpus this changed no site's threshold; it will make a menu
appear on a site whose fourth section has no title, which is the correct answer.

### 3. The order of the pages is the order of the pages

ADR 0043 ordered the pages menu by the home page's avances, to keep conversions invisible. That left
«Páginas» with a «Subir» and «Bajar» that moved the tabs and not the menu: two orders for one list,
and the one the owner could touch was the one the visitor never saw. **The menu reads `doc.pages`**,
so what the panel shows is what the site publishes. The sections keep the page's order; moving a
section moves its entry. ADR 0043's «an avance still decides where its page sits» is withdrawn.

### 4. Each menu has the owner's word, and the threshold is the default

`pages.shown` and `sections.shown`, each optional. **Absent is ADR 0043's derivation unchanged**: the
threshold of three counted over both menus on the home page, waived once any `inMenu` is present.
**Present is the owner's answer and the threshold is silent for that menu** — «siempre» draws it
under the threshold, «nunca» leaves it out above it. Two bounds survive from ADR 0043 §5: a menu
with zero destinations emits nothing whatever the owner said (the panel says so), and the pages menu
is drawn only where it holds a link to somewhere the visitor is not.

### 5. One button

`action` names one destination — a section or a page that is not the entry page and not a page drawn
per entry — drawn as a button with **exactly the words its menu entry would have**: no verb is
invented here. The generator writes a verb as the destination's own label where a sector has the
word («Reservar», «Pedir cita», ADR 0059); the renderer only reads. The destination leaves the menu
it would otherwise sit in: one destination, one place. The button points at a local anchor when its
section is on the page being drawn and into the page that holds it otherwise, which is the one place
`./index.html#sec-x` returns to the published output, and correctly.

**It can never dangle.** The invariants refuse a button at a place the document does not hold, at the
entry page, at a page drawn per entry, or at a cover, a footer or an avance; and every verb that
removes or moves a destination acts on the button first — `deleteSection` and `deletePage` drop it,
`sectionToPage` re-points it at the page the section becomes, `pageToSection` points it back at the
section the page was made from. `listDeadDestinations`, `listLinksTo` and `listAnchorsTo` read it,
so the download gate would see a dangling one and the pre-delete count includes it. The gate's pass
is unreachable through `parseDocument` and kept all the same: the route is public and the filter is
the validation, not the trust.

### 6. The brand

The business name, a logo, or both, as the first thing in the bar, **a link home — and a `<span>` on
the home page itself**, where a link to the page you are reading is worse than none (the rule «Inicio»
has followed since ADR 0043). The logo's `alt` is **derived, never stored** (David's adjustment 5):
the site name when the name is not written beside it, empty when it is, so a screen reader hears the
name once and a renamed business leaves no stale word. The brand is one line cut with an ellipsis, so
a long name never breaks the bar (adjustment 3, measured at 320px with «Taberna Santo Domingo» and a
logo: 56px). The brand is never a heading; the page's outline is untouched. How the logo gets into
the document is ADR 0059.

### 7. The shape, at every width, and what folds

```
<a class="rb-skip" href="#rb-main">Saltar al contenido</a>
<header class="rb-header" data-layout data-sections>
  brand · <div class="rb-nav-wide"> Páginas · Secciones </div> · button
  <details class="rb-nav-narrow"><summary>Menú</summary> Páginas </details>
  <nav class="rb-nav rb-nav-row" aria-label="Secciones"> … </nav>
</header>
<main id="rb-main">
```

**The pages fold, the sections do not.** On a phone the pages menu is behind a `<summary>` — a
disclosure every browser exposes as a button with its expanded state, and the only one that costs no
script (ADR 0023, ADR 0016) — and the open list hangs under the whole bar as a panel. The sections of
the page you are reading are **a horizontal row under the bar, or nothing**, as the owner chooses
(`sections.mobile`): a list of places on *this* page is what a visitor scrolls along, not what they
open a menu for. **This amends ADR 0043 §1**, which put both menus inside one `<details>`; there is
still exactly one disclosure, and it still holds everything that folds. On a wide screen the sections
share the bar or take a row of their own (`sections.row`).

Three layouts: the brand left and the links on the far side; everything centred on one line; the brand
on a line of its own and the links centred under it. Each is a `data-layout` the stylesheet reads.

**A skip link is the first thing in the body** (David's adjustment 2, WCAG 2.4.1): «Saltar al
contenido», off-screen until it has focus and the first Tab stop on every page that draws a header,
pointing at `<main id="rb-main">`. With a brand, two menus and a button a keyboard visitor would
otherwise Tab through up to ten links on every page before the first word of the site. `<main>`
carries the id on every page, header or not; `rb-` so no section id can collide with it.

### 8. The stylesheet travels only where a header does

The header's rules are emitted only for a site that draws one. The eighteen one-page corpus sites with
no menu stop carrying the strip's rules for a strip they never drew, which is why **every golden moves
once**, on the day: eighteen lose twenty-six lines of CSS and gain the `id` on `<main>`; the two with a
menu gain the `<header>`. The header's phone rules are a `@media` block of their own, so the shared
mobile block that `mobile.test.ts` pins to the letter does not move. Everything is a token; `color.
primary` on `color.surface` is the pair every palette is proved against; the button is drawn as a
section's own button is, so one site has one idea of a button.

## What is preserved

- **The destinations still write themselves.** A page is an entry because it exists, a section because
  it is on the page being drawn; the owner never sees or writes a web address.
- **`inMenu` and its reading** (ADR 0043 §3 and §5): visibility, curation by presence, and the three
  clauses of the derived answer, all unchanged for a document that has no `header`.
- **A page drawn per entry stays out** (ADR 0040 §5), and the button may not point at one.
- **Two `<nav>` landmarks with distinct names**, «Páginas» and «Secciones», at every width (David's
  point 5), and `display: none` is still what alternates the copies.
- **No `<input>`, no script.** The disclosure is a `<details>`; ADR 0058 decides the first script,
  separately, and nothing here needs it.

## What is lost, and it is named rather than glossed

- **The menu is no longer purely derived, and the dossier's sentence is read differently.** §6 says
  «El menú se escribe solo». The destinations still do; their names, their order and their dressing
  are now the owner's. The dossier is a board-approved document, so this divergence is the reason this
  ADR needs David's signature rather than development's judgement — as ADR 0043's was.
- **Two sentences of ADR 0043 are withdrawn**: the refusal of an own label (§3) and the avances'
  order (§1). Both are withdrawn with the reasons above, not around them.
- **A section with no heading now lends an entry**, so a site that had two destinations and a titleless
  third will draw a menu it did not draw. The corpus holds no such site.
- **The published markup gains a wrapper and a link** on every page that draws a header: `<header>`
  (a `banner` landmark, one per page) and the skip link.

## What this does not decide

- **The script** — the active section, Escape on the phone's menu, the shadow of a fixed bar. ADR 0058.
- **How the logo gets into the document**, raster only, and how it travels. ADR 0059.
- **A style per entry.** The header is dressed by part — bar, brand, pages' links, sections' links,
  button — and never entry by entry; a site does not dress each link differently and contrast is
  proved per part.
- **An order of the menu apart from the order of the pages.** Refused; see §3.
- **A hierarchy of pages, dropdowns.** The document has no hierarchy (ADR 0022).
- **A mobile patch for the header** (rule 7). Its phone layout is its own derivation.
- **Whether three is the right number.** Still ADR 0023's debt; the owner's word on each menu is what
  makes it stop mattering to anybody who has decided.

## Consequences

- `packages/schema`: `header.ts` (the shape, the label's bounds, `withoutActionTo`, `retargetAction`)
  and `headerVerbs.ts` (`setHeader`, `setHeaderAction`, `setMenuLabel`), kept apart because a shape
  module that imported the parser closed a circle `invariants.ts` fell into on the day. `header` on the
  document, `menuLabel` on a section and a page; invariants for the button and the labels; the header
  pass in `destinations.ts`; `deleteSection`, `deletePage`, `sectionToPage`, `pageToSection` taught.
  `SCHEMA_VERSION` 1.14.0 → 1.15.0, migration `0016`.
- `packages/catalog`: `section.<id>.menuLabel` for the seven kinds that lend an entry; `menuLabelOf`
  throws for the three that do not.
- `packages/renderer`: `menu.ts` decides the lists, `header.ts` draws the bar; `menuNodes` is gone;
  `nav.skip` in the locale. The golden corpus moves once, as described in §8, and gains
  `cabecera-con-marca` and `menu-explicito`.
- `apps/editor`: nothing of the panel yet — the model of the canvas is día 3 and the panel día 4. The
  fields drawer's sentence stops claiming the entry «es su título», because it is not.
- Day by day in `docs/design/REVIEW.md`, sprint 30.

## Note — sprint 30 día 7: a line of the bar is a number

The fixed-header subject of Lighthouse kept a CLS of 0.023 after the logo had its size (ADR 0059,
note of today). Measured in Chromium with each request held back in turn: **the page moves when the
site's letter arrives, and only then**. Every line of the bar took `line-height: normal`, which is the
letter's own ascent and descent — 18px in the fallback, 21px in EB Garamond — so the bar grew from 87
to 90px when the face landed and pushed everything under it down by 3px. It is also what the día 6
walk had met as an anchor landing 3px under a fixed bar (ADR 0058's note), cured there by measuring
again; this removes the growth itself.

`.rb-header` now sets `line-height: 1.3`, a number, so every line in it is its size times 1.3 in
whichever letter is drawing it and the bar has its final height before the letter arrives. 1.3 is EB
Garamond's own `normal`, so the corpus's bar keeps the height it had once loaded. On the subject the
CLS went from 0.023 to 0.008; what is left is the cover's own text changing height with the letter,
the same shift the three compositions have carried since before this sprint, which is the page's
reading text and not the header's to fix. `header.browser.test.ts` swaps the letter for one with
very different metrics at 1280 and 390 and asserts the bar does not move, with a control — the same
swap with the bar forced back to `normal` must move it — so it cannot pass on a machine whose fonts
happen to agree. The four goldens with a header move by that one declaration.

## Note — sprint 31 día 2: each menu has its place (ADR 0060)

§7's shape — skip link, then one bar before `<main>` — gains up to two **rails** after the bar,
inside the `<header>`: a menu placed `left` or `right` gets a copy in a fixed column beside the
content, and `sections.row` is absorbed into `sections.position` (`"own"` is `"row"`, `"shared"` the bar,
which an absent position means). The bar keeps every copy it had, because the bar is where a rail
falls — under 1024 px every rail does — and a bar left with nothing to draw on a wide screen collapses
to no height and stays the element that holds the rails. «What this does not decide» loses its silence
on where the menus sit: ADR 0060 decides it. Nothing else here moves; the phone's header is exactly
the one this ADR drew.
