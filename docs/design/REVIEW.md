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
