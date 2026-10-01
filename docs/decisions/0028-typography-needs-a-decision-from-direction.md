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

> **Corrected 1 October 2026, while building option C: that sentence is too strong, and the
> correction changed what C had to do.** Heading and body also differ by **weight and size** —
> measured in Chromium, `h1` computes to **700** against the body's **400**, at **2.5×** the size,
> because `build.ts` sets no `font-weight` and the heading keeps the browser's bold. No absent font
> can take either away, so a visitor never sees one undifferentiated block and the pair never stops
> reading as a pair.
>
> What the third row really loses is the **character** the owner chose, which is narrower and is the
> complaint worth fixing. The distinction matters because it changes the answer for `modern-sans`:
> «moderna y neutra» setting one family and separating by weight is **a legitimate design**, not a
> defect, and the fix below leaves it alone on purpose.

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
| **1. C** | **Done 1 October 2026 — see "Option C, as built" below.** `TYPE_PAIRS` re-chosen so each pair keeps a heading/body contrast with no extra fonts, with the harness's own font report as the test. The golden corpus moves once and the diff is read in full. Small, and it stands on its own if A is ever reversed |
| **2. A** | **Done 1 October 2026 — see "The `url()` exception, as built" and "The faces in the ZIP".** A task file first — it touches `packages/renderer` and `packages/publisher`, both exclusive zones. The `url()` exception of measurement 3 is written and tested before a byte is shipped, and `pnpm size` gains a second number: the bundle, beside the page |
| **3. #9** | **Closed 1 October 2026, with A.** Not with this file: the decision was never the deliverable |

## Option C, as built — 1 October 2026

**Not «fix two pairs». Each pair now declares *how* it survives getting no font**, as a field on the
pair itself (`FontContrast`), because the three survive in three different ways and each way breaks
differently. A test holds each one still, which is what stops a pair sliding from one kind to another
the way `classic-display` did without anyone deciding it should.

| | kind | what keeps heading apart from body | changed? |
|---|---|---|---|
| `editorial-serif` | **`generic`** | the stacks end in **different generic keywords**, so a serif against a sans survives even where no named family exists | no — it was already the only one that degraded well |
| `modern-sans` | **`weightAndSize`** | **one family on purpose**, separated by the 700 weight and the 2.5× size | no — and that is the decision, not the absence of one |
| `classic-display` | **`named`** | a display serif over a text serif, with **distinct fallback chains** | **yes** — it was the one that genuinely lost everything |

**Why `modern-sans` is left alone.** Forcing a family contrast was considered and refused: adding
`'Helvetica Neue', Arial` after Inter would give macOS a Helvetica heading over an SF body, Windows one
family for both, and Linux something else again — a difference *between platforms* bought for a design
distinction nobody asked for, and less neutral than «moderna y neutra» promises.

**Why `classic-display` changed, and how the faces were chosen.** Candidate families were measured on
this machine rather than assumed, with the same `CSS.getPlatformFontsForNode` the harness uses:

```
  present on macOS : Didot, Big Caslon, Baskerville, Hoefler Text, Palatino, Charter,
                     Iowan Old Style, Georgia, Times New Roman
  absent on macOS  : Playfair Display, Bodoni MT, Palatino Linotype, Book Antiqua,
                     Constantia, Cambria, Garamond
```

So the heading keeps Playfair first and then names faces that stand in for its didone character, and
the body names a text serif that is **not** the heading's next fallback. The result, measured through
the harness after the change:

```
Fonts Chromium renders (darwin):
  editorial-serif  heading: Georgia   body: .SF NS    [generic]       different faces, weight 700/400, size 40/16px
  modern-sans      heading: .SF NS    body: .SF NS    [weightAndSize] SAME face,       weight 700/400, size 40/16px
  classic-display  heading: Didot     body: Charter   [named]         different faces, weight 700/400, size 40/16px
```

`classic-display` was `Georgia / Georgia` before this change.

### What the test asserts, and what it deliberately does not

The font report now asserts **the weight and size contrast for every pair** — a property of `build.ts`
and the scale, true on every platform — and **that a `generic` pair resolves two different faces**,
which cannot fail for want of an installed font.

**A `named` pair is reported and not asserted.** Its contrast depends on which of the faces it names
the machine has, and that is not ours to guarantee: asserting it would turn a CI runner's font set into
a red build and teach the next person to loosen the check rather than read it. **Best-effort is what
`named` means**, and pretending a stack can promise more would be the dishonest half of option C.

### Windows is not measured, and here is the procedure for measuring it

macOS is measured locally and Linux by the CI runner. **Windows is neither, and it is the platform most
of a neighbourhood site's visitors use.** So this is a procedure rather than a note asking somebody to
remember:

1. Open **`fixtures/font-check.html`** by double-clicking it. No server, no install — the same promise
   ADR 0001 makes of a published site, and a test enforces that the page needs nothing but itself.
2. It draws the same sentence in all three pairs with their exact stacks, and reports **which letter
   each one actually used** — by measuring the text's width with each family alone against a control
   family that cannot exist, which is what tells "declared" from "used".
3. Copy the dark block at the foot and send it.

> **Less urgent since option A shipped, and still worth doing.** With the faces in the ZIP, a visitor on
> `modern-sans` or `classic-display` gets the letterform whatever their machine has. What the hand check
> still answers is the **fallback**: `editorial-serif` ships no file by design, and any visitor whose
> browser blocks or fails a font download sees the stack. So the question changed from «is the site
> readable» to «is the floor sound on the platform most visitors use», which is a smaller question and
> not a closed one.

**Cross-checked before being trusted.** On this machine the page's width measurement agrees exactly
with the harness's CDP measurement, in both Chromium 153 and Firefox 155 — `Georgia/system-ui`,
`system-ui/system-ui`, `Didot/Charter`. Two independent techniques agreeing where both can be run is
what makes the one number only the page can give worth having.

| platform | measured | `editorial-serif` | `modern-sans` | `classic-display` |
|---|---|---|---|---|
| macOS 26 (Chromium 153, Firefox 155) | **yes**, 1 Oct 2026 | Georgia / .SF NS ✅ | .SF NS / .SF NS ⬛ | **Didot / Charter** ✅ |
| Linux (CI runner, Chromium 153) | **yes**, 1 Oct 2026 | Liberation Serif / DejaVu Sans ✅ | DejaVu Sans / DejaVu Sans ⬛ | **Liberation Serif / Liberation Serif ❌** |
| **Windows** | **no** | — | — | — |

✅ two faces · ⬛ one face by design · ❌ one face where two were wanted

> **Linux collapses `classic-display`, exactly as `named` predicts, and that is the row worth keeping.**
> The CI runner has none of Didot, Bodoni MT, Big Caslon, Charter, Iowan Old Style, Palatino, Palatino
> Linotype or Georgia, so both stacks reach their `serif` keyword and land on Liberation Serif
> together. **This is the measurement that would have been hidden by asserting the `named` contrast**:
> the build would have gone red for a property of the runner's font set, and the honest reading —
> *option C raises the floor on the platforms that have the faces and cannot raise it where none
> exist* — would have been replaced by a loosened check.
>
> It is also the sharpest argument for A that this file has. On Linux, `classic-display` without font
> files is one serif at two sizes **whatever stack is chosen**, and no amount of option C fixes that.
> Shipping the face does.
>
> **Every pair keeps its 700/400 weight and its 40/16px size on both platforms**, which is the part
> that holds everywhere and the reason no visitor sees an undifferentiated block.

### Two consequences of changing a stack, both recorded rather than fixed

- **A site built before today keeps the letters it was built with.** A document stores its theme as
  resolved strings, so changing `TYPE_PAIRS` cannot reach one that already exists — and
  `identifyTypePair` matches on those exact strings, so the style panel will say «Ahora mismo tu web
  usa una letra que no está en esta lista. Elige una para cambiarla.» That sentence is **true**, and
  picking the pair again fixes it. No migration: the theme is free strings, the document still
  validates, and nothing is lost.
- **The golden corpus did not move on its own, which the plan expected it to.** Same reason: its
  fixtures are documents with their themes already baked, so a token change is invisible to them. That
  is good for stability and it left **nothing in the corpus exercising the new stacks**, so
  `fixtures/documents/menu-y-paginas.json` was moved to them deliberately. The diff is two CSS custom
  property lines and nothing else.

## The `url()` exception, as built — 1 October 2026

Measurement 3 of this file said a font file would be the first `url()` this renderer ever emits,
through an allowlist whose own comment promises «no `url()` and no network». Here is the exception, and
it is as narrow as the rule it dents.

**`cssThemeValue` is untouched.** Its two call sites and the tests that pin them are exactly as they
were; the sentence in its comment is still true of it. The exception is two new functions beside it,
each accepting a short closed vocabulary.

**Three properties, and each was verified by breaking it:**

1. **The caller cannot choose the directory.** `fonts/` is written inside `cssFontSrc`, not passed to
   it, so the only `url()` this renderer can produce anywhere points inside the folder the publisher
   writes. *Broken on purpose: 5 tests failed.*
2. **The file name must end in `.woff2`**, lower case, hyphens only. That one pattern refuses `../`, an
   absolute path, a protocol, a second extension and a query string. *Broken: 7 tests failed.*
3. **The values never come from the document.** `fonts.ts` holds a closed table of family and file
   names; a theme **selects** a row by exact equality and can never **name** one. *Loosening the match
   to a substring: 2 failed. Emitting the document's value as the family: 20 failed. Bypassing the
   escape function: 3 failed.*

> **One property has no direct test, and the reason is the guarantee rather than a gap.** Because
> matching is exact equality, a matched row's family string and the document's family string **are the
> same string** — so "which of the two is emitted" cannot change a byte. Sabotage confirmed it: swapping
> them broke nothing, exactly as the argument predicts. What the tests cover is every way that argument
> could stop holding, and each of those fails loudly. `fonts.test.ts` carries this reasoning so the next
> reader finds it instead of concluding there is no test.

**A document that names no shippable family emits nothing**, which is what keeps «a site that needs no
font carries zero font bytes» true rather than claimed. Fourteen of the fifteen corpus documents are on
`editorial-serif`; only the `classic-display` fixture asks for a face at all.

**The rules cost 141 bytes gzipped**, measured while wired: that fixture went from 2644 to 2785 bytes,
**4% of the 60 KB page budget**, for two faces. The *files* are not in that number and are the
publisher's measurement.

### The rules waited a day for `buildCss`, and the reason is a test that caught it

**Wiring them one day before the publisher ships the bytes breaks the promise this product is.** With
`fontFaceCss` spread into `buildCss`, five of the twenty-nine critical flows went red on an assertion
that has been there since sprint 3 and says exactly the right thing:

```
every byte the page needed was actually inside the ZIP
```

Those flows download a real ZIP, extract it to disk, open `index.html` from `file://` and require that
**no request fails**. A stylesheet naming two files the ZIP does not contain fails two of them. That is
not a test being fussy — it is ADR 0001 being enforced, and the ZIP is the thing the owner paid for.

**So the exception, the table and all sixty-one tests landed first, and the two lines that connect them
landed the next day with the publisher.** For one day `fontFaceCss` and `fontFilesFor` were complete,
tested and uncalled; published bytes were byte-for-byte what they had been and the golden corpus did not
move. Both halves are now in, and that same assertion is what proves the ZIP is whole.

> **The alternative was to relax that assertion, and it is worth recording that it was refused** — one
> paragraph above, this same file argues that asserting a `named` pair's contrast would «teach the next
> person to loosen the check rather than read it». Loosening a self-containment check to let a
> half-finished feature through is the same mistake with higher stakes.

**What was measured while it was wired, and is kept because it is what the wiring will do:** the golden
diff was sixteen lines in one fixture and nothing anywhere else, and the browser results below.

**Measured in a real browser, with the emitted CSS rather than a hand-written probe** — Chromium 153
and Firefox 155, page opened by double-click as `file://`:

| | faces registered | `h1` drawn in | heading width |
|---|---|---|---|
| no files present | both `error` | the fallback (Didot) | 459.48px |
| files present | both `loaded` | **the shipped face** | 465.47px / 465.42px |

The width is the engine-independent half: CDP's platform-font report is Chromium-only, so the
heading's own rendered width is what proves the face is *used* and not merely declared.

> **The first row is why the wiring waits, and it is also reassuring.** A page whose files are missing
> registers both faces as `error`, fails two sub-resource requests, **and renders exactly as it does
> today** — the heading falls back to Didot, no script error, nothing visibly wrong, because
> `font-display: swap` and the fallback chain are doing their jobs. So the failure mode is a ZIP with two
> dead references and a page that looks right: invisible to the owner, which is precisely why it must not
> ship for a day and why the e2e's refusal to allow it is the correct answer rather than an obstacle.

## The faces in the ZIP — 1 October 2026

**Option A is complete: a published site carries the letterform the editor showed, offline, with no
third party.** Measured end to end by posting to the real download route and unzipping what came back:

```
Archive:  site.zip                                  54,729 bytes
     6483  donde-estamos.html
     4630  fonts/OFL-PlayfairDisplay.txt
    21856  fonts/playfair-display-latin-400-normal.woff2
    23224  fonts/playfair-display-latin-700-normal.woff2
     9716  index.html
     6971  que-ponemos.html
       23  robots.txt
```

Extracted and opened by double-click in **Chromium 153 and Firefox 155**: all three pages register both
faces as `loaded`, **no request fails**, and the licence is in the folder beside them. A site on
`editorial-serif` carries no `fonts/` directory at all.

### The three conditions, and what each one turned out to mean

**1. Only the weights the pairs use, and only the latin subset.** Both weights, and that is measured
rather than chosen: `--font-heading` is used by `h1`, `h2` and `h3` — heading tags, so **700** by the
browser's own default — and by `p.rb-subtitle`, the cover's tagline, which is a `<p>` and therefore
**400**. Ship only 700 and every tagline renders bold; ship only 400 and every heading is a synthetic
bold. The subset is `latin`, never `latin-ext`, `cyrillic`, `greek` or `vietnamese`, and never an
italic — no rule in `build.ts` can ask for one.

**And the resulting size is checked against a budget, because nothing measured it before.** `pnpm size`
now reports two numbers per fixture:

| | page | bundle | fonts |
|---|---|---|---|
| a site on `editorial-serif` | 1.6–2.0 KB | **1.8–2.5 KB** | none |
| the site on `classic-display` | 2.7 KB | **52.7 KB** | 45.9 KB |

The budget is **80 KB gzipped per bundle**, about 1.5× the measured worst case — loose enough not to
fail on a rounding, tight enough that a third family cannot arrive unseen. It measures our bytes and
not the owner's: a real site with six photographs can exceed any number there, and should.

**2. A face never travels without its licence.** `fonts/OFL-Inter.txt` and
`fonts/OFL-PlayfairDisplay.txt`, derived from the faces rather than listed, so no caller can ask for one
and forget the other — and `buildSite` **refuses to build** a bundle with a `woff2` and no licence
beside it. Both licences were read at the pinned version, `@fontsource` **5.2.8**, on 1 October 2026:
both are the **SIL Open Font License 1.1**.

> **Inter declares no Reserved Font Name. Playfair Display declares one: «Playfair Display».**
>
> That is the answer to the question this sprint's plan asked for, and it turns out to decide condition
> 3 rather than being a footnote to it. The OFL §3 forbids using a Reserved Font Name for a **Modified
> Version** — so the moment we subset or re-encode Playfair Display, we would have to ship it under a
> different family name, and rename it in the renderer's table, in the three type-pair stacks, and in
> the editor's own specimen. **Shipping the file untouched is both the cheap path and the compliant
> one**, which is a pleasant thing to be able to say and a poor thing to leave unverified.

**3. The `woff2` travel exactly as `@fontsource` ships them.** The package already splits every face by
subset and weight, so choosing the latin file of a weight the stylesheet asks for **is** using it as it
comes — conditions 1 and 3 look as though they pull against each other and do not. The file keeps the
package's own name, `-normal` and all, so a reader can check the bytes against the package without
trusting anything written here. A test does exactly that.

### Where the bytes live, and three failures that decided it

The bytes are **in source**, base64 in a generated `fontData.ts`, and that was not the first design.
Reading them from `node_modules` was tried three times; **every attempt passed the whole unit suite and
returned HTTP 500 from the download route**:

| attempt | what happened inside Next's bundled server runtime |
|---|---|
| `import.meta.resolve(specifier)` | `{import.meta}.resolve is not a function` |
| `createRequire(...).resolve(\`${pkg}/files/${file}\`)` | `Cannot find module as expression is too dynamic` |
| `resolve("@fontsource/inter/package.json")` + `join` | Turbopack rewrote the path to the literal placeholder `[project]/node_modules/…`, and the read failed with `ENOENT` |

**The pattern is that a bundler treats module resolution as its own business**, so the way to be certain
is to have nothing to resolve and no path to read. Each failure was found by posting to the real route —
not one of them was visible to a green test suite, which is the plainest argument this sprint has
produced for walking a day's work in the thing the owner actually uses.

Carrying bytes in source has one hazard, a generated file going stale against a bumped version, and it
is guarded: a test compares every face and every licence against the package's own file, so a forgotten
`pnpm fonts:generate` is a red build rather than a wrong font. It also leaves `@retorika/publisher` with
no third-party **runtime** dependency, which its own package comment has prized since it was written.

### One test got stronger on the way

Five critical flows used to write `index.html` out of the ZIP and open that one file. That was enough
while a page's only companions were images it named with a `src`; a face is named inside `<style>`, so
those flows began reporting failed requests for files that were in the ZIP and not on the disk. **They
now extract the whole download**, which is both the stronger check and the more faithful imitation of
what an owner does. And `double-click.test.ts`, whose whole job is «this page works from `file://` with
no server», **now scans the inlined stylesheet's `url()` references** as well as the HTML's attributes —
it could not have seen a missing font before, because until this sprint there were none to see.

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
