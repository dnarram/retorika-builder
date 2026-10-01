# 0024 — Formatting inside a text is designed, and waits for the third session

**Status:** accepted (the decision to wait) · **Date:** 2026-09-29 · **Decided by:** the CEO ·
**Touches:** [#52](https://github.com/dnarram/retorika-builder/issues/52), ADR 0004 (the closed role
vocabulary), ADR 0009 (the text bank)

> **Superseded by its own condition being tested, 2026-10-01: the waiting is over and this is
> built in sprint 10.** The design below is unchanged — it is what gets built. What changed is the
> status of the wait, and **neither waking condition was met at the letter**; see "What the third
> session actually returned" at the foot of this file for the exact shape of the evidence and for
> who decided on the strength of it. The one open question the decision named — what happens to a
> mark when the text beneath it changes — is answered in ADR 0027 and not here.

## Context

Asked whether she would publish the site she had just built, the owner in the second usability
session answered with three things she could not do, and the first of them was formatting:

> «Necesita trabajo visual, **no puedo poner negritas** o cambiar estilos ni mover imágenes por lo
> que **no lo publicaría**» — `docs/sessions/2026-09-27-conchi.md`

She named it twice: «o de editar los textos con opciones gráficas avanzadas de **negrita,
subrayado**, etc.»

Of those three, changing styles shipped in sprint 4 and moving images collides with document rule 4,
which stands. Formatting is the one that is neither done nor refused, and issue #52 has held it as an
open question since the day of that session.

**The other owner did not ask for it.** And the same session recorded something that may be the
same complaint wearing different clothes:

> «Creo que no, me gustarían textos **más enfocados a la hostelería**. En hostelería es muy
> importante convencer y hacer soñar con comidas y servicio.»

Issue #52 named that tension itself, and named what would settle it:

> «So it is worth asking whether formatting is what she wants or what she reached for… **If ADR
> 0009's hostelería bank gets fixed — which two of two owners asked for — this request may not
> survive the next session.**» … What would decide it: «**A second owner asking for it**, which has
> not happened: Taberna did not. **Or the text bank being fixed first**, and the request persisting
> anyway.»

The hostelería bank was fixed on 28 September. Nobody has asked again, because there has been no
third session.

## Decision

**The design is settled here and the code waits for the third session.** Both halves are the
decision; neither is a deferral of the other.

- **It waits.** One owner asked, one did not, and the one who asked also said the texts did not
  sound like hers. Building a word processor to answer a complaint that may be about vocabulary is
  the expensive way to find out which it was. The third session asks, with the texts already fixed.
- **The design below is decided now, not later.** An open question with no shape attracts a new
  design every time it comes up. This one has a shape; what it lacks is evidence that it is needed.

### Underline is refused, whichever way the session goes

She said «negrita, subrayado». **Underline is not offered, and would not be offered if she asked
again.** On the web an underline means a link. A word that is underlined and goes nowhere is the
same promise-with-nothing-behind-it this product refuses everywhere else: a dead destination blocks
a download, a palette without tested contrast cannot be declared, a button that moves no pixel is
not drawn. Underlined text that is not a link belongs on that list.

**What would be offered is bold and italic** — `strong` and `em`, the two that mean emphasis rather
than decoration, and that a screen reader can convey.

### The granularity is a run of characters, not the whole element

The cheaper design — a flag on the element, so a paragraph is bold or is not — is rejected, and it
is worth saying why, because it is the one someone would reach for to make this fit in a day:

- A heading is already bold. A whole body paragraph in bold is not emphasis, it is shouting, and
  the only palettes and type pairs this product ships are ones where that reads badly.
- What an owner means by «poner negritas» is a dish name, a price, a phone number — a few words
  inside a sentence. An element-wide flag cannot express any of those, so it would ship a control
  that answers a different request and leaves this one open.

**The cost of the real answer is named here rather than discovered later:**

- **The schema gains a marked-run field on a text value**, with its own migration and round-trip
  test, in the exclusive zone. The offsets are validated where every other document rule is —
  inside the schema — so a run cannot point outside its text, overlap another, or arrive unsorted.
- **The renderer escapes run by run.** Today the guarantee against `fixtures/documents/xss-attempt`
  is one `escapeHtml` over the whole string. With runs, the string is split, **each piece escaped
  separately**, and only the marked pieces wrapped. That is the delicate part and the reason this
  is Claude-only work: the fixture must stay green without being touched.
- **A document with no marks produces the same bytes it produces today**, which is what keeps the
  golden corpus still and makes the change additive.

### The editor does not become a rich-text editor

This is the part that would be easiest to get wrong, and issue #52 said so: click-to-edit rests on
`contentEditable` over a plain string, and «that is the affordance the whole editor rests on».

**The field stays a plain string.** Applying a mark reads the character offsets of the selection,
dispatches an action, and the canvas redraws from the document — the same path every other edit
already takes, with the same undo. No `execCommand`, no editable HTML, no second serialisation
format. What a mark is, is data in the document; what the owner sees, is the renderer's output.

**Editing the text under a mark is the open question the implementation has to answer**, and it is
named here so it is not discovered on the day: a run whose text changes beneath it either moves,
shrinks or dies, and which of those it does is a product decision, not an implementation detail.

## What wakes this up

Either of these, and neither is a date:

- **A second owner asks for it**, in a session, without being prompted.
- **It survives the texts being fixed.** Sprint 7 writes the seven missing sector banks. If the
  third session shows a site whose texts do sound like the owner's and formatting is still the
  first thing they name, the request was never about vocabulary and this becomes work.

The third session's script carries the question. If neither happens, this ADR is the record that
the design exists and that nobody needed it.

> **It happened, and not in the shape this paragraph expected.** Both conditions were tested on 30
> September and **neither came back met at the letter**. What was decided, and on what, is at the
> foot of this file.

## Consequences

- **#52 stays open** and points here. It is not closed by this ADR: the question it asks is the one
  the session answers, and closing it would file the answer as given.

  > **Still open as of 1 October 2026, and now for a different reason.** The session answered its
  > question — bold and italic yes, underline no, and it was not vocabulary — and that answer is
  > written into the issue. What is not built yet is the thing the answer licenses, so closing it
  > today would file *the work* as done rather than the question as asked. **It closes with the
  > pull request that puts `B` and `I` in the toolbar**, which is what `CLAUDE.md` requires of an
  > issue-resolving PR and what #19 and #25 were both merged without.
- **ADR 0004's role vocabulary is untouched.** Marks are not a role; a `strong` run inside a body
  text is still a body text. Whatever the implementation does, it does not open the closed list.
- **Nothing in the product changes today.** No schema field, no renderer branch, no control. The
  cost of this ADR is the time it took to write, and its value is that the next person to raise
  formatting starts from a design and a reason to wait rather than from the beginning.

---

## What the third session actually returned (30 September 2026)

> Source: `docs/sessions/2026-09-30-taller.md`. Sector `taller`, bank signed before the session,
> run against an editor with sprint 9 complete.

Asked the question this ADR's own script required — «¿Hay algo que quieras cambiar de cómo se ven
los textos y no encuentres cómo?» — the owner named **seven** things:

> cursiva, negrita, subrayado, tamaño exacto, fuente de letra, color exacto, y más libertad en la
> posición.

**His own wording is not on record.** The list is the substance as reported, not a quotation, and
that is a real limit on what follows: this ADR was written to compare this answer against Conchi's,
and hers *is* a quotation. The comparison is between a quote and a summary.

### Condition 1 — not met at the letter

> «A second owner asks for it, in a session, **without being prompted**.»

**A second owner asked. He was not unprompted.**

- **Conchi's was spontaneous.** Nobody asked her about formatting; she named it answering
  «¿Publicarías esto tal y como está?» and again answering «¿Qué le falta?».
- **His was an answer.** It came out of a question that points straight at the appearance of text —
  and the question was in the script *because this ADR put it there*.

Writing this condition down as satisfied would be the facilitator's script's own lesson — «the
paraphrase in the first session cost a real answer» — committed in the other direction: turning an
answer into a spontaneous request. It is not recorded as met.

### Condition 2 — met in substance, not verifiable at the letter

> «It survives the texts being fixed … a site whose texts **do sound like the owner's** and
> formatting is still **the first thing they name**.»

- **«Texts do sound like the owner's» — met, and it is the first «sí» the product has had.** The
  `taller` bank was signed before the session (ADR 0009, session 3).
- **«Still the first thing they name» — not verifiable.** The order in which he named the seven is
  not recorded, and «¿Qué le falta?» came back blank. What is recorded is that formatting is still
  named *at all*, after the texts stopped being the complaint.

**The substance of this condition is what the third session was for, and it returned the answer
this ADR hoped to get:** the doubt #52 raised — «whether formatting is what she wants or what she
reached for» — is answered. **It was not vocabulary.** An owner who says the texts sound like his
still wants to put two words in bold.

### What was decided, and by whom

**The decision to build is the CEO's, taken on 1 October 2026 in approving the sprint 10 plan**,
not a condition firing on its own. The conditions above were written so that meeting one would make
this automatic; neither was met at the letter, so it was not automatic, and this file does not
pretend a trigger did the work.

**The case it was approved on is three things together, and no one of them alone:**

1. **Two owners have asked** — one spontaneously, one answering a question this ADR's own script
   required. Two requests, in two different shapes.
2. **The texts are already fixed and the request survived them.** This is the substance of
   condition 2, and it is what removes the cheap explanation the decision to wait was built on.
3. **The professional audience.** [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md)
   made the professional editor a goal of the product after this ADR was written. A bold run inside
   a sentence does not depend on an owner asking for it; whoever builds sites for other people
   needs it, and that audience did not exist in the product's goals on 29 September.

### Underline, refused for the third time

He named `subrayado`, as Conchi did. **The refusal above stands, and it was written in advance of
being tested**: «Underline is not offered, and would not be offered if she asked again.» Two owners
out of three have now asked; the answer has not moved. A refusal that holds against a repeated
request is recorded as holding rather than left to be assumed.

### What of the seven this ADR does not answer

Only two of the seven are this ADR's: **negrita** and **cursiva**. The rest are recorded here so
the next reader does not come looking for them in the wrong file:

| What he named | Where it is answered |
|---|---|
| `subrayado` | here, refused, above |
| `tamaño exacto` | [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md) §2 — waits on the overflow half of dossier §4 |
| `fuente de letra` | [#9](https://github.com/dnarram/retorika-builder/issues/9), and ADR 0028 takes it to direction |
| `color exacto` | **exists** since sprint 9 day 6, behind the design-tools switch |
| `más libertad en la posición` | document rule 4; the grid **exists** since sprint 8, behind the same switch |

The last two are why the session's sharpest finding is not about formatting at all: he had the
switch on and still asked for both. That is ADR 0025's business, not this file's.
