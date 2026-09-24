# @retorika/copybank

The texts of generated sites, by sector ([ADR 0009](../../docs/decisions/0009-generated-texts-from-a-reviewed-bank.md)).

These are **content of a client's published website**, not interface text. They are Spanish
(es-ES) and they never belong in a `locales/es.json`.

## The one rule that matters

**No text reaches a client's site without a person having read it.** That is the binding half of
ADR 0009. Everything below is how it is kept.

Each file in `bank/` carries who approved it and when:

    "review": { "status": "approved", "by": "dnr", "date": "2026-09-24" }

`src/schema.ts` refuses to load a file whose `status` is anything but `approved`, and the parse
happens at module load, so an unreviewed file stops the application at start rather than reaching
a published page. `by` is the person, never the tool that drafted the text.

**Adding an entry to an approved file re-opens it:** update the date and sign it again. The file's
record covers the file as it stands, not as it once stood.

### There is no `drafts/` directory

ADR 0009 proposed one, with "moving an entry from `drafts/` to `bank/`" as the act of review.
This batch was reviewed in conversation *before* it was written, so nothing ever sat unreviewed
and a `git mv` would have proved nothing. The review record above is the trail instead.

If drafting ever outpaces review, `drafts/` is created then, along with the test proving no code
path reads it.

## What the reviewer checks

From ADR 0009, plus one rule this bank adds:

- **Nothing invented or promised**: no prices, no awards, no "el mejor", no waiting times, no
  health claims — physiotherapy and similar trades fall under the generic file, so the generic
  texts have to be safe for them.
- **Nothing the owner has not already said.** This is the addition. The questionnaire is what
  asserts things about a business; a text may describe what an answer *means*, never add to it.
  It is why "Menú del día" carries "Pregunta por el de hoy" and not a description of its courses,
  and why no cover text lists services — question 3 decides those.
- **A link's words say where it leads.** "Escríbenos por WhatsApp", not "Escríbenos".
- Spanish, and the tone of someone explaining their own shop.
- The length fits its slot.
- Nothing copied from a third party, and no real client data.
- The AI tool's terms allow commercial use of what it produced.

## How the texts were drafted, and what is missing from them

**Drafted by Claude (Opus), reviewed by a person, 24 September 2026.**

**Written without any usability session.** The sprint plan put the first session with a real
business before this bank precisely so the tone would come from an owner rather than from a
guess. That session had not happened when these were written. So the tone here is an argument
from ADR 0009's checklist, not evidence — and the first session is the thing most likely to
change it. When it happens, the findings amend this bank, and the files get re-signed.

## The shape

    bank/<sector>.json    the reviewed texts: the only files any code reads
    src/schema.ts          the rules of ADR 0009, as something that can fail
    src/index.ts           the cascade, the placeholder filling, and nothing else

A sector file holds three things:

- **`entries`** — one text per catalog slot, with the placeholders it uses declared. The closed
  list is `{negocio}` and `{ciudad}` (ADR 0010).
- **`suggestions`** — what question 3 offers for that sector. The same words become the card
  titles on the published site, which is why they live here and not in the questionnaire.
  A suggestion may carry no description: a card with nothing true to add is better than a line
  someone invented for it.
- **`actions`** — the words on the main button, by the action id question 5 collects.

### The cascade

A lookup tries the sector, then `generico`. So a sector's file carries only what differs, and
"Dónde estamos" is written once. A sector with no file of its own — seven of the ten launch
sectors today, and every "Otro sector" — gets the generic texts and no suggestions.

### `{ciudad}` may not exist

Question 4 is optional and admits "solo online o a domicilio". So **every text using `{ciudad}`
has a sibling without it**, the lookup skips entries it cannot fill, and a test walks every
sector, section and slot with and without a city to prove no `{` ever survives into a text.
