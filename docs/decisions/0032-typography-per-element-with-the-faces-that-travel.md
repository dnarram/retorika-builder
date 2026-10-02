# 0032 — Typography per element, with the two faces that already travel

**Status:** **accepted** · **Date:** 2026-10-02 ·
**Decided by:** David, 2 October 2026, planning sprint 13 — given three shapes «tipografías propias»
could take and choosing the narrowest ·
**Accepted by:** **David, 2 October 2026 — not direction** ·
**Touches:** [ADR 0028](0028-typography-needs-a-decision-from-direction.md) (which shipped the faces
and deferred this by name), [ADR 0001](0001-static-published-sites.md) (whose supposed prohibition
was the stated reason for the refusal), [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md)
(the line this sits behind), mockup 17's «lo que no lleva», and document rule 6

> **Signed the day after it was written, and «accepted» means David, not direction** — the same as
> ADRs 0026 through 0031. It went up `proposed` with the day 4 pull request because the decision was
> his and the file was not; he read it and accepted it with the day 5 branch.
>
> **It overturns a refusal direction has not been asked about.** Mockup 17 is an approved drawing and
> the card it struck is struck in direction's own record; what this ADR argues is that the *reason*
> written on that card expired, not that the judgement behind it was wrong. Direction has not looked
> at the argument.

## Context

### The refusal, and the two clauses it rested on

Mockup 17 band 6 draws `Aa` struck through, under «LO QUE NO LLEVA — dibujado también, porque lo que
no se dice se rediseña dentro de tres sprints». Its reason, word for word:

> «La tipografía, entera — ni el `Aa` por elemento ni «tipografías propias». **Incidencia #9**:
> modern-sans y classic-display caen a la fuente del sistema en máquinas sin Inter ni Playfair, **y
> el ADR 0001 prohíbe descargarlas**. Ofrecerla sería prometer una letra que el visitante puede no
> ver nunca.»

Two clauses. **Both were measured false in sprint 11.**

| The clause | What was measured |
|---|---|
| «el ADR 0001 prohíbe descargarlas» | A relative `@font-face` **loads and renders from `file://`** — 385px against 411px with the file missing, in Chrome 154 and Firefox 155 by double-click. The double-click promise survives a shipped face, which is why ADR 0028 could ship them at all |
| «caen a la fuente del sistema» | [#9](https://github.com/dnarram/retorika-builder/issues/9) closed on 1 October 2026. The faces travel in the ZIP with their OFL text beside them, and `buildSite` refuses a bundle with a face and no licence |

**So this is not a change of mind.** The premise that held the refusal up expired, and the refusal
goes with it. The mockup is not edited — it is the record of what sprint 9 decided and of the reason
it decided it, and a dated artefact that gets rewritten stops being evidence of anything.

### What ADR 0028 left for this file

> «Not «tipografías propias». Letting the owner pick a typeface comes after A, never before, and is
> its own decision.»

A shipped on 1 October. This is that decision.

## The decision

### 1. An element may choose between the two families its theme already carries

A fifth style property, `fontFamily`, admitting exactly two references: `font.heading` and
`font.body`. Both are already keys of the closed token namespace, so **no token is invented** — and
both resolve, through the type pair the site is on, to a family the ZIP either ships or degrades
from honestly (ADR 0028's option C).

In the toolbar they are named by what they are for, never by the font: «Titular» and «Texto». That
is the rule the `Estilo` panel has followed since sprint 4 and the one issue #9 imposed — «Typefaces
are named by character, never by font» (`REVIEW.md`).

### 2. There is **no exact value**, and the schema is what says so

`color`, `fontSize`, `padding` and `borderRadius` each admit a reference **or** an exact value marked
as an exception (rule 6, ADR 0026). `fontFamily` admits a reference and nothing else. `EXACT_PATTERNS`
stops being total over `StyleProperty` and `styleValueFor` emits a reference-only union for this one.

**This is the decision written into the type rather than into a rule somebody has to remember.**
An exact family is «tipografías propias» — a name the owner types, a face that does not travel, and
a letter the visitor may never see, which is precisely the promise mockup 17 refused and which this
ADR does not make. With no exact arm there is **no way to express it**, so there is nothing to
enforce later and nothing to forget.

### 3. It sits behind the design-tools switch

Mockup 17 puts typography in «lo que no lleva» rather than in the «Encendido» half, so there is no
drawing to follow and the question is open. It goes behind the switch, with measures and spacing:
ADR 0026 draws that line at «a design choice about one loose element», and choosing a different
family for one heading is exactly that. **An interface decision and reversible in a line**, said so
here rather than presented as a consequence of something.

## What this does not decide

- **«Tipografías propias»**, in its literal sense: a family the owner names. The reason mockup 17
  gave for refusing it has **not** expired — a face nobody ships is a letter the visitor may never
  see — and §2 makes it unexpressible rather than merely unoffered.
- **A third shipped pair.** Shipping another family is ADR 0028's territory and costs bytes in every
  client's ZIP; this costs none, because both families are already there.
- **Mockup 17's other two struck cards.** Alignment and per-element move/duplicate/delete keep their
  own reasons, and those reasons have not expired.

## Consequences

- `SCHEMA_VERSION` 1.6.0 → 1.7.0, migration `0008`, additive: an optional property on an optional
  object, so every stored document is already valid under it.
- The renderer emits `font-family` for an element, through the same rule-6 path and the same
  specificity the browser tests already prove.
- **The type-level half of §2 arrived a day late, and this is the record of it.** `styleValueFor`
  returns `reference | union`, so TypeScript inferred the same broad value type for all five
  properties: an exact family **compiled** while `parse` refused it, which made the sentence «written
  into the type rather than into a rule somebody has to remember» true of the runtime and not of the
  type. The compiler found it on the morning of day 5, on the first line of the editor that read
  `current?.fontFamily?.ref`. A generic `referenceFor` fixes it with no change to any accepted value —
  so no version moves and no migration is owed — and a `@ts-expect-error` in `style.test.ts` now fails
  the build if the arm ever comes back.
- **`STYLE_PROPERTIES` is five, and rule 6's own test asks the question each addition has to answer**
  — whether the new property collides with what rule 7 or rule 4 own. `font-family` collides with
  neither: a breakpoint patch may hide, reorder and resize, and a placement owns columns and rows.
