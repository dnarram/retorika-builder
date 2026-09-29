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

### `drafts/` exists as of 28 September 2026

It did not at first. ADR 0009 proposed one, with "moving an entry from `drafts/` to `bank/`" as
the act of review, but the first batch was reviewed in conversation *before* it was written, so
nothing ever sat unreviewed and a `git mv` would have proved nothing. This README then said: "If
drafting ever outpaces review, `drafts/` is created then, along with the test proving no code path
reads it."

**That is what happened.** The two usability sessions both found the tone wrong for hostelería
(see below), the rewrite of `restaurante-bar` was drafted on 28 September 2026, and nobody had
read it yet. So it sat in `drafts/`, and `test/drafts.test.ts` is the promised test.

**It was read and signed on 28 September 2026**, along with `generico`, and both moved into
`bank/` — the `git mv` ADR 0009 calls the review. This paragraph said they were still waiting
until 29 September, which is the kind of claim that stays true for three days and then quietly
is not; it is corrected here rather than repeated.

`drafts/` is in use again from **29 September 2026** (sprint 7 days 4 and 5): the seven launch
sectors that have no bank file of their own, written as drafts for one person to read. See "How
the texts were drafted" below.

A draft file carries `"review": { "status": "draft", "drafted": "YYYY-MM-DD" }` — **no `by`
field**, because nobody has approved it and there is nobody to name. It is validated by
`draftFileSchema`, which is the strict schema with the signature swapped out, so approving a draft
is a one-word change that cannot fail on a rule nobody had checked yet.

Three things stop a draft reaching a published page, and the test asserts all three: nothing in
`src/` imports from `drafts/`, `sectorFileSchema` rejects it outright, and asking the bank for the
slots it rewrites still returns the approved words.

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

**The sessions happened, and that is exactly what they found.** Asked «¿Estos textos suenan a los
tuyos?», two owners out of two said no, for opposite reasons that must not be averaged:

- **Taberna Santo Domingo, 25 September 2026** — «Los míos serían más explicativos, un poco más
  extensos tal vez pero dependerían del contenido visual e imágenes. En el prototipo mostrado la
  página me parece algo vacía y fría.» Note the two hedges: *tal vez*, and *dependerían de las
  imágenes*. Half of «vacía y fría» is a photo problem (ADR 0011), not a text one.
- **Conchi, 27 September 2026** — «me gustarían textos más enfocados a la hostelería. En hostelería
  es muy importante convencer y hacer soñar con comidas y servicio. Hacer un poco soñar con el
  plato.»

What they share is the register: the generic file's «Qué hacemos», «Esto es lo que ofrecemos en
{negocio}» and «Dinos qué necesitas» are the words of a trade that takes appointments, not of a
place where people sit down. That rewrite was drafted, read and signed on 28 September 2026, and
is what `bank/restaurante-bar.json` says today.

**«Hacer soñar con el plato» is a register, not permission.** The bank does not know what is on the
menu, and the rule above — nothing the owner has not already said — holds. What the questionnaire
would have to ask before a text could do more is written up in
[ADR 0010](../../docs/decisions/0010-initial-questionnaire.md).

### The seven remaining sectors, drafted 29 September 2026

**Drafted by Claude (Opus). Unread, unsigned, and serving nothing** until somebody moves each file
out of `drafts/`. Sprint 7 days 4 and 5, in the order of the likely number of small businesses in
Spain that would want a simple website — `reformas`, `estetica`, `taller`, `asesoria`,
`fisioterapia`, `academia`, `fotografia`. That order is a judgement, not a figure anybody can
cite, and it only decides which get read first.

**Why this was worth a sprint at all:** these seven fall through to `generico`, whose
`suggestions` array is empty. So question 3 offers them nothing to tick — and by
[ADR 0013](../../docs/decisions/0013-services-cardinality.md) ticking nothing means **no services
section at all**. For seven of the ten launch sectors the site comes out shorter as well as
blander, which is what Taberna described as «vacía y fría».

**Each file carries only what differs from `generico`,** which is the cascade's own rule and not a
shortcut: a sector file that repeated «Dónde estamos» would be a line to re-read on every review
for no decision. So the files run to six or seven entries rather than to a fixed count, and a slot
is absent exactly where the generic words are already the trade's own — `reformas` keeps
«Qué hacemos» over its services for that reason.

**What was deliberately not written,** because each would have been the text asserting something
the owner never did:

- **No cover text lists services.** Question 3 decides those, and a cover that named them would
  promise an owner's site services they never ticked.
- **No claim of scope inside a suggestion.** `reformas` ships «Reformas de baños» and «Reformas de
  cocinas» with no description at all, because every description tried — «baños completos», «del
  alicatado a la grifería» — narrowed or widened what the owner does. A card with nothing true to
  add is better than a line somebody invented for it, and two of the six exist to show that.
- **No result, and no health claim.** `estetica` names its treatments and says nothing about what
  they achieve: «Tratamientos faciales» carries «Limpieza y cuidado del cutis», which is what the
  treatment *is*, and nothing about skin it will improve. `fisioterapia` is the sector this rule
  was written for and arrives on day 5.
- **No commercial promise.** «Sin compromiso» and «presupuesto gratuito» were both written for
  `reformas` and both removed: they are a price the owner never quoted.
- **No `book` label that renames the link.** «Pedir presupuesto» reads far better than the generic
  «Pedir cita» on a `reformas` site, and it says where the link leads only if the link leads
  there — which the questionnaire does not ask. So `actions` is empty in these files and the
  generic words stand.

## The shape

    bank/<sector>.json     the reviewed texts: the only files any code reads
    drafts/<sector>.json   written, unread: no code path reaches these
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
