# 0043 — The menu splits in two, and the owner chooses what appears in it

**Status:** proposed · **Date:** 2026-10-16 · **Decided by:** David, 16 de octubre de 2026, al
planificar el sprint 23 — la petición en sus propias palabras: «El menú (primera sección creada en
el editor) de la página en creación debería ser editable por el usuario. El usuario debería ser
capaz de decidir si una sección no debería aparecer en ese menú.» Y, entre cuatro opciones puestas
delante para los menús híbridos, eligió: «**Dos menús: uno entre páginas y otro dentro de la
página.**» · **Recorded by development at his instruction, with the standing note that development
does not sign.** · **Amends:** [ADR 0023](0023-the-menu-and-the-footer-are-derived-chrome.md) ·
**Relates to:** [ADR 0022](0022-a-page-is-born-by-converting-a-section.md),
[ADR 0040](0040-a-page-per-entry-is-drawn-not-stored.md) · **Touches:** `packages/renderer`,
`packages/schema`, `apps/editor`

## Context

ADR 0023 built one menu, derived at render time and never stored: the home page's sections as
anchors and the site's pages as links, in one strip, identical on every page. It has worked since
sprint 5, and it named its own two reopening conditions:

> «**An owner wants a page kept out of the menu**, or the entries in an order the page order does
> not give. Both are real needs on real sites, and both would mean the menu stops being purely
> derived — **which is a different decision, with a place in the document to store it.**»

David asked for the first of those on 16 October 2026, and for something ADR 0023 did not
anticipate: that the two kinds of destination be two menus rather than one.

**What was recommended, and what was chosen.** Development recommended keeping the single hybrid
menu — one navigation for the whole site, which is what a visitor expects and what the dossier
describes — with only the visibility added. David chose two menus with the costs written in front
of him. They are listed in «What is lost» below rather than discovered later.

## Decision

### 1. Two menus

**The pages of the site, and the sections of the page being drawn.**

- **The pages menu** is a property of the document: the same list on every page, in the order the
  home page's avances give, with the pages nothing points at appended. «Inicio» is prepended only
  where the visitor is not already home. A page drawn per entry contributes nothing (ADR 0040 §5).
- **The sections menu** is a property of the page being drawn — not of the home page, as before.
  Every one of its anchors is therefore local, and `./index.html#sec-x` disappears from the
  published output.

They are drawn as two `<nav>` landmarks named «Páginas» and «Secciones», side by side in one bar on
a wide screen and inside **one** `<details>` on a narrow one. Two disclosures would put two rows of
chrome above the content on a 390px phone before a word of the site appears.

**Nothing changes for a site with one page**, which is most sites: there is nowhere to navigate
between, so no pages menu is drawn and the sections menu is the strip that was always there.

### 2. The section that carries the page's `<h1>` lends no anchor

ADR 0023 excluded the cover, because the cover is the top of the page and a visitor is already
there. Under the split every page draws its own sections menu, and a converted page has no cover —
so the rule generalises to what the exclusion was always about. `packages/renderer/src/headings.ts`
is the one place that decides which section carries the h1, read by the renderer when it picks the
tag and by the menu when it decides a section is the top of the page.

### 3. The owner decides whether a destination appears — visibility only

`inMenu`, an optional boolean, on a **section** and on a **page**. Absent means it appears, which
is what absent meant before the field existed, so no stored document and no golden changes.

**Visibility and nothing else: no name of its own and no reordering.** A label that can disagree
with the section it names is the thing ADR 0023's «se escribe solo» exists to prevent, and an order
that is not the page's order is a menu that lies about where things are. Both stay refused, and
this clause does not reopen them.

**Converting carries the answer; folding back does not spread it.** `sectionToPage` stamps the
section's answer onto the page it makes, so a destination the owner pruned does not reappear as a
page. The other direction has no honest equivalent: a page holds any number of sections, so one
page's answer cannot be spread over them without hiding sections nobody decided about. What comes
back says what each section says — and a section's own answer is never lost, because the section
object itself travels into the page and out of it carrying its `inMenu`.

### 4. The threshold of three counts both menus together

Fewer than three destinations is still not navigation. **What is counted is what a visitor could be
offered — the two menus added, on the home page — and not three of each.** Three per menu is a rule
no real site survives: the corpus's only multi-page fixture has two pages and one headed section,
and a site built by converting two sections of a generated one has two and two. Both would publish
three pages with no way between them.

Counting the sum also keeps `hasMenu` identical to its old answer for every document that has not
been curated, which is why eighteen goldens hold still across this change.

### 5. Once the owner has curated, the threshold steps aside

A document where nobody has ever decided keeps the threshold. **From the moment any destination
carries `inMenu`, the menu is drawn with whatever is left** — David's own rule: «se queda si el
dueño lo ha tocado». Curation is read from the *presence* of the key, not its value, so turning a
switch off and on again leaves the document curated. That is the smaller surprise, and it is the
one the owner caused on purpose.

**Asked of the whole site, not of one page.** Whether a menu is drawn is one answer for the whole
site — the count is taken on the home page precisely so it cannot differ page to page — so the
permission to draw a small one is site-wide too. An owner who pruned the menu while standing on
page three has decided about *the menu*, and there is only one of those.

**Three bounds on it, and the third is why they are not symmetric:**

- **With zero visible destinations nothing is emitted** — no `<nav>`, no `<details>`, no empty
  disclosure. An empty landmark announced to somebody who cannot see it is worse than none.
- **One destination still draws the menu**, when the owner curated down to it. It is their site and
  their decision; what the interface owes them is the count in front of them while they make it,
  not a refusal.
- **The pages menu asks one more question of itself: it is drawn only when it holds a link to
  somewhere the visitor is not.** On the home page that means at least one other visible page,
  which is the floor of two — a strip of no pages is not navigation. Away from home «Inicio» is
  always such a link, which is how a page drawn per entry, and a page the owner took out of the
  menu, keep their way back.

  *Reworded on day 4, when the rule met the code.* The first wording said «a strip holding one link
  to the page you are already on is furniture»: that strip cannot be built, because away from home
  «Inicio» is always in front of it and on the home page the entries never include home. Read
  literally it would also have removed «Inicio» from exactly the pages it is the only way back
  from. The decision is unchanged; the sentence now says what it does.

## What is preserved

- **The menu still writes itself.** Labels are still a section's own heading and a page's own
  title, read when the page is drawn. Renaming a page is still correct everywhere at once, and the
  owner still never sees or writes a web address.
- **An avance still decides where its page sits** among the pages, so two conversions keep their
  relative order.
- **It still costs no JavaScript**, still alternates two copies with `display: none` so exactly the
  applicable one is in the accessibility tree, and still puts no `<input>` on a published page
  (ADR 0016).
- **A page drawn per entry stays out** (ADR 0040 §5), and on it the menu is still the site's own
  with «Inicio» first and no `aria-current`.

## What is lost, and it is named rather than glossed

- **Converting a section stops being invisible to a visitor.** ADR 0023's «an avance contributes
  the entry of the page it points at, **in the place the converted section used to occupy**» cannot
  hold once anchors and pages are different lists. The entry keeps its words and its destination
  and moves from the sections menu to the pages menu. «Nothing moves, nothing disappears» becomes
  «nothing disappears, and nothing moves **within its own menu**».
- **Two navigation landmarks instead of one.** ADR 0023 decided «at every width there is exactly
  one navigation landmark». There are now two, named «Páginas» and «Secciones» — distinct names are
  what makes two landmarks of one role legal, and the a11y matrix asserts the same ones are
  announced at both widths rather than counting to one.
- **It diverges from the dossier's own sentence.** §6 says «El menú se escribe solo. Refleja las
  secciones de la portada **y** las páginas que existan» — one menu reflecting both. The menu still
  writes itself; it is now two of them. The dossier is a board-approved document, so this
  divergence is the reason this ADR needs David's signature rather than development's judgement.
- **It diverges from mockup 08**, which draws one strip. That is the third divergence recorded for
  this screen in `docs/design/REVIEW.md`, after «Inicio» and the absent `Reserva` entry.
- **A curated menu is no longer purely derived.** The document now stores something about
  navigation. It is one optional boolean per destination and never a word, a URL or an order, which
  is the smallest thing that could answer the question ADR 0023 left open.

## Why this is acceptable

The cost falls almost entirely on sites that have more than one page, which is the minority, and it
buys the thing the majority asked for: a menu the owner can prune. For a one-page site the visitor
sees exactly what they saw before.

The threshold's own debt is untouched and still owed: ADR 0023's three «is a judgement with no
evidence behind it», and this ADR adds no evidence — it only stops the threshold from overruling
somebody who has decided for themselves.

## What this does not decide

- **A label of its own for a menu entry**, or an order other than the page's. Both still refused,
  for ADR 0023's reasons.
- **Hiding a section from the page**, as opposed to from the menu. `inMenu: false` changes the
  menu and nothing else: the section keeps its id, keeps its anchor, and a link pointing at it is
  still a live destination.
- **Whether three is the right number.** Still owed to whoever next builds a site with three pages
  and writes down what the menu looked like.
- **A menu for a collection's entries.** ADR 0040 §5 keeps those out, and nothing here reopens it.

## Consequences

- `packages/renderer`: `menu.ts` splits `menuEntries` into `pageMenuEntries` and
  `sectionMenuEntries`; `headings.ts` is new; the bar's CSS gains a wrapper and a rule between the
  two groups. Two locale keys where there were one and a half.
- `packages/schema`: `inMenu` on a section and on a page, `SCHEMA_VERSION` 1.9.0 → 1.10.0, one
  migration with its round trip.
- `apps/editor`: a switch where the section's fields are, and one per row in «Páginas», plus
  `menuState.ts` — one object answering «how much menu is left» for both panels, every number of it
  asked of the renderer so the editor cannot promise a menu the published page does not have.
- The golden corpus moves once, for the split. **Curation moves no existing golden**: it only adds
  `menu-curado`, the fixture that records it, which is itself the proof that `inMenu` is absent by
  default and no stored document changed.
- Day by day in `docs/design/REVIEW.md`, sprint 23.

## Amendment — the header is the owner's (28 October 2026, ADR 0057)

[ADR 0057](0057-the-header-is-the-owners.md) withdraws two sentences of this ADR and reads two
sections differently, each with David's own reason of 28 October 2026:

- **§3, «no name of its own»** — withdrawn. An owner may write a `menuLabel` of two to twenty
  characters over the derived word, and the derived word is no longer the heading but the short name
  of the section's kind. His reason: *lo que no debía mentir era el destino, y sigue sin poder
  hacerlo* — the entry is the section's id, a label is not a copy of anything and cannot go stale,
  and if the section is deleted the entry goes with it. «No reordering» stands for the sections; for
  the pages, see the next point.
- **§1, «in the order the home page's avances give»** and «What is preserved: an avance still decides
  where its page sits» — withdrawn. The pages menu reads `doc.pages`, the order «Páginas» already
  lets the owner move. Two orders for one list was a panel whose «Subir» moved the tabs and not the
  menu.
- **§1, «inside one `<details>` on a narrow one»** — the pages fold into the one disclosure; the
  sections of the page being drawn are a horizontal row under the bar, or hidden, as the owner
  chooses. There is still exactly one `<details>`, and it still holds everything that folds.
- **§4–§5, the threshold** — unchanged as the *default*. Each menu now also takes the owner's word
  (`header.pages.shown`, `header.sections.shown`), and where that word is written the threshold is
  silent for that menu. The two bounds of §5 — nothing emitted for zero destinations, the pages
  strip drawn only where it leads somewhere the visitor is not — stand.

«What this does not decide» named an own label and an order as «still refused, for ADR 0023's
reasons». Both are now decided the other way, in ADR 0057 and not here.
