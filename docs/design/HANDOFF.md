# Retorika Builder — Phase 1 design handoff

> **Read [REVIEW.md](REVIEW.md) next.** This document is kept as it was received; the review is
> where it was checked against the repository, and it overturns three things said below:
> **D9's premise** (a single card is not stranded: measured, it already takes the full width),
> **D8** (it contradicted ADR 0003, and the product owner settled it: no dialog, but the undo
> toast stays when the content was the user's), and **the preview line in mockup 15** (ADR 0008
> withdrew the shareable preview link). The review also records the decisions taken on the
> example business and on the "Qué hago" cardinality.

**Date:** 23 September 2026
**Prepared for:** the local agent working in the `retorika-builder` repo
**Purpose:** record the decisions taken in a design session so that the repo
documentation (`docs/`, ADRs, `CLAUDE.md`) can be reviewed and brought up to
date, and so that Phase 1 is implemented faithfully to the approved screens.

All UI copy quoted below is in Spanish on purpose: per `docs/protocolo.md`,
code, comments, commits and documentation are English, and only user-facing
interface strings are Spanish, held in separate translation files.

---

## 0. What this session produced

1. The Supabase + Render stack test the CEO asked for, run and approved.
2. The detailed Phase 1 screens the protocol requires before `apps/editor`
   exists, plus four error/edge states.
3. The two real businesses for the usability test.
4. One new product rule that closes an open question in ADR 0010.

The screens live in `mockups/` next to this file as standalone HTML. They are
visual specifications, not production code: no build step, no framework, inline
styles only. Open any of them in a browser at 1280x860.

---

## 1. Decisions taken

### D1 — The Supabase + Render stack is approved

The CEO asked for the free tiers of both to be tried before the architecture
was signed off. The test was run and the result accepted.

- Supabase project provisioned, PostgreSQL reachable, transaction pooler
  (port 6543) used rather than the direct connection, because Render free
  instances hibernate and exhaust direct connections.
- Render web service deployed from GitHub via Docker, Frankfurt region, same
  region as Supabase.
- Measured round trip from Render to Supabase: 1266 ms on the first call after
  inactivity, 912 ms on the second, 129 ms once warm. The pattern is Render's
  free-tier cold start, not a network problem between the two services.
- Operational note worth carrying into the docs: Render free spins the service
  down after roughly 15 minutes of inactivity, so live demos need a warm-up
  request first.

**Repo impact:** `docs/protocolo.md` still describes the stack as pending that
test. That wording is now stale.

### D2 — Hosted publishing stays retired, and the UI must say so

ADR 0007 paused publishing to a Retorika domain or subdomain and ADR 0008
removed it from the plan with no reactivation date. Both dossiers predate those
ADRs and still show the opposite.

Consequences applied to the screens:

- The publish screen of the concept dossier (two destinations, "Alojarla en
  Retorika" at `huellitasfelices.retorika.site` versus "Descargar los
  archivos", same price) is replaced by a download-only screen.
- The editor's primary top-bar action reads **"Descargar"**, not "Publicar".
- A row was added in its place explaining where to upload the files, since the
  user no longer has a zero-effort destination.

This is the only deliberate divergence from the dossier mockup images. Where
dossiers and ADRs disagree, the ADRs win.

**Repo impact:** if any doc still describes the six-step journey ending in
"pagar y publicar" with two destinations, it needs the same correction.

### D3 — Sectors come from ADR 0010, not from the dossier image

The dossier screenshot shows six sectors (peluquería canina, restaurante,
fisioterapia, taller mecánico, inmobiliaria, otro sector). ADR 0010 fixed a
different list of ten. The ADR wins.

Launch sectors, as drawn:

`Peluquería y barbería` · `Estética` · `Fisioterapia` · `Restaurante y bar` ·
`Tienda` · `Taller` · `Reformas` · `Academia` · `Fotografía` · `Asesoría` ·
plus `Otro sector`.

The search field above the grid, which the dossier image has and ADR 0010 does
not mention, was kept: with eleven options it earns its place.

### D4 — "Otro sector" is honest, not silent

When the user picks `Otro sector`, a free-text field appears asking them to
describe the business in their own words, and a warning states plainly that
there are no prepared texts or photos for that trade yet and that the site will
be built with general content they can change afterwards. See
`mockups/10-state-other-sector.html`.

### D5 — The visual language is the one in the dossier images

The dossier mockups are high-fidelity, so they are the reference rather than a
suggestion. Extracted and reproduced:

| Token | Value |
|---|---|
| App background | `#F5F7FA` |
| Card / panel | `#FFFFFF`, radius 20 for dialogs, 11-14 for controls |
| Border | `#E8ECF2` / `#E3E8F0` |
| Ink | `#0F172A` |
| Muted text | `#64748B`, placeholder grey `#94A3B8` |
| Brand blue | `#156FE7` (actions, selection, links) |
| Selected surface | `#F1F7FE` / `#E8F1FE` |
| Confirmation green | `#03D26E` (the "Guardado" tick) |
| Fuchsia | `#FF3A72`, accents only, never large areas |
| Interface typeface | Inter |

Site-preview accents inside the canvas use `#E8F1FE` for the hero band,
`#D5E3F8` for image placeholders and `#C6D9F3` for text placeholder bars.

### D6 — How the logo is used inside the product

The full logotype (R with the hammer and blocks, blue gradient, fuchsia block,
"Retorika" in ink) is the brand asset, and the concept dossier section 11
already corrected its purple to Retorika blue. But the dossier's own interface
screenshots never use it: inside the product the mark is a small rounded blue
square with a white "R" next to the wordmark. The mockups follow the
screenshots. The full logotype belongs outside the product.

### D7 — The editor layout

The concept dossier lists "tres zonas de pantalla a la vez" as a friction to
remove and states outright that there is no properties panel. The editor is
therefore:

- **Top bar**, 58 px: logo, site name with a chevron, centred page tabs
  (`Inicio`, `Servicios`, `+`), device toggle (desktop / mobile, view only in
  Phase 1), undo and redo, a green tick reading `Guardado`, and the primary
  `Descargar` button.
- **Left rail**, 80 px: four icon buttons with labels — `Secciones`, `Estilo`,
  `Páginas`, `Fotos`. This rail is not a contradiction: the advanced-module
  dossier describes exactly these four with the design tools switched off.
- **Canvas**: takes the rest of the screen. Editing happens on the element
  itself.
- **Floating toolbar**, above the selected element, with four to seven actions
  and nothing more: `Aa`, size stepper, bold, alignment, colour swatch, link,
  then move / duplicate / delete. Selection is drawn with a 2 px blue outline
  and four corner handles.
- **Section insertion** happens in the gap between sections, as a dashed rule
  broken by a pill reading `Añadir sección aquí` — never from a list in a side
  panel.

See `mockups/08-editor.html`.

### D8 — Deleting a section shows no confirmation dialog

A modal would contradict two rules at once: "deshacer siempre a mano y cero
botones de guardar" in the concept dossier, and "nada se borra en silencio" in
the advanced module. The pattern drawn instead: the section is removed, a
dashed placeholder briefly marks where it was, and a dark toast appears reading
`Has borrado la sección «Opiniones»` with an `Deshacer` button. The undo arrow
in the top bar lights up at the same time. See
`mockups/11-state-section-deleted.html`.

### D9 — How "Qué hago" behaves with few cards (NEW — needs an ADR)

ADR 0010 left two questions open: how many suggestions can be ticked in
question 3, and what happens if fewer than two cards remain. Both are closed
by one rule, and the rule is a layout rule, not an error state. Blocking the
user for ticking too little would contradict "nunca empezar en blanco" and
"elegir, no configurar".

The `Qué hago` section declares cardinality in the catalogue and the renderer
picks the composition from the count:

| Cards ticked | Rendering |
|---|---|
| 0 | The section does not exist, exactly as if question 3 had been skipped |
| 1 | Featured composition: one wide card, text beside image — not a lone card stranded in a four-column grid |
| 2 | Two cards at half width |
| 3 | Three at one third |
| 4 | Two rows of two, or four quarters depending on available width |
| 5 or more | Three per row, wrapping |

The single-card case is the one that matters: rendered in a four-column grid it
leaves a large empty gap and the site looks broken. Changing composition rather
than leaving holes is consistent with "cada sección tiene dos o tres
composiciones posibles" and with the application, not the user, keeping things
aligned.

The zero case is not an error either. If the user unticks everything the
section disappears from the site and the section rail shows it as empty and
re-tickable. Nothing is destroyed and nothing blocks progress.

**Maximum selectable:** the limit is the section's maximum cardinality, not a
rule in the questionnaire. Proposed value: **8**, the point where a
three-per-row grid starts to be tiring to read.

This decision is not yet written as an ADR. It should be, before any code
depends on it.

### D10 — Phase boundaries are respected and marked

Per `docs/protocolo.md` part 14, three of the drawn screens are outside Phase 1
and are labelled as such on the canvas: global style and the single payment are
Phase 2, mobile retouching is Phase 3. They were drawn anyway so the CEO can
see the whole journey, but they must not pull scope into Phase 1.

### D11 — Example business in the mockups

All screens use `Huellitas Felices`, the dog-grooming business from the
dossier's own images, so the CEO recognises the screens immediately.

### D12 — Price stays a placeholder

Every screen shows `XX €`. Per the protocol this is a Stripe Price object, not
a number in the code, so fixing it later is a configuration change.

### D13 — The two businesses for the usability test

The protocol requires a navigable prototype tested with two real businesses
before the definitive code is written.

1. **Restaurante Taberna Santo Domingo** — C. Cta. de Santo Domingo, 2, Ronda.
   Sector: restaurante y bar. No website on its Google listing.
2. **Conchi** — C. Cruz Verde, 7, Ronda. A long-established family shoe shop
   with its own shoemaker. Sector: tienda. No website on its Google listing.

Both are exactly the target user: small businesses that would never hire a
developer. The absence of a website should be confirmed on contact, since a
Google listing can simply be incomplete.

---

## 2. Still open

| Question | Owner | Note |
|---|---|---|
| The price | Direction | Placeholder `XX €` everywhere; blocks nothing in the design |
| Sector text and photo bank per sector | Direction | ADR 0009 defines the reviewed text bank; the photo bank is still needed for the automatic fill |
| Who issues the invoice and how VAT is handled | Direction | Needed before the first euro is charged |
| D9 as a written ADR | Development | Proposed above, not yet recorded |

---

## 3. Mockup inventory

Standalone HTML, 1280x860, no dependencies beyond a Google Fonts link.

| File | Screen | Phase |
|---|---|---|
| `01-question-1-business-name.html` | Question 1: name, optional logo | 1 |
| `02-question-2-sector.html` | Question 2: sector, search + 10 sectors + other | 1 |
| `03-question-3-services.html` | Question 3: what you offer, unticked suggestions | 1 |
| `04-question-4-location.html` | Question 4: address, hours, online-only option | 1 |
| `05-question-5-main-action.html` | Question 5: main action and its target | 1 |
| `06-generating.html` | Generation progress | 1 |
| `07-three-variants.html` | The three built sites, "volver a generar otras tres" | 1 |
| `08-editor.html` | The editor with a heading selected | 1 |
| `09-state-missing-name.html` | Validation: name is required | 1 |
| `10-state-other-sector.html` | Sector outside the catalogue | 1 |
| `11-state-section-deleted.html` | Section deleted, undo toast | 1 |
| `12-state-payment-failed.html` | Card declined, nothing lost | 2 |
| `13-phase2-global-style.html` | Global style: four palettes, three typefaces | 2 |
| `14-phase3-mobile.html` | Desktop beside generated mobile, three adjustments | 3 |
| `15-phase2-download-and-pay.html` | Download and single payment | 2 |

Not yet drawn: the `Qué hago` section with one, two and zero cards (D9). That
state should be added once D9 is recorded as an ADR.

---

## 4. What to do with this document

1. Read it against `docs/protocolo.md`, `docs/dossiers/` and `docs/decisions/`.
2. Correct anything made stale by D1 and D2, in particular the stack-pending
   wording and any surviving description of publishing to a Retorika subdomain.
3. Write the ADR for D9 before touching the catalogue's cardinality.
4. Treat the mockups as the interface specification for Phase 1: the layout,
   the Spanish copy, the colours and the interaction patterns are all decided.
   Extract the Spanish strings into the translation files rather than inlining
   them, as the protocol requires.
5. Do not let the Phase 2 and Phase 3 screens pull scope forward.
