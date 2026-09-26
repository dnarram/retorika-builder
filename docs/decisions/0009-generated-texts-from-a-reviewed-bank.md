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
