# 0024 — Formatting inside a text is designed, and waits for the third session

**Status:** accepted (the decision to wait) · **Date:** 2026-09-29 · **Decided by:** the CEO ·
**Touches:** [#52](https://github.com/dnarram/retorika-builder/issues/52), ADR 0004 (the closed role
vocabulary), ADR 0009 (the text bank)

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

## Consequences

- **#52 stays open** and points here. It is not closed by this ADR: the question it asks is the one
  the session answers, and closing it would file the answer as given.
- **ADR 0004's role vocabulary is untouched.** Marks are not a role; a `strong` run inside a body
  text is still a body text. Whatever the implementation does, it does not open the closed list.
- **Nothing in the product changes today.** No schema field, no renderer branch, no control. The
  cost of this ADR is the time it took to write, and its value is that the next person to raise
  formatting starts from a design and a reason to wait rather than from the beginning.
