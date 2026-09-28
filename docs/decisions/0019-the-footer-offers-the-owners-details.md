# 0019 — The footer offers the owner's details, and never requires them

**Status:** **accepted** · **Date:** 2026-09-27 · **Proposed by:** development · **Accepted by:** the CEO, 2026-09-28 · **Amends:** protocol Part 15

> **What was decided.** Retorika takes no position on compliance and declines the responsibility
> the warning's wording already declined: the footer offers the owner's details and never
> requires them, and the warning says what is usual and where to ask, nothing more. Every field
> it adds stays optional and empty by default.

## Context

Until today a published Retorika site carries nothing about the person behind it except what
they typed into five questions: a business name, what they sell, an address if they gave one,
and a way to be contacted. None of it is framed as *who is legally responsible for this page*.

A Spanish business website conventionally identifies its owner — a trading name, a tax number,
an address, a contact email. Most of them carry it in the footer.

**The repository has never said anything about this.** A search for `aviso legal`, `LSSI`, `RGPD`,
`NIF`, `titular` or `responsable` across the protocol, the ADRs, the task files and the design
documents returns exactly one passage, protocol Part 15's «Datos personales», and it is about
something else:

> «Aquí hay datos de dos niveles: los de nuestros clientes y los de los clientes de nuestros
> clientes, que llegan por los formularios de sus webs. […] Aviso legal, política de privacidad y
> condiciones de uso antes de cobrar el primer euro, no después.»

That is **our** legal pages, tied to **our** charging, and a form flow [ADR 0016](0016-contact-section-has-links-not-a-form.md)
says does not exist. Nothing anywhere covers what a *client's published site* should carry about
its owner.

## Decision (proposed)

**"Pie de página" is a catalog section that offers the owner's details, and never requires them.**

- The business name is there from question 1, which is the one answer the questionnaire insists
  on. The rest — titular, NIF o CIF, domicilio, correo — **start empty and stay empty until the
  owner fills them in**, through the field panel of sprint 3 day 4.
- **Empty fields warn. They never block.** The download refuses for exactly one reason and it is
  still the only one: a button that points nowhere. This is the blocking-versus-warning line the
  product already draws, applied where it is most tempting to cross.
- **The warning claims nothing about the law.** Its wording is part of this decision, not a
  detail of the implementation:

  > «Las webs de negocios suelen identificar a su titular. Si tienes dudas, consúltalo con tu
  > gestoría.»

  It says what is usual and where to ask. It does not say what is required, what complies, or
  what a given business needs — because we do not know, it depends on the business, and a tool
  that guesses is worse than one that says nothing.
- **It shows the warning once, and only when no detail is filled at all.** If the owner filled
  some and left others, they made a decision. Nagging about the rest would be exactly the ruling
  on sufficiency this ADR refuses to make.
- **The footer carries no links.** Its job is to say who you are, not to be pressed; the contact
  section is where a visitor acts. That is also what makes "warns and never blocks" true rather
  than nearly true — a section with no destination in it has nothing the download can refuse.

## Why offer it at all, rather than nothing

Because the phase 1 acceptance criterion says «la web de un negocio real», and a page that
identifies nobody is not one a business puts its name on. The tool can hand someone a site that
is conventional in this respect without telling them it has to be.

And because the alternative is worse in both directions. Requiring the fields would mean Retorika
deciding what a business needs in order to be lawful, which no approved document gives it the
standing to do. Omitting them entirely would mean every owner who wants a normal footer has to
know they can add a free text section and type it themselves — which is the "you can build it"
answer this product exists to avoid.

## What this newly puts where

Named plainly, because it is the part that is easy to wave past. The owner's name, tax number and
address are personal data of a real person, and until now none of it left the questionnaire.

- **In the published HTML**, which is the point: a footer is meant to be read. Once that ZIP is
  uploaded, it is on the open internet, indexable, and out of everyone's hands including the
  owner's.
- **In `localStorage`**, through the autosave, on the owner's own machine.
- **Through `/api/download`**, in a request we answer and do not keep. Nothing is written to disk:
  the route builds the ZIP in memory and returns it (ADR 0012), so Part 15's «recoger lo mínimo y
  guardarlo el menor tiempo posible» is satisfied by collecting none of it at all.

Part 15 therefore gains a case it does not currently describe, and the amendment is this: **a
published site may carry its own owner's identifying details, put there by the owner, and
Retorika stores none of them.**

## Consequences

- The catalog gains a sixth section, which is the count [issue #25](https://github.com/dnarram/retorika-builder/issues/25)
  names as the moment to change the accessibility matrix's sampling.
- The section is generated by default, so every site identifies its business from the first
  render. The owner can delete it like any other section, and add it back from the pill.
- No new role: `body` throughout, from ADR 0004's closed vocabulary.
- The warning is a warning in the editor only. Nothing about it reaches the published page.

## What would reopen this

- **The CEO decides Retorika should take a position on compliance** — either by requiring the
  fields, or by saying in the interface what is needed. Then the warning's wording is the first
  thing to change, and it stops being a warning.
- **A client asks us to remove their details from a site already published.** We cannot: we do
  not hold the site. That is inherent to ADR 0001 rather than to this decision, but this is the
  first feature where it has a face, and it belongs in whatever terms of use Part 15 says come
  before the first euro.
