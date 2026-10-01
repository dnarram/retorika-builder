# 0009 — Generated sites take their texts from a reviewed, per-sector template bank

**Status:** accepted (the decision); the technical proposal below is to be confirmed in the
generator task · **Date:** 2026-09-22 · **Decided by:** the CEO

> Updated 2026-09-22: the five questions and the closed placeholder list are ADR 0010, and the
> sample photos are ADR 0011. The decision below is unchanged.

## Context

The concept dossier leaves open "¿Generamos los textos automáticamente por sector?", and says why
it matters: "es lo que hace funcionar tanto las tres variantes como el relleno de las plantillas.
Sin esto, las dos cosas llegan con texto de prueba." Phase 1's generator needs an answer before
it can produce anything a client would keep.

## Decision — decided by the CEO

- **The texts of generated sites come from a bank of text templates, organised by sector.**
- **Texts are drafted with the help of free generative AI,** and **reviewed by a person before
  they enter the bank.**
- **No text enters the bank without that review.**

That is the whole of the decision. Everything below it is a proposal.

## Proposal — to be confirmed in the generator task

**Not decided.** This is how the decision could be carried out. The generator task confirms it or
replaces it, and whatever it settles is recorded there. Changing this section does not need a new
ADR; changing the decision above does.

### The generator reads the bank only

It never calls an AI while generating a site. So a site's texts cost nothing per site, depend on
no provider being up, are the same every time for the same answers, and have all been read by a
person.

### Where the bank lives

**A new package, `packages/copybank`, created with the generator task, not by this ADR:**

    packages/copybank/
      bank/<sector>.json      reviewed texts: the only files any code reads
      drafts/<sector>.json    AI drafts awaiting review: no code reads them, ever
      src/schema.ts           the Zod schema of an entry
      src/index.ts            loading, and a deterministic, seeded choice for "volver a generar"
      test/bank.test.ts       the checks below

### The format of one entry, in JSON like the fixtures

    {
      "id": "peluqueria-barberia.cover.headline.01",
      "sector": "peluqueria-barberia",
      "section": "cover",
      "slot": "headline",
      "text": "Cortes y arreglos de barba en {ciudad}",
      "placeholders": ["ciudad"],
      "origin": "ai-draft",
      "review": { "status": "approved", "date": "2026-10-03" }
    }

- **`section` and `slot`** are the catalog's ids, so a text knows exactly where it goes.
- **Placeholders** come from the closed list of [ADR 0010](0010-initial-questionnaire.md):
  `{negocio}` and `{ciudad}`.
  - `{negocio}` always exists, because question 1 is required.
  - `{ciudad}` may not exist: question 4 is optional, and admits "solo online / a domicilio".
  - **Every bank text that uses `{ciudad}` has an alternative without it.**
  - **The generator never publishes an unfilled placeholder.** The generator task includes a test
    that checks it.
- **Texts are in Spanish (es-ES).** They are site content, not interface text, so they do not go
  in `locales/es.json`.

### Making "no text enters without review" checkable

- **Moving an entry from `drafts/` to `bank/` is the review.** It is done in a pull request, by a
  person.
- **The schema refuses a bank entry without `review.status: "approved"` and a date.** A test
  proves no code path ever reads `drafts/`.
- **What the reviewer checks,** written in `packages/copybank/README.md` when the package is
  created:
  - nothing invented or promised: no prices, no awards, no "el mejor", no waiting times, no
    health claims (physiotherapists, for example);
  - Spanish and tone;
  - length fits its slot;
  - no text copied from a third party;
  - no real client data;
  - the AI tool's terms allow commercial use of what it produced.

### Why files in the repository and not a database

- the bank is versioned and reviewed in pull requests like the rest of the code;
- it works offline, and the generator stays deterministic.

If the bank ever needs to be edited by people who do not work in the repository, that is a
decision for a new ADR.

## Consequences

- The generator task settles the proposal and fills the launch sectors of ADR 0010, plus the
  generic texts of "Otro".
- Whatever package holds the bank goes into the repository tree of protocol 3.4 when it is
  created.
- **Settled since:**
  - the photo bank: [ADR 0011](0011-sample-photos-per-sector.md);
  - the five questions and the placeholder list: [ADR 0010](0010-initial-questionnaire.md).

## Evidence from session 1 (26 September 2026)

> One business, run against the deployed editor. ADR 0017 calls the two sessions «two
> experiments of one subject each»; one of them is not a tendency, and nothing below is
> written as one.
> Source: `docs/sessions/2026-09-25-taberna-santo-domingo.md`.

Asked «¿Estos textos suenan a los tuyos?», the owner of Taberna Santo Domingo answered:

> «Los míos serían más explicativos, un poco más extensos tal vez pero dependerían del contenido
> visual e imágenes. En el prototipo mostrado la página me parece algo vacía y fría.»

**This is a finding about the bank, not a failure of the session** — the script says so in
advance. Three things in it are worth separating, because they are not the same complaint:

- **«Más explicativos», «más extensos».** The bank's texts are short by design: ADR 0009's own
  reasoning is that a short true sentence beats a long invented one, and that nothing may claim
  what the owner did not say. Length is the one thing a template bank cannot add without
  inventing. **Not actioned, and the reason is the decision itself** — if the second session says
  the same, what changes is not the length but whether the owner is asked for more in the first
  place, which is a questionnaire change (ADR 0010), not a bank change.
- **«Dependerían del contenido visual e imágenes».** He did not treat text and photo as separate
  problems. That connects this to ADR 0011 rather than to this ADR.
- **«Vacía y fría».** Aimed at the whole page, not at a sentence. See ADR 0011.

**His own vocabulary, which is what the script asks to collect for the bank:** «negocio familiar»,
«bar de toda la vida», «comida con sabor», «comida tradicional». None of the four appears in
`packages/copybank/bank/restaurante-bar.json` today. They are recorded here, not added: a bank
entry written from one owner's words would be that owner's site, not a sector's.

## Evidence from session 2 — and what the two together say (27 September 2026)

> Source: `docs/sessions/2026-09-27-conchi.md`. Two owners, both hostelería, which is what this finding is about: it is
> evidence about that sector's bank, not about every sector's.

Asked «¿Estos textos suenan a los tuyos?», Conchi answered:

> «Creo que no, me gustarían textos más enfocados a la hostelería. En hostelería es muy importante
> convencer y hacer soñar con comidas y servicio. Hacer un poco soñar con el plato.»

**Two out of two said the texts do not sound like theirs.** That is the clearest finding either
session produced about this ADR, and it is the one thing here that no longer rests on a single
person.

But they said it **differently**, and merging them would lose the useful half:

- **Taberna** wanted them longer and more explanatory — «los míos serían más explicativos, un poco
  más extensos» — and found the page «vacía y fría».
- **Conchi** wants them more evocative. The bank *describes a service*; hostelería needs to *sell
  an experience*.

What they share is that the register is wrong for hostelería. What they do not share is the
direction of the fix, and a bank rewritten to satisfy one would not satisfy the other.

**This still does not license inventing.** This ADR's own reasoning stands: a short true sentence
beats a long invented one, and nothing may claim what the owner did not say. «Hacer soñar con el
plato» is a register, not a licence to describe food nobody mentioned — the bank does not know
what is on her carta. The honest reading of both answers together is that the *questionnaire* asks
for too little to write hostelería copy from, which makes this a finding about ADR 0010 as much as
about this one.

**Her vocabulary, recorded and not added to the bank** (same rule as the first session — a bank
entry written from one owner's words would be that owner's site, not a sector's): «hostelería»,
«convencer», «hacer soñar con comidas y servicio», «hacer soñar con el plato», «platos», «la
carta».

## Evidence from session 3 — the first «sí» (30 September 2026)

> Source: `docs/sessions/2026-09-30-taller.md`. One business, sector `taller`, run against an
> editor with sprint 9 complete. The first session that is not hostelería.

Asked «¿Estos textos suenan a los tuyos?», the owner answered **sí**.

**This is the first «sí» the product has had**, and it is the strongest evidence this ADR has
received. Two things qualify it, and both belong here rather than in a summary that would report
only the first line.

### It is reported, not quoted

The session recorded the substance and not the words. Every other answer in this ADR is a
quotation; this one is not, and none of the owner's vocabulary was harvested — which is the thing
the script asks for on this ADR's behalf, because it is what a bank should be using. So the
strongest validation this decision has is also the least literal, and the next session should fix
that before it does anything else.

### It is not the answer to the two noes

**The three answers are not about the same bank**, and merging them into "two noes then a yes"
would describe a repair that has not been tested:

- Taberna and Conchi are both hostelería. Both were shown **`restaurante-bar`**, which was signed
  on 28 September, the day after Conchi's session.
- This owner was shown **`taller`**, signed on 30 September — one of the seven the sprint 7 rewrite
  added, all seven of which carry that date.

**No hostelero has been asked since the hostelería bank was fixed.** The two noes that caused the
rewrite remain unanswered for their own sector.

### What it does establish, which is not small

**The method works.** This ADR's decision is that generated texts come from a reviewed, per-sector
bank rather than from free generation. A reviewed sector bank has now produced a site whose texts a
real owner of that sector claimed as sounding like his own, on the first try, with no editing of
the copy recorded. That is the first time any evidence has pointed at this decision rather than at
a gap in it.

**What it does not establish:** that one of the seven working validates the other six, or that the
rewrite satisfied the two owners it was written for. Both need a session each, and the hostelería
one is the older debt.
