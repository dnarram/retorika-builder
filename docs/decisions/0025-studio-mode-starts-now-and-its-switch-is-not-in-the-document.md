# 0025 — Studio mode starts now, and its switch is not in the document

**Status:** **accepted** · **Date:** 2026-09-30 · **Proposed by:** development · **Accepted by:** the
CEO · **Amends:** protocol Part 14 (phase boundary) · **Touches:** the advanced-module dossier §§1-6
and §11, `docs/document-rules.md` (`INV_4`), ADR 0012 (`localStorage` only), ADR 0018 (the precedent
for crossing a phase boundary on purpose)

> **What was decided.** Two things, and the second is only a decision because of the first.
> **The advanced module — «el modo estudio» — starts now**, ahead of its place in the protocol's
> phases, because the professional editor becomes a target of the product. And **its switch lives
> in the person's browser, never in the website**, which is the one property that separates this
> from the failure the dossier §2 exists to avoid.

## Context

### The audience changed, and that is the reason for the date

Until now the product had one stated audience doing two jobs: «el cliente, que se hace su propia
web» and «el equipo de Retorika, que monta webs de cliente», using «la misma aplicación y el mismo
editor». Seven sprints served the first. Direction has now made **the professional editor a target
of the product** — someone who does not settle for simple editing — and that is what schedules this
work rather than any finding in the code.

The dossier already has the name and the whole design: `Retorika_Builder_Modulo_Avanzado_v1.docx`,
approved 15 September 2026, «el modo estudio». This ADR does not invent the feature. It decides
**when** it starts and **where the switch lives**, which are the two things the dossier leaves to
the implementation.

### It crosses a phase boundary, deliberately

`docs/protocolo.md` puts «Modo estudio completo: rejilla, sistema de estilo, control por
dispositivo, colecciones, interacciones. Escalada y vuelta» in **Fase 3**. Phase 1's acceptance
criterion has been measured (27 September: two minutes to the end of the questionnaire, eight to the
ZIP, unaided) but **declaring it accepted is direction's**, and phase 2 is unfinished — the minimum
SEO, the photo bank's images and charging are all open.

So this is a crossing, and it is recorded as one. **ADR 0018 is the precedent**: it moved the
owner's own cover photo out of phase 2 into phase 1 for one affordance, deliberately, and said so.
The same shape applies here: one part of phase 3 starts early because direction judges it more
valuable than the order of the list, and the rest of phase 3 — collections, interactions, the
template gallery — stays where it is.

### The engine has been finished and unreachable since phase 0

This is what makes the crossing cheap rather than speculative:

- **`escalate`, `planRevert`, `applyRevert` and `RevertDecisionRequiredError`** live in
  `packages/schema/src/revert.ts`, tested, with **no caller outside tests**. The file's own header
  calls the return «lo que Wix no tiene».
- **The document has carried grid placements, per-device patches and collection references since
  day one**, because the dossier §11 warned what deciding later would cost: «Decidirlo ahora cuesta
  unos días de diseño del modelo de datos. Decidirlo después obliga a reescribir el editor.»
- **`INV_4` has been provisional the whole time**, and `docs/document-rules.md` says exactly why:
  «The design-tools switch does not exist yet.»

## Decision

### 1. The professional editor is a target of the product

Recorded here so that the backlog, the roadmap and the next sprint plan can point at one place. It
changes what «done» means for the editor: the same screens must serve someone who builds sites for
other people, without the owner who maintains the site afterwards ever meeting a control they did
not ask for.

### 2. The switch belongs to the person, and the product has no accounts yet

The dossier §3 puts the switch «en su cuenta, del mismo rango que el idioma de la interfaz». There
are no accounts: ADR 0012 approved `localStorage` alone and ADR 0021 deferred Supabase until the
product is judged sellable.

**So the switch is stored in this browser, under its own key, and the editor says so in those
words** — the same honesty as «Guardado en este navegador». When accounts arrive, that module is the
one file that moves.

**It is not a field of the saved session.** This is the part worth stating as a decision rather than
an implementation note: `clearSession()` is «Volver a empezar», and restarting the *site* must not
change who is *looking*. A person who throws away their draft and starts again is the same
professional they were a minute earlier. Putting the switch in the session would also make every
flip rewrite the document's serialisation, which is the exact shape of the failure below.

### 3. The switch never enters the document, and `INV_4` stops being provisional

`docs/document-rules.md` already rejects a `designTools` key, with the reason: «Depth is a property
of the person looking, never of the site — that is the Wix trap the advanced dossier §2 exists to
avoid.» The dossier turns it into a testable promise: «Accionar el interruptor cien veces debe dejar
el documento byte a byte idéntico. Si encender las herramientas escribe algo en el proyecto, hemos
reconstruido el problema de Wix.»

From this sprint that invariant is **proved against a real switch** rather than against a local
boolean, and `PROVISIONAL_INVARIANTS` in `packages/schema/src/invariants-catalog.ts` is emptied.

### 4. The switch sits at the foot of the rail, not in the top bar

The rail is where it goes, visually separated from the four panels, because it is **not a place to
go — it is a setting of the person looking**.

The top bar was the other candidate, and it is where the device toggle already lives, which is
genuinely the same kind of control. It is rejected on a measurement rather than a preference:
**sprint 7 day 7 measured that row overflowing** — at three pages the tab strip ran 29.5px under the
device toggle at 1280px wide, and the undo and redo buttons were compressed to two thirds of their
declared size. It was fixed by refusing to let that row shrink. A labelled switch adds roughly 110px
to the one row in this interface that has already proved it has none to give.

### 5. Off on a small screen means the tools are not offered, not that they are suspended

The dossier §4 safeguard reads «En el móvil van siempre apagadas. Diseñar con rejilla en seis
pulgadas no funciona, y es más honesto no ofrecerlo.» That sentence has two readings and only one
of them is compatible with the rest of the same table:

- **Adopted:** the switch is not offered while the **editor's own viewport** is small.
- **Rejected:** the tools switch off while the canvas previews the mobile view — which would make
  the three mobile adjustments of rule 7 impossible, two rows above in the same table («Escritorio,
  tablet y móvil, **editables**»).

Below the threshold the control is **absent**, not disabled, and the stored preference is untouched,
so widening the window brings it back.

### 6. What the switch changes, and what it does not

| | Off | On |
|---|---|---|
| Rail | `Secciones`, `Estilo`, `Páginas`, `Fotos` | adds `Diseño`, which holds the element tree and the design families |
| Section header | variant, move, duplicate, delete | adds «Diseñar a mano» |
| Devices | desktop and mobile, to look at | desktop and mobile, **editable** (sprint 8 days 5-6) |
| **The published site** | **does not change** | **does not change** |

The design panel **opens with its families collapsed** (§4: «encenderlo añade una puerta, no descarga
sesenta controles»), and no family is drawn for something that does not exist yet — a greyed
`Tipografía` heading waiting for sprint 9 would be the dead-button mistake this editor has refused
since sprint 1.

### 7. Escalation is per section, and the return is one click

- **A section is of the catalog or it is free**, one at a time. «La profundidad es por sección. Una
  web normal es una mezcla.»
- **Escalating moves nothing.** `escalate` copies the layout the catalog was already drawing, so the
  offer can be accepted without risk. The offer says so before it is accepted, and promises the
  return in the same breath.
- **The return is lossless by construction**, because the copy kept the element ids and
  `applyRevert` puts each one back in its slot. **Not because a version was saved** — see the
  divergence below.
- **Nothing is deleted silently.** What does not fit comes back hidden by default and stays
  reachable in «Campos de esta sección», which is document rule 3.
- **The return warns that mobile-only adjustments disappear**, because they belong to the layout.
  «El diálogo lo advierte, porque si no parece un fallo.»

## Two places where this product cannot do what the dossier describes

Recorded here rather than left to be discovered, and repeated in `docs/design/REVIEW.md`, which is
where divergences from an approved design artefact belong.

- **«Al escalar se guarda una versión»** (§5). **There is no named version history.** `autosave.ts`
  stores one session and no history at all, so within a session the undo stack is the version and
  across a reload there is none. **The interface must not say a version was saved.** What it may
  promise — and what is true — is that the return puts every text and photo back in its exact slot.
- **«El panel de secciones marca las diseñadas a mano»** (§5). **There is no sections panel**:
  `Secciones` is the canvas. The mark is a pill drawn on the section in the canvas, as injected
  chrome that can never reach a published page.

## Consequences

- **`INV_4` is completed**, `PROVISIONAL_INVARIANTS` is emptied, and the «`INV_4` is provisional in
  Phase 0» section of `docs/document-rules.md` is rewritten. Nothing in CI forces that rewrite —
  `documentation-sync.test.ts` only checks that the identifiers appear — so it is done by hand in
  the same commit.
- **The seven document rules are untouched.** Placement inside the section's grid *is* rule 4, not
  an exception to it; free placement over absolute coordinates stays refused, and rule 5 still
  closes the hole it would open.
- **`docs/tasks/backlog.md` gains a row** pointing here for the audience decision, rather than a
  second copy of it.
- **What this ADR does not decide:** the floating toolbar and the «marked exception» of rule 6
  (sprint 9); bold and italic (ADR 0024 stands, and neither of its two wake conditions has
  happened); collections (§7); locking and the transfer of ownership (§8, and the document model
  already refuses `locked` and `ownerId`); third-party templates (§9); private areas (§10, phase 4).
