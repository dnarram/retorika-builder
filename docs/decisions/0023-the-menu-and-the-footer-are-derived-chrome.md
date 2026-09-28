# 0023 — The menu and the footer are derived chrome, never content, and the menu starts at three entries

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** the CEO · **Implements:** concept dossier §6

## Context

Once a site can have more than one page ([ADR 0022](0022-a-page-is-born-by-converting-a-section.md)),
it needs a way to get between them. The concept dossier §6 says what that is, in one line:

> **El menú se escribe solo.** Refleja las secciones de la portada y las páginas que existan. El
> usuario nunca ve ni escribe una dirección web.

Nothing in the repository emits navigation today: no `<nav>`, no `nav` role in ADR 0004's closed
vocabulary, no catalog preset. `docs/tasks/publisher.md` declines it explicitly — «Multi-page
navigation UI. A menu is the editor's job; this package only writes the links» — without saying
which component owns it.

The question is therefore not *whether* there is a menu but *what kind of thing* it is: content
somebody writes, or an artefact the renderer derives.

## Decision

- **The menu is derived, never document content.** It is built at render time from the home page's
  sections and the document's pages. It has no role, no slot, and never appears in the document —
  the same standing the `rb-panel` already has in `packages/renderer/src/build.ts`.
- **The footer is drawn on every page, from the home page's own footer section.** Same mechanism,
  same reason. A converted page with no footer looks unfinished, and repeating the section is not
  duplicating it: there is still exactly one footer in the document, belonging to one page, as rule
  5 requires.
- **The menu exists whatever the number of pages, but only from three entries.** Fewer than three
  is not navigation, it is two links above a page that already scrolls.
- **What it contains, in the home page's own order:** each home section contributes an anchor named
  by its heading; **an avance contributes the entry of the page it points at, in the place the
  converted section used to occupy**; pages nothing points at are appended. The cover, the footer
  and an avance's own section contribute no anchor of their own.
- **It costs no JavaScript.** Below the narrow breakpoint it collapses into `<details>`/`<summary>`,
  which is the only semantic disclosure that needs no script. The `<input type="checkbox">` trick
  is rejected: [ADR 0016](0016-contact-section-has-links-not-a-form.md) keeps the `field` role
  unused precisely so that no orphan `<input>` reaches a published page, and a navigation toggle
  would put one there by the back door.
- **At every width there is exactly one navigation landmark.** If one element cannot serve both
  widths, two are emitted and a media query hides the one that does not apply with `display: none`
  — which removes it from the accessibility tree rather than leaving two menus announced.

## Why a menu that writes itself, rather than one somebody writes

Because a written menu is the same words on every page, and the day a page is renamed it is wrong
on all of them at once. The dossier's «se escribe solo» is not a convenience; it is what makes
«el usuario nunca ve ni escribe una dirección web» possible at all. A person who never sees a URL
cannot be asked to maintain a list of them.

It also keeps the model honest. Rule 5 — «no orphan elements: every element belongs to a section,
every section to a page» — leaves nowhere for a site-wide element to live. A derived menu needs no
such place.

## Why three entries, rather than "only when there are several pages"

Both halves of the evidence pull, and the threshold is what satisfies them at once.

**For a menu on a one-page site:** the dossier's own sentence says the menu reflects «las secciones
de la portada», which exist from the first day. Conchi asked to navigate «**dentro de ella**» —
inside the page — which on one page is exactly an anchor menu. And mockup 08 draws the strip
`Inicio · Servicios · Galería · Contacto · Reserva` over a site that has one page.

**Against:** the same dossier says a site starts with «todo en un scroll», and a menu over two
sections is furniture.

Three is where a list becomes worth reading. It is a product judgement, not a technical one, and it
was not allowed to be decided by the fact that a lower threshold moves the golden corpus — a test
corpus is a record of what the renderer does, never a reason for it to do it.

## Consequences

- **The golden corpus moves once**, for every fixture that reaches three menu entries, and that
  diff is reviewed in full on the day it happens. It is the first time a published page gains
  markup that no document asked for.
- The accessibility matrix grows: the `<nav>` landmark, `aria-current="page"`, one `<h1>` per page,
  and the menu both collapsed and open at 320px — across the four palettes and three type pairs the
  matrix already covers.
- `packages/renderer` learns about pages as a set rather than as `doc.pages[0]`. It already had to,
  for ADR 0022.
- The weight budget of ADR 0001 — 60 KB gzipped, zero JavaScript — is unaffected: a menu is a list
  of links and a `<details>`.

## What would reopen this

- **An owner wants a page kept out of the menu**, or the entries in an order the page order does
  not give. Both are real needs on real sites, and both would mean the menu stops being purely
  derived — which is a different decision, with a place in the document to store it.
- **Three turns out to be the wrong number.** It is a judgement with no evidence behind it yet; the
  first session run against a site with a menu is what would say so.
