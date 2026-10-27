# Review of the phase 1 design handoff

**Date:** 2026-09-23 · **Reviewed against:** `docs/protocolo.md`, `docs/dossiers/`, the eleven
ADRs in `docs/decisions/`, and the merged code in `packages/`.

`HANDOFF.md` and the fifteen mockups came from a design session in Claude online. This is the
record of reading them against what the repository already decided: what holds, what does not,
and what was decided to close each gap. Where this file and `HANDOFF.md` disagree, this file is
the later document.

> **The header above is a dated record and the file is not.** The date, the eleven ADRs and the
> fifteen mockups are what the *first* reading was done against, on 23 September 2026; they are left
> as written because a review that silently re-dates itself stops saying when it looked. What has
> grown since, noted here so the numbers do not read as current: there are now **34 ADRs** and
> **19 mockups** — 16 through 19 (modo estudio, la barra y el sistema, negrita y cursiva, cómo se ve
> al compartir) were drawn after this review and are read against it rather than by it. Entries
> below carry their own dates, and the ones added in sprints 9 through 13 are the live half of this
> file. Last added to: **2 October 2026, closing sprint 13.**

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
  optional. **Since 13 October 2026, without a logo's choice the three proposals start in the
  neutral palette** — black and Retorika's blue — and the owner picks a colour afterwards in
  «Estilo» ([ADR 0041](../decisions/0041-the-proposals-start-neutral-and-the-palette-is-chosen-afterwards.md));
  the sector's default palette is no more.
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
  advanced-module dossier describes these four with the design tools switched off. **A fifth,
  `Compartir`, shipped on 2 October 2026 and is in no mockup before 19** — see the entry below.
- **Canvas:** the rest of the screen. Selection is a 2px blue outline with four corner handles.
- **Floating toolbar** above the selection, four to seven actions: `Aa`, a size stepper, bold,
  alignment, a colour swatch, link, then move, duplicate and delete.
- **Section insertion** happens in the gap between sections, as a dashed rule broken by a pill
  reading `Añadir sección aquí` — never a list in a side panel.

## `Compartir`: a rail item no earlier mockup draws, and the download dialog it stayed out of

Added 2 October 2026 with [ADR 0029](../decisions/0029-what-a-published-page-says-about-itself.md)
and **mockup 19**, which is the drawing the assessment below was made from.

**Why a rail item at all.** The two fields — the sentence a shared link shows, and the origin the
site will live at — belong to the whole site, like the theme and the pages, and the rail is this
editor's only site-wide navigation. The `Estilo` panel is scoped by mockup 13 to colour, type and
measures, and these are none of those.

**It takes the rail to six with the design tools on, which this file already flagged as a question.**
That is a real cost and is not waved away; what makes it worth paying is that the alternative
homes are each wrong for a reason, and the one that is only wrong *by a little* is the download
dialog, which is the next entry.

**«¿También en el diálogo de descarga?» — asked by David, drawn in mockup 19 band 3, and answered
no.** The moment is right: an owner usually knows their domain exactly when they are about to
download. What rules it out is what surrounds that moment. **The download path is where phase 1's
ten-minute criterion is measured**, and every gate on it today exists to stop or warn about
something that is wrong — too many photos, a colour nobody can read, something overflowing at
320px. An empty address is explicitly none of those: ADR 0029 makes it optional and says «vacío no
es error y no bloquea nada». A form there would be the first thing to interrupt a download that is
already correct, paid for by everybody so that a minority can fill it in.

What answers the worry underneath — that nobody finds the field — is the **name**. `Compartir` is
the word an owner already has in their head when the link is what they care about, and the help
line closes the sequence: «si la cambias, vuelve a descargar».

~~**What would reopen it:** a fourth usability session showing that nobody opens `Compartir`. That is
evidence this decision does not have, and the mockup says so rather than implying the question is
settled forever.~~

**Rewritten 2 October 2026 —
[ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md)
cancels the sessions**, and a reopening condition that names one would hold this closed forever.
Mockup 19 band 3 even says «y **no antes**», which was a guard against revisiting a decision on a
hunch and becomes a lock once the hunch is all there will ever be.

**What reopens it now:** David opening the editor, looking for where the site's address goes, and
not finding it — written down when it happens. It is weaker evidence than watching a stranger, and
saying so is the point of this paragraph rather than a hedge: the decision was taken on the shape of
the download path, which has not changed, and the thing a session would have added was the one fact
nobody inside can supply.

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

- **The left rail is ~~five~~ *seven* items with the design tools on.** `HANDOFF.md` and this file both justify
  the four-item rail as the advanced dossier's «Apagado» column, which was right and is now only
  half the story: with the tools on it gains `Diseño`. The switch itself is **not** a rail item — it
  sits at the rail's foot, separated — and ADR 0025 records why it is not in the top bar, which is
  the measurement sprint 7 day 7 took of that row overflowing.
  **Re-counted 4 October 2026: five became six with `Compartir` (sprint 12) and seven with `Listas`
  (sprint 14).** The number is corrected rather than the entry deleted, because the entry's point was
  never the number — it was that the rail's length is a cost nobody had priced. **Sprint 14 priced
  it**: the seventh item pushed the design-tools switch to 43 pixels from the bottom-left corner at
  720px tall, where browser chrome gathers, and two `e2e` tests started failing on it. `backlog.md`
  carries the measurement. This is the question becoming a number.

- **Mockup 16's switch question is overruled, and the shipped wording is not what it draws.**
  Mockup 16 band 1 draws **«¿Montas webs para otros?»**, from the advanced dossier §4's point that
  «ante "básico o avanzado" mucha gente miente hacia arriba». That is true about *levels* and the
  remedy does not follow from it: a question about **who somebody is**, answered to obtain a
  capability, is answered yes by everyone who wants the capability — so it filtered nobody while
  looking as though it did. Session 3 watched a car workshop's owner read it, answer «Sí,
  enciéndelas» and carry on, and nothing was lost by that, because ADR 0025 §1 is kept by the press
  rather than by the wording.

  **Amended by [ADR 0025](../decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md)'s
  own amendment, accepted by David on 1 October 2026 and built the same day.** The question now
  describes the tools — **«¿Quieres colocar tú cada elemento?»** — so the answer is accurate rather
  than aspirational. The mockup is left as drawn: it is the record of what was specified, and this is
  the file where an ADR overrules it.

  **The same amendment puts «Diseñar a mano» inside the `Diseño` panel**, beside the sentence that
  says you need it. The panel used to render «Diséñala a mano **desde su cabecera**» as a bare
  paragraph — a dead end naming its own exit — which is how an owner who had turned the tools on, and
  been told by that very panel that the grid existed, still asked for «más libertad en la posición».
  **ADR 0025 §7 is not amended**: escalation stays per section and `escalate` moves no element, which
  is exactly what makes a second door to the same offer safe.

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
  and the same usability session named the gap. ~~`Páginas` and `Fotos` stay dimmed — organic pages
  and a real photo upload are both still unbuilt, not merely undecided.~~
  **Corrected 4 October 2026, closing sprint 14: both shipped, and the stale half of this entry sat
  inside an entry that was already correcting itself.** `PagesPanel.tsx` and `PhotosPanel.tsx` exist,
  the `e2e` suite drives both, and `EditorShell` records that the grey shade for «this exists but not
  yet» lost its last caller in sprint 6. Somebody read this line, fixed the sentence above it and left
  the one below — which is the shape of rot this file is most prone to, because a corrected entry
  looks like a checked one.
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
  | `neutral` | **Neutra** | Added 13 October 2026 (ADR 0041), listed first: the palette every proposal starts in without a logo's choice — black ink, Retorika's blue, white surfaces |
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
  - **Dos tiras donde la maqueta dibuja una, desde el 16 de octubre de 2026** (sprint 23,
    [ADR 0043](../decisions/0043-the-menu-splits-in-two-and-the-owner-chooses.md)). Las páginas del
    sitio y las secciones de la página que se está viendo son dos menús, con sus dos nombres,
    «Páginas» y «Secciones». **En un sitio de una sola página el visitante no nota nada**, porque
    el menú de páginas no se dibuja cuando no hay a dónde ir: la división solo aparece el día que
    existe una segunda página. Fue elección de David entre cuatro opciones puestas delante, con lo
    que se entrega a cambio escrito en el ADR — y lo principal que se entrega es que convertir una
    sección deja de ser invisible para el visitante, porque su entrada se muda de una tira a otra.

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
- **Diverged since sprint 10 and recorded only now, closing sprint 12 — mockup 18's band 2, first
  state.** The mockup says that with nothing selected the `B` and `I` buttons **are not drawn**, and
  says it in as many words: «no se dibujan apagados». `Editor.tsx` draws them and disables them, and
  its comment argues for that on purpose — «"No door" and "the door is here, pick some words first"
  are different things, and removing the buttons as the selection collapses would make them
  flicker».
  **The reasoning in the code is good and it is still a divergence from an approved mockup**, which
  is what this file is for. It shipped in sprint 10 and nothing wrote it down for two sprints; the
  sweep that closes sprint 12 is what found it, by reading the mockup against the code rather than
  against memory.
  ~~**Left as it is, pending a word.** Changing a control two usability sessions have not yet met is
  not a tidy-up, and the flicker the comment names is a real cost that the mockup, drawn before the
  bar existed, could not have weighed. What is refused is the current state: a product doing one
  thing while an approved drawing says another, with nobody told.~~

  **Closed in favour of the drawing, 2 October 2026, by David, and built in sprint 13 day 3.** Without
  a selection the two buttons are not drawn — and the whole `Resaltar` group goes with them, because a
  caption over nothing is the empty row this bar refuses everywhere else.

  **The code's argument was good and lost on its merits rather than on authority.** «"No door" and
  "the door is here, pick some words first" are different things» is true, and the flicker is real.
  What decided it is that the bar already answers this question the same way everywhere else — «a
  control that does not apply is not drawn, not drawn greyed out», which is `textToolbar.ts`'s own
  rule and ADR 0025 §6's — so the disabled state was the single exception to a rule the rest of the
  bar keeps. The comment is kept in the code saying why it was discarded.

  **And the sentence above about «two usability sessions» stopped being a reason**: [ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md)
  cancels them, so «a control the sessions have not met» describes every control there will ever be.
- **Half superseded, 2 October 2026 — mockup 17's struck `Aa` card.** That card strikes two things
  at once, and only one of them comes back. Its text, word for word:

  > «La tipografía, entera — ni el `Aa` por elemento ni «tipografías propias». Incidencia #9:
  > `modern-sans` y `classic-display` caen a la fuente del sistema en máquinas sin Inter ni Playfair,
  > **y el ADR 0001 prohíbe descargarlas**. Ofrecerla sería prometer una letra que el visitante puede
  > no ver nunca.»

  **Both clauses of that reason were measured false in sprint 11**, which is why this is a premise
  that expired rather than a change of mind:

  - «el ADR 0001 prohíbe descargarlas» — a relative `@font-face` **loads and renders from `file://`**,
    measured at 385px against 411px with the file missing, in Chrome 154 and Firefox 155 by
    double-click. The double-click promise survives a shipped face, which is what let
    [ADR 0028](../decisions/0028-typography-needs-a-decision-from-direction.md) ship the two faces at
    all.
  - «caen a la fuente del sistema» — [#9](https://github.com/dnarram/retorika-builder/issues/9) closed
    on 1 October 2026. The faces travel in the ZIP with their OFL text beside them, and `buildSite`
    refuses a bundle with a face and no licence.

  So the per-element `Aa` is built, in sprint 13 day 5, as
  [ADR 0032](../decisions/0032-typography-per-element-with-the-faces-that-travel.md): a «Letra» group
  of two buttons offering the two families the theme already carries, behind the design-tools switch,
  **named «Titular» and «Texto» — by role and never by font**, which is issue #9's own rule and the one
  the `Estilo` panel has followed since sprint 4.

  **«Tipografías propias» stays struck, and its reason has not expired**: a family the owner types is
  a face the ZIP does not ship and a letter the visitor may never see, which is exactly the promise
  this card refused. ADR 0032 §2 makes it **unexpressible** rather than merely unoffered — `fontFamily`
  is the one style property with no exact arm, in the type as well as at runtime — so there is no rule
  for a later control to remember.

  **Answered on 18 October 2026, in the one form that reason allows** —
  [ADR 0046](../decisions/0046-the-gallery-ships-the-faces-so-the-letter-can-be-named.md), sprint 24
  día 6. The `Estilo` panel now offers **eight families by their real names**, folded away under the
  three pairs, with headings and text chosen separately and each specimen drawn in the very file the
  ZIP will carry. This is not the struck card coming back: a family the owner **types** is still
  unexpressible, and nothing above changes. What changed is that there is now a third possibility the
  card did not consider — **a closed gallery whose faces we send** — so «una letra que el visitante
  puede no ver nunca» is not true of these eight. The floating toolbar's two buttons keep their role
  words and name the chosen family in their accessible name only. The sprint's full entry is below,
  under sprint 24.

  **The switch is this file's business and is recorded as an open question rather than as a reading of
  the drawing.** Mockup 17 puts typography in «lo que no lleva», not in the «Encendido» half, so there
  was no drawing to follow; it went behind the switch because [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md)
  draws that line at «a design choice about one loose element». **Reversible in a line** if seeing it
  says otherwise.

  Mockup 17 is not edited, for the reason given two entries above: it is the record of what sprint 9
  decided *and of the reason it decided it*, and a dated artefact that gets rewritten stops being
  evidence of anything. Its line 157 — «La otra mitad, «tipografías propias», no entra en este sprint:
  la incidencia #9 sigue abierta» — is now true of one half and stale about the issue, and stays as
  written.
- **Not built, and that is the decision — 2 October 2026, mockup 06, «Estamos montando tu web».**
  The only approved phase-1 screen with no code and no locale keys, and after measuring what it would
  cover, there is nothing there to cover.

  It draws five progress lines — «Elegidas las secciones…», «Escritos los textos…», «Sacada la
  paleta…», «Colocando las fotos…», «Preparando las tres versiones» — under «Tarda unos segundos. No
  cierres esta ventana». **Measured, the whole of generation takes a median of 0.12 ms** (60 runs,
  min 0.07 ms, max 3.57 ms on the first cold call): `generateVariants` is synchronous and runs in the
  browser, the logo's palette was already extracted back at question 1, and the photo bank's bytes
  arrive *after* the three cards are up, filling in over the grey markers. So there is no moment
  between the last answer and mockup 07 for this screen to occupy.

  **Drawing it would mean faking all five lines and making a false statement in the sixth** — «tarda
  unos segundos» is three orders of magnitude out, and there is no window somebody must not close. A
  progress bar that reports nothing is the kind of claim this file exists to refuse; the honest
  version of this screen is its absence.

  **The premise is guarded rather than trusted.** The `e2e` suite measures the real time from
  pressing «Crear mi web» to the three cards and fails above two seconds, with the failure message
  saying what to do about it: if generation ever grows something genuinely slow, that test goes red
  and mockup 06 should be built rather than the number raised. The same test asserts the screen's own
  words appear nowhere, so «not drawn» cannot quietly become «drawn for a tenth of a millisecond».
  Mockup 06 is not edited; it stays as the record of what was expected before anything was measured.
- **Built, with one clause of its text refused — 2 October 2026, mockup 11's in-canvas notice.**
  Mockup 11 draws **two** things for one delete and only one of them had ever been built: the dark
  toast with «Deshacer», shipped in sprint 4, and a `2px dashed` panel in the flow of the page reading
  «Aquí estaba «Opiniones»» over «El hueco desaparecerá solo en unos segundos.» The second is now
  built — sprint 13 day 6 — because it says the thing the toast cannot: **where.** A section deleted
  below the fold leaves a page that silently reflows while «Deshacer» sits at the bottom of the window
  pointing at nothing the person can see.

  **The second line is not the mockup's when the toast has no timer, and the drawing loses that clause
  on its merits.** [ADR 0014](../decisions/0014-deleting-a-section-never-asks.md) gives
  a section the owner had edited **no timer at all** — its toast waits until it is undone or dismissed
  — so for that section «desaparecerá solo en unos segundos» is a promise the product does not keep.
  It reads «El hueco se queda hasta que deshagas o cierres el aviso» instead. **The mockup is not
  wrong so much as earlier**: it was drawn before the two-speed toast existed, and the clause is the
  only part of it that the later decision contradicts. Mockup 11 is not edited.

  The notice is injected chrome, like every other `rb-` node in the canvas: the section is gone from
  the document the instant it is deleted (rule 3's own exception, ADR 0003 — there is no trash inside
  the document), so there is nothing for the renderer to draw and nothing that could reach a published
  page.
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
- ~~**The main button has nowhere to point.** The renderer emits no `id` on a section, so an
  in-page anchor like `#contacto` does not resolve. In the prototype the button reads `Visítanos`
  and goes nowhere, and that will have to be decided for real when the questionnaire's fifth
  answer becomes a link.~~
  **Corrected 4 October 2026: it does.** `packages/renderer/src/build.ts:474` emits the section's own
  id — «deliberately the section's own id rather than a slug of its Spanish name», because this package
  may not import the catalog — and `packages/schema/src/destinations.ts` counts the anchors pointing at
  it, which is what the delete toast's «un botón de tu web llevaba aquí» reads. The entry outlived the
  code by several sprints.
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

---

## Two screens with no mockup, and what stands in for one (4 October 2026, sprint 15)

`docs/protocolo.md:971` makes the mockups the interface specification — «la maquetación, los textos
en castellano, los colores y los gestos ya están decididos» — and **there is no mockup of a landing
page and none of a login.** There never was: the concept dossier's «Seis pantallas y ninguna más»
describes the journey from the first question to the download, and its first screen is «sin registro
previo».

[ADR 0034](../decisions/0034-the-account-arrives-at-the-end.md) §20 decides what to do about that:
**no mockup is invented and none is back-dated.** For these screens the ADR and the sprint's pull
requests are the specification, Spanish copy included, which is this file's own mechanism — an ADR
overruling the design handoff — applied to a gap rather than to a disagreement. If a mockup is ever
drawn for them, it inherits from there.

**What the screens are, so this file says it rather than only the ADR:**

| Route | What it is | Why it is not a seventh screen |
|---|---|---|
| `/` | The landing: what Retorika is, «Empezar», and «Ya tengo cuenta» | It sits *before* the dossier's six, and asks for nothing. The six are unchanged and still start at «¿Cómo se llama tu negocio?», now at `/empezar` |
| `/entrar`, `/entrar/recuperar`, `/entrar/nueva-contrasena` | Coming back to a web already saved | Not a way in. The account is created at the end (§2), so nobody on their way to a first website meets any of them |
| `/mis-webs`, `/mis-webs/[id]` | «Tus webs guardadas», and opening one | **«Guardadas», never «publicadas».** ADR 0008 gives the editor no hosted-publishing entry point, and a list on our domain that said «publicadas» would imply we host them |
| `/cuenta` | The copy you take with you, and the way out | Protocol Parts 15 and 16 |

**And one correction to this sprint's own record, found by a test that failed for the right
reason.** ADR 0034's context table claimed `es.json:7` — «Sin registro, sin tutoriales» — was the
visible promise on screen. It is not: every questionnaire step supplies its own footer caption, so
that string's `??` fallback is unreachable and it has been dead copy since the per-step footers
arrived. The ADR carries the correction and an amendment; the promise now has a visible home on the
landing, and the e2e asserts the promise itself — no password field anywhere in the five questions —
rather than a sentence about it.

---

## El cromo del editor gana un sistema visual (5 de octubre de 2026)

Dirección pidió modernizar el cromo del editor — «los paneles se ven estilo años 2000» — con
**sombreado, contraste y transiciones**, y usando el hover para dirigir la mirada, sin tocar los
colores de marca. Esta sección es el registro, porque es aquí donde va: el **ADR 0015 se excluye a
sí mismo** de la apariencia del cascarón, con todas las letras —

> «The editor's shell — the bar heights, the rail width, the toolbar's contents — is **not decided
> here**. It is drawn in the mockups and written down in `docs/design/REVIEW.md`, where it can
> change as the editor is built without amending an ADR.»

— mientras que **los valores de color sí son suyos**. De ahí la forma del trabajo: ni un color de
marca cambia; lo que cambia es la forma, la profundidad, el movimiento, el foco, y **qué color se
pone sobre cuál**.

### Lo que dibujaban las maquetas, y lo que no

La maqueta 08 dibuja el raíl de 80px con sus iconos de 46×46 en recuadro, la barra de 58px y la
tarjeta del lienzo. **Esa geometría no se toca y sigue siendo la especificación.**

Lo que las maquetas **no** dicen, y es el hallazgo que ordena todo lo demás: **la maqueta 08 no
tiene ni una regla `:hover` ni una `transition`**. Ninguna de las diecinueve las tiene. Son dibujos,
no especificaciones de interacción, y el código heredó esa ausencia: una sola `transition` en toda
la aplicación y cero `:focus-visible`. Así que el movimiento y los estados **no contradicen ninguna
maqueta**; rellenan un hueco que nunca se rellenó. Ninguna maqueta se edita.

### Lo que se midió antes de tocar nada

| Hecho | Medida |
|---|---|
| Radios distintos en el cromo | **13**, siete de ellos dentro de un rango de 9px |
| Sombras | **6**, improvisadas, de una capa; la de diálogos con alfa 0.28 |
| `transition` en toda la aplicación | **1** |
| `:focus-visible` | **0** |
| `--ui-border` como linde de un control | **1,19:1** (WCAG 1.4.11 pide 3:1) |
| Pestaña de página activa (`#156FE7` sobre `#E8F1FE`) | **4,14:1** — falla AA para texto normal |
| Borde de «Guardar en mi cuenta» | `rgb(15,23,42)`, casi negro: `border-ui-line` **no existe** como token |

### El sistema, y de dónde salen sus números

**Cuatro radios** donde había trece, y **no son inventados**: son los de la propia tabla del ADR
0015 —«radius 20 for dialogs, 11–14 for controls»— que el código incumplía en ambas direcciones.
`--ui-radius` pasa de 14 a 12; nada consumía `rounded-ui`, así que nada se mueve con él.

**Tres niveles de profundidad, de dos capas cada uno** (sombra de contacto + ambiental), sobre la
tinta pizarra que ya era la convención.

**Una curva y dos duraciones**, con **tope de 200ms** — que es una restricción de un test, no un
gusto: el guard de paneles espera 350ms a que el lienzo se asiente.

**`--ui-border-strong: #8490A1`**, el color más claro de la familia de `--ui-muted` que supera 3:1
sobre **las dos** superficies (3,24:1 sobre blanco, 3,02:1 sobre `#F5F7FA`), resuelto y no elegido a
ojo. `--ui-border` se queda para lo que solo separa; el nuevo es para cuando el linde **es** la
información.

**Y `prefers-reduced-motion`, que no existía en todo el repositorio.** Añadir movimiento sin él
habría sido arreglar un problema de accesibilidad creando otro.

### El raíl, que es lo que cambia hoy

**Un elemento en reposo deja de tener recuadro.** Antes los siete llevaban el suyo, estuvieran
elegidos o no: siete cajas por el borde de la pantalla pidiendo atención que no habían ganado, y un
estado elegido que se reducía a «la caja se pone azul». Enrecuadrar lo no elegido es la costumbre
que envejece una barra de herramientas más rápido que ningún color.

Ahora el cuadrado se dibuja **solo** cuando el elemento está elegido o el puntero está encima, y el
elegido lleva **tres señales, no una**: la superficie de marca, la tinta de marca y una regla en el
canto interior del raíl. Cualquiera de las tres basta por sí sola, que es lo que lo mantiene legible
para quien no separa el azul del gris.

El interruptor de herramientas: el pulgar **se desliza** en vez de teletransportarse (antes se movía
con `justify-start`/`justify-end`, que no deja nada que animar), y su carril apagado pasa de 1,19:1
a 3,02:1 — antes era un interruptor cuyo «apagado» no se veía.

| | antes | después |
|---|---|---|
| El raíl | ![antes](review/2026-10-05-el-cromo/rail-antes.png) | ![después](review/2026-10-05-el-cromo/rail-despues.png) |

Y los dos estados que antes no existían: [el hover](review/2026-10-05-el-cromo/rail-hover.png) y
[el foco de teclado](review/2026-10-05-el-cromo/rail-foco.png).

### Dos cosas que solo se vieron mirando la pantalla

1. **La regla indicadora no se dibujaba.** Estaba colocada a `-left-3.5`, fuera de la caja que el
   raíl recorta. Una señal que no se pinta es exactamente el fallo del botón muerto con otro traje.
2. **El anillo de foco se dibujaba dos veces**: uno alrededor del icono y otro cruzando los 80px del
   botón entero. La causa es de cascada y merece quedar escrita: **el CSS sin capa gana a cualquier
   regla en capa**, sea cual sea su especificidad, y todas las utilidades de Tailwind están en capas
   — así que un `:focus-visible` global sin capa no se puede sobrescribir en ningún sitio. Ahora
   está en `@layer base`.

### Lo que queda, y cuándo

Día 2 la barra superior y las pestañas de página (incluido el contraste de 4,14:1 y el borde
invisible); día 3 los seis paneles derechos; día 4 el cromo del lienzo. **Fuera por decisión de
dirección: la barra flotante y el conmutador PC/móvil** — «el cliente dijo que le encanta cómo
transiciona de vista pc a vista móvil»—, cuyos radios quedan nombrados como excepción permanente en
`apps/editor/test/chromeScale.test.ts`.

### Día 2: la barra superior y las pestañas de página (5 de octubre de 2026)

| | |
|---|---|
| antes | ![antes](review/2026-10-05-el-cromo/barra-antes.png) |
| después | ![después](review/2026-10-05-el-cromo/barra-despues.png) |

**La pestaña activa fallaba AA y era justo lo que dirección señaló.** Era `text-ui-brand` sobre
`bg-ui-brand-surface`: el azul de marca sobre su propio tinte, **4,14:1**, por debajo del 4,5 que
WCAG pide a un texto de 14px semibold. Los títulos de página son las palabras del propio dueño y lo
único en esa barra que dice dónde está, así que era el peor sitio del cromo para ese fallo.

**No cambia ni un color de marca.** La tinta sobre el chip mide **15,06:1**, y el azul se muda al
indicador, donde es un gráfico a 4,71:1 sobre blanco — muy por encima del 3:1 que se le pide. El
arreglo fue **qué color va sobre cuál**, no qué colores existen.

**El indicador se desliza**, uno para toda la tira en vez de uno por pestaña, con `transform` y
`width` y nunca `left`, así que no reflota nada mientras viaja. Medido: `translateX` 0 → 186px y
ancho 180 → 134px al cambiar de página, con 0,18s de transición. **Con `prefers-reduced-motion`
cae a 1e-05s** y llega en vez de viajar, que es el ajuste que pidió dirección.

**Y un bug que no era estilo.** `border-ui-line` **no existe como token**: Tailwind no emitía color
para esa clase y el `border` a secas caía en `currentColor`, así que «Guardar en mi cuenta» llevaba
un contorno **casi negro** — medido en Chromium como `rgb(15, 23, 42)` donde se quería una línea de
pelo. Ahora `rgb(232, 236, 242)`. Una clase que se resuelve en silencio a nada falla igual que el
token que falta: sin error en ninguna parte, solo lo que no era en pantalla.

Cuatro valores sueltos más pasan a token: el galón `#94A3B8`, el rojo `#BE123C` —el cuarto rojo
distinto del repositorio—, el azul deshabilitado `#8FB4E9`, y el verde `#03D26E`, que estaba escrito
a mano **al lado del token `--ui-ok` que ya tenía ese mismo valor**.

Deshacer, rehacer, el nombre del negocio y los dos botones ganan hover, foco y pulsación. **El
conmutador PC/móvil no se toca**, y sus tres radios siguen nombrados como excepción permanente.

Y una cosa que solo se vio en la captura: con la pestaña activa y la pestaña bajo el puntero las dos
sobre `--ui-bg`, **los dos estados eran casi idénticos**. La activa lleva ahora un paso más de gris:
«dónde estoy» no puede parecerse a «dónde está el puntero».

### Día 3: los seis paneles derechos (5 de octubre de 2026)

| | antes | después |
|---|---|---|
| «Páginas» | ![antes](review/2026-10-05-el-cromo/panel-paginas-antes.png) | ![después](review/2026-10-05-el-cromo/panel-paginas-despues.png) |
| «Estilo» | ![antes](review/2026-10-05-el-cromo/panel-estilo-antes.png) | ![después](review/2026-10-05-el-cromo/panel-estilo-despues.png) |

**Lo que estaba mal, contado y no sentido.** Tres de los seis se dibujaban como tarjeta —«Estilo»,
«Compartir», «Diseño»— y tres no se dibujaban en absoluto, dejando sus filas sueltas sobre el gris
—«Páginas», «Fotos», «Listas»—. Abrir dos iconos distintos del raíl daba **dos clases de objeto
distintas**. Las esquinas de fila venían en **cuatro radios** según en qué panel estuvieras: 10px,
11px, 9px y `rounded-md`. Existían **dos componentes `SmallButton`** separados, en desacuerdo sobre
tamaño, grosor, color y sobre si `disabled` era siquiera una prop. Y había **cuatro rojos distintos**
donde ya existía un token.

Nada de eso fue una decisión. Es lo que pasa cuando seis pantallas se construyen en seis sprints y
nada las sujeta entre sí, y es la mayor parte de lo que «años 2000» quería decir.

`apps/editor/src/editor/panelKit.tsx` es esa cosa que faltaba: una tarjeta, una fila, un hover, un
seleccionado y un botón pequeño. Son cadenas y un componente diminuto a propósito, no un `<Panel>`
envolvente: los seis difieren en su **contenido** de maneras que ningún envoltorio sobreviviría.

**Y el mismo fallo de contraste del día 2, otra vez, en otros cinco sitios.** La fila seleccionada
de «Estilo» y dos estados de «Diseño» eran `text-ui-brand` sobre `bg-ui-brand-surface`: los mismos
**4,14:1**. Se arregla igual —la tinta al texto, el azul al borde y al fondo— y la fila elegida pasa
a **15,68:1** sin cambiar un color. Además, un botón deshabilitado de «Diseño» usaba `text-ui-border`
sobre blanco, **1,19:1**: no es que fuera poco legible, es que no se veía.

**Lo que destapó la guarda al ensancharse.** `chromeScale.test.ts` solo miraba `EditorShell.tsx`; el
día 3 pasa a mirar los ocho ficheros del cromo, y aparecieron **cuatro radios más** fuera de escala
que llevaban todo el tiempo fuera de su alcance mientras el test pasaba en verde. Una guarda que
mira poco pasa igual que una que no falla.

El trinquete queda ya **solo con el conmutador PC/móvil**, que es permanente por decisión de
dirección.

**Lo que sigue fuera y conviene decir:** `FieldsPanel` —el formulario de campos que se abre al elegir
una sección— **no es uno de los seis** y sigue siendo un cajón `fixed` **que se pinta encima del
lienzo**, que es justo el defecto que «Compartir» dejó de tener. No entra aquí porque no se abre
desde el raíl; queda nombrado para que no se descubra.

### Día 4: el cromo del lienzo (5 de octubre de 2026)

| | |
|---|---|
| antes | ![antes](review/2026-10-05-el-cromo/lienzo-gap-antes.png) |
| después | ![después](review/2026-10-05-el-cromo/lienzo-gap-despues.png) |
| con el puntero encima | ![hover](review/2026-10-05-el-cromo/lienzo-gap-hover.png) |

**Lo que la maqueta 08 dibuja aquí es «una regla discontinua rota por una píldora», y eso se
mantiene como idea.** Lo que cambia son sus valores, y el motivo está medido: el borde de la
píldora era `#A9C9F4`, **1,70:1** sobre el blanco que el propio hueco pinta detrás, y la regla era
`#B9CDEA`, **1,62:1**. Los dos **por debajo del 3:1** que la WCAG 1.4.11 pide a aquello cuyo aspecto
es lo que identifica un control. «Añadir sección aquí» llevaba desde que se dibujó siendo un botón
que se podía no ver.

**Y el plan de este día proponía empeorarlo.** Decía dejar las píldoras «casi invisibles en reposo»
y hacerlas florecer con el puntero. Dirección lo rechazó, y la razón queda como regla: **un control
que solo aparece bajo un puntero no existe para quien no tiene puntero.** El reposo es ahora el azul
de marca a **4,71:1**, y el realce va **encima de un estado que ya pasa**.

**El realce vive dentro de `@media (hover: hover)`**, así que una pantalla táctil —que en unos
motores reporta un hover permanente falso y en otros no reporta ninguno— recibe siempre la versión
visible. Y `:focus-visible` recibe el mismo realce fuera de esa consulta, porque al teclado también
se llega a esta píldora y no tiene puntero con el que guiar.

La regla pasa de `2px dashed` a **1px sólido** a 3,24:1: más silenciosa de mirar y más medible. Lo
discontinuo era lo más datado que había en pantalla.

**El problema de los dos documentos, y cómo queda resuelto.** Este cromo vive **dentro del iframe**,
cuyo documento escribe `packages/renderer` y que nunca ve `globals.css`. Antes eso significaba una
segunda copia a mano de cada número, y ya había divergido: el lienzo usaba esquinas de 13, 11, 9 y
7px mientras el otro lado se había asentado en cuatro. `apps/editor/src/editor/chromeScale.ts` es
ahora la transcripción, y `test/chromeScale.test.ts` lee **los dos** y falla si un solo valor
discrepa.

**Y lo que no se toca: `.rb-toolbar*`.** Vive en este mismo fichero y es la barra flotante que
dirección excluyó. Se ha tocado por selector, nunca por bloque.

`pnpm test:golden` sigue en **21 sin moverse**, que es la prueba de que nada de esto llega al ZIP de
un cliente (ADR 0001).

### Corrección: la barra superior repartía mal su ancho (6 de octubre de 2026)

| | |
|---|---|
| antes | ![antes](review/2026-10-05-el-cromo/barra-logo-antes.png) |
| después | ![después](review/2026-10-05-el-cromo/barra-logo-despues.png) |

Dirección vio, tras el rediseño del cromo, que el extremo del logo se sombreaba a lo ancho de una
zona vacía enorme y empujaba las pestañas hasta sacar una barra de desplazamiento.

**Las dos mitades eran una sola causa.** El botón del logo llevaba `flex-1`, así que **crecía hasta
tragarse cada píxel sobrante**. Mientras no tenía fondo, eso no se veía; darle un fondo al pasar el
ratón en el día 2 dibujó el vacío. Medido en Chromium a 1280 con una página: **395px de botón para
unos 250px de marca y nombre**. Y bajo presión el mismo `flex-1` corría al revés: con cuatro páginas
había devuelto todo y se quedaba en **12px**, con la marca y el nombre desaparecidos — y la tira se
desplazaba igualmente.

Ahora el botón tiene suelo y techo, y **la tira es la que crece**. Con `flex-auto` y no `flex-1`,
para que la tira conserve su contenido como base: así empuja cuando necesita sitio, y el logo cede.
La primera versión de este arreglo usaba `flex-1` y **empeoró 1024** — dejó de caber una sola
página —, lo que se vio midiendo y no razonando.

| ventana | 1 página | 2 | 3 | 4 |
|---|---|---|---|---|
| 1024 | sin barra | sin barra | sin barra | **barra** |
| 1280 | sin barra | sin barra | sin barra | **barra** |
| 1440 | sin barra | sin barra | sin barra | **barra** |
| 1600 | sin barra | sin barra | sin barra | sin barra |

Que es la regla que puso dirección: «sin barra a no ser que existan 4 o más páginas».

**Y el ancho de una pestaña no es un número medido, que es la corrección que hizo falta.** La
primera versión lo fijaba en 124px, afinado hasta que tres cupieran: pasaba aquí y **falló en CI**,
porque el margen que dejaba era cero — tres pestañas medían 395px dentro de una tira de 395px, y un
runner cuyas métricas de texto difieren en un píxel lo tumba. Un número al que se llega afinando es
un número que solo se sostiene en la máquina donde se afinó.

El tope es ahora `(100% - 14px) / 3`: la aritmética de la propia regla. Tres pestañas más sus dos
huecos de 6px **son** la tira, mida lo que mida la letra, y una cuarta no cabe por construcción. Eso
es además lo que hace que **1024 pase a admitir tres páginas**, cosa que no hacía ni antes ni con la
versión afinada — aunque allí cada pestaña se queda en unos 57px, así que se leen muy cortadas. A
1024 el remedio de verdad sigue siendo el grupo de la derecha.

**Lo que no se puede arreglar colocando cajas, y es decisión de dirección.** El grupo de la derecha
mide **673px fijos** y a 1024 deja 219px para las pestañas, donde dos nombres de página no caben a
ningún tamaño. Desglose medido:

| | |
|---|---|
| «Guardado en este navegador» | **200px** |
| «Guardar en mi cuenta» | **183px** |
| «Descargar» | 106px |
| Conmutador PC/móvil | 74px |
| Deshacer y rehacer | 60px |

Las dos primeras son **383px, más de la mitad del grupo**. La frase de guardado la alargó el ADR
0012 a propósito, «precisely so nobody reads a cross-device guarantee into it», así que acortarla no
es una decisión de maquetación. Queda nombrado aquí en lugar de dejarse descubrir.

### Dos correcciones: el interruptor invisible y una etiqueta que se partía (6 de octubre de 2026)

**El aviso del interruptor de herramientas de diseño no se veía, y lo rompí yo.** Se dibujaba
`absolute … left-full`, justo fuera del borde derecho del raíl, y eso funcionó hasta que la PR #172
dio al raíl `overflow-y: auto` para que sus propios elementos se pudieran alcanzar en una ventana
baja. **El desbordamiento recorta en los dos ejes**: `overflow-y: auto` calcula también
`overflow-x: auto`, así que la tarjeta seguía ahí —300×267 en el DOM— con **303px fuera de la caja
que la recorta**, invisible y sin nada que desplazar, porque no está en el flujo. Para el dueño eso
era un interruptor muerto.

`position: fixed` es lo que escapa del desbordamiento de un antepasado, así que la tarjeta se coloca
contra el rectángulo **medido** del interruptor y no contra su padre.

**«+ Añadir línea» se salía de su píldora, y eso no lo trajo el rediseño.** Caja de 30px declarada y
etiqueta libre de partirse: medido, **texto de 48px en una caja de 30**, 9px pintados fuera. La
regla es del **28 de septiembre** y ningún día de este trabajo la tocó. Lo que hizo el rediseño fue
ponerla al lado de «Añadir sección aquí», que ahora parece deliberada — y eso es lo que hizo que
esta pareciera rota. `white-space: nowrap`, y de paso el mismo suelo de 3:1 que la otra píldora.

**Lo que ninguna guarda podía cazar, y es la parte útil.** El recorrido de desbordamiento de botones
de la PR #169 lee `button, a, [role="button"]` en el documento **del editor**, y el cromo del lienzo
vive en otro, dentro del iframe. Ahora hay un recorrido que cruza esa frontera.

**Y ese recorrido nació vacío.** Copiado del otro, saltaba cualquier elemento con un antepasado que
recorta — y el cromo inyecta `html, body { overflow-x: clip; }`, así que **todos** lo tienen: el
recorrido no examinaba ni un botón y pasaba en verde. Quitar el arreglo que lo motivó no lo hacía
fallar. Ahora mira solo el desbordamiento del propio elemento, y **cuenta cuántos examina**: cero
examinados es un fallo con su propio mensaje, porque un recorrido que no miró nada y uno que no
encontró nada son el mismo array vacío.

### La barra de «Diseñada a mano» vuelve al flujo, y la maqueta 16 ya lo decía (7 de octubre de 2026)

**Reportado desde dirección en la vista de móvil**: la barra «Diseñada a mano / Portada / Volver a
la original» se dibujaba **encima** de la sección tapando contenido editable, y sus botones se
salían de ella.

**Lo medido, a 320px de lienzo:** barra de 272px, su contenido pidiendo 282 —**10px de
desbordamiento**, y lo que se salía era «Volver a la original»— y **31px de la fotografía de la
portada tapados** (`el-image`). En ordenador no pasaba ninguna de las dos cosas, que es la razón por
la que llevaba semanas sin verse.

**La causa no era un ajuste mal puesto: era una divergencia de la maqueta 16 que nadie había
escrito.** La maqueta dibuja la barra como una **cabecera en el flujo**, en columna, con el contenido
de la sección debajo (`flex-direction: column`, y luego el div de las franjas). El código la hizo
`position: absolute; top: 0; left: 0; right: 0; z-index: 5` sobre la sección. De ahí venían los dos
síntomas: tapaba porque estaba encima, y se salía porque encima no tenía sitio propio al que
envolver.

**Su propia fila, no una cabecera dentro de la sección**, y la diferencia importa. En el DOM real la
sección *es* la tarjeta que la maqueta dibuja, así que la lectura literal —meter la cabecera dentro—
empujaría el contenido del cliente hacia abajo **dentro de su propia sección**, y la vista previa
dejaría de mostrar la altura que esa sección va a tener publicada. Puesta antes de la sección, la
caja del cliente queda intacta. El patrón ya existía: `.rb-gap`, la fila de «Añadir sección aquí»,
son 76px en el flujo desde el día que se construyó.

**Lo que la maqueta no puede decidir, decidido por dirección el 7 de octubre de 2026.** La maqueta
dibuja un ancho (~600px) y a 320 los tres controles no caben en una línea. **Nada se recorta:** el
distintivo y «Volver a la original» son unidades atómicas, así que el botón **pasa entero a una
segunda línea** en vez de cortarse o de acortar su texto. Acortarlo a «Volver» se consideró y se
descartó: el dossier §5 habla de *prometer la vuelta*, y un botón que dice menos de lo que hace
promete menos. El nombre de la sección es lo único que puede envolver.

Medido después: en ordenador 1168×44 en una línea; en móvil 320×75 en dos. Cero desbordamiento y
cero solape a los dos anchos.

**Y lo que ninguna guarda podía cazar, que es la parte útil.** El recorrido de desbordamiento *dentro
del lienzo* —el que se añadió en la PR #179 precisamente para «+ Añadir línea»— corre a **un solo
ancho (1440×900) y con las herramientas de diseño apagadas**, así que `.rb-handmade` no existe
cuando mira. El recorrido equivalente del lado del editor corre a 320, 375, 768, 1024 y 1280. Esa
asimetría es el agujero, vale más que esta barra, y queda para su propia PR por decisión de
dirección: el recorrido del lienzo a 320/768/1440 con las herramientas encendidas, y lo que
encuentre se trae medido antes de arreglarlo.

**Un efecto secundario que conviene anotar.** Hasta hoy, escalar una sección no cambiaba ninguna
altura del flujo, porque la barra era absoluta. Ahora una sección diseñada a mano es de 44 a 75px más
alta, así que el punto de lectura que conserva `restoreReadingPosition` (PR #189) deja de estar
anclado por precaución y pasa a estar anclado por necesidad. Su guarda «el punto de lectura se
conserva, también con una sección a mano por encima» ya cubría este caso exacto tres días antes de
que existiera.

## La portada deja de deber su alto a la foto (9 de octubre de 2026)

Los mockups dibujan la portada con una fotografía de proporción cómoda y no dicen qué pasa con una
que no lo sea. El código respondía «la que traiga la foto»: `.rb-section img` daba `width: 100%` y
`height: auto`, así que la sección medía lo que midiera la imagen. Medido en Chromium a 1440×900,
con la foto a doce columnas («Con foto grande»):

| Fuente | Alto de la sección |
|---|---|
| 1024×1024, los cuadrados del banco de muestras | 1440 px |
| 1536×2048, una foto de móvil en vertical | 1888 px |
| 1170×2532, una de móvil más reciente | 3005 px |

Tres pantallas de portada en una ventana de 900 px, a partir de una fotografía que el dueño hizo
bien en subir. **Divergencia respecto a los mockups**: la portada recorta. Dos proporciones, cada
una medida contra lo que tiene al lado — **4/3** junto al texto, donde la columna de palabras mide
545 px y la foto queda en 498, y **3/2** a sangre, donde deja la imagen en 896 px, una pantalla.
`object-position: center`, escrito y no heredado.

Con eso el alto de la portada es el mismo con cualquier fuente: 594 px en «Clásica» y «Compacta»,
992 px en «Con foto grande» a 1440; 618 y 589 a 400. Antes iba de 594 a 3005.

**Lo que esto abre y no cierra**: en cuanto se recorta, el dueño no elige qué parte de su foto
sobrevive. Está en `docs/tasks/backlog.md` con su medida.

### Los cuatro tiradores de las esquinas se retiran (10 de octubre de 2026, sprint 17 día 2)

**La maqueta 08 los dibuja y el editor los dibujaba. Dejan de dibujarse, y esto es la negativa
escrita donde se lee** — regla del ADR 0026: «un ADR que no dice qué descartó invita a rediseñar lo
descartado en tres sprints como si fuera nuevo».

Lo que había: `select()` colgaba un `span` de cada esquina de la sección elegida, con el aspecto de
un asa de redimensionado. Cuatro, desde el sprint 2. **Llevaban `pointer-events: none`**, así que no
eran un listener a medio escribir: eran un control que rechazaba el puntero.

Cuatro razones, las cuatro comprobadas hoy contra el código y no recordadas:

1. **No hay nada que redimensionar.** Las asas se cuelgan del `[data-section]`, y una sección no
   tiene ancho, alto ni span en el modelo: `sectionLayoutSchema` es
   `{grid: {columns}, placements, breakpoints}`. La **regla 4** es el motivo — las posiciones son
   relativas a la rejilla de la sección —, así que lo que tiene tamaño es un **elemento**, nunca la
   sección.
2. **La maqueta las dibuja alrededor de otra cosa.** `HANDOFF.md` las pone en el mismo aliento que
   la barra flotante, que va «above the selected **element**»: «Selection is drawn with a 2 px blue
   outline and four corner handles». El contorno sobrevivió al cambio de sujeto —de elemento a
   sección— y las asas no podían: su sujeto nuevo no tiene la propiedad que ellas editan.
3. **Si redimensionar en la rejilla es una función de verdad, ya existe y es accesible.** La
   familia `Colocación` del panel `Diseño` mueve `column`, `columnSpan`, `row` y `rowSpan` con
   botones de verdad, y `setPlacement` rechaza lo que la regla 4 no permite: una columna fuera de
   las doce, un span que las pase, y **toda colocación sobre una sección que dibuja el catálogo**,
   que lanza con «design it by hand first». Unas asas sobre una sección del catálogo estaban
   muertas por construcción.
4. **Cablearlas costaría dos o tres días y su propio ADR.** Sería la primera interacción de
   arrastre del editor: geometría de rejilla medida dentro de un iframe, imán a doce columnas, un
   equivalente de teclado que este mismo sprint exigiría, un paso de historia por arrastre, y una
   decisión sobre qué significa arrastrar en la vista de móvil, donde la regla 7 solo permite
   ocultar, reordenar y estrechar.

**Lo que no se toca: el contorno de 2px y el grupo de seis acciones.** Retirar los agarres no era
retirar la selección. Cuatro adornos inertes se van y seis botones que funcionan se quedan, y la
caminata «no dibuja tiradores en las esquinas, y el lienzo sigue sin desplazarse» asevera las dos
mitades.

**Y una medida que sale de aquí.** `overflow-x: clip` sobre `html, body` del iframe se añadió en el
sprint 8 porque elegir cualquier sección desplazaba el lienzo 4px: `.rb-handle-tr` y `.rb-handle-br`
estaban en `right: -4px` sobre una sección a sangre sin margen que absorbiera el sangrado. Con las
asas fuera, la caminata se ejecutó una vez **con esa línea borrada** y pasó: hoy nada más del cromo
sangra. La regla se queda como guarda de la próxima pieza dibujada un píxel fuera, no porque haga
falta ahora; lo que la medición abre —que un `clip` ahí también tapa el desbordamiento del contenido
**del propio dueño**, mientras el diálogo que lo mide usa su propio marco— queda en
`docs/tasks/backlog.md` con su número al lado.

### El lienzo se maneja con el teclado (10 de octubre de 2026, sprint 17 día 3)

**Seis verbos que solo alcanzaba el ratón, y los botones nunca fueron el problema.** Subir, bajar,
composición, duplicar, campos y borrar son `<button aria-label=…>` desde el sprint 2 y se usan
perfectamente con el teclado. Lo que no podían hacer era **existir**: el grupo lo dibuja `select()`,
y `select()` solo corría desde un `click`.

**No hay panel donde ponerlo, y este mismo documento lo dice:** «There is no sections panel:
`Secciones` *is* the canvas». Así que la ruta tenía que ser el lienzo, que es un `<iframe srcDoc>`
cuyo documento escribe `packages/renderer`.

**Lo adoptado:** `tabindex` móvil —`0` en la sección que tiene el teclado y `-1` en el resto, así
que el lienzo es **una** parada de Tab y no cinco a nueve—, ↑/↓ entre secciones, Intro elige, Esc
suelta.

#### El ajuste de David, que me corrige, y por qué tenía razón

Yo había propuesto `aria-label` sobre `[data-section]`. **Está mal y es comprobable:** el renderer
emite `element("section", …)`, y un `<section>` **con nombre accesible es un landmark `region`**.
Nombrar de cinco a nueve habría añadido de cinco a nueve regiones al árbol de accesibilidad del
editor: ruido para quien navega por landmarks, y solo mientras se edita.

Lo que entró: **`role="group"` con el nombre en español** de `sectionDisplayName` —el mismo que usan
la barra de «Diseñada a mano», el aviso del hueco y tres paneles, así que un lector de pantalla no
puede llamar a algo distinto de lo que lo llama el panel de al lado—. `group` anula el rol implícito
de `region`, así que la sección se nombra sin convertirse en un sitio.

**Medido el mismo día con axe, que es la otra mitad del ajuste.** Los landmarks del marco antes de
tocar el teclado y después de elegir una sección son **idénticos**, y el sabotaje lo confirma: al
quitar el `role="group"` la aserción se pone en rojo.

#### Cómo se anuncia la sección elegida: las dos cosas, porque responden preguntas distintas

David permitía `aria-current` **o** una región en vivo. Entran las dos, y la razón es que no hacen
lo mismo:

- **`aria-current="true"` es el estado.** Quien llega a esa sección más tarde oye que es la elegida,
  y eso importa porque la sección elegida es sobre la que actúan los seis botones. `true` y no
  `page`: `menu.ts` explica esa distinción donde usa `page`, y una sección no es una página.
- **La región en vivo es el suceso.** Elegir no mueve el foco, así que quien ya estaba en la sección
  no oiría nada ocurrir.

#### El anillo de foco no es el contorno de selección

Dónde **está** el teclado y qué sección está **elegida** son dos hechos distintos que a menudo
coinciden y a veces no: las flechas mueven el teclado sin elegir nada. El anillo es `3px dashed`
`#0F172A` —unos 15:1 sobre blanco, y la WCAG 1.4.11 pide 3:1 de lo que identifica un control—,
hacia dentro y discontinuo contra el contorno sólido de la selección, así que los dos se distinguen
incluso en un solo color. `:focus-visible` y no `:focus`, porque un clic de ratón también enfoca y
dibujarle un anillo de teclado es el ruido que `:focus-visible` existe para evitar.

**Y la selección sobrevive al foco, que la primera versión no lograba.** Llevaba además
`[data-section]:focus { outline: none }` como cinturón sobre el anillo del navegador —innecesario,
porque un motor moderno lo dibuja solo para `:focus-visible`— y `[data-section]:focus` y
`[data-section].rb-selected` tienen la misma especificidad, así que ganaba la última: **al hacer
clic en una sección se elegía y acto seguido se le borraba el contorno.** Lo cazó la caminata del
día 2, que asevera que el `outlineWidth` es de `2px` tras un clic, un día después de escribirse.

Cuando las dos cosas coinciden, el anillo de foco sigue siendo un `outline` y la selección pasa a
ser un `box-shadow` hacia dentro. El orden es deliberado: un indicador de foco tiene que sobrevivir
al modo de colores forzados, donde el `box-shadow` se descarta y el `outline` se conserva, así que lo
que no puede desaparecer se dibuja con la propiedad más robusta.

#### El mapa de teclas: dentro del lienzo, al llegar el teclado

Las otras dos casas se midieron y se descartaron. La barra superior de 58px tiene el grupo derecho
fijado en 673px con un guarda medido en navegador sobre sus anchos; la fila que sostiene el lienzo
es un flex cuyo ancho un `ResizeObserver` convierte en el factor de zoom. Poner una leyenda en
cualquiera de las dos es cambiar una maqueta medida para documentar un teclado.

Así que se dibuja dentro del marco, como el resto del cromo, y aparece cuando una sección toma el
teclado. **No es la trampa del hover que este documento ya rechazó** —«un control que solo aparece
bajo un puntero no existe para quien no tiene puntero»—: es el caso contrario, aparece *para* el
teclado, no es un control, y Tab es el gesto universal de «qué hay enfocable aquí», así que lo que
lo revela es lo que documenta.

#### El grupo de acciones pasa a ir primero en el DOM

Es `position: absolute`, así que en pantalla no se mueve nada. Lo que cambia es el orden de Tab:
añadido al final, el teclado tenía que recorrer cada `contenteditable` de la sección —en una portada,
titular, subtitular, cuerpo y dos botones— antes de llegar a los verbos. **El coste, dicho:** un
lector de pantalla oye el cromo antes de las palabras de la sección. En un editor es el orden
correcto —vienes a actuar sobre esta sección y lo que puedes hacerle es la noticia— pero es un
juicio, y revertirlo es mover una línea.

#### Dos fallos de realm, y el proyecto ya lo sabía

Mi primera versión preguntaba `focused instanceof HTMLElement` sobre un elemento del marco. **Este
manejador cierra sobre el documento del marco pero corre en el realm de la ventana padre**, y el
marco tiene el suyo: medido en Chromium, `false` desde aquí y `true` contra el constructor del
propio marco. Así que la comprobación daba `null` siempre, `keepsItsOwnUndo(null)` respondía `false`
y **escribir dejaba de ganar**: una flecha a media palabra movía el teclado a otra sección. Lo cazó
la caminata «escribir gana», que existe exactamente para eso.

Lo que hay que registrar es que **el propio fichero ya avisaba dos pantallas más arriba**, en dos
comentarios de `wireEditing`. Y al arreglarlo apareció un tercero, preexistente: el cierre del menú
de composiciones probaba `target instanceof Element` y por tanto **era código muerto desde que se
escribió**. Nada dependía de él —medido: el `e2e` completo pasa con la guarda funcionando—, porque
lo que de verdad impide que un clic en el menú cierre el menú es el `stopPropagation` de `action()` y
de cada opción. Se arregla en vez de borrarse porque una guarda que parece sostener algo y no lo
sostiene invita a quitar la que sí.

#### Lo que axe encontró en el editor, mirándolo por primera vez

`pnpm test:a11y` lleva verde desde el sprint 2 y «a11y en verde» se ha leído como si cubriera esta
aplicación. No la cubre: la raíz de ese proyecto es `packages/renderer`, así que lo que escanea son
**páginas publicadas**. El cromo con el que se edita no se había escaneado nunca.

Con una sección elegida: **39 comprobaciones pasadas, cero violaciones serias o críticas**, y dos
cosas por debajo de ese umbral que quedan anotadas en `docs/tasks/backlog.md` con su selector:
`region` (moderada, ×3) sobre `.inline-flex`, `.pt-1\.5` y `.gap-3` —cromo del editor fuera de
cualquier landmark, y la respuesta no es nombrar las secciones sino que el armazón tenga los suyos—
y un `color-contrast` que axe **no pudo medir** sobre `.rb-sample`, el botón «Cambiar esta foto»
dibujado encima de una fotografía.

### Los verbos se usan con el teclado y sobreviven al uso (10 de octubre de 2026, sprint 17 día 4)

El día 3 hizo que los seis verbos **existieran** para el teclado. Este hace que se puedan pulsar y
que el foco acabe donde una persona lo espera cuando el documento se ha reconstruido debajo.

#### Una regla para los cinco verbos, en vez de cinco casos

Subir, bajar, duplicar, «convertir en página» y borrar cambian la página de maneras distintas, y los
cinco tiran el marco y lo vuelven a parsear. El diseño obvio son cinco casos. La regla que los
sustituye cabe en una frase:

> **Sigue a la sección sobre la que se actuó. Si ya no está en esta página, toma lo que ahora ocupa
> su sitio.**

| Verbo | Qué pasó | Dónde aterriza |
|---|---|---|
| subir / bajar | la misma sección, otro índice | en ella, en su índice nuevo |
| duplicar | el original sigue ahí, la copia debajo | en el original |
| convertir en página | la sección se fue, un avance tomó su índice | en el avance |
| borrar | la sección ya no está | en la que subió a ocupar el hueco |
| borrar la última | no hay nada después | en la nueva última |
| borrar la única | no hay nada | en ninguna parte, honestamente |

**Duplicar se queda en el original y no salta a la copia**, y es el único caso que merece defensa.
La copia es nueva, así que «enfoca lo que el verbo produjo» es defendible — pero es idéntica al
original, nombre incluido, así que un lector de pantalla oiría el mismo nombre dos veces sin saber
que se ha movido. La región en vivo dice qué ha pasado, la copia está a un `ArrowDown`, y la regla
sigue siendo una frase.

Y luego, dentro de esa sección, **el mismo verbo otra vez** si sigue ahí y sigue pulsable: tres
pulsaciones de «subir» son tres pulsaciones en el mismo sitio, que es lo que una persona hace con un
verbo así. Si el botón está ahora desactivado —la sección llegó arriba— el foco cae en la sección,
nunca en un botón que no se puede pulsar, porque la mayoría de motores le niegan el foco y así es
como se acaba en el `body`.

#### Lo que la regla del día 3 tuvo que estrecharse, y por qué

El manejador del lienzo preguntaba al ref «¿de qué sección es el teclado?» y rechazaba la pulsación
solo si tenía el foco un `contentEditable` o un `<input>`. **Los seis verbos son botones dentro de la
sección**, así que con el foco en «bajar» el ref seguía nombrando la sección, la pulsación no estaba
en una caja de texto, y el `Enter` se tomaba como «elige esta sección»: **el verbo no se podía pulsar
en absoluto.** Lo cazó la caminata «mueve una sección dos veces», pulsando Enter sobre el botón y
encontrando la página igual.

Preguntar en cambio **qué tiene el foco de verdad** resuelve todos los casos a la vez, y es la regla
que cualquier componente compuesto tiene: las teclas del lienzo son del lienzo solo mientras el
lienzo es lo enfocado. Un verbo, un texto, un enlace de la página o nada en absoluto: en los cuatro
casos la pulsación no es nuestra. De paso, la comprobación explícita de «escribir gana» quedó
inalcanzable y se ha **quitado** en vez de dejarla ahí: una guarda que no puede dispararse es una
trampa para quien se fíe de ella después, que es justo lo que este sprint encontró el día 3.

#### Un verbo que cambia el número de secciones produce dos documentos, y el primero se tira

Esto costó tres intentos y lo resolvió la instrumentación, no el razonamiento.

Un verbo cambia `html`, así que el `srcDoc` del marco en vivo se reemplaza y ese documento se
cablea. Si además cambia **cuántas** secciones hay cambia `chromeKey` —que es un carácter por
sección—, así que se abre también el intercambio con doble búfer: se parsea un **segundo** documento
en el otro marco, se cablea, y se promueve. Mover no cambia ni el número ni el `source` de ninguna
sección, así que nunca intercambia: por eso mover funcionaba y duplicar, borrar y convertir no.

Mi primera explicación fue que el marco entrante es `inert` y no puede tomar el foco. **Falsa:** el
registro mostró el foco aterrizando en el botón correcto, con `took=true` e `inert=false`, y después
una segunda pasada de cableado sin nada pendiente, y después el foco en el `body`. El intento se
estaba gastando en el documento que iba a morir.

La segunda fue que bastaba con comprobar «este documento es el del marco en vivo». También falsa, y
con número: durante el duplicado el registro leyó `isLive=true buffered=1 frames=2`. El documento en
vivo también se descarta cuando hay un intercambio en vuelo.

Lo que quedó: el intento sobrevive a una pasada de cableado, se reaplica en cada documento, y **se
gasta solo cuando no hay ningún intercambio en vuelo** —preguntado al DOM por la presencia del marco
con `data-buffered`, no al estado, porque esto corre dentro de un cierre que puede ir un render por
detrás—. El efecto posterior a la promoción es donde acaba gastándose.

Y ese mismo efecto, que existía para devolver el foco al marco tras un intercambio, ahora prefiere
el sitio del verbo: enfocar el marco pondría el teclado al principio de la página, que es
exactamente lo que este día existe para evitar.

#### El nombre del verbo sobrevive al documento

Cada botón lleva `data-action`. Es el asidero: el mismo verbo sobre la misma sección se encuentra en
el documento que reemplazó al que la persona pulsó. El `aria-label` no podía hacerlo, siendo prosa en
español que un cambio de copia movería.

### Lo que los verbos abren también responde al teclado (11 de octubre de 2026, sprint 17 día 5)

Tres cosas que los seis verbos abren, y ninguna respondía a un teclado. No porque su contenido sea
inaccesible —son botones y campos— sino porque nada movía el foco dentro, nada lo devolvía, y Escape
no hacía nada. **Un popup que un teclado puede abrir y no puede abandonar es peor que uno que no
puede abrir.**

#### Qué significa Escape en un menú que no es modal

Ni el menú de composición ni la oferta de diseñar a mano llevan trampa de foco, y la razón es la
misma que da el propio `useFocusTrap`: `aria-modal` es la afirmación de que el resto de la página no
está disponible, y aquí sería falsa. Están encima de la sección, cualquier clic fuera los cierra, y
el teclado tiene que poder irse.

Así que **Escape es la única tecla que significa «he terminado aquí»**, y Tab se deja en paz. Quitar
el popup por debajo de un Tab dejaría huérfano el foco que ese Tab estaba calculando: el navegador
decide su destino con el documento tal como está, y si el popup desaparece a mitad, el destino ya no
existe. El popup se queda hasta un Escape o un clic, que es lo que ya hacía para el ratón.

#### Las flechas sí dan la vuelta aquí, y entre secciones no

La contradicción es aparente y las dos razones son distintas. Una página son secciones leídas de
arriba abajo: responder «abajo» con «vuelta al principio» desorienta justo a quien no puede ver que
ha pasado. Un popup es un anillo corto de alternativas sin arriba ni abajo —tres composiciones, o sí
y no— y cualquier menú de cualquier plataforma cicla. Una regla cada uno, cada una por su motivo, en
vez de una regla aplicada donde no encaja.

#### El foco entra en la opción que ya está en uso

La composición que la sección lleva puesta, marcada `aria-pressed="true"`. Es de donde parte quien
lee el menú, y dice lo que tienes antes de ofrecer lo que podrías tener.

#### Elegir una composición devuelve el teclado **dentro** del menú

El menú se reabre tras elegir: eso ya era así para el ratón, porque `compositionMenuOpen` lo trae de
vuelta «so the next try is one click». Para un teclado el siguiente intento tiene que ser una
**pulsación**, y eso solo es cierto si el teclado sigue dentro del menú cuando reaparece —y sobre la
opción ahora en uso, que además es la respuesta a «¿qué ha hecho eso?».

Esto obligó a generalizar el destino del foco del día 4: era «el mismo verbo otra vez» y pasa a ser
**un selector dentro de la sección**. El grupo de acciones no podía expresar «la opción marcada
dentro del menú reabierto».

Y destapó dos cosas al construirlo:

- **El menú reabierto venía inerte para el teclado** desde que el menú existe. Se reabría en el
  bloque de restauración sin cablearse: sin foco, sin flechas, sin Escape.
- **Mi propia restauración lo destruía.** `select()` limpia `.rb-compositions` de todas las
  secciones, así que llamarlo ahí borraba el menú que la restauración acababa de reabrir. Ahora solo
  se llama cuando la sección no es ya la elegida, que es el caso para el que existía: un borrado,
  donde la sección que ocupa ese sitio no se había elegido nunca.

#### «Campos de esta sección» cruza la frontera de los dos documentos

Es el único sitio de este sprint donde los dos documentos son una diferencia y no un inconveniente:
el botón está **dentro** del iframe y el panel que abre está en el documento del editor. El panel
toma el foco él mismo al montarse —es un componente de React y puede—, y **volver es trabajo del
editor**, porque aquello a lo que hay que volver es un botón que `wireInteractions` dibujó dentro de
la vista previa y el panel no sabe nada de él.

El foco aterriza en el `<aside>` y no en su primer campo: un formulario que se abre con el cursor ya
en una caja de texto se ha saltado su propio encabezado, y el encabezado es lo que dice de qué
sección es esto. Escape lo cierra, sin trampa: Tab se va al lienzo y vuelve, y atrapar el teclado
dentro de un formulario que alguien abrió para rellenar sería lo contrario de ayudar.

#### El diálogo de revertir: confirmar y cancelar necesitan respuestas distintas

`useFocusTrap` devuelve el foco a lo que lo tenía, y lo que lo tenía era el `<iframe>` —enfocarlo
restaura el elemento que el documento del marco sigue teniendo, que es «Volver a la original» en la
barra—. Eso es correcto al **cancelar** y falso al **confirmar**: revertir devuelve la sección al
catálogo y la barra se va con ella. Revertir también cambia el `source` de la sección, así que el
`chromeKey` cambia y la reconstrucción pasa por el intercambio con doble búfer: tiene que ser el
intento que sobrevive a dos documentos, no un `.focus()` ahí mismo.

#### Un fallo del día 4 que este día corrige

`handmade` estaba en el conjunto de verbos que reconstruyen, y **no reconstruye nada por sí mismo**:
solo abre la oferta. Pulsarlo armaba una vuelta que la siguiente edición de texto habría gastado.
Encontrado leyendo los tres abridores, no por un fallo rojo. Las vueltas de los tres se arman ahora
desde dentro de lo que abren, que es donde está la información.

### El recorrido entero sin tocar el ratón, y el axe de cierre (11 de octubre de 2026, sprint 17 día 7)

**Una caminata, sin un solo gesto de puntero**, que es la aceptación del sprint: «monta una web, la
edita, le da estilo y descarga el ZIP sin tocar el trackpad». Todo lo que construyeron los siete días
está en ese camino y nada más: Tab encuentra el lienzo porque el `tabindex` móvil lo hace una sola
parada (día 3), los verbos existen porque Intro elige una sección (día 3) y sobreviven a pulsarse
porque el teclado vuelve tras la reconstrucción (día 4), lo que abren responde a las flechas y a
Escape (día 5), y el diálogo de la puerta de descarga se puede abandonar porque tiene trampa de foco
(día 1).

#### La afirmación está guardada, no aseverada por mí

`apps/editor/test/keyboardOnly.test.ts` lee el bloque entre dos marcas del fichero de caminatas y
falla si contiene una llamada de puntero. Nada en Playwright impide que alguien añada un `.click()`
el día que la caminata se ponga roja: seguiría pasando, seguiría llamándose «sin ratón» y no probaría
nada.

**Y prohíbe también `fill`, `check` y `selectOption`**, que es la parte que merece explicación.
Ninguno es un ratón. Los tres **se saltan el foco** que la caminata existe para demostrar: `fill`
mete texto en un campo sin el Tab que llegó a él, `check` marca un radio sin la flecha que se movió
hasta él. Una caminata que los usara sería «sin ratón» en el sentido literal y no probaría nada en el
sentido que importa.

La guarda corre en el `pnpm test` normal, sin navegador y sin servidor, así que falla en segundos y
no al final de una suite de cuatro minutos. Tres sabotajes la ponen en rojo: un clic dentro del
bloque, un `fill` en lugar de escribir, y la caminata vaciada a un muñón.

#### Tres cosas que el recorrido descubrió sobre la propia interfaz

Ninguna es un fallo; las tres son cómo están nombrados los controles, y las tres hicieron fallar la
primera versión de la caminata:

1. **Las casillas de los servicios no llevan nombre accesible propio.** `CheckboxCard` es un
   `<label>` alrededor de un `<input>` visualmente oculto y un `<span>` con las palabras, así que una
   casilla enfocada se lee como `value: "on"` y nada más. El nombre está ahí, un nodo más arriba, y
   el lector de la caminata ahora mira el `<label>` que la envuelve.
2. **Las paletas del panel «Estilo» usan `name={useId()}`.** No hay nombre de grupo estable que
   buscar, así que la caminata alcanza «la primera opción del panel» por forma y no por nombre.
3. **Lo que cambia al pulsar una opción depende del grupo**: una paleta cambia los colores, un par
   tipográfico las fuentes, una escala los tamaños. La caminata compara una **huella** de los ocho
   tokens que el renderer escribe en `:root` y asevera que se movió, que es «le da estilo» sin tener
   que saber en qué grupo aterrizó.

   **La primera huella medía lo equivocado y pasó por una razón falsa**, y lo cazó el CI el 12 de
   octubre: leía el fondo de la portada —transparente, así que una paleta no lo mueve— y la familia y
   el tamaño renderizados del titular. Localmente se puso verde porque Playfair terminó de cargarse
   entre la lectura y la espera, así que la huella cambió por el reloj y no por la flecha. El CI, más
   lento y con la fuente ya cargada, dijo «the arrow changed nothing in the rendered page», que era la
   verdad. Los tokens de `:root` son valores declarados, no renderizados, y la caminata espera además
   a `document.fonts.ready`, así que ya nada en ese bloque depende del tiempo.

   Y una segunda cosa, encontrada al arreglar la primera y **mal diagnosticada antes de medirse**:
   elegir una paleta reemplaza el `srcDoc` del marco, y durante una muestra el documento vivo no
   tiene `documentElement`. `getComputedStyle(null)` lanza, y `expect.poll` no reintenta ante una
   excepción. La primera explicación escrita fue «la trampa de realm por cuarta vez», y era falsa:
   un realm no cambia entre ejecuciones y aquello fallaba una de cada cuatro. La medida —tres de
   tres con una muestra nula— está en el backlog junto a la retractación.

#### El axe de cierre llega a un estado que el del día 3 no podía ver

El del día 3 escaneó el editor con una sección elegida con el teclado, y fue la primera vez que algo
mirara el cromo de esta aplicación. Lo que ese pase no podía ver es **un diálogo**, porque un diálogo
necesita un recorrido para abrirse: la puerta de descarga necesita una web con una de nuestras
fotografías dentro, y la oferta de cuenta necesita que haya una cuenta configurada.

Dos formas y no una, porque fallan distinto: una alerta con botones y un encabezado, y un formulario
con campos etiquetados. Las dos llevan `aria-modal`, las dos recibieron su trampa de foco el día 1, y
una trampa es exactamente la clase de cosa que puede estar bien construida y dejar un control sin
nombre.

**Resultado: cero violaciones serias o críticas con cada uno abierto.** Y dos aserciones más que no
son de axe y que conviene que estén: **un diálogo tampoco añade un landmark** —la misma corrección
que David hizo sobre las secciones el día 3, porque una `region` dentro de algo que dice ser el único
sitio que existe es un sitio al que navegar dentro de ese sitio— y **todo campo del formulario tiene
nombre**, dicho en voz alta para que un fallo de axe ahí no sea una sorpresa.

## Sprint 18 — «casi comercial, sin cobrar» (12 y 13 de octubre de 2026)

Siete días, siete PR (#219 a #225), con un arreglo bloqueante entre el primero y el segundo (#220).
Lo que la interfaz ganó, día a día, y lo que los ADR deciden sobre ella.

### El producto avisa cuando se rompe, y hoy no avisa a nadie (día 1, PR #219)

Sentry cableado en el editor y en las rutas, con el número de versión en cada error y una limpieza
que quita de todo evento el documento, las fotos y cualquier correo; **inerte** sin
`NEXT_PUBLIC_SENTRY_DSN`, probado en el `e2e` contra un error real sin capturar. La pregunta a
dirección —tercer encargado del tratamiento, residencia en la UE, su DPA y una frase nueva en el
aviso de privacidad— va en el cuerpo de la PR y **sigue sin respuesta al cerrar el sprint**, así que
el día 7 no lo activa y el aviso sigue nombrando a dos encargados, que es lo cierto.

**El arreglo bloqueante (#220):** `next.config.ts` importaba un módulo del proyecto; `next build`
lo resolvía y `next start` no, y producción cayó al desplegar. Reproducido en local antes de tocar
nada; ahora el config no importa nada, una prueba lo prohíbe y CI arranca el servidor compilado y le
pide la landing, cosa que ninguna puerta había hecho.

### Lighthouse, medido por primera vez (día 2, PR #221)

La Parte 8.5 pedía «95 o más» desde el sprint 2 y nadie lo había medido. `pnpm lighthouse`: un sitio
generado de restaurante, servido desde memoria, auditado en el Chromium de Playwright, preset móvil,
tres composiciones. **100 / 100 / 96 / 100** las tres; el 96 de buenas prácticas es un solo hecho,
el `favicon.ico` que el navegador pide y el paquete no lleva, que `publisher.md` deja en fase 2.

### La galería del banco (días 3 y 4, PR #222 y #223, ADR 0039)

Una web generada de un sector con banco lleva una galería de **cuatro** fotos tras los servicios:
sorteo sin reemplazo con el `avoid` del ADR 0036, ninguna portada de la pantalla de tres en ninguna
galería, pies de foto con el `alt` revisado del registro. **La condición de David** —el riesgo de que
un hostelero publique platos ajenos como propios— se trata en el §2 del ADR: tope de cuatro, insignia
«Foto de ejemplo» sobre cada una, el aviso de descarga contándolas una a una y un pie que describe la
escena en vez de reclamarla. Verificado el día 4 donde lo ve el dueño: cuatro insignias visibles,
«5 de 5 fotos todavía no son tuyas», «Tu web tiene 5 fotos de ejemplo» con cinco «Cambiar», el ZIP
con los cinco ficheros y la página abierta desde el disco sin una sola insignia.

**Lo que la galería costó y se devolvió:** las cuatro fotos competían con la portada en 4G simulado
y Lighthouse bajó a 96–97; toda foto fuera de la primera sección de su página lleva ahora
`loading="lazy"` (nunca la primera, donde está el LCP), el corpus golden se movió en tres imágenes
de dos páginas, y la medida volvió a **100 / 99 / 99**. Y dos defectos que el día encontró: la
píldora acuñaba el id `sec-<catalogId>` y habría lanzado «already taken» al añadir una galería a una
web de restaurante (acuña con `mintSectionId`); y `Variants.tsx` sustituía el documento de la vista
previa una vez por foto, cinco veces seguidas con la galería (ahora una vez por tarjeta).

**Una pregunta de contenido que el ADR nombra y no decide:** dos de las nueve fotos aprobadas son
platos. Si el banco puede contener un plato reconocible es una regla para la lista del revisor, y
es de David.

### El intermitente del sprint 13 tiene mecanismo (día 5, PR #224)

Una sonda inerte en el editor y las tres caminatas del bloque con la cuenta del editor en su mensaje
de fallo. Seis fallos en una noche, **seis cuentas iguales**: las fotos del banco sustituían el
`srcDoc` 13 ms después del primer documento, antes de que ese documento estuviera cableado; la
búsqueda anticipada del segundo `html` cableaba el *primero* y paraba; el segundo llegaba sin cromo
y esperaba a `load`. La corrección es una palabra en una función pura (`lookAheadStep`): cablear y
**seguir mirando**. Dos ejecuciones completas limpias después, donde la noche anterior hubo una de
cinco. No se consiguió forzar en una caminata determinista, y se dice.

### Lo que falta para el primer euro, en un fichero (día 6, PR #225)

`docs/tasks/lo-que-falta-para-el-primer-euro.md`, sin juicio: las seis preguntas de facturación, los
tres documentos legales, los DPA, el precio, las copias, el plan de Render, el barrido, la producción
de fotos (diez sectores vacíos, la exención que caduca el 1 de noviembre, dieciséis PNG en la raíz),
las firmas, Google y el `noindex`, y una enmienda al ADR 0029 para el sitemap en el ZIP, redactada
para firmar o rechazar. Tres registros obsoletos cerrados con fecha y con cuánto tiempo estuvieron
mal.

### El recorrido como un desconocido (día 7)

Una caminata entra por `/`, pulsa «Empezar», responde las cinco preguntas, ve tres tarjetas con tres
portadas distintas, abre el editor con la galería de cuatro insignias, edita un titular, cambia la
paleta, guarda en una cuenta cuyo Supabase responde la propia prueba (y comprueba que las fotos del
banco no se suben), pasa por el aviso que cuenta cinco y descarga: el ZIP lleva las cinco fotos, las
caras y sus licencias, **y ningún `sitemap.xml`**, porque la enmienda no está firmada y la caminata
asevera lo que es cierto; abierto desde el disco, cinco fotos decodificadas, la letra enviada
utilizable, el titular editado, ninguna insignia, ninguna petición fallida y ninguna que saliera de
la máquina en todo el viaje.

**Lo que este sprint no activó, y por qué:** Sentry (la pregunta del día 1 sin respuesta) y el
sitemap (la enmienda del día 6 sin firma). Las dos esperan en `lo-que-falta-para-el-primer-euro.md`.

## Sprint 19 — «una página por ficha, y tres cosas que ya tienen respuesta» (13 de octubre de 2026)

Siete días, nueve PR (#227 a #234, con #230 entre ellas por el despliegue), y una decisión de
David al abrir el sprint: cerrar las colecciones. Lo que la interfaz ganó, día a día, y lo que los
ADR deciden sobre ella.

### Sentry activo y el sitemap en el ZIP (día 1, PR #227 y #228)

Dos respuestas de David al planificar: Sentry aprobado con DSN, y la enmienda del ADR 0029
firmada. **La condición sobre la frase del aviso —«no puede prometer más de lo que el conjunto,
código más proyecto, garantiza»— encontró que el SDK instalado es la versión 11, donde
`sendDefaultPii` ya no existe**: el código lo llevaba como una opción muerta y los valores por
defecto de `dataCollection`, todos `true`, habrían pedido a Sentry que infiriera la IP y habrían
mandado la IP en cada sesión sin pasar por el limpiador. Cada categoría apagada por su nombre, y la
frase, en `account.save.privacy`: «Si la aplicación falla, el error se envía a Sentry (Functional
Software, Inc., con los datos en la Unión Europea) para que podamos arreglarlo. Ese aviso no lleva
tu web, tus fotos, tu correo ni tu dirección IP: solo qué ha fallado, en qué versión y desde qué
navegador.» La cláusula del navegador espera al primer evento real (runbook §8). El sitemap costó
una línea en la ruta de descarga: el publisher lo emitía desde el sprint 3 cuando recibía
`baseUrl`. La ayuda de «Compartir» lo dice.

**El despliegue que no abrió puerto (#230):** tras fusionar #229, `next start` estuvo quince
minutos sin abrir puerto ni escribir una línea, la forma del 29 de septiembre. Reproducido en local
con DSN: arranca en dos segundos. Un redespliegue del mismo commit abrió puerto: la instancia, dos
de dos. Lo que se cerró fue un hueco: producción difería de todas las puertas en una variable, y
ahora `editor-build` compila y arranca con un DSN cuyo host nunca resuelve.

### El ADR 0040 y el esquema (día 2, PR #229)

**Una página por ficha es derivada, nunca almacenada**: una colección puede tener una página
enlazada, que vive en el documento, cuenta como una de las cinco y nunca se emite como ella misma;
el publisher la dibuja una vez por entrada. El §2 del ADR 0033 aplicado a páginas, y «derived,
never copied» del ADR 0022. La aritmética que el 0033 tenía delante había cambiado: por su propio
§8 una colección tiene como mucho doce entradas, no cuarenta. Cada entrada gana un slug acuñado del
campo titular una vez y para siempre, que sobrevive a borrar la página. Cinco invariantes,
migración `0010` con conjunto afectado cero, y un hallazgo de la prueba: el slug propio de la
plantilla nunca es un fichero, así que un enlace a él está muerto.

### El renderer y el publisher dibujan N páginas (día 3, PR #231)

La opción `entryId`; el `<title>` «<titular> — <sitio>»; las fichas fuera del menú (enmienda al
0023) y **el titular de cada tarjeta enlazando a su ficha**, derivado del slug; `pagePaths`
expandiendo la página enlazada; el sitemap listándolas. **`pnpm size` pesaba solo la portada**:
ninguna segunda página había entrado nunca en el presupuesto de página. Ahora pesa cada fichero
emitido y el paquete escala a 4 KB por página después de la primera, medidos: 1,7 KB una ficha
dibujada, 3,1 KB la página más pesada de la muestra generada. Un fixture de doce fichas, un golden
nuevo y ninguno movido.

### El editor crea la página y la enseña (día 4, PR #232)

«Crear una página por ficha» en «Listas», junto a una lista que alguna sección muestra, con la
elección del campo titular solo cuando el catálogo llama titular a más de uno. La página nace con
una portada cuyas hojas leen la ficha, en la composición de la portada de la web. «Ver sus
páginas» y «Quitar la página de ficha». En «Páginas», «por ficha · N» y el selector **«Viendo:»**,
que es elección del editor y nunca del documento. **Las dos cuentas por separado, el ajuste 3 de
David**: «2 de 5 páginas.» es lo que limita el tope y «Al descargar saldrán 4 páginas: una por
cada ficha de «Qué hago».» es lo que escribe la descarga.

### Editar en la ficha, el enlace fuera del cursor, y el ZIP (día 5, PR #233)

Escribir en un texto enlazado de la ficha edita la ficha, con «aparece en 2 sitios» delante.
**Lo que la caminata encontró: el enlace del titular rompía el cursor dentro del lienzo**,
medido en el DOM: al enfocar se selecciona todo el titular, `End` no colapsó una selección que
cubre un ancla, y lo tecleado sustituyó las palabras: «Comidas» quedó como «del día». El ajuste 2
de David tomado al pie de la letra: `wireEditing` desenvuelve el enlace antes de hacer el titular
editable; en el lienzo es texto plano, el clic edita, y el enlace existe en la página publicada.
`canvasLinks.ts` decide qué hace el lienzo con un enlace pulsado: una página mueve el lienzo, una
ficha escrita a mano lo mueve a esa ficha, lo demás nada. La puerta cuenta una vez la foto de
marcador de la plantilla. Lighthouse gana la ficha como cuarto sujeto.

### El circuito del banco como herramienta (día 6, PR #234)

`pnpm photos:intake` y `pnpm photos:approve`: el prompt leído del XMP del PNG (donde estaba
desde siempre, `e485ffa`), el alfa aplanado sobre blanco (ajuste 3), nunca ampliar, WebP VP8
simple a 75, los rechazos por su nombre, y la revisión como `git mv`. `sharp` solo en el paquete
del banco. El README y el backlog aprenden el suelo de 1344 × 896 que les faltaba desde el 9 de
octubre. **El 25 de octubre es de David**, comando a comando en el fichero del primer euro.

### El recorrido como un desconocido, con fichas y sitemap (día 7)

De `/` a un ZIP abierto sin red: lista, página por ficha, una ficha editada en su página, la
dirección declarada en «Compartir», y el ZIP con `sitemap.xml` nombrando las fichas, un fichero
por ficha y ninguno para la plantilla, cinco fotos, las caras y sus licencias; desde el disco, la
ficha con su `<h1>`, «Inicio», la letra, ninguna insignia, y el titular de la tarjeta llevando de
verdad al visitante a su ficha. Ninguna petición salió de la máquina.

**Lo que este sprint deja a David:** ~~firmar el ADR 0040~~ (firmado el 13 de octubre, por
instrucción, tras fusionar #235); la opción de IP en el proyecto de Sentry
y la lectura del primer evento real; las nueve fotos antes del 25 de octubre; los DPA de Supabase
y Render, que siguen sin respuesta.

## La pantalla de construcción al descargar (13 de octubre de 2026)

David, tras cerrar el sprint 19: al pulsar «Descargar», una animación derivada del logotipo
—el martillo golpeando los bloques— que diga que se está construyendo la web, y que desaparezca
cuando el archivo esté listo y se descargue. Dos decisiones suyas al aprobar: **un mínimo de unos dos
segundos** aunque el ZIP esté antes, «para que el momento se perciba»; y el velo sobre todo el
editor. Dos ajustes: pedir a Retorika el vector original antes de trazar a mano; y el contenedor del
editor **inerte** bajo el velo, para que Tab no alcance nada que cambie la web mientras se construye.

**Por qué esta pantalla sí y la maqueta 06 no.** La maqueta 06 no se construyó porque la
generación mide 0,12 ms y no había nada que cubrir; aquí hay trabajo real entre la pulsación y el
ZIP —la medida de desbordes, que hasta hoy corría con el botón activo y sin ninguna señal, las
fotos reunidas, la petición y el ZIP— y la caminata lo mide e imprime cada vez que corre. **El
mínimo de dos segundos es una espera añadida a propósito, por decisión de David, y se dice así.**
Lo que la pantalla no hace es prometer una duración: ni «unos segundos» ni «no cierres esta
ventana», las dos frases que las maquetas 06 y 11 enseñaron a cortar. Dice «Estamos construyendo
tu web» y «Preparamos los archivos. La descarga empieza sola en cuanto estén listos», que es cierto
en cada instante en que se lee.

**Lo que es, y lo que no.** Un `role="status"` con `aria-live` y `aria-busy`, nunca un diálogo:
no pregunta nada y no se cierra. La tarjeta toma el teclado al aparecer, porque el botón que lo
tenía se desactiva; el resto del editor lleva `inert` mientras tanto, y al terminar el teclado
vuelve a «Descargar», activo. El velo es la misma línea de los avisos de descarga y nunca se
solapa con ellos: `requestDownload` lo retira antes de abrir un aviso, porque comparten capa.

**La marca animada es el logotipo trazado del PNG, medido, y no un dibujo a ojo.** El plan
aprobado trazaba a mano hasta que llegara el vector de Retorika; esa misma tarde David pidió sacar
el SVG de los dos PNG entregados, «muy fiel a esas dos imágenes», y así se hizo, con
`pnpm brand:vector` (`scripts/brand-vector.ts`, sin dependencias nuevas: el `potrace` de npm arrastra
un `jimp` de 2020 con cinco avisos de auditoría y el CI bloquea por eso). Lo que salió y lo que se
midió está en `docs/design/brand/README.md`: los contornos a una décima de píxel; «Retorika» en su
azul marino plano, «Builder» y los tres bloques con su degradado lineal; y el color de la «R», que
ningún degradado explica —cian en la esquina, un azul claro por el brazo y la cabeza, el azul hondo
por el tronco y el mango—, guardado como el propio campo de color del PNG a un cuarto de resolución
bajo el recorte vectorial. Dibujado por Chromium al tamaño del original, el SVG de la marca queda a
un nivel de media por canal del PNG tal como se muestra. `BuildingMark.tsx` toma todo de
`buildingMarkPaths.ts`, que ese script escribe: la «R» partida en letra y martillo por una línea
que pasa por la muesca de la garra, el pivote donde el mango sale de la panza, y los cinco grupos
(`letter`, `hammer`, `block-sky`, `block-blue`, `block-rose`) que un vector oficial, si llega,
sustituirá por dentro sin tocar la animación. Colores del logotipo tal como el navegador los
muestra, no de la interfaz; el rosa es un bloque pequeño, que es el «accents only» que el ADR 0015
pide del fucsia; la marca sola, grande por un momento, es lo que ese ADR permite dentro del
producto. Un ciclo de 1,6 s: el martillo se levanta y golpea, los bloques se asientan uno tras
otro. Con movimiento reducido, la regla global deja cada animación en una iteración de 0,01 ms y la
marca descansa en su estado final, que es el logotipo.

**Un hallazgo de paso, corregido:** los dos PNG entregados vienen etiquetados Display P3, y
`brand:assets` escribía los servidos sin la etiqueta, así que el navegador los leía como sRGB: el
azul de la marca en la cabecera del editor y en la landing era dieciséis niveles por canal más
pálido que el entregado, medido en Chromium. Ahora el script conserva los trozos `iCCP` y `cICP` y
los servidos se muestran idénticos al original (diferencia cero sobre la tinta).

**Las caminatas** aseveran lo que se puede aseverar: el velo cubre la medida y no está cuando abre
el aviso; la frase y el rol; el martillo animado y el bloque rosa pasando por varias opacidades; el
ZIP nunca antes de 1 900 ms desde la pulsación; el velo fuera y el foco en «Descargar» al llegar el
ZIP; doce tabulaciones bajo el velo sin alcanzar nada del editor; y con movimiento reducido, la
pantalla igual y la marca quieta. Las diecinueve descargas de las caminatas anteriores no cambian y
la suite crece unos cuarenta segundos.

**Lo medido**, en cinco pasadas locales de la caminata del restaurante el 13 de octubre de 2026: la
medida de desbordes entre 144 y 842 ms; de la pulsación al ZIP entre 2 035 y 2 047 ms, es decir, el
mínimo manda y el trabajo real cabe dentro; el ZIP, 259 800 bytes. Sin el mínimo, la pantalla duraría
menos de un segundo en esta máquina y más en un portátil cargado o en el CI, que ya vio la medida
pasar de cinco segundos: ese rango es exactamente lo que el mínimo iguala.

## Sprint 20 — «Las barras se mueven, los verbos hablan y la marca es vector» (14 de octubre de 2026)

David, tras fusionar el logotipo vectorial: dos encargos para el lienzo y una pregunta. Las barras
flotantes —el grupo de verbos de la sección y la barra de texto— se podrán arrastrar cuando tapen
algo que se quiere editar, recordando su sitio por sección mientras dura la sesión; los iconos
azules y rojos del lienzo crecen y dicen qué hacen; y los SVG de la marca pasan a servirse en lugar
de los PNG. Solo los iconos del lienzo: el raíl, la barra superior y los paneles no se tocan.

### Los verbos crecen y dicen su nombre (día 1)

«Los iconos se ven muy pequeños y no consigo diferenciarlos fácilmente y además es difícil saber qué
hacen exactamente.» Medido, tenía razón dos veces. **26 px menos el aro blanco de 2 son 22, y dentro
un glifo de 13**: ocho siluetas que de un vistazo son ocho marcas grises. Y ninguno decía su nombre
en ningún sitio salvo el `aria-label`, que solo oye quien no mira.

Ahora miden **32 px con el glifo a 16**, y al pasar el ratón o al llegar el teclado crecen a **36**
y aparece una palabra debajo: Subir, Bajar, Aspecto, A mano, Duplicar, A página, Campos, Borrar. El
tamaño nunca lo decidió nadie —las maquetas no dibujan este grupo, y el 26 parece heredado de los
botones cuadrados de la barra de texto, que no llevan aro— así que ahora vive en `VERB_SCALE`
(`chromeScale.ts`), de donde lo leen el CSS, los ocho iconos y las caminatas. **Una medida copiada a
mano en una prueba es una medida que acabará dando por bueno lo que el producto ya no hace**, que es
la condición que puso David al aprobar el sprint.

**La palabra es hermana del botón, nunca hija**, y esa colocación es la decisión. El barrido de
320 px examina cada `button` con texto y mide si sus palabras caben en su caja; estos ocho siempre
se saltaron por ser solo icono, y una palabra *dentro* metería ocho discos de 32 px en una prueba
sobre texto desbordado —fallando, con razón, y sin que nadie lo hubiera pedido—. Además `focus()`,
en las caminatas, lee `data-action` de lo que tenga el foco: el asidero tiene que seguir en el
elemento enfocable. Lleva `aria-hidden`, porque el botón ya dice «Subir esta sección» y un lector
que además leyera «Subir» diría dos veces lo mismo, la segunda más corto. Es para los ojos.

**El crecimiento es `transform`, nunca ancho.** Un botón que creciera cambiando su caja empujaría a
sus vecinos de lado, justo bajo un puntero que ya va camino de uno de ellos: así se pulsa «Borrar»
habiendo apuntado a «Campos».

**El énfasis del ratón va dentro de `@media (hover: hover)`** y el del teclado fuera, que es la regla
que dirección fijó para las píldoras: una pantalla táctil recibe siempre la versión visible, por lo
que el reposo tenía que ser el legible primero. Y **los ocho ganan anillo de foco**, que no tenían:
`globals.css` dibuja uno desde el sprint 15 y las píldoras del marco lo recibieron el mismo día; a
estos se los saltó, así que un teclado se quedaba con lo que Chromium pinte por defecto sobre un
disco azul. Es tinta y no azul de marca, porque el anillo tiene que verse *contra* el azul en siete
de los ocho.

El azul y el rojo salen de `CHROME_SCALE` en vez de los `#156FE7` y `#DC2626` escritos al lado, que
eran los mismos valores por suerte y no por referencia. Los dos hex de hover más oscuros se van: con
el tamaño y la sombra diciendo «estás en este», un color que solo servía para eso no tenía ya nada
que decir.

**`role="group"` con nombre, y no `role="toolbar"`.** El patrón WAI-ARIA de barra promete al teclado
una parada de Tab para el conjunto y las flechas moviéndose entre sus controles. Aquí no se cumple
ninguna de las dos: cada verbo es su parada —contra eso están escritas las caminatas del sprint 17
día 4— y las flechas son del lienzo, para cambiar de sección. Un rol que anuncia un contrato que las
teclas no honran es peor que un grupo con nombre, que es justo lo que faltaba: ocho botones que un
lector alcanzaba sin que nada dijera de qué eran ocho. (`.rb-toolbar` sí lleva `toolbar` sin ese
contrato; queda anotado en el backlog, no se toca hoy.)

**Dos hallazgos que nadie buscaba, los dos medidos.**

El primero, la sonda que faltaba y que este mismo documento pedía sin añadir: «si el grupo de iconos
se saliera de su sección a 320 px, nada lo mediría». Ocho botones 6 px más anchos cada uno son 48 px
más de grupo, así que dejó de ser hipotético. Con `flex-wrap` y un ancho máximo el grupo cabe —
medido: sección 320 px, grupo 248— y ahora hay caminata que lo dice.

El segundo lo encontró esa sonda al mirar la portada: **a 320 px el grupo mide 212 px y la chapa
«Foto de ejemplo» 116 en la esquina contraria de la misma franja, y se solapan 74 px**. La chapa
lleva `z-index: 6` y el grupo no llevaba ninguno, así que la chapa pintaba encima de «Subir» y
«Bajar» **y se quedaba con sus clics**: dos botones muertos, y muertos ya antes de este día, cuando
el solape era de unos 38. El grupo pasa a `z-index: 10` —encima de la chapa, debajo de los menús que
él mismo abre (20) y de la barra de texto (30)— y la caminata pregunta por el punto y no por el
número: `elementFromPoint` en el centro del primer verbo tiene que devolver el verbo. Lo que importa
no es qué capa gana, sino qué recibe el dedo.

**Y un guardián que se arregló en vez de esquivarse.** `chromeContrast.test.ts` comprobaba que el
énfasis de la píldora estaba tras `@media (hover: hover)` buscando **la primera** aparición de esa
consulta en el fichero y mirando 400 caracteres por delante. El día que un segundo control gana
énfasis de hover —hoy— ese guardián habría fallado sobre la píldora, que no ha cambiado, mandando a
quien lo leyera a buscar al sitio equivocado. Ahora lee todos los bloques y pregunta si la regla está
en alguno. **Una prueba que se rompe por el orden de reglas que no le incumben es una prueba que
enseña a mover código para contentarla.**

El menú de composiciones cuelga del grupo, que es 6 px más alto: su `top` se calcula desde
`VERB_SCALE` y queda a 4 px del borde inferior del grupo, alineado a su derecha. Medido, no supuesto.

**Y un tercer hallazgo, este lo encontró el CI y no yo.** La palabra se escondía con `opacity: 0`
sola, y un elemento transparente **sigue siendo texto compuesto de la página**: `innerText` de una
portada volvía con «Subir Bajar Aspecto A mano Duplicar Campos Borrar» pegado delante del nombre del
negocio, que es como se puso roja una caminata que compara el texto de una sección antes y después
de un relevo de marcos. Sacar la palabra del botón no bastaba: seguía dentro de la sección. Lo
importante no es la caminata: **un Ctrl+F del propio dueño habría encontrado «Duplicar» dentro de su
restaurante**. Con `visibility: hidden` debajo de la opacidad —y el retardo que mantiene el fundido—
la palabra sale de la página hasta que se enseña. Medido en Chromium el 14 de octubre de 2026:
`opacity: 0` lo recoge `innerText`, `visibility: hidden` no. Hay guarda unitaria y la caminata lo
asevera en los dos sentidos: callada no está, enseñada sí.

### El grupo de verbos se mueve, con un asa (día 2)

El día 1 dejó el caso medido: a 320 px el grupo y la chapa «Foto de ejemplo» se solapan 74 px, y
alguien tiene que perder la esquina. Esto es lo que lo resuelve sin decidirlo por nadie — el grupo
se aparta, y lo aparta quien está mirando.

**La posición es del editor y nunca del documento.** Vive en un `Map` por id de sección dentro de un
`useRef`, se vuelve a aplicar en cada `select()` —que es lo que corre después de cada reconstrucción
del marco— y muere al recargar. «Por sección, mientras editas», que es lo que pidió David. Escribirla
en el proyecto habría hecho que el documento se volviera a serializar por algo que no forma parte de
él (`INV_4`), habría viajado en el ZIP y habría metido un empujón de barra en el historial de
deshacer al lado de las palabras del dueño. **No hay paso de historial**: mover una barra no es un
cambio de la web.

Se guarda **sin recortar** y se recorta al dibujar, así que una barra puesta a la derecha del todo en
una ventana ancha vuelve a su sitio exacto después de un viaje por la vista móvil, donde hubo que
dibujarla en mucho menos espacio.

**Un asa, y no una barra que se arrastra entera.** Es la decisión que hace posible el teclado: una
barra que se agarra por su fondo no se puede mover sin puntero, y una que se agarra por un botón se
mueve con las teclas de ese botón — así la regla que este documento se puso a sí mismo, que un
arrastre trae su equivalente de teclado el mismo sprint, es una línea de código y no un segundo
diseño. Es además lo que impide que un arrastre empiece sobre un verbo: pulsar «Borrar» y mover un
poco la mano tiene que seguir pulsando «Borrar».

**El asa va la última de la fila**, y eso deja intactos todos los recuentos de Tab del repositorio:
los catorce de `tabToVerb`, los ciento sesenta hasta «Estilo» del recorrido sin ratón, y las
caminatas del sprint 17 que cuentan pulsaciones hasta un verbo con nombre. Delante los habría movido
todos sin ganar nada. Los verbos son la noticia; un asidero es cromo sobre el cromo.

**Tres maneras de moverla, un solo camino.** Un clic la manda a la esquina siguiente; las flechas la
empujan dieciséis píxeles; `Inicio` la devuelve y olvida que se movió. Intro y espacio **no** son
teclas que `gripKeyAction` conozca: en un `<button>` disparan un clic, que es el ciclo de esquinas,
así que el ratón y el teclado recorren la misma implementación en vez de dos que haya que mantener
de acuerdo.

**El zoom resultó no ser una pregunta, y está medido.** El lienzo se dibuja con `transform: scale()`
cuando la ventana es estrecha, así que la posición de un puntero en pantalla y la misma posición
dentro del marco son números distintos. El arrastre suma **recorridos** —el de la mano, leído dentro
del marco— a una posición también leída dentro del marco, con lo que la escala se cancela sola y
nada en el código conoce el factor. La caminata abre «Estilo» a 1024 px, comprueba que el lienzo está
de verdad a escala (**0,737864**) y mide cuánto se separa el asa del puntero: **0 px**. La primera
versión de esa caminata leía la escala del padre del marco, encontraba 1 y se daba por buena sin
haber probado nada de lo que su nombre dice; ahora sube por los antepasados hasta el que la lleva y
**falla si el lienzo no está a escala**.

**Lo que el grupo abre va con él**, o sería un menú suelto. Y ahí esta caminata corrigió a su propio
autor: la primera versión encerraba el menú dentro de la sección en los dos ejes, como se encierra la
barra. Medido, el menú de composiciones mide **230 px dentro de una «Comidas» que mide 230**, así que
«dentro» significaba encima del botón que lo abre. Estos menús llevan desde el sprint 2 pudiendo
colgar por debajo de su sección —la propia hoja de estilos lo hace— así que ahora solo se recorta el
eje horizontal. Un menú sobre la sección siguiente es corriente; un menú sobre su propio botón es un
defecto.

**Dos cosas que las caminatas enseñaron al escribirlas.** La primera aseveraba que un clic en el asa
cambiaba `left`; viniendo de abajo a la izquierda, la esquina siguiente es **arriba** a la izquierda,
así que la esquina cambiaba y el número no. Medir la coordenada que no se mueve es no medir nada. Y
la segunda: `replacingTheDocument`, el ayudante que todas las caminatas usan para esperar a que una
edición rehaga el marco, leía `doc.documentElement.dataset` sin preguntar si había `documentElement`
— un marco cogido entre «reemplazado» y «analizado» no lo tiene, y entonces la caminata no fallaba
sino que **reventaba**. `backlog.md` lleva ese choque contado tres veces desde el sprint 18. Ahora
pregunta, y lo que era un choque es una vuelta más del sondeo, que es justo para lo que está el
sondeo.

### La barra flotante del texto se mueve, y recuerda un desplazamiento (día 3)

La otra barra que flota sobre el lienzo, y la que más tapa: se dibuja justo encima de las palabras
que edita, que es exactamente donde están las palabras de al lado. Mismo asa que el día 2, con una
diferencia que importa.

**Lo que se recuerda es un desplazamiento, no una posición.** Esta barra se calcula de nuevo para
cada texto que toca —vuelca arriba o abajo, se recorta—, así que guardar «estaba en 340, 96»
obligaría a arrastrarla otra vez en cada uno de los cinco textos de una portada, y congelaría una
barra cuyo trabajo es seguir a las palabras. Un desplazamiento dice lo que la persona quiso decir:
*en esta sección, más a la derecha y más abajo de donde iría*, y esa frase sirve para el párrafo
siguiente. Medido en el navegador: el titular pasa de 28 a 135 con un clic en el asa, y el
subtitular, que se calcula en 149, abre en 256 — el mismo desplazamiento de 107.

**La aritmética del volteo sale de `wireToolbar` y pasa a `barPosition.ts`, sin cambiarla.** Eran
cuatro líneas dentro de una función de cuatrocientas y **nadie las había llamado nunca** salvo ellas
mismas; la única vez que estuvieron mal lo estuvieron de una forma que parecía bien —medían el
elemento contra la página en vez de contra su sección, y el error empujaba cada barra a la rama del
volteo, que la devolvía arriba más o menos lo mismo—. Dos errores anulándose, encontrados por una
caminata en la segunda sección y no por nada que se pudiera llamar desde una prueba. Ahora se puede,
y tiene seis.

**El asa, tres maneras y un solo camino.** Un clic la pasa **al otro lado del texto**, que es la
única mudanza grande que esta barra tiene —no hay esquinas que recorrer—; pulsado otra vez vuelve.
Donde no hay otro lado —un titular con el relleno de la sección y nada más encima— el clic deshace
lo que hubieran hecho las flechas, así que la pulsación siempre significa «ponla donde le toca» y
nunca significa nada. Las flechas empujan, `Inicio` olvida, e Intro y espacio son el clic del propio
botón.

**Arrastrarla no cuesta ni el foco ni las palabras elegidas**, que es lo que la haría inútil: una
barra de texto se mueve para seguir escribiendo, no para empezar de nuevo. Lo que lo sostiene ya
estaba — el `mousedown` delegado de la barra impide el cambio de foco en cualquiera de sus botones —
y ahora hay caminata que lo asevera, con las palabras elegidas intactas y la barra volviendo a su
sitio después de que «negrita» rehaga el documento entero.

**Un hallazgo que la caminata destapó, y que sí se arregla: la barra no la alcanzaba un teclado.**
No el asa: **ninguno** de sus catorce controles, desde el sprint 9. La barra se añadía al final de su
sección, así que Tab desde un texto recorría los textos que quedaban, la chapa de la foto y la
llamada a la acción antes de llegar a ella — y no llegaba, porque el foco en la chapa es el foco
fuera de las palabras y la barra se cierra ahí, con razón. Medido mientras se escribía la caminata:
«la barra se cerró a las 3 tabulaciones». La regla de este repositorio dice que un arrastre trae su
equivalente de teclado el mismo sprint, así que esto no se podía anotar y seguir.

**Se arregla en dos movimientos y con una decisión.** La barra pasa a ir **al lado de las palabras**
—detrás de la rama de la sección que contiene el texto, no detrás del elemento, porque un pie de foto
dentro de una `.rb-line` convertiría esa línea en su `offsetParent` y toda la aritmética mide contra
la sección—. Nada se mueve en pantalla: es `position: absolute`, no es un elemento del grid, no ocupa
ninguna de las doce columnas y ya era hija directa de la sección; lo único que cambia es su índice, y
con él el orden de Tab.

Y la decisión: **una sola parada de Tab, que es el asa.** Ponerla al lado y dejar sus quince
controles en el orden costaría quince pulsaciones cada vez que alguien pasa por un párrafo —medido
también: la caminata del recorrido sin ratón se quedó sin sus ochenta—. `role="toolbar"` lleva en
esta barra desde el sprint 9 prometiendo exactamente una parada y flechas por dentro, y no cumplía
ninguna de las dos mitades. Ahora cumple la primera: el viaje de un teclado crece en **uno**, el
arrastre tiene su equivalente, y los catorce controles no están peor que ayer —ayer tampoco se
alcanzaban, y el ratón los pulsa igual—.

**La otra mitad del contrato es un día entero y queda dicha.** Las flechas entre los controles son la
parte fácil; la difícil es sobre qué actúan: «B» necesita las palabras que la persona eligió, y salir
del texto con Tab deshace la selección que las eligió. Esa es la razón de que esta barra naciera
siendo de ratón, y la razón de que no se resuelva de pasada en el día del arrastre.

**Y dos cosas más que las caminatas enseñaron.** El tope también es la regla: la primera versión
empujaba la barra hacia abajo desde el último texto de una portada, donde el recorte solo dejaba
cuatro píxeles de los treinta y dos, y midió eso. Y un ayudante que preguntaba por el estado «a
través de» la barra se quedaba treinta segundos esperando a un elemento que ya no existía cuando el
foco salía de los textos; ahora pregunta a través del `body` y dice a las cuántas tabulaciones se
cerró.

### El teclado tras insertar una sección, que se perdía desde el sprint 17 (15 de octubre de 2026)

Aparte de los días del sprint, porque es un aviso que bloquea y va en su propia rama: «insertar una
sección deja el teclado en la que acaba de aparecer» se puso roja en CI por tercera vez —PR #226,
#240 y #242—, siempre sobre cambios que no tocan ese camino y nunca en una máquina de desarrollo.

**Se reprodujo frenando la CPU veinte veces** y repitiendo la inserción: siete pérdidas en noventa y
dos intentos. Con la cuenta del propio editor encendida, lo que parecía una carrera resultó ser
**tres preguntas mal hechas en el relevo de marcos**, cada una tapando a la siguiente — la segunda
solo se vio al arreglar la primera, y la tercera al arreglar la segunda. El relato completo, con los
números, está en `docs/tasks/backlog.md`; lo que importa para el registro del diseño es la forma de
las tres:

1. **Lo que se pide no se retira.** `promote` corre desde un cierre que puede ir un render por
   detrás, así que se ejecuta dos veces para un mismo documento entrante; la segunda vez volvía a
   preguntar y apagaba la petición de devolver el teclado. Ahora es un pestillo.
2. **La pregunta era la equivocada.** «¿Estaba el teclado en el marco vivo?» — y cuando un relevo se
   confirma, el teclado está en el **que entra**, que además está fuera de pantalla y nunca recibe el
   foco de verdad del navegador. La forma honesta de la pregunta es si queda una intención sin
   gastar.
3. **Y lo que se devolvía se volvía a quitar.** El último recurso del efecto, `frame.focus()`, solo
   se saltaba si la intención ya se había *gastado*, y `takeCanvasFocus` se niega a gastarla mientras
   hay un relevo en vuelo, que es justo cuando ese efecto corre. Lo que importa es dónde está el
   teclado, no si una referencia quedó ordenada.

**La caminata que lo encontraba una vez al mes ahora corre su inserción con la CPU frenada**, donde
el código roto fallaba una de cada trece veces. Es una guarda probabilística y se dice así; lo que
cambia es que una regresión aquí se ve en días y no en semanas. Y el editor graba dos cosas más en su
sonda —si el relevo llegó a pedir el teclado, y si el foco aterrizó—, que son exactamente las dos
preguntas que costaron un día entero de no poder responder.

### La marca se sirve en vector (día 4)

La pregunta de David al abrir el sprint —«¿es mejor servir los SVG o seguir con los PNG?»— con la
respuesta hecha. El lockup pesaba **137 KB para dibujarse a 190 o 232 píxeles**, cuatro o cinco veces
más píxeles de los que la caja pinta, y la landing lo pedía `eager` en la página que menos paciencia
tiene porque ya tiene un arranque en frío que disculpar. Ahora son **21 KB por el cable**, y la marca
de la barra del editor 9 en vez de 41. Se dibujan de formas, así que además dejan de verse blandos en
una pantalla densa.

**El favicon se queda en píxeles**, y es decisión y no olvido: Safari no dibuja un favicon SVG, y 32
píxeles no es un tamaño donde un vector gane nada. Es lo único de este logotipo que la aplicación
sirve ya en PNG, y por eso `brand-assets.ts` conserva el recorte del fondo blanco que necesitaba.

**Un escritor por directorio.** `brand-vector.ts` sabe qué *es* el logotipo y no sabe dónde guarda la
aplicación sus ficheros; `brand-assets.ts` sabe dónde los guarda y no sabe trazar. El segundo copia
los vectores que el primero escribió, y nada más. Dos scripts escribiendo `public/` serían dos
opiniones sobre el mismo logotipo, que es exactamente la deriva contra la que el README de la marca
avisa.

**Lo que no se tocó, dicho:** la marca de la barra del editor se dibuja a 30×30 siendo 244×252, un
tres por ciento de aplastamiento que ya tenía el PNG. Corregirlo cambia el ancho de la barra
superior, que tiene su propia caminata, y «el logotipo mide ahora un píxel más» no es un cambio que
quepa dentro del que cambia el formato del fichero.

**Y una guarda que no existía.** Las tres colocaciones viven en tres ficheros distintos y los
ficheros que nombran los escribe un script; entre unas y otros solo había la costumbre de mantenerlos
de acuerdo. Una cuarta colocación escrita el mes que viene contra el nombre viejo daría 404 en
producción **sin que nada lo dijera**: la caminata de desbordes mide rectángulos, y una imagen que
falta sigue teniendo el que su `width` y su `height` reservan. `brandAssets.test.ts` pregunta ahora
si lo que se pide es lo que se sirve, si cada SVG trae el tamaño del que un `<img>` reserva su caja,
y si alguno pide algo de fuera — porque un SVG cargado por `<img>` es un documento cerrado y el color
de la «R» viaja dentro como `data:` URI; un `href` a cualquier otro sitio dibujaría un agujero en el
logotipo en todas las pantallas menos en la que se probó.

### El cierre: lo que las dos barras movidas dejan igual (día 5)

Los días 2 y 3 hicieron que las barras del lienzo se aparten. Este pregunta qué queda cuando alguien
las ha apartado de verdad.

**El recorrido entero sin tocar el ratón mueve la barra**, y eso es la mitad que este repositorio le
exige a cualquier arrastre: el paso está **dentro de las marcas** del recorrido, donde
`keyboardOnly.test.ts` falla si aparece un gesto de puntero. Tab hasta el asa, Intro para la esquina
siguiente, una flecha para el paso, y sigue hasta «Estilo» como siempre.

**axe con las dos barras movidas** no encuentra nada serio ni crítico, y el árbol de landmarks es el
mismo antes y después: mover cromo no añade sitios a los que navegar. (De paso, el ayudante de axe
deja de estar copiado: eran tres copias con tres redacciones distintas del mismo fallo, que es
exactamente el tercer uso en el que la regla de la casa dice que se extrae.)

**El grupo movido sobrevive al viaje a móvil y vuelve a su sitio exacto.** Es lo que demuestra la
decisión del día 2 de guardar la posición **sin recortar** y recortarla al dibujar: en móvil la
posición ancha no cabe y se dibuja donde quepa; al volver se dibuja la que se guardó. Si se hubiera
guardado recortada, el viaje de ida habría borrado el sitio.

**Y con un dedo**, que pidió David al aprobar el sprint: un toque en el asa cambia de esquina y un
arrastre mueve las dos barras, el mismo recorrido que hizo la mano, sin llevarse las palabras
elegidas del texto. Lo hace posible una línea —`touch-action: none` en las dos asas—, y ahora hay dos
caminatas que lo notarían si desapareciera. Lo que no cubren, dicho: un aparato de verdad, y dos
dedos a la vez.

**Lo que la caminata táctil encontró de paso, y no es de este sprint.** Encadenar las dos barras en
una sola página falla, y al medirlo resultó no tener nada que ver con el dedo: **elegir una sección,
hacer clic después en un texto de otra y pulsar cualquier botón de la barra flotante tira el foco al
`body` y cierra la barra** — «B» no pone negrita y la barra desaparece bajo el puntero. Reproducido
con ratón, y reproducido también contra el editor **anterior al día 3**, así que es viejo y no de
aquí; ninguna caminata lo había visto porque todas pulsan el texto primero. Está en
`docs/tasks/backlog.md` con lo medido y con lo que queda descartado, y la caminata que lo encontraría
en una línea está escrita allí para quien lo tome.

### Lo que este sprint deja a David

Nada que firmar. Cinco días: los verbos crecen y dicen su nombre, el grupo se aparta con un asa, la
barra del texto también y además un teclado por fin la alcanza, la marca se sirve en vector, y el
cierre. Fuera de los días, un sexto cambio que tuvo que ir aparte porque bloqueaba: el relevo de
marcos dejó de perder el teclado que le pedían llevar, un intermitente de tres rojos de CI con su
mecanismo por fin medido.

Queda en el backlog, con sus números: la otra mitad de `role="toolbar"` (las flechas entre los
controles, y qué hacen cuando Tab ha deshecho la selección), el defecto de arriba, y servir los SVG
donde todavía no se sirven —que es ninguno, porque el día 4 los sirvió todos salvo el favicon, que se
queda en píxeles a propósito.


## Sprint 21 — «La aplicación cabe en un móvil» (15 de octubre de 2026)

David, tras fusionar el cierre del sprint 20: «quiero que al abrir la aplicación web de Retorika
esta se adapte al tamaño de pantalla… que ningún elemento de la landing sobresale, ningún texto
sobresale de su botón y ningún elemento termina cortado por la pantalla», y eso para las preguntas,
las tres propuestas y el editor entero —cabecera con «Descargar», raíl, paneles, barras flotantes,
verbos de sección, lienzo. Su ejemplo: las tres propuestas «se acortan tanto para ajustar la
pantalla que no permite que se vean las previsualizaciones». Es la aplicación, no el sitio
publicado: el renderer pasa el desborde a 320, 768 y 1280 desde el sprint 2 y no se toca.

**Medido antes de planificar, en la aplicación desplegada, con Chromium emulando un móvil:**

| Pantalla | 390 (iPhone 13) | 320 | 768 |
|---|---|---|---|
| Landing | cabe | cabe | — |
| Las cinco preguntas | rejillas de tres columnas con `height: 56`: «Que me manden un correo» pinta tres líneas, dos fuera de la caja | «Peluquería y barbería» se sale | cabe |
| Las tres propuestas | cada tarjeta 60px; la miniatura enseña el **17 %** de la web | 37px, el **10 %** | 186px, el 52 % |
| El editor | el grupo derecho de la cabecera mide 673px fijos y la página se abre a **822px**: «Descargar» y «Guardar en mi cuenta» fuera, el lienzo a escala 0,36 | igual, 0,27 | la cabecera 53px más ancha que la pantalla; lo demás a 0,69 |
| El editor con «Estilo» | el lienzo 257px fuera por la izquierda | igual | cabe |

Y la razón: `apps/editor` no tenía **ni una** media query de ancho. Lo único que respondía al
tamaño era `MIN_STUDIO_WIDTH = 1024`, escrito para no ofrecer las herramientas de diseño (ADR 0025
§5), y un comentario del e2e que llamaba «no soportado» a todo lo que hubiera por debajo. Nadie había
decidido eso. El ADR 0042 lo decide: tres clases —teléfono ≤ 720, tableta 721–1023, estudio
≥ 1024— con los dos números que ya existían, el del renderer y el del ADR 0025, y ninguno nuevo.

Dos elecciones de David entre opciones puestas delante: las propuestas pasan a **carrusel** en un
móvil (una tarjeta al 85 %, la siguiente asomando) en lugar de apilarse, y la cabecera del editor
pasa a **tres filas** en lugar de mudar «Guardar en mi cuenta» al panel «Compartir». Dos añadidos al
aprobar: **todo campo con letra de 16px o más** en la clase teléfono, para que Safari no amplíe al
enfocar, y una lista corta al final para recorrer la aplicación en un iPhone de verdad.

### El arnés, los números y las cinco preguntas (día 1)

**El arnés primero.** «Nada sobresale en un móvil», en el e2e: tres dispositivos emulados (320×568,
390×844, 768×1024, cada uno con `isMobile`, dedo y densidad 2) y un recorrido por cada uno desde la
landing hasta el diálogo de la cuenta, pasando por las cinco preguntas, las tres propuestas, el
editor con cada panel abierto, una sección y un texto elegidos y las dos vistas. En cada pantalla
cuatro cosas: la página se abre al ancho del dispositivo y no se desplaza en horizontal; ningún
elemento visible queda fuera; ningún texto se sale de su botón (el sondeo por `Range` de octubre,
izado a ámbito de módulo junto con el del lienzo); y **ningún elemento queda cortado** por un
ancestro que no se pueda desplazar. La cuarta es la que faltaba: la miniatura de una propuesta
recortada por su caja no sobresale de nada y no saca texto de ningún botón, y enseña el 17 % de la
web. En la clase teléfono, además, todo `input`, `textarea` y `select` visible con letra computada
≥ 16px. Las propuestas y el editor están como `it.fails` con el día que los arregla escrito al lado,
de modo que CI no se relaja y cada día convierte exactamente uno en `it`.

**Lo que el arnés encontró en su primera pasada, que la medida de la mañana no había visto:** a
320, en el paso 3, la fila del servicio propio con su botón «Añadir» medía **370px** y abría la
página entera a ese ancho, porque un `<input>` no se encoge por debajo de su ancho intrínseco
(unos 180px). `minWidth: 0` en el campo y `flexWrap` en la fila. Y a 768 el editor pasó entero en la
primera pasada cuando por la mañana había medido 821: la frase «Guardado en este navegador» llega
medio segundo después que el editor, y el recorrido medía antes. Ahora la espera, porque es 200px
de la cabecera que mide.

**Las preguntas, sin un solo breakpoint.** Las rejillas de opciones dejan de ser «tres columnas» y
pasan a «tantas columnas de 180px como quepan» (220 en el paso 5, por «Que me manden un correo»;
270 en el paso 3): tres en la tarjeta, una en un móvil, y nada que pinzar en un test. `ChoiceCard`,
`CheckboxCard`, el botón de «Siguiente», el de subir el logo, el de «Añadir» y «Usar esta» de las
propuestas tenían `height` fijo: **seis cajas** que el escáner de `buttonText.test.ts`, extendido
al cuestionario, marca en rojo contra `main` y en verde ahora. La primera versión del escáner
extendido pilló dos cuadrados —un icono de 18 y una casilla de 19— y se dejó tres botones cuyo
`cursor` quedaba fuera de su ventana de 240 caracteres; la ventana es de 400 y los cuadrados quedan
fuera. `NavRow` estaba exenta por nombre «por fiel a las maquetas»: una maqueta dibujada a un ancho
no es razón para recortar a otro. Los títulos pasan a `clamp()`; los cinco campos del paso 5 y el
del paso 3 que pedían 15px pasan a 16, y `TextField` aplica el suelo pida lo que pida quien lo use.

**Lo que CI encontró en la PR, que en local no se había corrido:** la caminata del sprint 7 que
exige que elegir un sector no mueva la rejilla la vio moverse **6,5px**. `Shell` centra la tarjeta
en vertical, así que cualquier cambio de alto la recoloca; el `height: 56` fijo lo impedía por la
fuerza, y con `minHeight` la tarjeta elegida —que añadía su hueco de 10px y su marca de 18px solo al
elegirse— pasaba «Restaurante y bar» a dos líneas y crecía una. La marca reserva ahora su sitio
siempre, con `visibility`, igual que el aviso de ese mismo paso. Y de paso la aritmética: con 180px
de mínimo entraban **cuatro** columnas en los 816px interiores de la tarjeta, no tres; son 200.

**Lo que queda en su sitio y por qué:** `MIN_STUDIO_WIDTH` y el ADR 0025 §5 (las herramientas
siguen ausentes bajo 1024: el editor de teléfono es el editor sencillo); la frase del ADR 0012, que
no se recorta ni se oculta en ningún ancho; el renderer y los goldens, que no cambian un byte, y
`pnpm test:golden` lo dice. La raíz del editor pasa de `h-screen` a `h-dvh` y la meta `viewport`
gana `viewport-fit: cover`, sin `maximum-scale` ni `user-scalable=no`: la forma de que Safari no
amplíe un campo es darle 16px, no quitarle el pellizco a todo el mundo.

**Lo que el ADR dice del lienzo:** los textos de la vista previa son del sitio, a la escala
tipográfica del sitio, y el editor no los cambia para acomodarse a sí mismo. Una línea de cuerpo de
14px seguirá siendo de 14px y en un iPhone tocarla puede ampliar la página; titular, subtítulo y
botones están por encima del umbral en todas las escalas. Queda nombrado, va en la lista del iPhone
del último día, y lo que David mida allí va al backlog con su número.

### Las tres propuestas caben, y se comparan (día 2)

El ejemplo de David al abrir el sprint: «cuando se proponen al usuario las 3 propuestas de web
estas se acortan tanto para ajustar la pantalla que no permite que se vean las previsualizaciones».
Medido el día 1: a 390 cada tarjeta medía 60px y la miniatura enseñaba el **17 %** de la web; a
320, el 10 %; a 768, el 52 %. La causa eran dos constantes: tres columnas a cualquier ancho, y una
miniatura que dibujaba la web a 1280×900 y la encogía siempre a 0,28 —lo que una tarjeta de 358px
necesita en la fila de 1180 de la maqueta, y nada más— dentro de una caja de alto fijo con
`overflow: hidden`. La caja recortaba lo que no cabía, y lo que no cabía era la web.

**La miniatura se mide.** Un `ResizeObserver` sobre la caja —el mismo patrón que el lienzo del
editor— da el ancho que la tarjeta tiene de verdad, la escala es ese ancho entre 1280 y el alto
sale de ahí: la caja es siempre exactamente la web encogida, más sus dos filos de 1px. `srcDoc` no
cambia con la escala, así que redimensionar no recarga el marco. En la fila de la maqueta la escala
medida es la de siempre (0,27 para 348px a 1280 de ventana), y el escritorio no se mueve.

**Bajo 900px la fila es un carrusel** —elección de David del día 15 frente a apilarlas: la
tarjeta ocupa el 80 % de la fila, la siguiente asoma por el borde, y el desplazamiento encaja
tarjeta a tarjeta (`scroll-snap`). Abre en «Con foto grande», la marcada «Elegida», centrada; tres
puntos debajo dicen cuál está a la vista, `aria-hidden` porque la lista sigue siendo la estructura
que un lector recorre. Los laterales del 10 % son lo que permite centrar también la primera y la
última. Por encima de 900 las tres columnas de la maqueta, intactas. El umbral se lee con
`matchMedia` a través de `viewport.ts`, el único sitio donde la aplicación pregunta por su ancho,
y la aritmética —escala, alto, centrado, qué punto encender— está en `proposalsRow.ts`, puro y con
su test, para que una constante mal puesta falle en milisegundos y no tras cuatro minutos de e2e.

**Medido, no supuesto, en Chromium emulando los tres dispositivos:** a 390, tarjeta de 274px en
una fila de 343 (el 80 %), miniatura entera a 0,19; a 768, tarjeta de 550 y miniatura a 0,41; a
320, tarjeta de 225. En los tres, el marco interior mide exactamente la caja menos sus filos, que
es lo que el arnés del día 1 exige con «nada cortado». La fila de 1280 sigue en tres columnas de
350. El `it.fails` de las propuestas pasa a `it` en los tres dispositivos; quedan en rojo esperado
los tres del editor, que son de los días 3 y 4.

**Dos correcciones sobre la marcha, las dos medidas.** La primera cuota de tarjeta decía 85 % y
dibujaba el 64 %: el porcentaje se aplicaba a la caja de contenido de la fila, que los laterales ya
habían estrechado, así que encogía dos veces. La tarjeta es ahora la caja de contenido entera y los
laterales son lo que deja. Y con el 85 % asomaban 14px de la siguiente a 390 —un lateral del 7,5 %
menos el hueco de 12— que no se leen como «hay otra»; con el 80 % asoman 27. La barra de
desplazamiento de WebKit, que el editor dibuja a propósito en sus paneles, no se dibuja bajo el
carrusel: la vecina asomando ya dice que hay más, y la regla solo toca el pseudoelemento de WebKit,
no `scrollbar-width`, que `scrollbar.test.ts` sigue manteniendo fuera.

### El editor cabe en un móvil y en una tableta: la cabecera en filas, el raíl abajo, el lienzo en móvil (día 3)

**Lo que había.** El grupo derecho de la cabecera —conmutador, deshacer, rehacer, la frase de
guardado, «Guardar en mi cuenta», «Descargar»— medía 673px fijos, `shrink-0` a propósito desde el
sprint 7 para que la frase del ADR 0012 no se recortara nunca. A 1280 eso deja 575px al resto y
funciona; a 768 la página se abría a 821px, y a 390 a 822: «Descargar» fuera de la pantalla, el
lienzo a escala 0,36, y «Guardar en mi cuenta» sin poder pulsarse porque otro elemento recibía el
toque. El raíl de 80px se llevaba un cuarto de una pantalla de 320.

**La cabecera, por clases de ancho (ADR 0042 §2).** Bajo 1024 el grupo derecho se disuelve
(`display: contents`) y sus piezas pasan a ser hijas de la barra, que ahora puede partirse en
filas con `order` y `basis`. En tableta cae solo el estado —la frase y «Guardar en mi cuenta»— a
una segunda fila, alineado a la derecha; en teléfono la primera fila es la marca, deshacer, rehacer
y «Descargar», la segunda las pestañas de páginas y el conmutador, y la tercera el estado, con
«Guardar en mi cuenta» como botón de texto y la fila partiéndose en dos líneas cuando la frase
lleva un recuento. Es la elección de David del día 15 frente a mudar la cuenta a «Compartir». Nada
se oculta, nada se recorta: la frase se mueve y se parte. A 1024 y más la barra es la de siempre,
58px y una fila, byte a byte en sus clases.

**El cajón de campos lee la altura de la cabecera.** `FieldsPanel` es `fixed` y empezaba a 58px,
que era verdad mientras la cabecera tuvo una fila; en tableta ahora tiene dos y el cajón habría
tapado la fila de estado con «Guardar en mi cuenta» dentro. La concha mide su cabecera con un
`ResizeObserver` y la publica como `--editor-header`, y el cajón empieza ahí: 58 en escritorio, 99
en tableta. Medido, no supuesto, como el ancho del lienzo.

**El raíl es una barra abajo en teléfono.** Fija al borde inferior, a todo el ancho, los mismos
cinco botones en fila con icono y palabra, sobre el indicador de inicio (`viewport-fit: cover` ya
estaba desde el día 1 para que `env(safe-area-inset-bottom)` no fuera cero). Nada se añade ni se
quita con la mudanza: los dos elementos del estudio y el interruptor ya estaban ausentes bajo 1024
por el ADR 0025 §5. La fila del lienzo le deja su sitio.

**El lienzo abre en «Ver en móvil» en un teléfono**, decidido una vez al montar con `matchMedia`
y no a través de `changeDevice`, que animaría el primer pintado como si fuera un cambio. A 320px
de lienzo en los 374 que deja un teléfono de 390 la escala es 1: la página se ve como la verá el
visitante, y la vista de escritorio sigue a una pulsación, escalada como siempre. La leyenda de
teclas del lienzo no se dibuja donde no hay teclado (`hover: none` y `pointer: coarse`), y el aviso
de borrado cabe en el ancho y se aparta de la barra.

**Medido en Chromium emulando los dispositivos, con la frase de guardado ya en pantalla:** a 1280
nada cambia (cabecera 1280×58, raíl 80, lienzo 1008 solo y 788 con «Estilo»); a 768 la cabecera
mide 99, el lienzo 496 a 0,69 y 276 a 0,38 con «Estilo»; a 390 la cabecera mide 135, la barra
390×57 pegada abajo, y el lienzo 320 a escala 1 en un área de 374; a 320 la cabecera mide 159 y el
lienzo 304 a 0,95. Esa cabecera de 320 medía 203 en la primera pasada: la marca, con `basis: auto`,
no se encogía sino que hacía saltar «Descargar» a una fila propia —una fila que se parte coloca
primero cada pieza a su ancho máximo—, y ahora es `flex-1` hasta 150px. El editor pasa a `it` en
tableta; en teléfono sigue como `it.fails` hasta mañana, porque con «Estilo» abierto el panel de
340px deja al lienzo 10px —los paneles como hojas son el día 4.

**Dos cosas que el recorrido necesitó, y que son suyas.** El lienzo vuelve a medir el sitio que le
deja un panel un fotograma después de que el panel entre; una mirada tomada en ese fotograma ve el
ancho viejo dentro del área nueva y canta un recorte que un fotograma después no existe. El
recorrido espera a que la tarjeta quepa en su área antes de mirar, que es además lo que asevera. Y
el indicador «N» de `next dev`, fijo abajo a la izquierda, tapaba «Secciones» en la barra: en
producción no existe, así que se apaga solo cuando la suite dice que es la suite
(`RETORIKA_E2E=1`), y quien desarrolla lo conserva.

### Los paneles son hojas, el lienzo se asienta de verdad, y los campos no amplían Safari (día 4)

**Lo que quedaba en rojo tras el día 3:** con «Estilo» abierto a 320/390, el panel de 340px se
dibujaba junto al lienzo y le dejaba 10px de ancho. Los seis paneles del raíl y el cajón de campos
pasan a ser **hojas desde el borde inferior** en la clase teléfono: `fixed`, a todo el ancho,
ancladas exactamente al hueco que la barra inferior reserva —`calc(56px + env(safe-area-inset-bottom))`,
la misma expresión que ya usaba la fila del lienzo, no un número redondeado aparte—, con tope de
70% de la altura dinámica para que siempre se vea lienzo por encima. En tableta y escritorio no
cambia nada: siguen siendo la tarjeta de 340px junto al lienzo.

**Dos paneles no se podían cerrar.** «Páginas» y «Fotos» no tenían `onClose`: en escritorio el
raíl siempre está a mano para cambiar de herramienta, pero en teléfono el raíl es la barra que la
hoja tapa, así que no había forma de volver a «Secciones» salvo recargar. Los dos ganan su cierre.
Y de paso, un botón de cierre repetido a mano cinco veces —tres paneles ya lo tenían, cada uno con
su propio SVG— se extrae a `PanelClose` en `panelKit`, que ahora usan los seis. Al juntarlos
apareció un error de verdad: el de «Compartir» anunciaba «Cerrar los campos», la etiqueta del
cajón de campos, copiada y nunca corregida. Nadie lo había oído, porque una pulsación con vista no
llega nunca a esa etiqueta.

**Lo que el arnés real encontró, en tres capas, cada una real y no supuesta:**

1. **El arnés no sabía que `position: fixed` escapa del recorte de un ancestro sin `transform`.**
   La primera pasada marcó los seis paneles como «cortados» por `canvas-and-panel`, que tiene
   `overflow-hidden`. Las capturas, a la vez, mostraban las hojas enteras y sin recortar. El
   recorte de `overflow` sigue la cadena de bloque contenedor, y un elemento `fixed` sin ningún
   `transform`/`filter`/`perspective` de por medio rompe esa cadena y ancla contra el viewport
   directamente —exactamente por qué las hojas se dibujan sobre el lienzo en vez de dentro de su
   rendija. El arnés deja de atribuir recorte en cuanto cruza un `fixed`.
2. **Un hueco real en el lienzo, no del arnés.** Con la vista móvil abriéndose sola a una ventana
   de 320, la tarjeta del lienzo necesita a veces escalarse por debajo de 1 incluso en su propio
   modo móvil —algo que antes del día 3 nunca pasaba, porque nadie abría el editor a ese ancho. El
   envoltorio de la vista previa pedía un suelo de `60vh` pensado para la ventana de escritorio;
   en una tarjeta ya comprimida ese suelo pedía más alto del que había, y `overflow-hidden`
   recortaba en silencio **146px** de la web real. `phone:min-h-0` deja que la tarjeta decida su
   propio alto, como ya hacía para el ancho.
3. **El propio recorrido necesitaba esperar a dos cosas que no esperaba.** Cambiar de dispositivo
   anima el ancho y la transformación en 260ms (`ui-reflow`) pero el alto —un simple porcentaje—
   salta al instante: medido una vez, 769px de tarjeta en un área de 342. Y abrir un panel lo
   anima con `translateX(14px)` a `none` en 180ms, que no mueve nada del lienzo y por tanto nada
   que la primera versión de «asentado» comprobara: medido exactamente a esos 14px, la cifra que
   apareció como «fuera de la pantalla». La comprobación de asentado ahora mira los cuatro bordes
   de la tarjeta, no solo los dos horizontales, y espera además a que el panel deje de moverse,
   con el mismo criterio de «dos lecturas seguidas e iguales» que el cambio de dispositivo ya usa
   en otra caminata del repositorio.

**Los campos de los paneles ampliaban Safari.** Siete cajas de texto y dos `<select>` —el
renombrado de página y de lista, la URL y la frase de «Compartir», los dos campos del cajón,
titular y página de una ficha— estaban a 13 o 12px, el tamaño pensado para 340px de escritorio.
`phone:text-base` los lleva a 16 solo en la clase teléfono; a partir de tableta quedan como
estaban. Es la cuarta comprobación del ADR 0042 §7, y el arnés la hace en cada campo visible.

**Revisado por lectura, no recorrido en vivo:** los cinco diálogos de la descarga
(`DownloadGateDialogs.tsx`). Dos no tenían ni `max-h-full` ni `overflow-y-auto`; se les añade,
como ya tenía `RevertDialog`. Y el de la advertencia de fotos tenía el error contrario: declaraba
`overflow-y-auto` en su lista pero le faltaba `min-h-0`, sin el cual un hijo flexible no cede
altura aunque el padre la tenga topada —así que esa lista nunca llegaba a desplazarse de verdad
por debajo de los 85vh que el diálogo se permite. Los otros dos diálogos, los de contraste y
desborde, ya tenían el patrón correcto y sirvieron de referencia. Generar el documento que
dispara cada uno de los cinco no entraba en el día; la corrección es la misma que el arnés sí
comprobó en los seis paneles, aplicada por lectura cuidadosa del mismo patrón.

**El recorrido «nada sobresale en un móvil» queda verde en los tres dispositivos, sin ningún
`it.fails`.** `pnpm typecheck`, `pnpm lint`, `pnpm test` (129 ficheros), invariantes y golden sin
cambios.

### El cierre: axe a 390, los comentarios que mentían, y la lista del iPhone (día 5)

**axe en la clase teléfono.** El recorrido «nada sobresale en un móvil» pasa axe a 390 —el ancho
que un iPhone tiene de verdad— en la landing, el paso 2, las tres propuestas, el editor en vista de
móvil y el editor con la hoja de «Estilo» abierta. A 320 y 768 camina el mismo marcado; lo que
cambia entre anchos es la geometría, y eso ya lo mide cada mirada.

**Y la primera pasada encontró dos contrastes en la landing**, que nunca había tenido axe a ningún
ancho: la frase bajo «Empezar» a 4,43:1 (`#64748B`, el gris de las maquetas que el cuestionario ya
cambió en el sprint 1 por este mismo motivo y esta página no) y el enlace «Ya tengo cuenta» a
4,39:1 (el azul de marca como texto de 15px sobre el gris de la página). Pasan a `#5B6B82` (5,06)
y al azul secundario de la paleta, `#105CB1` (6,14; ADR 0041 §3). Y tres más en las tres
propuestas, que tampoco habían visto axe: el subtítulo a 4,43, la píldora «Elegida» a 4,14 (azul de
marca sobre su tinte) y «Volver a empezar» a 4,39; los mismos dos colores los dejan en 5,06, 5,79
y 6,14. Los pies de tarjeta sobre blanco ya daban 4,76 y se quedan. Medidos, no supuestos, y ahora
axe los vigila a 390 en cada ejecución.

**Dos comentarios del e2e decían que el editor no soportaba menos de 1024, y citaban el ADR 0025
§5 como razón.** Nunca fue la razón: ese umbral decide si se ofrecen las herramientas de diseño,
no si el editor cabe. Reescritos los dos, y los bucles de anchos que se escudaban en ellos —el
diálogo de la cuenta y el cromo del editor en una ventana de escritorio encogida— empiezan ahora en
320 en vez de en 768 y 1024. Son la misma barra que el recorrido del móvil mide bajo `isMobile`,
medida además como la ve quien estrecha la ventana de un portátil.

**Lo que no se decide hoy, nombrado:** el ADR 0042 sigue `proposed` hasta que David lo firme; los
textos del lienzo por debajo de 16px son del sitio y pueden ampliar un iPhone al tocarlos (§7 del
ADR), y lo que David mida en el teléfono va al backlog con su número.

### Lo que este sprint deja a David

**Una firma:** el ADR 0042, «la aplicación cabe en un móvil», con las dos elecciones que tomó el
día 15 —carrusel y cabecera en tres filas— y los dos añadidos al aprobar el plan, los campos de
16px y esta lista.

**Un recorrido en un iPhone de verdad, con Safari**, que Chromium emulando un móvil no puede
hacer por él. Cinco cosas, y lo que encuentre va al backlog con la medida:

1. **El zoom al enfocar**: tocar cada campo de las cinco preguntas, del diálogo de la cuenta y de
   los paneles «Compartir» y «Páginas»; ninguno debería ampliar la página. Tocar después un texto
   de cuerpo del lienzo: ese sí puede, y es lo que §7 del ADR dice.
2. **La barra inferior y el indicador de inicio**: los cinco botones enteros por encima de la
   franja del sistema, con «Secciones» y «Fotos» pulsables en las esquinas.
3. **`dvh` contra la barra del navegador**: desplazar el lienzo para que la barra de Safari se
   esconda y aparezca; la cabecera del editor y la barra inferior no deberían dar un salto ni dejar
   una franja.
4. **El carrusel de las tres propuestas**: abre en «Con foto grande», se desliza con el dedo
   encajando tarjeta a tarjeta, los tres puntos siguen el dedo, y «Usar esta» responde.
5. **La descarga del ZIP** desde «Descargar» en el editor: Safari lo guarda en Archivos, y el
   `index.html` de dentro abre desde ahí.

Queda en el backlog, con sus números: los cinco diálogos de la descarga, corregidos por lectura y
no recorridos en vivo; la fila de «Fotos» que a 320 parte su etiqueta en cinco líneas, que es la
regla de «se parte, no se recorta» funcionando en menos sitio del que se dibujó para ella; y el
indicador de `next dev`, apagado solo para la suite.


## Sprint 22 — «Se mueve lo justo» (16 de octubre de 2026)

David, tras fusionar el cierre del sprint 21: «una mejora visual de la landing page, de las páginas
de cuestionario para el usuario y de la página donde se muestran las 3 propuestas. La idea es dar
apariencia de movimiento y modernidad con los colores de Retorika **pero sin abusar para no
distraer al usuario**… que dé un aspecto moderno de página creada en 2026. Explora imágenes en
movimiento, bucles estéticos, pulsómetros, sensación de movimiento al pasar el ratón o hacer hover,
colores en movimiento. Siempre con lógica, aplicando la paleta de Retorika y acorde a los objetivos
del proyecto.»

**Medido antes de planificar.** Las tres pantallas previas al editor no tenían **ni una transición
ni una animación**, salvo el punto del carrusel que el sprint 21 dejó. Tampoco es un olvido de las
maquetas: ninguna de las diecinueve tiene una regla `:hover` ni una `transition` — «son dibujos, no
especificaciones de interacción», como ya se escribió el 5 de octubre al darle al cromo del editor
su sistema. Y van casi enteras en `style={{}}` con hexes literales: los tokens `--ui-*` existían y
apenas los consumían.

**Tres elecciones de David entre opciones puestas delante, el 15 de octubre:**

1. **El héroe de la landing es una web real**, generada por nuestro propio renderer, en un marco de
   dispositivo que pasa de ordenador a móvil — la transición del editor que dirección señaló.
2. **El fucsia solo donde ya estaba**: el bloque rosa de la marca. Ningún elemento nuevo lo usa, que
   es el «nunca en fondos amplios» del dossier.
3. **En las propuestas, la tarjeta se eleva y el borde de la miniatura se enciende**, sin transformar
   el iframe ni desplazar la página de dentro.

Y tres ajustes al aprobar el plan: medir la landing **antes y después** del héroe con Lighthouse
móvil; montar el iframe **después de la primera pintura**; y nada de snapshot por hash del HTML de
muestra, que fallaría con cualquier cambio legítimo del renderer.

### El vocabulario, y el presupuesto que lo sujeta

Cinco piezas con nombre en `globals.css`, encima de los estilos en línea que ya había. Sin
librería, sin `filter: blur`, sin animar maquetación.

| Pieza | Qué | Tiempo |
|---|---|---|
| `ui-reveal` | una superficie que llega: opacidad y `translateY(6px)`, escalonada por `--ui-reveal-delay` | `--ui-slow` 260 ms |
| `ui-lift` | un píxel de subida y `--ui-shadow-2` bajo el puntero, tras `@media (hover: hover)` | sobre `ui-interactive`, 120 ms |
| `ui-ring-once` | un anillo que crece desde el azul de marca y se apaga, en un `::after`, **una iteración** | 700 ms, retardo 500 |
| `ui-drift` | dos discos radiales derivando 24 px a la derecha y 18 arriba | 24 s, infinito |
| `--ui-stagger` | el único hueco entre dos cosas que llegan, con tope de siete escalones | 40 ms |

**El presupuesto de contención, que es la mitad del encargo que se degrada sola:**

- Bucles infinitos: landing **uno**; cuestionario **cero**; propuestas **cero**.
- Pulsos de una vez: **uno por pantalla** como máximo, y **ninguno** en el cuestionario, donde lo
  que debe tener la atención es la pregunta.
- Nada anima la maquetación. Ninguna transición pasa de 200 ms. Ninguna pantalla tarda más de
  600 ms en estar en reposo.
- `prefers-reduced-motion` retira el movimiento, nunca el contenido.

`test/motionBudget.test.ts` lo guarda con diecinueve aserciones, mitad sobre la hoja de estilos y
mitad sobre los componentes de cada pantalla. Un cuarto nombre en la lista de lo que puede girar en
bucle es una decisión sobre cuánto distrae esta aplicación, y pasa por este documento.

**Dos tokens nuevos, ninguno un color nuevo.** `--ui-brand-deep: #105CB1` es el azul oscuro que el
dossier ya daba para «títulos y estados pulsados» y que el ADR 0041 §3 pone en la paleta «Neutra»:
estaba escrito a mano en tres sitios porque el azul de marca mide 4,39:1 sobre el fondo de la app y
falla. Medido con la aritmética de `packages/tokens`: **6,59:1** sobre panel, **6,14** sobre el
fondo, **5,79** sobre el tinte. `--ui-stagger` es el ritmo. Ninguno llega al lienzo: la copia de la
escala que vive dentro de la vista previa los excusa por nombre, porque el único azul que es de
Retorika y no del cliente no puede pintarse en la página del cliente (ADR 0015).

### El vocabulario: una entrada, una elevación, un anillo (día 1)

Las tres piezas, el token y la guarda. `questionnaire/ui.tsx` deja de repetir la paleta en hexes
—dieciocho literales pasan a sus tokens— y los controles responden: el botón primario de `NavRow`,
cada tarjeta de elección y cada casilla se elevan; los puntos de progreso deslizan su ancho;
«Volver» y «Saltar» toman su color de clases y no de `style`, porque **un `color` en línea gana a
cualquier regla y una transición que no puede repintar es una transición que miente**.

**`backwards`, nunca `both`, y esa es la decisión del día.** Una animación que rellena mantiene bajo
su control las propiedades que nombra *después de terminar*, y una animación gana a cualquier
declaración normal. Con `both`, una tarjeta se revelaría bien y después **se negaría a elevarse bajo
el puntero**, en silencio, justo en los elementos a los que este sprint añade hover.

Medido en Chromium a 1280: cero animaciones en marcha con el foco en un campo; el punto de progreso
transicionando a 180 ms y a 0,00001 s con movimiento reducido; una tarjeta elevándose a
`matrix(1, 0, 0, 1, 0, -1)`; y el alto de la rejilla **idéntico** con el puntero encima, 263 px,
que es lo que garantiza que nada de esto mueve lo que el recorrido de desbordes mide.

### La landing enseña una web de verdad que pasa de PC a móvil (día 2)

El héroe es `generate()` y `render()` al construir, sobre «Taberna del Puerto» — el negocio de
muestra que ya pesa el presupuesto y ya audita Lighthouse, para que haya **un** sitio de muestra en
este repositorio y no tres que mantener plausibles. La página de dentro no se cambia ni se vuelve a
renderizar: se estrecha su ventana, así que su propio `max-width: 720px` salta a mitad de camino.
Medido, el `innerWidth` de la página cada 22 ms durante un viaje:

```
1271 1172 1055 762 655 517 443 420 395 391 390
```

Once fotogramas distintos, con el salto de 720 cruzado **entre 762 y 655**: por el medio del
recorrido, donde hay alguien mirando. Reutiliza `ui-reflow`, que ya era «ancho y transform, curva
simétrica, 260 ms», escrito para el lienzo haciendo esto mismo.

La landing **sigue prerenderizada**: `landingSample.ts` no lee sesión ni base de datos. El iframe se
monta tras la primera pintura, así que el titular y «Empezar» no esperan, y la cadena de 12,9 KB
(3,2 comprimidos) **no aparece en el HTML servido** — viaja una vez en los datos que React ya manda
en lugar de dos, la segunda escapada dentro de un atributo. Un `IntersectionObserver` retiene la
carga y la demostración hasta que un tercio del marco se ve.

**La medición antes y después, que David pidió.** Lighthouse móvil sobre `/`, cuatro builds del
mismo commit; accesibilidad **1,00 en las cuatro**:

| | rendimiento | CLS | LCP | bytes | peticiones |
|---|---|---|---|---|---|
| sin héroe | 0,95 | 0 | 2789 ms | 784 KB | 25 |
| héroe, demostración al cargar | 0,90–0,93 | 0,144 | 2121–2788 ms | 1128 KB | 32 |
| héroe, sin demostración | 0,98 | 0,008 | 2135 ms | 1128 KB | 32 |
| **héroe, demostración al entrar en vista (lo que va)** | **0,90** | **0,145** | 2799 ms | 1128 KB | 32 |

La última fila sale igual que la segunda porque Lighthouse emula un teléfono de **823 px de alto**,
donde el héroe entero cabe en pantalla al cargar: el filtro es correcto para un teléfono real y no
cambia la auditoría. **Todo ese 0,144 es la demostración**, y la mayor parte no es el marco
moviéndose: son las secciones de la muestra recolocándose dentro, que es el efecto. En la landing no
se mueve nada más, porque el alto del marco no cambia nunca. El LCP está entre 2,1 y 2,8 s también
sin héroe: es de la landing, no suyo.

**La palanca queda escrita y es de David:** quitar la demostración automática y dejar el botón
recupera **0,136 de CLS y unos siete puntos de rendimiento**, con el viaje intacto al pulsar. Eligió
movimiento al llegar cuando eligió este héroe, así que eso es lo que va. La Parte 8.5 pone el 95
sobre el sitio publicado del cliente, no sobre la aplicación, que no tiene presupuesto escrito: esto
es un número registrado, no una puerta cruzada.

Un hallazgo: el borde de 1 px del marco dejaba la página de dentro a **1276** píxeles en vez de 1280
y a 386 en vez de 390, porque todas las cajas son `border-box`. Lo encontró el e2e pidiendo 1280
exacto. Ahora es una sombra interior, que no ocupa maquetación.

### Los orbes, la marca que se asienta, y las preguntas que llegan (día 3)

**Dos discos de color de marca** derivan tras la página en 24 segundos: el único bucle de esta
pantalla. Necesitaron **cuatro paradas de color y no dos**: `transparent 70%` deja una pendiente
constante contra una plana, que es donde el ojo inventa un borde, y una captura a cuatro aumentos
enseñaba un anillo perfectamente circular cruzando el titular. Se vio mirando, no deduciendo.

**La marca se construye una vez.** Lo que está en pantalla sigue siendo el lockup entregado —mismo
fichero, mismo ancho, mismo `alt`—, pero su mitad izquierda se oculta con `clip-path` y
`BuildingMark` se dibuja exactamente ahí. Funciona porque las dos trazas son el mismo dibujo diez y
cuatro píxeles aparte: `M178.5 113.68` en la marca y `M188.5 117.68` en el lockup, Béziers
idénticas. Medido a 232 de ancho: la marca cae a 63,03 × 65,09 contra 63,04 × 65,10 de aritmética y
el offset es exacto; contra el lockup liso, 2,15 % de píxeles distintos, todo antialiasing, y uno al
lado del otro son indistinguibles. Cuesta que el recorrido de desbordes salte ese `<img>`, porque
ignora todo lo que lleva `clip-path`; está dicho donde se lee.

`once` son dos propiedades en línea y no una utilidad: cuál de dos utilidades propias gana depende
del orden en que Tailwind las emita, y un estilo en línea gana siempre.

Las cinco preguntas: la tarjeta de cada una llega y sus opciones la siguen en onda, con tope de
siete escalones — once sectores terminan a 0,28 s + 0,26 de recorrido, dentro del presupuesto. El
tick se funde sin tocar su hueco reservado. **Nada gira ni pulsa mientras se contesta.**

**Anotado y no arreglado:** al filtrar en el paso 2, la rejilla pasa de 263 px de alto a 56 y, como
`Shell` centra la tarjeta, **el propio campo donde se escribe baja 7,9 px** (302,13 → 310,02). No es
una animación y es anterior a este sprint: cero animaciones en marcha en los tres estados. Tiene su
fila en el backlog. Tocarlo mueve las cinco preguntas y las tres pantallas de entrar contra unas
maquetas que las dibujan centradas.

### Las tres propuestas llegan, y la elegida lo dice una vez (día 4)

Llegan de izquierda a derecha, 40 ms aparte, la última en reposo a 340 ms, sobre un montaje de
**72 ms** — los 2000 ms de la maqueta 06 siguen intactos. La elegida suena una vez y conserva sus
3 px de tinte. Al pasar el ratón, la tarjeta se eleva, el borde de su vista previa se enciende y la
flecha de «Ver a tamaño real» se asoma dos píxeles.

**Nada se escala, y es la decisión del día.** Un `transform` sobre la caja que hay encima de un
`<iframe>` vivo hace que Chromium vuelva a rasterizar ese marco en cada fotograma: tres sitios
generados a la vez, en la pantalla que el dossier llama la más importante del producto. El e2e
asevera que el `transform` del contenedor es **idéntico** antes y después del hover.

Dos defectos que solo aparecieron midiendo en el navegador. **La tarjeta elegida no hacía su
entrada**: un elemento lleva una sola propiedad `animation`, así que `ui-ring-once` pisaba a
`ui-reveal` y la recomendada aparecía de golpe mientras sus vecinas se deslizaban. El anillo pasa a
un `::after`, donde las dos se componen. Y **el borde de la miniatura no se encendía**: el `border`
en línea le ganaba a la regla de hover, que es el mismo trampolín que el día 1 ya había documentado
para otro control.

### El cierre: teclado, axe, las medidas y el registro (día 5)

axe corre a 390 sobre la landing, el paso 2 y las tres propuestas dentro de «nada sobresale en un
móvil», sin hallazgos serios ni críticos — y las cuatro auditorías de Lighthouse del día 2 dan
accesibilidad 1,00.

**El hallazgo del día, que axe no puede ver.** Una tarjeta de sector es un `<label>` con un radio
visualmente oculto dentro, que es lo que permite que la tarjeta entera sea el control. El anillo de
foco se dibujaba sobre ese radio, y medido con Tab en Chromium el radio reporta una caja de **1 × 1**:
dos píxeles de anillo alrededor de uno, detrás de un `clip` que lo esconde de todas formas. **Quien
recorriera los once sectores con el teclado no podía ver en cuál estaba** — WCAG 2.4.7, anterior a
este sprint, e invisible para axe, que no evalúa qué aspecto tiene un anillo.
`.ui-choice:has(:focus-visible)` lo pone sobre la tarjeta; la prueba mide **la caja además del
anillo**, porque «hay un outline» era verdad antes también.

El resto del recorrido pasa: en la landing, «Empezar», «Ya tengo cuenta» y el conmutador del héroe
en ese orden, los tres con su anillo, y Enter acciona el conmutador; en las propuestas, cada control
con el anillo sobre una caja de verdad — una elevación es un `transform`, que no recorta un
`outline`.

**Y lo que el propio sprint le hizo a CI, que solo se vio al final.** Las dieciséis caminatas que
estos cinco días añadieron a `critical-flows.e2e.test.ts` llevaron el trabajo `e2e` a su límite: la
PR del cierre lo vio **cancelado a los 15m05s con los 186 tests ya en verde**, el resumen impreso y
el paso muerto durante la limpieza, que `gh pr checks` presenta como un fallo. No había nada roto;
la suite se había quedado sin presupuesto. Se arregló primero la mitad barata —los tres recorridos
del día 4 que solo leen la misma pantalla comparten ahora un viaje en vez de contestar las cinco
preguntas cuatro veces, de 20,5 s a 11,4— y después se le dio al trabajo el presupuesto que
necesita: 20 minutos, con la medición escrita en el propio `ci.yml`. En local el fichero entero
pasó de 471 s antes del sprint a 778 durante él.

**Las medidas que deja el sprint:**

| | |
|---|---|
| Landing, documento comprimido | 28,4 KB — la tabla del día 2 tiene el antes y el después, medidos sobre el cable |
| Landing en reposo, 10 s | 6 recálculos de estilo, **0 maquetaciones**, 0,015 s de CPU |
| Paso 2, la última de once tarjetas | 0,28 s + 0,26 de recorrido |
| Propuestas, de «Crear mi web» a tres vistas previas | 72 ms |
| Propuestas, tarjetas en reposo / anillo terminado | 340 ms / 1260 ms |

Los dos orbes no cuestan **ninguna maquetación** en diez segundos, que es lo que `transform` sobre
una capa propia compra y la razón por la que no hay `blur` en ninguna parte.

### Lo que este sprint deja a David

**Ninguna firma nueva.** No cambian los colores de marca ni el modelo de documento, y el ADR 0015
delega el cromo en este documento; `--ui-brand-deep` es un color que la paleta ya poseía (ADR 0041
§3), registrado arriba como promoción a token con sus tres ratios medidos.

**Una decisión, con el número delante:** la demostración automática del héroe cuesta 0,145 de CLS y
unos siete puntos de rendimiento en Lighthouse móvil sobre la landing. Quitarla y dejar el botón los
recupera, con el viaje intacto al pulsar. Es una decisión de producto sobre la puerta de entrada
pública, y es suya.

**Y lo de antes, que sigue ahí:** el ADR 0042 del sprint 21 continúa `proposed`, sin firmar, y la
lista del iPhone de verdad sigue sin recorrerse.

## Sprint 23 — «El héroe cabe y el menú lo decides tú» (16 y 17 de octubre de 2026)

David, tras fusionar el cierre del sprint 22, con dos problemas y una pregunta de criterio:

> «1. En la landing page la maqueta de web que cambia de pc a móvil **debería aparecer en el lado
> derecho junto al texto** cuando la pantalla es amplia y debería adaptarse cuando es pequeña. He
> visto que la maqueta aparece demasiado cortada — no me importa que se corte, pero **se corta en
> extremo** hasta el punto de que prácticamente lo único que se ve es parte de la imagen de portada
> sin visualizar un botón o texto. Luego, cuando la maqueta pasa de pc a móvil y viceversa, a veces
> **se queda el marco que la contiene ampliado sin que tenga contenido**. El marco siempre debe
> estar ajustado a la maqueta que se muestra.
>
> 2. El menú de la página en creación **debería ser editable por el usuario**. El usuario debería
> ser capaz de decidir si una sección no debería aparecer en ese menú. Además me gustaría que como
> experto des soluciones a los menús híbridos: ¿un menú igual, solo las páginas, solo las secciones
> de la página actual, o dos menús distintos?»

**Las tres causas, medidas antes de planificar.** Ninguna se dedujo:

1. **El recorte era un número contra otro.** La ventana del héroe eran **800 píxeles de página en
   los dos estados**, y la portada de la muestra mide **939** de alto a 1280 de ancho, con su botón
   «Reservar mesa» acabando en **891**. Se cortaba 91 píxeles antes del botón: la foto y nada más,
   exactamente como él lo describió. En móvil la portada acaba en 640 y sobraban 160, que es por qué
   una captura del sprint 22 parecía correcta.
2. **El marco vacío tenía dos mecanismos.** El alto del marco salía de un `aspect-ratio` en CSS y el
   tamaño dibujado de la escala en JavaScript, y **nada derivaba uno del otro**: coincidían solo
   mientras `scale === anchoDelHueco / 1280`. Y `heroScale` devuelve 0 ante un ancho de cero con la
   puerta de render en `scale > 0`, así que **una sola entrada del `ResizeObserver` con ancho cero
   desmontaba el iframe** mientras el hueco conservaba su alto reservado. Eso es, literalmente, «el
   marco ampliado sin contenido».
3. **La columna única estaba escrita en cuatro sitios** y `page.tsx` no tenía **ni una** media query.

**Y el menú, antes de tocarlo:** no es una sección y no está en el documento. Es cromo derivado
(ADR 0023, dossier §6: «el menú se escribe solo»). El editor **no tenía ninguna interfaz de menú**:
la única manera de quitar una sección de él era dejarla sin encabezado, que también lo borra de la
web — un efecto colateral que nadie adivinaría. El propio ADR 0023 nombraba esta reapertura: «an
owner wants a page kept out of the menu… which is a different decision, with a place in the document
to store it».

**Las cuatro decisiones de David, el 16 de octubre.** Entre opciones puestas delante:

1. **El marco se ajusta siempre a la maqueta y la página de debajo se mueve**, sabiendo que el
   contenido inferior salta cuando el marco cambia de estado.
2. **Dos menús: uno entre páginas y otro dentro de la página.** Se le recomendó lo contrario — un
   solo menú híbrido, que es lo que ya existía — y eligió la división con los costes delante. Están
   escritos en el ADR 0043 y resumidos abajo.
3. **El dueño decide solo si un destino aparece o no**, sin nombre propio y sin reordenar.
4. **El umbral de tres se queda si no lo ha tocado; en cuanto lo toca, el menú se dibuja con los
   destinos que haya.**

**Y tres ajustes al aprobar el plan**, los tres en el producto final: durante la demostración
automática el hueco reserva el alto mayor y se ajusta solo cuando el visitante pulsa, con **el CLS
medido de las dos formas**; con **cero destinos no se emite ningún `<nav>`**; y una prueba que
asevere que `inMenu: false` no cambia el id de la sección ni hace que `listDeadDestinations` marque
como roto un enlace que apunte a ella.

### El héroe se pone al lado, enseña la portada entera y nunca queda vacío (día 1, PR #256)

Ventanas nuevas, una por estado y las dos medidas: **1040 en escritorio y 844 en móvil** — la
portada entera con su botón, más una franja de «Qué ponemos» para que el marco se lea como el
principio de una página y no como una foto. 844 es además el alto de la ventana de un iPhone 13.
`heroWindow` no tiene red de seguridad aritmética, así que una prueba de navegador vuelve a medir la
portada y su botón contra las dos ventanas y falla si alguno se sale.

Dos columnas desde 1024 — la clase `studio` del ADR 0042, el mismo número con el que el editor
decide que tiene sitio para las herramientas de diseño — **por colocación en rejilla, nunca
reordenando el marcado**, porque el recorrido con teclado pinza el orden «Empezar», «Ya tengo
cuenta», «Ver en móvil», que es el orden del DOM. El alto del hueco sale ahora de los mismos dos
números que dibujan la página, como `thumbnailHeight` ya hacía en las propuestas, y un ancho de cero
deja de ser una medición: se conserva la última escala buena.

**La regla del hueco, medida de las dos formas** — desplazamiento sin interacción, una demostración
entera:

| | hueco reservado (lo que va) | hueco siempre ajustado |
|---|---|---|
| 1280 × 900 | **0,0747** | 0,1530 |
| 900 × 1300 | **0,1313** | 0,1698 |
| 768 × 1400 | **0,1324** | 0,1724 |

Trazado a 900 × 1300: con reserva el hueco se queda en 574 y «Cómo funciona» en 1212 todo el viaje;
sin ella van 574 → 470 → 574 y 1212 → 1108 → 1212. Ciento cuatro píxeles, dos veces, por una
demostración que nadie ha pedido. La regla lo parte por la mitad.

Dos consecuencias atendidas: el centrado del titular pasó de estilos en línea a clases, porque un
`text-align` en línea gana a la regla que tiene que cambiarlo; y el segundo orbe se ancla por abajo,
porque dos columnas llevan la página de **1611 a 1091** píxeles a 1440 y un `top: 760` fijo lo habría
empujado fuera del borde inferior.

### El menú se parte en dos (día 2, PR #257, y el ADR 0043)

- **El menú de páginas** es propiedad del documento: la misma lista en todas las páginas, en el orden
  que dan los avances de la portada, con las páginas que nadie señala al final, «Inicio» delante solo
  donde el visitante no está ya en casa y `aria-current` en la que está. Una página por ficha no
  aporta nada (ADR 0040 §5).
- **El menú de secciones** es propiedad de la página que se dibuja, donde antes era la de la portada
  estuvieras donde estuvieras. **Así toda ancla es local**, y `./index.html#sec-x` — una forma que
  existía solo porque una tira tenía que servir a todas las páginas — desaparece de la salida
  publicada.

Tres reglas que la división sacó a la luz: **la sección que lleva el `<h1>` no presta ancla** (sin
ella, una página convertida de una sola sección publicaría una tira con un enlace cuyas palabras son
su propio titular y cuyo destino es el principio de la página que estás leyendo), `headings.ts` es
nuevo y es el único sitio que decide cuál es esa sección; **dos avances a la misma página dan una
entrada**; y **el umbral cuenta los dos menús juntos**, porque tres *por menú* es una regla que
ningún sitio real sobrevive — el único fixture multipágina del corpus tiene dos páginas y una
sección con título.

En estrecho se conserva **un solo `<details>`** con las dos listas dentro: dos desplegables apilados
pondrían dos filas de cromo encima del contenido en un teléfono de 390 antes de la primera palabra
del sitio. La matriz de accesibilidad cambió su aserción de «exactamente un punto de navegación» a
**la identidad** «los mismos puntos a los dos anchos, cada nombre una vez, un solo desplegable»,
que es más fuerte que contar hasta uno.

**Lo que se entrega a cambio, escrito y no descubierto después:** convertir una sección deja de ser
invisible para el visitante, porque su entrada se muda de una tira a la otra; hay dos puntos de
referencia de navegación donde el ADR 0023 decidió que habría exactamente uno; y **diverge del
dossier §6**, que describe un menú reflejando las dos cosas. Por esa divergencia el ADR 0043 necesita
la firma de David y no el juicio de desarrollo.

### El documento sabe qué sale en el menú (día 3, PR #258)

`inMenu?: boolean` en **secciones** y en **páginas**, opcional en las dos, en una sola migración.
Ausente significa que aparece, que es lo que significaba antes de que la clave existiera: por eso
ningún documento guardado cambió y **ningún golden se movió**, que es a su vez la comprobación de
que el campo es de verdad opcional. `SCHEMA_VERSION` 1.9.0 → **1.10.0** con la migración `0011` y
sus cuatro preguntas de ida y vuelta.

**Que la clave esté presente es el registro de que alguien decidió, sea cual sea su valor.**
`inMenu: true` no es redundante con la ausencia: dice «he mirado esto y lo quiero», que es un hecho
distinto de «nadie lo ha mirado». Eso es lo que lee el umbral del día 4, así que los verbos escriben
el booleano y nunca borran la clave. `setPageInMenu` se niega en las dos páginas que no tienen
entrada que gobernar — la de inicio, que es «Inicio», y una dibujada por ficha — igual que `movePage`
se niega con la primera página.

**La prueba que David pidió al aprobar**, y la línea de la que va todo esto: `inMenu: false` no
cambia el id de la sección y no hace que `listDeadDestinations` marque como roto un enlace que apunte
a ella. Una sección fuera del menú sigue en la página, sigue respondiendo a su ancla y sigue siendo
un destino vivo, así que la descarga no se niega. Saboteada apuntando el enlace a un ancla
inexistente.

El interruptor vive en los campos de la sección, en bloque aparte encima de ellos porque no es un
campo, y **enseña las palabras que el menú usaría**: «En el menú se lee «Dónde estamos», que es su
título». Un menú que se escribe solo es lo único cuyo texto el dueño no puede ver en ningún otro
sitio.

### Las páginas obedecen, y el umbral se aparta (día 4, PR #259)

`hasMenu` pasa a ser tres preguntas en un orden, y el orden es la decisión: **sin destinos no hay
menú**, lo haya decidido quien lo haya decidido; **curado, uno basta**; si no, **el umbral de tres**
intacto desde el ADR 0023, que es lo que mantiene idéntica la respuesta para todo documento que nadie
ha tocado. «Tocado» se lee de la **presencia** de la clave en cualquier página o sección del sitio,
no de su valor, así que apagar un interruptor y volver a encenderlo deja el documento curado: un menú
que desapareciera justo cuando alguien deshace su propia decisión se leería como que el editor ha
perdido su trabajo.

**El suelo de dos páginas visibles no necesitó aritmética.** En la portada la tira de páginas son
exactamente las otras páginas visibles, así que con una sola queda vacía y no se dibuja; fuera de la
portada «Inicio» siempre está, y «Inicio» lleva a donde el visitante no está — así es como una página
por ficha, y una página que el dueño quitó del menú, conservan su camino de vuelta. **La única tira
que el suelo prohibía no se puede construir**, porque necesitaría que la portada apareciera entre sus
propias entradas. La frase del ADR 0043 §5 se reescribió ahí: leída al pie de la letra quitaba
«Inicio» justo de las páginas de las que es el único camino de vuelta. La decisión no cambió.

**La cuenta en voz alta**, desde un solo objeto (`menuState.ts`) que leen los dos paneles, con cada
número preguntado al renderizador. Dice cuántas secciones le quedan a esta página, cuántas páginas le
quedan al menú, y —solo cuando hay algo que decir— que todavía no se muestra, que no habrá ninguno, o
**que es corto porque lo ha decidido el dueño**. La prueba que sujeta la promesa compara lo que el
editor afirma con el HTML publicado en cinco documentos y en las dos polaridades: un editor con su
propia copia de una regla de tres cláusulas seguiría prometiendo un menú después de que el
renderizador dejara de dibujarlo.

**Convertir se lleva la respuesta; deshacer la conversión no la reparte.** `sectionToPage` sella la
respuesta de la sección en la página que crea, para que un destino podado no reaparezca como página.
La dirección contraria no tiene equivalente honesto: una página contiene cualquier número de
secciones, así que una sola respuesta no se puede repartir entre ellas sin esconder secciones que
nadie decidió esconder. Lo que vuelve dice lo que diga cada sección.

### El cierre: el teclado sobre los dos menús, y una laguna de axe (día 5)

**Los dos menús publicados, con teclado y nada más.** Cuatro pruebas en Chromium real sobre el
fixture de tres páginas: el orden de tabulación recorre las páginas y después las secciones de esta
página; **la copia que el ancho no pide no está en el orden de tabulación**; el `<details>` del
teléfono se abre con Enter y da los mismos destinos; y un sitio curado ofrece su único destino y nada
más. La segunda es la que necesita un navegador: una copia oculta cuyos enlaces siguieran siendo
enfocables daría a quien navega con teclado una ristra de paradas invisibles antes de la primera
palabra del sitio, y se vería perfecta en el marcado y en cualquier snapshot. Sustituido `display:
none` por «invisible pero presente», **tres de las cuatro caen**.

**Y una laguna que el cierre encontró:** el recorrido móvil audita con axe el editor y la hoja de
«Estilo» a 390, pero **nunca abre los dos paneles que este sprint cambió**. La portada no presta
entrada al menú, así que su cajón de campos no dibuja el interruptor; y en un documento de una sola
página la fila de «Páginas» no tiene casilla. Los dos se auditan ahora dentro de la caminata del día
4, que sí ha convertido una sección.

**El hallazgo del día es un error de medición mío, y deja algo sabido.** La primera versión de esa
auditoría esperaba a que el panel dejara de moverse, y axe lo midió a **0,90 de opacidad**: reportó
tres fallos serios de contraste contra colores que no están en ninguna hoja de estilos —`#6a788d`,
`#df3a3a` y `#2a7ce9`, que son `--ui-muted`, `--ui-danger` y `--ui-brand` mezclados con el blanco de
debajo. En reposo esos tres miden **5,43**, **4,83** y **4,71** contra el panel y pasan; a 0,90 miden
4,38, 4,30 y 4,03 y no. El fallo era mío, pero **dos de los tres pasan 4,5 por un pelo**, y cualquier
opacidad sobre ellos los hunde — fila del backlog. Y `axeSerious` imprime desde hoy la razón medida y
los dos colores, como la matriz del renderizador hace desde el sprint 4: el primer movimiento no debe
volver a ser calcular ratios a mano para adivinar qué fondo usó axe.

**Las medidas que deja el sprint:**

| | |
|---|---|
| Sitio publicado de tres páginas con los dos menús | **2,9 KB** por página, presupuesto 88 KB |
| El mismo sitio curado a un destino | 2,8 KB por página |
| Las tres composiciones de muestra | 3,1–3,2 KB por página, presupuesto 60 KB |
| Lighthouse móvil, sitio publicado v1 / v2 / v3 | rendimiento **100 / 99 / 99**, accesibilidad **100** en los tres |
| LCP y CLS de los tres | 1,65 s / 2,18 s / 2,18 s · **0,002 / 0,000 / 0,002** |
| Una página por ficha | 100 de rendimiento, LCP 0,90 s, CLS 0,000 |
| Landing móvil, hoy | rendimiento 0,70 · accesibilidad **1,00** · CLS **0,1565** · LCP 7,3 s |
| Landing móvil, antes del día 1 (`main`) | CLS 0,1442 — el héroe nuevo cuesta **+0,012** por enseñar el botón |
| El trabajo `e2e` de CI | 14m25s el día 3, **16m01s** el día 4, sobre un límite de 20 |

El CLS de la landing **no se ha movido desde el día 1** (0,1566 entonces, 0,1565 hoy), lo que
confirma que los días 2 a 4 no le hicieron nada, aunque el héroe muestre lo que el renderizador
emite. El LCP de 7,3 s es de esta máquina: `main` mide lo mismo, contra 2,8 s del sprint 22 en una
más tranquila.

**El SEO de la landing marca 0,54 y no es un defecto.** Las dos auditorías que caen son
`is-crawlable`, que es el `<meta name="robots" content="noindex, nofollow">` que `layout.tsx` pone
**a propósito** y con su razón escrita — la URL de despliegue es pública y enseña un producto a medio
hacer con el nombre de Retorika —, y `link-text` por el enlace «Empezar», que la lista de textos
genéricos de Lighthouse trae en español. Lo segundo solo importa el día que la página se indexe, y
cambiar ese texto es una decisión de copia sobre la puerta de entrada pública: fila del backlog, no
un arreglo de hoy.

### Lo que este sprint deja a David

**Dos firmas.** El **ADR 0043** está `proposed` y las necesita porque diverge de dos documentos
aprobados: el dossier §6, que describe un menú reflejando secciones **y** páginas, y el ADR 0023, que
decidió «exactamente un punto de navegación a cada ancho». El día 4 reescribió además la frase del
suelo de su §5 —sin cambiar la decisión— y añadió la regla del pliegue; las dos cosas están marcadas
en el propio ADR. Y el **ADR 0042** del sprint 21 sigue sin firmar.

**Una decisión que sigue siendo suya, con el número delante:** la demostración automática del héroe
cuesta 0,145 de CLS y unos siete puntos de rendimiento en Lighthouse móvil sobre la landing.
Quitarla y dejar el botón los recupera, con el viaje intacto al pulsar.

**Y lo de antes, que no se ha movido:** la lista del iPhone de verdad del sprint 21, y los 7,9 px que
el campo se desplaza al filtrar sectores.

## Sprint 24 — «La letra se elige, el elemento se arrastra y el panel no tapa» (17 a 19 de octubre de 2026)

David, tras fusionar el cierre del sprint 23, con cinco peticiones — tres pequeñas y dos grandes:

> «1. Elimina el texto «Las webs de negocios suelen identificar a su titular. Si tienes dudas,
> consúltalo con tu gestoría.».
>
> 2. Cuando en el editor dentro de una sección hago clic en el botón «Campos» se abre un menu/panel
> en el lado derecho del editor que oculta parte de la seccion a editar. Quiero que el menu/panel
> desplegado tras pulsar «campos» siga la misma logica que todas las herramientas de diseño
> avanzadas y no oculte elementos que van a ser editados.
>
> 3. La maqueta dentro de la landing page que aparece en el lado derecho cuando se visualiza la
> landing desde el pc está demasiado arriba y descompensa la landing. Busca que los textos y la
> maqueta este compensado para que todos los elementos se vean de un pantallazo y la landing page
> quede compensada y balanceada. La landing page visualizada desde el movil se ve genial.
>
> 4. En el editor dentro de una sección quiero poder mover cualquier elemnto visual arrastrando con
> el raton sin asas para ajustar su posicion en la pagina.
>
> 5. Quiero poder seleccionar la fuente de letra exacta para la página y/o cualquier texto (ten en
> cuenta que la fuente es uno de los elementos visuales mas importantes del branding corporativo).»

**Las cinco causas, localizadas en el código antes de planificar.** Ninguna se dedujo:

1. **El texto tenía un ADR firmado por el CEO y su redacción *era* la decisión.** El
   [ADR 0019](../decisions/0019-the-footer-offers-the-owners-details.md) dice literalmente «its
   wording **is part of this decision, not a detail of the implementation**» y cita la frase entera.
   Ninguna prueba la aseveraba, y el propio ADR nombraba su reapertura: «the warning's wording is the
   first thing to change».
2. **«Campos» era el único panel que no estaba en la fila.** `EditorShell` hace sitio con flexbox y
   el lienzo se reescala solo; `FieldsPanel` se dibujaba dentro de la tarjeta y era `position: fixed`.
   Y su razón escrita ya no se sostenía: decía que dentro de la tarjeta la página quedaría «a sliver
   wide», cierto de la *tarjeta* y no de la *fila* — `SharePanel` había hecho esa misma mudanza.
3. **La maqueta estaba alta por una línea.** `items-center` y ninguna de las dos columnas declarando
   `align-self`: la de la maqueta medía unos **547 px** contra unos **420** de la de texto, así que su
   borde superior quedaba unos **65 px** por encima del titular.
4. **La rejilla existía y el arrastre no.** `placementSchema` son cuatro enteros, `grid.columns` es
   `z.literal(12)` y `placementStyle` emite solo `grid-column`/`grid-row`: **un píxel libre es un
   error de compilación, no un caso no soportado**. Faltaban dos piezas: el lienzo no sabía elegir un
   elemento, y **todo texto era `contentEditable` de forma permanente**.
5. **La tipografía tenía medio camino hecho y el dossier aprobado prometía el otro medio.** Tres
   parejas nombradas por carácter, nunca por fuente, porque la fuente podía no llegarle al visitante;
   `SHIPPABLE_FAMILIES` era una tabla cerrada de **dos** familias.

**Las cuatro decisiones de David, el 17 de octubre.** Entre opciones puestas delante:

1. **Las cinco cosas en un solo sprint.**
2. **Una galería de fuentes que enviamos**, elegidas por su nombre real, titulares y texto por
   separado, y viajando solo las que la web usa.
3. **Arrastrar con imán a la rejilla**, sin asas y sin tocar la regla 4.
4. **Igualar las alturas** de las dos columnas de la landing.

**Y catorce correcciones al plan, en dos revisiones.** Todas en el producto final:

| | Corrección | Dónde acabó |
|---|---|---|
| 1 | El umbral de 3 px no separa mover de editar: define dos estados explícitos | [ADR 0047](../decisions/0047-a-text-is-chosen-before-it-is-written-in.md) |
| 2 | `preventDefault` en `dragstart` sobre imágenes y enlaces del lienzo | ADR 0048 §2 |
| 3 | Colisiones y límites decididos en el ADR, no descubiertos luego | ADR 0048 §3–§4 |
| 4 | `touch-action: none` solo sobre el elemento elegido, con el lienzo desplazándose con un dedo | [ADR 0049](../decisions/0049-the-arrows-move-it-and-say-so-and-one-finger-still-scrolls.md) §6 |
| 5 | WCAG 2.5.7 citado, y cada movimiento por teclado anunciado | ADR 0048 §7, ADR 0049 §3 |
| 6 | No tapar no basta: la sección editada sigue a la vista tras abrir y cerrar «Campos» | día 3 |
| 7 | «De un pantallazo» es una restricción de pliegue, no de alturas iguales | día 2 |
| 8 | La PR del día 1 espera firma; su entrada en este archivo se escribe al cierre | esta entrada |
| 9 | El anuncio y el foco tienen que sobrevivir al `srcDoc`: región en el documento padre | ADR 0049 §3 |
| 10 | Tres flechas, tres movimientos, sin volver a elegir | día 9, y encontró un defecto |
| 11 | Definición exacta de «ocupada», con dos pruebas unitarias | ADR 0048 §3 |
| 12 | Dos mitigaciones para los dos estados: segundo clic y pista visible | ADR 0047 §3 |
| 13 | Tolerancia ±24 px, no igualdad, y el suelo manda | día 2 |
| 14 | El `contentEditable` va en su propia PR, antes del arrastre | día 7 (PR #270) |

Y tres decisiones que tomó al revisar, no en la PR: **colisión al soltar: rechaza y vuelve**;
**tercera ranura `font.accent`: no**; **la palabra «opcional» junto a los campos del pie: sí**.

### El aviso del titular se va, y el ADR 0044 dice por qué (día 1, PRs #261 y #262)

La clave `editor.footerIdentity` y su único lector fuera, con `footerNeedsIdentity` y el import de
`FOOTER_IDENTITY_SLOTS` que quedaban muertos. Los tres campos del pie ganan «(opcional)» en
`packages/catalog`, decidido por él: no afirma nada sobre la ley y mantiene explicables tres campos
que se quedan sin la única frase del producto que decía por qué existen.

El **[ADR 0044](../decisions/0044-the-editor-stops-advising-about-the-owners-identity.md)** enmienda
al 0019 y **nombra el contexto que acepta con su artículo**: el art. 10 de la LSSI-CE obliga al
prestador a mostrar nombre, NIF y domicilio. Los campos siguen ofrecidos y opcionales; lo que
desaparece es que el producto lo recuerde, y **ese riesgo pasa al cliente**. Está firmado por David,
**no por el CEO**, y así está escrito en el propio ADR.

**Y un defecto de contraste de catorce sprints, encontrado de paso** (PR #261): `.rb-toolbar-caption`
y `.rb-hole-fate` pintaban `#94A3B8` sobre blanco — **2,8:1**, bajo el 4,5 de la WCAG 1.4.3 — en
textos del cromo que nadie había medido porque los grises de la maqueta se habían copiado como
colores de texto. Ahora son `#5B6B82` (4,9:1) y la guarda es una **negativa**: los grises de la
maqueta no pueden usarse como color de texto en ninguna parte de la hoja inyectada.

### Las dos columnas de la landing caben en una pantalla (día 2, PRs #263 y #264)

`HERO_COLUMN_MAX = 420` y el reparto `studio:grid-cols-[minmax(0,1fr)_minmax(0,420px)]` con
`items-start`: los dos topes alineados y la columna de la maqueta con el **suelo de legibilidad
medido** — por debajo de 420 px de marco, el estado de móvil cae de 128 px y deja de leerse como un
teléfono. La aserción que manda es **el pliegue**: el fondo de las dos columnas dentro de la ventana
a 1280×720, 1440×900 y 1680×1050. La tolerancia de ±24 px que él fijó antes de empezar evitó una
parada inútil: en el suelo la diferencia son veinte píxeles invisibles.

**Y una prueba que pasaba bajo sabotaje**: la primera versión pedía `studio:items-start` «en algún
sitio del fichero», y el bloque de secciones de debajo lleva la misma clase. Se asevera el fragmento
entero de la rejilla, y cada mitad se saboteó por separado.

### «Campos» se pone al lado, y la sección no se va de la vista (día 3, PR #265)

`FieldsPanel` deja de ser `position: fixed` dentro de la tarjeta y pasa al hueco `panel` de
`EditorShell`, como los otros seis: el lienzo se encoge y se escala solo, **sin geometría nueva**. De
paso desaparece un peligro latente — `canvas-card` lleva `transform: scale()` y un ancestro
transformado es el bloque contenedor de un `fixed`, así que el panel se escalaba con la tarjeta por
debajo de 721 px — y el botón «Enlace» de la barra de texto pasa por `showFields`, que es la regla de
«una sola superficie».

**Lo que este día enseñó sobre medir:** «la sección no se mueve al abrir el panel» era cierto en
macOS (0 px) y falso en el Linux de CI (174 px). `overflow-anchor` vale `auto` por defecto y el
anclaje de desplazamiento de Chromium absorbe el crecimiento de arriba en una plataforma y no en la
otra. La aserción se retiró y quedó la que importa: **la sección editada sigue visible** tras abrir
y tras cerrar, a 1024, 1280 y 1600. Un número que sale del comportamiento del navegador y no de
nuestro código no se asevera hasta verlo dos veces.

### La licencia de Playfair Display, en cuestión y resuelta (día 4, PRs #266 y #267)

El plan puso una verificación antes de la galería: si los ficheros `*-latin-*.woff2` de `@fontsource`
son subconjuntos, el razonamiento que permitía enviar Playfair Display no se sostiene. **Lo estaba**,
y por una razón que el comentario del repositorio no veía: «unmodified» ahí significaba que *nosotros*
no alteramos el fichero del paquete, y la prueba de la licencia es contra la **Original Version**. El
paquete declara cuatro subconjuntos y la cara 400 completa **son cuatro ficheros**; enviamos uno, en
woff2. OFL 1.1 llama Modified Version a «adding to, deleting… **by changing formats**», y su §3
prohíbe el nombre reservado en una Modified Version sin permiso escrito.

Con los dos costes medidos delante, David eligió **sustituirla por una serif sin nombre reservado** y
**migrar los temas que ya existen**:
[ADR 0045](../decisions/0045-the-serif-this-product-ships-reserves-no-name.md), EB Garamond, migración
`0012` y `SCHEMA_VERSION` 1.11.0. La corrección que hizo falta por el camino: **dije que no había
migración y era falso** — el tema guarda la pila resuelta, así que los documentos existentes nombran
Playfair y dejarían de enviar una cara. Y busqué «Reserved Font Name» en el **cuerpo** de la licencia,
que lo contiene siempre en su propio §3; la declaración está en la línea de copyright y en ningún otro
sitio.

### La galería: ocho familias que viajan (día 5, PR #268)

[ADR 0046](../decisions/0046-the-gallery-ships-the-faces-so-the-letter-can-be-named.md): una familia
se elige **por su nombre real porque la enviamos**. `SHIPPABLE_FAMILIES` pasa de dos filas a ocho,
alfabéticas, cada una en su woff2 latino a 400 y 700 con su OFL al lado. Cuatro filtros, leídos del
`metadata.json` de cada paquete: OFL 1.1, **sin Reserved Font Name**, latino con 400 y 700 reales, y
un nombre que encaje en el patrón que `escape.ts` admite. Los dos pesos son obligatorios, y el coste
está dicho: **la galería no tiene ninguna display**.

**El presupuesto de peso se parte en dos, con los dos números medidos en gzip**: 115 KB de caras en su
propia línea —la peor pareja posible es EB Garamond + Inter, **98,7 KB** con las dos licencias— y
20 KB para lo demás que escribimos, donde el paquete más gordo mide 7,1 KB. Los 80 KB antiguos no
podían disparar nunca.

**Y el medio megabyte generado se midió**: `fontData.ts` pasa de 139,7 KB a 456,6, y el servidor de
descarga arranca igual — «Ready in» 55-58 ms en tres arranques por estado, misma respuesta caliente,
632 KB más en la salida compilada. En el ZIP del cliente, nada.

### El editor elige la letra (día 6, PR #269)

El grupo «LETRA» gana, bajo las tres parejas, la galería plegada: las ocho familias por su nombre, dos
elecciones separadas —TITULARES y TEXTO— y cada especimen dibujado **en la cara que el ZIP va a
llevar**, servida por la ruta `fonts/[file]` y pedida al abrir el grupo. `packages/tokens` gana
`withFamily` (escribe **una** clave) e `identifyFamily` (deduce la marca de la primera familia de la
pila). Donde una pareja ya nombra una familia primero, la pila de la galería **es la de esa pareja**,
para que elegir la letra que ya tienes no borre la marca de la pareja.

La barra flotante nombra la familia en el **nombre accesible** y conserva la palabra del papel en el
botón: «Letra — Titular (Libre Baskerville)». Una barra dentro de una sección tiene el ancho que la
sección le da.

**Tres cosas que solo dijo el navegador:** el editor ya carga Inter por su propia interfaz, así que
`document.fonts` nunca está vacío y la pereza hay que medirla por las peticiones a la ruta;
`document.fonts.check` responde «¿se puede dibujar esto?» y devuelve `true` para una familia no
declarada; y el lema de la portada se compone con la letra de los **titulares**, así que la del texto
se lee en `body`.

### Un texto se elige antes de escribir en él (día 7, PR #270)

`contentEditable` deja de ser permanente, y por petición suya fue en su propia PR antes del arrastre.
Dos estados: **elegido** (un clic, o Tab) y **escribiendo** (segundo clic, doble clic, o Intro). Las
cuatro cosas que el atributo hacía en silencio quedan repartidas a mano, y la segunda es la que nada
habría puesto en rojo: **el `tabindex` que mantiene la parada de tabulación** sin la cual «escribir sin
ratón» habría dejado de funcionar.

**Cuatro defectos de orden de eventos**, todos del navegador: el foco llega en `mousedown`, antes del
clic, así que todo primer clic parecía el segundo; entrar a escribir con el foco ya puesto no dispara
`focus`, donde vivían la captura y el seleccionar-todo; quitar `contenteditable` tira el foco al body
y el `blur` resultante volvía a marcar «elegido»; y la acción por defecto del clic coloca el cursor
**después** de los manejadores, así que el seleccionar-todo se perdía — medido como un titular que
acabó leyendo `UNODOSTCUATRORESCINCO`.

**48 sitios de caminata reescritos a mano**, y la instrucción del editor cambió con el comportamiento:
«Haz **doble clic** en cualquier texto para cambiarlo».

### El primer arrastre sobre el documento (día 8, PR #271)

[ADR 0048](../decisions/0048-the-first-drag-puts-an-element-in-the-grids-nearest-cell.md): se suelta
donde sea y cae en la columna y la fila **más cercanas**, porque él eligió imán. De aquí no sale
ninguna coordenada, así que **la regla 4 no se enmienda ni se puede enmendar desde aquí**. «Ocupada»
tiene su definición exacta —el rectángulo completo, excluyendo al propio elemento— **dentro** de
`dropAt`, para que la exclusión no se pueda olvidar, con las dos pruebas unitarias que pidió.

Rechazar y volver es una regla **de interfaz**, más estricta que el documento, y lo dice: apilar a
propósito sigue en los cuatro botones de «Colocación», que además son la alternativa de un solo
puntero de la WCAG 2.5.7. El fantasma enseña el resultado antes de soltar, también cuando se rechaza,
y **el elemento no viaja bajo el puntero**: el ancho con el que se dibuja un elemento *es* el de su
tramo de columnas, así que uno arrastrado se vería con el tamaño que tiene y no con el que tendría.

**Y el defecto que solo vio la suite entera**: abrir la oferta de «diseñar a mano» en `pointerdown`
rompía la edición — en una sección del catálogo un clic simple la abría y se comía el clic, así que con
las herramientas encendidas no se podía escribir en ningún texto. Siete caminatas en rojo desde seis
sitios. La oferta se abre ahora pasado el umbral, en `pointermove`.

### El teclado lo mueve y lo dice, y el dedo no bloquea el lienzo (día 9, PR #272)

ADR 0049: las flechas mueven el elemento elegido una celda por pulsación y **Mayús+flecha** lo
ensancha o lo estrecha, lo que enmienda el §1 del 0047 **solo en el estado «elegido»**, donde no hay
cursor. Un solo rechazo para la mano y el teclado. El anuncio vive en el documento del editor —su
corrección— y dice «Columna 3 de 12, fila 2», con un contador que hace audible la misma frase dos
veces. En táctil, `touch-action: none` **solo** sobre el elemento elegido, y la caminata mide que un
dedo sigue desplazando el lienzo. En la vista de móvil el mismo gesto **reordena**, porque la regla 7
solo admite ocultar, reordenar y estrechar.

**Su aserción de las tres flechas hizo exactamente su trabajo:** la restauración del día 7 borraba la
elección de todo lo que no fuera texto —leía `EDITABLE_TAGS`, escrito cuando solo un texto podía estar
elegido—, así que la primera flecha movía la foto y la reconstrucción la desElegía: **tres pulsaciones,
un movimiento**. Con una sola habría pasado en verde. Y dos más: `device` quedaba congelado en el
cierre de los oyentes —cambiar a móvil no reconstruye el documento, así que las doce bandas se
dibujaban sobre una página de una columna— y **Escape no liberaba una imagen**.

**Lo que cuesta, dicho en el ADR:** una pulsación que llega mientras el marco se reconstruye se
pierde, así que mantener la flecha pulsada no pasea el elemento. Es la arquitectura del ADR 0001
asomando.

### El cierre (día 10, PR #273)

- **axe a 390** sobre la landing, el paso 2, las propuestas, el editor en vista de móvil, «Estilo»,
  «Campos» y —nuevo— **«Estilo» con la galería desplegada**: dieciséis filas que la pasada anterior no
  veía, porque están plegadas por defecto.
- **Una segunda caminata sin ratón**, con sus propias marcas: elegir una letra por su nombre y mover un
  elemento de celda en celda. `keyboardOnly.test.ts` guarda ahora **todas** las regiones marcadas, no
  una: bolt-on sobre la caminata del sprint 17 habría movido todas las cuentas de Tab que mide desde
  entonces.
- **Y una trampa del teclado, medida y anotada**: el `tabindex` rotatorio lo mueve el `focusin` de los
  hijos de una sección, así que en cuanto el foco entra en un texto la sección pasa a ser la única
  parada… y Tab ya la ha pasado. Hacia delante no se vuelve a alcanzar; **se alcanza con Mayús+Tab
  desde dentro**. Sesenta pulsaciones de `keyboardTo` no encontraban nada, y seiscientas tampoco.
  Está en el backlog, al lado de la pregunta a la que pertenece.

### Lo que este sprint deja a David

**Cinco firmas**, todas `proposed`: **0045** (la serif sin nombre reservado, que él decidió en dos
respuestas), **0046** (la galería), **0047** (los dos estados), **0048** (el arrastre) y **0049** (el
teclado y el táctil). El **0044** está firmado por él ~~y **necesita la del CEO**, porque enmienda un ADR
que el CEO firmó~~ — corregido el 25 de octubre de 2026, al cerrar el sprint 27: **el 0044 está
`accepted` por David el 18 de octubre, no por el CEO**, como dice su propia cabecera; el CEO no lo ha
visto. Y siguen sin firmar el **0042** del sprint 21 y el **0043** del sprint 23.

**Una pregunta abierta que él declinó como remedio pero no como petición:** pedir a los autores de
Playfair Display el permiso escrito que su §3 contempla. No cuesta bytes y devolvería la familia como
una fila más de la galería.

**Y lo medido sin arreglar**, en el backlog con su número: el desplazamiento de 164 px al cerrar un
panel (dependiente de plataforma, dos reparaciones medidas peores), los 7,9 px del filtro de sectores,
los dos colores de marca que pasan el 4,5:1 por los pelos, la pulsación perdida mientras el marco se
reconstruye, y la pregunta del Tab dentro de una sección, que hoy lleva una parada más por cada
elemento colocado.

## Sprint 25 — «Se queda donde se suelta» (20 y 21 de octubre de 2026)

David, tras fusionar el cierre del sprint 24, con una sola petición — grande, y una corrección del
arrastre que ese mismo sprint acababa de entregar:

> «No me convence el arrastre de los elementos visuales mediante rejilla. Quiero que al arrastrar un
> elemento visual este **se quede en la posición donde se deja** (parecido a lo que ocurre al arrastrar
> la barra flotante o los iconos dentro de la sección pero sin asa). Quiero además que las cajas que
> limitan el tamaño del objeto visual (el recuadro azul) sea **ajustable al arrastrar los bordes** bien
> para agrandarlo o bien para reducirlo (parecido a como funcionan los cuadros de texto insertados en
> un documento de Word). Me parece que lo más estándar es un clic de ratón mantenido pulsado sobre el
> elemento arrastra, doble clic permite editar el contenido/escribir y el hacer clic mantenido/pulsado
> en el borde altera el tamaño del recuadro del elemento visual. […] buscamos con el proyecto que todas
> estas ediciones sean **instintivas** (familiar para usuarios de aplicaciones tipo Canva y Word).»

**Lo que choca, dicho antes de diseñar y no después.** La regla 4 —«las posiciones son relativas a la
rejilla de la sección, nunca absolutas»— viene del dossier aprobado (Módulo Avanzado §6) y ya se había
probado dos veces contra dueños reales, Conchi el 27 de septiembre y el dueño del taller el 30; las
dos veces se mantuvo. La propia regla manda un ADR antes de código a la siguiente petición. **Esta
era la tercera, y la hizo el dueño del producto.** Y lo segundo que choca no es una regla sino una
diferencia de medio: **Canva y Word tienen un lienzo fijo y una sección web no** — su ancho es el del
visitante y su alto el de su contenido. «Se queda donde se suelta» es por tanto una decisión sobre
**qué se publica**, no sobre la interfaz, así que se le pusieron tres modelos delante con su coste.

**Las tres decisiones de David, el 20 de octubre:**

1. **Rejilla fina, mano libre.** El elemento sigue la mano y se queda donde se suelta con un ajuste
   imperceptible; los bordes estiran; **la regla 4 no se enmienda: se afina.** No al lienzo fijo tipo
   Canva, cuyo coste estaba delante — texto que se desborda en otra pantalla, una enmienda del dossier,
   una migración total y dos sprints.
2. **Guías de alineación**: el elemento se imanta a los bordes y los centros de sus vecinos, y al
   centro de la sección.
3. **Gestos**: clic mantenido y mover arrastra **sin tener que elegir antes**; clic suelto elige; doble
   clic —o un segundo clic sobre el ya elegido— escribe; **el borde redimensiona también mientras se
   escribe**, como en Word; el cursor cambia en una zona de ±6 px «para que se descubra sin
   explicación»; Esc sale.

Y dos más, el mismo día, cada una con sus condiciones: **los solapes se permiten** (enmienda del §4 del
ADR 0048 — con un paso de ocho píxeles casi cualquier celda toca a otra, y el documento ya apila), con
el orden del documento como apilado, **el aviso de texto sobre texto** y **el móvil sin heredar el
solape**; y **las flechas en unidades** (enmienda del §1 del ADR 0049), con la carrera de pulsaciones
como un solo paso del historial y el anuncio en píxeles.

### Las cuatro condiciones, respondidas con medidas

**1. El paso.** La condición era que el ajuste no se vea. El lienzo del editor no mide 960:
`layoutWidth = max(available, 721)`, y `available` es la ventana menos el raíl de 80 px y los márgenes
de la fila. Medido en Chromium el día 1, con el margen de la fila bajando de `px-24` a `px-6` al abrir
un panel:

| Dónde | Sección | Útil | Paso con 12 | **con 96** | con 48 |
|---|---|---|---|---|---|
| Editor, ventana 1440, sin panel | 1168 | 896 | 74,7 + 16 | **9,3 px** | 18,7 |
| Editor, ventana 1440, panel de 340 abierto | **948** | 676 | 56,3 + 16 | **7,0 px** | 14,1 |
| Publicada a 1280 | 1280 | 1008 | 84,0 + 16 | 10,5 | 21,0 |
| Publicada a 1440 | 1440 | 1168 | 97,3 + 16 | 12,2 | 24,3 |
| Publicada a 1920 | 1920 | 1648 | 137,3 + 16 | 17,2 | 34,3 |

Con las otras dos escalas, a 1440 y sin panel: `compact` 10,1 px, `generous` 7,9 px. **Son 96
unidades**: siete a diez píxeles donde se arrastra. Cuarenta y ocho darían catorce a diecinueve, y eso
se ve. En la página publicada el paso crece con el ancho porque la unidad es proporcional, y ahí nadie
arrastra. La fila es de **8 px fijos** y no derivada del paso horizontal, porque derivarla necesita
`vw` —que arrastra la barra de desplazamiento, 16 px de deriva por cada 100 filas— o una altura
definida, que una sección no tiene.

**2. Los huecos se conservan exactos, y el documento no los ve.** Una rejilla de 96 con `gap` no
conserva el gutter del catálogo: tendría 95 huecos donde el catálogo tiene 11. La sección libre declara
**107 pistas** —96 de contenido y los once gutters como pistas propias— con `column-gap: 0`, y como
`repeat()` no se anida en CSS Grid la lista es
`repeat(11, minmax(0, 1fr) ×8 var(--space-md))` más ocho `minmax(0, 1fr)` — y es `minmax(0, 1fr)`
y no `1fr` por el ajuste 2 de David, porque `1fr` es `minmax(auto, 1fr)` y una palabra larga
inflaría las pistas que cruza. Unos 110 bytes, emitidos una vez y solo si el documento
tiene alguna sección libre. **El documento guarda unidades 1..96 y nunca nombra un gutter**; la
traducción vive en una sola función de `packages/schema` (`fineGrid.ts`) que importan el renderizador,
el editor y el `placedIn` de las caminatas, para que html, dom y pruebas no puedan discrepar. Las
secciones del catálogo siguen en doce y el parche móvil sigue en doceavos.

**3. La vertical.** `grid-auto-rows: minmax(8px, auto)`, `row-gap: 0`, `align-items: start`: soltar
30 px más abajo mueve cuatro filas, siempre, y un texto que no cabe hace crecer sus filas y empuja lo
de debajo en vez de recortarse. **La migración no toca `row` ni `rowSpan`** —una fila con contenido
mide lo mismo bajo `auto` que bajo `minmax(8px, auto)`—; lo único que cambia en una sección libre ya
guardada es `center → start`, y eso **sí mueve**: un titular centrado sube 27 px en
`cover-and-services` y el alto sobrante de una foto que abarca varias filas se reparte entre las filas
de hueco. Es el coste, mueve los dos goldens y el ADR 0050 §3 lo nombra en vez de aseverar lo
contrario. Desde el día 2 **escalar mide la página viva** elemento a elemento en vez de derivar las
filas del ritmo del tema, con el ritmo como reserva por elemento.

**4. Asas solo sobre el elemento elegido, en táctil.** Cuatro esquinas y cuatro bordes, objetivos de
44 px —el número de la WCAG 2.5.5 y el de las dos plataformas—, **solo** sobre el elemento ya elegido y
solo donde el navegador contesta `(pointer: coarse)`. Con ratón no hay asas: la zona de ±6 px y el
cursor. Los cuatro steppers de «Colocación» siguen siendo la alternativa de un solo puntero y el camino
del teclado (WCAG 2.5.7), en unidades finas desde el día 1.

### Ocho ajustes suyos al aprobar el plan, todos en el producto final

| | Ajuste | Dónde acabó |
|---|---|---|
| 1 | La fila no es `y/8`: `rowAt` lee las pistas resueltas, el anuncio se calcula de la caja medida, y editar un texto reajusta su `rowSpan` | días 4, 6 y 7 |
| 2 | `minmax(0, 1fr)` en las 96 unidades — `1fr` es `minmax(auto, 1fr)` y una palabra larga inflaría las pistas que cruza | día 1 |
| 3 | Los umbrales en píxeles de pantalla se dividen por el zoom del lienzo (arrastre, borde, guía) | días 3 a 6 |
| 4 | El override móvil devuelve también `grid-row: auto`, el `row-gap` del tema y `grid-auto-rows: auto` | día 1 |
| 5 | `z-index` mientras dura el arrastre, porque un `transform` crea su propio contexto de apilamiento | día 3 |
| 6 | Asas: por debajo de un tamaño solo esquinas, y en el borde de la sección dibujadas hacia dentro | día 7 |
| 7 | La tabla del paso se mide en Chromium, no se calcula — y 948 con el panel abierto era correcto | día 1 |
| 8 | Zona del borde asimétrica mientras se escribe: 6 px por fuera y 2 por dentro | día 4 |

### La rejilla fina, entera en una sola PR (día 1, PR #274)

[ADR 0050](../decisions/0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md),
esquema 1.12.0 y migración 0013 **en la misma PR que el renderizador**, y eso fue un recorte del plan
hecho el primer día: el esquema en 96 y el renderizador en 12 no pueden fusionarse por separado porque
David redespliega cada día, y una sección libre guardada se publicaría con `grid-column: 9/span 48`
sobre doce pistas. El cambio de modelo va primero y solo, **entero**. El catálogo sigue declarando en
doce, `escalate` convierte ×8 exacto, y el arrastre del editor siguió imantando a doce hasta el día 3
a través de un `coarseBoundary.ts` que existía para ser borrado.

**La regla 4 no se enmienda**, y `docs/document-rules.md` gana su tercera nota bajo la regla: la tercera
petición la hizo el dueño del producto y la respuesta fue **afinar** la rejilla, no abandonarla.

### Escalar mide la página viva (día 2, PR #275)

`escalate(section, preset, gapRows, boxes?)` recibe la caja que cada elemento colocado tenía de verdad
y escribe `row = 1 + round(top/8)`, `rowSpan = ceil(alto/8)`. **El tramo redondea hacia arriba donde la
fila redondea al más cercano, y la asimetría es el punto**: un tramo cuatro píxeles corto hace crecer
sus filas por encima del mínimo y ese empujón se acumula hacia abajo, mientras una fila redondeada se
equivoca como mucho en media fila.

Tres defectos que encontró el navegador, los tres nombrados en la enmienda del ADR: **las cajas no
llegaban nunca** —`liveDoc()` dentro de cromo cableado antes de que su marco sea el visible contesta
con el otro documento, así que la medición volvía vacía y la escalada caía en silencio al ritmo del
tema—; **una tipografía que llega a mitad de la medición** movía el titular de la portada de 46 a 52
píxeles; y **«+ Añadir línea» se autocolocaba en el primer hueco libre a todo lo ancho**, que sobre
filas de ocho píxeles es un hueco *encima* de su propia lista. De ahí la regla que ya se puede escribir:
**el cromo dentro de una sección libre necesita una columna y una fila.**

### El elemento sigue la mano (día 3, PR #276)

Sin fantasma: mientras la mano lo sostiene viaja el elemento mismo, sobre un `transform` que es cromo y
nunca el documento, por la distancia que la mano recorrió, así que el agarre se queda donde se tomó. Al
soltar se escribe una sola colocación, en la unidad y la fila más cercanas a su propia esquina superior
izquierda: la caminata mide el aterrizaje a seis píxeles o menos de donde la mano soltó, que es media
unidad de lado y media fila de alto. **El fantasma del sprint 24 existía porque un imán de doce
columnas movía el elemento a otro sitio; con una unidad de nueve píxeles el elemento es la previa
honesta.**

**Y los solapes se permiten de la forma más fuerte de decirlo**: `dropAt` ya no recibe las demás
colocaciones de la sección y `arrowDrop` tampoco, así que ninguno de los dos *puede* rechazar por
ocupación — lo que el puntero puede soltar encima, el teclado puede pisarlo. Un clic mantenido arrastra
**esté elegido o no**: el movimiento es lo que distingue un arrastre de una selección de texto, así que
la precondición guardaba una ambigüedad ya resuelta cuando importaba.

### Los bordes estiran (día 4, PR #277)

Seis píxeles a cada lado del borde del elemento con el que la mano trabaja, y uno de los cuatro
cursores de la plataforma en esa zona. Cableado **en la sección y en fase de captura**, y las dos
mitades son el diseño: en la sección porque la zona llega *fuera* del elemento —un `pointermove` tres
píxeles más allá de un titular es un evento de la sección, y la primera versión, a nivel de elemento,
tenía la mitad exterior muerta—; en captura porque la pulsación tiene que ganarle a elegir, a escribir,
a cerrar un menú y a armar el arrastre.

La previa es el área de rejilla real del elemento, así que la rejilla refluye mientras la mano se mueve:
un texto reparte sus líneas otra vez y el área de una foto crece sin que la foto se estire.
Redimensionar un texto mientras se escribe en él **vuelca primero las palabras**, luego escribe la caja,
luego recoge la escritura: un gesto, dos actos, en el orden que no puede perder nada.

Chromium corrigió la aritmética una vez: **cada borde toma su propia lectura**, porque la unidad cuyo
borde izquierdo está más cerca y la unidad cuyo borde derecho está más cerca pueden estar a un gutter
de distancia. Una sola lectura para los dos dejaba dos columnas del catálogo en 63 unidades donde se
pedían 64.

### Las guías, y el único solape que avisa (día 5, PR #278)

`guidesFor` toma las líneas vivas de lo que se mueve —las tres por eje de un arrastre, solo el borde
tirado de un redimensionado— y contesta con un desplazamiento y la línea que hay que dibujar. Candidatas:
los dos bordes y el medio de cada vecino en cada eje, más el centro de la sección **en x y no en y**,
porque el alto de una sección es el de su contenido y su centro vertical se mueve mientras lo que se
arrastra está en el aire.

**El aviso**: `overlappingTexts(doc)` lista cada par de textos cuyas colocaciones se solapan en una
sección diseñada a mano, con las palabras de los dos, y la revisión previa a la descarga lo enseña al
final, **sin bloquear** — es la decisión de David, aviso y no bloqueo. Cuatro exclusiones, cada una una
decisión: solo texto sobre texto, solo lo que la página dibuja, solo secciones libres, y cada par una
vez. El diálogo es el **noveno** `aria-modal`, y `modalTrap.test.ts` se negó al cambio hasta que la
cuenta y los cuatro registros que la nombran estuvieron actualizados.

**Y una medida que corrigió a la caminata del día 3**: un tramo de N unidades no es un ancho fijo, es N
unidades más los gutters que le toque cruzar, así que el mismo botón de 24 unidades mide 256 px en la
unidad 1 y 272 en la 38. «Centrado» aterriza dentro de media unidad más medio gutter, trece píxeles, que
es la consecuencia directa de conservar los gutters del catálogo al píxel.

### El teclado cuenta en unidades (día 6, PR #279)

Una unidad por pulsación y ocho con `Mayús`, en las cuatro direcciones — una pulsación es ya lo más
fino que el documento puede expresar, que es lo que hace al teclado igual a la mano sobre una rejilla de
96. **`Mayús` deja de redimensionar**: era el único redimensionado por teclado en el lienzo y una tecla
no puede significar dos cosas, así que el ancho pasa entero a los steppers del panel.

**Una carrera de pulsaciones es un movimiento y un solo paso del historial** (su condición 1):
`arrowRun.ts` las acumula, puro, con el reloj como argumento, y la colocación se escribe en `keyup`,
tras 300 ms de silencio, o en `blur` — la red para la pulsación cuyo `keyup` no llega nunca. Cincuenta
pulsaciones para cruzar una sección serían si no cincuenta documentos y cincuenta «Deshacer» para una
sola intención, **y de paso retira la pulsación perdida del ADR 0049 §4**: no hay reconstrucción hasta
soltar.

**El anuncio es píxeles, desde la caja medida** (su condición 2): «Columna 3 de 12» significaba algo en
la rejilla del catálogo y nada en una de noventa y seis, y «columna 25 de 96» sería cierto e inútil
porque nadie cuenta en noventaiseisavos.

### Las asas que un dedo puede tomar (día 7, PR #280)

`handles.ts` es puro y probado: cuatro esquinas siempre, los cuatro puntos medios **solo cuando la caja
mide dos objetivos de 44 px en las dos direcciones**, y cada objetivo recortado dentro de la sección
para que `overflow-x: clip` no se coma la mitad de uno. **La regla del ancho es obra de la suite**:
preguntar a cada lado por su propio largo enterró un texto de 528×52 bajo sus asas de arriba y abajo
—las dos de 44 px centradas en bordes separados por 52— y la caminata táctil del sprint 24 cazó que el
elemento había dejado de poder arrastrarse.

**Y dos defectos que solo vio CI**, los dos de la misma familia y el segundo peor que el primero. El
primero: `paintHandles` corre *dentro* de una reconstrucción, así que el `doc` que su cierre capturó al
cablear el marco podía ser el de antes de escalar la sección — `layout` era `null` y no dibujaba nada,
permanente y no un parpadeo. Pregunta a la sección por `rb-free`, que es la clase del renderizador y
está en el documento que se va a dibujar. El segundo: **una edición se enseña construyendo la siguiente
versión de la página en un marco con búfer y cambiándola**, así que durante unos milisegundos hay dos
documentos vivos, y una sola referencia con «el pintor del último cableado» pintaba en el del búfer
mientras la persona miraba el visible. Los pintores son un `WeakMap` por documento y `markChosen` pide
el del documento en el que su elemento vive de verdad. **El cambio siempre ganaba la carrera en esta
máquina; CI es más rápida.**

Lo que costó tres rondas de CI y habría costado una: que la caminata diga **de qué documento habla**.
«live:0 buffered:8» en vez de «no hay asa».

### Un aviso que bloqueaba, aparte y primero (PR #281)

Tres avisos de seguridad de `launch-editor` bajo `vitest` ponían en rojo el `security` de la PR del
día 7. Se arreglaron en su propia PR —`"vite@<8.3.3": ">=8.3.3"` en `pnpm-workspace.yaml`—, se fusionó
primero, y después la rama del día 7 se actualizó con `main` por una fusión ordinaria. Un aviso que
bloquea no viaja dentro de la PR de la función.

### El cierre (día 8, PR #282)

**Lo medido, en el orden que la máquina quiso y nada en paralelo.** El portátil se reinició a
propósito antes de este día, porque tres caminatas se habían colgado por paginación el 20 de
octubre: `vm.swapusage` dijo **0,00 M usados sobre un total de 0,00 M** antes de empezar y seguía
diciéndolo al acabar, así que ningún número de abajo está medido sobre una máquina que estuviera
tragando.

- **`RETORIKA_E2E=1 pnpm e2e` entero y solo**: 215 pasadas, 1 saltada, **902 s**. Verde antes de
  tocar nada, que es lo que separa un defecto heredado de uno de hoy. **Y una advertencia sobre esta
  máquina, que es un hallazgo del día tanto como los otros**: las tres pasadas completas de la tarde
  dieron 1 556, 1 362 y 1 313 s —entre un 45 % y un 70 % por encima de esa primera— con **tres, cuatro
  y tres** caminatas en rojo, **diez caminatas distintas en total y ninguna repetida**. Las diez son
  esperas por la respuesta de la aplicación y ninguna una aseveración: «Comidas», «Siguiente», «Que
  reserven», una foto `blob:`, la frase de guardado. Siete de las diez caen **antes** de que existan
  las herramientas de diseño, donde nada de lo de hoy corre. Por el criterio del propio plan —«un
  defecto rompe las mismas caminatas y el ruido se mueve»— esto es ruido, y se midió en vez de
  suponerlo: los tres recorridos del día 7, que son los que más ejercitan el cambio de hoy, tardan
  **16,30 s con el arreglo y 15,50 s sin él**, y pasan de las dos maneras. Vaciar los 2,8 GB del caché
  de `next dev` no cambió nada. La máquina se degrada con horas de Chromium encima, que es exactamente
  por lo que David la reinició antes de este día; **la pasada completa que vale es la de CI, o una
  local tras reiniciar**. **Y CI contestó: las once comprobaciones en verde**, con el `e2e`
  completo en 18 minutos — las cinco caminatas nuevas del día 8, el recorrido sin ratón estirado y las
  tres del día 7 incluidas. Pero contestó a la segunda: **la primera pasada de CI falló una caminata**,
  «agranda el área de una foto por su borde inferior» del día 4, con el `poll` del cursor `ns-resize`
  agotando sus cinco segundos. La repetición del **mismo commit** fue verde.
  **Y eso, perseguido en vez de dado por ruido, le da a la fila de los parpadeos del `e2e` lo que no
  tenía desde el sprint 13: un mecanismo reproducible.** Esa caminata, corrida **sola**, falla **tres
  de tres** — y falla tres de tres **en `main` también**, sin nada de este día puesto, mientras pasa en
  la suite completa en las dos ramas. No es de esta rama ni es nueva: es una carrera que la caminata
  pierde cuando su preparación va lenta, y correrla filtrada es la forma más barata de ir lenta. Un
  sondeo con los mismos pasos y esperas más largas saca `ns-resize` siempre, con el punto medido a 2 px
  del borde inferior de la caja viva y el zoom en 1 — **el producto está bien y el instrumento es
  frágil**, que es la mitad que las tres veces anteriores no pudieron separar. Está en el backlog con
  el comando que lo reproduce y con lo que costaría arreglarlo.
- **`RETORIKA_A11Y=1 pnpm test:a11y`**: 538 pruebas en 7 ficheros, verde.
- **`pnpm lighthouse`**, preset de móvil, las tres composiciones y la página por ficha:
  rendimiento **100 / 99 / 99 / 100**, accesibilidad **100** en las cuatro, buenas prácticas 96,
  SEO 100; LCP 1,65 / 2,18 / 2,18 / 0,90 s, CLS 0,000 / 0,000 / 0,027 / 0,000, TBT 0 ms. El 96 sigue
  siendo el 404 del favicon, que ya tiene su fila. **Y hay que decir lo que esto no mide**: el sitio
  de muestra lo coloca el catálogo, así que ninguna de las cuatro auditorías dibuja una sección
  libre. El peso de la rejilla fina lo miden los goldens y `pnpm size`, no Lighthouse.
- **El peso de la rejilla fina, exacto**: `hidden-and-embed` pasa de 6 079 a 6 627 bytes y
  `physio-free-cover` de 5 547 a 6 099 — **+86 y +90 bytes comprimidos** sobre un presupuesto de
  60 KB por página. Y `cover-and-services`, que no tiene sección libre, es **byte a byte idéntico**:
  el bloque de las 107 pistas se emite solo si el documento lo necesita, y eso ya no es una promesa
  del plan sino una comparación.
- **Goldens: los dos del día 1 y ninguno más**, comprobado contra el cierre del sprint 24 y no
  contra la memoria. El diff entero es la rejilla fina: `rb-free` puesto por el renderizador, las
  107 pistas, las columnas ×8 y las filas convertidas.

**Y tres cosas que salieron de medir, que es para lo que existe un día de cierre.**

**1. A 390 no hay nada que auditar, y el plan del día pedía auditarlo.** El plan decía «axe a 390
sobre un elemento elegido con asas». A 390 no hay asas — y no por un defecto: `designToolsFor`
devuelve `undefined` por debajo de `MIN_STUDIO_WIDTH`, así que **el interruptor de las herramientas
de diseño no está en el DOM** (cero a 390, uno a 1024, medido). Sin interruptor no hay sección
diseñada a mano, y sin sección a mano no hay rejilla fina, ni bordes que estiren, ni guías, ni asas:
**el sprint entero no tiene puerta en un teléfono.** Es ADR 0025 §5 y ADR 0042 funcionando como se
decidió, no una sorpresa, pero nadie lo había escrito y el plan lo dio por supuesto. Así que la
pasada de axe se hace donde la cosa existe por primera vez —**1024 con un dedo**, que es una tableta
o un portátil táctil, el caso duro del día 7— y a 390 queda una caminata que asevera el cero.
Verde: las ocho asas `aria-hidden` no añaden ni un hallazgo serio, que es exactamente lo que había
que comprobar, porque un `aria-hidden` sobre algo enfocable sí lo es.

**2. Escalar desde la vista de móvil deshacía la maqueta de escritorio.** Escalar mide la página viva
desde el día 2, y en la vista de móvil la página viva tiene 320 px: cada elemento es
`grid-column: 1 / -1` y la sección es una pila. Las columnas se salvaban —el ×8 es exacto y no se
mide— pero las filas salían en el orden del teléfono. Medido: el titular de la portada generada
aterrizaba en la **fila 29** en vez de la 4, **doscientos píxeles más abajo** y por debajo de una
foto cuya área salía de **26 filas donde el escritorio mide 50**. En silencio, y «no se mueve nada al
empezar» (ADR 0025 §7) dejaba de ser cierto por una puerta que las herramientas encendidas tienen
abierta todo el rato. `measurePlaced` devuelve ahora `undefined` cuando la sección resuelve **una
sola pista** —se le pregunta a la página y no al estado, que es la lección del día 7— y la escalada
cae en la conversión por el ritmo, que es lo que conserva la maqueta. **Las dos mitades se
aseveran**: desde el móvil el titular vuelve a la fila 1 al lado de la foto, y desde el escritorio
sigue cayendo por debajo de la 1, que es la caminata que caza un `undefined` devuelto siempre.

**3. Las asas no seguían a su elemento cuando la página refluía debajo.** Un asa es una caja
absoluta colocada en la esquina que el elemento tenía **al elegirlo**, y hasta hoy solo se
repintaban en `markChosen`. Todo lo que cambia el ancho de la vista previa sin reconstruir el
documento las dejaba atrás: abrir «Diseño» en una ventana de 1024 lleva la página de 752 px a 721, el
titular de 320 px de ancho a 305, y el asa de abajo a la derecha se quedaba a **15,5 px** de su
esquina; ensanchar la ventana de 1024 a 1280 lleva la página a 788 y la dejaba **18 px corta**.
Permanente, no un parpadeo —medido estable a los 150 ms y a los 3 850— y con los puntos dibujados
todo el rato, señalando a donde no hay nada. Un `ResizeObserver` sobre cada sección lo arregla, y es
un observador y no un oyente de `resize` porque **las dos puertas no son la misma**: abrir un panel
no redimensiona ninguna ventana.

**Y una trampa de la propia caminata, que es la que más vale de las tres.** La primera versión de
esa aseveración pasaba en verde **con el defecto puesto**: `expect.poll(…).toBeLessThanOrEqual(1)`
se da por satisfecho con su **primera** muestra, y la primera muestra tras pulsar «Diseño» llega
antes de que React haya rehecho la fila, cuando la página todavía mide 752 y la deriva es cero. Una
espera por «esto ya está bien» que se cumple antes de que ocurra lo que iba a romperlo no comprueba
nada. La caminata espera ahora **a que el reflujo haya ocurrido** —el ancho de la caja ya no es el de
antes— y solo entonces mira el asa; con el defecto puesto falla diciendo «deriva 15,5 px sobre una
caja de 305 px». Es el saboteo de cada aseveración derivada haciendo su trabajo, en la aseveración
que parecía no derivar nada.

**Y el paseo sin ratón gana un gesto, porque le faltaba uno.** El sprint 25 añadió un gesto nuevo
entero —redimensionar el recuadro— y sus dos puertas son punteros: los bordes con el ratón (día 4) y
las asas con el dedo (día 7). Su camino de teclado son los cuatro steppers de «Colocación», que es
lo que ADR 0050 §6 dice al quitarle a `Mayús` el redimensionado el día 6, y lo que pide la WCAG
2.5.7 — y **ninguna caminata sin ratón los pulsaba**: la del sprint 24 día 10 mueve y no estira. Así
que la promesa «monta una web, la edita, le da estilo y descarga el ZIP sin tocar el trackpad»
cubría desde el día 6 un gesto menos de los que el editor tiene. Ahora el recorrido abre «Diseño»,
despliega «Colocación» y pulsa «Ancho: uno menos» con Enter: **un stepper mueve un número** —una
columna del catálogo de ancho y nada más, con la columna, la fila y el alto intactos— y un
«Deshacer» lo devuelve. Se estrecha y no se ensancha a propósito, porque la flecha que sería
rechazada está deshabilitada y el elemento más bajo de esta portada llega hasta la última unidad.

**Lo medido y no arreglado, que es una pregunta más grande que las asas.** Todo el cromo que el
editor dibuja **dentro** de la vista previa está en los píxeles de la página, así que un lienzo con
zoom lo encoge entero. Medido a 1024 con el panel «Diseño» abierto, donde el zoom es **0,7379**:

| Cromo | En el documento | En pantalla |
|---|---|---|
| Un asa táctil | 44 × 44 | **32,5 × 32,5** |
| Un verbo de sección | 32 × 32 | **23,6 × 23,6** |
| El agarre de la barra flotante | 24 × 26 | **17,7 × 19,2** |

Sin panel el zoom es 1 y las tres miden lo que dicen. El asa es la única cuyo número viene de la
WCAG —44 es el 2.5.5— y es la que **mejor** sale: 32,5 sigue por encima del 24 × 24 que pide la 2.5.8
de la WCAG 2.2. El verbo y el agarre caen **por debajo** de ese 24, y el agarre lleva ahí desde el
sprint 20 con un comentario que cita esa misma cláusula. Los umbrales del gesto sí se dividen por el
zoom —los 3 px del arrastre, los ±6 del borde, los 6 de la guía: el ajuste 3 de David—, y lo dibujado
nunca; que lo dibujado deba compensar también es una decisión que toca los verbos, el agarre y las
pastillas, no solo lo que este sprint añadió. Va al backlog con las tres medidas, no arreglada a
medias en el cierre.

### Lo que este sprint deja a David

**Nueve firmas.** El **ADR 0050** es nuevo y está `proposed`, con sus seis enmiendas de los días 2 a
7 dentro. Y siguen sin firmar los siete de antes: **0042** (sprint 21), **0043** (sprint 23), y
**0045, 0046, 0047, 0048 y 0049** (sprint 24) — ~~más la del **CEO para el 0044**, que es la que enmienda
un ADR que él firmó y la que mueve el riesgo del artículo 10 de la LSSI-CE al cliente~~ (corregido el 25
de octubre de 2026: el 0044 lo aceptó David el 18 de octubre, no el CEO, y está `accepted`). El desarrollo
no firma ninguna.

**Y una decisión con los números delante**: si el cromo dibujado dentro del lienzo tiene que mantener
su tamaño cuando el lienzo está a escala. La tabla de arriba es la medida; el arreglo es el ajuste 3
suyo aplicado a lo dibujado y no solo a los umbrales; el coste es que a zoom bajo un elemento
pequeño perdería sus cuatro asas de borde, porque la regla de «dos objetivos de ancho» empezaría a
contarse en píxeles de pantalla — que es lo que su condición 6 quería decir. La fila está en el
backlog y nadie la toca hasta que él conteste.

## Sprint 26 — «El lienzo que no reconstruye» (22 de octubre de 2026)

David, tras cerrar el sprint 25, con una petición abierta y no una función:

> «Vamos a planificar el sprint 26 teniendo en cuenta la mejora sustancial de las herramientas
> disponibles en el editor de páginas web. Busco mejoras sustanciales de las herramientas ya
> existentes en el editor.»

**Lo que el inventario dijo.** Las siete cosas que nombraron los dueños reales estaban construidas o
rechazadas por ADR; lo medido y sin arreglar se agrupaba en cuatro candidatos con su coste, y David
eligió **uno solo, el que mejora todas las herramientas a la vez**: el lienzo que reconstruía su
documento en cada edición. `Editor.tsx:1056` lo decía en una línea —«every action in this editor
replaces the iframe's whole `srcDoc`»—; el protocolo §3.2 dibujaba `render(doc, "dom")` para el
editor desde el principio y el editor nunca lo había llamado. Coste medido antes de tocar nada: una
pulsación durante la reconstrucción se perdía (ventana de 5,8 ms, 1,5 s con las fuentes retenidas);
dos documentos vivos por edición; unas setenta piezas de maquinaria en `Editor.tsx` y sesenta y nueve
en el e2e que existían para sobrevivir a eso; la región `aria-live` fuera del lienzo porque dentro
no sobrevivía; el intermitente del sprint 18. El backlog lo llamaba «the bigger change» desde el
sprint 12.

**Siete ajustes suyos al aprobar, todos en el producto:** (1) evaluar morphdom antes de escribir el
parche a mano; (2) deshacer mientras se escribe, aplicado al texto con foco con el cursor en su
sitio; (3) el cromo nunca escribe `style` en línea sobre un nodo del renderizador, y un parche en
mitad de un gesto espera a soltar; (4) el destino `dom` construye en un documento inerte para que
una imagen no dispare una petición por render; (5) delegación de eventos, decidida ese día; (6) la
ruta vieja sobrevive tras una llave hasta el cierre del sprint 27; (7) el esfuerzo de la tabla, con
el día 6 en medio-alto.

### Lo que se construyó, día a día

- **Día 1 (PR #283).** El ADR 0051 `proposed`; `render(doc, "dom", { document })` con el documento
  inerte; la paridad `dom ≡ html` como prueba del renderizador (61 casos, saboteada en los dos
  sentidos), que encontró la única diferencia estructural entre los dos destinos — un nodo de texto
  vacío para `""` — y la cerró sin mover un golden; la línea base medida: **1 documento por edición,
  ventana 5,8 ms, pulsación→cableado 10,4 ms**.
- **Día 2 (PR #284, con la #285 aparte por dos avisos del vitest).** morphdom adoptado como
  dependencia del editor y envuelto en `patchCanvas` con las cuatro reglas; el cromo **aparcado**
  durante el recorrido y no cifrado (morphdom empujaba un grupo de verbos del primer hijo al
  tercero); la llave `rb.canvas`; la cola de gestos; el historial aplicado al texto con foco.
  **Medido: una edición de texto cablea 0 documentos; el parche cuesta 0,8–1,6 ms.**
- **Día 3 (PR #286).** La delegación de eventos: todo oyente por nodo —nueve por texto, nueve por
  elemento colocado, cuatro por sección— es un juego por documento despachado por `closest`; las
  refs `*Now` con una guarda por `grep`; el cromo repintado tras cada parche, también los
  estructurales; `chromeKey` por identidad y no por posición. Dos líneas, subir, duplicar, borrar y
  deshacer: **6 parches, 0 documentos, repintado 0,6–2 ms**.
- **Día 4 (PR #287).** Las tres causas reales que la ruta nueva enseñó en CI: el menú no soltaba los
  enlaces viejos (clave por tira y lista), la regla 3 difería la marca de la propia barra (causa
  `mark`), `keepWriting` sin oyente; el interruptor repinta y escalar es un parche; otra página
  empieza arriba; **las fuentes en su propia hoja: de un `loadingdone` por cambio de paleta (10 de
  10) a 0**; la barra flotante reabierta por el repintado con el control bajo la mano.
- **Día 5 (PR #288).** El contrato de las caminatas: `afterTheEdit` sobre el serial vale en las dos
  rutas y sustituye a una espera que bajo `patch` no volvía nunca (38 rojas por eso y solo por eso);
  las tres caminatas del relevo y la línea base aseveran **por ruta**; treinta pulsaciones a 5 ms
  mientras cae la marca del propio texto: **30 de 30**; **`patch` por defecto**, las dos rutas
  bloquean en CI. Y un defecto real más: `applyPatch` leía las fotos de la clausura del render.
- **Día 6 (PR #289, con la #290 aparte por dos avisos críticos de Next).** Nada muere bajo las dos
  rutas, y se dice; la lista de retirada para el 27 día 1 con una prueba que la mantiene honesta;
  la tabla lado a lado. Entre medias, el límite del e2e pasó al **paso** de la suite (25) con 40 en
  el job: `install-deps` tardó once minutos una vez y mató 178 verdes.
- **Día 7 (PR #291).** Treinta y cinco comentarios que razonaban desde la reconstrucción dicen
  «bajo `swap` … / bajo `patch` …»; el comentario huérfano del reancle por ancho dice que nada corre
  al cambiar el ancho; los ADR 0048, 0049 y 0050 enmendados donde se apoyaban en la reconstrucción.

### Las dos rutas, lado a lado

| | `swap` (hasta el 27) | `patch` (por defecto desde el día 5) |
|---|---|---|
| Documentos cableados tras una edición de texto | 1 | **0** |
| Ventana en la que una pulsación no tiene dónde caer | 4,6–5,9 ms | **0 ms** |
| Pulsación → la edición en la página | 10,1–10,5 ms | **6,0 ms** (parche 0,9 ms, repintado 1,2 ms) |
| Cambio de paleta | caras redeclaradas | **`loadingdone` 0**, peticiones 2 → 2 |
| Treinta pulsaciones a 5 ms durante la marca | la ventana se traga una | **30 de 30** |
| Marcos en el editor, alguna vez | hasta 2 | **1** |
| La salida publicada | — | **ningún golden se movió en todo el sprint** |

### El cierre (día 8)

**Lo medido, nada en paralelo.** `pnpm test` 3 061 verdes; `pnpm test:a11y` **538 de 538** en
Chromium real; `pnpm size` todo `ok`, con la portada del restaurante en 3,1–3,2 KB de página, y
**ningún commit tocó `fixtures/golden` en todo el sprint**: la salida publicada no se movió un byte.
Lighthouse sobre las tres composiciones y la página por ficha, perfil móvil:

| Página | Rendimiento | Accesibilidad | Buenas prácticas | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| restaurante-bar · v1 | **100** | **100** | 96 | **100** | 1,65 s | 0,000 |
| restaurante-bar · v2 | **99** | **100** | 96 | **100** | 2,25 s | 0,027 |
| restaurante-bar · v3 | **99** | **100** | 96 | **100** | 2,18 s | 0,027 |
| una-pagina-por-ficha | **100** | **100** | 96 | **100** | 0,90 s | 0,000 |

El 96 de buenas prácticas es el de siempre —`cache-insight`, `errors-in-console`,
`document-latency-insight`, todos del servidor de pruebas y no de la página— y el umbral del
protocolo (≥ 95 en rendimiento y accesibilidad) se cumple con margen.

**La caminata de cierre**, la misma sesión larga sobre las dos rutas — un texto, una paleta y su
vuelta, el interruptor, una escalada y su vuelta, el apagado, una línea, subir, otra página y volver,
deshacer — trece ediciones: bajo **`patch`, documentos cableados 1 → 1 y el sello puesto al principio
sigue en el documento**; bajo **`swap`, 2 → 17 y el sello se fue con el primer documento**. Las dos
terminan con la página diciendo lo mismo, que es la promesa del ajuste 6. En CI las dos rutas han
pasado la suite entera, 230 caminatas cada una, en cada PR desde el día 5.

**Lo que el sprint 26 no ha cerrado y dice.** La escalada en dos pasos (del editor, en las dos
rutas); `End` sobre la selección repuesta; la marca sobre texto sin volcar; los 164 px al cerrar un
panel; el cromo a escala; Tab dentro de una sección; y una caminata de 320 × 568 que cayó una vez en
un runner lento con la tarjeta del lienzo «recortada» — anotada como posible parpadeo de medida, no
perseguida.

### Lo que este sprint deja a David

**La firma del ADR 0051**, `proposed` con sus siete enmiendas dentro, y las nueve que seguían del
cierre del 25. **La retirada de la ruta vieja** es del sprint 27 día 1, con la lista en
`docs/tasks/swap-route-retirement.md` y el e2e de las dos modalidades delante; la precisión del 21
sobre `chromeKey` y la restauración se confirmó, con una corrección: cuatro refs que se daban por de
`swap` las leen las dos rutas. **Tres hallazgos del editor**, no de la ruta, en el backlog: marcar
texto sin volcar marca el documento; `End` no pliega la selección repuesta; **escalar son dos pasos
con 200 ms entre ellos**, y una mano que escala y arrastra enseguida los encuentra en las dos rutas.
**Dos decisiones tomadas por el desarrollo y dichas**: el límite de los `e2e` (25 en el paso, 40 en
el job) tras cuatro cancelaciones en dos días, y `patch` como ruta por defecto, que el plan fijaba
para el día 5 y el día 5 cumplió. Y lo que este sprint no tocó, por decisión: los 164 px al cerrar
un panel (un reflujo por ancho, en las dos rutas), el cromo a escala, Tab dentro de una sección,
las versiones con nombre.

## Sprint 27 — «El teclado llega a todo, y el cromo mide lo que mide» (desde el 23 de octubre de 2026)

David, tras cerrar el sprint 26: «planifica el sprint 27 primero». Sin tema nombrado, así que el
inventario fue delante y él eligió con cuatro respuestas: **el teclado y el foco del editor** para
los días 2 a 6 —lo que el ADR 0051 dejó fuera a propósito y el backlog lleva cuatro sprints
midiendo—, **el cromo a escala sí mantiene su tamaño en pantalla** con tres condiciones suyas (día
7), **los límites del `e2e` aceptados** tal cual (25 en el paso, 25 → 40 en el job), y **las nueve
fotos antes del 1 de noviembre con una PR de reserva** que mueve la fecha del ADR 0035 si el 30 no
están. Aprobó el plan con seis ajustes y dos notas más; el plan está en
`~/.claude/plans/planifica-el-sprint-27-clever-oasis.md`.

### Día 1 — la ruta vieja se va

**La retirada de `swap`**, por la lista que el sprint 26 día 6 escribió símbolo a símbolo
(`docs/tasks/swap-route-retirement.md`, que desde hoy es el registro de lo hecho y no un plan). El
lienzo es **un `<iframe>` y un `Document` por sesión**: la llave `rb.canvas` y `canvasMode.ts` fuera,
el memo de `html` convertido en un `useState` que nadie vuelve a leer, la ruta de reserva
(`fallback`, `frameHtml`, `frameSerial`, `takeOldRoute`) fuera, `chromeKey` fuera, el relevo
amortiguado entero fuera (`buffer`, `pendingSlot`, `everSwapped`, `slotFrame`, `slotRole`,
`BUFFER_DEADLINE_MS`, `data-buffered`, las dos ranuras del JSX, `promote`, `refocusAfterSwap`, el
color recordado) y la posición de lectura con su grabador, su ancla, su restauración y su segunda
pasada. **Lo único que `patchCanvas` podía rechazar y queda** es `no-body`, que un documento cableado
no puede ser, así que `applyPatch` **lanza**: la regla de la casa para lo imposible, porque la
alternativa silenciosa es un lienzo que deja de responder con la página con aspecto de terminada.

**Números**: `Editor.tsx` 7965 → **7429** líneas, el `e2e` 19295 → **19109**, un job de `e2e` en vez
de dos, 3061 → **3003** pruebas unitarias en 149 ficheros. **Ningún golden se movió** y no se tocó
nada bajo `packages/`.

**Las dos filas condicionales de la lista.** `wireReadingPosition` **se va** con la restauración,
porque el reancle por ancho no se construye este sprint. Y `lookAhead.ts` **se queda, por juicio y no
por el número**, que es la historia de la jornada y conviene contarla entera. La condición era que el
`load` del marco llegara a un fotograma del cableado por anticipación. Medido cinco veces con la
caminata **a solas**, la anticipación gana por **482 a 573 ms**; medido **dentro de la suite
completa**, tras unas doscientas caminatas, **cablea `onload` y el margen es −0,1 ms**, con lo que la
condición de borrado se cumple.

**El medio segundo era Next compilando `fonts/[file]` la primera vez que se le pide**, que es lo que
paga siempre una caminata filtrada —este repositorio ya lo tiene escrito— y se leyó como el número
del producto. La medida aislada medía el servidor de desarrollo, no el editor. Se queda igualmente, y
se dice que es un juicio: lo que vale la anticipación es lo que cuesten los subrecursos del marco
—64,9 ms el 2 de octubre con las fuentes dando 404, 1,5 s con ellas retenidas, nada cuando llegan al
instante—, no puede valer menos que nada, y cuesta una lectura de propiedad por fotograma durante dos
segundos. Borrarla sería cambiar eso por reabrir una clase de defecto que tardó del sprint 7 al 18 en
encontrarse. **La medida que lo zanjaría es el editor desplegado sobre una instancia de Render
dormida**, que es la única de estas cuatro condiciones que un dueño real encuentra.

**Dos cosas que aparecieron al hacerlo.** Un **comentario huérfano**: el bloque de
`replacingTheDocument` seguía en el `e2e`, apilado sobre el de `waitForBankPhoto`, tres días después
de que el día 5 retirara la función que describía. Y, en la rama de reserva del ADR 0035, que **ocho
de las nueve fotos miden 1024 × 1024 y la `.07` mide 866 × 942**: el ADR y el backlog lo dicen bien
desde el 9 de octubre, y el único sitio que lo había aplanado a «las nueve miden 1024 px» era el
documento del que David decide.

**Lo que se queda a propósito**: `keepWriting`, `keepChosenFocus`, `pendingReturn`, `focusTarget` y
`pendingPatch` — los cuatro primeros los leen los `settle*`, y guardan **nombres** y no nodos, que es
la forma que les dio la época de los dos documentos y sigue siendo la correcta porque un parche
sustituye nodos. `data-rb-wired` se queda como la respuesta del propio documento a «¿hay algo que
parchear?».

### Día 2 — el lienzo es una parada (PR #295)

El **ADR 0052** nace `proposed` y el día entrega **solo el cambio de modelo** (§1, §2 y §7), en su
propia PR antes de nada que se apoye en él, para que lo que rompiera se viera aislado. El lienzo es
**una parada de Tab** y lo de dentro de una sección son paradas **solo mientras esa sección tiene el
teclado** (`applyCanvasStops`, con la mitad pura en `rovingTabIndexInside`). Medido en Chromium a
1440 × 900: con las herramientas encendidas, de **unas setenta y cinco paradas a veintidós**; de un
límite de doscientas pulsaciones hasta «Diseño»/«Colocación» a **36 y 37**; volver con Tab a la
sección cuyo texto se tocó, que **nunca** ocurría, en **20**; de «Qué hacemos» al carril, **12**. Una
caminata reescrita (la del sprint 24 día 10, que retrocedía con Mayús+Tab) y tres nuevas.

### Día 3 — la barra que muere (PR #296)

**La causa que cuatro días de notas no habían nombrado: la barra se dibujaba fuera de la pantalla.**
Elegir una sección la enfoca, el foco desplaza el lienzo (`scrollY` 189) y la barra se colocaba
contra la sección, no contra lo visible: arriba en **−31**, y una pulsación allí caía fuera del marco y
cerraba la barra. `toolbarPoint` decide ahora contra la franja visible, **sin dejar de tener el borde
de la sección como suelo** (la primera versión lo perdió y la caminata del sprint 9 sobre «Contacto»
lo cazó en la suite completa). **Marcar vuelca primero** las palabras escritas, y la marca se ve en
sitio con el foco dentro. Y **`End` no es del editor**: en Linux pliega a la primera, en un Mac lo hace
`Cmd+→`; la caminata pulsa la tecla de cada plataforma.

### Día 4 — las flechas de la barra (PR #297)

La segunda mitad de `role="toolbar"`: **← → Inicio Fin** entre controles, **Escape** de vuelta a las
palabras con el cursor donde estaba, **Tab y Alt+F10** desde el texto al asa (la leyenda dice
«Fn+⌥+F10» en un Mac, nota 8), y **una pulsación con teclado vuelve a las palabras, escribiendo, y
actúa ahí**. Lo que la barra recuerda es un registro tomado al cruzar el foco del texto a la barra, en
desplazamientos y con el cursor incluido, nunca un `Range` (ajuste 2). **La nota 7 falló como
anticipaba** y la barra **no** se movió junto al texto —dentro de una tarjeta, un `.rb-line` con
`position: relative`, se dibujaría desplazada—: el orden lo hacen las teclas. **Un hallazgo**: el Tab
nativo desde un texto *en escritura* nunca llegaba al asa (la causa dentro del navegador no está
establecida). Seis decisiones que el plan no recogía, escritas en el ADR 0052 para David; **tomadas
por el desarrollo el 25 de octubre por delegación suya**, todas como estaban.

### Día 5 — escalar ya era un paso (PRs #298 y #299)

**La premisa del día se midió y no se sostuvo**: escalar no son dos cambios del documento a 200 ms,
es **uno** —un parche, una entrada de historial— y lo era desde el sprint 25 día 2. Lo que movía las
cajas eran **la llegada de 180 ms de la barra «Diseñada a mano»**, que empuja 44 px la portada, y
**las fuentes** si se escala nada más abrir; y, al quitar la espera, salió una tercera: **la
transición de 290 ms del ancho del marco al pasar a «Ver en móvil»**. `canvasQuiet` funcionaba porque
400 ms es más que las tres. Las caminatas esperan ahora a cada cosa que se mueve (21 esperas de
silencio → 0); «agranda el área de una foto» pasa sola 3 de 3 **sin tocar su `boundingBox()`**, porque
la hipótesis del backlog no era la causa. Se probó un arreglo en el editor y se quitó: arreglaba el
arrastre y rompía el redimensionado. **El día no dejó nada que tocar**, y se dijo. El mismo día,
`security` en rojo por **cuatro avisos de dependencias** (uno alto en `zod`, que usa el esquema en
producción): en su propia PR, **#299**, fusionada antes.

### Día 6 — el armazón tiene hitos (PR #300)

`<header>`, `<nav aria-label="Paneles del editor">` y `<main aria-label="Área de edición">` en
`EditorShell`; las secciones siguen siendo `role="group"`. **axe `region` de 2 nodos a 0** (eran 3 el 10
de octubre; el plan decía 3) y la pasada asevera ahora `region` y toda regla `landmark-*` con cualquier
gravedad. El `main` **tiene que** llevar nombre: la página del cliente dentro del lienzo tiene el suyo,
y dos sin nombre es `landmark-unique`, medido en cuanto existió el del editor. «Foto de ejemplo» sobre
una foto: el suelo de contraste calculado sobre el blanco puro, **8,86:1 y 14,36:1** con el puntero,
fijado en `chromeContrast.test.ts`.

### Día 7 — el cromo mide lo que mide (PR #301)

El **ADR 0053** nace `proposed` con las tres condiciones de David y los ajustes 1 y 5. A 1024 con
«Diseño» (zoom 0,7379): **verbo 23,6 → 32, asa de la barra 17,7 × 19,2 → 24 × 26, distancias 5,9 → 8,
guía 0,99 px**; con un dedo, abrir «Campos» deja las asas en **44 → 44** (antes 32,5). Las asas se
deciden sobre el tamaño en pantalla: **tres objetivos a lo largo y dos de través** (la regla literal de
tres tapaba el centro de un botón de 272 × 36). **Lo que no se cumple de la condición 1: los
contornos**, que Chromium redondea a píxeles enteros (la selección de 2 px se queda en 1,48 a este
zoom). **Un fallo que encontró la suite**: en un teléfono el primer zoom llega con el marco sin raíz y
el efecto lanzaba un `TypeError` que tumbaba el editor; arreglado con `?.` ahí y en dos efectos más
antiguos. Las tres preguntas para David, **decididas por el desarrollo el 25 de octubre por delegación
suya**: la regla de las asas se queda, los contornos se aceptan tal como Chromium los dibuja (lo exacto
desaparecería en alto contraste) y las exclusiones se quedan.

### Día 8 — el cierre (PR de `test/el-cierre-del-sprint-27`)

**El recorrido del sprint, entero y sin ratón**: de la puerta del lienzo a la portada, elegirla, al
titular, escribir, elegir tres letras, a la barra, «B», y fuera hasta la sección siguiente —
**dieciocho pulsaciones** tras entrar en el lienzo. **Y encontró un defecto**: Escape justo después de
marcar deshacía el lienzo y no el documento —con el ratón volvía a las palabras de antes de escribir,
con el teclado quitaba la negrita, y el documento guardado tenía las dos cosas—, porque revertir
reescribía la cadena con la que empezó la escritura y los días 3 y 4 hicieron que el documento pudiera
cambiar en mitad de una. **Arreglado aquí**: revertir termina la escritura y redibuja el texto desde el
documento. **El ZIP, byte a byte**: los diecinueve documentos del corpus dan el mismo SHA-256 con el
publicador del inicio del sprint (`f4b3350`) y con el de hoy — el sprint no tocó nada bajo `packages/`
salvo fijar `zod`. Y las cuatro menciones rancias del **0044** corregidas: lo **aceptó David** el 18 de
octubre, no el CEO, y está `accepted`.

**Las medidas de cierre.** Lighthouse sobre las tres composiciones del restaurante, móvil:
**v1 100 / 100 / 96 / 100, v2 99 / 100 / 96 / 100, v3 99 / 100 / 96 / 100** (rendimiento,
accesibilidad, buenas prácticas, SEO). En tres pasadas, la primera dio **90** de rendimiento en v1, con
el mismo LCP de 1,65 s y un índice de velocidad de 0,03, y las dos siguientes pasaron enteras: la página
publicada no cambió ni un byte en el sprint, así que se lee como el primer arranque en frío de la
máquina, y se escribe. axe: **538** en la pasada del renderizador, y en el editor `region` 0 y ninguna
regla `landmark-*`. Pesos: el presupuesto sin cambios (`pnpm size` en verde). Goldens: **ninguno se
movió en todo el sprint**. La suite `e2e` completa del cierre: **246 pasan / 1 omitida, 1015,69 s**, a
la primera.

### Lo que el sprint 27 deja abierto

1. **Once firmas**, todas `proposed`: **0042, 0043, 0045, 0046, 0047, 0048, 0049, 0050, 0051, 0052 y
   0053**. Las decisiones que el 0052 y el 0053 dejaban a David las tomó el desarrollo por delegación
   suya; firmarlos sigue siendo suyo.
2. **Las nueve fotos.** Ninguna de las dieciséis PNG de la raíz (del 11 de octubre) llega a 1600 ×
   1072: miden 1024 de ancho. La exención del banco falla desde el **1 de noviembre**; la PR de reserva
   **#293** la mueve al 1 de diciembre y está verde. **Recomendación: fusionarla ya** — no hay fotos
   que puedan aprobarse antes del 30, y esperar al 30 solo deja un margen de un día.
3. **La intermitente de la caminata sin ratón del sprint 17 en CI**: cayó dos veces tras el día 4 —el
   primer intento de la #297 y el primero de la #298 tras actualizarla—, siempre esperando la portada
   tras «Ver a tamaño real», y pasó en las ejecuciones de la #299, la #300 y la #301. Causa no
   establecida; el fallo de montaje del día 7 tiene el mismo síntoma y está arreglado, sin prueba de
   que fuera este.
4. **Los 164 px (o 253, según el instrumento) al cerrar un panel**, sin tocar.
5. **Los contornos a escala**, aceptados como Chromium los dibuja (ADR 0053).
6. **`ontoThePhone`** espera la rejilla de una columna, que llega a mitad de la transición del ancho:
   sus caminatas pasan, y es la siguiente en fallar si algo de antes se acelera.
7. **El Tab nativo desde un texto en escritura** no llega al asa; el editor mueve el foco él mismo. La
   causa dentro del navegador no está establecida.
8. **Desplazar el lienzo con la barra abierta** no la recoloca hasta el siguiente parche, y el grupo de
   verbos no tiene franja visible (del día 3).
9. **El cromo del flujo crece en el marco a menor zoom** y empuja lo de debajo (ADR 0053).

## Sprint 28 — «Lo que ya existe, sin bordes» (desde el 26 de octubre de 2026)

David, con la #302 fusionada: «quiero que reparemos bugs y nos centremos en mejorar lo que tenemos…
dejaremos el añadir funcionalidades para sprints futuros». Tema nombrado por primera vez en cuatro
sprints, así que el inventario fue para elegir *qué* defectos y no qué tema: catorce cosas entran en
ocho días y siete se quedan fuera con su razón. Cuatro decisiones suyas antes de planificar —el héroe
de la landing se queda, los dos colores de texto se oscurecen, «Empezar» pasa a «Crear mi web», y el
favicon del sitio publicado entra acotado con su ADR— y cinco ajustes al aprobar: el suelo de zoom
0,6 para el día 1, `\p{L}`/`\p{N}` y el disco sin letra para el favicon, reponer antes del blur en el
campo exacto, el estado de las nueve fotos en el cierre, y los modelos por día. El plan está en
`~/.claude/plans/pr302-fusionada-y-redespliegue-validated-bengio.md`. La #293 se fusionó el mismo día:
la exención del banco corre hasta el 1 de diciembre, y las fotos siguen siendo compromiso suyo.

### Día 1 — la página no se mueve bajo las manos (PR de `fix/el-panel-no-mueve-la-pagina`)

**La premisa del día se midió y no se sostuvo, igual que el día 5 del 27.** El backlog llevaba desde
el sprint 24 que al abrir o cerrar un panel «la vista previa se remaqueta al nuevo ancho» y la sección
editada se iba 164 px (253 según el instrumento; 174 al abrir en el Linux de CI). El plan proponía
atacar el remaquetado fijando el ancho de maquetación. Antes de tocar nada, una sonda a 1024 y 1280,
con dos secciones y dos paneles: **a 1280 y 1600 un remaquetado de 220 px no mueve nada**, ni al
abrir ni al cerrar, porque el anclaje de desplazamiento del propio navegador se lo come; y a 1024 una
sección del medio de la página tampoco se mueve. Lo que se mueve es la sección cercana al final, y
se mueve **exactamente lo que baja el `scroll` máximo**: la tarjeta mide `100 / zoom %` de alto para
llenar la fila, así que al bajar el zoom a 0,738 el visor del marco crece **de 654 a 909 px de la
página**, el máximo de desplazamiento baja de 1984 a 1754 y el navegador **recorta** el `scroll`
hasta ahí. La sección, en 1895, queda en 166. Al cerrar «Campos» quedaba en 155 porque nadie devolvía
el `scroll` recortado. Las dos reparaciones que el backlog tenía por descartadas reanclaban a través
de un remaquetado que nunca fue la causa; por eso medían peor.

**El arreglo da a la página exactamente el sitio que el visor gana** — `rowHeight × (1 / zoom − 1)`
píxeles del marco, `overscrollFor` (pura, con su prueba) — dibujado como cromo tras la última
sección (`.rb-overscroll`, en el gris de la mesa, nunca en la página publicada), y lo da **antes de
que el navegador maquete el visor nuevo**: el aviso de zoom del armazón es un efecto de maquetación y
el editor escribe `--rb-overscroll` en la raíz del marco antes de leer nada, porque leer el marco
fuerza la maquetación en la que ocurre el recorte. El máximo de desplazamiento sube en vez de bajar
(1984 → 2008), nada se recorta y el anclaje hace el resto: **0 / 0 / 0 en las doce medidas**. A zoom
1 el sitio es 0 y la vista previa acaba donde acaba la página; con «Diseño» abierto a 1024 hay 255 px
de página de gris al final, solo al llegar abajo, y la captura dice que se lee como mesa y no como
página. Ningún desplazamiento horizontal (`scrollWidth` 721 = el ancho de maquetación).

**La caminata del sprint 24 asevera desde hoy ±8 px** —una fila de la rejilla fina— al abrir y al
cerrar a 1024, 1280 y 1600, y antes **el mecanismo**: el sitio al final de la página mide lo que el
visor ha crecido (±2 px). La primera versión comparaba el máximo de desplazamiento antes y después, y
**el Linux de CI la tiró a 1280 por 15 px sin recorte ninguno**: allí la página remaquetada a 788 sale
15 px más corta que a 1008 (en macOS, 10 más larga), así que el máximo bajaba por el remaquetado solo.
La misma diferencia de métricas entre plataformas que la fila registró el 18 de octubre, midiendo lo
que no era.
Saboteando el arreglo apareció un defecto de la propia caminata: su espera guardaba el último ancho
entre llamadas y la primera muestra tras abrir coincidía con la de antes, así que «estable» era
verdad antes de que la tarjeta cambiara (la regla del sprint 25 día 8). Saboteada pasaba al abrir con
el visor aún en 654 y caía al cerrar con el 155 de la apertura. Ahora espera a que el ancho sea
**otro** y después a que ancho y visor se queden quietos; saboteada cae al abrir: «el máximo de
desplazamiento bajó de 1950 a 1754 — el visor creció y la página no recibió el sitio».

**Y una cosa que nadie buscaba: Biome llevaba desde el día 8 del 27 sin leer el `e2e`.** El fichero
cruzó el mebibyte (1 048 576 bytes) que Biome procesa como máximo en `923ed23` —1 054 022 bytes; el día
7 estaba en 1 047 834— y desde entonces `pnpm lint` lo saltaba con una advertencia que no es un
error, así que CI seguía en verde sin leerlo. Apareció al confirmar un cambio que solo tocaba ese
fichero: el gancho de Biome «no procesó ningún fichero» y se negó. `files.maxSize` pasa a 2 MiB en
`biome.json`, y lo que Biome no había formateado en el día 8 son 24 líneas, formateadas aquí. Partir el
fichero sigue fuera del sprint, como decía el plan; el número que lo hará volver es 2 MiB.

**El ajuste 1 de David, medido y no construido, por decisión suya.** El ancho fijo no arregla el
salto; compra que un texto no refluya entre estados del panel (filas de 8 px estables, ADR 0050).
Su precio: el zoom con panel a 1024 pasaría de 0,738 a **0,707** (sobre su suelo de 0,6), y a 1280
y 1600 de 1 a **0,782** y **0,834**, donde hoy la página se ve a tamaño real con un panel abierto.
Su respuesta: «el día 7 mide el síntoma, no la elegancia» — una sección a mano con «Diseño» a 1280,
un texto de dos líneas y un elemento colocado justo debajo, cerrar el panel y medir en píxeles de
pantalla cuánto se separa o se monta; ≤ 8 px, fila del backlog con sus tres zooms; más, defecto del
ADR 0050 y PR aparte en el colchón con la enmienda al sprint 24 día 3.

### Día 2 — el cromo sigue a la vista (PR de `fix/el-cromo-sigue-a-la-vista`)

**Medido antes de tocar, y las dos premisas se sostuvieron.** A 1440 × 900, con la barra abierta sobre
un texto de «Comidas», la rueda del ratón lleva las palabras a 12 px del borde superior del marco y la
barra se queda en **−34**: el defecto del 15 de octubre, alcanzado con la rueda en vez de con el foco,
porque desde el día 3 del 27 la barra se colocaba contra la franja visible solo al abrirse y tras cada
parche. Y el grupo de verbos de la portada, elegida y desplazada 200 px por encima del borde, en
**−192** con sus cuatrocientos píxeles inferiores delante de la persona. No hacía falta una sección más
alta que el marco, como decía la fila: basta con que el borde superior de cualquiera salga de la vista.

**El arreglo es uno y va donde la fila decía.** `Bounds` lleva la franja visible como ya la llevaba
`ToolbarGeometry`, y `clampToHost` sujeta el punto dentro de la franja además de dentro de la sección
—con la sección como suelo y como techo cuando la franja la sobrepasa, con el borde visible ganando
cuando queda menos sección a la vista que alto tiene la barra, e ignorando una franja que no toca la
sección, porque un grupo de verbos flotando sobre la sección de al lado sería peor que uno fuera de
pantalla con la suya—. Las esquinas, las flechas y el arrastre responden dentro de la franja sin tocar
una línea suya. Un único oyente `scroll` en la ventana del marco, pasivo y agrupado por
`requestAnimationFrame`, vuelve a colocar el grupo y la barra abierta, y **solo escribe si el punto
cambia**: la posición que la mano dio se sujeta, nunca se sobrescribe, y al volver el scroll el grupo
está donde lo dejaron (la caminata lo asevera con dos flechas desde el asa). La esquina de la hoja de
estilos sigue siendo la de nacimiento de un grupo que nadie movió y cuya esquina está a la vista, así
que `style.left === ""` sigue significando «nunca movido» para `anchorPopup` y para las caminatas del
sprint 20. Saboteado el oyente, las dos caminatas caen con los números de antes: −34 y −192.

**El cromo del flujo a menor zoom, medido y decidido «como está»** (enmienda del ADR 0053 del 26 de
octubre). A 1024 con «Diseño» (0,7379): la barra «Diseñada a mano» pasa de 44 a **57,9** px del marco
(44 → 42,7 en pantalla) y empuja lo de debajo 13,9 px más; el hueco de una sección borrada de 94 a
**125,6** (138 → 185,2 con sus márgenes, 47,2 más); la píldora «Añadir» de 30 a **40,7** (30 → 30 en
pantalla, 14,2 más con su margen). Lo de debajo empieza exactamente tras la caja y su margen inferior
en los dos estados. El 1,3 px en pantalla no es la división sino la letra: cada caja de línea con
`line-height: normal` pierde alrededor de un píxel de pantalla al zoom menor porque Chromium redondea
las métricas de la fuente a píxeles enteros, la misma familia que el contorno del día 7 del 27. Se
quedan a tamaño de pantalla porque las tres llevan un control o palabras —en píxeles del marco, «Volver
a la original» mediría 23,6 px a 0,7379, por debajo del 24 del 2.5.8 que el ADR existe para cumplir—,
el coste está acotado a un panel abierto (diez a treinta y cinco píxeles de pantalla por pieza) y nada
se mueve bajo la mano por ello: la barra abre su sitio por su alto medido, y una pieza por encima de la
vista crece detrás del anclaje del navegador que el día 1 midió. La caminata se queda aseverando la
regla del §1 sobre el cromo del flujo, con los dos píxeles que cuesta la letra.

### Día 3 — lo pequeño de cada día (PR de `fix/lo-pequeno-de-cada-dia`)

**El campo del buscador de sectores ya no se mueve, y los 7,9 px eran lo menos que se movía.** Medido
antes de tocar nada, con «rest», en seis tamaños: 0 a 320 × 640 y a 390 × 844 —la tarjeta es más alta
que la pantalla y no se centra—, 7,9 a 1280 × 720 (la medida del sprint 22), 31,9 a 1024 × 768, 97,9 a
1440 × 900 y **159,9 a 768 × 1024**; «zzz» a 390 × 844 dejaba caber la tarjeta y la bajaba 5,5. La
causa era la escrita: la rejilla pintaba solo las coincidencias, su alto iba con ellas y `Shell` centra
la tarjeta. Ahora cada sector está siempre en la rejilla y la búsqueda esconde los que deja fuera con
`visibility: hidden`, detrás de «Otro sector» con `order`, así que la rejilla guarda su alto entero en
cada ancho y con cada salto de línea sin que nadie lo calcule. Los escondidos no se ven, no reciben el
foco ni los lee un lector de pantalla; las flechas recorren solo los visibles, en su orden. 0 en los
seis tamaños, con las dos búsquedas, en una caminata nueva; saboteada, cae con los 5,5. Lo que cuesta,
dicho: con una búsqueda estrecha queda sitio vacío entre las tarjetas y «Siguiente». La prueba del
sprint 22 que aseveraba que la rejilla se encogía —era verdad y era el defecto— asevera ahora que el
filtro deja fuera tarjetas.

**Escape en un campo de píxeles exactos ya no escribe lo que se tecleó.** Los dos campos numéricos de
la barra se guardan en `change`, y volver a las palabras es un `blur`, que lo dispara: «120» tecleado y
Escape escribía 120 px, lo contrario de «volver sin hacer nada» (ADR 0052 §3). Caminado primero, en
rojo. El Escape de la barra devuelve al campo su `defaultValue` —el valor en vigor cuando se construyó
la barra— antes de mover el foco, y `change` ya no tiene nada que contar. La caminata pone 48, teclea
120, pulsa Escape y comprueba que el campo vuelve a decir 48, que el documento sigue en 48 y que **un
solo «Deshacer» llega al tamaño de antes del 48**: ninguna entrada nueva, ni la de 120 ni un segundo
48 encima del primero. El campo de color no entra: su Escape es el del selector del navegador.

**Los textos en azul y en rojo son ya los oscuros** (decisión de David del 26 de octubre). El azul de
marca y el rojo pasan 4,5:1 sobre un panel por un pelo —4,71 y 4,83— y a 0,90 de opacidad, que es por
donde pasa la entrada de un panel, se quedan en 4,03 y 4,30. El texto usa ahora `--ui-brand-deep`
`#105CB1`, que ya existía y era ya «el azul de la marca como texto», y un `--ui-danger-deep` `#B91C1C`
nuevo: 5,34 y 5,58 a 0,90. Rellenos, bordes, contornos e iconos se quedan con los vivos, que solo
necesitan 3:1. No es `--ui-brand-text` como decía el plan: un segundo nombre para el mismo `#105CB1`
habría sido dos tokens que coinciden por suerte, que es justo lo que el sprint 22 quitó. Once usos de
texto cambian; tres `text-ui-brand` se quedan, y los tres son iconos sobre su tinte. `chromeContrast`
mide la opacidad y lee los componentes para que ninguna palabra vuelva a los vivos; saboteado con el
aviso de `SharePanel`, lo nombra. **Encontrado de camino:** el nombre del sector elegido era azul de
marca sobre su propia tarjeta `#F1F7FE`, a **4,37:1**, por debajo de AA para 15 px, desde la
transcripción de las maquetas; axe no lo veía porque ninguna pasada de axe elige un sector.

**«Empezar» pasa a «Crear mi web».** Una clave, `landing.start`, que también titula `/empezar`; las
cuatro caminatas que la nombraban la nombran ahora así. Que Lighthouse deje de listarla en `link-text`
lo confirma el cierre, que lo corre.

### Día 4 — el favicon del sitio (PR de `feat/el-favicon-del-sitio`, ADR 0054)

**Una web descargada ya tiene icono en la pestaña:** la primera letra o cifra del nombre del negocio
en el color de superficie sobre un disco del color principal —el par del botón, uno de los cinco que
`packages/tokens` prueba en todas las paletas—, o el disco solo si el nombre no tiene ninguna. «¡Hola!»
es H, «"La Tasca"» es L, «#1 Pizzas» es 1, «Ñandú» es Ñ. La letra es la del sistema de quien visita
(`system-ui`) y no la de los títulos del sitio, y el ADR lo dice: un favicon se carga como imagen y
una imagen no puede pedir fuentes web. 258 bytes; mirado en Chromium a 16, 32 y 96 px en las cinco
paletas, centrado y legible.

**Un archivo y un enlace, y solo dentro de un paquete.** `buildSite` escribe `favicon.svg` en la raíz
y cada página lleva un `<link rel="icon">` tras su `<title>`; todas las páginas viven en la raíz, así
que el mismo enlace relativo vale servido o abierto con doble clic. El enlace sale solo cuando la
página tiene `pagePath`, la regla que el ADR 0029 puso para `og:url`: sin paquete no hay archivo. Por
eso **el corpus golden no se ha movido**, al revés de lo que decía el plan —el corpus se dibuja sin
paquete—; lo que habría enseñado lo asevera `publisher/test/site.test.ts` sobre cada fixture: el
archivo, sus bytes, su tipo y exactamente un enlace por página. La prueba del doble clic aprendió que
un `<link href>` carga y no navega; saboteada, nombra cada página cuyo icono «no es un archivo del
paquete».

**Lighthouse: buenas prácticas 100 en las cuatro auditorías**, donde era 96 desde el sprint 18 —el
404 de `/favicon.ico` era la nota entera—, y ahora se asevera. Rendimiento 100 / 99 / 99 / 100;
accesibilidad y SEO 100. Saboteado, 96 y rojo. `pnpm test:a11y` en local: 538 de 538.

**Lo que queda dicho y no hecho:** si Safari dibuja un favicon SVG no está establecido —las fuentes
publicadas no coinciden y nadie lo ha abierto en un dispositivo—, y es una línea más para la lista del
iPhone; si no lo dibuja, el siguiente paso es un PNG al lado. El logotipo del dueño como icono espera
a un documento que guarde el logotipo.

### Día 5 — la suite espera a lo que se mueve (PR de `test/la-suite-espera-a-lo-que-se-mueve`)

Un día sin nada que ver en el editor desplegado, como decía el plan: se ve en que CI no pida una
segunda ejecución, y en que el siguiente rojo diga su nombre.

**La intermitente del sprint 17 no se reproduce, y ya tiene cuenta.** Primero el registro: los dos
intentos rojos de CI (el primero de la #297 y el primero de la #298) dicen una sola línea, «waiting for
locator('iframe').first()…[data-section="sec-cover"] to be visible», treinta segundos, y nada más —ni
en qué pantalla estaba la página, ni si el editor había montado, ni si su marco tenía documento—. Dos
hechos del código que ninguna nota tenía: la espera tomaba **el primer `iframe` de la página**, y las
tres tarjetas llevan cada una un `iframe` en miniatura del mismo sitio, con portada, `aria-hidden`
porque son imágenes; y el `waitFor()` no decía nada al caer. Ahora la espera nombra el lienzo por lo
que es —el único marco que un lector puede alcanzar, `iframe:not([aria-hidden])`— y al caer lista cada
marco con su título, tamaño, `readyState`, marca de cableado y cuenta de secciones, el encabezado, el
elemento con el foco y la cuenta de la sonda del editor, que la caminata enciende. Reproducir: la
caminata sola, cinco veces, con la CPU a 20× entre «Crear mi web» y la portada (1,3–1,8 s), y cinco
más con la CPU a 20× desde la primera pregunta (8,0–8,4 s): **diez de diez en verde**. No se da por
hecho que fuera el fallo de montaje del día 7 del 27; el siguiente rojo de CI dirá qué marco había.

**`ontoThePhone` espera al ancho antes que a la columna.** La columna única llega a mitad de la
transición de 260 ms del ancho de la tarjeta, porque la consulta de medios dispara a 720 px con el
marco aún en camino hacia los 320. `deviceArrived` pide tres cosas en una muestra, porque cada una
sola se cumple antes de tiempo: el ancho de maquetación de la tarjeta (`getComputedStyle`, que la
escala no toca) igual al destino en dos fotogramas seguidos, la clase `ui-reflow` fuera —el armazón la
quita en el `transitionend` de `width`— y el visor del propio marco en ese ancho, que es el número que
lee la consulta. La caminata de reordenar en móvil del sprint 24 llevaba su propia espera al ancho del
marco desde el día 5 del 27; es la misma premisa y ahora es la misma función. Las tres caminatas,
tres de tres solas.

**Los once `waitForTimeout` sin razón, uno a uno.** Cada uno quitado, la caminata sola tres veces, y
lo que caía dice qué se movía:

- Los dos `intoTheEditor` (cambio de dispositivo; panel y herramientas) repetían el cuestionario y
  dormían un segundo tras la foto. Ahora son `intoTheCanvas` y las animaciones del editor terminadas
  (`motionSettled`): lo que el segundo tapaba era una entrada aún en marcha contada como movimiento
  de la pulsación medida.
- Los dos de «el interruptor» (1000 y 1700 ms) son la ventana de muestreo de su propio
  `requestAnimationFrame` más un fotograma; se quedan, con la razón escrita.
- La cuarta pestaña: la página que hace el verbo es una pestaña más, y se espera a la cuenta.
- El asa bajo zoom: la entrada del panel terminada y la escala **sondeada** por debajo de 1.
- La letra que llega al documento tras pulsar la pista: el serial, con la cuenta de la sonda si no
  llega. La medida de las fuentes del sprint 26: sin pausa tras `fonts.ready`; cada parche ya se
  esperó, y si la suite del día 8 echa algo en falta, lo que caiga dirá qué era.
- Control+Y con el cursor en la caja del panel (una negativa, «el documento no da un paso»): se
  teclea una letra después y se espera a verla; la pulsación de antes se ha atendido cuando la de
  después se ve, y un paso habría borrado el rehacer. Saboteada la guarda de `shortcuts.ts` para los
  `<input>`, cae donde debe: «Rehacer» deshabilitado.
- **Ctrl+Z dentro de un texto nunca deshacía en esta máquina.** La caminata del sprint 26 decía «el
  deshacer del navegador quita lo tecleado» y comprobaba solo el serial tras 400 ms: en macOS el
  deshacer nativo de Chromium es Meta+Z, así que el titular se quedaba en «UnoDos» y la cuenta era
  verdad en el Linux de CI y no aquí. Ahora pulsa la tecla de la plataforma, espera a que «Dos» se
  haya ido y entonces mira el historial. Saboteada la guarda de `contentEditable`, cae: el titular
  vuelve al original por el historial.
- **Y la que el silencio sí sostenía: el clic en una entrada del menú.** Quitar la pausa de 1500 ms
  dejó la caminata en verde tres de tres —y también en verde **con las dos guardas quitadas**
  (`wireLinks` y el `preventDefault` del delegado de textos sobre un `<a>`): la aserción leía
  `page.frames()` antes de que la navegación del marco cargara el editor dentro de sí mismo. Con la
  pausa, el sabotaje caía a los 2,2 s con el tercer marco. Una negativa no tiene suceso propio; lo
  honesto es esperar al suceso que ocurriría sin la guarda, con el mismo límite: un `framenavigated`
  dentro de 1500 ms es el fallo, y saboteada así cae nombrándolo.

**Lo que el día enseña sobre el método**: de once silencios, siete tapaban una cosa medible y ahora
nombrada, uno no esperaba a nada medido y se queda quitado hasta la suite del día 8, dos eran ventanas
de muestreo sin decirlo, y uno —el único sobre una negativa sin suceso propio— era un límite que hacía
falta y no tenía nombre. Ninguna de las once se declaró arreglada por
una caminata filtrada sola: cada conjunto corrió tres veces, los sabotajes de las tres guardas una vez
cada uno, y la suite completa la corre el día 8.

### Día 6 — las puertas en un móvil (PR de `fix/las-puertas-en-un-movil`)

El plan pedía abrir de verdad, a 320 y a 390, los seis diálogos de la descarga que el sprint 21 dejó
«arreglados leyendo y sin caminar», y escribir el `it.todo` de las migraciones contra la `0012`. Las
dos cosas están; la primera encontró un defecto que el registro no tenía.

**Los diálogos de la puerta vivían dentro del lienzo escalado.** Sembrado un documento por puerta
—siete clases, porque el de contraste dibuja el bloqueo y el aviso—, la primera pasada a 320 dio
cinco en verde y una rara: con texto sobre texto, la pista «Haz doble clic…» salía recortada por la
tarjeta del lienzo. La captura enseñaba otra cosa: **el fondo oscuro tapaba la tarjeta y nada más**,
de 171 a 512 px; la cabecera con «Descargar» y la barra inferior seguían pulsables detrás de un
diálogo que dice `aria-modal`, y en el de texto sobre texto «Volver» y «Descargar igualmente» caían
por debajo de la caja blanca. La causa estaba escrita en el propio armazón desde el 13 de octubre: la
tarjeta lleva `transform: scale(zoom)` cuando el lienzo es más estrecho que la página que dibuja, un
`transform` hace del elemento el bloque contenedor de todo `position: fixed` que lleve dentro, y por
eso la pantalla de construcción se mudó a la ranura `overlay` del armazón. Los seis diálogos de la
puerta y el de «Volver a la original» se quedaron en `children`. A 390 el zoom es 1 y no hay
`transform`, por eso nada lo enseñó ahí; **a 1024 con «Estilo» abierto el diálogo entero se dibujaba
a 0,74 dentro del lienzo**, medido antes de mover nada. Ahora los siete van en `overlay`.

**Lo que la caminata asevera**, en las tres pantallas y las siete puertas: el fondo del diálogo es la
ventana, la caja se dibuja a la escala a la que se maquetó, la caja cabe entera en la ventana en las dos
direcciones, y cada botón que no está dentro de su propia lista desplazable cae dentro de la caja. En
los teléfonos, además, los cuatro ojos de siempre de «nada sobresale en un móvil», y axe a 390. A 1024
el `fit` de teléfono lee las filas desplazadas de la hoja de «Estilo» como cortadas por el `main`, que
es el panel y no la puerta, así que esa pantalla lleva solo las cuatro del diálogo — y asevera su
premisa: la tarjeta tiene `matrix(0.…)`, porque con zoom 1 pasaría con el defecto puesto. **Saboteada**
(los diálogos devueltos a `children`): roja a 320 y a 1024 en las siete, nombrando el fondo
(«8,171–312,512, no la ventana») y la escala («0.95», «0.74»); a 390, verde, que es el zoom 1 de
arriba.

**Sembrados y no preparados con el ratón, que es una desviación del plan.** El plan decía preparar el
contraste y el texto sobre texto a 1024 y luego `setViewportSize`. La caminata mide la puerta, no el
camino hasta ella —ese ya lo andan las de contraste y la del sprint 25—, y un documento con el estado
escrito, en un contexto `isMobile` desde el primer píxel, evita la duda de si se mide un móvil o un
escritorio encogido. Dos cosas que el sembrado enseñó: una palabra larga sola no hace saltar el aviso
de desborde, porque el renderer la parte; hace falta el tamaño de 200 px que teclea la caminata del
sprint 10. Y `motionSettled` esperaba `animation.finished`, que **rechaza** con `AbortError` cuando la
animación se cancela: a 1024 con un panel, pulsar «Descargar» cancela una en vuelo y la guarda lanzaba
en vez de contestar. Una animación cancelada ya no se mueve; ahora cuenta como asentada.

**El `it.todo` de las migraciones, escrito.** Se dejó el 29 de septiembre, con la `0002`, «hasta que
una migración mueva datos»; la `0012` fue la primera, el 18 de octubre, y la `0013` la segunda, y el `todo` siguió ahí.
Ahora son dos pruebas. Contra la `0012`, la que pedía el plan: un documento ya en 1.11.0 que aún nombra
Playfair Display —imposible de fabricar con el producto, y por eso es la sonda: repetir el `up` no se
ve en ningún documento que el paso produjo— conserva su pila. Contra la `0013`, la que de verdad
importa: migrar un documento migrado no cambia nada, y sin el salto la columna 41 pasaría a 321 en
una rejilla de noventa y seis. Saboteado el salto de `migrateToCurrent`, las dos en rojo y solo ellas.

**Fuera, y dicho:** el diálogo de «Volver a la original» se mudó por la misma razón y no se camina
aquí con estas cuatro aserciones; la caminata que lo abre, del 30 de septiembre, lo hace a 1280 con
«Diseño» abierto y mira lo que dice, no dónde se dibuja.

### Día 7 — el colchón del 28: una fila es un mínimo (PR de `fix/el-colchon-del-28`)

**Primero la medida de David, antes de tocar nada.** Portada hecha a mano, ventana de 1280 × 900,
«Diseño» abierto: el panel estrecha la sección de 912 a 692 px y el titular pasa a dos líneas (de 52 a
104 px). Confirmado ahí, el reajuste del alto del sprint 25 día 6 escribía **13 filas donde había 7**.
Cerrado el panel, el titular vuelve a una línea, las seis filas de más se quedan vacías y el subtítulo
queda a **52 px** donde iba pegado. Su umbral era 8: defecto del ADR 0050. Y de camino, con el panel
abierto, **una letra más en el titular bajaba el hueco de 48 px a 0**, porque el reajuste ceñía las
filas al texto crecido y se comía las dos filas vacías de debajo — el mismo mecanismo visto del otro
lado.

**Tres arreglos con su precio, y su decisión.** El ancho fijo, que arregla este síntoma y cualquier otro
remaquetado por panel al precio de los tres zooms del día 1; medir el texto al ancho sin panel, que
arregla este síntoma y deja el lienzo remaquetando; o quitar el reajuste y que el contenido empuje,
que revierte su propio ajuste 1 del sprint 25. Eligió el tercero con tres condiciones: `rowSpan` es un
mínimo y el ADR 0050 lo dice así («una fila mide 8 px o lo que su contenido necesite, en el editor y
en la web publicada por igual»); verificar antes de quitar nada que `rowAt`, el anuncio en píxeles y
las guías leen las pistas resueltas y no fila × 8; y las dos medidas de hoy como aserciones, más la de
siempre del arrastre. **Las tres están.** La verificación, escrita en la enmienda del ADR: `rowAt`
anda `gridTemplateRows` resuelto, el anuncio sale de la caja medida, las guías de los rectángulos
vecinos, y el redimensionado pasa por el mismo `rowAt`. Lo que se va: `rowsFor`, el cuarto argumento
de `onEditText`, el `rowSpan` de la acción `editText` y `withRowSpan`; `editText` vuelve a ser las
palabras y nada más. La línea del panel dice ahora «filas de 8 px, o de lo que su contenido necesite».

**La caminata, y lo que vio en rojo.** «sprint 28 día 7 — una fila es un mínimo», 1280 × 900, cinco
aserciones y una premisa: con «Diseño» abierto el titular es de dos líneas (aseverado, porque sin eso no
hay fila crecida que medir); una letra más deja el hueco al subtítulo a menos de una fila del que había;
un cuerpo que crece a cuatro líneas conserva su hueco hasta el botón y lo baja consigo; el botón
soltado 40 px bajo esa fila crecida queda a menos de una fila de la mano y ni un píxel de lado; y
cerrado el panel el hueco vuelve al medido antes de abrirlo. Contra el editor sin arreglar, roja en el
primer hueco con el número medido: «0 px donde estaba en 48». **Saboteada dos veces** después del
arreglo: el reajuste vuelto a poner a mano, la misma roja; `rowAt` leyendo fila × 8, el botón «184 px
más abajo» donde la mano bajó 40 — que es lo que la condición 2 temía, visto. La caminata del sprint 25
día 6 que aseveraba el reajuste asevera ahora que las filas se quedan quietas a través de una edición
larga y su «Deshacer»; sus tres pruebas unitarias, igual.

**Lo que esto renuncia, dicho.** En el editor, las filas bajo un texto que se parte ya no miden ocho
píxeles cada una: las tres del cuerpo de cuatro líneas miden unos diecinueve. Es el precio de una
sección que se lee igual con panel y sin él, y la condición 2 es lo que lo hace seguro.

**Dos trampas de la caminata.** Entrar en escritura selecciona las palabras enteras (ADR 0047), así que
`End` + una letra dejó el titular en «s»: se teclea el titular entero con una letra más. Y el cuerpo de
la portada ya ocupa dos líneas con el panel abierto, así que «más largo» tuvo que ser cuatro líneas para
que la fila creciera de verdad.

**El ancho fijo no se construye, y este síntoma ya no lo pide.** Con el `rowSpan` como suelo, un texto
que se parte distinto entre estados del panel mueve solo lo que tiene debajo, y exactamente lo que
creció. Sus tres zooms se quedan en el backlog por si otro síntoma lo pide. **No se midió** `lookAhead`
en una instancia fría de Render: el plan lo dejaba a que David diera la URL, y no la dio.

### Día 8 — el cierre (PR de `test/el-cierre-del-sprint-28`)

**Las medidas de cierre.** La suite `e2e` completa: **256 pasan / 1 omitida, 1047,13 s**, a la primera,
en batería bajo `caffeinate -i` y con nada en paralelo; es la primera ejecución completa con la
caminata del sprint 25 día 6 reescrita el día 7 y con la del propio día 7. Lighthouse sobre las tres
composiciones del restaurante, móvil: **v1 100 / 100 / 100 / 100, v2 99 / 100 / 100 / 100 y v3 99 / 100
/ 100 / 100** (rendimiento, accesibilidad, buenas prácticas, SEO), y la ficha de
`una-pagina-por-ficha` 100 en las cuatro. Buenas prácticas pasa de 96 a 100 en todas, que es el
favicon del día 4; los dos 99 son el LCP de 2,18 s de las composiciones con la foto de fondo y a la
izquierda (`largest-contentful-paint` 0,95), los mismos que el sprint 27 medía en v2 y v3. axe: **538**
en verde, en local, porque el día 4 cambió la salida del renderizador.

**El `link-text` de la landing, confirmado.** Lighthouse móvil sobre `/`: `link-text` en 1 y sin
entradas, donde el 17 de octubre listaba «Empezar». El SEO de la landing pasa de 0,54 a **0,63**, y lo
único que cae es `is-crawlable`, el `noindex, nofollow` que `layout.tsx` pone a propósito.
Accesibilidad 100.

**El ZIP, contra el del inicio del sprint.** Los diecinueve documentos del corpus, construidos como
descarga con el publicador de `9cb3781` (la fusión de la #302) y con el de hoy. Los diecinueve ZIP
difieren, y la diferencia es exactamente la que el ADR 0054 anunciaba: cada sitio gana `favicon.svg`
(258 bytes; 259 en `edge-long-text-unicode`, cuya letra es una «Ñ» de dos bytes), y cada una de las
**35 páginas** gana una línea, `<link rel="icon" type="image/svg+xml" href="favicon.svg">`, justo
después de `<title>`; quitándola, el HTML es el del inicio byte a byte. Los otros 44 ficheros —letras,
licencias, imágenes— no cambian. El guion de muestra (`pnpm site:sample`) no sirve para esto: no recoge
las imágenes de las listas y se para en `assets/rosario.svg`. El que se usó lee cada `src` del
documento.

**Las nueve fotos, su estado** (el ajuste 4 de David). Nada cambió en el sprint. Las nueve del banco de
`restaurante-bar` siguen bajo el suelo de 1600 × 1072 —ocho a 1024 × 1024 y la 07 a 866 × 942— y
publicadas por la exención del ADR 0035, que deja de valer el **1 de diciembre** (la #293 se fusionó el
25 de octubre). Las dieciséis PNG de la raíz del repositorio son las del 11 de octubre, todas de 1024 de
ancho: ninguna llega al suelo, así que ninguna puede sustituir tal cual a una del banco. Quedan 35 días,
y el remedio sigue siendo regenerar, nunca mover la fecha.

**Lo que el cierre encontró al medir, y deja medido.** El día 7 quitó el reajuste del alto al escribir,
pero escalar mide las cajas vivas (ADR 0050, día 2), así que **escalar con «Diseño» abierto todavía
guarda el ancho del panel**. A 1280, la portada escalada con el panel abierto escribe 13 filas para el
titular (104 px, a dos líneas) y el hueco hasta el subtítulo es de 16 px; al cerrar el panel el titular
cabe en una línea (52 px) y el hueco pasa a **95 px**. Escalada con el panel cerrado, el día 7 midió 52
y 48 en los dos estados. Es la otra puerta del mismo defecto, y lo decidido el día 7 no la cubre: David
eligió quitar el reajuste del alto tras editar un texto, y cambiar cómo mide una sección al escalarse es
otra decisión. Va primera en la lista de abajo.

**Los números del registro, al día.** `Editor.tsx` tiene **8095** líneas al cierre, y el `e2e`
**21 675** (1 118 465 bytes, el 53 % de los 2 MiB que Biome procesa desde el día 1); la suite cuenta
257 pruebas. En CI, el sprint tuvo diecisiete ejecuciones y tres rojas, las tres con causa: el día 1, la
maquetación de Linux en la caminata del panel; el día 2, «pasa por anchos intermedios» una vez; el día 4,
las dos caminatas que comparan la lista exacta del ZIP con el favicon nuevo. La intermitente del sprint
17 no volvió en ninguna.

### Lo que el sprint 28 deja abierto

1. **Escalar con un panel abierto guarda el ancho del panel**: el hueco bajo el titular pasa de 16 a 95
   px al cerrarlo (arriba). Dos caminos con su precio, para David: el ancho fijo del día 1, que lo
   arregla para toda medida del editor al precio de los tres zooms (0,707 / 0,782 / 0,834), o medir
   al ancho sin panel solo al escalar, que arregla esta puerta y deja el lienzo remaquetando.
2. **Doce firmas**, todas `proposed`: **0042, 0043, 0045, 0046, 0047, 0048, 0049, 0050, 0051, 0052,
   0053 y 0054**.
3. **Las nueve fotos**, antes del 1 de diciembre (arriba).
4. **Safari y el favicon**: sin comprobar en un dispositivo. Se suma a la lista de Safari en iPhone de
   la PR #250; si Safari no dibuja el SVG, el siguiente paso es un PNG al lado (ADR 0054).
5. **`lookAhead` en una instancia fría de Render**: sin medir, porque hace falta la URL del despliegue.
6. **El diálogo de «Volver a la original»** se mudó a `overlay` el día 6 y no se camina a zoom menor
   que 1.
7. **El Tab nativo desde un texto en escritura** sigue sin llegar al asa (del sprint 27).
8. **Los contornos a escala**, aceptados como los dibuja Chromium (ADR 0053).
9. **Fuera por el plan, y nombrados en él**: el cambio de diseño a 720 de alto, `overflow-x: clip`,
   los 172 px entre «Precios», `fetchpriority`, el logo como favicon o un PNG, y partir el `e2e` o
   renombrar su `let page`.

## Sprint 29 — «La letra de la marca» (desde el 28 de octubre de 2026)

David, con la #310 fusionada: su jefe quiere que la herramienta tenga «una muy amplia selección de
fuentes» para titulares y textos, que el panel derecho deje de alargarse al crecer la lista, y que
el cliente pueda importar la fuente de su marca cuando no esté. Cuatro decisiones suyas al planificar
—unas cuarenta familias que «se navegan, no se recorren», con la sustituta de cada una escrita en la
encuesta; las de nombre reservado siguen fuera y una línea discreta explica por qué; la fuente propia
en uno o dos archivos y cuatro formatos con cinco condiciones; y la fuente propia viaja con la
cuenta— y siete ajustes al aprobar, todos sobre bytes ajenos: tope de expansión del brotli, sesión en
la ruta que inspecciona, el fichero de licencia también olfateado, el rango real de una variable, una
sesión del diálogo como un paso del historial, la CSP del lienzo para `blob:`, y el tipo del bucket
desde el olfateo. El plan está en `~/.claude/plans/pr310-fusionada-redespliegue-ejecutado-warm-llama.md`.

### Día 1 — el selector, solo (PR de `feat/el-selector-de-letra`)

**Un cambio de modelo de interacción va primero y solo.** La galería dejaba de caber en el panel: dos
grupos de radios, una fila de 48 px por familia y por mitad, dieciséis hoy y ochenta con cuarenta.
Antes de añadir una sola familia, la lista sale del panel y el panel se queda con **dos filas**,
«Titulares» y «Texto», cada una con el nombre de la familia dibujado en su propia cara y un
«Cambiar» (`aria-label` «Cambiar la letra de los titulares» / «…del texto»). Cuando la mitad no
nombra una familia enviada, la fila la nombra por la pareja y nunca por la fuente —«La letra de
«Clásica y seria»»— y se dibuja en la pila del tema, que es lo que esa máquina da (incidencia #9). La
altura del panel ya no depende del número de familias.

**«Cambiar» abre un diálogo en el `overlay`** (`FontChooserDialog.tsx`, el décimo `aria-modal`, con
`useFocusTrap`): título por mitad, un campo de búsqueda con el foco inicial, tres chips de carácter
que son radios nativos («Todas», «Sin remates», «Con remates»; un solo tabulador, las flechas
cambian el filtro), un contador `aria-live` («8 letras», «1 letra», «Ninguna letra se llama así.»),
y la lista: **un** grupo de radios con una fila de 64 px por familia donde **el nombre es el
especimen** —dibujado en su cara a 18 px, sin el `Aa` oculto— y debajo, en la misma cara, **el nombre
del negocio** (`doc.siteName`; «Así se leería tu web.» si está vacío), que es la condición de David.
El pie es «Hecho». Se rechazaron el popover anclado (un `fixed` dentro de `children` lo captura el
`scale` del lienzo, lo que el 28 día 6 acaba de pagar, y a 390 no cabe) y la lista con scroll dentro
del panel (scroll dentro de scroll en la hoja móvil, ochenta filas montadas que descargan cuarenta
caras al desplegar). Radio y sombra solo por tokens `--ui-*`; en móvil, hoja desde abajo a 85dvh.

**La búsqueda no desmonta nada.** `fold()` sale de `Step2Sector.tsx` a `editor/fold.ts` (tercer uso
con el del catálogo): «GARAMÓND» encuentra «EB Garamond». Las filas que no casan llevan el atributo
`hidden` y no el `order:1; visibility:hidden` de la rejilla de sectores: aquí el campo está en una
cabecera que no se desplaza y nada puede saltar, y un radio en `display:none` lo saltan las flechas,
así que las flechas recorren solo los aciertos; el `preflight` de Tailwind pone `[hidden]` con
`!important`, que es lo que deja al `flex` de la fila sin mando. Dicho en el componente, porque la
próxima mano irá a por el truco de la rejilla.

**Las caras llegan por fila** (condición 1 de David). `galleryFaceCss(families)` acepta la lista;
el diálogo monta un `<style>` solo con las familias **reveladas**: las ocho primeras visibles y la
elegida al abrir (`initiallyRevealed`), y después las que un `IntersectionObserver` sobre la lista
(`rootMargin: 240px`) ve acercarse. El conjunto solo crece y se desmonta con el diálogo —por eso un
`<style>` y no la API `FontFace`, que exige que se le diga que olvide—. Con ocho familias la primera
pantalla es la tabla entera, así que lo que la caminata prueba hoy es la cota y no la pereza: nada
servido antes de abrir, todo servido tras bajar la lista hasta el final. El día 2 la misma caminata
deja de ser vacía sin cambiar una línea. Las dos filas del panel declaran solo las caras que dibujan.

**Una sesión del diálogo es un paso del historial** (ajuste 5 de David). Elegir es en vivo —el
`onChange` escribe el token y el lienzo repinta detrás; sin «Aplicar»—, pero cuarenta filas bajo una
flecha serían cuarenta pasos. Tres verbos nuevos en `documentHistory.ts` sobre el mismo `amendable`
con que el tecleo en un campo ya amalgama su paso: `chooseFamily` abre el paso y lo enmienda mientras
la causa sea la misma mitad; `settleChooser` («Hecho») lo cierra; `discardChooser` (Escape) lo quita
y **devuelve la letra que había al abrir**, y no toca nada si no hubo elección ni si la sesión ya se
cerró. Deshacer y rehacer ya apagan `amendable`, así que un Ctrl+Z con el diálogo abierto no se come
un paso ajeno. Nueve tests en `documentHistory.test.ts`; la caminata sin ratón baja cinco filas, pulsa
Hecho y **un solo «Deshacer»** devuelve la letra; baja tres, Escape, y la letra y el historial están
como al abrir, con el foco **de vuelta en «Cambiar»**, que es lo que esa caminata no afirmaba antes.

**Lo que se quitó.** `galleryStartsOpen`, `chosenFamilyText` y la línea «{heading} en los titulares y
{body} en el texto.» con sus tests y sus claves; «Las ocho letras…» pasa a `familiesHelp` con `{n}`
leído de la tabla. `modalTrap` cuenta diez y sus dos registros que lo nombran se corrigieron
(`useFocusTrap.ts`, `el-recorrido-de-la-cuenta.md`); los otros dos de la lista son prosa fechada de
los sprints 17 y 25 y se quedan como estaban.

**Tres cosas que el e2e encontró en el test y no en el producto**, en tres pasadas filtradas: el
diálogo tiene once radios y no ocho, porque las tres chips también lo son (se cuenta el grupo de la
lista por su nombre); el nombre accesible de cada fila incluía la palabra de la especie («Bitter Con
remates»), y la especie es visual —las chips ya la dicen—, así que va `aria-hidden` y el radio se
llama solo por la familia; y «Con remates» resolvía a cinco elementos, la chip y cuatro insignias (se
pulsa dentro del grupo «Qué carácter»). La caminata sin ratón y la de 390 pasaron a la primera.
Saboteos: sin la rama que enmienda, dos tests del historial en rojo; con la hoja ignorando la lista
que se le da, dos de `letterGallery` en rojo. Ambos deshechos por script.

**La caminata sin ratón deja de esperar «Figtree».** «La que sigue a EB Garamond» era Figtree con
ocho familias alfabéticas; con cuarenta es la que admita la encuesta, así que la caminata lee del DOM
la familia del radio siguiente al marcado antes de pulsar la flecha.

**Medidas del día.** `pnpm test` 3096; `test:invariants` 27; `test:golden` 23 sin movimiento (la
salida del renderer no cambia); `renderer:deps`, `schema:guard`, `secrets:scope` (112 módulos, 28 de
cliente, sin cruce) y `size` iguales que ayer; `a11y` local 538 en 30 s; **e2e completo 256 verdes y
1 omitido en 1042 s, a la primera**, tras tres pasadas filtradas del bloque del día (90, 21 y 15 s)
que corrigieron el test y no el producto.

### Aparte, antes del día 2 — Libre Baskerville reservaba su nombre (PR de `fix/la-licencia-de-origen`)

**Lo encontró la encuesta del día 2 antes de admitir una sola familia.** Para medir unas noventa
candidatas, la encuesta leía, como la 0046, el `LICENSE` que trae cada paquete de `@fontsource`. Al
cruzarlo con el `OFL.txt` que google/fonts distribuye junto a esos mismos ficheros, **diez de 92 no
coinciden**: el `LICENSE` del paquete compone su línea de copyright con lo que dice cada fichero de
fuente, y ahí se pierde la reserva de nombre que el titular declara. Una de las diez era **Libre
Baskerville, que enviamos desde el sprint 24**: su `OFL.txt` dice «with Reserved Font Name Libre
Baskerville», y lo que viaja es la porción latina en woff2 con ese nombre, el mismo caso que sacó a
Playfair Display en la 0045. El filtro de la 0046 la dejó pasar porque leía el texto equivocado. Al
preguntar dije «12 de 92»; recontado antes de escribirlo, son diez.

**Las decisiones de David, el 27 de octubre**, en dos rondas de respuestas:

- **Libre Baskerville se retira en esta PR, que se fusiona antes que la del día 2**, con migración.
- **La sustituta es Gelasio**, por las métricas de Georgia: «es lo que menos mueve una web ya
  descargada». Yo propuse primero Source Serif 4 y la retiré antes de escribir código: el `OFL.txt` de
  google/fonts no reserva nombre, pero el `LICENSE.md` del propio Adobe reserva ‘Source’. Se ofreció
  también la hermana de nombre, Libre Caslon Text, y no se eligió.
- **Bitter se queda**, con la lectura fechada: reserva «Bitter Pro» y presentamos «Bitter».
- **La licencia que viaja es la del titular** y vive en el repositorio con el commit del que salió.
- **Una familia entra solo si google/fonts y el repositorio del autor coinciden** en no reservar el
  nombre que presentamos. Si discrepan, queda fuera hasta que alguien lo aclare.

**Lo que cambia.**

- **Migración 0014, esquema 1.12.0 → 1.13.0.** Cambia la pila entera de Libre Baskerville por la de
  Gelasio en cualquiera de las dos mitades, porque la galería dejaba elegirla para titulares o para
  texto. La pila nueva lleva el repliegue de la antigua palabra por palabra (Georgia, Cambria, 'Times
  New Roman', Times, serif), así que un visitante sin la cara ve lo mismo que veía. David escribió la
  pila más corta («'Gelasio', Georgia, serif»); se construyó la de galería, que conserva todo el
  repliegue y hace que una web migrada y una que elija Gelasio a mano publiquen lo mismo. Está dicho
  en la ADR por si no era eso.
- **Los diez tests de la migración incluyen los de la 0012 completos**, como pidió David: la pila
  entera pasa a Gelasio, migrar dos veces da lo mismo y un documento sin ella no se toca. A eso se
  suman cada mitad por separado, el salto sobre un documento que ya es 1.13.0, el `down` y el recuento
  del corpus (ningún fixture la nombra).
- **Las licencias de los titulares, en el repositorio.** `pnpm fonts:licences` trae el `OFL.txt` de
  google/fonts de cada familia enviada a `packages/publisher/licences/`. Lo trae a un commit fijo, y en
  `sources.json` quedan ese commit, el repositorio del autor (el que google/fonts nombra en su
  `METADATA.pb`), el commit al que se leyó su licencia y su línea de copyright. Las ocho de hoy tienen
  las dos lecturas. `fontData.ts` se genera desde esos ficheros, y un test comprueba byte a byte que el
  ZIP lleva la del repositorio y no la de `@fontsource`; hoy difieren las ocho.
- **El filtro compara el nombre reservado con el presentado**, en `packages/publisher/src/licences.ts`
  y con sus propios tests: «Source Sans 3» usa ‘Source’, y «Bitter» no usa «Bitter Pro».

**Para el CEO, por si un cliente pregunta: un ZIP ya descargado con Libre Baskerville no se puede
corregir desde aquí.** El editor no publica en ningún servidor nuestro; una web solo sale de aquí como
descarga, y la que esté en el disco o en el alojamiento de un cliente conserva la letra y la licencia
con que se generó. Si ese cliente vuelve a descargar, la web sale en Gelasio. Las webs que siguen en el
editor, en el navegador o en la cuenta, cambian solas al abrirse.

**Saboteos, siete, todos en rojo y todos deshechos por script:**

1. El generador vuelve a leer el `LICENSE` del paquete: rojo el test byte a byte y el del ZIP.
2. Una reserva añadida al texto de google/fonts de Gelasio: rojo el filtro.
3. Una reserva añadida solo a la línea del autor, la discrepancia: rojo el filtro.
4. Una licencia huérfana `libre-baskerville.txt`: rojo el test que exige una licencia por familia y
   ninguna más.
5. La migración solo en titulares: rojo «cada mitad por separado».
6. La migración sin repliegue: rojo «la pila entera pasa a Gelasio».
7. La migración sin registrar: rojo todo lo que espera la versión actual.

**Lo que cuesta.** Las webs que eligieron Libre Baskerville cambian de letra. En peso no cuesta nada:
Gelasio pesa 40,4 KB con su licencia frente a 41,5, y la pareja más pesada sigue siendo EB Garamond e
Inter, con 98,7 KB. Las ocho licencias y `sources.json` ocupan unos 38 KB en el repositorio. **La
migración del día 4 pasa a ser la 0015 (esquema 1.14.0).**

### Día 2 — la galería se navega: una tabla, veinticinco familias (PR de `feat/la-galeria-se-navega`)

**Lo que ve el CEO.** El selector de letra ofrece **veinticinco familias** en vez de ocho: catorce
sin remates, siete con remates y cuatro de remates gruesos. Hay un chip nuevo, **«Remates gruesos»**,
donde ahora está Bitter, que antes salía en «Con remates». Entre las nuevas están **Montserrat,
Poppins, Roboto y Open Sans**, las que piden los clientes.

**La encuesta, y lo que desmontó.** `pnpm fonts:survey` lee 109 candidatas desde los paquetes
publicados, sin ejecutar nada ni escribir en el repositorio, y admite 78. El filtro 2 se lee de los
titulares: el `OFL.txt` de google/fonts y la licencia del repositorio del autor, con el nombre
reservado comparado con el presentado. Es la regla de la PR aparte de antes de este día, la de Libre
Baskerville. El plan daba por hecho que Montserrat y Poppins reservaban su nombre y que Roboto era
Apache: **no es así** en ninguna de las dos lecturas, y la línea preparada para la galería («Montserrat,
Poppins, Lato y otras no se incluyen…») habría mentido. David decidió que las cuatro más pedidas entren
**dentro del cupo de catorce sin remates**, con la sustituta de Inter, Roboto y Open Sans entre ellas.
Quedan fuera:

- **por nombre reservado:** Lato, Raleway, Lora, Merriweather, Source Sans 3, IBM Plex y PT;
- **por discrepancia entre las dos lecturas:** Playfair Display y Source Serif 4;
- **por no tener 700 real:** Bebas Neue, Anton y Archivo Black.

Para el sprint 30 queda medido cuánto pesaría la cara completa de las reservadas más pedidas (Lato
+11 KB, Playfair +59, Raleway +99, Lora +131, Merriweather +183). Seguiría siendo un cambio de formato,
que no cura el §3. La encuesta entera es el apéndice de la ADR 0055.

**Una sola tabla.** `packages/schema/src/fontGallery.ts` es la única lista escrita a mano: familia,
especie y sustituta. El renderer, los tokens y el publisher la derivan. Las ocho pilas y las dieciséis
fuentes de hoy salen **idénticas byte a byte**, comparadas contra las escritas a mano, así que ningún
documento cambia y ningún golden se mueve. Cada fila lleva su sustituta de la misma especie, ya en la
tabla, como condición de David: retirar una familia queda en una migración mecánica, como la 0014. Un
test lo exige fila por fila, junto con el cupo de catorce sin remates. Las especies son cuatro (sin
remates, con remates, remates gruesos y de cartel), y los chips del selector salen de las que la tabla
tiene: «De cartel» aparecerá sola el día 3, con la primera familia de titular.

**Los bytes, partidos.** `fontData.ts` (467 KB en un solo módulo) pasa a ser `fontData/`: un módulo por
paquete, de 27 a 76 KB, y un índice. En total son 1,3 MB. El generador borra el módulo de un paquete que
la tabla ya no nombra, y un test rechaza un huérfano leyendo el directorio. Las diecisiete familias
nuevas están fijadas exactas en los dos `package.json`, y un test lo comprueba. Sus licencias son las
de los titulares, con su commit.

**El techo de las caras se comprueba solo.** `pnpm size` pesa cada familia como la lleva un ZIP y
falla si el techo queda por debajo de la pareja más pesada. Esa pareja es hoy **Zilla Slab con Libre
Caslon Text, 104,3 KB**; antes era EB Garamond con Inter, 98,7 KB. El techo pasa de 115 a **120 KB**,
con el margen de unos 16 KB de la 0046.

**Un defecto que solo existía con más de ocho filas, y que encontró el e2e.** Con veinticinco familias
la lista ya no cabe en el diálogo. **El `fieldset` que desplazaba la lista no recortaba lo que
pintaba**: Chromium lo maqueta bien (la caja acababa en 800 px de una ventana de 900) y luego pinta sus
filas por debajo, sobre «Hecho», que dejaba de recibir el clic. Se midió en el navegador con
`elementFromPoint` y una captura, y se arregló: el `fieldset` sigue siendo el grupo y la leyenda, y un
`div` a su alrededor hace el desplazamiento y el recorte. Ese `div` es también la raíz del
`IntersectionObserver`.

**La caminata de la galería prueba ahora la pereza, no solo la cota.** Con ocho familias la primera
pantalla era la tabla entera. Ahora el e2e afirma que **abrir el diálogo no pide la cara del pie de la
lista** (Zilla Slab), baja la lista fila a fila como una persona y entonces exige que llegue cada cara.
Saltar de la cabeza al pie con un solo `scrollIntoView` dejaba sin ver las filas del medio, y el
observador hace bien en no pedirlas. La lista de familias del e2e sale de la tabla, con un suelo literal
de 25 y cuatro familias nombradas.

**Saboteos, nueve, todos en rojo y deshechos por script:**

- una sustituta de otra especie;
- una sustituta que es la propia fila;
- una decimoquinta familia sin remates;
- un módulo huérfano `playfair-display.ts`;
- un rango `^5.3.0` en el `package.json` de la raíz;
- los chips escritos a mano en vez de derivados;
- un techo de 100 KB, por debajo de la pareja más pesada;
- un slab que cae a sin remates;
- en el e2e, el diálogo revelando todas las filas al abrir, que dio «Zilla Slab… was fetched by
  opening the dialog».

**Un arreglo a la PR aparte, ya empujado a ella.** Cuando no se localiza la licencia del autor, ahora
manda solo la de google/fonts. Antes la familia quedaba fuera igual, pero con el motivo de
«discrepancia», cuando el motivo era el nombre reservado (Arvo, Passion One).

**Medidas del día.**

- `pnpm test`: 3126.
- `test:invariants`: 27.
- `test:golden`: 23, sin movimiento.
- `typecheck` y `lint`: en verde.
- `renderer:deps`, `schema:guard` («the document's shape is unchanged») y `secrets:scope` (112 módulos,
  28 de cliente, sin cruce): en verde.
- `size`: en verde, con la pareja más pesada en 104,3 KB frente a 120.
- **e2e completo: 257 verdes y 1 omitido en 1052 s.** Antes hubo dos pasadas filtradas: la que encontró
  el defecto del `fieldset` y la del sabotaje.
- Con el arreglo, la hoja a 390 px y el diálogo a 1440 px se miraron en captura, y «Hecho» es el
  elemento que hay bajo su propio centro.
