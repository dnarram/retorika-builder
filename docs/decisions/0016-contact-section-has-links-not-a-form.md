# 0016 — The contact section has links, not a form

**Status:** **proposed — and its reopening condition fired on 2026-09-27.** It cannot become
accepted: the evidence it named as its own test came back the other way. See "What the two
sessions settled" below. · **Date:** 2026-09-24 · **Proposed by:** development · **Amends, if
accepted:** concept dossier §9

> **Why this is not accepted yet.** The argument below is technical and the decision is a product
> one. It is being checked with the two owners of the usability sessions — **the first of which has
> now happened (25 September 2026) without settling this: see the note under the evidence table** —
> and it is explicitly reopened if either of them answers a certain way. A decision that
> depends on evidence nobody has gathered is proposed, not accepted — and the CEO has not seen
> this. It becomes **accepted** when the two answers are recorded below, naming who accepted it.
>
> The code for the section ships with this ADR at `proposed` on purpose: the links work whether
> or not a form is ever added, so if the sessions reopen this, a form is an addition in phase 2
> rather than a rewrite.

## Context

The concept dossier §9 describes "Contacto y reservas" as "Formulario, teléfono y WhatsApp". The
catalog is about to build that section, and the form half cannot be built as described.

A published site is static (ADR 0001): it opens by double-clicking, with no server and no
network. A form has to send what it collects somewhere, and there are only three somewheres:

- **an API of ours** — which ADR 0001 forbids outright, and which would make every client's site
  stop working the day we do;
- **a third-party form service** — a dependency the client inherits without choosing it, a
  processor of their customers' personal data that protocol Part 15 would make us account for,
  and a free tier that can start charging or disappear;
- **`mailto:` as the form's action** — which opens whatever mail program the visitor has, with
  the fields pasted into a draft they have to send themselves. It fails silently on phones and on
  webmail, and it is a worse version of a link.

## Decision (proposed)

- **"Contacto y reservas" ships links, not a form:** `tel:`, `https://wa.me/…` and `mailto:`.
  They work from a file on a disk, cost nothing, depend on nobody, and open the app the visitor
  already uses to talk to businesses.
- **The `field` role stays unused by the catalog.** It remains in the vocabulary for phase 3's
  free sections, but no preset places one, so the orphan `<input>` the renderer would emit for it
  never reaches a published site.
- **This amends dossier §9** where it says "Formulario": the section has a main action and up to
  three ways to reach the business.

## The evidence, and what would reopen this

`guion-de-prueba.md` asks both owners, without naming a form or suggesting an answer:

> «Cuando alguien quiere pediros cita o preguntar algo, ¿cómo te gusta que lo haga? ¿Te vale con
> que te llamen o te escriban por WhatsApp, o esperas que te escriban desde la web y que te
> llegue a ti?»

**If either of the two says they expect messages to arrive from the web, this is reopened** — one
person in a sample of two is half of it, not an outlier. A form then becomes a phase 2 decision
with a service behind it, its cost, its data processing agreement and its own ADR.

> **Note (ADR 0017, 24 September 2026).** The two sessions are no longer comparable: one runs
> against the static prototype, the other against the real `apps/editor`. That does not weaken
> this condition, because the condition never depended on the two sessions being alike — it
> depends only on the question above being asked **word for word, unchanged,** in both. The
> facilitator's script carries the same note; see `guion-de-prueba.md`.

**Their answers, recorded when the sessions have happened:**

| Business | What they said | Date |
|---|---|---|
| Taberna Santo Domingo | **Not admissible — the question was paraphrased.** See the note below. | 2026-09-25 |
| Conchi | «Me gusta que me reserven enviando mensajes a whatssap, enviando un email, **rellenando un formulario muy simple desde la web con la información justa** o llamando por teléfono.» | 2026-09-27 |

> **Note, 26 September 2026 — session 1 happened, and it does not close this.**
>
> Taberna Santo Domingo was run on 25 September against the deployed editor
> (`docs/sessions/2026-09-25-taberna-santo-domingo.md`). **The question above was not asked word
> for word**, and the wording actually used was not recorded.
>
> That is why the row says "not admissible" rather than carrying his answer as data. The reopening
> condition compares two answers to *one* question asked unchanged; counting a paraphrase against
> a verbatim one would make this ADR describe a comparison that never took place. Half a
> comparison is not half an answer — it is a different question.
>
> **What he said anyway, because it is signal and burying it would be its own dishonesty:**
>
> > «Quiero que el cliente me contacte por teléfono, whatssap, correo, formulario o alguna red
> > social en el futuro»
>
> He named **«formulario» and «correo» spontaneously**, with nobody offering them. That points
> towards the reopening condition rather than away from it. Two things keep it from settling
> anything on its own: the question that produced it is not this one, and «en el futuro» is not
> the same as expecting messages from the web today.
>
> **Consequence for the second session:** it must ask the question above **word for word**, and it
> is then the only admissible answer on record. A condition written for two answers, met by one,
> is a condition that has to be re-read before it is applied — not applied as if the second answer
> existed.

## What the two sessions settled (27 September 2026)

**The condition fired. This is reopened, by its own terms.**

The condition, as written above: «If either of the two says they expect messages to arrive from
the web, this is reopened — one person in a sample of two is half of it, not an outlier.»

Conchi was asked the question **word for word** on 27 September, against the deployed editor
(`docs/sessions/2026-09-27-conchi.md`). The question offers two halves — is it enough that they
call or write on WhatsApp, or do you expect them to write *from the web* and have it reach you —
and she did not take the first half alone. She named a form on the website, in her own words,
among the four ways she would like to be reserved with.

So the answer is on record, admissibly, and it is the one the condition was written to catch.

**Three things about it that belong to whatever decides this next**, because they are the
difference between "a form" and the form she actually described:

- **She qualified it twice** — «muy simple», «con la información justa». Not a contact form with
  eight fields. That qualifier is evidence about its size, and it is the kind of detail that gets
  lost between a session and a specification.
- **It was third of four.** The other three — WhatsApp, email, phone — are exactly what this ADR
  already ships. What was built serves most of what she said; the form is an addition to it.
- **Taberna named a form too**, spontaneously, in an answer this ADR correctly refuses to count.
  One admissible answer and one inadmissible one, both pointing the same way, is still **one**
  admissible answer. It is recorded because that is the honest shape of the evidence, not because
  it adds up to two.

### What this changes, and what it does not

**Nothing that shipped has to be undone**, and that is not luck. This ADR said so in advance:

> «The code for the section ships with this ADR at `proposed` on purpose: the links work whether
> or not a form is ever added, so if the sessions reopen this, a form is an addition in phase 2
> rather than a rewrite.»

That held exactly. So:

- **The `contact` section stays as it is.** `tel:`, `https://wa.me/…` and `mailto:` still work
  from a file on a disk, still depend on nobody, and are still three of the four channels Conchi
  named. No code changes today.
- **The `field` role stays unused by the catalog.** It remains in ADR 0004's vocabulary, placed by
  no preset, so the orphan `<input>` the renderer would emit for it still never reaches a
  published site.
- **A form becomes a phase 2 decision with its own ADR**, which is what this ADR said would
  follow. That ADR has to answer what this one could not: which service is behind it, what it
  costs, what happens to the client's site the day that service stops, and the data processing
  agreement protocol Part 15 requires — because the submissions are the personal data of *our
  clients' clients*, which Part 15 calls «el segundo nivel… el delicado».
- **This ADR does not become accepted.** It was explicit that acceptance required two answers and
  a named accepter; what it got was one admissible answer that fired the reopening clause instead.
  Recording that is transcription of the document's own rule. Deciding what replaces it is not
  development's to write.

### What it cost to get here

Worth one line, because the lesson is cheap now and expensive later: **the first session's answer
was thrown away for a paraphrase.** The question was asked in different words, so a real answer
from a real owner — one that pointed the same way this one does — cannot be counted. A reopening
condition that rests on comparing answers is only worth what the asking discipline is worth.

## An open case this decision leaves

**Question 4 is independent of question 5.** Someone can say where they are and skip what a
visitor should do. Then there is no main action, so no contact section is generated (ADR 0010),
and the site ends up with an address and opening hours and **no way to get in touch at all** —
worse, for a taverna, than having no site.

`primaryAction` staying 1..1 is right: a contact section with nothing to contact is furniture.
**The fix belongs to the generator**, not to the catalog, and it is probably one of two things:
the location section adopting its map link as its action, or the generator refusing that
combination and asking question 5 again. It is decided when the generator is built.

## Consequences

- The `contact` preset declares `primaryAction` 1..1 and `secondaryAction` 0..3.
- Protocol Part 15's line about form submissions going to the owner's email describes something
  that does not exist yet, and starts applying the day a form does.
- Nothing in the renderer changes: `safeUrl` is a deny-list for executable schemes, so `tel:`,
  `mailto:` and WhatsApp links already publish untouched.
