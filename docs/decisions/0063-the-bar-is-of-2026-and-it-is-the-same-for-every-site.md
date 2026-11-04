# 0063 — The bar is of 2026, and it is the same for every site

**Status:** proposed · **Date:** 2026-11-03 · **Decided by:** David, 3 de noviembre de 2026, al
planificar el sprint 32 — his words were that the published site's bar and its two menus had «un
diseño arcaico», that he wanted them «extremadamente modernos y actuales», and, asked the four
questions the plan put to him, that the new look **replaces** the old one in every site, saved or new;
that the glass is allowed, **measured**; and, at approval, adjustments 1 and 7 (§3 and §4 below). ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** · **Amends:** [ADR 0057](0057-the-header-is-the-owners.md) (§2 of its decision, the bar's
look; its «no saved site changes its look until the owner chooses», restated by sprint 31 as its first
rule, is set aside here on purpose) · **Relates to:** [ADR 0058](0058-a-published-page-carries-one-script-and-it-is-constant.md)
(no fifth write), [ADR 0060](0060-each-menu-has-its-place-and-the-places-are-the-zones.md) (the rail
and «Ir a…» take the same vocabulary), [ADR 0062](0062-the-published-site-moves-just-enough-without-a-byte-of-script.md)
(the motion that reads this bar's numbers, día 2), [ADR 0064](0064-the-page-has-a-measure-and-a-rhythm.md)
(`[role=button]` takes the pill, día 3) · **Touches:** `packages/renderer`, `packages/tokens`,
`apps/editor` (the swatches and the colour in force)

## Context

The bar a visitor met until this sprint was the sprint 30 one: a flex row on the surface, a 1 px
hairline in the full `color.muted` under it, entries in the heading letter and in the primary colour
with a 2 px underline for the current one, a ruled line between the two menus, a `radius-sm` button,
and a phone «Menú» that was a list hanging from the bar with the browser's own disclosure triangle.
Once scrolled a fixed bar grew a shadow, and a transparent one turned opaque in one frame. Every one
of those is a token and every pair is proved; none of them is what a site made in 2026 looks like, and
David said so in the one word that matters here: arcaico.

The constraint is the same as ever (ADR 0001): the published site is HTML and CSS, from `file://`,
with the one constant script of ADR 0058 and nothing else. What a bar of 2026 does — the current
entry marked by a rule that slides, the bar condensing and turning to glass as the page scrolls, a
pill of a button that lifts under the pointer — has to be had from the stylesheet, from the four
things the script already writes, and from what browsers ship today. That is the whole of this
decision: which of those things, exactly, and what each one costs in contrast.

## Decision

### 1. One look, for every site

The look below is the bar's look: not a preset, not a choice in «Estilo», not a field in the schema
(1.17.0 stands, no migration). A site saved before this sprint opens, is edited and is published with
this bar, as a site made tomorrow is. David's reason, in the plan: nobody defends the look of today,
and two looks double the accessibility matrix, the goldens and every test that pins a literal. Sprint
31's first rule — «ninguna web guardada cambia de aspecto hasta que el dueño elija» — was a rule about
*placement*, where a saved site must not grow a rail it never asked for; it is not a rule about the
bar's letter and lines, and this ADR says so rather than pretending the look was always a choice.

The four corpus goldens that draw a header move; the eighteen that do not are byte for byte what
they were, because everything here lives in `headerCss` and travels only where a header is drawn.

### 2. The vocabulary, each value a token or a mix of two

- **The hairline** — under the bar, beside a rail, under a panel — is one tenth of the ink over
  whatever is behind it: `1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)`. A line on
  every scheme, on glass, and on a photograph, with no colour of its own to prove: it is decorative.
  It is still the owner's `hairline` switch.
- **The entries** are set in the site's reading letter (`font.body`), in **ink**, with nothing under
  them at rest; the current one carries a 2 px rule in the primary under it. The ruled line between
  the two menus is gone: the gap and the accessible names tell them apart.
- **The brand** is in ink too, in the heading letter, bold. Why ink and not the primary is §5.
- **The indicator** is the rule under the current entry, and **it slides**: when the current page
  changes, or the section in view does, the rule moves from the entry it was under to the one it is
  under now. It is the `nav`'s own `::after`, placed with CSS anchor positioning on whichever entry
  carries `aria-current` — `anchor-name` on the entry, `left: anchor(left)` and `width:
  anchor-size(width)` on the rule — so there is no element for the canvas to key, no write for the
  script, and no measurement. One name per strip (`--rb-current-pages`, `--rb-current-sections`),
  because the pages' strip and the sections' may each have a current entry at once; only the strip's
  navs anchor (a rail marks its entry by its edge; the sheet of día 4 by its edge too); and the rule
  is hidden the moment no entry is current. A browser without anchors (`@supports`) keeps the rule's
  colour on the entry itself, which is what sprint 31 drew. **And the block travels with the
  published page only, never with the canvas**: `buildCss(doc, target)` takes the target explicitly
  and `headerCss` writes the anchors for `"html"` alone. Measured and bisected in the editor, over
  one walk (sprint 28's «la sección editada no se mueve al abrir «Campos»»), eight runs: the **mere
  presence** of `anchor()`, `anchor-size()` and `position-anchor` in the frame's stylesheet — in
  rules that matched nothing, under `html[data-rb-js]` which the canvas never carries — broke
  Chromium's scroll anchoring across the frame's re-layout, and the section being edited moved
  **29 px** on closing the panel; the same `::after` without the three functions, 0; the rules with
  `anchor-name` alone, 0. A gate by selector cannot close that, so the gate is the target. The canvas
  carries no script, nothing there marks a section in view for the rule to slide to, and the rule's
  own colour draws the same pixels at rest: the sliding rule lives where the script that moves it
  does. This is the second thing the two targets differ in, after the script (ADR 0058 §4), and it
  is asserted: the canvas's sheet holds no anchor word, and the two sheets differ in that block alone.
  The canvas's first paint is the published page's html with the canvas's sheet swapped in
  (`canvasHtml`, `apps/editor/src/editor/previewDocument.ts`, exact or it throws), because the
  frame's `srcDoc` was the `html` target's and the patches that follow it were already the `dom`'s.
- **The button** is a pill: `border-radius: 999px`, `space.sm space.lg`, bold, in the heading letter,
  and it lifts one pixel with a soft shadow under a pointer that can hover (`@media (hover: hover)`).
  A section's `[role=button]` takes the same shape on día 3 (ADR 0064), so one site has one idea of a
  button again.
- **«Menú» and «Ir a…»** lose the browser's marker (`list-style: none`, and the WebKit pseudo). «Ir
  a…» on a wide screen is a pill too, and its panel rounds to `radius.lg`.
- **The rail** keeps its edge mark in the entry's own colour and gains a tint behind the current
  entry, an eighth of that colour. Its hairline is the hairline above.
- **The numbers**: `--rb-ease: cubic-bezier(0.2, 0, 0, 1)`, `--rb-fast: 200ms`, `--rb-base: 400ms`,
  on `html`, read by every transition of the bar (and by día 2's motion). They are the renderer's
  constants, like `--rb-header-h`, and not tokens of the document: rule 6 is about what the owner
  chooses, not about what the motor knows. Every transition sits under `prefers-reduced-motion:
  no-preference`, and `header.test.ts` walks the sheet, longhands included now, to hold it.

### 3. A fixed bar condenses once scrolled, and its box does not change (David's adjustment 1)

Once the page has scrolled — `data-scrolled`, the script's third write — a fixed bar takes `space.sm`
for its vertical padding instead of `space.md`, grows the shadow it already grew, and the two
transition together. **Its outer box does not change.** The bar is `sticky`, so its box is still in
the flow, and a bar 16 px shorter would have pulled the whole page up 16 px on the first scroll: jank
a visitor sees and CLS in the field that no lab run reports, because a lab run never scrolls. The
margin under the bar takes exactly what the padding gave up —
`margin-bottom: calc(2 * (var(--space-md) - var(--space-sm)))` — and the two move as one.
`offsetHeight`, which has no margin in it, still drops, so `--rb-header-h` follows the bar as it is
and every anchor lands under the bar as it is. Measured in Chromium with motion on: after a 400 px
scroll and the transitions finished, the first section's top has moved **exactly −400 px** on the
surface, transparent and primary schemes, and the bar is 16 px shorter. Only above the phone: a phone's
bar already has the small padding.

### 4. The cover under a transparent bar reads the estimate, never the measure (David's adjustment 7)

A transparent bar lies over the cover, out of the flow, and the cover makes its room with the bar's
height (ADR 0057, adjustment 1a). If that room were `--rb-header-h`, the one the script measures, it
would drop 16 px the moment the bar condensed and pull the headline up: the jump §3 avoids in the
flow, in a different place. So the stylesheet keeps **two** heights: `--rb-bar-h`, the estimate —
`calc(2 * var(--space-md) + max(40px, 1.5 * var(--size-body)))`, `space.sm` on a phone — which no
script writes and which the cover reads; and `--rb-header-h`, which starts as the estimate and
becomes the measure, and is read only where moving with the bar is correct: `scroll-margin-top`,
and the `top` of «Ir a…». The −400 of §3 is measured on the transparent scheme too; with the live
variable it reads −384.

### 5. The glass, and the proof that is arithmetic

Once scrolled, a fixed bar on the **surface** scheme (and a transparent one, which scrolled is a
surface bar) keeps **88 %** of the surface and lets the page show through the rest, blurred 12 px
(`backdrop-filter`); the **ink** scheme does the same with the ink. Only where the browser can blur
(`@supports`); elsewhere the bar is the opaque colour it was.

Axe cannot measure words over that — it reports a contrast it could not compute, which the
accessibility suite counts as red — so the glass is drawn only with `data-scrolled`, which the matrix
never sets, and **the proof is arithmetic**, `packages/renderer/test/glass.test.ts`, over the two
extremes of whatever can scroll under the bar: every word the bar writes on a glass background,
mixed per sRGB channel (`mixHex`, in `packages/tokens`) with pure black and with pure white, clears
AA in every palette. The floor is 4.5:1 with no tolerance, because it is a legibility floor and not a
geometry; `GLASS_MIX = 0.88` is the one number, exported by the renderer, written into the sheet, and
asserted equal in both.

**Measured before it was written, and it changed the look** (the plan had the entries in ink and the
brand and the current entry in the primary):

| Words on | at 0.88 over black | over white | lowest palette |
|---|---|---|---|
| ink on surface | **7.08** | 9.32 | forest-emerald |
| surface on ink | 10.52 | **6.72** | forest-emerald |
| primary on surface | **3.57** | 5.26 | neutral |
| surface on primary | 6.46 | **3.88** | neutral |

The primary does not clear AA as a word on a surface glass at 0.88 — nor at 0.96, where it reads 4.32
in `neutral` — because `#156FE7` on white is 4.71 opaque and any mix with black takes it under. So
**the surface scheme writes no word in the primary**: entries, brand and «Menú» in ink, the primary
kept for the indicator and the button, which are not words over glass. And **`primary` and
`secondary` condense without glass**, read the other way round: their words are `surface`, and
`surface` on `primary` at 0.88 over white is 3.88. `glass.test.ts` asserts the absence as well as the
presence: that the primary would fail, so that the day somebody paints it back on the bar the test
says why it was taken off.

### 6. Nothing new for the script

The condensing and the glass hang from `data-scrolled`; the indicator from `aria-current`; the
measure from `--rb-header-h`. ADR 0058's table of four writes is unchanged, and so are its 815 bytes.

## What is preserved

- **ADR 0001**: CSS and the one script; `file://`; nothing of ours called.
- **ADR 0057**: the header is the owner's — layout, schemes, alignment, gap, size, uppercase, the
  hover rule, the hairline switch, the per-part exact values of rule 6 — every switch still switches.
  §7's `line-height: 1.3` stands, and the bar still does not move when the letter arrives.
- **ADR 0060**: every place, every threshold, every copy; the rail's and «Ir a…»'s geometry.
- **Rule 6**: every value is a token or a `color-mix` of two tokens; the motor's constants are not
  the document's values (`document-rules.md`, día 7).
- **The classes**: not one renamed; the canvas keys by them.

## What is lost, and it is named

- **The look of sprint 30**, for every site, including the ones saved with it. David's decision.
- **The primary as the colour of the words** on a surface bar: the entries were blue; they are ink.
- **A `transition` on the bar's padding and margin**, which runs on every first scroll: 200 ms, under
  the reduced-motion query, and nothing else moves with it.
- **The browser's disclosure triangle** on «Menú» and «Ir a…».

## What this does not decide

- **The sheet of the phone** («Menú» as a full-height sheet with its entries coming in one by one,
  the icon): día 4.
- **The motion of the page** (sections coming in as the visitor scrolls, the cover's entrance, the
  transition between pages): día 2, ADR 0062.
- **The measure and the rhythm** of the page, and the shape of `[role=button]`: día 3, ADR 0064.
- **An exact colour of the owner's on a glass bar**: the review of día 5 judges it over the two
  extremes with the same arithmetic, or warns; today it judges it over the opaque bar.
- **Blocking the body's scroll under an open sheet**: not needed once the sheet hides what is behind
  it (día 4, David's adjustment 4).

## Note — sprint 32 día 2: the bar is above the page, `z-index: 1` (ADR 0062)

Named for the page transition, a bar in the flow became a stacking context, and «Ir a…»'s `z-index:
2` — fixed, inside the header — was ranked inside it and painted under a rising paragraph of the page.
`.rb-header` has `z-index: 1` since: its own stacking context, above the page wherever the two meet,
which a sticky or transparent bar already was with its 2. Measured by the fold's own walk (a bar in
the flow, scrolled 600 px), red by a click the paragraph took, green after.

## Note — sprint 32 día 4: on a phone, «Menú» and «Ir a…» are sheets

§2 left the phone's «Menú» as sprint 31 drew it, a list hanging from the bar, and named the sheet as
día 4's. It is now a sheet, and «Ir a…» on a phone with it (`phoneSheet`, `header.ts`):

- **It fills the screen under the bar**: `height: calc(100dvh - var(--rb-header-h))`, scrolling down
  inside itself and never across (the rail's rule). Its entries are set large, in the heading letter
  at the subheading size, and the current one is marked by its edge and a tint, as in a rail.
- **They come in one after another** when it opens: `rb-rise`, 400 ms, each 40 ms after the one
  before, capped at the seventh, the delay riding a custom property (día 2's lesson), filled
  `backwards` so an entry waiting on its delay is not drawn early. Under the motion query; the
  canvas, which has no `rb-rise` keyframes (ADR 0062 §5), animates none of it.
- **«Menú» has an icon and keeps its word**: two bars that cross into an X when open, and «Menú» that
  becomes «Cerrar» (`nav.close` in the renderer's locale). Both words are drawn and the stylesheet
  shows the one that applies, so the summary's accessible name is the word on screen. The word stays
  because the people this product serves do not all read an icon alone. With «Ir a…» beside it in the
  phone's bar the bars are not drawn: the 26 px they take are the brand's logo at 320 (sprint 31 día
  3). «Ir a…» gains a chevron that turns, on a wide screen only, for the same reason.
- **What the sheet covers stops existing while it is open** (David's adjustment 4):
  `body:has(<disclosure>[open]) main { visibility: hidden }`, in the phone's block only. The page
  leaves the order of Tab and the accessibility tree, so the keyboard cannot reach a link nobody can
  see, and the page no longer shows scrolling behind the sheet. Where `:has` is missing (it has been
  Baseline since 2023) the page stays visible behind, as before. `<main>` and not also `footer`: the
  footer is a section inside `<main>`. Tab past the last entry leaves the document — it does not
  «return to the summary», as the plan put it; nothing but a script could make it — and the next Tab
  starts again at the skip link. This is also why the body's scroll is not locked: nothing behind can
  be seen or reached.
- **A press outside closes it**, as the script always did; on a phone the bar is the one place
  outside a sheet that covers the rest of the screen, and the script's tests press there now.

Measured at 320×568 and 390×844: the sheet's top on the bar's foot within a pixel, its bottom at the
window's, edge to edge; `<main>` hidden while open and visible after Escape; opening «Ir a…» closes
«Menú»; the bar of `cabecera-con-marca` with a logo still ≤ 72 px at 320 with the bars drawn. With
eight entries the delays are 0, 40, … 240, 240, the last not drawn before its delay, every one at rest
after. Sabotaged: without the `visibility: hidden`, the keyboard lands under the sheet; without
`backwards`, the last entry is drawn before its delay.

## Note — sprint 32 día 5: an owner's exact bar colour stays opaque, and their exact words are judged over the glass

**Measured, and a defect since día 1.** With an exact colour of the owner's on the bar (rule 6), the
glass of §5 replaced it the moment the page scrolled: the glass rule weighs (0,4,0) and the bar's
exact rule (0,3,0), so on the `surface`, `transparent` and `ink` schemes the bar went from
`rgb(90, 26, 26)` to the surface's glass, and words the owner had set in white on their dark red sat on
near-white. The bar's exact rule is now written for the scrolled bar as well
(`.rb-header[data-layout][data-bg][data-scrolled]`, same weight, after the glass), and stays
**opaque**: the glass's proof covers the palette's colours, not an owner's. Measured on four schemes
after a 600 px scroll; sabotaged without the selector, the three glass schemes go red.

**And the pre-download review judges an owner's exact words over the glass.** §5's arithmetic proves
the palette's own words; an exact colour of the owner's on the brand or the links of a fixed bar on a
glass scheme (and no exact bar colour) is now judged over the bar's colour at `GLASS_MIX` over black
and over white as well as over the opaque bar, the worst of them being the finding
(`styleReview.ts`). A grey that clears 4.5 on white falls to about 3.6 on the glass over black and is
warned about; not fixed, or on a coloured scheme, or with an exact bar colour, only the opaque bar is
read. Sabotaged without the two extremes, the warning goes.

**The «Menú» panel says what a fixed bar becomes** («se estrecha y se vuelve translúcida» or «se
estrecha y gana una sombra»), read from the renderer's `GLASS_BACKGROUNDS` and the exact bar colour
(`scrolledLook`, `headerState.ts`), so it cannot promise a glass the page does not draw; and that the
canvas shows it at rest.

## Consequences

- `packages/renderer/src/header.ts`: `GLASS_MIX`, `GLASS_BACKGROUNDS`, `HAIRLINE`, `STRIP_NAV`; the
  anchor block for the `html` target only (`buildCss(doc, target)`, explicit at every caller:
  `index.ts`, the editor's canvas, the tests); the
  bar's rules; `--rb-bar-h`; the condensing block; the glass block after the transparent bar's own
  scrolled rule, which it wins at equal weight by coming later; the rail's tint; «Ir a…»'s pill and
  radius; the row hidden on a phone whose choice is «Ir a…» (two copies of the sections were announced
  at 320 for `row` + `fold`, found by the matrix's new combination).
- `packages/tokens/src/contrast.ts`: `mixHex`.
- `packages/renderer/test`: `glass.test.ts` (new); `header.test.ts` (the literals, the walker's
  longhands, the `@supports` blocks); `header.browser.test.ts` (the −400 on three schemes, the glass's
  computed `blur(12px)` and `/ 0.88)`, the indicator's `left` and `width` within a pixel of the entry's
  before and after the current one changes); `header-script.browser.test.ts` (its context asks for
  reduced motion, día 0's rule, because its padding test read a condensing bar mid-way);
  `links.test.ts` (the hover block is a header state rule, and `text-decoration-color` is not the
  words' colour); `browser-fixtures.ts` (`header/fold/row-on-wide`).
- `apps/editor`: `SCHEME_TOKENS` says ink for the surface schemes, so the swatches and the colour an
  input starts from are the published ones; `headerState.test.ts` reads it off the sheet.
  `canvasHtml` for the frame's first paint; `buildCss(doc, "dom")` at every canvas caller.
- Golden: four files, every hunk read; eighteen untouched.
- Measured: a11y 883 (868 + the new combination's 15); Lighthouse, mobile preset, **the fixed bar with
  a logo at 100 with the glass** (LCP 1.35 s, CLS 0.008), the compositions 99 / 98 / 98 as at the
  close of sprint 31; our bytes of `cabecera-con-marca` 15.0 KB of 28; the script 815 B.
- Day by day in `docs/design/REVIEW.md`, sprint 32 día 1.

## Note — sprint 33 día 1: the body's scroll is locked after all (ADR 0065)

The note of sprint 32 día 4 ends: «This is also why the body's scroll is not locked: nothing behind can
be seen or reached.» **Measured, that reason does not hold.** The page behind is not seen, but it still
scrolls, and with a bar in the flow it carries the sheet away with it: a wheel of 2000 px over the open
sheet took `scrollY` to 2000 in Chromium and in WebKit, at 390 × 844 and 320 × 568, leaving a blank
page as long as the content under the visitor's eye — the defect David reported opening sprint 33. ADR
0065 locks it by the stylesheet, with no write of the script: `html:has(<sheet>[open]) { overflow:
hidden }` in the phone's block, and `scrollbar-gutter: stable` there so the content keeps its width
where a classic scrollbar is drawn. Everything else in that note stands.

## Note — sprint 33 día 3: the sheet hangs from the bar it has, and a fixed bar lets go into the flow

The note of sprint 32 día 4 gives the sheet `height: calc(100dvh - var(--rb-header-h))`. **Measured by
the menu audit in three engines, that variable is never quite the bar**: the script's measure is
`offsetHeight`, rounded, and counts the hairline the sheet starts above (`top: 100%` is of the
header's padding box), so on a `surface` bar the sheet stopped 1.0–1.4 px short of the screen; and
where no script runs — the canvas, a visitor without one — it is the estimate of one line, so under a
bar on two lines or with the sections' row the sheet ran 26–67 px below the screen, its last entries
out of reach. The height is now **`calc(100dvh - 100%)`**: an absolute box's `top: 100%` and its
height's `100%` are both of its containing block, so the sheet ends at the header's top plus the
screen — the screen's foot, where the bar is whenever «Menú» can be pressed — whatever the bar
measures, in both targets. Nothing else of that note changes, and `--rb-header-h` still places the
anchors and «Ir a…» on a wide screen, where the canvas's estimate is a named divergence (the «Menú»
panel says so since this day: 3.2 px at 1280 in the audit).

**And a fixed bar over the phone's row lets go by `position: relative`, no longer `static`** (sprint
31 día 6). `static` took from the sheet the box both of its percentages are of: «Menú» opened at the
screen's foot, below it, over a page `<main>` hid — on every fixed bar with the row on the phone, 25
of the audit's 153 combinations, in the three engines. A transparent bar lets go as a transparent one
does, `absolute` over the cover, weighed (`html … [data-layout]`, 0,5,1) over the script's `fixed`,
which had kept it fixed over the row. Measured red before at 320 × 568 and 390 × 844, green after;
sabotaged back to each old value, red again. Four goldens move by those three lines and nothing else.
