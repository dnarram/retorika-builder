# 0085 — An element has a place in the stack, under a ceiling

**Status:** proposed · **Date:** 2026-11-26 · **Decided by:** David, 25 de noviembre de 2026, planning
sprint 41 «Estirar, agrandar y mover»: «traer al frente y enviar atrás» among what the sprint takes; of
whether a text may end up under a photograph, *«Sí, con aviso»* — free order, and what a photograph
covers warned before the download, never blocked; and, rejecting the first plan, two adjustments on
this day: *«las capas tienen techo. Una sección con algún `layer` crea su propio contexto de
apilamiento: ningún elemento traído al frente se pinta sobre la barra fija, sobre la hoja del menú del
móvil ni fuera de su sección. En una sección con fondo con motivos, el velo del 40 sigue por debajo de
todo lo colocado. Prueba en Chromium con la fixture `capas` más barra fija y fondo; saboteo: quitar el
contexto»* and *«lo tapado no es solo texto. El aviso antes de descargar cuenta también botones,
enlaces, «Cómo llegar» y campos de formulario que quedan bajo una foto: siguen recibiendo el foco con
el teclado y no se ven»*. The plan carried *h* as a default he could veto: the two verbs go to the
extremes, with no step in between. · **Recorded by development, with the standing note that
development does not sign.** · **Relates to:**
[ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md) (overlaps are
allowed; «no bring to front this sprint… it will need a field»), [ADR 0081](0081-a-background-with-motifs-carries-its-measured-veil.md)
(a section's veil), [ADR 0068](0068-the-fixed-bar-can-say-how-much-has-been-read.md) and
[ADR 0065](0065-the-phones-sheet-holds-the-page-still-without-a-byte-of-script.md) (what must stay on
top) · **Touches:** `packages/schema` (1.24.0, migration `0025`), `packages/renderer`, `apps/editor`.
**One golden is new — `capas`; the other 28 are byte-identical.**

## Context

Since ADR 0050 día 3 an element can be dropped onto another, and the stack was the document's: the
renderer's `.rb-panel ~ :not(img) { z-index: 2 }` put every word above every photograph, and
photographs among themselves painted in document order. ADR 0050 said what changing that would take:
«a later decision may add a control, and it will need a field».

## Decision

### 1. `layer` on a placement, and absent is the order every site has always drawn

`placementSchema.layer?`, a whole number from 1 (the bottom) to 999. **Absent everywhere is the default
stack: photographs under everything else, each group in document order** — exactly what the stylesheet
has drawn since the panel, now said once in `stackingFor`. `bringToFront` and `sendToBack` write the
whole section's stack densely, 1 to n; **a stack put back to the default loses every layer**, so «nobody
reordered» is a stored fact and a section brought back publishes its old bytes. A placement added after
somebody reordered keeps its default place, and ties fall back to the default: the order is total and
deterministic whatever the document holds. The verbs go to the extremes (default *h*), present in
«Colocación» only on an element that crosses another — absent, not disabled — and each press is one step.

### 2. Painted with a ceiling (David's adjustment 1)

In a section whose placements carry layers, every placed element paints at `z-index` **twice its place**,
and the panel behind words over a photograph at the odd number under the lowest of them — **only under
what sits above the photograph it crosses**: a text sent behind one gets no panel, it is covered, and the
review says so. **The section is its own stacking context** (`rb-layered`, `isolation: isolate`, no
`z-index`), so whatever numbers its elements carry it stays at the page's own level: under the sticky
bar's 2, and nothing brought to the front reaches outside the section. A section's background with motifs
is isolated already (ADR 0081), and its veil — `::before` at `z-index: -1` — stays under everything placed.
In the editor a layered section, while chosen, rises to `z-index: 1`, still under the bar, so the menus
that hang from it are not covered by the next section.

**What the browser suite holds, and what it found.** On `capas` (a sticky bar with a pages sheet, a cover
with a background, its photograph over a button and a headline over both): the pointer meets the
photograph over the button, the headline over the photograph, the photograph where the veil is; scrolled,
it meets **the bar** over the photograph; at 390 with the sheet open, the sheet. **Sabotaged, the ceiling
went red only once the case had a section without a background** — the background's own isolation was
hiding it — and the test now runs both. **The sheet case holds with no ceiling at all**: the phone's sheet
rises above the page by its own rule (ADR 0065); it stays as a guard, and this says why it cannot be the
proof.

### 3. What a photograph covers is warned, and it is not only text (David's adjustment 2)

`coveredByPhoto` lists **every visible placed thing that is not a photograph** — a text, a button, a link,
the map, a field, a list — whose area crosses a visible photograph painting above it. The download's review
that warns about text over text names them too, by kind and words: «El botón «Reservar», debajo de la foto
«…»». **It never blocks**, which is David's «Sí, con aviso»; the foot says how to undo it from
«Colocación». Without layers it finds nothing: photographs paint under everything by default.

### 4. Schema 1.24.0, migration `0025`

`up` seals; `down` drops every layer, and a text sent behind a photograph comes back above it — lossy, said.

## What is preserved

- **Rule 4**: a place in the stack is a number among a section's elements, never a coordinate.
- **Reading order**: the markup is never reordered, so a screen reader and the phone read as before; on
  a phone nothing overlaps (the shared block puts every child in its own row).
- **Every saved site, byte for byte**: none carries a layer.

## What is lost, and it is named

- **A step at a time.** «Una capa más arriba» is not offered; the two extremes are.
- **The sheet case is a guard, not a proof**, as §2 says.

## What this does not decide

- A stack for a card's elements (a card has no placements).
- Blocking a covered element. David chose a warning.

## Consequences

- `packages/schema`: `document.ts` (`layer`, 1.24.0), `layout.ts` (`stackingFor`, `isLayered`,
  `bringToFront`, `sendToBack`), `overlapping.ts` (`coveredByPhoto`), migration `0025` and its block,
  `test/stacking.test.ts`, the snapshot.
- `packages/renderer/src/build.ts`: the stack's `z-index`, the panel under what is above, `rb-layered`
  and `layeredCss`; `test/stacking.test.ts`, `test/stacking.browser.test.ts`. Sabotages: no isolation
  (the bar), `z-index` on the photograph only (the headline), the covered check reading text only (the
  unit test), and the verbs always present (the walk).
- `apps/editor`: the two verbs in «Colocación», the history actions, the gate's `covered`, the dialog,
  eighteen keys in `es.json`; the walk «sprint 41 día 7».
- `fixtures/documents/capas.json` and its golden; the counters of fixtures with a header, a free section,
  a background and a panel know it.
- The record is `docs/design/REVIEW.md`, sprint 41 día 7.
