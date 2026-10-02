# The facilitator's script — third session

> **There is no session left to conduct, 2 October 2026 —
> [ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md)
> cancels the usability sessions and makes usability David's to judge.**
>
> **This file is not deleted and not rewritten.** It is the record of how the third session was
> asked, and of the five decisions that were waiting on it — the same reason
> `docs/design/prototype/guion-de-prueba.md` is kept after it ran out of sessions, in its own words:
> «what it is now is the record of how these two were asked». A dated artefact that gets rewritten
> stops being evidence of anything.
>
> **The two parts of it worth reading afterwards** are the observation table, which names what three
> sessions never managed to record, and the five closing questions, which are what made three
> sessions comparable at all. Two of those five — the price and «¿publicarías esto tal y como
> está?» — are listed in ADR 0031 as things no judgement from inside can answer.

Written 29 September 2026, sprint 7 day 1. For the next session, against the deployed editor.
Written in English; **every line meant to be spoken is quoted in Spanish, and is said as written.**

`docs/design/prototype/guion-de-prueba.md` is the script the first two sessions used. It lives under
`prototype/` because it was written for one, and it says of itself that it now «has no session left
to run… what it is now is the record of how these two were asked, and the template for however the
next ones are». This is that next one. Its rules are inherited and not repeated in full; what is
here is what is **different** about the third.

**The one lesson that script asks to carry forward, above any wording it contains:**

> «**the paraphrase in the first session cost a real answer**»

Taberna was asked the contact question in the facilitator's own words instead of the script's, and
the answer stopped being admissible as evidence for ADR 0016. Every question below marked **word for
word** is marked for the same reason: something downstream compares two answers, and a paraphrase
makes the comparison describe something that did not happen.

---

## Why this session exists

**Five decisions are waiting on it, each recorded in writing before the session was scheduled.**
That is the difference between this session and the first two: those went looking, this one has a
list.

| What is waiting | Where it says so |
|---|---|
| Whether a hostelero reads «Precios» as their carta | [#51](https://github.com/dnarram/retorika-builder/issues/51): «**The next usability session should show the menu and ask.**» |
| Whether someone looks for a way to make a page and does not find one | [ADR 0022](../decisions/0022-a-page-is-born-by-converting-a-section.md), under "What would reopen this" |
| Whether three entries is where a menu starts being worth having | [ADR 0023](../decisions/0023-the-menu-and-the-footer-are-derived-chrome.md): «a judgement with **no evidence behind it yet**» |
| Whether formatting survives the texts being fixed | [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) and [#52](https://github.com/dnarram/retorika-builder/issues/52) |
| Whether phase 1 is accepted | `docs/tasks/backlog.md`: «**Declaring phase 1 accepted is direction's**» — the session gives it the evidence, not the verdict |

## What has to be true before it runs

- **The owner's sector has a text bank.** Sprint 7 writes the seven that were missing. Running this
  against a sector that still falls through to `generico` tests the wrong thing: it would measure
  the gap the sprint just closed, and #52's question needs the texts to be *good* before «are they
  yours?» means anything.
- **Pick a sector whose bank is signed**, and say in the write-up which one and whether it was
  signed before the session. If none is, the session waits.
- **Nothing is prepared for them.** No account, no half-built site, no explanation. The first two
  sessions started at the questionnaire and so does this one.

## What is different from the first two

- **The editor is where the time goes, and the first two have almost nothing about it.** Conchi's
  write-up says so: «the editor is where six of the eight minutes went and it is the part with no
  direct observations behind it». **The observation table below is the point of this session**, not
  an afterthought at the end.
- **There is a menu and there are pages now.** Neither of the first two owners saw a multi-page
  site; ADR 0023 shipped after both. Anything about navigation is a first observation, not a second.
- **Ask nothing about colour.** Same rule as before: it was not raised unprompted in the first
  session, and asking would manufacture the answer.

---

## What is watched, and written down as it happens

The list Conchi's session left blank, turned into the things to record. **Each one is a blank to
fill, not a question to ask** — none of this is spoken.

- **Which variant they choose, by name.** The rotation measures nothing unless this is on record.
- Whether they open «Ver a tamaño real», and when.
- **Whether they replace a photo, and by which door** — clicking the photograph on the page, or the
  «Fotos» panel in the rail. Both exist; nobody has been watched using either.
- **Every edit they make, in order.** And, separately, **every thing they look for and do not
  find** — where the cursor goes and stops is the finding.
- Whether a delete alarms them, and whether they find «Deshacer» without being told (ADR 0014).
- Whether they find their sector in the ten, and whether they use the search field or read the grid.
- Whether they use the search field in «Añadir sección aquí», and what they type into it. It shipped
  in sprint 6 and no owner has seen it.
- **What they say when the ZIP arrives.** The first script calls this «the most valuable minute of
  the session» and it is blank for both.
- Where the clock actually goes, to the minute. Phase 1's criterion is under ten.

## The four questions this session owes, and where each is asked

### 1. «Precios» and the carta — #51

**Asked only of a hostelero**, and **while the "Añadir sección aquí" menu is open in front of them**,
not at the end. Point at nothing.

> «Si quisieras poner aquí la carta de tu restaurante, ¿cuál de estas cogerías?»

Record which one they choose, whether they hesitate, and **whether they type anything into the
search field**. If they type «carta» and take «Precios» from the results, the sprint-4 decision holds
and the search is what held it. If they scroll past «Precios» without stopping, #51 reopens and the
answer is probably a per-sector name.

### 2. Making a page — ADR 0022

**Not asked. Watched.** ADR 0022's reopening condition is «an owner tries to make a page and cannot
find the way», and a question would hand them the idea.

What is recorded: whether, unprompted, they look for a way to add a page — the rail, the tabs, the
top bar — and what they do when they do not find a «+». If they find «Convertir esta sección en
página» on their own, that is the ADR holding. If they give up, it does not.

**Only if they never touch pages at all**, at the very end and after the closing questions:

> «Si quisieras que esto fueran varias páginas en vez de una, ¿qué harías?»

Asked last so it cannot contaminate anything before it, and the write-up must say it was asked
rather than observed — they are not the same evidence.

### 3. The menu's threshold — ADR 0023

**Only if they end up with three or more pages**, which needs two conversions. Do not steer them
there.

If a menu appears, **word for word**:

> «¿Qué es esto de aquí arriba?»

Then, once they have answered in their own words:

> «¿Te haría falta si tu web tuviera solo dos páginas?»

ADR 0023 says three is «a judgement with no evidence behind it yet». One owner is not evidence
either, but it is the first there has been.

### 4. Formatting — #52 and ADR 0024

**Asked word for word**, because ADR 0024 turns on comparing this answer with Conchi's, and hers was
volunteered rather than asked. Ask it **after** the closing question about the texts, so that answer
is not shaped by having formatting put in their head:

> «¿Hay algo que quieras cambiar de cómo se ven los textos y no encuentres cómo?»

**Do not say «negrita».** If they say it themselves, that is the second owner ADR 0024 is waiting
for. If they name something else — the size, the colour, the length — that is a different finding
and it is written down as the different thing it is. **If they name nothing, that is also the
answer**, and it is the one that keeps the code unwritten.

---

## The closing questions

**The same five, in the same order, word for word.** They are what makes three sessions comparable
at all; changing one now would throw away the two that exist.

1. «¿Publicarías esto tal y como está?»
2. «¿Qué le falta?»
3. «¿Qué le sobra?»
4. «¿Estos textos suenan a los tuyos?»
5. «Si esto costase un pago único, ¿por cuánto te parecería bien?»

**Question 4 is the one this session is really for.** Both previous owners said no, and sprint 7
rewrote the banks for seven sectors on the strength of it. A third «no» after that means the bank is
not the lever; a «sí» means it was, and it is also what decides ADR 0024.

Question 5 has two answers already and they overlap at 50 €. A third is the first one that could
make that a price rather than a coincidence.

---

## After the session

- **Write it up the same day**, in `docs/sessions/`, named by date and business, in the shape the
  first two use — including a «Not recorded» section that is honest rather than reconstructed.
- **Findings go to the decision they touch**, never into a separate document nobody reads again:
  #51, ADR 0022, ADR 0023, ADR 0024 and the backlog each get what belongs to them.
- **Say which sector it was and whether its bank had been signed**, because every answer to question
  4 depends on it.
- **Phase 1's acceptance is direction's to declare**, not the session's. What the session produces is
  the evidence and the timing; the verdict is written somewhere else or not at all.
