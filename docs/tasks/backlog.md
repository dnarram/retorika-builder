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

Last reviewed: 28 September 2026, at the close of sprint 4.

---

## Decided elsewhere, waiting on someone

| What | Where it is written | Waiting on |
|---|---|---|
| **A contact form.** Scoped, 28 September 2026: [ADR 0020](../decisions/0020-contact-stays-links-only-for-phase-1.md) accepted ADR 0016's phase 1 links-only scope and split the form off as its own, unscheduled phase 2 item. | [ADR 0020](../decisions/0020-contact-stays-links-only-for-phase-1.md), resolving [ADR 0016](../decisions/0016-contact-section-has-links-not-a-form.md) | A phase 2 ADR naming the service, its cost, what happens to a client's site the day that service stops, and the data processing agreement protocol Part 15 requires |
| **How a carta of several courses reads.** Three «Precios» sections one after another are three separate blocks: each has 48px of its own padding and the page puts 76px between them, so **172px of air separates the last dish of one course from the heading of the next**, and nothing frames them as one menu. Measured by building one on 28 September 2026. The cheap lever is a renderer rule making two adjacent sections of the same preset close up; whether that should happen at all is a general design decision, since it would apply to two «Opiniones» just as much. | [`docs/design/REVIEW.md`](../design/REVIEW.md) | Direction, on whether adjacent sections of one kind should read as one |
| **The hostelería text bank — resolved, 28 September 2026.** Both `packages/copybank/drafts/*.json` files were read and signed; the hostelería rewrite and the per-sector «Precios» headings are in `bank/` now. What the draft could not write — a sixth question, direction's to add — is still open. | [ADR 0009](../decisions/0009-generated-texts-from-a-reviewed-bank.md), and [ADR 0010](../decisions/0010-initial-questionnaire.md) | Nothing, for the bank itself. The sixth-question option in ADR 0010 is direction's whenever it wants it |
| **`packages/photobank`.** The owner's own photo (ADR 0018) does not replace it: a site has to look finished before the first upload, and two sessions produced exactly one observation about it. | [ADR 0011](../decisions/0011-sample-photos-per-sector.md) | Licensed images, which is content production rather than code |
| **Hosted publishing.** | [ADR 0008](../decisions/0008-hosted-publishing-has-no-plan.md), and `serve.md` in this directory, which is dormant by that decision | Nothing. It is on hold with no plan, and that is the decision |

## Open questions, filed

| What | Where |
|---|---|
| **Formatting inside a text.** Bold and underline, asked for once, at the cost of a schema change — and possibly a symptom of the text bank rather than a request of its own. | [#52](https://github.com/dnarram/retorika-builder/issues/52) |
| **Type pairs falling back** on machines without Inter / Playfair Display. Still open — the fallback itself is unchanged — but the interface half is now handled: the Estilo panel names typefaces by character («Moderna y neutra») and never by font, and its `Aa` specimen renders in the real stack, so what it shows is what that machine will give. | [#9](https://github.com/dnarram/retorika-builder/issues/9) |

## Recorded against the thing it challenges

| What | Where |
|---|---|
| **Moving images freely.** Conchi asked for it; it collides with document rule 4, and rule 5 already named the hole it would open. The rule stands, and the request is on the record so the next person hears it as the second time. | [`docs/document-rules.md`](../document-rules.md), the note under rule 4 |
| **The design review's own open list** — mockup 13's palettes, the third cover composition, `location`'s `split` gap, and the rest. | [`docs/design/REVIEW.md`](../design/REVIEW.md), "Still open" |
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
- **The three findings of sprint 4 that nobody has acted on**, all of them measured rather than
  supposed, and each one already written up where it belongs:
  - Whether a hostelería owner recognises «Precios» in the menu ([#51](https://github.com/dnarram/retorika-builder/issues/51), a hypothesis for the next session).
  - Whether two adjacent sections of the same preset should read as one (the 172px row above).
  - The editor's top bar naming the variant where mockup 08 names the business
    ([`REVIEW.md`](../design/REVIEW.md), found on day 2 and older than the sprint).
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
