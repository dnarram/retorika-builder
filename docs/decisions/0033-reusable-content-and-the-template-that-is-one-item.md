# 0033 — Reusable content, and the template that is one item

**Status:** **proposed** · **Date:** 2026-10-02 ·
**Decided by:** David, 2 October 2026, planning sprint 14 — given the choice of what «closing the
editor» means and choosing «colecciones + pulido», then settling four of this file's decisions by
answering questions about them ·
**Awaiting:** his signature on this file ·
**Touches:** [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) (which
deferred collections by name), the advanced dossier §4, §6 and §7, document rules 1, 3 and 5,
[ADR 0013](0013-services-cardinality.md) (the cardinality this has to respect),
[ADR 0027](0027-a-mark-moves-with-the-text-under-it.md) (whose one escaping path this reuses) and
[ADR 0001](0001-static-published-sites.md) (which this does not bend)

> **`proposed` is literal.** David chose the shape and answered four questions about it; he has not
> read this file. Development does not sign on anybody's behalf.

## Context

### The last pillar, and it was deferred by name

The protocol's Fase 3 is «**modo estudio completo: rejilla, sistema de estilo, control por
dispositivo, colecciones, interacciones**». Four of those five are decided: the grid shipped in
sprint 8, the style system in sprints 4 and 9 and its fifth property in 13, and per-device control
is built for mobile with the tablet deferred by [ADR 0030](0030-one-breakpoint-bucket-and-the-width-the-gate-measures.md)
with its reason written. **Collections are the one with nothing at all**, and ADR 0025 said so in
its own list of what it does not decide:

> «**What this ADR does not decide:** … **collections (§7)**; locking and the transfer of ownership
> (§8…); third-party templates (§9); private areas (§10, phase 4).»

This file stands to ADR 0025 exactly as ADR 0032 stood to ADR 0028: it decides what another ADR
deferred by naming it.

### What the dossier promises

The advanced dossier §7 is «Contenido reutilizable: las colecciones», and it opens by saying what the
feature is for — which is also, read closely, the shape this ADR settles in §2:

> «Es la diferencia real entre una web de folleto y una web de trabajo. Sin colecciones, cuarenta
> servicios son cuarenta páginas construidas a mano. Con colecciones, son cuarenta fichas y **una sola
> plantilla**.»

Then five promises, quoted whole rather than the three that suit this file:

| § | The promise | Decided here? |
|---|---|---|
| 1 | «Al añadir una ficha, **su página se crea y se enlaza sola**.» | **No** — named below |
| 2 | «La plantilla de la ficha se diseña una vez y **cambiarla cambia las cuarenta páginas**.» | **Yes** |
| 3 | «**Las secciones del catálogo pueden alimentarse de una colección**, así que el modo sencillo también se beneficia.» | **Yes** |
| 4 | «El menú y los enlaces internos se mantienen solos, como ya ocurre con las páginas orgánicas del dossier v1.» | **No** — it depends on the first |
| 5 | «El cliente que mantiene la web **añade fichas sin tocar el diseño**: es el trabajo diario de un comercio.» | **Yes** |

§6 names the same thing in one line — «**Colecciones con plantilla de ficha**: una plantilla y muchas
páginas, sin construirlas una a una» — and §4's `Páginas` row says, in its «Encendido» cell, «Añade
colecciones y fichas».

**Three of the five, then, and the two left out are one dependency**: both need a page per entry, which
is the thing this does not build.

### What exists today, counted rather than assumed

| Fact | Where |
|---|---|
| `collections` is a **required** field of every document | `packages/schema/src/document.ts:281` |
| **Every stored document carries `collections: []`** — counted across `fixtures/`, zero non-empty | — |
| `collectionRefSchema` is `{collectionId, field}`, **with no entry id** | `document.ts:24-32` |
| `binding?: CollectionRef` exists on **every** element | `document.ts:123` |
| Rule 5's check verifies the **collection** exists | `packages/schema/src/invariants.ts:141-149` |
| …but **not that the field exists.** A binding to a field no entry carries is legal today | same place |
| **The renderer ignores `binding` entirely** | `grep binding packages/renderer/src` → zero |
| **No schema verb** touches a collection | there is no `packages/schema/src/collections.ts` |
| **No editor code** mentions collections | `grep collection apps/editor/src` → zero |

So collections today are **a declared shape and half of one validation rule.** The shape exists
because the advanced dossier §11, «Lo que cuesta no decidirlo ahora», required it in its own words:

> «El documento debe soportar **desde el primer día** coordenadas en rejilla, valores de estilo como
> sistema, variantes por dispositivo y **referencias a colecciones**, aunque la interfaz de la fase 1
> no exponga ninguna de esas cuatro cosas. Decidirlo ahora cuesta unos días de diseño del modelo de
> datos. **Decidirlo después obliga a reescribir el editor.**»

**That bet is what this file collects on.** Three of the four were exposed in sprints 8, 9 and 13
without the document changing shape to allow them. This is the fourth, and the two changes it costs —
marks in a field, and an optional `field` — are both widenings with nothing stored to migrate. The
dossier said the alternative was rewriting the editor; it is a migration that moves no data.

## The decision

### 1. A collection is a named list of entries, and a section can show it

A collection has a name and entries; each entry has fields. A section that holds a `list` can be
**bound** to a collection, and then its cards come from the entries. Editing an entry changes every
card that shows it, on every page. **That is the function, not a side effect of it.**

### 2. The cards are one template, and the document stores one item

**A bound list stores exactly one item — the template — and the renderer draws one card per entry.**

This is forced rather than chosen, and the forcing is worth writing down because it is the first
thing a reader will doubt. `collectionRefSchema` has **no entry id**: a binding can say «this text is
the `nombre` field of this collection» and can never say «of entry 3». So the elements inside a card
cannot be per-entry — they are **one shared template**, and the entries are what it is drawn with.
That is also what the dossier means by «plantilla de ficha», in those words.

**The invariant requires exactly one stored item on a bound list.** Three stored items under a
binding is ambiguous — is the second a second template, or an entry that was there first? — and an
ambiguity the schema admits is an invalid state waiting to be found by somebody else.

### 3. `collectionRefSchema.field` becomes optional

A **container's** binding names the collection; a **leaf's** binding names the field. Today `field` is
required (`z.string().min(1)`), which makes a container's binding meaningless — it would have to name
a field it does not use. Widening it costs nothing: no stored document has a binding at all.

### 4. Bindings live only inside a bound list's template

A bound leaf **outside** a list reopens the question the shape cannot answer — «which entry?» — for
any collection with more than one. This version does not admit it. If it is ever admitted it will be
against a single-entry collection, and **«Cambiar solo aquí» is the exit that belongs to it**: an
exit for one element, which is exactly what a card may not have (§6).

### 5. Marks live in the collection

An entry's field carries text **and its marks**, reusing `marksSchema` and `markTextIssue` from
`packages/schema/src/marks.ts` so there is one bounds check and not two, and so the renderer splits a
bound text through the **same** `runs.ts` path as every other text — one escaping path, which is
ADR 0027's property and the reason this product has exactly one place where a string is cut into
pieces.

The cost is stated rather than discovered later: `fields` stops being `Record<string, string>`, so
**`SCHEMA_VERSION` goes 1.7.0 → 1.8.0 with migration `0009`**. The affected set is **counted and
zero**, which is the precedent of `0005` (the tablet bucket) and `0007` (exact lengths): a shape
change that moves no data takes a minor.

### 6. Editing a bound text edits the collection, and the warning comes first

Clicking a bound text in the canvas edits **the entry's field**, so the change lands everywhere that
entry is shown. **The warning appears on focus, before a character is typed:**

> «Este texto aparece en N sitios: si lo cambias, cambia en todos.»

**N is counted from the document**, never estimated. A product that changes three things when
somebody meant to change one, without having said so first, is making the surprise this whole file
exists to avoid.

### 7. The exit is per section: «Desenlazar esta sección»

**Because the card is a shared template, there is no per-card exit and offering one would be a lie.**
Unbinding one card's text would unbind the template and change every card — the exact surprise §6's
warning is there to prevent, arriving through the control meant to avoid it.

So the exit is the section's: **«Desenlazar esta sección»** turns the current entries into ordinary
cards, **each carrying its own text and marks**. What was on screen becomes what the document holds.
It is one history step and undo takes it back.

### 8. Cardinality holds in both directions, and it is an invariant

The catalog declares how many cards a section may hold — «Qué hago» is 1..6 ([ADR 0013](0013-services-cardinality.md)).
A bound section's card count is the collection's entry count, so:

- **A collection that does not fit cannot be bound.** «9 entradas, y esta sección admite 6.»
- **An entry cannot be added or removed if it would push a bound section outside its minimum or its
  maximum**, and the message **names the section and the limit**.

Both are refusals and neither is a repair, which is the rule this schema already follows for the
tablet bucket and for exact lengths: **make the invalid state unreachable rather than build an
interface to fix it.**

`checkAgainstPreset` is where cardinality already lives, so the check goes there. `checkInvariants`
cannot see presets and `packages/schema` may not import `packages/catalog`, so it **gains an optional
preset lookup** — `(catalogId) => PresetShape | undefined` — which is the shape `checkAgainstPreset`
already uses: be handed the preset rather than go looking for it. Given one, the rule runs at the gate
every document passes through.

### 9. Rule 5's other half, finally

The binding check gains the **field**. A binding naming a field no entry carries is a dead reference —
precisely what rule 5 exists to forbid — and it is legal today. Closing it is part of this and not a
later tidy-up.

### 10. The canvas needs to know which entry a card draws, and only the canvas

The editor has to know which card is which entry to edit the right field. The document cannot say,
because there is no entry id in a binding and the cards do not exist in it.

So `render` emits a **`data-entry`** attribute on each drawn card — **under an option that is off by
default.** The published path cannot carry it by accident: `buildSite` does not pass the option, the
golden corpus is generated without it, and day 4 asserts the published bytes contain no `data-entry`,
no collection name and no collection id. **A published page does not know a collection existed**, which
is how this stays inside ADR 0001 rather than beside it: resolution happens when the page is rendered,
and what ships is the same static HTML and CSS it always was.

### 11. Behind the design-tools switch

The dossier calls this a pillar of «el modo estudio» and ADR 0025 §1 exists so that a control does not
arrive unasked. The rail item is **absent** with the tools off, not dimmed — ADR 0025 §6.

The dossier's «así que el modo sencillo también se beneficia» is kept, and it is worth being precise
about how: somebody with the tools **off** sees the cards a bound collection produces and edits their
text like any other text. What the switch gates is **making and binding** a collection, not living
with one.

## What this does not decide

- **A page per entry, and the menu that would follow it.** §7's first and fourth promises — «su
  página se crea y se enlaza sola» and «el menú y los enlaces internos se mantienen solos» — are one
  piece of work, and it needs the slugs, the derived menu of
  [ADR 0023](0023-the-menu-and-the-footer-are-derived-chrome.md) and the conversion of
  [ADR 0022](0022-a-page-is-born-by-converting-a-section.md) to agree with each other. Not here, and
  the reason is not timidity: forty entries would make forty pages, and ADR 0023 settled the menu at a
  threshold of three.
- **Collections shared between documents or between clients.** That is accounts, and the sprint after
  this one starts with its own ADR.
- **A bound leaf outside a list**, and therefore «Cambiar solo aquí» — §4 above.
- **Per-entry visibility.** Rule 3 hides a role within a section; whether an *entry* can be hidden
  without being removed is a different question and nobody has asked it.
- **Where the entries come from.** No import, no spreadsheet, no feed: typed in the panel. A feed
  would be a network dependency and ADR 0001 is why not.
- **Ordering beyond the stored order.** Entries draw in the order they are stored and `moveEntry` is
  how that order changes. No sorting by a field.

## Consequences

- `SCHEMA_VERSION` 1.7.0 → 1.8.0, migration `0009`: an entry's field gains marks and
  `collectionRefSchema.field` becomes optional. Both with an affected set counted at zero.
- `packages/schema` gains `collections.ts` with the verbs, each returning the identical document when
  nothing changes — the rule `setElementStyle` and `setPlacement` already follow, so that a control
  pressed twice opens one history step and not two.
- `packages/renderer` resolves a bound list, through the existing `runs.ts` path, deterministically:
  entries in stored order, no clock, no randomness, because the golden corpus and `INV_5` depend on it.
- `checkInvariants` gains an optional second parameter. Every existing caller keeps working and gets
  the behaviour it has today; the download gate passes the lookup and gets the new rule.
- A new fixture and golden, so the resolved output is read as bytes rather than described.
- **The editor is then closed on four of the five studio pillars**, with interactions the one left and
  no ADR for it yet. The sprint's closing pull request states that pillar by pillar, so the sprint
  after this one does not have to come back and work it out.
