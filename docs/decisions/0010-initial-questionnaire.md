# 0010 — The initial questionnaire: five questions, the launch sectors, and the placeholder list

**Status:** accepted (the questions and the sectors; the placeholder list derived from them); the
proposal below is to be confirmed with the phase 1 screens · **Date:** 2026-09-22 · **Decided by:** the CEO

## Context

Concept dossier §4, step 1, and §5, screen 1: "Cinco preguntas, una por pantalla. […] De las
respuestas salen las secciones, los textos y los colores." Which five questions was open, and
ADR 0009 left the text bank's placeholder list waiting for them.

## Decision — decided by the CEO

- **Five questions, one per screen. Only the first two are required;** questions 3 to 5 can be
  skipped.
- **Every question is answered over prepared suggestions.**
- **The questions:**
  1. **The business's name,** and optionally its logo.
  2. **What it does.**
  3. **What it offers.**
  4. **Where it can be found.** It admits "solo online / a domicilio".
  5. **What a visitor should do:** call, WhatsApp, book, write, or come to the premises.
- **The launch sectors,** which are the suggestions of question 2:
  - peluquería y barbería;
  - estética;
  - fisioterapia;
  - restaurante y bar;
  - tienda;
  - taller;
  - reformas;
  - academia;
  - fotografía;
  - asesoría.

  That is ten sectors, **plus "Otro"**, which gets generic texts.

## Derived from it — the closed placeholder list

**The rule:** an answer enters a bank text only as a **proper noun**. Anything else the user
writes becomes a whole element of its own, and is never spliced into a bank sentence. A name fits
in any sentence. Free text spliced into a reviewed sentence gives a sentence nobody reviewed,
which ADR 0009 forbids.

| Placeholder | Comes from | Always present |
|---|---|---|
| `{negocio}` | question 1, the name | **yes:** question 1 is required |
| `{ciudad}` | question 4, the town or city | **no:** question 4 can be skipped, or answered "solo online / a domicilio" |

- **That is the whole list.** Adding a placeholder amends this ADR.
- **Every bank text that uses `{ciudad}` has an alternative without it.** The generator uses that
  alternative whenever `{ciudad}` has no value.
- **The generator never publishes an unfilled placeholder.** The generator task includes a test
  that checks it.
- **A filled placeholder is plain text in the document,** escaped like any other text when
  rendered.

**What the other answers become** (none of them is a placeholder):

| Answer | Becomes |
|---|---|
| 1 — the logo | an image in the site, and the source of the palette (dossier §4: "saca la paleta de su logo"). Without a logo, the sector's default palette |
| 2 — the sector | which bank file is read: `bank/<sector>.json`. For "Otro", `bank/otro.json` plus the user's own words as a whole element |
| 3 — the suggestions picked | the cards of "Qué hago": each card takes its title and description from the bank. A service the user types becomes a card with their title and no description (an item's description is 0..1) |
| 4 — the place | the "Horario y ubicación" section, with the address or area shown whole, and `{ciudad}` when there is a town or city |
| 5 — the action | the cover's main button, and the "Contacto y reservas" section. The button's label comes from the bank, keyed by action. The contact data is asked on the same screen: a phone, a WhatsApp number, a booking link or an email |

## Proposal — to be confirmed with the phase 1 screens and the prototype

- **Sector ids** are ASCII: `peluqueria-barberia`, `estetica`, `fisioterapia`, `restaurante-bar`,
  `tienda`, `taller`, `reformas`, `academia`, `fotografia`, `asesoria`, `otro`. The visible names
  go in `locales/es.json`.
- **Button labels by action** do not depend on the sector. They live in a shared bank file,
  `bank/comun.json`, with the same review.
- **The suggestions of question 3 start unticked,** and the user taps the ones they offer.
  Ticking them in advance would be another way of promising services the business may not offer.
- **A skipped question adds nothing invented:**
  - question 3 skipped: "Qué hago" is not generated, and the user can add it from the catalog;
  - question 4 skipped: "Horario y ubicación" is not generated, and only texts without `{ciudad}`
    are used;
  - question 4 answered "solo online / a domicilio" with no town or city: only texts without
    `{ciudad}` are used;
  - question 5 skipped: no main button (the cover's `primaryAction` is 0..1), and "Contacto y
    reservas" is generated only if there is some contact data.
- **Question 5:** one main action, and optionally a second one as a secondary link (the cover's
  `secondaryAction` is 0..2).
- **Question 3, settled since by [ADR 0013](0013-services-cardinality.md):** one to six cards,
  and none means the section is not generated.

## Consequences

- **ADR 0009's open item "the five questions, and with them the placeholder list" is settled
  here.**
- **Sectors the dossier names that are not on the list** go through "Otro" at launch. For
  example, peluquerías caninas.
- **The sample photos per sector are [ADR 0011](0011-sample-photos-per-sector.md).**
- The dossier v1.2 takes this in with the phase 1 screens
  ([ADR 0008](0008-hosted-publishing-has-no-plan.md)).

## Evidence from session 1 (26 September 2026)

> One business, run against the deployed editor. ADR 0017 calls the two sessions «two
> experiments of one subject each»; one of them is not a tendency, and nothing below is
> written as one.
> Source: `docs/sessions/2026-09-25-taberna-santo-domingo.md`.

**The questionnaire was not misunderstood.** No doubts were recorded on any of the seven screens —
the name and logo, the sector, what you offer, where you are, the main action, the generation wait,
or the three variants.

That negative finding is the one this ADR most needed, and it is also what keeps **ADR 0017**
closed: that ADR crossed a gate on the promise that if the first session showed the questionnaire
itself was misunderstood, the screens would change before anything else was built on them. It did
not, so they do not.

Two specifics for the sector list:

- **He found his trade among the ten** and did not go looking for his exact case. «Restaurante»
  was enough; he never reached for «Otro sector».
- **He read the grid; he did not use the search field.** The search aliases of
  `packages/catalog/src/search.ts` were therefore not exercised at all. Not evidence that they are
  unnecessary — evidence that nothing here tested them.

**How he named his own trade, unprompted:** «Restaurante», «negocio familiar», «bar de toda la
vida». The list's label for it is "Restaurante y bar", which contains the first and the last of
those.

## Evidence from session 2 (27 September 2026)

> Source: `docs/sessions/2026-09-27-conchi.md`.

**The questionnaire was not misunderstood, for the second time in two sessions.** «El cliente no
hizo preguntas y usó correctamente la app.» Five screens, **two minutes**, no hesitation recorded
and nothing explained or demonstrated.

Two sessions is not a sample, but it is both of the ones this project planned, and neither found
the thing ADR 0017 was most afraid of.

**What the second session leaves open about this ADR, rather than closing:**

- **Whether the sector list works was not observed this time.** Whether she found her trade among
  the ten, and whether she read the grid or used the search field, is not on record. The first
  session answered it once («lo encontró», «leyó la rejilla»); this one adds nothing to it, and
  `packages/catalog/src/search.ts`'s aliases have now gone two sessions without being exercised by
  anybody.
- **Two minutes may be the finding, not the reassurance.** Asked what the site lacked, Conchi
  wanted texts that «hacen soñar con el plato» — and the questionnaire asks nothing that could
  produce one. Five questions that take two minutes cannot collect what hostelería copy needs to
  be written from. That is the other half of ADR 0009's finding, and it lands here: the bank can
  only be as specific as the answers it is given.

  **Made concrete by trying, 28 September 2026.** The hostelería rewrite was drafted
  (`packages/copybank/drafts/restaurante-bar.json`), and what it could not write is a sharper
  statement of the gap than the observation was. Each item is a sentence the draft wanted and had
  to drop, with the question that would have allowed it:

  | What a hostelería text cannot say | Why | What would have to be asked |
  |---|---|---|
  | Anything about the food | The bank does not know what is on the menu. Question 3 collects categories — «Comidas», «Tapas», «Terraza» — never a dish | Something that collects two or three real dishes, in the owner's words |
  | «nuestra cocina», «en la barra» | **The sector conflates a restaurant with a bar.** `restaurante-bar` is one id, so a text about a kitchen is wrong for a place that only pours, and one about the bar is wrong for a dining room. Every text has to work for both, which rules out most of the register that would «hacer soñar» | Either a split of the sector, or one question distinguishing them |
  | Anything about the room, the terrace, the feel of a service | Question 4 collects an address and hours as data, never as atmosphere | Nothing short of a free-text question, which is the thing the five-question design exists to avoid |
  | A contact line naming a channel — «Reserva», «Llámanos» | Question 5 gives one main action, and the text has no way to know which | Nothing: this one is better solved by the buttons saying it, which they already do |
  | Anything the owner would say about themselves — how long they have been open, who cooks, what they are known for | No question asks | A sixth question, which is a decision about the two minutes, not about the bank |

  **The last row is the one that matters**, because it is the only gap a single extra question
  would close, and closing it would trade the measured two minutes for copy that sounds like the
  owner. That trade is direction's to make, not development's — and nothing in it is blocked
  meanwhile: the draft ships the register change both owners asked for, without the specifics
  neither was ever asked to give.
