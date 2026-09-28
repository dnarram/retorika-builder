# 0020 — Contact stays links-only for phase 1; the web form is a scoped, unscheduled phase 2 item

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** the CEO · **Resolves:** [ADR 0016](0016-contact-section-has-links-not-a-form.md)

## Context

ADR 0016 proposed «Contacto y reservas» as links only — `tel:`, `https://wa.me/…`, `mailto:` —
and wrote its own reopening condition: if either usability session's owner said they expected
messages to arrive from the web, the ADR would reopen rather than become accepted. It also said,
in advance, what would follow if that happened:

> «This ADR does not become accepted. […] Deciding what replaces it is not development's to
> write.»

The condition fired on 27 September 2026: Conchi named «un formulario muy simple desde la web con
la información justa» as one of four ways she would like to be reserved with, asked word for word.
Taberna named a form too, spontaneously, in an answer ADR 0016 correctly ruled inadmissible. One
admissible answer, in a sample of two, was what the condition was written to catch.

ADR 0016 has sat since then as neither accepted nor rejected — proposed, with its own text
explaining why it cannot become accepted as written. That is not a resting state; it is a decision
waiting for the CEO.

## Decision

- **ADR 0016 is accepted for what it actually covers: phase 1's contact section ships links,
  not a form.** `tel:`, `https://wa.me/…` and `mailto:` are what «Contacto y reservas» offers
  today, and nothing about that changes. No code changes as a result of this ADR.
- **The web form Conchi described is split off as its own phase 2 item — named, not built, and
  not scheduled.** It is not a rejection of the request: two owners out of two, one admissibly,
  asked for it. It is a recognition that a form is a different kind of thing from a link, with
  costs a links-only decision never had to account for.
- **What the phase 2 ADR has to answer, carried forward from ADR 0016 unchanged:** which service
  sits behind the form, what it costs, what happens to a client's site the day that service stops,
  and the data processing agreement protocol Part 15 requires — because a submission is the
  personal data of *our clients' clients*, which Part 15 calls «el segundo nivel… el delicado».
- **Two details from the evidence travel with the item, so they are not lost between a session and
  a specification:** Conchi qualified her request twice — «muy simple», «con la información
  justa» — which is evidence about its size, not a request for a full contact form. And it is
  third of four channels she named; the other three (WhatsApp, email, phone) already ship.

## Why this is not itself the phase 2 ADR

Because ADR 0016 was explicit about what that ADR has to answer, and none of those questions has
an answer yet: no service is chosen, no cost is known, no data processing agreement is drafted.
Deciding to build a form without those answers would be deciding the shape of a thing before
knowing what it costs to run. This ADR closes the open question ADR 0016 left — *is a form coming,
and does it block phase 1* — without pretending to close the one after it.

## Consequences

- ADR 0016's status line now points here. Its own record — the evidence, the reopening condition,
  the note about the first session's inadmissible answer — is not rewritten: an ADR is not edited
  once the record it made is the point of it.
- `docs/tasks/backlog.md`'s row for the contact form is unchanged in substance: still waiting on
  a phase 2 ADR naming the service, its cost, and the data processing agreement. What changes is
  that phase 1's own question — does this block anything today — is now answered: no.
- The `field` role stays unused by the catalog, exactly as ADR 0016 left it. It remains in ADR
  0004's vocabulary for phase 3's free sections, placed by no preset.
