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

Last reviewed: 28 September 2026, at the close of sprint 3.

---

## Decided elsewhere, waiting on someone

| What | Where it is written | Waiting on |
|---|---|---|
| **A contact form.** ADR 0016's reopening condition fired: asked word for word, Conchi named «un formulario muy simple desde la web con la información justa». | [ADR 0016](../decisions/0016-contact-section-has-links-not-a-form.md) — its status line says so | A phase 2 ADR naming the service, its cost, what happens to a client's site the day that service stops, and the data processing agreement protocol Part 15 requires |
| **How a carta of several courses reads.** Three «Precios» sections one after another are three separate blocks: each has 48px of its own padding and the page puts 76px between them, so **172px of air separates the last dish of one course from the heading of the next**, and nothing frames them as one menu. Measured by building one on 28 September 2026. The cheap lever is a renderer rule making two adjacent sections of the same preset close up; whether that should happen at all is a general design decision, since it would apply to two «Opiniones» just as much. | [`docs/design/REVIEW.md`](../design/REVIEW.md) | Direction, on whether adjacent sections of one kind should read as one |
| **The hostelería text bank.** Two owners out of two said the texts do not sound like theirs, for opposite reasons — one wanted them longer, the other more evocative. **Written on 28 September 2026 and waiting to be read**, in `packages/copybank/drafts/restaurante-bar.json`: ADR 0009's binding half is that a person reads a text before it ships, and development cannot sign that. Approving it is one word; nothing reaches a site until then. | [ADR 0009](../decisions/0009-generated-texts-from-a-reviewed-bank.md), and the package README | **Direction, to read seven texts.** What the draft could not write, and the one question that would change that, is in [ADR 0010](../decisions/0010-initial-questionnaire.md) |
| **CEO signatures.** Three ADRs shipped `proposed` on purpose, with code merged, because every one of them is optional and claims nothing. | [0018](../decisions/0018-own-cover-photo-before-phase-2.md) (photo, phase boundary), [0019](../decisions/0019-the-footer-offers-the-owners-details.md) (footer, owner's details), and what to do about [0016](../decisions/0016-contact-section-has-links-not-a-form.md), which cannot become accepted | Direction |
| **`packages/photobank`.** The owner's own photo (ADR 0018) does not replace it: a site has to look finished before the first upload, and two sessions produced exactly one observation about it. | [ADR 0011](../decisions/0011-sample-photos-per-sector.md) | Licensed images, which is content production rather than code |
| **Hosted publishing.** | [ADR 0008](../decisions/0008-hosted-publishing-has-no-plan.md), and `serve.md` in this directory, which is dormant by that decision | Nothing. It is on hold with no plan, and that is the decision |

## Open questions, filed

| What | Where |
|---|---|
| **«La carta».** Both restaurant owners asked for it unprompted; the planned «Precios» may already be that section under a name neither would recognise. | [#51](https://github.com/dnarram/retorika-builder/issues/51) |
| **Formatting inside a text.** Bold and underline, asked for once, at the cost of a schema change — and possibly a symptom of the text bank rather than a request of its own. | [#52](https://github.com/dnarram/retorika-builder/issues/52) |
| **Type pairs falling back** on machines without Inter / Playfair Display. Still open — the fallback itself is unchanged — but the interface half is now handled: the Estilo panel names typefaces by character («Moderna y neutra») and never by font, and its `Aa` specimen renders in the real stack, so what it shows is what that machine will give. | [#9](https://github.com/dnarram/retorika-builder/issues/9) |

## Recorded against the thing it challenges

| What | Where |
|---|---|
| **Moving images freely.** Conchi asked for it; it collides with document rule 4, and rule 5 already named the hole it would open. The rule stands, and the request is on the record so the next person hears it as the second time. | [`docs/document-rules.md`](../document-rules.md), the note under rule 4 |
| **The design review's own open list** — mockup 13's palettes, the third cover composition, `location`'s `split` gap, and the rest. | [`docs/design/REVIEW.md`](../design/REVIEW.md), "Still open" |
| **The price.** Two sessions answered it and they overlap at 50 €. | [`docs/design/HANDOFF.md`](../design/HANDOFF.md), the open-questions table |

## No home but this one

- **Accounts and persistence with Supabase, and charging.** The largest remaining piece of phase 2.
  The mechanism is decided — Stripe, single payment, Checkout, idempotent webhook, three stored
  states (protocol Part 15) — and what is not is now written out as six questions for direction in
  [`docs/design/billing-questions.md`](../design/billing-questions.md), which is why charging is
  not in sprint 4. One of the six is ours to raise rather than theirs to remember: **once the ZIP
  is handed over there is nothing to switch off** (ADR 0001), so what a refund can even mean has to
  be decided before the terms of use are written, not after.
- **The two catalog sections still missing** of the dossier's nine: Fotos de trabajos and Equipo.
  Seven are built; «Precios» landed on 28 September 2026 (#51). **Fotos de trabajos is the one
  with evidence behind it**: Taberna asked for «los platos estrella o la carta», and only the
  second of those is a price list — a showcase of three or four dishes with photographs is a
  gallery, and nothing serves it.
- **A list item's optional slots cannot be reached.** The fields panel is explicit that "a list
  holds items rather than a value", so its rows are the section's slots and never an item's. A
  card's `description` in «Qué hago» has been `0..1` and unreachable since sprint 1, and a price
  line's is the same. It has not bitten because the questionnaire fills the cards it generates,
  and because a carta line reads perfectly as a name and a price. The fix is either extending
  `SlotAddress` to name an item, or a second panel; neither is small.
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
