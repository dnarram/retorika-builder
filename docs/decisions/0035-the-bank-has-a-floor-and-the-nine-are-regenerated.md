# 0035 — The bank's photographs have a floor, and the nine are regenerated at 1600 × 1072

**Status:** **accepted** · **Date:** 2026-10-09 ·
**Decided by:** David, 9 October 2026, approving the sprint 16 plan — «el ADR 0035 recoge mi
decisión de regenerar las nueve a 1600 × 1072. Si mantiene una exención para las actuales, debe
decir cuándo caduca» ·
**Amends:** [ADR 0011](0011-sample-photos-per-sector.md) § Compression

## Context

ADR 0011's **Compression** clause reads, in full:

> **WebP, longest side 1600 px, quality around 75,** with EXIF and XMP removed. The origin is in
> the record, not in the file.

It sits beside «quality around 75» and «EXIF and XMP removed» — three things done to make a file
smaller — so «1600 px» reads as a ceiling. `restaurante-bar` was approved on 8 October 2026 with
nine photographs: eight at 1024 × 1024 and `restaurante-bar.07` at 866 × 942, which is the one
record whose pixels are not its original frame (82 px off the top and 158 off the right removed a
legible sign). Under that reading they comply.

**Nothing checks the clause in either direction.** `imageFieldsSchema` in
`packages/photobank/src/schema.ts` constrains `width` and `height` to be positive integers and
nothing else, so a 400 px photograph would have passed review exactly as these nine did.

### What the cover actually asks of a photograph, measured

The cover crops to a declared ratio since 9 October 2026 (`packages/renderer/src/build.ts`):
`4 / 3` beside the words and `3 / 2` at full width, with `object-fit: cover`. A source `w × h`
drawn into a box `W × H` under `cover` is scaled by `max(W/w, H/h)`, so it is upscaled unless
`w ≥ W` **and** `h ≥ H`.

**The published page has no maximum width, and that is the fact that turns this into a decision
rather than a calculation.** `body` carries `margin: 0` and nothing caps it; `.rb-section` is
`grid-template-columns: repeat(12, 1fr)` with `padding: var(--space-xl)`. So the full-width cover
image spans the viewport less twice `space.xl` — 48 px on the default scale — without bound:

| Window | Full-width cover box | A 1600 px source is |
|---|---|---|
| 1440 px | 1344 × 896 | not upscaled |
| 1920 px | 1824 × 1216 | upscaled **1.14×** |
| 2560 px | 2464 × 1643 | upscaled **1.54×** |

Beside the words the image spans six of twelve columns: 664 × 498 at a 1440 px window, which every
candidate clears comfortably. **The full-width composition is the only one that binds**, and it is
the one the editor itself calls «La más llamativa».

So **no finite floor stops a photograph being upscaled on every screen**. A floor is a choice of
reference width, and choosing it is what this ADR does. The backlog's row (8 October) measured the
consequence at 1440: a 1024 px source upscaled 1.31×, and 2.6× on a 2× display; `.07`, 1.55× and
3.1×.

## Decision — David's

- **The nine photographs of `restaurante-bar` are regenerated at 1600 × 1072.** They re-enter
  through ADR 0011's own circuit, unchanged: a record in `drafts/`, a person's review against the
  reviewer's list, and the `git mv` that *is* the review. The nine now in `bank/` stay published
  until the new ones are signed, because a sector holds zero photographs or at least eight and
  emptying it would put the grey marker back on every restaurante-bar site in between.
- **1600 px stays the ceiling**, for the reason ADR 0011 gave: weight in the client's ZIP.
- **The floor is 1344 × 896**, the full-width cover box at a 1440 px window on the default scale.
  Both numbers are required, not just the longest side: the box is always landscape, so a tall
  photograph can clear 1344 on its height and still be stretched sideways.
- **The schema enforces the floor**, and the nine as they stand are exempt **by id**.
- ~~**The exemption expires on 31 October 2026.** After that date `packages/photobank`'s tests fail
  while any exempt record is still in the bank.~~ **Struck on 23 October 2026 by the amendment
  below**, David's decision: the exemption **fails from 1 December 2026**. That is the one form the
  date is written in from here on — the first day the test is red, the same number the code carries —
  and `packages/photobank`'s tests still fail from it while any exempt record is in the bank.

1072 is David's number. It is 3:2 to within half a percent — exact 3:2 at 1600 is 1066.67, which
ADR 0011's own example record rounded to 1067 — and it clears the floor's height by 176 px. What
the shape buys, computed from `max(W/w, H/h)` against the two boxes at a 1440 px window:

| Source | Full width (1344 × 896) | Beside the words (664 × 498) |
|---|---|---|
| 1024 × 1024, the nine today | upscaled 1.31×, **a third of the height cropped** | **a quarter of the height cropped** |
| 1600 × 1072, regenerated | not upscaled, 0.5% of the height cropped | about **11% of the width** cropped |

So the square loses a third of the photograph at the one composition that shows it largest, and 3:2
loses almost nothing there and trades a quarter of its height for a tenth of its width beside the
text. Which part is lost is still `object-position: center`'s to decide, and still not the owner's;
that is a separate open item in `docs/tasks/backlog.md`.

## Why the exemption carries a date, and what that date costs

An exemption with no date is a note asking somebody to come back. **This repository has now caught
itself failing at exactly that six times** — `INV_4`, the `e2e` job, the README's section count,
mockup 18, ADR 0030 and 0032, and the photo bank's own «the bank is empty» in fourteen places — and
every one of them was found by a person re-reading the record against the code, never by the record.
Nothing in CI reads prose.

So the deadline is a test, and the cost is named rather than discovered: **on the date above that
test goes red on whatever pull request happens to be open**, which may have nothing to do with the
bank. That is what a deadline that enforces itself does. The remedy is to regenerate the nine, never
to move the date; if the date moves, it moves because David says so, and this ADR records who and
when.

**The clock stays out of the parse.** The floor and the exempt ids are a refinement in
`schema.ts`, which has no notion of today — `src/index.ts` parses all eleven sector files at module
load, inside a generator that `INV_5` and the golden corpus require to be a pure function of its
arguments. A date-dependent parse would make a generated site depend on when it was generated. The
expiry therefore lives in `bank.test.ts`, the one place that can fail loudly without changing what
the product produces.

## Consequences

- `packages/photobank/src/schema.ts` gains `MIN_COVER_WIDTH`, `MIN_COVER_HEIGHT`, the frozen list of
  exempt ids and the date the exemption stops being accepted. A new record under the floor
  cannot be approved. (This clause said `EXEMPTION_EXPIRES`; the constant shipped as
  `FLOOR_EXEMPTION_FAILS_FROM`, and a reader who grepped for the name in this ADR found
  nothing. Corrected 23 October 2026.)
- `bank.test.ts` gains three guards: the floor refuses an undersized record, accepts 1600 × 1072,
  and the exemption is either gone or still inside its window.
- Regenerating is content production, not code: it is David generating in Draw Things and reviewing,
  and it is **not** part of sprint 16's seven days. What sprint 16 owes it is the floor, the
  exemption and the deadline.
- The `alt` of each regenerated photograph is written again, because it describes a frame that
  changed. ADR 0011 makes `alt` a reviewed text.
- The licence record is re-read for the regenerated batch (`licence.checked`), since the terms may
  have changed and the point of that field is the version we relied on.

## What this does not decide

- **Whether the reference width should be 1440.** A floor at 1920 (1824 × 1216) would mean 1824 px
  files, over ADR 0011's own ceiling, so the two clauses would contradict each other and the weight
  argument would have to be reopened. Not today.
- **Whether the published page should have a maximum width at all.** The table above is an argument
  for one, and it is a design decision about every section, not about photographs. It goes to
  `docs/tasks/backlog.md`.
- **Which photograph each of the three cards shows.** That is ADR 0011's other unmet promise and has
  its own ADR, [0036](0036-the-three-cards-pick-their-photographs-together.md).

## Amendment — the reserve date, and one form for writing it (23 October 2026, David's decision)

> **Enmienda al ADR 0035, decidida por David el 23 de octubre de 2026** al planificar el sprint 27,
> puesta delante como «las nueve antes del 1 de noviembre, o la enmienda con fecha nueva»:
>
> > «Prepara en el día 1 una PR aparte que enmiende el ADR 0035 y mueva
> > `FLOOR_EXEMPTION_FAILS_FROM` al 1 de diciembre, con la razón escrita, y déjala abierta y en
> > verde sin fusionar. Si el 30 de octubre las nueve no están aprobadas con `photos:approve`, la
> > fusiono yo y el CI no se pone rojo el 1. Si están, se cierra sin fusionar.»
>
> Y, sobre cómo se escribe la fecha: «el ADR dice "falla desde el 1 de diciembre" y el código lleva
> `"2026-12-01"`, **para que nadie vuelva a leer dos fechas distintas**.»

**This amendment is a reserve, and it is live only if it was merged.** It was written on sprint 27
día 1 and left as an open, green pull request. David's hand on 30 October 2026 decides: if the nine
regenerated photographs are not approved by then he merges it, and the exemption fails from
1 December instead of 1 November; if they are approved he closes it unmerged, and the date above
never moved. Development does not merge it and does not decide it, which is the clause the original
decision already carried — «if the date moves, it moves because David says so».

**What changes, and nothing else.** `FLOOR_EXEMPTION_FAILS_FROM` goes from `"2026-11-01"` to
`"2026-12-01"`. The floor (1344 × 896), the ceiling (1600), the nine exempt ids and the remedy are
untouched: **the remedy is still to regenerate, never to move the date.** Moving it buys the content
production four weeks and costs four weeks of 1024 px covers on every `restaurante-bar` site, which
is the trade the original decision named.

**One date, in one form, in eleven places.** The record held the same instant in two shapes — «the
exemption expires on 31 October» in this ADR's decision and in ADR 0011's amended Compression
clause, «fails from 1 November» in this ADR's cost paragraph, in the constant, in `bank.test.ts`'s
own comment, in `packages/photobank/README.md`, in ADR 0039, in two rows of `docs/tasks/backlog.md`
and in the two task files written for David. Both were correct and a reader had to do the
arithmetic to see it. From here the date is written **as the first day the test is red**, the same
form the constant uses, and this amendment moved all of them at once. The date is also the only
thing those eleven places say about the exemption that a test can check, so it is the only one worth
keeping identical.

**And one name corrected.** This ADR's Consequences promised a constant called `EXEMPTION_EXPIRES`.
What shipped on 9 October was `FLOOR_EXEMPTION_FAILS_FROM`, in `packages/photobank/src/schema.ts`.
Nobody noticed for a fortnight, which is the seventh instance of the thing the paragraph above the
Consequences counts six of.
