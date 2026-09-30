# Backlog — what is owed, and where each thing actually lives

**This is not a task specification.** Every other file in this directory is one: an objective,
the steps, and a definition of done, written *before* the work. This one is the list of what is
waiting, and it exists because the repository had nowhere to keep it — the list used to live in a
planning file outside the repository, on one machine, which meant it survived for exactly as long
as that machine did.

**It is a router, not a record.** Each item says where the real thing is written, and nothing
here is the authoritative copy of anything. That is deliberate: two places holding the same fact
drift, and the facilitator's script already says findings go to the decision they touch «not into
a separate document nobody reads again». So an item with an ADR points at the ADR; an item with
an issue points at the issue; and only the things with no other home are described here at all.

Last reviewed: 30 September 2026, **sprint 9 day 1**. Sprints 7 and 8 closed between the previous
review and this one. The row about the seven unbanked sectors closed with the seven signings, and is
struck rather than deleted. Two entries are new: **issue #9 is now a gate** rather than a nuisance —
it is what keeps typography out of the style sprint — and **there is no keyboard undo**, which
nobody had written down anywhere and which seven places in the repository contradict.

The previous review was 29 September 2026, sprint 7 day 1. Sprint 6 closed between it and the one
before. Three rows had gone stale — the photo bank's future tense, mockup 13's palettes and the
editor's top bar — and were corrected in place rather than deleted, so the record of what was once
open survives.

---

## Decided elsewhere, waiting on someone

| What | Where it is written | Waiting on |
|---|---|---|
| **The professional editor is a target of the product, and the advanced module starts now.** Decided by direction, 30 September 2026: the same editor must also serve someone who builds sites for other people. That schedules «el modo estudio» ahead of its place in the protocol's phases — a deliberate crossing, with ADR 0018 as the precedent — and it changes what «done» means for the editor. | [ADR 0025](../decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md), and the advanced-module dossier | Nothing. It is being built: sprint 8 delivered the placement, the devices and the switch; sprint 9 is the style system |
| **Exact colour values, behind the switch, with a contrast review in front of them.** Proposed by development, 30 September 2026, and the reason it needs somebody is that it **amends a `REVIEW.md` entry** — the one that refused mockup 13's «Avanzado: colores exactos y tamaños» as "not implemented, and not planned". What arrives is not that picker: it is rule 6's marked exception, offered only with the design tools on, with a two-level contrast review that blocks below 3:1 and warns between 3:1 and 4.5:1. **The two levels were decided by David in the planning of sprint 9, not by direction**, which is why the ADR and mockup 17 go to the CEO before the day-1 pull request is merged. | [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md), and [mockup 17](../design/mockups/17-la-barra-y-el-sistema.html) | The CEO, reading the ADR and the mockup. The gate is on merging sprint 9 day 1, and day 2 does not start without it |
| **A contact form.** Scoped, 28 September 2026: [ADR 0020](../decisions/0020-contact-stays-links-only-for-phase-1.md) accepted ADR 0016's phase 1 links-only scope and split the form off as its own, unscheduled phase 2 item. | [ADR 0020](../decisions/0020-contact-stays-links-only-for-phase-1.md), resolving [ADR 0016](../decisions/0016-contact-section-has-links-not-a-form.md) | A phase 2 ADR naming the service, its cost, what happens to a client's site the day that service stops, and the data processing agreement protocol Part 15 requires |
| **How a carta of several courses reads.** Three «Precios» sections one after another are three separate blocks: each has 48px of its own padding and the page puts 76px between them, so **172px of air separates the last dish of one course from the heading of the next**, and nothing frames them as one menu. Measured by building one on 28 September 2026. The cheap lever is a renderer rule making two adjacent sections of the same preset close up; whether that should happen at all is a general design decision, since it would apply to two «Opiniones» just as much. | [`docs/design/REVIEW.md`](../design/REVIEW.md) | Direction, on whether adjacent sections of one kind should read as one |
| **The hostelería text bank — resolved, 28 September 2026.** Both `packages/copybank/drafts/*.json` files were read and signed; the hostelería rewrite and the per-sector «Precios» headings are in `bank/` now. What the draft could not write — a sixth question, direction's to add — is still open. | [ADR 0009](../decisions/0009-generated-texts-from-a-reviewed-bank.md), and [ADR 0010](../decisions/0010-initial-questionnaire.md) | Nothing, for the bank itself. The sixth-question option in ADR 0010 is direction's whenever it wants it |
| **`packages/photobank` — the machinery shipped on sprint 6 and the bank is still empty.** Eleven sector files, zero images. Until the first one is approved, every generated site opens on the grey marker, and three sentences in the editor had to stop saying otherwise (sprint 7 day 1; the list of which, and that they come back with the first image, is in `packages/photobank/README.md`). | [ADR 0011](../decisions/0011-sample-photos-per-sector.md), and "What an image has to satisfy" below | Licensed images, which is content production rather than code |
| **The text bank covers all ten launch sectors — resolved, 30 September 2026.** Sprint 7 days 4-5 wrote `estetica`, `fisioterapia`, `taller`, `reformas`, `academia`, `fotografia` and `asesoria` as drafts; sprint 8 signed the seven, one PR per sector, each merged by direction after reading the Spanish words in the PR body — the `git mv` ADR 0009 calls the review. `drafts/` is empty. `servesSector` now answers `true` for all ten launch sectors — checked directly, not assumed — and only «Otro sector» still falls through to `generico`. | [ADR 0009](../decisions/0009-generated-texts-from-a-reviewed-bank.md) | Nothing. Every launch sector has its own titulares, cuerpos and question-3 suggestions |
| **Hosted publishing.** | [ADR 0008](../decisions/0008-hosted-publishing-has-no-plan.md), and `serve.md` in this directory, which is dormant by that decision | Nothing. It is on hold with no plan, and that is the decision |

## Open questions, filed

| What | Where |
|---|---|
| **Formatting inside a text — designed on 29 September 2026, and waiting.** [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) settles the shape (bold and italic over a run of characters; **underline refused**, because on the web it means a link) and decides that the code waits for the third session, which asks whether the request survives the text bank being fixed. #52 stays open and points at the ADR. | [#52](https://github.com/dnarram/retorika-builder/issues/52), [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) |
| **Type pairs falling back** on machines without Inter / Playfair Display. Still open — the fallback itself is unchanged — but the interface half is now handled: the Estilo panel names typefaces by character («Moderna y neutra») and never by font, and its `Aa` specimen renders in the real stack, so what it shows is what that machine will give. **Sprint 9 makes this a gate rather than a nuisance:** it is what keeps «tipografías propias» and the toolbar's per-element `Aa` out of the style work, which is half of the advanced dossier §4's "On" column for the style panel. It needs a decision, and [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md) says so by name rather than leaving the omission to be noticed later. | [#9](https://github.com/dnarram/retorika-builder/issues/9), and [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md) |

## Recorded against the thing it challenges

| What | Where |
|---|---|
| **Moving images freely.** Conchi asked for it; it collides with document rule 4, and rule 5 already named the hole it would open. The rule stands, and the request is on the record so the next person hears it as the second time. | [`docs/document-rules.md`](../document-rules.md), the note under rule 4 |
| **The design review's own open list** — the third cover composition, `location`'s `split` gap, and the rest. *(Mockup 13's palettes were named here until sprint 7 day 1 and had been resolved since 28 September: the Estilo panel ships their names from `packages/tokens/src/locales/es.json`.)* | [`docs/design/REVIEW.md`](../design/REVIEW.md), "Still open" |
| **The price.** Two sessions answered it and they overlap at 50 €. | [`docs/design/HANDOFF.md`](../design/HANDOFF.md), the open-questions table |

## No home but this one

- **Accounts and persistence with Supabase, and charging — deferred, not scheduled.**
  [ADR 0021](../decisions/0021-charging-waits-for-a-sellable-product.md), 28 September 2026: it
  waits until the product is judged professionally sellable, the same status ADR 0008 gives hosted
  publishing. The mechanism is decided — Stripe, single payment, Checkout, idempotent webhook,
  three stored states (protocol Part 15) — and the six open questions in
  [`docs/design/billing-questions.md`](../design/billing-questions.md) are not going to direction
  with a deadline; they wait for the same moment. One of the six is ours to raise when that moment
  comes: **once the ZIP is handed over there is nothing to switch off** (ADR 0001), so what a
  refund can even mean has to be decided before the terms of use are written, not after.
- ~~One catalog section still missing of the dossier's nine: «Quién soy / El equipo».~~ **Done**,
  29 September 2026: sprint 7 day 6 built `packages/catalog/src/team.ts`. The catalogue is 9 of 9.
  This was the one section with no evidence behind it — no session asked for it, it closed the
  catalogue rather than answering anybody's own words — and that stays true of it going forward:
  nothing here claims a usability finding it does not have.
- **There is no keyboard undo, and seven places in this repository say there is.** Found by walking
  the editor on **sprint 9 day 1**, and not caused by that day's work — it has been true for as long
  as the editor has existed. `Meta+Z`, `Control+Z` and `Meta+Shift+Z` were each pressed against a
  real change, and **none of them did anything**, while the «Deshacer» button undid it correctly on
  the same state. There is no key handler in `apps/editor/src` at all: no `metaKey`, no `ctrlKey`,
  no `key === "z"`. Meanwhile [ADR 0022](../decisions/0022-a-page-is-born-by-converting-a-section.md)
  writes «deshacer» as a feature and not only as Ctrl+Z», `packages/schema/src/conversion.ts` repeats
  that sentence, `Editor.tsx` and `PagesPanel.tsx` each explain a behaviour in terms of it, and a
  test name, a test comment and an e2e comment all name it. **Either the shortcut is written or the
  seven claims are corrected**; what cannot stand is the repository describing an affordance the
  product does not have — which is the exact failure `CLAUDE.md` already records once, about the
  note that said `test:a11y` did not exist. Whose call: adding the binding is a small feature and
  direction's to schedule; correcting the prose is a one-PR chore.
- **A list item's optional slots cannot be reached.** The fields panel is explicit that "a list
  holds items rather than a value", so its rows are the section's slots and never an item's. A
  card's `description` in «Qué hago» has been `0..1` and unreachable since sprint 1, and a price
  line's is the same. It has not bitten because the questionnaire fills the cards it generates,
  and because a carta line reads perfectly as a name and a price. The fix is either extending
  `SlotAddress` to name an item, or a second panel; neither is small.
- **The three findings of sprint 4 that nobody has acted on**, all of them measured rather than
  supposed, and each one already written up where it belongs:
  - Whether a hostelería owner recognises «Precios» in the menu ([#51](https://github.com/dnarram/retorika-builder/issues/51), a hypothesis for the next session). **The question is now written out, word for word, in [`docs/sessions/guion-tercera-sesion.md`](../sessions/guion-tercera-sesion.md).**
  - Whether two adjacent sections of the same preset should read as one (the 172px row above).
  - ~~The editor's top bar naming the variant where mockup 08 names the business.~~ **Done**,
    28 September 2026: direction settled it and the bar shows the business name
    ([`REVIEW.md`](../design/REVIEW.md), "Resolved"). Struck on sprint 7 day 1, having outlived the
    code by a sprint and a half.
- **One of the five critical Playwright flows is not written yet.** *Cambio de paleta* joined on
  sprint 4 day 3, once day 2 gave `Estilo` a live panel to drive it — CI now covers four of the
  five. *Pago de prueba y publicación* is on hold with no plan (ADR 0008) — there is no payment
  flow and no publish target, so writing it would test code that does not exist. Named in the doc
  comment at the top of `apps/editor/e2e/critical-flows.e2e.test.ts`, which is where it belongs
  when it arrives.
- **Filling a destination by hand is done** (sprint 3, day 4) — listed here only so that the
  entry which sat in the old planning file as "pending" is visibly closed rather than lost.

---

## What phase 1 is still waiting on

The acceptance criterion **was measured** on 27 September: two minutes to the end of the
questionnaire, eight to the ZIP, unaided and unexplained
(`docs/sessions/2026-09-27-conchi.md`, and the Fase 1 note in `docs/protocolo.md`).

**Declaring phase 1 accepted is direction's, not development's.** The same session that produced
the number also said she would not publish the result as it stands, and both facts are in the
write-up. What is recorded is the measurement.

---

## What an image has to satisfy before it can enter the photo bank

Written on 29 September 2026, sprint 6 day 1, **before** the schema that enforces it, so that
licences can be checked with direction before any image is sourced. Every line comes from
[ADR 0011](../decisions/0011-sample-photos-per-sector.md); nothing here is new policy. The Zod
schema in `packages/photobank/src/schema.ts` refuses a file that breaks any of the checkable ones,
so these are not a checklist someone has to remember — they are a build failure.

**The licence is the part that cannot be fixed later.**

- **Commercial use allowed, *and* our clients may publish it.** A sample photo travels inside the
  client's ZIP and they put it on their own domain. A licence that covers only Retorika's own use
  fails the test, however generous it looks.
- **Never from a bank whose terms forbid compiling its photos into a similar service, or using
  them in digital templates.** ADR 0011 names two by name for exactly this: **Unsplash and
  Unsplash+ are both excluded.**
- **Preferably generated with a free generative-AI tool whose terms allow commercial use** — and
  the terms re-read for **the exact tool and the exact plan**. Free tiers routinely carry different
  terms from paid ones, and the plan is part of the answer.
- **The date the terms were read is recorded.** Terms change; the record keeps the version we
  relied on.

**What may not be in the picture.**

- **No recognisable person.** No face, and no tattoo or other feature that identifies somebody.
- **No brand, logo or lettering** — including the garbled pseudo-text generative tools draw on
  signs, labels and menus, which is the one people miss.
- **No visible artefacts:** extra fingers, warped tools, impossible objects.
- **Plausible for a small business in Spain.**

**The file.**

- **WebP**, longest side **1600 px**, quality around **75**, with EXIF and XMP removed — the origin
  belongs in the record, not in the file.
- **At most 200 KB.** Two separate checks, and worth stating separately because the first version of
  this note fused them: the file must weigh **exactly what its record declares**, and it must
  **not exceed 200 KB**. A record that misstates its own size is wrong even when it is small.

**What is recorded with each one** (`packages/photobank/bank/<sector>.json`):

- `id`, `sector`, `file`, `width`, `height`, `bytes`.
- **`alt`, in Spanish, describing what is really in the photograph** — it is a text that reaches a
  published page, so it is reviewed like any bank text.
- `origin`: the tool and model, the date, and **the prompt**.
- `licence`: name, URL, the date the terms were read, `commercialUse`, `clientsMayPublish`.
- `review`: who approved it and when. **A person, never the tool that made it.**

**How many.** ADR 0011 asks for **at least eight per sector**, so the three variants do not repeat
themselves. Sprint 6 takes **three to five for `restaurante-bar`** as the first real test of the
path — it is the sector of both usability sessions. A sector holds either none or at least eight;
a half-filled one would make two of the three variant cards show the same photograph, and the
bank's tests say so.
