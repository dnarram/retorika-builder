# Backlog — what is owed, and where each thing actually lives

**This is not a task specification.** Every other file in this directory is one: an objective,
the steps, and a definition of done, written *before* the work. This one is the list of what is
waiting, and it exists because the repository had nowhere to keep it — the list used to live in a
planning file outside the repository, on one machine, which meant it survived for exactly as long
as that machine did.

**It is a router, not a record.** Each item says where the real thing is written, and nothing
here is the authoritative copy of anything. That is deliberate: two places holding the same fact
drift, and the facilitator's script already says findings go to the decision they touch «not into
a separate document nobody reads again». So an item with an ADR points at the ADR; an item with
an issue points at the issue; and only the things with no other home are described here at all.

Last reviewed: 1 October 2026, **sprint 10 day 2 — the three decisions the session forced**. Two
new ADRs and one proposed amendment, all `proposed` and all waiting on a word: **ADR 0027** answers
what happens to a mark when the text changes and amends one clause of ADR 0024; **ADR 0028** puts
typography's four costed options in front of direction and does not choose; and **ADR 0025 gains a
proposed amendment** about its own switch. No code. Three rows below point at them instead of
carrying a second copy.

The review before it was 1 October 2026, **sprint 10 day 1 — the third usability session ran**, on 30
September, and it is the single event that has moved the most rows at once. Five decisions were
waiting on it; **two moved, two came back unanswered, and one could not be asked.** The rows that
changed: ADR 0024's wait is over, ADR 0022 has evidence for the first time, phase 1 has a second
timing, #9 has a real owner asking for it, and #51 is still owed because the session was not
hostelería. Two entries are new and had no home: **the design-tools switch sorted wrong** — it was
found and pressed by somebody who does not build sites for others — and **the observation table came
back blank for the third time**, which is a finding about the sessions rather than the product.

The review before it was 1 October 2026, closing sprint 9. The style system shipped, so two rows
changed meaning rather than wording: «el modo estudio» is now three pillars of four, and the
exact-colour row stopped waiting on a gate and started saying **who accepted it** — David, not
direction, which is a fact about the record rather than about the code. One entry was new and had no
home: **the other half of the §4 pre-publish check**, the overflow below 320 pixels, which sprint 9
did not build and which is the reason an exact `fontSize` is still refused.

The review before it was 30 September 2026, sprint 9 day 1. Sprints 7 and 8 closed between it and
the one before. The row about the seven unbanked sectors closed with the seven signings, and is
struck rather than deleted. Two entries were new then: **issue #9 became a gate** rather than a
nuisance — it is what keeps typography out of the style work — and **there is no keyboard undo**,
which nobody had written down anywhere and which seven places in the repository contradict. Both are
still open.

The one before that was 29 September 2026, sprint 7 day 1. Sprint 6 closed between it and the one
before. Three rows had gone stale — the photo bank's future tense, mockup 13's palettes and the
editor's top bar — and were corrected in place rather than deleted, so the record of what was once
open survives.

---

## Decided elsewhere, waiting on someone

| What | Where it is written | Waiting on |
|---|---|---|
| **The professional editor is a target of the product, and the advanced module starts now.** Decided by direction, 30 September 2026: the same editor must also serve someone who builds sites for other people. That schedules «el modo estudio» ahead of its place in the protocol's phases — a deliberate crossing, with ADR 0018 as the precedent — and it changes what «done» means for the editor. | [ADR 0025](../decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md), and the advanced-module dossier | Nothing. Three of the four pillars are built: sprint 8 delivered **la colocación** and **los dispositivos** with the switch, sprint 9 **el sistema de estilo**. The fourth — **el contenido reutilizable**, the §7 collections — is unscheduled, and nobody has asked for it |
| **Exact colour values, behind the switch, with a contrast review in front of them — built, and accepted by David rather than by direction.** Sprint 9 delivered it: the vocabulary closed (schema 1.2.0), the renderer emits rule 6 for the first time since phase 0, the floating toolbar offers references to everybody, and an exact colour exists only with the design tools on and only behind a review that blocks under 3:1 and warns between 3:1 and 4.5:1. What is *not* closed is who agreed to it. The ADR **amends a `REVIEW.md` entry** and reconciles two approved documents — concept dossier §§3 and 5 against the design review — and approved documents are direction's. The day-1 gate said the CEO would read it first; **David read it and accepted it himself on 1 October 2026**, and the ADR's own header says so in as many words. | [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md), and [mockup 17](../design/mockups/17-la-barra-y-el-sistema.html) | Direction, if it wants to look — which is direction's to decide, not development's to chase. Nothing in the code waits on it; this row exists so that "accepted" is never read as "direction agreed" |
| **A contact form.** Scoped, 28 September 2026: [ADR 0020](../decisions/0020-contact-stays-links-only-for-phase-1.md) accepted ADR 0016's phase 1 links-only scope and split the form off as its own, unscheduled phase 2 item. | [ADR 0020](../decisions/0020-contact-stays-links-only-for-phase-1.md), resolving [ADR 0016](../decisions/0016-contact-section-has-links-not-a-form.md) | A phase 2 ADR naming the service, its cost, what happens to a client's site the day that service stops, and the data processing agreement protocol Part 15 requires |
| **How a carta of several courses reads.** Three «Precios» sections one after another are three separate blocks: each has 48px of its own padding and the page puts 76px between them, so **172px of air separates the last dish of one course from the heading of the next**, and nothing frames them as one menu. Measured by building one on 28 September 2026. The cheap lever is a renderer rule making two adjacent sections of the same preset close up; whether that should happen at all is a general design decision, since it would apply to two «Opiniones» just as much. | [`docs/design/REVIEW.md`](../design/REVIEW.md) | Direction, on whether adjacent sections of one kind should read as one |
| **The hostelería text bank — resolved, 28 September 2026.** Both `packages/copybank/drafts/*.json` files were read and signed; the hostelería rewrite and the per-sector «Precios» headings are in `bank/` now. What the draft could not write — a sixth question, direction's to add — is still open. | [ADR 0009](../decisions/0009-generated-texts-from-a-reviewed-bank.md), and [ADR 0010](../decisions/0010-initial-questionnaire.md) | Nothing, for the bank itself. The sixth-question option in ADR 0010 is direction's whenever it wants it |
| **`packages/photobank` — the machinery shipped on sprint 6 and the bank is still empty.** Eleven sector files, zero images. Until the first one is approved, every generated site opens on the grey marker, and three sentences in the editor had to stop saying otherwise (sprint 7 day 1; the list of which, and that they come back with the first image, is in `packages/photobank/README.md`). | [ADR 0011](../decisions/0011-sample-photos-per-sector.md), and "What an image has to satisfy" below | Licensed images, which is content production rather than code |
| **The text bank covers all ten launch sectors — resolved, 30 September 2026.** Sprint 7 days 4-5 wrote `estetica`, `fisioterapia`, `taller`, `reformas`, `academia`, `fotografia` and `asesoria` as drafts; sprint 8 signed the seven, one PR per sector, each merged by direction after reading the Spanish words in the PR body — the `git mv` ADR 0009 calls the review. `drafts/` is empty. `servesSector` now answers `true` for all ten launch sectors — checked directly, not assumed — and only «Otro sector» still falls through to `generico`. | [ADR 0009](../decisions/0009-generated-texts-from-a-reviewed-bank.md) | Nothing. Every launch sector has its own titulares, cuerpos and question-3 suggestions |
| **Hosted publishing.** | [ADR 0008](../decisions/0008-hosted-publishing-has-no-plan.md), and `serve.md` in this directory, which is dormant by that decision | Nothing. It is on hold with no plan, and that is the decision |

## Open questions, filed

| What | Where |
|---|---|
| **Formatting inside a text — the wait is over, and it is built in sprint 10.** [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) settled the shape on 29 September 2026 (bold and italic over a run of characters; **underline refused**, because on the web it means a link) and made the code wait for the third session. **That session ran on 30 September and asked the question**, and the second owner named negrita and cursiva. **Neither waking condition was met at the letter** — Conchi's request was spontaneous and his was an answer to a question the ADR's own script required, and «the first thing they name» is not verifiable because the order and «¿Qué le falta?» are both blank. So the build was **authorised by David on 1 October 2026 in approving the sprint 10 plan**, on three things together: two requests in two different shapes, the texts already fixed and the request surviving them, and the professional audience ADR 0025 added after this ADR was written. **Underline was asked for a second time and is still refused.** | [#52](https://github.com/dnarram/retorika-builder/issues/52), [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md), and [the session](../sessions/2026-09-30-taller.md) |
| **What happens to a mark when the text beneath it changes — answered and accepted, 1 October 2026.** [ADR 0027](../decisions/0027-a-mark-moves-with-the-text-under-it.md) takes the word processors' convention (inside grows, at the end continues, at the start does not, deleting part shrinks, deleting all removes) and proves the five rows are **one** offset rule, which is what day 3 implements. It also **amends ADR 0024 in one clause**: «overlap another» becomes «overlap another of the same kind», because read literally it made bold *and* italic on the same words impossible — the first thing the third owner named. Different marks overlap, identical ones merge, and «no two runs of the same `mark` touch or cross» is the invariant the schema validates — **touching meaning touching**: two runs of the same mark separated by any unmarked text, one space included, stay two runs and publish different bytes from one. **Accepted by David on 1 October 2026, not by direction**, with one correction he found on review: the ADR's own merging example was `[0,9)` + `[10,19)`, which is the case that does *not* merge. The rule was right and the example showed its opposite; it is now a required test. **Built in the schema on 1 October 2026** (`packages/schema/src/marks.ts`, migration `0004`, SCHEMA_VERSION 1.3.0), with one rule the ADR had not foreseen: **a boundary may not cut a surrogate pair in half**, because the renderer escapes each piece separately and the file is written as UTF-8, so `Café 🍷 tinto` would publish as `Café �� tinto`. Measured, then refused in the schema. | [ADR 0027](../decisions/0027-a-mark-moves-with-the-text-under-it.md), amending [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) |
| **The design-tools switch was found, and it sorted wrong.** The first owner ever to meet it found a 34×19px switch with a 9px label at the foot of the rail, pressed it unprompted, read «¿Montas webs para otros?» and answered «Sí, enciéndelas» — while running a car workshop. **The discoverability half of ADR 0025 §5 holds on evidence it did not have; the sorting half does not.** And two of the seven things he then said he could not find — `color exacto` and `más libertad en la posición` — were already behind that switch, the first in the very toolbar he is recorded using. **Finding the switch is not the same as finding what is behind it**, and it is not fixed by building anything. **Answered 1 October 2026 as a `proposed` amendment in ADR 0025, waiting on direction**, with three parts: the gate *did* its job because §1 protects against controls arriving unasked and he asked by pressing; **the question's wording does no work** — it asks who somebody is and grants capability for the answer, so anyone who wants the capability says yes — and should describe the tools instead; and the real finding is that **one intention takes three places.** Verified: `DesignPanel.tsx:315` renders «Diséñala a mano **desde su cabecera**» as a plain `<p>` — a dead end naming its own exit and not offering it. The proposal is to make that offer reachable from there; §7's per-section escalation is **not** amended. And it records what the evidence does **not** license: moving ADR 0026's exact-value line, because the tools were already on and the switch is not what stopped him. | [ADR 0025](../decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md), "Amendment proposed 1 October 2026" |
| **The other half of the pre-publish check: overflow below 320 pixels.** The advanced dossier §4 promises one review covering two things — «contraste insuficiente **o de desbordes por debajo de 320 píxeles**» — and sprint 9 built the first half only. `a11y.md` has cited that same sentence since sprint 2 as the reason the browser harness exists, and the harness *does* measure overflow — over the corpus, in CI, at 320/768/1280. What does not exist is the same question asked of **this owner's document, before this download**, which is what the dossier promises and what a gate would need. It is also the reason an exact `fontSize` is refused: a size is the one value in rule 6's vocabulary that can cause an overflow, and offering it behind a gate that cannot see what it would cause is the shape of promise ADR 0026 exists to refuse. Costed at more than a day: it needs a rendered page measured at 320px somewhere the editor can reach, which is a second measurement path beside the contrast arithmetic. Unscheduled, and nobody is waiting on it. | [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md) §2's table, and [`a11y.md`](a11y.md) |
| **Type pairs falling back** on machines without Inter / Playfair Display. Still open — the fallback itself is unchanged — but the interface half is now handled: the Estilo panel names typefaces by character («Moderna y neutra») and never by font, and its `Aa` specimen renders in the real stack, so what it shows is what that machine will give. **Sprint 9 makes this a gate rather than a nuisance:** it is what keeps «tipografías propias» and the toolbar's per-element `Aa` out of the style work, which is half of the advanced dossier §4's "On" column for the style panel. It needs a decision, and [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md) says so by name rather than leaving the omission to be noticed later. **An owner has now asked for it**: «fuente de letra» is one of the seven things the third session's owner named wanting and not finding, which turns this from a gate development chose to respect into a request from outside. **[ADR 0028](../decisions/0028-typography-needs-a-decision-from-direction.md) now carries the four options with their costs and deliberately does not choose** — ADR 0026 said «it is direction's and deserves its own ADR», and this is it. What that ADR adds to #9: **option C is already half-built and undecided** — the editor stopped promising a font in sprint 4, and the three pairs were never re-chosen to survive not getting one. Re-measured 1 October: **two of the three lose their heading/body contrast entirely** on a machine without Inter or Playfair Display, so «leave it» is a choice with a cost rather than the absence of one. **Waiting on one word from direction**, and «tipografías propias» comes after whichever option — never before. | [ADR 0028](../decisions/0028-typography-needs-a-decision-from-direction.md), [#9](https://github.com/dnarram/retorika-builder/issues/9), and [the session](../sessions/2026-09-30-taller.md) |

## Recorded against the thing it challenges

| What | Where |
|---|---|
| **Moving images freely — and now it is the second time.** Conchi asked for it; it collides with document rule 4, and rule 5 already named the hole it would open. This row existed so «the next person hears it as the second time», and **the next person asked on 30 September 2026**: «más libertad en la posición», one of his seven. It arrives in a different shape, which is the useful half — **the grid exists** (sprint 8, ADR 0025 §7) and he had the design tools on, so what he was refused was not placement but placement off the grid. **Rule 4 stands.** What two owners out of three now say is that the grid as built did not read as the answer, and whether he ever opened the `Diseño` panel is not recorded. | [`docs/document-rules.md`](../document-rules.md), the note under rule 4, and [the session](../sessions/2026-09-30-taller.md) |
| **The design review's own open list** — the third cover composition, `location`'s `split` gap, and the rest. *(Mockup 13's palettes were named here until sprint 7 day 1 and had been resolved since 28 September: the Estilo panel ships their names from `packages/tokens/src/locales/es.json`.)* | [`docs/design/REVIEW.md`](../design/REVIEW.md), "Still open" |
| **The price — still two answers, and still a coincidence.** Two sessions answered it and they overlap at 50 €. **The third session was the one that could have made that a price rather than a coincidence, and the answer was not recorded.** The question was the fifth of the five and it is blank. | [`docs/design/HANDOFF.md`](../design/HANDOFF.md), the open-questions table, and [the session](../sessions/2026-09-30-taller.md) |

## No home but this one

- **Accounts and persistence with Supabase, and charging — deferred, not scheduled.**
  [ADR 0021](../decisions/0021-charging-waits-for-a-sellable-product.md), 28 September 2026: it
  waits until the product is judged professionally sellable, the same status ADR 0008 gives hosted
  publishing. The mechanism is decided — Stripe, single payment, Checkout, idempotent webhook,
  three stored states (protocol Part 15) — and the six open questions in
  [`docs/design/billing-questions.md`](../design/billing-questions.md) are not going to direction
  with a deadline; they wait for the same moment. One of the six is ours to raise when that moment
  comes: **once the ZIP is handed over there is nothing to switch off** (ADR 0001), so what a
  refund can even mean has to be decided before the terms of use are written, not after.
- ~~One catalog section still missing of the dossier's nine: «Quién soy / El equipo».~~ **Done**,
  29 September 2026: sprint 7 day 6 built `packages/catalog/src/team.ts`. The catalogue is 9 of 9.
  This was the one section with no evidence behind it — no session asked for it, it closed the
  catalogue rather than answering anybody's own words — and that stays true of it going forward:
  nothing here claims a usability finding it does not have.
- ~~The third session is unblocked, unscheduled, and five decisions are waiting on it.~~ **It ran
  on 30 September 2026**, sector `taller`, against an editor with sprint 9 complete:
  [`docs/sessions/2026-09-30-taller.md`](../sessions/2026-09-30-taller.md). Of the five decisions
  its own script named, **two moved, two came back unanswered, and one could not be asked:**
  - **ADR 0024 — moved.** Formatting survived the texts being fixed. The wait is over; see the row
    above for what it was authorised on, which is not a condition met at the letter.
  - **ADR 0022 — moved, and it holds.** He found «Convertir esta sección en página» unprompted, which
    is the first evidence that decision has ever had. The `+` is still not needed.
  - **ADR 0023 — unanswered.** The threshold question is asked only of somebody who ends with three
    pages, and **the page count is not recorded**. Still «a judgement with no evidence behind it».
  - **#51 — could not be asked.** The question is for a hostelero and this owner runs a taller. The
    issue stays closed with no evidence from the session that was supposed to test it, and the next
    hostelería session still owes it.
  - **Phase 1 — a second timing, and not the missing clause.** Six minutes to the ZIP, one and a
    half to the end of the questionnaire. See "What phase 1 is still waiting on" below.
  **And one thing the script could not have asked for**: it was the first session against the design
  tools, and the switch finding is its own row above.
- **The observation table came back blank for the third time, and so did the owner's own words.**
  The script calls that table «the point of this session», because the editor is where most of the
  clock goes and it has never had a direct observation behind it. Three sessions, three blank
  tables. **This one also has no verbatim quote for any of the five closing questions** — the first
  two quote all five — which is what limits the ADR 0024 comparison to a quote against a summary,
  and what left ADR 0009 with a reported «sí» instead of the owner's vocabulary. Nothing in the
  product causes this and nothing in the product fixes it: it is how the sessions are recorded.
  **A fourth session should fix the recording before it adds anything else**, and the cheapest
  version of that is the script's own list filled in as it happens plus the five answers written
  down word for word. Whose call: direction's, as scheduling and facilitation always were.
- **There is no keyboard undo, and seven places in this repository say there is.** Found by walking
  the editor on **sprint 9 day 1**, and not caused by that day's work — it has been true for as long
  as the editor has existed. `Meta+Z`, `Control+Z` and `Meta+Shift+Z` were each pressed against a
  real change, and **none of them did anything**, while the «Deshacer» button undid it correctly on
  the same state. There is no key handler in `apps/editor/src` at all: no `metaKey`, no `ctrlKey`,
  no `key === "z"`. Meanwhile [ADR 0022](../decisions/0022-a-page-is-born-by-converting-a-section.md)
  writes «deshacer» as a feature and not only as Ctrl+Z», `packages/schema/src/conversion.ts` repeats
  that sentence, `Editor.tsx` and `PagesPanel.tsx` each explain a behaviour in terms of it, and a
  test name, a test comment and an e2e comment all name it. **Either the shortcut is written or the
  seven claims are corrected**; what cannot stand is the repository describing an affordance the
  product does not have — which is the exact failure `CLAUDE.md` already records once, about the
  note that said `test:a11y` did not exist. Whose call: adding the binding is a small feature and
  direction's to schedule; correcting the prose is a one-PR chore.
- **A list item's optional slots cannot be reached.** The fields panel is explicit that "a list
  holds items rather than a value", so its rows are the section's slots and never an item's. A
  card's `description` in «Qué hago» has been `0..1` and unreachable since sprint 1, and a price
  line's is the same. It has not bitten because the questionnaire fills the cards it generates,
  and because a carta line reads perfectly as a name and a price. The fix is either extending
  `SlotAddress` to name an item, or a second panel; neither is small.
- **The three findings of sprint 4 that nobody has acted on**, all of them measured rather than
  supposed, and each one already written up where it belongs:
  - Whether a hostelería owner recognises «Precios» in the menu ([#51](https://github.com/dnarram/retorika-builder/issues/51)). The question is written out, word for word, in [`docs/sessions/guion-tercera-sesion.md`](../sessions/guion-tercera-sesion.md) — and **it still has not been asked.** #51 closed on 28 September saying the search field is what holds the name, and asked for the next session to show the menu and ask; the third session's owner runs a taller, so it could not be put. Two hosteleros out of two asked for «la carta» and neither has been shown the menu. **It needs a hostelería session, not just any session.**
  - Whether two adjacent sections of the same preset should read as one (the 172px row above).
  - ~~The editor's top bar naming the variant where mockup 08 names the business.~~ **Done**,
    28 September 2026: direction settled it and the bar shows the business name
    ([`REVIEW.md`](../design/REVIEW.md), "Resolved"). Struck on sprint 7 day 1, having outlived the
    code by a sprint and a half.
- **One of the five critical Playwright flows is not written yet.** *Cambio de paleta* joined on
  sprint 4 day 3, once day 2 gave `Estilo` a live panel to drive it — CI now covers four of the
  five. *Pago de prueba y publicación* is on hold with no plan (ADR 0008) — there is no payment
  flow and no publish target, so writing it would test code that does not exist. Named in the doc
  comment at the top of `apps/editor/e2e/critical-flows.e2e.test.ts`, which is where it belongs
  when it arrives.
- **Filling a destination by hand is done** (sprint 3, day 4) — listed here only so that the
  entry which sat in the old planning file as "pending" is visibly closed rather than lost.

---

## What phase 1 is still waiting on

The acceptance criterion **has been measured twice**, and both came in under ten minutes:

| Session | To the end of the questionnaire | To the ZIP |
|---|---|---|
| Conchi, 27 September 2026 | 2 minutes | **8 minutes** |
| A taller, 30 September 2026 | 1 minute 30 seconds | **6 minutes** |

Sources: `docs/sessions/2026-09-27-conchi.md` and `docs/sessions/2026-09-30-taller.md`, with the
Fase 1 note in `docs/protocolo.md`.

**The second measurement does not add the clause the first one carried.** The criterion is «sin
explicación previa y sin ayuda»; Conchi's write-up evidences that («El cliente no hizo preguntas y
usó correctamente la app») and the third session's does not — nothing records whether he asked
questions or needed help. So there are two timings and still **one** session's worth of
unaided-use evidence. The criterion also says «se cronometra **y se observa**», and the observation
table is blank for all three.

**Declaring phase 1 accepted is direction's, not development's.** Both sessions that produced a
number also said they would not publish the result as it stands — three owners out of three have
now said that, for three different sets of reasons. Every one of those facts is in its write-up.
What is recorded here is the measurement.

---

## What an image has to satisfy before it can enter the photo bank

Written on 29 September 2026, sprint 6 day 1, **before** the schema that enforces it, so that
licences can be checked with direction before any image is sourced. Every line comes from
[ADR 0011](../decisions/0011-sample-photos-per-sector.md); nothing here is new policy. The Zod
schema in `packages/photobank/src/schema.ts` refuses a file that breaks any of the checkable ones,
so these are not a checklist someone has to remember — they are a build failure.

**The licence is the part that cannot be fixed later.**

- **Commercial use allowed, *and* our clients may publish it.** A sample photo travels inside the
  client's ZIP and they put it on their own domain. A licence that covers only Retorika's own use
  fails the test, however generous it looks.
- **Never from a bank whose terms forbid compiling its photos into a similar service, or using
  them in digital templates.** ADR 0011 names two by name for exactly this: **Unsplash and
  Unsplash+ are both excluded.**
- **Preferably generated with a free generative-AI tool whose terms allow commercial use** — and
  the terms re-read for **the exact tool and the exact plan**. Free tiers routinely carry different
  terms from paid ones, and the plan is part of the answer.
- **The date the terms were read is recorded.** Terms change; the record keeps the version we
  relied on.

**What may not be in the picture.**

- **No recognisable person.** No face, and no tattoo or other feature that identifies somebody.
- **No brand, logo or lettering** — including the garbled pseudo-text generative tools draw on
  signs, labels and menus, which is the one people miss.
- **No visible artefacts:** extra fingers, warped tools, impossible objects.
- **Plausible for a small business in Spain.**

**The file.**

- **WebP**, longest side **1600 px**, quality around **75**, with EXIF and XMP removed — the origin
  belongs in the record, not in the file.
- **At most 200 KB.** Two separate checks, and worth stating separately because the first version of
  this note fused them: the file must weigh **exactly what its record declares**, and it must
  **not exceed 200 KB**. A record that misstates its own size is wrong even when it is small.

**What is recorded with each one** (`packages/photobank/bank/<sector>.json`):

- `id`, `sector`, `file`, `width`, `height`, `bytes`.
- **`alt`, in Spanish, describing what is really in the photograph** — it is a text that reaches a
  published page, so it is reviewed like any bank text.
- `origin`: the tool and model, the date, and **the prompt**.
- `licence`: name, URL, the date the terms were read, `commercialUse`, `clientsMayPublish`.
- `review`: who approved it and when. **A person, never the tool that made it.**

**How many.** ADR 0011 asks for **at least eight per sector**, so the three variants do not repeat
themselves. Sprint 6 takes **three to five for `restaurante-bar`** as the first real test of the
path — it is the sector of both usability sessions. A sector holds either none or at least eight;
a half-filled one would make two of the three variant cards show the same photograph, and the
bank's tests say so.
