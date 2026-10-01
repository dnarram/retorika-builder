# 0028 — Typography: ship the faces, and make the fallback worth falling back to

> **The filename still reads `…-needs-a-decision-from-direction`, and that is deliberate.** This
> file was written to put four costed options in front of somebody and refuse to choose between
> them; it was then asked to choose, and did. The slug is left alone because ADR 0026, the backlog
> and issue #9 all link to it, and a decision that renames itself is a decision somebody loses
> track of. The heading says what the file decides; the filename says what it was for.

**Status:** **accepted — option A, with option C first** · **Date:** 2026-10-01 ·
**Proposed by:** development, at David's request · **Accepted by:** **David, 1 October 2026 —
not direction** ·
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
> of them is free; **it is direction's and deserves its own ADR**.» This is that ADR.
>
> **And then it was asked to choose.** It was written on 1 October 2026 refusing to, on the grounds
> that the weighing was direction's; David asked development the same day to decide it as an expert,
> against the project's own goals. The sections below are the answer, and **the four options and
> their costs are left exactly as they were written before it** — so a reader can see what the
> decision was made from, not only what it concluded.
>
> **Who accepted this, and what that does not mean.** David read it and accepted it himself, the
> same act ADR 0026 records and for the same reason: it leans on **ADR 0001**, a constraint of
> direction's, and it spends bytes on every site a client downloads. **Accepting it is not direction
> agreeing to it** — the header says so, the backlog keeps a row saying so, and an accepted ADR gets
> cited afterwards by people who were not in the room when it was signed.

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

## Three measurements taken before deciding, and one of them contradicts this file

The costs above were written from the issue. Two of them turned out to be wrong in the direction
that matters, which is why they were measured before anything was chosen.

### 1. The weight budget is not where a font file lands

`scripts/size-budget.ts` gzips **the HTML page** — `render(doc, "html").html` — and nothing else.
Measured 1 October 2026 across the whole corpus: **1.6 KB to 2.5 KB per page against a 60 KB
budget.** Ninety-six per cent of it is unused, and a font shipped as a file in `assets/` does not
touch it at all, because the publisher already ships images exactly that way
(`packages/publisher/src/site.ts`: `assets/<basename>`).

**So option A's headline cost — «most or all of the budget» — is only true of the one shape nobody
should build.** Base64-inlining a face into the stylesheet *would* count, and would blow it: woff2
is already compressed, base64 inflates it by a third, and gzip cannot win that back. Shipping the
file is both cheaper and the thing the publisher already does.

### 2. A relative `@font-face` loads from `file://`, and degrades cleanly when it does not

This was the real risk to option A, because ADR 0001's promise is a page that works **opened by
double-clicking**, and fonts are subject to CORS where `file://` is an opaque origin. Measured in
Chromium rather than assumed:

| Page opened from `file://` | Rendered width of the same string |
|---|---|
| `@font-face` → `assets/probe.ttf`, file present | **385px** |
| the same page, file missing | **411px**, one failed request, nothing shown to the reader |

Two different widths is the whole proof: the face loaded and was used, with no server. And the
missing case fell back through the stack with no visible error — which is the behaviour option C
exists to make good, and which **stays necessary under A**.

### 3. A font file is the first `url()` this renderer would ever emit

`packages/renderer/src/escape.ts` allows a theme value exactly these characters —
`A-Za-z0-9 #.,%_-` — and says why in its own words: «call a function — **so no url() and no
network**». That allowlist is not incidental; it is how the renderer guarantees a published page
reaches nobody. Option A needs one `url()` through it.

**That is not a blocker, and it is the most important sentence in this file.** It means A touches
the single most security-sensitive line in the renderer, and the exception has to be written as
narrowly as the rule it dents: **the URL is minted by the publisher from a closed list of font
files, and is never derived from anything in the document.** A theme value stays unable to produce
one.

## Decision

**Option A — ship the font files — with option C's work done first and treated as its foundation.
Option B is refused permanently. Option D is not built.**

### Why A, in one sentence

**Everything else in this product exists to make the published result predictable** — a golden
corpus compared byte for byte, `INV_5`'s determinism, contrast proved at 4.5:1 in every palette, an
overflow check at 320 pixels before a download — **and typography is the one hole left in that.**
The product measures a colour to two decimal places and then ships a page whose letterform is
whatever the visitor happens to have installed. For ADR 0025's professional audience that is not a
rough edge, it is the thing they would notice first; and it is the only answer to what the third
session's owner actually asked for, because «tipografías propias» cannot be offered on top of a
fallback without promising a letterform the visitor may never receive.

### Why C first, and why it is not an alternative

C is **A's safety net, not its competitor.** Measurement 2 shows a missing font file degrades to the
next family in the stack — so the stack still has to be worth falling back to, with the fonts
shipped or not. Today it is not: two of the three pairs lose their heading/body contrast entirely on
a machine without Inter or Playfair Display, which is the measurement this file already carried.

So C is done first because it costs nothing, fixes a defect that exists today, and is the floor A
lands on. **It is half-built already** — the style panel has named pairs by character and never by
font since sprint 4 — and what remains is choosing the three stacks so each keeps a contrast with no
extra fonts at all.

### Why B is refused permanently

It is the only option that contradicts **ADR 0001**, the constraint everything else rests on: every
published client site would make a request to a third party, and the page would render in the
fallback with no network — which is the exact state the double-click promise exists to prevent.
It also hands a permanent external dependency to someone who paid once for a file they own.
**Refusing it needs no amendment to ADR 0001; it is simply on the wrong side of it.**

### Why D is not built

A warning the owner can only act on by choosing a different pair is option C delivered one owner at
a time. Under A it answers a question nobody has: the letterform is the one that was chosen.

### What A ships, and what it does not

- **Latin-subset `woff2` files, in `assets/`, as the publisher already ships images.** Not base64,
  for the reason measurement 1 gives.
- **Only for a pair that names a face the machine may not have.** `editorial-serif` is
  Georgia and `system-ui`; it needs no file and ships none. A site on that pair carries **zero font
  bytes**, which keeps the lightness this product sells.
- **`font-display: swap`**, so text is readable before the face arrives and the first paint is never
  blocked.
- **A licence read per face, with the date recorded**, exactly as ADR 0011 requires of a photograph
  and for the same reason: our clients publish it on their own domains, so a licence covering only
  Retorika's use fails the test however generous it looks. Inter and Playfair Display are the
  obvious candidates and are believed to be under the SIL Open Font License, which permits
  precisely that — **believed, not verified here.** Reading the licence text at the exact version
  shipped, and recording the date, is part of the work rather than a formality.
- **Not** «tipografías propias». Letting the owner pick a typeface comes after A, never before, and
  is its own decision.

## What development does next

| Step | What it is |
|---|---|
| **1. C** | `TYPE_PAIRS` re-chosen so each pair keeps a heading/body contrast with no extra fonts, with the harness's own font report as the test. The golden corpus moves once and the diff is read in full. Small, and it stands on its own if A is ever reversed |
| **2. A** | A task file first — it touches `packages/renderer` and `packages/publisher`, both exclusive zones. The `url()` exception of measurement 3 is written and tested before a byte is shipped, and `pnpm size` gains a second number: the bundle, beside the page |
| **3. #9** | Closes with A, not with this file |

## Consequences

- **#9 stays open** and points here until A ships.
- **ADR 0026's deferral is discharged**, and now answered rather than only acknowledged.
- **`scripts/renderer-deps.ts` is untouched.** A font is an asset, not a dependency.
- **Nothing in the product changes on the day this is accepted.** The first thing that changes is
  three font stacks, which is step 1.

## What would reopen this

- **A licence that does not permit a client to publish the face.** Then that pair ships no file and
  falls back to its step-1 stack, which is why step 1 comes first.
- **A measured first-paint cost that `font-display: swap` does not cover**, on a real phone rather
  than a laptop.
- **Someone asking for a face we cannot ship** — the moment «tipografías propias» becomes a real
  request rather than a line in a dossier, this decision is its foundation and may need widening.
