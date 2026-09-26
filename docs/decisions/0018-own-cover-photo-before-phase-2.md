# 0018 — The owner's own photo arrives before phase 2

**Status:** **proposed** · **Date:** 2026-09-26 · **Proposed by:** development · **Amends, if accepted:** protocol Part 14 (phase boundary)

> **Why this is not accepted yet.** It moves a line the CEO drew: the protocol lists **fotos**
> under phase 2, and this puts one half of them in phase 1. The argument below is a product
> argument and the decision is the CEO's. The code ships with this at `proposed` on purpose — the
> same pattern as ADR 0016 — because what it adds is one optional affordance on one slot, and
> removing it later costs a deletion, not a rewrite.

## Context

Protocol Part 14 puts phase 2 as "Estilo global, variantes de sección, **fotos**, lo mínimo de
SEO, páginas orgánicas, publicar, descargar y el cobro". Phase 1's acceptance criterion is a
person from outside the team building the site of a real business in under ten minutes.

This sprint's goal is that the site they end up with is **publishable** — that the ZIP they
download can be put on any hosting and work. Every cover in phase 1 carries the same grey
placeholder (`packages/catalog/src/placeholder-image.ts`, ADR 0011), which reads "Tu foto aquí".

The first usability session said the quiet part out loud, unprompted
(`docs/sessions/2026-09-25-taberna-santo-domingo.md`):

> «La foto de muestra es pobre pero entiendo que debo añadir mi propia foto para que luzca
> profesional»

Asked separately what the site lacked, the same owner led with «potencia visual, muchos mas
elementos gráficos e imágenes», and when asked about the texts said they «dependerían del
contenido visual e imágenes» and that the page felt «vacía y fría». He did not separate the photo
problem from the text problem.

## Decision (proposed)

**The owner can replace the cover photo with one of their own, in phase 1.** Nothing else about
phase 2's photo work moves: no photo library, no photos in other sections, no gallery, no
cropping, no filters, no `Fotos` rail item.

Three things are settled with it, and they are the reason this is a decision rather than a task:

- **Only JPEG, PNG and WebP, recognised by their own first bytes** — never by the file extension
  and never by the `type` the browser reports, both of which the person choosing the file
  controls. **SVG is refused outright.** An SVG is a document that can carry script, and this one
  ends up inside a stranger's ZIP, opened by double-clicking with the page's own origin. The
  placeholder stays an SVG because we wrote it; an upload is not the same thing.
- **The photo is resized and re-encoded in the browser before it is stored anywhere.** That bounds
  what travels, and it has a second effect worth naming as a decision rather than as a side
  effect: **re-encoding drops the metadata, including the GPS coordinates** phones write into
  photos. Nobody uploads a picture of their shop expecting to publish where they were standing.
- **It is a file in the ZIP, not a data URI in the document.** `buildSite` already bundles
  file-backed images and the machinery is tested; inlining a real photograph would put a few
  hundred kilobytes inside the HTML, and Part 8.5's 60 KB-per-page budget is described in
  `scripts/size-budget.ts` as "a product feature, not housekeeping".

## Why now, and not in phase 2

Because "publishable" is otherwise a claim we cannot make. A site whose main image says "Tu foto
aquí" is not one a business would put its name on, and the acceptance criterion asks for the site
of a **real business** — not a demonstration of one.

The cost of waiting is also asymmetric. Everything else in phase 1 can be judged with placeholder
content: the questionnaire, the sections, the editing verbs. The photo is the one placeholder that
makes the finished result look unfinished, so it is the one that distorts every session run
against it — including the timed one this sprint ends with.

## What this does **not** do

**It does not replace `packages/photobank` (ADR 0011), and that ADR stays open.** They answer
different questions:

- This is for the owner **who has a photo and will upload it**.
- The photo bank is for the owner **who will not**, and for the moment before anyone has uploaded
  anything — which is every generated site at the instant it is generated, including the three
  variants on "elige por dónde empezar". A site has to look finished before the first upload, or
  the upload never happens.

One owner saying he would add his own is not evidence that the bank is unnecessary. It is one
owner.

## Consequences

- `packages/renderer` is unchanged: it already emits whatever `src` the document carries, and
  `safeUrl` already allows a relative path.
- `/api/download` stops being a JSON-only endpoint. It receives the document and the photo bytes
  together, and **re-checks the first bytes of every photo itself** — the browser check is the
  convenience, the route is the guarantee, exactly as with a dead destination.
- The photo lives in `IndexedDB`, not in the `localStorage` session: a few hundred kilobytes of
  binary has no business in a JSON blob that is rewritten on every keystroke's debounce. **When
  the store refuses — no quota, private window, storage disabled — the save indicator says
  `No guardado`**, never a tick it has not earned.
- The placeholder is unchanged and still the starting state, so a document that has never had a
  photo uploaded is byte-for-byte what it was.

## What would reopen this

- **The CEO declines the phase move.** Then the affordance is removed and the placeholder stands
  until phase 2; nothing else in the sprint depends on it.
- **A photo format we accept turns out not to be what phones actually hand over.** iPhones write
  HEIC by default, which is not on the list; Safari usually converts on upload when the file input
  does not accept it, and "usually" is not a word this repository accepts in place of a test on a
  real device. If real phones hand over something we refuse, the list is wrong, not the phone.
