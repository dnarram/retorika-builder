# 0025 — Studio mode starts now, and its switch is not in the document

**Status:** **accepted** · **Date:** 2026-09-30 · **Proposed by:** development · **Accepted by:** the
CEO · **Amendment at the foot:** accepted 2026-10-01 by **David, not direction**, and built ·
**Amends:** protocol Part 14 (phase boundary) · **Touches:** the advanced-module dossier §§1-6
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

> **Amendment, 4 October 2026 (sprint 15, ADR 0034).** Accounts arrived, and this prediction was
> half right. The module did **not** move: it gained a sibling,
> `apps/editor/src/account/designTools.ts`. The prediction assumed accounts would replace
> `localStorage`, and ADR 0034 §2 kept the anonymous journey instead — somebody who never signs in
> still gets a switch that remembers — so **both paths exist**. The account's answer wins when
> there is one, and a `null` from the account never overwrites the browser's, because `null` means
> «could not ask» and not «off». Everything else in this section stands: the switch is still not a
> field of the document, still not part of the saved session, and `clearSession()` still cannot
> change who is looking.

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
  (sprint 9); bold and italic (ADR 0024, whose wait ended on 1 October 2026 — see that file;
  this clause used to say neither of its wake conditions had happened, which stopped being true);
  collections (§7); locking and the transfer of ownership (§8, and the document model already
  refuses `locked` and `ownerId`); third-party templates (§9); private areas (§10, phase 4).

---

## Evidence from session 3 — the switch was found, and it sorted wrong (30 September 2026)

> Source: `docs/sessions/2026-09-30-taller.md`. One business, sector `taller`, the first owner ever
> to meet this switch. **This section records the evidence; it does not change the decision** —
> what to do about it is sprint 10 day 2's, per the approved plan.

**What is recorded:** he saw the switch, he turned it on, and he used the floating toolbar.

### §4 and §5 hold, and by a wider margin than they had earned

The switch is a `role="switch"` button **34×19 pixels** with a **9-pixel** label at the foot of the
rail, and **it never offers itself**: `EditorShell.tsx` has
`onClick={() => (on ? onChange(false) : onAsk())}`, so the question appears only because somebody
pressed it. Nothing onboards it, nothing interrupts anyone with it.

§5 chose an absent control over a disabled one, arguing that a greyed switch «invites working out
how to enable it». The first owner to meet the switch it settled on **found it and pressed it,
unprompted**. That is the discoverability question answered in this decision's favour, on evidence
it did not have when it was taken.

### §1's question does not sort the way §1 assumes

The panel asks **«¿Montas webs para otros?»** — «Si es tu trabajo, te encendemos las herramientas
de diseño: rejilla, colocación y ajustes por dispositivo.» He pressed **«Sí, enciéndelas»**.

**He runs a car workshop.** He does not build websites for other people, which is what the
question's own words make the condition. The gate admitted somebody it was not written for.

**Why he said yes is not recorded**, and the two readings the record cannot separate are that he
did not read it and that he read it and wanted the tools anyway. Either is enough for the finding,
because the finding is about the gate: **a question that offers more capability to whoever answers
yes will be answered yes.** That is a property of its shape, not of this owner.

### And two of the things he asked for were already behind it

Of the seven things he named wanting and not finding (ADR 0024), **two exist**, and both are behind
this switch — in two different places:

| What he asked for | Where it is | Was he there? |
|---|---|---|
| `color exacto` | the **floating toolbar**, `measures.exact` | **Yes — he used the toolbar** |
| `más libertad en la posición` | the **`Diseño` panel's** grid (§7, sprint 8) | **Not recorded** |

**The order of events is not recorded**, so it cannot be said the exact-colour control was in front
of him at the moment he named colour as missing. What is established is that by the end of the
session he had opted in, used the bar, and still had both on his list.

**Finding the switch is not the same as finding what is behind it.** This is the first real
evidence this ADR has about its own premise, and it does not point at a missing control — it points
at the gate and at what sits behind it. **It is not fixed by building anything**, which is why
nothing in this file changes today.

### What day 2 has to decide, and what it may not

Three live options, named here so the decision starts from a list rather than from scratch:

1. **Is the question the right question?** It asks about a trade and uses the answer to grant
   capability. Those are not the same thing, and one owner has already shown they come apart.
2. **Should the exact value come out from behind the switch** now that the contrast review of
   sprint 9 day 6 refuses a colour under 3:1 and warns under 4.5:1? ADR 0026 drew the line between
   references and exact values; this is a question about which side of the switch that line sits on.
3. **Is what is behind the switch findable once you are through it?** The `Diseño` panel's own copy
   says «Encender las herramientas añade una puerta, no sesenta controles» — a door that was opened
   and, on this record, may not have been walked through.

**What it may not do is decide this is fine because the switch was found.** It was found and it
admitted the wrong person on its own terms; those are two findings, not one.

## Amendment — the gate worked, the wording does not, and the door behind it is three places away

**Status of this section: accepted 1 October 2026.** Proposed by development on 1 October 2026 as
sprint 10 day 2's answer to the three questions above; **accepted by David, not by direction**, asked
directly while planning sprint 11 and answered «**Dentro, y la firmo yo**». Built the same day.

> **The header says «not direction» for the same reason ADR 0026, 0027 and 0028 do.** The body of this
> ADR above was decided by the CEO; this amendment was not, and an amendment gets cited afterwards as
> part of whatever it amends. The distinction is written down rather than left to be inferred.
>
> **What was signed is the text below as it already stood** — it has been in this file since sprint 10
> day 2 and was read there, so the signature is on wording its signer had in front of him, not on
> anything written afterwards to suit it.

### The gate did its job, and §1 is why

§1 says what the switch protects: «without the owner who maintains the site afterwards ever meeting
a control they did not ask for». **He asked.** The panel never offers itself; pressing a switch is
the asking. So the thing §1 protects was protected, *whatever the question said*, and the finding
that he is not a web professional does not mean the gate failed at its purpose.

**That is also why the question's wording is doing no work.** «¿Montas webs para otros?» asks who
somebody is and grants capability for the answer. Anyone who wants the capability answers yes, so
the question filters nobody while looking as though it does — and the real consent was the press.

**Decided: the question describes what the tools are, not who the person is.** Not to keep anyone
out — §1 does not ask us to — but so the answer is accurate rather than aspirational, and so a
person deciding has the information instead of a label. The body copy already does this well
(«rejilla, colocación y ajustes por dispositivo»); it is the title that asks about a trade.

> **Built 1 October 2026**: «¿Montas webs para otros?» became **«¿Quieres colocar tú cada
> elemento?»**, and `docs/design/REVIEW.md` carries the override, because mockup 16 still draws the
> old wording and that file is where an ADR overrules a drawn screen.

### What the evidence does **not** license: moving the exact-value line

It is the tempting response and it is wrong. ADR 0026 put the line at the switch on the authority
of the dossier §4's own table, and **the switch is not what stopped him**: the tools were on. Moving
the line would have changed nothing about his session.

**So this amendment proposes no change to ADR 0026.** Recording that is the point — a finding that
appears to support a change it does not support is how an approved document gets amended on
evidence that was never about it.

### The real finding: one intention, three places

He was told the grid was there — the panel's own copy names it — said yes, and still named «más
libertad en la posición». The path from that yes to moving an element, as built:

1. Press the switch at the foot of the rail.
2. Open `Diseño` and select a section.
3. **Read a paragraph that tells you to go somewhere else.** `DesignPanel.tsx:315` renders
   `editor.design.notFree` as a plain `<p>`: «Esta sección la coloca el catálogo. **Diséñala a mano
   desde su cabecera** y podrás mover y ensanchar cada elemento dentro de la rejilla.»
4. Find «Diseñar a mano» on the section's header in the canvas (§6).
5. Come back to `Diseño` and move the element.

**Step 3 is a dead end that names its own exit and does not offer it.** Whether he reached it is not
recorded; what is recorded is that he opted in and did not find what he had just been promised, and
this is the only path there is.

**Decided: the «Diseñar a mano» offer is reachable from that paragraph**, where the person has just
learned they need it.

> **Built 1 October 2026**: the paragraph now promises the return in the same breath and the offer is
> a button beside it, calling the same `escalateSection` the section header's own offer calls. The
> panel's four states moved into `designPanelState`, which is where a second defect turned up —
> reachable and latent: the panel offered «Diseñar a mano» for a section that had been **deleted**
> while it was open, and `escalateSection` throws on a missing id. A dead button that looked alive.

**§7 is not amended.** Escalation stays per section, the offer still says what it does and promises
the return in the same breath, and `escalate` still moves nothing — all of that is why the offer is
safe to put in a second place. **This is about where the door is, not about what is behind it.**

### What is still open after this

Whether the *rest* of what is behind the switch is findable. One owner reached step 1 and the record
stops there. ~~**This is the question a fourth session should watch rather than ask**, and it is the
reason the observation table matters more than another feature.~~

**And it is now a question with no method, 2 October 2026 —
[ADR 0031](0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md).** The sessions are
cancelled and usability is David's to judge. **This particular question is the one that resists that
most**, and it is said here rather than left to be discovered: discoverability is measured by
watching somebody naive to the control, and the person who placed it cannot be naive to it. Judgement
substitutes for an opinion; it does not substitute for an instrument.

So this stays open, and open differently: not «waiting for a session» but **without a way to be
answered as written**. ADR 0031 names it as one of the three things cancellation cannot route
around.
