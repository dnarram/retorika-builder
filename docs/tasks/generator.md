# The generator: five answers → a real document

> **Claude-only. Exclusive zone.** `packages/generator`, and the small extension to
> `apps/editor/src/questionnaire` it needed. Not delegated to OpenCode.

Day 3 of the CEO's seven-day sprint (ADR 0017), second half — the first half was
`packages/copybank`. Turns the questionnaire's five answers into a `RetorikaDocument`, using the
existing catalog, the text bank, and nothing else: no call to an AI at generation time (ADR
0009), no filesystem access (the placeholder image is inlined).

## What it builds

`generate(answers, variant)` returns `{ document, assets }`, validated through `parseDocument`
before it is returned. Four sections, each generated only when the answers actually support it:

- **`cover`** always exists. `headline` and `image` are its only required slots, and both always
  resolve — the business name is required by question 1, the image is a placeholder.
- **`services`** exists only when question 3 has at least one service, ticked or typed. Zero
  means no section, not an empty one (ADR 0013).
- **`location`** exists only when question 4 was answered and "no tengo local" was not ticked.
- **`contact`** exists only when the chosen main action resolves to a real destination.
  `primaryAction` is required there (1..1); a section with a button pointing nowhere is never
  generated.

`generateVariants(answers)` runs the three compositions `docs/design/prototype/` already used
and the CEO approved — the same content, three real layouts.

## Three gaps found while building it, decided before writing code

The questionnaire (day 2) did not collect enough to resolve every action, or to fill every slot
the catalog declares. Raised with the product owner before any of this was written:

1. **"Que me llamen" / "que me escriban" / "que me manden un correo" had no destination.** The
   questionnaire never asked for a phone, a WhatsApp number or an email. **Decided:** question 5
   now reveals the matching field when one of these is chosen, the same pattern it already used
   for the booking link — see the commit that extends `Step5Action.tsx`. Required to submit.
2. **"Que vengan al local" has nowhere to point.** The published HTML carries no real `id` on a
   section, only `data-section`, which an in-page anchor cannot jump to — building real anchors
   rewrites every golden's `<body>`, the same class of change as issue #19, deferred past the
   usability sessions. **Decided:** no link is built for this action. The cover's button is
   simply absent (optional there), and no contact section is generated (its button is required).
3. **The `map` slot needs coordinates question 4 never asks for.** It only collects a free-text
   address. **Decided:** the slot is left unfilled — optional in the catalog (0..1) — rather than
   geocoded. The same shape as ADR 0004's other half, still pending a tile provider.

## Smaller gaps, decided without another round of questions

Lower-stakes, each with a safe default and a comment where it lives in the code:

- **`{ciudad}` is never filled.** Question 4 collects one address, never a separate city.
  `factsFor()` leaves it undefined always; every text falls back to its city-less sibling, which
  ADR 0009 already requires to exist. Safe by construction, not a guess.
- **The sector → palette/type-pair table (`theme.ts`) had no source anywhere.** ADR 0010 says
  "sin logo, la paleta del sector" but never said which. A first-pass lookup table, not a
  decision with its own ADR — changeable by editing a row.
- **No photo the client uploads or the sector implies is ever used.** `packages/photobank` does
  not exist (ADR 0011 needs real, reviewed photos). The cover's image is always the same inline
  placeholder the usability prototype already used, labelled honestly.
- **The logo a business uploads is captured, never analysed.** Colour extraction from an image is
  real work this sprint does not include; every generation uses the sector default regardless.

## Files

    packages/generator/
      src/answers.ts          moved from apps/editor: the input contract, since a package
                               cannot depend on an app
      src/theme.ts             the sector → palette/type-pair table
      src/variants.ts           the three approved compositions
      src/destination.ts        question 5's answer → an href, or nothing
      src/placeholder-image.ts   the inline placeholder asset
      src/sections.ts            the four section builders
      src/index.ts               generate(), generateVariants()
      test/generate.test.ts
      README.md                  the gaps above, in one place
    apps/editor/src/questionnaire/steps/Step5Action.tsx   (extended: phone/WhatsApp/email fields)
    apps/editor/src/questionnaire/Review.tsx              (shows the new fields)
    apps/editor/src/locales/es.json                        (the new field strings)

`apps/editor/src/questionnaire/types.ts` no longer exists: every step now imports `Answers` from
`@retorika/generator`.

## Verification

- Every generated section checked against its own preset with `checkAgainstPreset`, not just the
  schema — proven in `generate.test.ts`, not assumed.
- No generated text ever carries an unfilled `{placeholder}`, walked across sections.
- Each of the five actions produces the right `href` (`tel:`, the pasted link, `https://wa.me/…`,
  `mailto:`), and the two "no destination" cases (`visit`, an empty field) produce no button and
  no contact section, not a broken one.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (432/432), `pnpm test:golden` (13/13, untouched),
  `pnpm renderer:deps`, `pnpm schema:guard` all green.
- Manual: a document generated end to end for a Taberna Santo Domingo-shaped answer set, rendered
  with the real renderer, screenshotted in three variants — real composition differences, correct
  sector palette and type pair, the bank's texts, the secondary phone link under "book".

## Definition of done

Absent when this file was written — it was drafted as an after-the-fact record of a sprint day
rather than as a task asked for in advance, and the protocol's own template (Part 11.1) requires
the section regardless. Filled in 26 September 2026 from the Verification section above, which is
the evidence; nothing here is ticked on the strength of memory.

- [x] New tests that failed before and pass now — `packages/generator/test/generate.test.ts`,
      including `checkAgainstPreset` on every generated section and the two "no destination" cases
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` green
- [x] `pnpm test:invariants` green — re-confirmed on `main` on the date above
- [x] If the published output changed: golden regenerated and the diff reviewed — **it did not
      change.** The generator writes documents, not markup; the corpus stayed at 13/13 untouched,
      which is the outcome this task wanted rather than an exemption from the rule
- [x] If the schema changed: migration and round-trip test — **the schema did not change.**
      `packages/schema` was not touched by this task
- [x] Interface text in Spanish and in the translation file — the new question 5 fields are in
      `apps/editor/src/locales/es.json`, none inline in a `.tsx`
- [x] No keys and no real client data in the code — `pre-commit run gitleaks --all-files` passes
      repo-wide

## Not in this task

- Wiring `generate()` into the questionnaire's UI — the "elige por dónde empezar" screen with
  real previews is day 4.
- `packages/photobank`, real geocoding, section anchors, logo colour extraction. Each is a gap
  this task found and recorded, not one it closes.
