# 0016 — The contact section has links, not a form

**Status:** **proposed** · **Date:** 2026-09-24 · **Proposed by:** development · **Amends, if accepted:** concept dossier §9

> **Why this is not accepted yet.** The argument below is technical and the decision is a product
> one. It is being checked with the two owners of the usability sessions, which have not happened
> yet, and it is explicitly reopened if either of them answers a certain way. A decision that
> depends on evidence nobody has gathered is proposed, not accepted — and the CEO has not seen
> this. It becomes **accepted** when the two answers are recorded below, naming who accepted it.
>
> The code for the section ships with this ADR at `proposed` on purpose: the links work whether
> or not a form is ever added, so if the sessions reopen this, a form is an addition in phase 2
> rather than a rewrite.

## Context

The concept dossier §9 describes "Contacto y reservas" as "Formulario, teléfono y WhatsApp". The
catalog is about to build that section, and the form half cannot be built as described.

A published site is static (ADR 0001): it opens by double-clicking, with no server and no
network. A form has to send what it collects somewhere, and there are only three somewheres:

- **an API of ours** — which ADR 0001 forbids outright, and which would make every client's site
  stop working the day we do;
- **a third-party form service** — a dependency the client inherits without choosing it, a
  processor of their customers' personal data that protocol Part 15 would make us account for,
  and a free tier that can start charging or disappear;
- **`mailto:` as the form's action** — which opens whatever mail program the visitor has, with
  the fields pasted into a draft they have to send themselves. It fails silently on phones and on
  webmail, and it is a worse version of a link.

## Decision (proposed)

- **"Contacto y reservas" ships links, not a form:** `tel:`, `https://wa.me/…` and `mailto:`.
  They work from a file on a disk, cost nothing, depend on nobody, and open the app the visitor
  already uses to talk to businesses.
- **The `field` role stays unused by the catalog.** It remains in the vocabulary for phase 3's
  free sections, but no preset places one, so the orphan `<input>` the renderer would emit for it
  never reaches a published site.
- **This amends dossier §9** where it says "Formulario": the section has a main action and up to
  three ways to reach the business.

## The evidence, and what would reopen this

`guion-de-prueba.md` asks both owners, without naming a form or suggesting an answer:

> «Cuando alguien quiere pediros cita o preguntar algo, ¿cómo te gusta que lo haga? ¿Te vale con
> que te llamen o te escriban por WhatsApp, o esperas que te escriban desde la web y que te
> llegue a ti?»

**If either of the two says they expect messages to arrive from the web, this is reopened** — one
person in a sample of two is half of it, not an outlier. A form then becomes a phase 2 decision
with a service behind it, its cost, its data processing agreement and its own ADR.

**Their answers, recorded when the sessions have happened:**

| Business | What they said | Date |
|---|---|---|
| Taberna Santo Domingo | _pending_ | |
| Conchi | _pending_ | |

## An open case this decision leaves

**Question 4 is independent of question 5.** Someone can say where they are and skip what a
visitor should do. Then there is no main action, so no contact section is generated (ADR 0010),
and the site ends up with an address and opening hours and **no way to get in touch at all** —
worse, for a taverna, than having no site.

`primaryAction` staying 1..1 is right: a contact section with nothing to contact is furniture.
**The fix belongs to the generator**, not to the catalog, and it is probably one of two things:
the location section adopting its map link as its action, or the generator refusing that
combination and asking question 5 again. It is decided when the generator is built.

## Consequences

- The `contact` preset declares `primaryAction` 1..1 and `secondaryAction` 0..3.
- Protocol Part 15's line about form submissions going to the owner's email describes something
  that does not exist yet, and starts applying the day a form does.
- Nothing in the renderer changes: `safeUrl` is a deny-list for executable schemes, so `tel:`,
  `mailto:` and WhatsApp links already publish untouched.
