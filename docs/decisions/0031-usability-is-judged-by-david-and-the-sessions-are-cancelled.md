# 0031 — Usability is judged by David, and the sessions are cancelled

**Status:** **accepted** · **Date:** 2026-10-02 ·
**Decided by:** David, 2 October 2026, planning sprint 13 — asked what the record should do and
what the Fase 1 criterion becomes, and answered both ·
**Accepted by:** **David, 2 October 2026 — not direction** ·
**Supersedes:** [ADR 0017](0017-editor-starts-before-the-sessions-conclude.md) in its central
clause · **Amends:** protocol Part 14, the Fase 1 acceptance criterion ·
**Touches:** [ADR 0009](0009-generated-texts-from-a-reviewed-bank.md),
[ADR 0021](0021-charging-waits-for-a-sellable-product.md),
[ADR 0023](0023-the-menu-and-the-footer-are-derived-chrome.md),
[ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) §5,
[#51](https://github.com/dnarram/retorika-builder/issues/51), and
`docs/sessions/guion-tercera-sesion.md`

> **Signed the day it was written, and «accepted» means David, not direction** — the same as ADRs
> 0026 through 0030. It went up `proposed` with the day 1 pull request because the decision was his
> and the file was not; he read it and accepted it with the day 2 branch.
>
> **Direction has not looked at it, and this one reverses direction's own.** ADR 0017 was decided by
> the CEO and the two-session requirement originates in the concept dossier, which is direction's
> document and sits above the protocol in `CLAUDE.md`'s hierarchy. That is said here, in the header,
> because an accepted ADR gets cited afterwards by people who were not in the room.
>
> **This is not «we will stop scheduling sessions».** It reverses an accepted ADR decided by the
> CEO and rewrites the acceptance criterion of a phase. Both are said in the header rather than
> discovered later, and the file that is reversed is not edited into agreement — it keeps its own
> words, the way ADR 0007 keeps its own after ADR 0008.

## Context

### What ADR 0017 committed to, in its own words

ADR 0017 crossed direction's gate — «un prototipo navegable **probado con dos negocios reales**» —
so that `apps/editor` could start before the sessions concluded. The sentence it bought that with
is the one this ADR reverses:

> **The sessions are not cancelled, they are split**

and, under what it preserved:

> Both sessions happen, and their findings still amend the ADRs they touch … The Fase 1 acceptance
> criterion is untouched: someone from outside still has to build a real site in under ten minutes,
> **timed and observed**.

Three sessions ran: 25 and 27 September, and 30 September. ADR 0017's gamble paid — «**Neither
session showed it**», it records, about the questionnaire being misunderstood.

### What the criterion asks, and why it cannot be met from inside

Protocol Part 14, Fase 1:

> **Criterio de aceptación:** una persona **de fuera del equipo**, sin explicación previa y sin
> ayuda, monta la web de un negocio real en menos de diez minutos. **Se cronometra y se observa**,
> no se pregunta.

Every clause of it is about somebody who is not us. A judgement made by the person who built the
product is, by definition, from inside: it cannot be unaided, because he knows where everything is,
and it cannot be observed, because there is nobody to observe. **So this is not a criterion that
self-judgement satisfies; it is one that self-judgement replaces.**

### What three sessions actually produced

| | |
|---|---|
| Timings to the ZIP | **8 minutes** (Conchi, 27 September) and **6 minutes** (a taller, 30 September) — both under ten |
| Unaided use evidenced | **One** of three. Conchi's write-up says «El cliente no hizo preguntas y usó correctamente la app»; the third session's records nothing about it |
| The observation table | **Blank three times out of three.** The script calls it «the point of this session» |
| Would publish it as it stands | **None of the three.** «Tres de tres» |

## The decision

### 1. The usability sessions are cancelled. David judges usability.

No fourth session is scheduled, and none is owed. Everything in the repository that waited on one
is re-pointed here rather than left promising something that will not arrive.

### 2. The Fase 1 criterion becomes David's judgement, entire

Not the stopwatch with the observation removed — **the whole criterion**. Protocol Part 14's Fase 1
acceptance criterion is replaced by one sentence:

> **Criterio de aceptación:** David juzga que la Fase 1 está lista, y lo escribe — en un ADR, con
> su fecha y su razón.

**The judgement is written, and that is the part that keeps this honest.** A criterion that lives
only in somebody's head is not a criterion; it is a mood. This repository's own convention is that
a minimum met gets written down where it can be cited afterwards, so the acceptance of Fase 1 will
be an ADR like any other — and until that ADR exists, Fase 1 is not accepted.

### 3. Fase 2's criterion is **not** touched, and that is deliberate

Part 14's Fase 2 says «un desconocido paga y publica sin ayuda, y la factura sale bien». It is the
same species of criterion and has the same problem. **It was not asked about and is not decided
here.** One ADR, one decision — and a criterion nobody has reached yet is not one to amend in
passing. It is named so the next person does not read this ADR as covering it.

## What is lost, named rather than glossed

ADR 0017 kept a section with this title and paid its bill in it later. This one owes the same.

- **Two real measurements stop counting for anything.** Eight minutes and six minutes, both under
  the ten the old criterion asked for, both from people outside the team. They satisfied the half
  of the criterion that *was* satisfiable, and the criterion that replaces them does not use them.
  They stay in `docs/sessions/` as what they are: a fact about two afternoons in Ronda.
- **The observation table will never be filled.** Three sessions, three blanks. The script's own
  words — «**the point of this session**» — describe a thing that now has no occasion to happen.
  The editor is where most of the clock goes and it has never had a direct observation behind it,
  and now it never will.
- **Three questions can never be answered from inside**, and they are the ones worth listing
  because no amount of judgement substitutes for them:

  | | |
  |---|---|
  | **The price** | Two owners said 50 €. «Two people are still not a price» (`HANDOFF.md`), and a third was what would have made it one. Willingness to pay is not self-sourceable |
  | **«¿Publicarías esto tal y como está?»** | Three of three said no. That finding is the live gate on charging ([ADR 0021](0021-charging-waits-for-a-sellable-product.md): «both owners built a site in the time measured, and neither said they would publish it»). **Nothing can retire it now except a judgement**, and the ADR that makes it will have to say so |
  | **Whether what is behind the switch is findable** | [ADR 0025](0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md) §5 says this is «a thing to **watch** in a fourth session rather than ask». Discoverability cannot be judged by the person who placed the control: he is not naive to it, and naivety is the whole instrument |

- **#51 stays owed and unanswerable.** It asks whether a hostelero reads «Precios» as their carta —
  what a word means to somebody who is not you. It is the one debt on this list that self-judgement
  cannot even approximate, and it is left open rather than quietly closed.

## Why this is acceptable

**The precedent is already in this repository, and it is David's own.** ADR 0024 made the build of
bold and italic wait for a session condition. When the third session came, **«neither waking
condition was met at the letter»** — and the build was authorised anyway, by David, on 1 October
2026, on three things together rather than on the letter of the condition. The backlog records it
in exactly those words. This ADR is that act generalised: the judgement that was already being
made case by case becomes the method.

**And the sessions' marginal value was falling.** The first two were the valuable ones: they
produced the two timings, the contact-form finding that reopened ADR 0016, the «Precios» question,
and the photo finding that became ADR 0018. The third moved two decisions, left two unanswered and
could not ask the fifth. Three blank observation tables in a row is not a run of bad luck; it is
what the format was actually producing.

## What this does not decide

- **Fase 2's criterion**, above.
- **Whether Fase 1 is accepted.** This ADR says who decides and in what form; it does not decide.
- **Anything about the dossiers.** The two-session requirement originates in the concept dossier,
  which is direction's document and above the protocol in `CLAUDE.md`'s hierarchy. This ADR amends
  the protocol, which is where the criterion is written; **it does not edit a dossier**, and if
  direction reads the dossier as still requiring sessions, that conflict is direction's to resolve.

## Consequences

- ADR 0017 keeps its text and gains a status line saying it was reversed here, and by whom.
- Protocol Part 14's Fase 1 criterion is replaced, and its note gains a final paragraph pointing
  here rather than being rewritten into agreement.
- Fourteen places that waited on a session are re-pointed: the backlog's rows, ADRs 0009, 0023 and
  0025, `REVIEW.md` and mockup 19's reopening condition, three task files that defer work «past the
  sessions», the facilitator's script, and the README.
- **`docs/sessions/` is not touched.** Three write-ups and two scripts are the record of what was
  asked and what was answered; a dated artefact that gets rewritten stops being evidence of
  anything.
