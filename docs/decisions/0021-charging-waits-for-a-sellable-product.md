# 0021 — Charging waits until the product is professionally sellable

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** the CEO · **Touches:** `docs/design/billing-questions.md`, protocol Part 15 («Pagos»)

## Context

`docs/design/billing-questions.md` (28 September 2026) laid out six questions direction has to
answer before the first euro is charged — who issues the invoice, VAT-inclusive or not, business
or consumer buyers, sales outside Spain, who owns the invoice numbering, and what a refund can
mean once a ZIP has been handed over — plus the terms of use, privacy policy and aviso legal
protocol Part 15 requires before charging starts.

Those questions still have no answers. This ADR is about a different question: **whether now is
the moment to seek them.**

## Decision

- **Charging is deferred until Retorika Builder is professionally sellable**, meaning the editor
  covers enough of what an owner needs to publish a site they are willing to put their name on —
  not merely a site they can build in under ten minutes. Phase 1's acceptance criterion measures
  the second; it does not measure the first, and the two usability sessions said so directly: both
  owners built a site in the time measured, and neither said they would publish it as it stood.
- **Integrating a payment gateway and answering the billing questions before then is work with
  nothing to attach to.** A Stripe Price object, an invoice template and a data processing
  agreement all describe a transaction; there is no transaction to describe until there is a
  product worth the amount being decided. Building the payment path first would mean revisiting
  it once the product changes shape, rather than building it once against a product that has
  settled.
- **`docs/design/billing-questions.md` is not withdrawn.** The six questions stand, unanswered,
  and nothing about them changes. What changes is when they are asked: when the editor is judged
  ready, not on a fixed date this ADR does not set.
- **The mechanism protocol Part 15 already decided is unaffected.** Stripe, single payment,
  Checkout, an idempotent webhook and three stored states remain the plan; this ADR defers
  *when* that plan is built, not *what* it is.

## What "professionally sellable" is not

**Not a number, and not this ADR's to define.** It is a judgement about the editor — Estilo,
variantes de sección, páginas orgánicas, the gap between "la monté" and "la publicaría" the two
sessions named — and it is direction's to make when it is made, the same way phase 1's acceptance
was direction's rather than development's. This ADR sets the order, not the date.

## Consequences

- Sprint planning treats charging, accounts and payment integration as **not scheduled**, the
  same status ADR 0008 gives hosted publishing: no reactivation event, no date. If it is ever
  reconsidered, that reconsideration is its own decision, not a checklist waiting to be worked
  through.
- `docs/tasks/backlog.md`'s entry for accounts and charging is updated to point here.
- The six billing questions are not sent to direction or to the gestoría as a task with a
  deadline. They are answered when the product is judged ready, whenever that is decided to be.
