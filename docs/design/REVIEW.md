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

- **Two things the advanced-module dossier §5 describes that this product cannot do.** Recorded
  here on 30 September 2026, with mockup 16 and [ADR 0025](../decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md),
  because a source comment is not where a deviation from an approved artefact belongs:
  - **«Al escalar se guarda una versión.»** There is no named version history. `autosave.ts` keeps
    one session and no history, so within a session the undo stack is the version and across a
    reload there is none. **Mockup 16 does not promise a saved version**, and neither may the
    interface: what it promises instead is true — the return puts every text and photo back in its
    exact slot, because `escalate` keeps the element ids.
  - **«El panel de secciones marca las diseñadas a mano.»** There is no sections panel: `Secciones`
    *is* the canvas (`EditorShell.tsx` says so). The mark is a pill drawn on the section itself, as
    injected chrome, so it can never reach a published page.

- **The left rail is five items with the design tools on.** `HANDOFF.md` and this file both justify
  the four-item rail as the advanced dossier's «Apagado» column, which was right and is now only
  half the story: with the tools on it gains `Diseño`. The switch itself is **not** a rail item — it
  sits at the rail's foot, separated — and ADR 0025 records why it is not in the top bar, which is
  the measurement sprint 7 day 7 took of that row overflowing.

- **`Páginas` and `Fotos` are phase 2, and mockup 08 draws them.** Organic pages and photo
  upload both belong to phase 2 in the protocol, and ADR 0011 says a phase 1 site carries sample
  photos only. The mockup now draws both dimmed and marked `Fase 2`, so nobody implements them by
  reading the screen. What, if anything, they do in phase 1 — swapping one sample photo for
  another, say — is decided when the editor task is written.

  **Answered by the shipped editor, 26 September 2026.** No editor task file was ever written;
  `apps/editor` was built directly (ADR 0017). `EditorShell.tsx` therefore holds decisions that
  diverge from mockup 08, recorded here because a source comment is not where a deviation from an
  approved screen belongs:
  - **No second page tab and no `+`.** The mockup shows `Inicio`, `Servicios` and an add-page
    control. The document has exactly one page, and a button that adds a page nothing can hold is
    the dead-button mistake sprint 1 kept refusing. `Inicio` is drawn alone.
  - **No site-preview nav bar inside the canvas card.** The mockup's `Inicio Servicios Galería
    Contacto Reserva` strip is a real multi-page site's own navigation. The generator produces no
    such navigation, so drawing it would advertise links that go nowhere.

  **`Estilo` was dimmed too, from 26 September to 28 September 2026** — the mockup dims only
  `Fotos` and `Páginas`, but protocol Part 14 put "Estilo global" in phase 2 alongside them, and
  the mockup predates that being pinned down. **No longer true**: sprint 4 day 2 gave the rail a
  live `Estilo` item and the panel behind it, once phase 1's acceptance criterion was measured
  and the same usability session named the gap. `Páginas` and `Fotos` stay dimmed — organic pages
  and a real photo upload are both still unbuilt, not merely undecided.
- **Resolved, 28 September 2026 — mockup 13's palettes and typefaces are not the ones in the
  code.** The claim was that the screen offers `Azul confianza`, `Verde natural`, `Coral cercano`
  and `Neutro elegante`, plus Inter, Poppins and Source Serif, while `packages/tokens` ships
  `classic-blue`, `warm-terracotta`, `forest-emerald`, `dark-slate` and the three type pairs — and
  that the reconciliation would be naming and ordering, not re-inventing. It was, and the Estilo
  panel now ships with these names, in `packages/tokens/src/locales/es.json`, which until then had
  no locale file at all: the `nameKey` every palette and pair declared resolved to nothing,
  unnoticed because nothing had ever displayed them.

  | Code | Shown as | Where the name comes from |
  |---|---|---|
  | `classic-blue` | **Azul confianza** | Mockup 13, unchanged |
  | `forest-emerald` | **Verde natural** | Mockup 13, unchanged |
  | `warm-terracotta` | **Terracota cálida** | The mockup's warm palette is `Coral cercano`, drawn around `#F2704B`. Ours is `#9A3412`, a deep brick. "Coral" would name a colour this palette does not contain |
  | `dark-slate` | **Pizarra oscura** | The mockup calls it `Neutro elegante`. It is white text on near-black, and the one thing an owner needs to know before clicking is that it is dark. A name that hides that is not a translation of it |
  | `modern-sans` | **Moderna y neutra** | Mockup 13's own words for Inter |
  | `classic-display` | **Clásica y seria** | Mockup 13's own words for Source Serif |
  | `editorial-serif` | **Sobria y legible** | No mockup counterpart: serif headings over a plain sans body, which is neither of the other two |

  **Typefaces are named by character, never by font**, which is the mockup's other divergence and
  the deliberate one. Issue #9: Inter and Playfair Display fall back to something else on a machine
  without them, and ADR 0001 forbids downloading either — so "Inter" as a label promises a font
  that may never arrive, while "Moderna y neutra" is true whichever one resolves. The `Aa` specimen
  beside each name is rendered in that pair's real stack, so what it shows *is* what this machine
  will give, fallback included.

  **Order follows `PALETTES`, not the mockup**, which differs only in swapping the second and third.
  Both put the safe blue first and the dark one last, and the accessibility matrix iterates
  `PALETTES` — reordering the catalog to match a mockup exactly would churn that output for nothing
  an owner could see.

- **No mockup draws «Precios» either, and a carta of several courses reads as several sections.**
  The dossier's nine include it («Tarifas o planes») and it shipped on sprint 4 day 6, but no
  screen shows one. Two decisions are recorded here because they are about how a page reads:

  **A price list is drawn as a list, not as a card grid.** Every other section that holds a list
  holds cards, and the generic `.rb-list` rule flows them three abreast, which is right for
  services and opinions. A twelve-dish carta drawn that way came out as four rows of three, which
  nobody reads top to bottom. One rule — `.rb-prices .rb-list { grid-template-columns: 1fr }` —
  rather than a second list drawing, since the only thing that differs is how many across.

  **Three courses still read as three sections, and that is measured rather than asserted.**
  Building «Entrantes», «Carnes» and «Postres» by duplicating gives each 48px of its own padding
  with 76px of page between them: **172px of empty space between the last dish of one course and
  the heading of the next**, with transparent backgrounds and nothing framing them as one menu. It
  is usable — a small restaurant's carta often is one section — but it is not a carta.

  The cheap lever, not taken: a rule closing up two adjacent sections of the same preset. It is
  left open because it is a general question rather than a price-list one — it would apply to two
  «Opiniones» in a row just as much, and whether adjacent sections of one kind should read as one
  thing is a design decision rather than a rendering detail.

- **No mockup draws «variantes de sección», and it shipped on sprint 4 day 4.** Protocol Part 14
  names it as a phase 2 item and the catalog has carried the compositions since sprint 2 — thirteen
  of them, two or three per section, built and tested and unreachable — but no screen in
  `docs/design/mockups/` shows a control for choosing one. Mockup 13 is global style; mockup 08's
  floating toolbar is about a selected *element*. So the placement was development's to decide, and
  it is recorded here rather than in a source comment:

  The control is a **sixth button in the per-section action cluster**, opening a small menu of the
  compositions by their Spanish name («Foto a la derecha», «En dos columnas»), with the one in use
  marked. It follows the pattern the insertion pill established — chrome injected into the preview
  frame, anchored to the thing it acts on — for the same reason: only the frame knows where a
  section sits. The menu names what does not change, «El texto y las fotos no cambian», because
  that is rule 1 and it is the first question anyone would have.

  **The button is drawn conditionally**, which is new for this cluster: a section carrying its own
  layout gets none, because for a hand-designed section the variant id decides nothing
  (`build.ts` reads `section.layout ?? preset.layoutFor(…)`), and a button that lights up and moves
  no pixel is the dead-button mistake in a new costume. `setVariant` in the schema refuses that case
  outright as a backstop.

  **Selection and the open menu now survive the preview's re-render**, which they never did before.
  Every action replaces the iframe's whole `srcDoc`, so the outline, the handles and the cluster
  were destroyed and rebuilt each time — one click to get back, which nobody noticed because you
  rarely delete the same section twice. Composition is the first action anyone repeats on purpose,
  and re-selecting between tries would have been the whole friction of the feature. It improves the
  other five buttons as a side effect.

- **No «+ Añadir página», and mockup 08 draws one.** The mockup's top bar has two page tabs, a
  `PÁGINAS: FASE 2` badge and a `+` labelled `Añadir página`. The shipped editor has the tabs and
  **not** the `+`, because the concept dossier §6 says a page is born by converting a section —
  «Cualquier sección puede convertirse en página» — and that «pedir al usuario que elija entre "una
  página" y "varias páginas" es pedirle una decisión técnica antes de que sepa qué va a contar».
  Where the concept exists to avoid asking a question, a screen that asks it is the screen that is
  wrong, and `CLAUDE.md` puts the dossiers above the code. Decided in
  [ADR 0022](../decisions/0022-a-page-is-born-by-converting-a-section.md), which also carries what
  would reopen it: an owner who looks for a way to make a page and does not find one.

  A second consequence worth having here rather than only in the ADR: **there is no empty page.**
  The insertion pill is drawn *between* sections (`Editor.tsx`, `wireInsertion`), so a page with
  none would have nowhere to click — the dead end the `+` would have led to.

- **The site's own menu, which this review previously ruled out, now exists.** The entry above says
  the mockup's `Inicio Servicios Galería Contacto Reserva` strip was not drawn because «the
  generator produces no such navigation, so drawing it would advertise links that go nowhere». That
  stopped being true with [ADR 0023](../decisions/0023-the-menu-and-the-footer-are-derived-chrome.md):
  the menu is derived from the home page's sections and the document's pages, and it is emitted from
  three entries upwards. The strip in the mockup is drawn inside the canvas card as part of the
  *preview*, which is exactly what it now is.

  **Two divergences from that strip, built on sprint 5 day 5 and recorded here rather than only in
  a source comment:**

  - **«Inicio» appears on every page except the home page**, where the mockup draws it always. On
    the home page a link to the page you are already reading does nothing, and a link that does
    nothing is the thing this product refuses everywhere else. Off the home page it is not
    decoration: a site whose every home section has been converted would otherwise offer, from one
    of those pages, a strip of other pages and no way back. ADR 0023 settles what the menu
    *contains* and says nothing about what it looks like from another page; this is that gap filled.
  - **No `Reserva` entry.** The mockup's last item is the main call to action repeated in the
    strip. The menu is derived from sections and pages, and the booking button is neither — it is a
    slot inside the contact section. Putting it in the menu would mean the menu knowing about one
    particular slot of one particular preset, which is the opposite of deriving.

- **Not implemented, and not planned: mockup 13's «Avanzado: colores exactos y tamaños».** The row
  at the foot of the style panel opens a free colour picker and size controls. There is no such
  control in the shipped panel and there is not meant to be. This review already said "a palette
  that is not contrast-tested cannot ship"; the protocol says it more strongly still, that a palette
  with bad contrast cannot even be declared. A picker is a machine for producing exactly that, and
  a site built with one is a site that gets published. It is the same warn-or-block line the rest of
  the product draws — marker text warns, a dead destination blocks — applied to colour, where the
  damage is invisible to the person causing it.

  **Amended by [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md)
  — and the picker stays refused.** What that ADR admits is not this row's free picker: it is
  document rule 6's own second arm, `{exact, exception: true}`, offered **only with the design tools
  on**, and only behind the pre-publish contrast review the advanced dossier §4 promised and nobody
  had built — blocking below 3:1, warning between 3:1 and 4.5:1, with the one-click fix being to
  drop the exception and go back to the reference. The sentence this row rests on stays true, and
  the ADR quotes it: an exact colour with no net is exactly what was refused here.
  **The exact value and that review shipped together**, in one merge, which is what the ADR's §2
  asks for by name.

  Two corrections to this entry, both true from sprint 9 onward. «Tamaños»: the style panel now
  offers three scales, by reference and named by character, which is the system the dossier §6
  always described — so that half of the mockup's row is answered without a picker. And **an exact
  `fontSize` is still refused**, which the ADR's own table records: not for contrast, but because
  the same §4 sentence promises the check covers «desbordes por debajo de 320 píxeles», nothing
  measures that yet, and a size is the one value in this vocabulary that can cause one.

  **The second of those two stopped being true on 1 October 2026**, sprint 10 day 6: the editor
  measures each page at 320 pixels before a download and warns with the sections that run past the
  edge, so an exact `fontSize` shipped in that same merge. **The picker is still refused** — that is
  the sentence this entry rests on and nothing has touched it. What exists is rule 6's marked
  exception, behind the design tools, behind a review; what is still refused is a free colour
  control with nothing in front of it.

  **Accepted by David on 1 October 2026, not by direction** — see the ADR's own header for what
  that does and does not mean. This entry is amended by a decision direction has not looked at.

- **Five swatches per palette, but not the mockup's five.** The mockup draws five circles; our
  palettes hold six colours. The one left out is `color.accent`, and that is a fact about the code
  rather than a preference: **no rule the renderer emits reads `var(--color-accent)`**, and it is
  the only colour whose contrast is asserted nowhere — in `classic-blue` it is 3.19:1 on surface,
  under AA. Showing it would advertise a colour that appears nowhere on the page and carries no
  guarantee. Pinned by `packages/renderer/test/theme-css.test.ts`, which fails if a rule ever starts
  reading it; the fix then is a contrast pair first, not a relaxed test.

- **Resolved, 28 September 2026 — the editor's top bar names the variant, where mockup 08 names the
  business.** Found by walking the editor, and not caused by that day's work: it had been true
  since the editor existed, because `Editor`'s `title` prop is the variant caption and the shell
  rendered it as `siteName`. Direction settled it for the mockup: **the bar shows the business
  name.** The button around it still goes back to the three variants, and the variant's own caption
  still names the preview frame, where "which of the three am I in" is the useful thing to say.
- **The mockups load Inter from Google Fonts.** Fine for a prototype opened on a laptop. It must
  never happen in a published site (ADR 0001): a client's site has no network dependency.
- **Resolved, 26 September 2026 — the Spanish interface strings.** They were the source for
  `apps/editor/src/locales/es.json` when that app existed; that file now exists and every visible
  string is read from it. No Spanish user-facing literal lives in a `.ts` or `.tsx` file.
- **Resolved, 26 September 2026 — `SERVICES_ITEMS`.** It said 2..6 when this review was written;
  `packages/catalog/src/services.ts` now declares `{ min: 1, max: 6 }`, which is what ADR 0013
  decided. The claim above had outlived the code and is corrected here rather than deleted, so the
  record of what was once open survives.
- **Superseded, 1 October 2026 — mockup 17's «Negritas y cursivas» card.** That mockup draws the
  control struck through, with the reason «ninguna de sus dos condiciones de despertar se ha
  cumplido». The third usability session met the second condition on 30 September and a second owner
  asked for both marks, so
  [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) stopped waiting
  and [mockup 18](mockups/18-negrita-y-cursiva.html) draws the control that replaces the struck one.
  **The rest of mockup 17 stands**, its other three struck cards included — alignment, typography
  and per-element move/duplicate/delete are all still out, for the reasons it gives.
  Mockup 17 is not edited: it is the record of what sprint 9 decided, and a dated artefact that
  gets rewritten stops being evidence of anything.
  **Amended by [ADR 0027](../decisions/0027-a-mark-moves-with-the-text-under-it.md) in one further
  clause**, which is not a design matter but is recorded here because it changes what mockup 18 may
  draw: ADR 0024 forbade one run overlapping another, which read literally made bold *and* italic on
  the same words impossible — the first thing the owner named. Different marks may now overlap;
  identical ones merge.
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
