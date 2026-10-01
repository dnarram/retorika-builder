# 0028 — Typography needs a decision from direction, and this ADR does not make it

**Status:** proposed — **this ADR asks a question; it does not answer one** · **Date:** 2026-10-01 ·
**Touches:** [#9](https://github.com/dnarram/retorika-builder/issues/9),
[ADR 0001](0001-static-published-sites.md) (the static, offline promise),
[ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md) (which deferred this
by name), the advanced dossier §4

> **Why it exists now:** a real business owner asked for it. «Fuente de letra» is one of the seven
> things the third session's owner named wanting and not finding
> (`docs/sessions/2026-09-30-taller.md`). Until then this was a constraint development was
> honouring; now it is a request from outside the team.
>
> **ADR 0026 said this file should exist**, in as many words: «#9 has four costed options and none
> of them is free; **it is direction's and deserves its own ADR**.» This is that ADR, and it keeps
> the promise not to choose.

## Context

### What is declared, and what a visitor actually sees

`packages/tokens/src/typography.ts` declares three type pairs as plain CSS font stacks. There is no
`@font-face` and no web-font loading anywhere in the codebase.

**Re-measured on 1 October 2026** with the font report the accessibility harness has carried since
PR #6, on macOS with neither Inter nor Playfair Display installed:

```
Fonts Chromium renders (darwin):
  editorial-serif  heading: Georgia              body: .SF NS
  modern-sans      heading: .SF NS               body: .SF NS
  classic-display  heading: Georgia              body: Georgia
```

Reproducible on demand:

```
RETORIKA_A11Y=1 pnpm vitest run --project a11y --silent=false -t "reports the font"
```

**This is identical to the measurement in #9**, so nothing has drifted — and the number worth
reading off it is not the fallback itself:

> **On a machine with neither font, two of the three pairs lose the heading/body contrast that
> makes them a pair at all.** `modern-sans` renders heading and body in the same face; so does
> `classic-display`. Only `editorial-serif`, whose stack never asked for a font that might be
> missing, still contrasts.

A visitor on that machine sees two of the owner's three choices as the same decision. Linux — the CI
runner, and some visitors — has neither font either, and its fallback differs again from macOS's and
Windows'.

### Doing nothing is not neutral, and that is the part this ADR adds to #9

Of #9's four options, the third is **accept the fallback and pick type pairs designed to degrade
well**. Half of it has already happened, without being decided:

- The style panel **names typefaces by character and never by font** — «Moderna y neutra», not
  «Inter» — and its `Aa` specimen renders in the real stack, so what the owner is shown is what that
  machine gives. That shipped in sprint 4 and `StylePanel.tsx` records the reason.
- ADR 0026 refused a per-element `Aa` and the §4 column's «tipografías propias» for the same reason.

**What has not happened is the other half of option 3** — *choosing or adding stacks whose fallback
is already acceptable*. So the product is currently living option 3 in its worst version: it has
stopped promising a font, and it has not yet made the three pairs survive not getting one.

**That is why "leave it" is a choice with a cost rather than the absence of one.**

### What the owner asked for is downstream of all four

He asked to **choose a typeface**, which is the dossier §4's «tipografías propias» — not any of the
four options, but a feature that sits on top of whichever one is chosen. It cannot be built first:
offering a font picker while fonts fall back would promise a letterform the visitor may never
receive, which is the shape of promise this product refuses everywhere else. **So his request is
blocked on this decision, not deferred by preference.**

## The four options, with what each costs

Taken from #9, where they were costed, and nothing is added to the list here.

### A. Ship the font files — self-hosted `@font-face`

| | |
|---|---|
| **What the visitor gets** | The letterform the editor showed, on every machine, offline |
| **Weight** | Against a hard budget: `scripts/size-budget.ts` enforces **60 KB gzipped per page** (`MAX_GZIP_BYTES = 60 * 1024`, protocol Part 8.5). A single subset weight of a text face is commonly 15–30 KB; a heading and a body face is most or all of the budget |
| **Licensing** | A question **per typeface**, and the licence has to permit our clients to publish it on their own domains — the same test ADR 0011 applies to a photograph |
| **Where the work lands** | `packages/publisher` puts font files in the ZIP, and `packages/renderer` emits `@font-face` — an exclusive zone that needs a task file first |
| **ADR 0001** | Compatible. The site still opens by double-clicking with no network |

### B. Load from Google Fonts or a similar CDN

| | |
|---|---|
| **What the visitor gets** | The letterform, with a network round-trip, when online |
| **ADR 0001** | **In tension with it.** ADR 0001 forbids the client's site depending on an API of ours; a third party's is the same problem with less recourse. And the double-click-offline promise fails: the page renders in the fallback with no network, which is the state A and C both avoid |
| **Weight** | Nothing in our budget — the cost moves off our ledger rather than disappearing |
| **Other** | Every published client site makes a request to a third party, which is a data-protection question protocol Part 15 would have to answer |

### C. Accept the fallback, and choose pairs that degrade well

| | |
|---|---|
| **What the visitor gets** | A face that was *chosen*, rather than whatever the OS substitutes |
| **Weight** | Zero. Nothing ships |
| **ADR 0001** | Untouched |
| **What it costs** | The editor stops offering «Inter» and «Playfair Display» even aspirationally. The three pairs are re-chosen so that each keeps a heading/body contrast on a machine with no extra fonts — which today two of three do not. It is design work on `TYPE_PAIRS`, plus the golden corpus moving for every fixture |
| **Status** | **Half-done already**, undecided. See above |

### D. Detect and warn in the editor

| | |
|---|---|
| **What the visitor gets** | Nothing. Nothing about the published site changes |
| **What the owner gets** | To be told that the pair they picked will probably look different to most visitors |
| **What it costs** | Interface work, and a warning the owner cannot act on except by picking a different pair — which is option C's answer arrived at one owner at a time |
| **Note** | It is the only option that is **not exclusive** of the others. It could accompany C |

## What this ADR decides

**Nothing about typography.** It decides only that the question is direction's and that it is now
blocking a request from a real owner.

**Three things are true at once and the choice depends on which matters most**, which is exactly the
kind of weighing this file must not do on direction's behalf:

- the weight budget and the offline promise are **ADR 0001**, the constraint everything else rests
  on;
- the licensing question in option A is a cost that recurs per typeface and cannot be undone after
  clients have published;
- and option C is the only one that costs nothing and is the only one that gives up the letterforms.

## What development will do with each answer

Written so the answer is one word rather than a conversation.

| Answer | What happens next |
|---|---|
| **A** | A task file for the renderer and publisher changes, a licence check per face against the budget, and a measurement of what is left of the 60 KB |
| **B** | An amendment to ADR 0001 first, because it is its constraint being relaxed — not a code change |
| **C** | `TYPE_PAIRS` is re-chosen with the font report as the test, the golden corpus moves once and the diff is read in full. The smallest of the four, and the one that unblocks nothing else |
| **D** | Editor-only, no renderer change, and it can be added to C later rather than instead |
| **Not yet** | #9 stays open, this ADR stays `proposed`, and «fuente de letra» stays on the backlog as asked-for-and-refused rather than as unnoticed |

**Whichever it is, «tipografías propias» — letting the owner pick a typeface — comes after**, never
before. That ordering is not negotiable and it is the one thing here that is a development
constraint rather than a preference.

## Consequences

- **#9 stays open** and points here. It closes with whichever option gets built, not with this file.
- **The backlog's #9 row points here** rather than carrying a fourth copy of the four options.
- **ADR 0026's deferral is discharged.** It said typography was direction's and deserved its own
  ADR; it has one. What it does not yet have is an answer.
- **Nothing in the product changes today.** No stack, no renderer branch, no interface.
