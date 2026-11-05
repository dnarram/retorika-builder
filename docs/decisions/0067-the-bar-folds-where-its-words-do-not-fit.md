# 0067 — The bar folds where its words do not fit

**Status:** proposed · **Date:** 2026-11-05 · **Decided by:** David, 5 de noviembre de 2026, opening
sprint 34 — his first decision on what the sprint 33 audit left open, «con la cuenta por ancho estimado
y no por número de entradas» («la estimación es conservadora a propósito: plegar antes es seguro,
partirse es el defecto»), his two answers while the plan was written (the bound of 1247 lifted, «siempre»
where the line never fits, the download review told; the canvas under the legibility floor said by the
panel, with «Menú» as a grip) and his first adjustment approving it («nunca» no es un número: `always`
is a named value, the phone block with no `@media`, no rail) — and, on día 2, his choice of the
measure the estimate reads: the advance of every glyph, per family and weight, summed. ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** · **Amends:** [ADR 0060](0060-each-menu-has-its-place-and-the-places-are-the-zones.md) §3
(«the phone, exactly: rails do not exist under 1024» — they stand from the fold now, never under 1024)
· **Relates to:** [ADR 0057](0057-the-header-is-the-owners.md) (the phone's header is its own
derivation), [ADR 0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md) (the bar's
estimate of its own height, which a wrapped line breaks), [ADR 0061](0061-the-canvas-lays-out-at-1280-and-scales-and-says-so-where-it-cannot.md)
(the canvas's layout widths, untouched), [ADR 0066](0066-a-menu-is-dragged-to-its-zone.md) (the grip
the fold adds, día 5) · **Touches:** `packages/renderer` (`header.ts`, `glyphAdvances.ts`),
`packages/schema` (`tokenPx`), the editor's checks and sentences. No schema change, no byte of the
script.

## Context

A wide bar is one flex line that wraps when its words do not fit: brand, pages, sections, button. The
sprint 33 audit measured what a wrapped line costs — a bar taller than the stylesheet's estimate of it
(ADR 0063's note of día 6), which is all a transparent cover makes its room with: with the teaser's own
labels and a logo, the cover's first words were 4.8 px under the bar at 768, 50 px at the generous
scale, the button on the headline. **No stylesheet measures a line's words**, which is why the estimate
of the bar's height could learn its form and not this.

The renderer does know the words. It draws them. What it did not know was how wide they are, and
**0.55 em a character — the figure the plan started from — is not a floor any family respects**:
measured on día 2 over 29 real labels in the forty shipped families and the three engines (which agree
to three decimals), the mean advance runs from 0.31 (Yanone Kaffeesatz) to 0.65 (Unbounded) in regular
and 0.69 in bold, capitals with their letter-spacing add 30 %, and the widest label, «Menú», reaches
0.84–1.03. A single factor safe for every family would make the teaser the phone's at every width; a
factor per family at its 95th percentile folded 90–130 px early. David chose the measure that is not a
factor at all.

## Decision

### 1. The bar folds into the phone's header where its line would not hold its words

Every document's stylesheet carries a `@media (max-width: N px)` of its own, where **N is the widest
viewport at which some page's bar would not fit one line**, and below it the header is **the phone's
whole header**: the close-set bar, the pages behind «Menú» and its full-height sheet, the sections as
the owner chose them for the phone (a row, nothing, «Ir a…»), the lock of ADR 0065, a fixed bar
letting go over the row. Not only «Menú» in the strip's place: the sections would have had nowhere to
go, «Ir a…»'s fixed pill beside a phone row would have announced them twice, and a strip swapped alone
would have been a third form of the menu nobody had measured. N is at least 720 — the phone's own
width, which does not move — and has no bound above (§3).

### 2. N is a sum of glyphs, read off the nodes the bar draws

For each page, `headerWidths` reads the nodes `headerNodes` draws for it — so «Inicio» away from home,
the button's destination left out of the menus and each page's own sections count exactly as drawn —
and sums, with the stylesheet's own gaps: an entry is the sum of its glyphs' advances in the body
family at 400 (`glyphAdvances.ts`: every printable ASCII glyph and what Spanish adds, per shipped family
and weight, measured in Chromium with the publisher's own bytes, kerning off, 3 % added back for
kerning; in capitals, each glyph's capital and 0.06 em more), at the bar's size (`size.body`, × 0.875
when small); a nav its entries and the owner's gap; the strip its navs and `space.xl`; the brand its
logo at 40 px by its stored aspect — **four times as wide as tall when no size was stored**, a named
constant, since a logo of 1 to 512 px a side has no bound — and `space.sm` and its name in the heading
family at 700; the button its words at 700 and `space.lg` each side; the line the items present with
`space.xl` between them, the brand on its own line when stacked; and the sections' row, where the page
draws one at every width, a line that has to fit too. **A family the product does not ship** — a
system stack, an owner's own font — is counted at the 95th percentile, glyph by glyph, of the three
type pairs' six system stacks as the machine that generated the table drew them **and of DejaVu Sans
and Serif, the letter a Linux machine draws `system-ui` and `serif` with** — the first run of the
day's PR in CI found a `system-ui` bar breaking 42–50 px past a fold measured on macOS alone, which
is exactly the loss the first draft of this ADR named and did not cover. A glyph the table did not
measure counts as the family's widest.

The line fits at a viewport `w` when it is no wider than `min(1200, w − 15 − rails − 2 × space.xl)`:
the page's measure, the lane of a classic scroll bar (which a `@media` width counts and the bar's
padding does not), the rails that stand, the bar's padding. Three lines per page, one per band of the
rails — none standing, the pages' alone (two opposite rails under 1248), every one — because a rail
takes its menu out of the strip, and the brand and the button with it when they go with the pages; a
collapsed bar needs nothing where it collapses. N is the largest last-failing width over pages and
bands, in closed form, no width scanned — and **the band with no rail ends at 1023 on a page that
draws a rail**: from 1024 the rail takes its menu out of the strip whatever the strip's copy would
have needed below it (the bar's copy is where a rail falls, ADR 0060 §3), so ten entries in a column
fold the bar up to 1023 and not for ever. A band with a rail that fails pushes the fold up and the
rails with it (§3): the header is the phone's up to N and the wide one from just above, never the
other way round.

### 3. No bound above; «always» is a word, not a number

Where the line does not fit even at 1247 — David's second answer — N keeps rising, past the width two
rails stand from if it must, and the rails stand from `max(1024, N + 1)`. Where the line is wider than
the measure itself, no viewport holds it: **`headerWidths` answers `{ phone: "always", rails: "none" }`**,
the phone's block is written with no `@media` at all, the rails' block and every rule from above the
fold are not written, and whoever reads it — the checks, `zonesFor`, the panel — tells the case apart
by its name and does no arithmetic (his first adjustment). The download review says both, with the
characters to cut (`over`; día 4).

### 4. The estimate is conservative, and conservative is measured

The claim is «a bar never wraps». `header.browser.test.ts` opens twenty sites with their fold written
back to 720 in the html, finds by bisection the widest viewport at which each one's line breaks, and
asserts the estimate is at or over it — **and under 40 px over it** (David's expectation for the glyph
table; the family factors were 90–130 over). Measured on día 2: 0–31 px over for every form without a
logo, exact where the logo carries its size, 110–140 over with the fixture's unsized 2 × 2 logo, by
design. **A form that falls outside is corrected in the formula, never in the tolerance** (the rule of
ADR 0063's note). And **the check that judges the fold reads no N**: the audit's check 11, promoted
to `a11y` over every header combination at 768, 1024, 1247 and 1280 — with the teaser's long words,
which fold, and with short ones, which keep the strip — asks only whether a bar with its strip drawn is
taller than its own form's lines. David's sabotage lives inside the test: three labels of twenty
letters, the html rewritten so the bar never folds, and the check goes red at 768.

## What changes between 721 px and N, and it is named

For a site whose words fold the bar past 720 — the teaser's own, at 768 and at 1024 with a logo:

- the bar is close-set, the pages are behind «Menú» and its sheet fills a tablet's screen;
- the sections are where the owner put them **for the phone**: a row under the bar, nothing, or
  «Ir a…» beside «Menú». «Oculto en el móvil» with no pages menu leaves the tablet no sections menu;
- a fixed bar with the row lets go into the flow, as on a phone;
- no rail stands: a column stands from N + 1, which may be past 1024 (ADR 0060 §3 amended);
- the panel's «En el móvil» and its fixed-bar notes mean «hasta N px», and say so (día 4).

Nothing changes for a site whose words fit from 721 up: N is 720 and the stylesheet is what it was,
byte for byte — twenty-one of the twenty-two corpus sites, and the one that moves (`cabecera-con-marca`,
«Taberna Santo Domingo» in bold with its logo) moves by three `@media` lines, to 760.

## What is lost, and it is named

- **A tablet in landscape may show «Menú» where the strip would have fit**: the estimate runs long by
  up to 31 px on the words, and by 120 on a logo stored without its size. Folding early is the price
  David set against wrapping, and the slack is printed by the test, every run.
- **A visitor whose browser default letter is larger than 16 px** sees wider words under the same
  px fold. The fold could be written in `em`, which would follow the letter; it is written in px, as
  asked, and this is what the `em` would buy.
- **A viewport width that is not a whole number** — Windows scaling, a zoomed window — falls between
  N and N + 1, where no query applies, exactly as 720 and 721 always did.
- **Fonts no measured machine draws**: the fallback for an unshipped family is the widest, glyph by
  glyph, of macOS's six system stacks and DejaVu's two; a platform with a wider letter than both, or
  an owner's own font, has no bound. The conservative test runs where the fonts are — on this Mac and
  on CI's Linux, which is how DejaVu got in.

## What this does not decide

- **The fold in `em`** rather than px (above).
- **Where «Ir a…»'s pill and the condensing of a fixed bar start**: from N + 1, with the rest of the
  wide header, by §1. A pill at 721 under a folded bar was considered and refused with the strip.
- **What the canvas shows under the legibility floor** (ADR 0061): a 1024 window with a panel lays the
  canvas out at 887, under many sites' N, and the owner edits a folded bar — the panel says so (día 4)
  and «Menú»'s summary is a grip (ADR 0066, día 5); the floor does not move.

## Consequences

- `packages/renderer`: `headerWidths(doc)` in `header.ts` (and `phoneAt`, `railsAt`); every header
  `@media` line written from it (`toPhone`, `fromAbove`); `glyphAdvances.ts`, generated by
  `pnpm fonts:advances` (`scripts/generate-glyph-advances.ts`) and committed, `linguist-generated`.
- `packages/schema`: `tokenPx` (px as they are, rem at 16, anything else refused).
- Tests: `header.test.ts` (the corpus's widths; longer, capitals, small, stacked; the logo's two
  aspects; «always» writes no `@media` of the header's; `over`); `header.browser.test.ts` (the truth
  by bisection and the slack; the unsized logo; the sabotage); `menu-checks.ts` check 11;
  `a11y.browser.test.ts` over every combination and its short twin; the audit's `phone` reads
  `phoneAt`. One golden moves (`cabecera-con-marca`, three lines).
- Days 3 to 5: the audit with the fold; the owner told; «Menú» as a grip.
- Day by day in `docs/design/REVIEW.md`, sprint 34 día 2.
