# 0040 — A page per entry is drawn, not stored

**Status:** **accepted** · **Date:** 2026-10-13 · **Accepted:** 2026-10-13 ·
**Proposed by:** development, sprint 19 day 2, at David's instruction when choosing the sprint's
direction on 13 October 2026 («Cerrar las colecciones») and approving its plan with three adjustments ·
**Accepted by:** **David, 13 October 2026** — «firma el ADR 0040 por mí», after merging the sprint's
closing pull request (#235), having read the seven pull requests that built it (#229 to #235) and
set the three adjustments the amendment below records. **Recorded by development at his
instruction, which is said out loud because the standing rule is that development does not sign.**
The decision is his; the keystrokes are not, and anybody reading this later should be able to tell
the difference without asking — the same note ADR 0039 carries, for the same reason ·
**Touches:** [ADR 0033](0033-reusable-content-and-the-template-that-is-one-item.md) (§4, where a
bound leaf may live, and the first bullet of what it did not decide), [ADR 0022](0022-a-page-is-born-by-converting-a-section.md)
(a second way a page is born, and the slug rule applied to entries), [ADR 0023](0023-the-menu-and-the-footer-are-derived-chrome.md)
(what the menu does with these pages, and the link each card gains), [ADR 0001](0001-static-published-sites.md)
(which this does not bend: the output is N static files), document rules 1 and 5, the advanced
dossier §7 ·
**Built:** sprint 19 days 2 to 5, before the signature — the precedent is ADR 0036 and ADR 0039,
and the pull requests and `docs/tasks/backlog.md` say so rather than tidying it away.

## Context

ADR 0033 built three of the five promises of the advanced dossier §7 and left two out in its own
words: «**A page per entry, and the menu that would follow it.** §7's first and fourth promises —
«su página se crea y se enlaza sola» and «el menú y los enlaces internos se mantienen solos» — are
one piece of work, and it needs the slugs, the derived menu of ADR 0023 and the conversion of ADR
0022 to agree with each other. Not here, and the reason is not timidity: forty entries would make
forty pages, and ADR 0023 settled the menu at a threshold of three.»

Two facts, counted on 13 October 2026, change the arithmetic that sentence was written against:

- **A collection has at most twelve entries, not forty.** ADR 0033 §8 ties every collection to
  the shortest section that shows it, and the longest list in the catalog is `PRICES_LINES`,
  `{ min: 1, max: 12 }`. Twelve files is a number a ZIP and a budget can hold.
- **The publisher already draws one document into several files** — `pagePaths` in
  `packages/publisher/src/site.ts` has named one file per page since sprint 5 — and the renderer
  already resolves a bound list into N cards from one stored item. Nothing new has to be invented
  for «one stored thing, N drawn things»; it has to be applied one level up.

## The decision

### 1. A collection may have one page per entry, and it is a stored page drawn N times

A collection may have **one** page bound to it: `page.binding = { collectionId, titleField }`.
It lives in `doc.pages` like any page — its sections belong to a page, rule 5 holds — and it
**counts as one of the five** (`MAX_PAGES`), because it is a stored page however many files it
becomes. It is **never emitted as itself**: the publisher expands it into one file per entry, in
stored order, and no file is ever written under the template's own slug. It is never the first
page, because the first page is `index.html` and is drawn exactly once.

This is ADR 0033 §2 applied to pages: a bound list stores one card and the renderer draws one per
entry; a bound page stores one page and the publisher draws one per entry. The alternative —
storing one page per entry in the document — was refused on ADR 0022's own principle, «derived,
never copied»: forty stored pages would be forty copies of a layout that has to be kept in step,
and «cambiarla cambia las cuarenta páginas» would have to be built as a sweep instead of being
true by construction.

### 2. The page's leaves read the entry, the way a card's leaves do

A leaf on the bound page may carry `binding: { collectionId, field }` of the same collection,
outside any list. ADR 0033 §4 said a bound leaf lives only inside a bound list's template; it now
says **inside a bound list's template, or on a page bound to the same collection**. The renderer
resolves both through the one `runs.ts` path, so there is still exactly one place a string is cut
into pieces (ADR 0027). A bound list *on* the bound page — «other entries» under this entry's
title — is allowed and needs nothing new.

### 3. Each entry gets a slug, minted once and held still

An entry gains an optional `slug`. It is minted from the title field's words — `mintSlug`, the
same folding a page's slug gets — **when the page is created** for the entries that exist, and
**in `addEntry`** for every entry born afterwards, unique across every page slug and every entry
slug in the document. Then it never changes: renaming an entry does not move its file, so no link
into it breaks on a whim. That is ADR 0022's rule («the slug is derived from the title,
normalised, and then never changes»), applied to entries for the same reason.

**A slug stays with its entry if the page is later removed.** A slug nothing emits is unused, not
invalid, and re-creating the page gives the same file names back — which is what somebody who
removed the page by mistake wants. The invariant runs one way: every entry of a collection *with*
a page has a slug; an entry *without* one is only an entry whose page has not arrived.

`SCHEMA_VERSION` 1.8.0 → 1.9.0, migration `0010`, affected set counted and zero — both keys are
optional and nothing could write either before this version.

### 4. The file is `<slug>.html`, flat, and the `<title>` is the entry's

`chapa-y-pintura.html`, beside `index.html`, not under a directory: the page's `@font-face`
rules name `fonts/*.woff2` relative, and a subdirectory would break them from `file://`, which is
the promise ADR 0001 rests on. The drawn page's `<title>` is «<title field> — <site name>», the
rule every page after the first already follows.

### 5. These pages stay out of the menu; the card's title links to its page

**ADR 0023 is amended in one clause:** a page bound to a collection contributes no menu entry —
not as a page nothing points at, not through an avance (the conversion never makes one). Twelve
entries in a menu of three is the flood ADR 0033 named, and the menu stays derived. What «los
enlaces internos se mantienen solos» means instead is this: **in a bound list whose collection has
a page, the leaf that reads the title field is wrapped in a link to that entry's file**, derived
when drawn, with no element added to the document. A «Ver más» link per card was refused because
a card is a shared template and cannot carry an element per entry (ADR 0033 §2). On the drawn
page the menu is the site's, with «Inicio» first and no `aria-current`, because the page is in no
menu.

### 6. The page is born from «Listas», with a cover whose leaves read the entry

ADR 0022 said a page is born by converting a section and never empty. This is **a second way a
page is born, and it is still never empty**: «Crear una página por ficha» in the «Listas» panel
creates the page with one section from the catalog — a `cover` whose headline reads the title
field and whose body reads the next text field, if there is one. The photograph is the
catalog's marker, **the same on every drawn page** until somebody sets one on the template, and
the download warning counts it once, because it is one stored photograph. A photograph per entry
is not decided here. The owner designs the rest of the page in the canvas like any page.

### 7. The exit is deleting the page

«Quitar la página de ficha» is `deletePage`, one history step, undo takes it back. There is no
«unbind the page»: nothing is lost by removing it — the entries, their words and their slugs
stay in the collection — so there is nothing for a softer verb to preserve. `deleteCollection`
refuses while the page exists and names it, as it refuses while a section is bound.

### 8. The weight budget: every drawn page, and a bundle that scales

`pnpm size` checked the page budget against the home page only. From day 3 it checks **every
emitted file** against the 60 KB-per-page budget, drawn pages included, and the bundle budget of
«our own bytes» scales with the number of emitted pages by a constant **measured on a fixture of
twelve entries**, not chosen. **Measured on 13 October 2026:** a drawn page of
`una-pagina-por-ficha` gzips to 1.7 KB (22.6 KB of ours across 13 files, 2.4 of them the home
page); the heaviest page in the corpus and the generated sample, restaurante-bar on `image-left`
with gallery and menu, to 3.1 KB. The constant is **4 KB per emitted page after the first**, which
holds a drawn page of the heavier composition and nothing more; the 80 KB keeps its meaning as a
one-page site's own bytes.

### 9. Behind the design-tools switch, like making a list

Creating the page is studio (ADR 0033 §11, ADR 0025 §6: the control is absent, not dimmed, with
the tools off). Living with it is not: with the tools off the owner edits a drawn page's texts
like any text, sees its tab, and downloads a ZIP that carries its files.

## What this does not decide

- **A photograph per entry.** Fields are text and marks; a per-entry image is a different field
  kind and ADR 0033 refused to let it in by accident. Named, not decided.
- **Ordering, filtering or hiding entries**, beyond stored order (ADR 0033).
- **Offering an entry's file as a destination in the fields panel.** A link typed by hand to
  `./<slug>.html` is accepted by the dead-destination rule since day 2; a picker is not built.
- **A page per entry for a collection no list shows.** Possible in the schema, offered nowhere:
  the panel offers the page beside a bound list, because that is where the link from a card
  comes from.
- **The threshold of three** in the menu, still «a judgement with no evidence behind it».

## Consequences

- `packages/schema`: `pageBindingSchema`, `collectionEntrySchema.slug`, `addEntryPage`,
  `entryPageOf`, `EntryPageSectionFactory`; `addEntry` mints a slug when a page exists;
  `usesOfCollection` reports a use of kind `page` beside the kind `list`; five invariants
  (first page, one page per collection, title field carried, every entry slugged, slugs unique
  across pages and entries); `reachable` resolves an entry's slug and not the template's;
  `sectionToPage` refuses a section of a bound page. Migration `0010`, with a `down` that turns
  the page back into an ordinary page carrying the template's last words.
- `packages/renderer` and `packages/publisher` (day 3): `entryId` as a render option,
  `pagePaths` expanding a bound page, the title link in a bound list, the menu skipping bound
  pages, the sitemap listing the drawn files through the manifest, the size script measuring
  every file.
- `apps/editor` (days 4 and 5): the panel, the tab, the «Viendo:» selector, editing on the drawn
  page with the §6 warning, the exit, the gate, the walk.
- ADR 0033 §4 and its first «does not decide» bullet; ADR 0022 and ADR 0023, each with the clause
  above as an amendment in their own file; `docs/document-rules.md` gains the section.

## Amendment — the title link is unwrapped in the canvas (13 October 2026, sprint 19 day 5)

David's second adjustment to the sprint plan asked that the card's title link be **inert inside the
editor's canvas, with the click still opening the title's editing**. Building it found that inert
by `preventDefault` was not enough: with the anchor left inside the `contentEditable` heading,
focus selected the whole title (the field's contract), `End` did **not** collapse a selection that
covers an anchor, and typing replaced the words — «Comidas» was committed as «del día», measured
step by step in the DOM. So `wireEditing` unwraps `a.rb-entry-link` before the title becomes
editable: in the canvas the title is the plain text it was before §5 existed, the click edits, and
the link exists on the published page, drawn again from the slug on every render. A link the owner
types by hand to a ficha is a different thing and moves the canvas to that ficha, the way a menu
entry moves it to a page (`apps/editor/src/editor/canvasLinks.ts`).

**§8, measured:** 4 KB per emitted page after the first, on 1.7 KB for a drawn page and 3.1 KB for
the heaviest page of the generated sample.
