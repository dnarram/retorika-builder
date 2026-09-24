# Review of the phase 1 design handoff

**Date:** 2026-09-23 · **Reviewed against:** `docs/protocolo.md`, `docs/dossiers/`, the eleven
ADRs in `docs/decisions/`, and the merged code in `packages/`.

`HANDOFF.md` and the fifteen mockups came from a design session in Claude online. This is the
record of reading them against what the repository already decided: what holds, what does not,
and what was decided to close each gap. Where this file and `HANDOFF.md` disagree, this file is
the later document.

## What the screens get right

Checked one by one, not assumed:

- **The five questions,** their order, and that only the first two are required (ADR 0010).
  Questions 3 to 5 carry a `Saltar` button and say what skipping costs.
- **The ten launch sectors plus "Otro sector"** (ADR 0010), with a search field above the grid.
- **Question 3's suggestions start unticked**, with "Marca solo lo que hagas de verdad" — the
  rule ADR 0010 gives for not promising services the business may not offer.
- **Question 4 feeds "Horario y ubicación"** and offers "No tengo local: trabajo solo online o a
  domicilio", saying plainly that then no city is named. That is `{ciudad}` having no value
  (ADR 0010).
- **Question 5 feeds the main button** and asks for the data the action needs on the same screen.
- **The palette comes from the logo** (mockup 06, and the dossier's own promise), and the logo is
  optional.
- **Sample photos** are placed by the generator, not asked for (ADR 0011).
- **`Descargar` is the editor's primary action,** and there is no hosted destination anywhere
  (ADR 0008).
- **No properties panel**, editing on the element itself, a floating toolbar with few actions,
  `Guardado` instead of a save button.
- **The price is `XX €`** on every screen (protocol: a Stripe Price object, not a number in code).

## The five conflicts

### 1. The prototype did not navigate

All 23 links pointed at files that do not exist — `Main.dc.html`, `P2-Sector.dc.html`,
`Editor.dc.html`, `Descarga.dc.html` and the rest, artefacts of the export. The protocol's next
step is *a navigable prototype tested with two real businesses*, so this was a blocker, not a
detail.

**Resolved:** the links were rewritten to the real filenames.

### 2. Mockup 15 promised a preview link the CEO withdrew

The screen read: *"Antes de pagar puedes compartir un enlace de previsualización con una marca
discreta de Retorika."* **ADR 0008** retired exactly that: the preview with the Retorika mark is
seen **only inside the app**, and there is no public URL to share. The handoff's own D2 replaced
the two-destination publish screen but left this line standing.

**Resolved:** the line now says what the app does — the preview is inside the app, there is no
link to share.

### 3. Deleting a section: D8 against ADR 0003

D8 draws no confirmation dialog at all: the section goes, a dashed placeholder marks the gap, and
a toast offers `Deshacer`. **ADR 0003** says confirmation *is* asked when the section holds
content the user actually wrote.

**Decided by the product owner (2026-09-23):** never a dialog, but the toast does not fade when
the section held the user's own writing. Recorded in **ADR 0014**, which amends ADR 0003.

### 4. The example business told two stories at once

Questions 1 to 6 used `Huellitas Felices`, a dog groomer, while the sector ticked was
`Peluquería y barbería` and the services were barbering (`Corte de caballero`, `Arreglo de
barba`). On top of that, ADR 0010's launch sectors do not include dog grooming: it goes through
`Otro sector`, so the screens were demonstrating a path the product will not take.

**Decided:** rename to **`Barbería El Corte`**, the `siteName` the repository's own fixtures
already use (`fixtures/documents/barbershop-cover.json`,
`fixtures/documents/cover-and-services.json`). Name, sector and services now say the same thing,
and the preview copy changed with them.

### 5. D9's premise is wrong; its cardinality is not

D9 says a single card would be *"a lone card stranded in a four-column grid"*, leaving *"a large
empty gap"*, and proposes that the renderer pick a composition from the card count.

**Measured against the merged renderer**, at 1280, in the list of `fixtures/documents/cover-and-services.json`:

| Cards | List width | Card widths | `grid-template-columns` as computed |
|---|---|---|---|
| 1 | 1184px | 1184 | `1184px 0px 0px 0px` |
| 2 | 1184px | 584, 584 | `584px 584px 0px 0px` |
| 3 | 1184px | 384, 384, 384 | `384px 384px 384px 0px` |

`repeat(auto-fit, minmax(min(100%, 16rem), 1fr))` collapses the empty tracks, so one card already
takes the full width, two take half each and three a third. **D9's table is what the stylesheet
does today**, and the renderer does not need to choose anything: a renderer that picked a
composition from the content would also mean the same document renders differently as the user
ticks boxes, which is not how compositions work here — the composition is a variant in the
document (rule 1).

Reproduce it by rendering that fixture with `items` sliced to 1, 2 and 3 and measuring
`li` widths in a browser at 1280.

**What was real in D9** is the cardinality, and it closes the two questions ADR 0010 left open.
**Decided:** minimum 1, maximum 6, and zero cards means the section is not generated at all.
Recorded in **ADR 0013**. The "featured card with the photo beside it" is **not** adopted: it
needs images inside list items, which the "Qué hago" task excluded on purpose.

## The editor shell, as drawn

Kept here rather than in an ADR: these are measurements that will move the first week
`apps/editor` exists, and an ADR would make nudging a bar a formal amendment. ADR 0015 holds the
part that must not move — the interface tokens and their separation from the published site.

- **Top bar, 58px:** the mark, the site name with a chevron, centred page tabs, a device toggle
  (view only in phase 1), undo and redo, a green `Guardado` tick, and `Descargar`.
- **Left rail, 80px:** four icon buttons — `Secciones`, `Estilo`, `Páginas`, `Fotos`. The
  advanced-module dossier describes these four with the design tools switched off.
- **Canvas:** the rest of the screen. Selection is a 2px blue outline with four corner handles.
- **Floating toolbar** above the selection, four to seven actions: `Aa`, a size stepper, bold,
  alignment, a colour swatch, link, then move, duplicate and delete.
- **Section insertion** happens in the gap between sections, as a dashed rule broken by a pill
  reading `Añadir sección aquí` — never a list in a side panel.

## Still open

- **`Páginas` and `Fotos` are phase 2, and mockup 08 draws them.** Organic pages and photo
  upload both belong to phase 2 in the protocol, and ADR 0011 says a phase 1 site carries sample
  photos only. The mockup now draws both dimmed and marked `Fase 2`, so nobody implements them by
  reading the screen. What, if anything, they do in phase 1 — swapping one sample photo for
  another, say — is decided when the editor task is written.
- **Mockup 13's palettes and typefaces are not the ones in the code.** The screen offers `Azul
  confianza`, `Verde natural`, `Coral cercano` and `Neutro elegante`, plus Inter, Poppins and
  Source Serif. `packages/tokens` ships four palettes (`classic-blue`, `warm-terracotta`,
  `forest-emerald`, `dark-slate`) and three type pairs (`modern-sans`, `editorial-serif`,
  `classic-display`), all with their contrast asserted for every text pair. Phase 2 work, and the
  reconciliation is naming and ordering, not re-inventing: a palette that is not contrast-tested
  cannot ship.
- **The mockups load Inter from Google Fonts.** Fine for a prototype opened on a laptop. It must
  never happen in a published site (ADR 0001): a client's site has no network dependency.
- **The Spanish interface strings** in these screens are the source for
  `apps/editor/src/locales/es.json` when that app exists. They are not copied into `.ts` files.
- **`SERVICES_ITEMS` still says 2..6** in `packages/catalog/src/services.ts`. ADR 0013 decides
  1..6; the code change belongs to the questionnaire and generator task, and has its own issue.
- The handoff's own open list stands: the price, who issues the invoice and how VAT is handled,
  and the photo bank's actual images.

## What building the prototype surfaced

The three variants shown in screen 07 are now generated from documents written by hand for the
two businesses (`prototype/`). Filling those documents surfaced the following. None of it was
improvised: each one is recorded here and left as it is.

**Product decisions nobody has taken:**
- **There is no third cover composition.** The catalog has two (`image-right`,
  `image-background`); the mockup's "Tipográfica", everything centred with the name large, does
  not exist. The three variants are therefore combinations: `image-right` + `stacked`,
  `image-background` + `side`, `image-right` + `split`. **At thumbnail size the first and third
  are hard to tell apart**, because they share the cover and differ only in the "Qué hago" block.
  That weakens the dossier's promise that the three "cambian de composición", and a centred cover
  would be a catalog task of its own.
- **A free section's heading level follows the `catalogId` it declares:** `cover` gives `h1`,
  anything else `h2`. The prototype's "Contacto" declares `services` so that its title is an
  `h2`, which is right by accident rather than by design.
- **The main button has nowhere to point.** The renderer emits no `id` on a section, so an
  in-page anchor like `#contacto` does not resolve. In the prototype the button reads `Visítanos`
  and goes nowhere, and that will have to be decided for real when the questionnaire's fifth
  answer becomes a link.
- **`location`'s `split` composition leaves a hole when `hours` is absent.** The right-hand
  column places `hours` at row 2 and `map` at row 3, so with no hours the map sits alone under an
  empty row rather than moving up. Seen building `fixtures/documents/contacto-y-horario.json`
  (`docs/tasks/catalog-horario-y-contacto.md`), which deliberately left `hours` out to exercise
  the optional slot. Fixing it means deciding a composition rule — whether an absent optional
  slot should collapse the row beneath it, generally or just here — which is a decision that task
  did not have to take. Recorded, not resolved in passing.

**What is ours rather than the product's, and is disclosed to the owner during the test:**
- **The cards were chosen by us.** The owner never ticked anything in question 3.
- **The palette was chosen by us, knowing which business it was** — terracotta for the
  restaurant, blue for the shoe shop. In the product the palette comes from the logo, and neither
  business gave one. This is exactly the knowledge the generator will not have, so a compliment
  about the colours would measure our taste, not the product. The script does not ask about
  colour.
- **The photos are placeholders** labelled "Tu foto aquí". The bank of ADR 0011 does not exist,
  so nothing about photos is being tested.
- **The main action was set by us** to "come to the premises", because no phone number or email
  enters the repository.

**Smaller things, recorded so they are not rediscovered:**
- The map's coordinates are approximate, and a map publishes as a link, not a map (ADR 0004).
- Taberna Santo Domingo has four cards and Conchi three, which exercises the cardinality of
  ADR 0013 with real content.
- Chrome will not render a `file://` page inside an `iframe` of another `file://` page, so
  screen 07 shows screenshots of the real sites and links to the sites themselves.
- `scripts/build-sample-site.ts` now also takes a path to a document, so these stay out of the
  golden corpus. It is the only code this work touched.

## The two businesses for the usability test

D13 names them, and they are the next step after this review: **Restaurante Taberna Santo
Domingo** and **Conchi**, both in Ronda, both without a website on their Google listing, both
exactly the target user. The absence of a website is confirmed on contact, since a listing can
simply be incomplete.
