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

Last reviewed: 4 October 2026, **closing sprint 14 — «el contenido reutilizable», the last pillar of
the studio that had no code at all.** A list can now be made out of the cards a section already has,
shown in several sections at once, edited in one place, and left again with its cards intact; the
preview is finally set in the letter the ZIP ships; and the **second-undo race this file has carried
since sprint 12 is closed by measurement** — it turned out to be the same defect as the `e2e` flake
row above it, seen from the other end, and the fix for that one closed this one a sprint before
anybody connected them.

**And a correction about this file itself, which is the fifth time.** Closing sprint 14 it still did
not mention **ADR 0030 or ADR 0032 anywhere** — both accepted on 2 October, both shipped — so the
«tipografías propias» row below spent two sprints describing a question those ADRs had answered. The
pattern this file names at its own §«the third time» has now happened five times, and the thing worth
saying is no longer «it happened again»: it is that **every instance has been found by somebody
re-reading the file against the code, and never by the file itself**. Nothing in CI reads it.

The review before that was 2 October 2026, **closing sprint 13 — the editor's half-drawn controls, and a defect
that had been hiding as a flaky test.** Six toolbar controls that had been drawn and unusable since
sprint 9 work with a mouse; three states that only reported now change something; an element may
choose between the two typefaces the ZIP already ships; the two approved screens that had shipped
half-built or not at all are settled; and two silent failures — a rejected session, a switch that
could not be remembered — now say so. The **intermittent `e2e`** turned out to be a product defect
with a measured mechanism, not a test defect, and its row below is closed. One row was closed by a
sweep rather than by work: the four inline Spanish strings were fixed on day 3 and nothing said so.

The review before that was 2 October 2026, **sprint 13 day 1 — the usability sessions are cancelled**
([ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md)).
David judges usability, and the Fase 1 acceptance criterion becomes his written judgement. **This is
the single event that has moved the most rows in this file**: fourteen places waited on a session,
and every one of them now points at that ADR instead of at a date that will never arrive.

**Three of them could not simply be re-pointed, and are worth naming here because the ADR names them
as what cancellation cannot route around:** the price, which two owners put at 50 € and which «two
people are still not»; «¿publicarías esto tal y como está?», three noes out of three and the live
gate on charging (ADR 0021); and whether what is behind the design-tools switch is findable, which
ADR 0025 §5 says must be *watched* and which the person who placed the control cannot judge.
**Nothing replaces those. The ADR says so rather than implying judgement covers them.**

One row got *smaller* rather than closing: ADR 0023's menu threshold asked for «a session that ends
with three pages», and the cheap half of it — recording the page count — never needed a stranger.
It is owed to whoever next builds a site with three pages, David included.

The review before it was 2 October 2026, **closing sprint 12**. The editor reached the parts of the document
it did not reach, and phase 2's last code point shipped. Seven things changed state: the two
unreachable line slots (#133), the fields panel's unanchored `<input>`, the keyboard undo that seven
places claimed, the tablet bucket the schema accepted and nothing could publish, the three different
mobile widths, the minimum SEO, and «tipografías propias» — which is **not** built and whose row is
only re-pointed, because ADR 0029 is about a shared link and not about letterforms.

**What this sweep found is the usual shape — older rot, not this sprint's.** `README.md` said the
catalog had four sections, which stopped being true in sprint 7, and listed the whole editor chrome
as unbuilt although every item of it shipped between sprints 2 and 10. It also said «nine check
names» over a table of ten. That is the **third** time this file has been caught describing a
product two sprints younger than itself, after `INV_4` and after the `e2e` job, and the pattern is
worth more than any one correction.

Two things are new and had no home: **an approved mockup has diverged since sprint 10 and nobody
wrote it down** (mockup 18's first state — `REVIEW.md` carries it now), and **`e2e` failed once in
CI and passed on a re-run**, after twenty-four green runs, in a test this sprint did not touch.
Both are rows below. ~~**Two things end this sprint waiting on somebody**, and both are direction's:
the fourth usability session, still, and the word on mockup 18.~~ **One of the two was answered the
day after this was written**: the fourth session is cancelled with every other
([ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md)), and
mockup 18 was decided in the same breath — the code follows the drawing, and sprint 13 day 3 builds
it. **Neither ends up waiting on direction; both were David's.**

The review before it was 1 October 2026, **closing sprint 10**. Bold and italic shipped — schema, renderer,
toolbar and a walk through a download — so the rows about them are records rather than debts now.
What this review mostly found was **older rot, not this sprint's**: the README said `INV_4` was
provisional and that there was no `e2e` job, both true when written and both false for sprints, and
`docs/document-rules.md` had no section for marks at all although it has carried one for the style
vocabulary since sprint 9. **Three things end this sprint waiting on somebody**, each on its own row
below and each saying what it waits on rather than being summarised twice here: **ADR 0028**'s four
typography options, **ADR 0025**'s proposed amendment about its own switch, and **a fourth usability
session** — which the record now asks for by name, because the observation table has come back blank
three times and #51 is still owed by a hostelería session that has not happened.

> **One of those three was answered the same day, after this entry was written: ADR 0028.** David
> asked development to decide it as an expert; the answer is **option A — ship the faces — with
> option C first**, and the row below carries the three measurements it was decided on. **Two end
> this sprint still waiting**, and both are direction's: ADR 0025's amendment, and the fourth
> session. ADR 0028 is now waiting on nothing but the work.

The review before it was 1 October 2026, **sprint 10 day 2 — the three decisions the session
forced**. Two
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

## What this sprint leaves open, and on whom

- **`e2e` failed once in CI, on a test this sprint did not touch, and passed on a re-run.** «sprint 7
  día 3 — deshacer una conversión» timed out for 30 seconds waiting for the «Convertir esta sección
  en página» button after clicking its section. **What is known:** twenty-four consecutive CI runs
  were green before it, including six of this sprint's own; the re-run of the identical commit went
  green; the test passes three times out of three locally in isolation and in the full suite; and
  this sprint grew the `e2e` job from about 1m46 to 2m30 by adding a walk.
  **What was checked and rules out this sprint's code:** `canConvert` is a pure function of a freshly
  generated document and nothing touched `conversion.ts`; the test opens its own browser context, so
  no earlier test's state reaches it; and neither of day 7's two source changes is reachable from its
  path — the fields panel is never opened and `editText` is never called before the failure.
  **What was guessed and is false:** that a bank photograph arriving reloads the frame and loses the
  selection. The frame *does* reload — `srcDoc` depends on `photoUrls` — but `wireInteractions`
  puts the selection back from `selectedSection.current`. So there is no proven mechanism, and this
  row says so rather than offering one.
  ~~Whose call: nobody's yet. It is recorded so the next person who sees it has the history instead of
  an empty hunch, and so a second occurrence is evidence rather than a surprise.~~

  **It happened again on 2 October 2026, in PR #146 (sprint 13 day 5), and the second occurrence is
  worth more than the first because of what the two have in common.** A different test —
  «sprint 7 día 7 … la tira de pestañas nunca se solapa», not «deshacer una conversión» — and the
  **identical two statements**, character for character:

  ```ts
  await frame.locator('[data-section="sec-services"]').click();
  await frame
    .locator('[data-section="sec-services"] .rb-action[aria-label="Convertir esta sección en página"]')
    .click();
  ```

  Same section id, same button, same 30-second timeout on the **second** click.

  **And then it failed a third time, in the same session, on something else — which corrected the
  conclusion this row had already reached.** The paragraph above was written claiming the evidence
  pointed at *that pair of gestures*. The next re-run of the same commit failed in
  «sprint 7 día 7 — el recorrido completo», with no timeout at all: two captions typed into the
  gallery came back reading «Escribe aquí de qué es esta foto», the placeholder. A
  click-and-type that never committed, not a button that never appeared. The fourth run went green,
  all 43.

  So the honest common factor is wider than one gesture pair and still narrower than «flaky»:
  **three failures, three different tests, two different symptoms, every one of them an interaction
  with the inside of the preview frame that did not take effect.** Twice a click that produced
  nothing; once a typed string that was never committed. That is the whole of what is shared, and the
  sentence above is left standing, struck through in effect, because a row that quietly tightens its
  own story is worth less than one that shows where it was wrong.

  **What is ruled out about PR #146 specifically**, since three failures on one branch against
  twenty-odd green runs on `main` is a correlation that deserves an answer rather than a shrug: its
  three new `e2e` tests are **appended at the end of the file**, and with `--maxWorkers 1` on a single
  file that is also the end of the execution order — so they run *after* both victims and cannot have
  loaded the runner for them. Its one source change to the toolbar is behind the design-tools switch,
  and both failing tests run with the switch off, where the bar's DOM is unchanged. Its schema change
  is type-level only, which `schema-guard` confirms independently. **No mechanism connects them, and
  the correlation is left unexplained rather than explained away.**

  **A fourth run settled the question of whether this branch is involved, and the answer is no.** The
  commit that carried the paragraphs above changes **one markdown file and nothing else**, and its
  `e2e` job failed where the run before it — identical application code, identical tests — had gone
  green. Two tests that time, «día 7 — dos conversiones desde el editor» and «regression — a section
  is added to the page you are looking at», neither of them touched this sprint. Identical code, green
  then red: whatever this is, it is not in the diff.

  **The tally for 2 October 2026, so a fifth occurrence has numbers to sit beside.** Four `e2e` runs on
  one branch inside about forty minutes: one failure, one failure, zero, two. Five distinct victim
  tests across them, every one an interaction with the inside of the preview frame that did not take
  effect. Before today: twenty-four consecutive green runs and a single occurrence. **Playwright and
  its Chromium are pinned by the lockfile and cached by version**, so a browser that changed under us
  is ruled out too — checked, not assumed.

  **What this costs right now, said plainly:** `e2e` is failing roughly one run in two, so a pull
  request may need its job re-run before it can be merged. That is a tax on every day until it is
  found.

  **The hypothesis worth measuring on day 7, unmeasured and labelled as a hypothesis.** The frame
  re-renders on interaction — this repository already knows that makes what is inside it unstable
  while it remounts — so an event landing inside that window may be **lost entirely** rather than
  delayed. The shape fits all three: a lost click times out instead of passing late, and keystrokes
  delivered to a node that is about to be replaced land nowhere. **If it is true it is a product
  defect and not a test defect**, which is why it is worth a day: a person who clicks or types at that
  instant gets nothing back, clicks again, and never mentions it. A test does not click again.
  ~~Whose call: day 7's colchón, this sprint.~~

  ---

  **Found, measured and fixed on 2 October 2026, sprint 13 day 7. The hypothesis was right in its
  conclusion and wrong about the mechanism, and both halves are worth keeping.**

  It is a **product defect**, exactly as the paragraph above suspected: a lost event, not a delayed
  one. But the window is not a re-render. It is the gap between the preview being **parsed** and the
  preview being **wired**:

  | Moment | When |
  |---|---|
  | `[data-section]` queryable, `readyState: "interactive"` | **0.2 ms** |
  | `wireInteractions` attaches the chrome, on the frame's `load` | **64.9 ms** |

  For the whole of those 64.7 ms the preview is fully drawn, looks exactly as it does a moment later,
  and **nothing is listening**. Instrumented over a real press delivered inside the window:
  `{"wiredAtClick":false,"selected":0,"actions":0}` — two and a half seconds later the section had
  never been selected and the action cluster had never been drawn. That is the thirty-second timeout CI
  kept printing, and a keystroke is lost the same way, because `wireEditing` is what makes anything
  `contenteditable` in the first place — which is the second symptom, the gallery captions that came
  back as placeholders.

  **Why the window exists, and why a loaded runner widens it.** `wireInteractions` runs on the
  iframe's `load`, and `load` waits for subresources. The rendered page's `@font-face` rules name
  `fonts/*.woff2` **relative**, so inside a `srcDoc` iframe they resolve against the editor's own
  origin — **eight requests, and nothing there to answer them.** `load` waits for the last of them, so
  the window is as wide as the slowest. That is the correlation the row above could not explain:
  nothing about the failing branches mattered, only how long eight dead requests took on the day.

  **The fix** attaches the chrome as soon as the document is parsed — a look-ahead keyed on the
  rendered string that watches for a `contentDocument` the chrome is not yet attached to — with
  `onLoad` kept as the backstop and the attach made idempotent by document identity. Three `e2e` tests
  hold it, and they are **deterministic rather than a second flake**: the font requests are delayed to
  1.5 s with `page.route`, which is the same cause slowed down, so the race becomes a fact. Each one
  fails against the old wiring; the third fails if the chrome is ever attached twice.

  **Four consecutive green `e2e` jobs on CI over the fix**, re-run on the identical commit, against
  three failures in four runs the day before. That is evidence and not proof — the failure was always
  intermittent, so a fifth run could still be red and would mean the mechanism above is not the only
  one. What makes it more than a lucky streak is that the mechanism was measured directly rather than
  inferred from the streak, and that the three tests holding it fail against the old wiring on demand.

  **What the row got wrong is kept above, unedited.** The earlier falsification — «a bank photograph
  arriving reloads the frame and loses the selection… `wireInteractions` puts the selection back» —
  was correct about what it tested and tested the wrong step: it showed that a reload after a
  *successful* selection keeps it, and said nothing about a click that was never registered at all.
  There is nothing to put back when nothing was recorded.
- **The rail is seven items, and the design-tools switch now sits in the bottom-left corner at 720px
  tall (3 October 2026, sprint 14 day 5).** The switch is placed directly under the rail's items
  rather than at the foot of the rail — deliberately, because sprint 8's walk found that `mt-auto` put
  it 600px from everything else, which «is not separation but concealment». So every new rail item
  pushes it down: six items put it at about y=598, and `Listas` makes seven and puts it at **y=658**,
  which at a 1280×720 viewport leaves **43 pixels** under it.

  **Two pre-existing `e2e` tests started failing on it**, which is how it was found rather than
  reasoned about: the click on the switch timed out because Next's dev overlay (`NEXTJS-PORTAL`) owns
  that corner. Both were given a taller viewport with the reason written beside them, and that fixes
  the tests and not the product.

  **`EditorShell`'s own comment predicted exactly this** when the switch was placed, and drew the line
  this row is about: «It is also the corner the dev overlay occupies, which is **only a nuisance for a
  test** — but browser chrome tends to gather there too, **and that is not**.» A download bar, an OS
  dock or a notification toast lands in the same 43 pixels, and `MIN_STUDIO_WIDTH` guards width only.
  Nothing guards height anywhere.

  Whose call: nobody's yet, and it is a design question rather than a bug — where the switch goes when
  the rail is seven items. `REVIEW.md` has flagged the rail's own length as an open question since
  `Compartir` made it six; this is the first time that length has cost something measurable.
- **The editor's preview never shows the typeface the ZIP ships, found on the way to the row above
  (2 October 2026) and not fixed.** The renderer emits `@font-face` with `fonts/*.woff2` relative,
  which is right for the ZIP and for `file://`. Inside the editor's `srcDoc` preview those eight
  requests resolve against the editor's own origin, where **nothing is served** — there is no
  `apps/editor/public/fonts` — so every one of them 404s and the canvas falls back to the stack.
  **The owner chooses a typeface, edits in the fallback, and downloads the real face.** The `Estilo`
  panel's own `Aa` specimen is honest about this by accident: the backlog row for #9 says it «renders
  in the real stack», which is the stack and not the shipped face.
  Not fixed here because it is not one line: the bytes live base64 in source (ADR 0028's own
  consequence, after «three ways of reading them from `node_modules` each passed every test and
  returned 500 from the real download route»), so serving them to the editor is a decision about where
  they come from, not a path to add. **It is recorded now because it was measured now**, and because
  the 404s it causes are what made the lost-click window as wide as it was.
  Whose call: nobody's yet. It costs nobody a published page — only the fidelity of the preview.
- ~~**Four Spanish strings still live in `.ts` files, and `brand.name` sits unused beside them.**
  `ui.tsx:67` renders «Retorika Builder» inline while `apps/editor/src/locales/es.json` holds exactly
  that string unread; `layout.tsx` carries the page description; and the whole `/motor` route is
  unlocalised. `REVIEW.md` has claimed since 26 September that «no Spanish user-facing literal lives
  in a `.ts` or `.tsx` file», which stopped being true without anybody noticing. Whose call: nobody's
  — it is a one-PR chore, left out of the closing sprint because a closeout changes no behaviour and
  a locale key is a behaviour change however small.~~
  **Closed in sprint 13 day 3, and this closeout is what noticed** — the row outlived the work by four
  days because nothing pointed at it. `ui.tsx` and `layout.tsx` both read `brand.name` and
  `brand.tagline` now, and `/motor` reads three keys of its own. **Verified against the code rather
  than against the commit message**: a sweep for a Spanish-looking literal across `apps/editor/src`
  returns only prose inside comments, which the rule has never been about. `REVIEW.md`'s claim is true
  again.
- **`next dev` rewrites `apps/editor/tsconfig.json` every time it starts**, reformatting it and
  adding a `.next/dev/dev/types/**/*.ts` include with a doubled `dev` segment, which Biome's hook
  then reformats back. ~~Seen on three days of this sprint and reverted each time; it has never been
  committed.~~ **Now seen across two sprints — three days of sprint 12 and days 5, 6 and 7 of sprint
  13 — and reverted every time; it has still never been committed.** Six occurrences is no longer a
  curiosity: it is a step that has to be remembered before every commit that ran the dev server, and
  the one kind of step that gets forgotten on the day somebody is in a hurry. Whose call: nobody's,
  until it is. A `.gitattributes` entry or an ignore rule would end it; working out which is a small
  task nobody is waiting on.

## Decided elsewhere, waiting on someone

| What | Where it is written | Waiting on |
|---|---|---|
| **The professional editor is a target of the product, and the advanced module starts now.** Decided by direction, 30 September 2026: the same editor must also serve someone who builds sites for other people. That schedules «el modo estudio» ahead of its place in the protocol's phases — a deliberate crossing, with ADR 0018 as the precedent — and it changes what «done» means for the editor. | [ADR 0025](../decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md), and the advanced-module dossier | Nothing. Three of the four pillars are built: sprint 8 delivered **la colocación** and **los dispositivos** with the switch, sprint 9 **el sistema de estilo**. ~~The fourth — **el contenido reutilizable**, the §7 collections — is unscheduled, and nobody has asked for it~~ **The fourth is scheduled: sprint 14, under [ADR 0033](../decisions/0033-reusable-content-and-the-template-that-is-one-item.md), decided by David on 2 October 2026 when he chose what «closing the editor» would mean.** «Nobody has asked for it» stays true and is left standing, because it is the honest half of the row: this is the one pillar built because the product needs finishing rather than because an owner named it. What the ADR decides is **three of §7's five promises** — one template many entries, catalog sections fed from a collection, and the client adding entries without touching the design. The two it leaves are one dependency: **a page per entry**, and the menu that would follow it |
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
| **Formatting inside a text — the wait is over, and it is built in sprint 10.** [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) settled the shape on 29 September 2026 (bold and italic over a run of characters; **underline refused**, because on the web it means a link) and made the code wait for the third session. **That session ran on 30 September and asked the question**, and the second owner named negrita and cursiva. **Neither waking condition was met at the letter** — Conchi's request was spontaneous and his was an answer to a question the ADR's own script required, and «the first thing they name» is not verifiable because the order and «¿Qué le falta?» are both blank. So the build was **authorised by David on 1 October 2026 in approving the sprint 10 plan**, on three things together: two requests in two different shapes, the texts already fixed and the request surviving them, and the professional audience ADR 0025 added after this ADR was written. **Underline was asked for a second time and is still refused.** **Shipped and closed on 1 October 2026**: the schema at 1.3.0 with migration `0004`, the renderer splitting and escaping piece by piece with `xss-attempt` green and untouched, `B` and `I` in the floating toolbar for everybody, and a composed walk that marks two words, edits around them, and opens the downloaded ZIP with the emphasis intact and nothing executing. **#52 closed with the day 7 pull request** — day 5 shipped the control but its body never said `Closes #52`, the same gap `CLAUDE.md` records for #19 and #25, caught on the last day rather than left open. | [#52](https://github.com/dnarram/retorika-builder/issues/52), [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md), and [the session](../sessions/2026-09-30-taller.md) |
| **What happens to a mark when the text beneath it changes — answered and accepted, 1 October 2026.** [ADR 0027](../decisions/0027-a-mark-moves-with-the-text-under-it.md) takes the word processors' convention (inside grows, at the end continues, at the start does not, deleting part shrinks, deleting all removes) and proves the five rows are **one** offset rule, which is what day 3 implements. It also **amends ADR 0024 in one clause**: «overlap another» becomes «overlap another of the same kind», because read literally it made bold *and* italic on the same words impossible — the first thing the third owner named. Different marks overlap, identical ones merge, and «no two runs of the same `mark` touch or cross» is the invariant the schema validates — **touching meaning touching**: two runs of the same mark separated by any unmarked text, one space included, stay two runs and publish different bytes from one. **Accepted by David on 1 October 2026, not by direction**, with one correction he found on review: the ADR's own merging example was `[0,9)` + `[10,19)`, which is the case that does *not* merge. The rule was right and the example showed its opposite; it is now a required test. **Built in the schema on 1 October 2026** (`packages/schema/src/marks.ts`, migration `0004`, SCHEMA_VERSION 1.3.0), with one rule the ADR had not foreseen: **a boundary may not cut a surrogate pair in half**, because the renderer escapes each piece separately and the file is written as UTF-8, so `Café 🍷 tinto` would publish as `Café �� tinto`. Measured, then refused in the schema. **The renderer emits them since 1 October 2026** (`packages/renderer/src/runs.ts`): the split happens in the node tree, where `nodeToHtml` has escaped every string child separately since sprint 1 — so «each piece escaped separately» needed no new escaping rule, and `xss-attempt` stayed green without being touched. What did need deciding was **whitespace**: pretty-printing between inline children renders «Solo millo» where the document says «Solomillo», so a node holding marks is laid end to end. | [ADR 0027](../decisions/0027-a-mark-moves-with-the-text-under-it.md), amending [ADR 0024](../decisions/0024-formatting-inside-a-text-is-designed-and-waiting.md) |
| **The design-tools switch was found, and it sorted wrong.** The first owner ever to meet it found a 34×19px switch with a 9px label at the foot of the rail, pressed it unprompted, read «¿Montas webs para otros?» and answered «Sí, enciéndelas» — while running a car workshop. **The discoverability half of ADR 0025 §5 holds on evidence it did not have; the sorting half does not.** And two of the seven things he then said he could not find — `color exacto` and `más libertad en la posición` — were already behind that switch, the first in the very toolbar he is recorded using. **Finding the switch is not the same as finding what is behind it**, and it is not fixed by building anything. **Answered 1 October 2026 as an amendment in ADR 0025 — accepted by David, not by direction, and built the same day**, with three parts: the gate *did* its job because §1 protects against controls arriving unasked and he asked by pressing; **the question's wording does no work** — it asks who somebody is and grants capability for the answer, so anyone who wants the capability says yes — and should describe the tools instead; and the real finding is that **one intention takes three places.** Verified: `DesignPanel.tsx:315` renders «Diséñala a mano **desde su cabecera**» as a plain `<p>` — a dead end naming its own exit and not offering it. The offer is now reachable from there, as a button beside that very sentence; §7's per-section escalation is **not** amended, and that is what makes a second door to the same offer safe — `escalate` copies the catalog's own layout in, so **no element moves**, measured in Chromium and Firefox as every element's box before and after. And it records what the evidence does **not** license: moving ADR 0026's exact-value line, because the tools were already on and the switch is not what stopped him. **Built 1 October 2026**: the question became «¿Quieres colocar tú cada elemento?», the panel's dead end became a paragraph that promises the return plus the «Diseñar a mano» button, and the panel's four states moved into `designPanelState` — which is where a second defect turned up, reachable and latent: the panel offered «Diseñar a mano» for a **section that had been deleted** while it was open, and `escalateSection` throws on a missing id, so it was a dead button that looked alive. **What is still open is unchanged**: whether the *rest* of what is behind the switch is findable, ~~which is a thing to watch in a fourth session rather than ask~~ — **and as of 2 October 2026 it is a question with no method at all ([ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md)): discoverability is measured by watching somebody naive to the control, and the person who placed it cannot be naive to it. Judgement substitutes for an opinion, not for an instrument.** | [ADR 0025](../decisions/0025-studio-mode-starts-now-and-its-switch-is-not-in-the-document.md), "Amendment" |
| ~~**The other half of the pre-publish check: overflow below 320 pixels.**~~ **Built 1 October 2026, sprint 10 day 6**, and with it the last entry of ADR 0026's table: `apps/editor/src/editor/overflowCheck.ts` loads each page into a hidden 320-pixel frame before a download, measures every element's right edge, and the gate **warns** naming the sections — a warning and not a block, because the dossier's own word is «avisa», the owner can see it in the mobile preview, and the commonest cause is a long word they typed. `fontSize` joined `EXACT_TODAY` in the same merge, which is the rule ADR 0026 §2 states. **What follows is what it was owed for, kept as written rather than deleted — the sentence about an exact `fontSize` being refused is the one that stopped being true.** The advanced dossier §4 promises one review covering two things — «contraste insuficiente **o de desbordes por debajo de 320 píxeles**» — and sprint 9 built the first half only. `a11y.md` has cited that same sentence since sprint 2 as the reason the browser harness exists, and the harness *does* measure overflow — over the corpus, in CI, at 320/768/1280. What does not exist is the same question asked of **this owner's document, before this download**, which is what the dossier promises and what a gate would need. It is also the reason an exact `fontSize` is refused: a size is the one value in rule 6's vocabulary that can cause an overflow, and offering it behind a gate that cannot see what it would cause is the shape of promise ADR 0026 exists to refuse. Costed at more than a day: it needs a rendered page measured at 320px somewhere the editor can reach, which is a second measurement path beside the contrast arithmetic. Unscheduled, and nobody is waiting on it. | [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md) §2's table, and [`a11y.md`](a11y.md) |
| **Type pairs falling back** on machines without Inter / Playfair Display. ~~Still open — the fallback itself is unchanged~~ — **closed 1 October 2026; the fallback was re-chosen and the faces now ship. The struck clause is left visible because it was the premise of this row for three sprints and the end of this row is what overturned it.** The interface half was handled first: the Estilo panel names typefaces by character («Moderna y neutra») and never by font, and its `Aa` specimen renders in the real stack, so what it shows is what that machine will give. **Sprint 9 makes this a gate rather than a nuisance:** it is what keeps «tipografías propias» and the toolbar's per-element `Aa` out of the style work, which is half of the advanced dossier §4's "On" column for the style panel. It needs a decision, and [ADR 0026](../decisions/0026-the-switch-is-the-line-between-references-and-exact-values.md) says so by name rather than leaving the omission to be noticed later. **An owner has now asked for it**: «fuente de letra» is one of the seven things the third session's owner named wanting and not finding, which turns this from a gate development chose to respect into a request from outside. **[ADR 0028](../decisions/0028-typography-needs-a-decision-from-direction.md) carries the four options with their costs** — ADR 0026 said «it is direction's and deserves its own ADR», and this is it. *It was written refusing to choose between them, and that refusal stood for exactly as long as the paragraph after this one; the options are left in it unchanged, so what the decision was made from is still readable.* What that ADR adds to #9: **option C is already half-built and undecided** — the editor stopped promising a font in sprint 4, and the three pairs were never re-chosen to survive not getting one. Re-measured 1 October: **two of the three lose their heading/body contrast entirely** on a machine without Inter or Playfair Display, so «leave it» is a choice with a cost rather than the absence of one. **Answered 1 October 2026: option A — ship the faces — with option C first.** Proposed by development at David's request; **accepted by David himself, not direction** — the same act ADR 0026 records, and this row exists for the same reason that ADR's does: «accepted» is never to be read as «direction agreed». Three things were measured before choosing, and two of them contradicted what the ADR had written from the issue: the 60 KB budget gzips **the page only** and the corpus sits at 1.6–2.5 KB of it, so a font shipped as a file costs none of it; a relative `@font-face` **loads and renders from `file://`** (385px against 411px with the file missing), so ADR 0001's double-click promise survives; and a font file would be **the first `url()` this renderer ever emits**, through an allowlist whose own comment says «no url() and no network» — not a blocker, but the narrowest exception in the most sensitive line of the renderer. **C is not an alternative but A's floor**: a missing file degrades to the stack, so the stack has to be worth it, and today two of three pairs lose their heading/body contrast. **B is refused permanently** (it contradicts ADR 0001) and **D is not built**. «Tipografías propias» still comes after, never before. **Built on 1 October 2026, and #9 closes with it.** C first: the three pairs each now *declare* how they survive getting no font, and the ADR's own premise was corrected on the way — heading and body also differ by weight (700/400) and size (2.5×), which no absent font can take, so what a pair loses is its **character** and not its pairing. `modern-sans` was left as one family **on purpose**; `classic-display` was the one that genuinely lost everything and now gives Didot over Charter where it gave Georgia over Georgia. Then A: the renderer emits `@font-face` through an exception written as narrowly as the rule it dents — the directory is written inside the escaping function, the file must end in `.woff2`, and a document may only *select* a row of a closed table and can never *name* a file; six sabotages, all caught. The publisher ships the latin `woff2` of the weights the stylesheet asks for, **exactly as `@fontsource` 5.2.8 ships them**, with the OFL text of each beside it — and refuses to build a bundle that has a face and no licence. **Both licences read and dated: OFL 1.1; Inter declares no Reserved Font Name, Playfair Display declares «Playfair Display»** — which is what makes shipping the file untouched the compliant path as well as the cheap one, since the OFL only lets a reserved name travel with an unmodified face. `pnpm size` gained a second number: 52.7 KB for a bundle with fonts against 1.8–2.5 KB without, under an 80 KB budget chosen from that measurement. **The bytes live in source**, base64 and generated, after three ways of reading them from `node_modules` each passed every test and returned 500 from the real download route. | [ADR 0028](../decisions/0028-typography-needs-a-decision-from-direction.md), [#9](https://github.com/dnarram/retorika-builder/issues/9), and [the session](../sessions/2026-09-30-taller.md) |

## Recorded against the thing it challenges

| What | Where |
|---|---|
| **Moving images freely — and now it is the second time.** Conchi asked for it; it collides with document rule 4, and rule 5 already named the hole it would open. This row existed so «the next person hears it as the second time», and **the next person asked on 30 September 2026**: «más libertad en la posición», one of his seven. It arrives in a different shape, which is the useful half — **the grid exists** (sprint 8, ADR 0025 §7) and he had the design tools on, so what he was refused was not placement but placement off the grid. **Rule 4 stands.** What two owners out of three now say is that the grid as built did not read as the answer, and whether he ever opened the `Diseño` panel is not recorded. | [`docs/document-rules.md`](../document-rules.md), the note under rule 4, and [the session](../sessions/2026-09-30-taller.md) |
| **The design review's own open list** — the third cover composition, `location`'s `split` gap, and the rest. *(Mockup 13's palettes were named here until sprint 7 day 1 and had been resolved since 28 September: the Estilo panel ships their names from `packages/tokens/src/locales/es.json`.)* | [`docs/design/REVIEW.md`](../design/REVIEW.md), "Still open" |
| **The price — still two answers, and still a coincidence.** Two sessions answered it and they overlap at 50 €. **The third session was the one that could have made that a price rather than a coincidence, and the answer was not recorded.** The question was the fifth of the five and it is blank. | [`docs/design/HANDOFF.md`](../design/HANDOFF.md), the open-questions table, and [the session](../sessions/2026-09-30-taller.md) |

## No home but this one

- ~~**Accounts and persistence with Supabase, and charging — deferred, not scheduled.**~~ **This
  row was one row and should have been two, which is exactly what let it sit untouched for a
  sprint.** Split on 4 October 2026, closing sprint 15.

  **Accounts and persistence: done.** [ADR 0034](../decisions/0034-the-account-arrives-at-the-end.md)
  released them without touching the charging decision, and the opening was in ADR 0021's own
  shape: that ADR argued charging at length — a Price object, an invoice template, a DPA, «there is
  no transaction to describe» — and swept accounts in through a **consequence** it never argued.
  Nothing in it claimed accounts had nothing to attach to. The README's «The account, piece by
  piece» says what exists and what does not.

  **Charging: still deferred, and nothing about it moved.**
  [ADR 0021](../decisions/0021-charging-waits-for-a-sellable-product.md), 28 September 2026: it
  waits until the product is judged professionally sellable, the same status ADR 0008 gives hosted
  publishing. The mechanism is decided — Stripe, single payment, Checkout, idempotent webhook,
  three stored states (protocol Part 15) — and the six open questions in
  [`docs/design/billing-questions.md`](../design/billing-questions.md) are not going to direction
  with a deadline; they wait for the same moment. One of the six is ours to raise when that moment
  comes: **once the ZIP is handed over there is nothing to switch off** (ADR 0001), so what a
  refund can even mean has to be decided before the terms of use are written, not after.

  **And one thing ADR 0021 left ambiguous that is still ambiguous:** who declares the product
  «profesionalmente vendible». That ADR says direction; ADR 0031 moved the sibling judgement — Fase
  1's acceptance — to David without saying whether this one moved too. It is a one-line decision
  and ADR 0034 deliberately did not make it.

- **Three decisions are waiting on David, each in its own file rather than in this list**, because
  each needs a number or a choice that is his and not development's:
  [`copias.md`](copias.md) — the free Supabase plan has **zero** backup retention and pauses after a
  week, so protocol Part 16 is not met; three ways out with their prices and nothing executed.
  [`arranque-en-frio.md`](arranque-en-frio.md) — whether to serve the landing as a separate Render
  static site, with the two cold-start measurements that need the deployment.
  [`el-recorrido-de-la-cuenta.md`](el-recorrido-de-la-cuenta.md) — the thirteen-step walk that needs
  a real project, including Google sign-in, which development could not verify.

- **The five existing `aria-modal` dialogs still take focus nowhere, trap nothing, return nothing
  and ignore Escape.** Sprint 14's sweep counted them; David scoped the sprint-15 fix to the new
  screens, so `RevertDialog` and the four in `DownloadGateDialogs` are untouched. **What changed is
  the cost**: `apps/editor/src/account/useFocusTrap.ts` exists and has two callers, so bringing
  them up to date is now adding one hook call each rather than designing the behaviour.

- **Two of sprint 14's four appendix findings are still open, by David's own allocation.** The four
  corner handles that are drawn, styled and carry no listener at all; and the six section verbs
  reachable only by mouse, in a `<section>` with a `click` and no `tabindex`, no `role` and no
  keyboard, with no sections panel in the rail. The other two were fixed in sprint 15: focus and
  Escape on the new screens, and the sample photograph that left a site permanently
  undownloadable.
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
  ~~**A fourth session should fix the recording before it adds anything else**, and the cheapest
  version of that is the script's own list filled in as it happens plus the five answers written
  down word for word. Whose call: direction's, as scheduling and facilitation always were.~~
  **Closed 2 October 2026, and not by being fixed —
  [ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md)
  cancels the sessions.** The table will never be filled. It is left struck rather than deleted
  because it is the clearest statement in this file of what three sessions failed to produce, and
  because the ADR's own «what is lost» section cites it: the editor is where most of the clock goes
  and it has never had a direct observation behind it, and now it never will.
- ~~**There is no keyboard undo, and seven places in this repository say there is.**~~ **Written on
  2 October 2026, sprint 12 day 3**, which is the half David chose of the two this row named.
  `Meta+Z` and `Control+Z` undo; `Meta+Shift+Z`, `Control+Shift+Z` and `Control+Y` redo. Not
  `Meta+Y`, which means something else on macOS in enough applications that claiming it would be
  taking a key this editor has no business taking, and nothing carrying Alt.
  **The rule that makes it safe is the half that matters**, and it was David's condition for writing
  it at all: nothing fires while the focus is in a `contentEditable`, an `<input>` or a `<textarea>`,
  where `Meta+Z` is the browser undoing the letters being typed right now. Two listeners, not one —
  a key pressed over the canvas is dispatched in the `<iframe>`'s own document and never reaches the
  editor's.
  **One limit, measured rather than left to be found:** undoing re-renders the canvas, which
  replaces the frame's document and the listener on it, so a second press sent with **no** gap is
  lost; with 400ms between them none is. Two deliberate presses are fine and holding the keys down
  may not be. Its own row is above. *What follows is the row as it stood.*
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
- ~~**The minimum SEO: a published page's `<head>` carries no `description` and no Open Graph.**~~
  **Built 2 October 2026, sprint 12 days 5 and 6, under [ADR 0029](../decisions/0029-what-a-published-page-says-about-itself.md).**
  `description` and `og:title` on every page; `og:description` whenever there is a sentence;
  `og:image` and `og:url` only with an origin the owner typed, because a relative `og:image` is
  refused by every scraper and a ZIP does not know what domain it will be opened under. **The
  description is derived, not copied** — `siteDescription` starts empty and the renderer falls back
  to the cover's subheadline, so there is nothing to keep in step and no second sentence to go
  stale. `og:image` additionally refuses a `data:` URI, an SVG and the catalog's grey marker, and a
  publisher test proves the path it names **is a file in the bundle**. The corpus gained
  `enlace-compartido`, the first fixture with a bitmap, because every other asset is an SVG and so
  nothing proved the tag was ever emitted at all. What is **not** done is a preview image for a site
  with no domain yet: that is the honest half, and the `Compartir` panel says so.
  *What follows is the row as it stood, kept because the costing in it is what the work was planned
  from.*
- **The minimum SEO: a published page's `<head>` carries no `description` and no Open Graph.**
  Measured on the corpus closing sprint 11 — `pageToHtml` emits exactly `charset`, `viewport`,
  `<title>` and the inlined `<style>`, and nothing else. So a site shared on WhatsApp or Facebook,
  which is how a neighbourhood business is actually passed around, previews with no summary and no
  image. **Named in the sprint 11 plan as «el último punto de código de la fase 2» and it has no ADR
  yet**, which is the first thing it needs: a description has to come from somewhere the owner
  controls, and the obvious candidate — the cover's subheadline — is a sentence written to be read on
  the page rather than in a search result. Whose call: the copy question is direction's; emitting the
  tags once that is settled is a day.
- **«Tipografías propias» — letting the owner choose a typeface — is still unbuilt, and now unblocked.**
  ADR 0028 put it after option A in as many words («Not «tipografías propias». Letting the owner pick a
  typeface comes after A, never before, and is its own decision»), and A shipped on 1 October 2026. So
  the reason it was refused — that offering a typeface while fonts fall back promises a letterform the
  visitor may never receive — no longer holds for the two faces this product ships. It does still hold
  for any other face: an owner picking Bodoni gets whatever their visitor's machine has, because
  nothing ships Bodoni. **That is the decision it needs**: whether «choose a typeface» means a third
  shipped pair, or a free field with the fallback honestly described. Recorded here rather than inside
  the resolved row above, where it was a clause nobody would find.

  **Half of this was answered on 2 October 2026 and this row did not hear about it for two sprints.**
  [ADR 0032](../decisions/0032-typography-per-element-with-the-faces-that-travel.md) decided the
  per-element choice — «Titular» and «Texto», the two faces the ZIP already carries — and built it in
  sprint 13. What is left is narrower than the sentence above: **a free field, and a third shipped
  pair.** And the free field is no longer a question with two answers, because ADR 0032 §2 made it
  **unexpressible**: `fontFamily` is the one style property with no exact arm, in the type as well as
  at runtime, so there is no shape a typed family could take. So the decision this row asks for is
  only «a third shipped pair?», which is ADR 0028's territory and costs bytes in every client's ZIP.
  `docs/document-rules.md` is the current authority and has said so since sprint 13's closeout.
- ~~**A second undo pressed immediately after the first can be lost, while the canvas re-renders.**
  Found by measuring the shortcut that sprint 12 day 3 built, not by supposing: undoing replaces the
  canvas `<iframe>`'s document, and with it the `keydown` listener `wireInteractions` installs on
  load. Between the new document existing and that listener arriving, a keystroke reaches neither
  document. **At machine speed a press sent with no gap is dropped; with 400ms between them none
  is**, so a person pressing twice deliberately is unaffected and a person holding the keys down may
  not be. The e2e test clicks the canvas between presses rather than sleeping, and says why. The fix
  is not another listener — it is the canvas not losing its document on every step, which is a
  bigger change than the shortcut was and has nobody waiting on it.~~

  **Closed on 3 October 2026, sprint 14 day 7 — re-measured, gone, and it was fixed a sprint before
  anybody connected the two.**

  Re-measured because this row predated sprint 13 day 7, which changed the one thing it names: the
  frame's `keydown` listener now installs when the document is **parsed**, not when it has **loaded**.
  **Five gapless presses, five undos, every time** — at 0ms between them, and again with 600ms of
  latency on every font request to widen the old window as far as it goes.

  **And the cause is established rather than assumed, by putting the old world back.** Four runs:

  | Parse-time wiring | `load` slowed | Presses landed |
  |---|---|---|
  | on | no | 5 of 5 |
  | on | yes (600ms) | 5 of 5 |
  | **off** | no | 5 of 5 |
  | **off** | **yes** | the *typing* was lost — five edits landed as two |

  Neither condition alone reproduces it; both together do. So the row's own diagnosis was right and
  its proposed fix was not needed: «the canvas not losing its document on every step» would have
  worked, and attaching the listener earlier was enough.

  **This row and the `e2e` flake row above it were one defect seen from two ends**, and nothing said
  so at the time: that one measured a lost *click* in the window, this one a lost *keystroke*. The
  fix for the first closed the second a sprint before anybody looked. The guard is now an `e2e` test
  that types five edits and presses five times with the window held as wide as it will go — and its
  first assertion is that the typing arrived at all, because that is what fails first.
- **An `e2e` flake, observed once and written down rather than waved past.** On 4 October 2026,
  sprint 15 day 7, the full suite failed on **«sprint 14 día 5 — el panel de listas → reorders the
  fichas, and the canvas follows»**. It passed in isolation and passed on the very next full run,
  88 of 88, with nothing changed in between — so it is **intermittent and not a regression**, and
  the day's own changes could not be the cause: they are in `Variants.tsx`'s bank-photograph fetch,
  which does nothing at all while `packages/photobank/bank` holds zero photographs.
  **Measured on 5 October 2026, which is what this row was missing** — though not for this test,
  so it is a candidate cause rather than a diagnosis. CI failed the *sprint-7* gallery reorder the
  same way, and the measurement that came out of it is this: after a section is inserted, its text
  is **visible for about 14 milliseconds before `wireEditing` makes it `contenteditable`**, and a
  click inside that window is lost. Both failing tests are reorders that depend on an earlier edit
  having landed, so a lost edit surfaces as «the order is wrong» three steps later. What is still
  unproven is that this is the cause here: **10× CPU throttling did not reproduce either failure
  locally.** The sprint-7 test now waits for the real signals and asserts each edit where it
  happens, so if it recurs the message will name its own cause; this row's test does not, and
  doing the same to it is the obvious next step if it fails again. Recorded now because a flake
  seen once and not written down is a flake that gets blamed on the next sprint's work — which is
  exactly what happened to the two rows above, and they turned out to be one defect.

- ~~**The fields panel's own `<input>` is not anchored; an edit from it still falls back to the
  diff.**~~ **Built 1 October 2026, sprint 12 day 3.** The capture ADR 0027 §4b describes now runs
  on the panel's box too, through `fieldEditFor` — which is a second measurement rather than a reuse
  of the canvas's, because **`getTargetRanges()` returns an empty list for an `<input>`**: its value
  is not in the DOM, so there are no nodes to measure a range against. What an input reports instead
  is `selectionStart`/`selectionEnd`, already in the document's own coordinates. The two call sites
  share the input-type table and nothing else. Proved in a browser on the exact case the diff was
  measured getting wrong: «pan y pan y aceite» with the second «pan y » deleted **from the panel**,
  and the bold still on the first «pan». *What follows is the row as it stood.* ADR 0027 §4b's `beforeinput` capture lives in the canvas's `wireEditing`; the panel
  commits through the same `setElementText` chokepoint but without ever watching the keystroke
  happen, so a mark on a field edited from the panel moves by `textEditBetween`'s guess — the
  mechanism day 1 measured losing a mark whose own word was never touched. Named in sprint 11
  day 2's own cut line and not built: the panel's `<input>` is a real DOM element with its own
  `selectionStart`/`selectionEnd`, so the capture needs the same range-to-offset arithmetic
  `textEdits.ts` already carries, wired to a different event source. Small, and nobody has
  marked a word from inside the fields panel yet to hit it.
- ~~**A list item's optional slots cannot be reached.**~~ **Built 2 October 2026, sprint 12 days 1
  and 2, closing [#133](https://github.com/dnarram/retorika-builder/issues/133).** It was costed
  here as «either extending `SlotAddress` to name an item, or a second panel; neither is small», and
  it was the first of the two: `SlotAddress` gained an optional line address — the line named by
  its **id**, never its position, because a position read across a `moveItem` or a `removeItem`
  would quietly come to mean a different line. No migration, and that was checked rather than
  assumed: `SlotAddress` is an addressing type and is stored in no document.
  **Exactly two slots were unreachable and they were the only two** — `SERVICES_ITEM_SLOTS` and
  `PRICES_ITEM_SLOTS`, both `description`, both `0..1`. Every other item slot is `min: 1`, so it
  exists in a new line and the canvas already reached it. The panel now lists **every** editable slot
  of every line, which is what `INV_1` asks of a simple view; showing only the two that happened to
  be optional would have been a rule nobody could state. A line's group is headed by its own words —
  «Ensaladilla», not «Línea 7» — derived from the line rather than copied into it.
  *What follows is the row as it stood, kept because its costing is what the work was planned from.*
- **A list item's optional slots cannot be reached.** The fields panel is explicit that "a list
  holds items rather than a value", so its rows are the section's slots and never an item's. A
  card's `description` in «Qué hago» has been `0..1` and unreachable since sprint 1, and a price
  line's is the same. It has not bitten because the questionnaire fills the cards it generates,
  and because a carta line reads perfectly as a name and a price. The fix is either extending
  `SlotAddress` to name an item, or a second panel; neither is small.
- **The three findings of sprint 4 that nobody has acted on**, all of them measured rather than
  supposed, and each one already written up where it belongs:
  - Whether a hostelería owner recognises «Precios» in the menu ([#51](https://github.com/dnarram/retorika-builder/issues/51)). The question is written out, word for word, in [`docs/sessions/guion-tercera-sesion.md`](../sessions/guion-tercera-sesion.md) — and **it still has not been asked.** #51 closed on 28 September saying the search field is what holds the name, and asked for the next session to show the menu and ask; the third session's owner runs a taller, so it could not be put. Two hosteleros out of two asked for «la carta» and neither has been shown the menu. ~~**It needs a hostelería session, not just any session.**~~ **And that is now unsatisfiable, said plainly on 4 October 2026: [ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md) cancelled every session, so this row asks for an instrument that no longer exists.** It is the one row the header's claim about re-pointing all fourteen missed, because what it needs is not a session in general but a *hostelero* — and ADR 0031 names precisely this class of question as what judgement cannot substitute for: it is about what a word means to somebody who is not you. So it stays open with no method, like the other three the ADR lists, rather than being quietly re-pointed at a judgement that cannot answer it.
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
- **Filling a destination by hand is done** (sprint 3, day 4) — and **the code disagreed with this
  line until 4 October 2026, when the sprint-14 planning sweep found the two and read the code to see
  which was right.** `apps/editor/src/app/api/download/route.ts` said «Filling a destination in by
  hand does not exist yet; when it does, this is the rule it has to satisfy». It does exist:
  `FieldsPanel.tsx` draws the box, labelled «A dónde lleva», and routes it through `fillSlot`. The
  rule the comment names is live and the sentence was a sprint behind; the comment is corrected and
  this row stands. Listed here only so that the
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

~~**Declaring phase 1 accepted is direction's, not development's.**~~ **Corrected 4 October 2026: [ADR 0031](../decisions/0031-usability-is-judged-by-david-and-the-sessions-are-cancelled.md) made it David's written judgement**, and the `README` has said so since the day that ADR was signed while this section went on saying the older thing.** Both sessions that produced a
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

### What the first filled sector left open — 8 October 2026

`restaurante-bar` was approved with nine photographs, the first sector with any. Two things were
measured on the way and neither is fixed, both deliberately out of that pull request's one concern.

**1. «At least eight» does not stop the three cards repeating, and that was its stated reason.**
Measured with the nine approved: two of the three variant cards show the same photograph for
**39.4% of business names** (787 of 2000). It is not a bad hash — about 31% is the floor a perfect
one gives with nine — it is that the three cards are three independent hashes of three seeds
rather than one draw without replacement. **A larger bank makes it rarer and never impossible**,
so raising the minimum is not the fix. The fix is for the three to be picked together, which means
`sampleImageFor` growing a way to say "and not these two" — a change to its contract, so it needs
deciding rather than doing. Until then an owner sees the repeat on the one screen where the three
cards sit side by side, which is the worst place for it.

**2. The nine are 1024 × 1024, where ADR 0011 says «longest side 1600 px». Measured, not assumed:**

The clause sits under **Compression**, beside «quality around 75» and «EXIF and XMP removed» — three
things done to make a file smaller. Read that way 1600 is a ceiling and 1024 is under it, so the
images comply with the letter. Nothing checks it in either direction: `imageFieldsSchema` has no
dimension constraint and no test asserts a minimum, so a 400 px image would pass today exactly as
these do.

Where it bites is one variant of the three. `--space-xl` is 48 px, so on a 1440 px window a
section's content box is 1344 px, and `.rb-section img { width: 100% }` fills it:

| Variant | The cover photo spans | A 1024 px source is |
|---|---|---|
| «Con foto grande» (v2) | all 12 columns, ~1344 px | upscaled **1.31×**, and **2.6×** on a 2× display |
| «Clásica» (v1), «Compacta» (v3) | ~6 columns, ~650 px | comfortably enough at 1×, marginal at 2× |

So it is not a general shortfall, it is the one variant the editor itself calls «La más llamativa».
**The decision is direction's, not something to settle in a pull request**: either ADR 0011 gets an
amendment saying 1600 is a ceiling and naming the floor that actually matters, or the sector is
regenerated at 1600 and this stops being a question. Draw Things takes the size as a parameter, so
regenerating is cheap — but the nine approved ones would all have to be re-reviewed.

**3. The owner cannot choose how their own photograph is cropped — 9 October 2026.**

The cover started cropping on that date, because letting the photograph's shape decide the
section's height gave a 3005px cover to anyone who uploaded a portrait phone photo. The crop is
`object-position: center`, written explicitly so the decision is readable rather than implied.

Centre is the right default and the wrong answer often enough to matter: a dish photographed from
above with the plate low in the frame, a shopfront with the sign at the top, a person standing
off-centre. The owner can see the result in the preview and has **no way to say "keep this part"** —
only to upload a different photograph, which is advice rather than a feature. Measured in Chromium
at 1440px with a 1536×2048 phone photo: it loses **43.7% of its height** to the 4/3 crop beside the
text, and **exactly half** to the 3/2 crop at full width.

What it would take: a focal point stored on the image element, which is a schema change (a new
optional field, its migration and round-trip test), plus a way to set it — dragging a point on the
photograph in the «Fotos» panel is the cheapest shape that does not need a cropping UI. Not urgent
while every cover is either a bank photograph framed for the purpose or a photo the owner can
retake, and not something to settle inside a renderer pull request.

**4. The bundle weight budget is 29% over on a real site of that sector, and nothing catches it.**
Measured the same day, building a real restaurante-bar site through `buildSite`:

| | bundle, gzipped | of which the sample |
|---|---|---|
| `restaurante-bar` (bank filled) | **103.3 KB** | 54.8 KB |
| `peluqueria-barberia` (no bank) | 2.7 KB | 0 |

`MAX_BUNDLE_GZIP_BYTES` in `scripts/size-budget.ts` is **80 KB**, and that script's own comment
says sample photographs are "our bytes, not the owner's" — so this is squarely inside what the
budget means to protect. **`pnpm size` passes anyway**, because it measures `fixtures/documents/`
and not one of those seventeen documents carries a `sample` field. The budget is not wrong and the
photographs are not too heavy; the two were simply sized a sprint apart, 80 KB having been chosen
in sprint 11 from a worst case that was fonts and nothing else. What is needed is the same thing
that produced the 80: a measurement, a number chosen from it, and a fixture that actually exercises
a bank photograph so the number means something. **Not a number raised until the test goes
green.**
