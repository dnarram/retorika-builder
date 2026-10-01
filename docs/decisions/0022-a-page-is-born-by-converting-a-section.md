# 0022 — A page is born by converting a section, never by an empty "add page"

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** the CEO · **Implements:** concept dossier §6 · **Diverges from:** mockup 08

## Context

«Páginas orgánicas» has sat in the protocol's phase 2 list since the beginning, and one owner asked
for it in her own words on 27 September 2026:

> «Además la página se muestra de manera continua y a mí me gustaría que la página web constara de
> varias páginas independientes, **que se pudiera navegar dentro de ella**.»

Two approved documents describe how it should work, and **they contradict each other.**

**Mockup 08** draws the editor's top bar with two page tabs, a `PÁGINAS: FASE 2` badge and a `+`
button labelled `Añadir página`. Read alone, it says: pages are things you add, empty, and then
fill.

**The concept dossier §6** says the opposite, and says why:

> **Una página o varias, sin tener que decidirlo**
>
> Pedir al usuario que elija entre «una página» y «varias páginas» es pedirle una decisión técnica
> antes de que sepa qué va a contar. **La estructura tiene que aparecer sola.**
>
> - Se empieza siempre en una página. Es lo que necesita la mayoría de los comercios: todo en un
>   scroll.
> - **Cualquier sección puede convertirse en página.** La aplicación mueve el contenido, deja un
>   resumen con un enlace en la página de inicio y crea la página nueva.
> - El usuario nunca ve ni escribe una dirección web.
> - Y se puede deshacer.

`CLAUDE.md` settles which wins: «Source of truth: `docs/dossiers/` (approved, and they win over the
code)». The mockups are the phase 1 interface specification; the dossier is the concept. Where the
concept says a feature exists to avoid asking a technical question, a screen that asks it is the
screen that is wrong.

## Decision

- **A page is born by converting a section that already exists.** «Convertir esta sección en
  página» takes the section off the page it is on, creates a page holding it, and leaves an
  **avance** — a summary with a link — where the section was.
- **There is no "add page" button, and no empty page can exist.** To get a page that is not yet
  written, you add a section and convert it. Two steps, and neither asks anybody to think about
  site structure before they have content.
- **The conversion is one step, and so is undoing it.** Moving the section, creating the page and
  leaving the avance are a single entry in the undo history: they are one act to the person who
  did them. `pageToSection` is the same act in reverse, because the dossier promises «se puede
  deshacer» as a feature and not only as Ctrl+Z.
- **The avance holds a reference, never a copy.** In the document it is a section with one slot: a
  link to the page. Everything else it shows — the target page's title, the first line of that
  page's first section — the renderer reads **when it draws**. Nothing is duplicated, so nothing
  can fall out of step.
- **Its label is neutral, and never a sentence with the title inside it.** «Ver más», editable by
  the owner. «Ver *Nuestra carta* completo» does not agree in gender, and any template that drops
  a heading into a Spanish sentence breaks on half the headings it will meet.
- **A screen reader hears the destination, separated by a colon**: «Ver más: Nuestra carta», in a
  span that is not shown. The colon avoids agreement entirely — there is no sentence to agree —
  and it stops three avances reading as three identical «Ver más» in a list of links (WCAG 2.4.4).
- **The owner may delete an avance.** It is an ordinary section: the same delete, the same undo
  toast. A page whose avance is gone is still reachable, because the menu carries it ([ADR
  0023](0023-the-menu-and-the-footer-are-derived-chrome.md)).
- **The slug is derived from the title, normalised, and then never changes.** «Peluquería» becomes
  `peluqueria`, «Diseño» becomes `diseno`. Renaming a page does not move its file, so no link
  breaks because somebody changed a name. This is invisible, which is precisely what makes it safe
  to hold still: «el usuario nunca ve ni escribe una dirección web».
- **The cover, the footer and an avance cannot be converted.** The cover is the page's promise and
  its `<h1>`; the footer is chrome; converting an avance is converting a link to a page into a
  page.

## What this newly puts in the schema

The rules that make a slug a file name lived in `packages/publisher/src/site.ts`, which is the last
thing to run before a ZIP is written. A page with the slug `Mi Página` therefore passed
`parseDocument`, passed the download route's bounds checks, and failed **inside `buildSite`** — as
a 500 at the moment of download rather than as a validation error where it was written. Page `id`
uniqueness was checked nowhere at all.

Both move to `packages/schema`, which is where every other rule of this kind lives: the character
set and uniqueness of a slug into `pageSchema` and `checkInvariants`, beside the section-id
uniqueness that rule 5 already puts there.

## Consequences

- The editor gains one button on the section action cluster, and the top bar gains tabs. It does
  **not** gain a `+`, and `docs/design/REVIEW.md` records that divergence from mockup 08 with this
  ADR's reasoning, the same way it records the others.
- A section carrying a broken destination cannot be converted into a page with a broken destination
  — the download already refuses a document with a dead link, and the avance's own link is subject
  to the same rule.
- Five pages is the cap, because `apps/editor/src/app/api/download/route.ts` already says so. The
  conversion stops being offered there rather than failing at download.
- **Nothing that exists today changes.** A site with one page is still one page in one scroll, and
  the dossier says that is what most shops need.

## What would reopen this

- **An owner tries to make a page and cannot find the way.** The conversion is discoverable only
  from a selected section; if a real person looks for pages in the rail and gives up, the `+` the
  mockup drew is the answer after all, and this ADR was wrong about which document to follow.
- **Someone needs a page with nothing on it yet** — a placeholder for a thing they will write next
  week. Nothing in the evidence asks for that, and the dossier is explicit that structure should
  emerge from content, but it is the obvious pressure this decision will take.

## Evidence from session 3 — the first there has been (30 September 2026)

> Source: `docs/sessions/2026-09-30-taller.md`. Watched, not asked: this ADR's condition is about
> someone looking and failing, and a question would have handed him the idea.

**He found «Convertir esta sección en página» on his own.**

**This decision holds, and it is the first evidence it has ever had.** It was accepted on the
strength of the dossier's own reasoning — structure emerges from content — against mockup 06, which
drew a `+` in the rail. The reopening condition is the precise opposite of what happened: nobody
looked in the rail and gave up. **The `+` is still not needed.**

Two limits on that, so it is not read as more than it is:

- **One owner.** ADR 0017's framing applies: an experiment of one subject. What it rules out is the
  specific failure this ADR was most exposed to, not every failure.
- **How he got there is not recorded** — whether he selected a section first and found the control
  in its header, or went looking elsewhere and arrived at it. The condition is about giving up, and
  he did not; the route is blank.

**How many pages he ended with is also not recorded**, which is what leaves ADR 0023's threshold
untested. See that file.
