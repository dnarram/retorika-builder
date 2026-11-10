# 0062 — The published site moves just enough, without a byte of script

**Status:** proposed · **Date:** 2026-11-04 · **Decided by:** David, 3 de noviembre de 2026, al
planificar el sprint 32 — he asked for sites «extremadamente modernos y actuales resaltando el
movimiento de las páginas del 2026», chose the three pieces of motion this ADR names from the plan's
four questions (sections coming in as the visitor scrolls, the transition between pages, the cover's
entrance), and, asked whether the owner should be able to switch it off, answered **no**: it is
always on and only the visitor's `prefers-reduced-motion` governs it. At approval, his adjustments 2,
3 and 6 (§5, §1 and §1 below). · **Recorded by development at his instruction, with the standing note
that development does not sign.** · **Relates to:** [ADR 0001](0001-static-sites-no-runtime.md) (it
is CSS), [ADR 0015](0015-interface-tokens-are-not-the-sites.md) (the editor's motion vocabulary does
not travel; this is the site's own), [ADR 0058](0058-a-published-page-carries-one-script-and-it-is-constant.md)
(no fifth write; §4's divergence has a second), [ADR 0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md)
(the numbers it reads), [ADR 0051](0051-the-canvas-keeps-its-document-and-an-edit-is-a-patch.md)
(§3: the canvas is still) · **Touches:** `packages/renderer`, `apps/editor` (the canvas's refusal)

## Context

Until this sprint a published page moved in three places, all of them the header's (ADR 0063 lists
them). Its sections stood where they were from the first paint; a navigation between two of its
pages was a white flash; the cover was there. The sprint 22 vocabulary (`ui-reveal`, `ui-lift`) that
makes the editor feel of its time lives in `globals.css`, under the `--ui-` prefix, and ADR 0015 says
why it never reaches a client's site: those are Retorika's colours and timings, not the owner's.

A site of 2026 moves as the visitor scrolls, and David asked for that. The constraint is ADR 0001's:
HTML and CSS, from `file://`, the one constant script of ADR 0058 and no other. Everything below is
had from the stylesheet and from what browsers ship today, and the day that a piece of it cannot be
— a browser without scroll-driven animations, a navigation from `file://` — the page is simply still,
with everything on it.

## Decision

### 1. A section comes in as the visitor scrolls to it

Every child of every section after the first fades in and rises 16 px on its **own view timeline**:

```css
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    main > .rb-section:not(:first-child) > * { animation: rb-reveal linear none;
      animation-timeline: view(); animation-range: entry 0% entry 160px;
      overflow-anchor: none; }
  }
}
@keyframes rb-reveal { from { opacity: 0; transform: translateY(16px); } 15% { opacity: 1; } }
```

- **One timeline per child**, so the stagger is the grid's own order and costs no `nth-child`.
- **The range is a length** (David's adjustment 3): every child has finished coming in 160 px after it
  shows, however tall it is. On `entry 0% entry 40%` a gallery taller than the window would have stayed
  half-faded with its top in view until the visitor had scrolled two fifths of its height. Measured in
  Chromium with a 1600 px child: 0 with its top 10 px under the fold, between 0.3 and 0.7 half way
  through the 160 px, 1 at 170 px with 1440 px of it still under the fold.
- **No fill, and the fade done in the first 15 %** — both measured against axe on día 2. With
  `backwards`, every child under the fold waited at opacity 0; with the fade over the whole range, a
  child straddling the bottom edge of the first screen sat half-faded until the visitor scrolled.
  Lighthouse's accessibility fell from 100 to **96** on six subjects of eight, on `color-contrast`:
  axe weighs an element's opacity into the colour of its words, and the half-faded intro and card
  titles of the second section read as failed contrasts on Lighthouse's phone. So: **no fill** — out of
  its range a child is its ordinary self, under the fold where nobody and nothing sees it faded — and
  the fade is over by 24 px of the 160 (the rise takes the rest), so a child that shows by more than
  24 px at load is whole. Back to 100 on all eight. A child that shows by less than 24 px at load is
  still mid-fade for that instant, and axe would read it; with these fixtures' geometry none does, and
  that is the honest extent of the claim. `backwards` stays on the cover's entrance (§2), which is
  on screen from the first paint and done in 600 ms.
- **The longhands come after the shorthand** (David's adjustment 6): `animation` resets
  `animation-timeline` and `animation-range` to their initial values when it is written after them.
  `motion.test.ts` asserts the order in every rule that has them.
- **Only `opacity` and `translateY`**: the overflow walk sees nothing on X, and nothing lays out.
- **`overflow-anchor: none`**: see the next item; a rising element must not be the scroll anchor.
- **The first section is out of it**: it is on screen at the first paint, and its photograph is the
  LCP element in every composition.
- **Inside `@supports`**: Firefox (measured on día 6) moves nothing and shows everything.
- **`overflow-anchor: none` on everything that rises**, here and in §2. An element whose transform is
  animating must not be the browser's scroll anchor: the browser reads its own animation as the page
  moving and adjusts the scroll by it. Measured on día 2 with ADR 0063 §3's walk, which had held on
  día 1 before anything rose: `scrollTo(0, 400)` landed at **399** while the bar condensed above it,
  with the anchor on a word of the cover still coming in; with the words excluded, 400. The reveal's
  children were excluded first and it was not enough, which is how the cover's words were found.

### 2. The cover's words come in once

```css
main > .rb-cover:first-child > :is(h1, p, a[role=button]) {
  animation: rb-rise var(--rb-base) var(--rb-ease) backwards;
  animation-delay: var(--rb-delay, 0ms); overflow-anchor: none; }
main > .rb-cover:first-child > p { --rb-delay: 80ms; }
main > .rb-cover:first-child > a[role=button] { --rb-delay: 160ms; }
```

Headline, line, button, 80 ms apart, 400 ms each, and done well inside 600 ms. **The delay rides a
custom property**: a plain `animation-delay` on `p` lost to the shorthand rule above, which weighs
more (`:is()` takes its heaviest argument, `a[role=button]`) and resets the delay to 0 — measured as
`[0]` where 80 was expected, the first time this ran in a browser. A custom property is reset by no
shorthand and weighs nothing. **Never the
photograph and never `.rb-panel`** (decision 5 of the plan): an element at opacity 0 is not painted
for LCP, and the photograph is the LCP element. `motion.test.ts` asserts no selector that animates
names `img` or the panel; the browser twin asserts the image has no animation.

### 3. The page fades into the next, and the bar stays

```css
@media (prefers-reduced-motion: no-preference) {
  @view-transition { navigation: auto; }
  .rb-header { view-transition-name: rb-header; }
  ::view-transition-old(root), ::view-transition-new(root) { animation-duration: var(--rb-fast); }
}
```

A cross-document view transition (Chromium 126, Safari 18.2; Firefox navigates as it always did),
200 ms, with the bar named so the browser keeps it still while the rest crosses over. **A named
element is a stacking context**, and that reached the bar in the flow, which had none: «Ir a…»'s
`z-index: 2`, fixed inside the header, was ranked inside the header's new context and painted under a
section's paragraph rising with its own transform — Playwright found the paragraph intercepting the
click. The bar has `z-index: 1` since (ADR 0063's note of día 2): above the page wherever they meet,
as a sticky or transparent bar already was with its 2. **Same origin
only**: a site opened from `file://` navigates without it, and nothing breaks. *(Not so in Chromium,
measured on día 6 — see the note at the end: Chromium 153 and Chrome 156 transition between two pages
of the extracted ZIP; WebKit 26.6 does not. Nothing breaks in either.)* Both pages opt in,
because every page of a site carries this sheet. The bar is named only where one is drawn: a one-page
site under the menu's threshold carries no header rule at all. Measured in Chromium with a routed
site: the new page's `pagereveal` carries a `viewTransition` for the visitor who did not ask for less
and `null` for the one who did.

### 4. A button lifts

`[role=button]` takes the bar's button's lift (ADR 0063): a pixel up and a soft shadow under a
pointer that can hover, transitioned. Its shape, the pill, is día 3's (ADR 0064).

### 5. The canvas is still, twice over (David's adjustment 2)

An animation in flight owns `transform` and `opacity`. The drag of sprint 25 writes `transform`
inline and would stop moving the element; `measurePlaced`, the handles, the guides and `rowAt` would
read positions 16 px low; and every walk that measures a box would go intermittent with the scroll.
So none of §1–§4 runs where the editor measures:

- **The renderer writes none of it for the `"dom"` target.** `buildCss(doc, target)` is explicit
  (ADR 0063 §2's rule, learned the hard way on día 1: a CSS feature can act on a frame by its presence
  alone), and the canvas's sheet carries the numbers and not one movement.
- **The canvas's own sheet refuses it as well** (`apps/editor/src/editor/canvasStillness.ts`): `main >
  .rb-section > * { animation: none !important }` beside the `scroll-behavior: auto` it already wrote,
  so a section animation that reaches the frame by any other road is flattened there too. A test holds
  that every selector the renderer animates inside a section is a child of a section, which that one
  rule covers.

The renderer learns nothing of the canvas beyond the target it already knew (ADR 0051 §3). The panel
says, since día 5, that the movement is seen on the published page.

### 6. The numbers, and where they live

`html { --rb-ease: cubic-bezier(0.2, 0, 0, 1); --rb-fast: 200ms; --rb-base: 400ms; }`, for every
site, with or without a header: the bar's transitions and the page's motion read the same three.
They are the renderer's constants, like `--rb-header-h`, and not tokens of the document — rule 6 is
about what the owner chooses, not about what the motor knows (`document-rules.md`, día 7). They sit
outside the media query because they are numbers, not movement.

### 7. No switch, and nothing for the script

Always on; the visitor's `prefers-reduced-motion` is the one switch, and `motion.test.ts` walks the
whole sheet, longhands included, to hold every `animation*` and `transition*` inside the query. The
schema stays at 1.17.0. ADR 0058's four writes are unchanged, and so are its 815 bytes: a view
timeline is the browser's, a view transition is the browser's, a keyframe is the browser's.

## What is preserved

- **ADR 0001**: CSS; `file://`; nothing of ours called.
- **ADR 0015**: the editor's `--ui-` vocabulary stays in the editor; this is `--rb-`, the site's.
- **ADR 0058**: one script, four writes, and the canvas carries none of this.
- **Lighthouse ≥ 95** (protocol Part 8.5), measured on día 2 with the motion on: see Consequences.
- **A wait on «every animation of the document» never returns** once a view timeline is on the page:
  a scroll-driven animation's `finished` settles only when the page can scroll no further. The
  browser tests wait on the animations of the element they measure, or on those of the document's
  own timeline (`timed()`, `header.browser.test.ts`) — measured as a 60 s timeout on día 2.
- **The harness measures the settled page** (día 0): axe and the overflow walk open every page under
  `reduce`; `motion.browser.test.ts` is the twin that proves the movement exists and ends at rest.

## What is lost, and it is named

- **A page that does not move.** For every site, saved or new, for every visitor who has not asked
  their system for less. David's decision; the system's switch is the visitor's.
- **A browser's scroll anchoring under a view timeline**, if Chromium treats the published page's
  sheet as it treated the canvas's (ADR 0063 §2): not measured on a published page, because nothing
  re-lays a published page out mid-scroll; named here so día 6 looks. *(Día 6 looked: see the note.)*

## What this does not decide

- **The measure, the rhythm, the pill** (día 3, ADR 0064), **the phone's sheet** (día 4).
- **Any other movement**: parallax, loops, a scale above 1, `filter` on content, anything on the
  photograph, anything longer than `--rb-base`. Each would be a change to the closed list in
  `motion.test.ts`, and to this ADR.
- **Firefox**: if it ships `animation-timeline` (one source said 159, October 2026, unconfirmed),
  the reveal arrives there with no change here; día 6 writes down what it found. *(Firefox 155 does
  not: the note at the end.)*

## Consequences

- `packages/renderer/src/build.ts`: `motionCss(doc, target)`, emitted after the base and before the
  header, for every site; the numbers moved here from `header.ts`.
- `packages/renderer/test/motion.test.ts` (new; the walker moved here from `header.test.ts`, over the
  whole corpus, with the closed list, the order of the longhands, the `@supports`, the cover's
  exclusions, and the two sheets differing in two blocks alone); `motion.browser.test.ts` (the twin:
  the reveal on a `ViewTimeline`, the 1600 px child at 0 / ~0.5 / 1, the cover's delays and its still
  photograph, the `pagereveal` with and without a transition, and nothing under `reduce`).
- `apps/editor/src/editor/canvasStillness.ts` and its test; `Editor.tsx` reads it.
- Golden: all twenty-two, every hunk read: the block, and the numbers moving out of the header's.
- Measured: Lighthouse, mobile preset, with the motion on — in REVIEW, sprint 32 día 2.

## Note — sprint 32 día 4: the reveal rises and never fades (decided by David's delegation)

**Decided on 4 November 2026 by development, on David's explicit delegation** — his words, with PR
#337 merged: «Se el mejor experto de UX y diseño gráfico y decide las respuestas sobre las decisiones
pendientes para continuar con el dia siguiente del sprint». The decision pending was ADR 0064 §5's:
keep the scroll-driven fade, or rise without one. Development chose the rise, and records why rather
than signing for him.

The reason is what a visitor sees, more than what axe reads. A scroll-driven fade leaves whatever
straddles the bottom edge of the first screen at load **half-faded at rest** — not for an instant, but
until the visitor scrolls — so the foot of every site's first screen showed washed-out words, which is
also what axe measured on día 3 (2.53:1, Lighthouse 96). No fade can be made safe by construction:
the lowest opacity at which every proved pair on `color.surface` still clears 4.5 is **0.98** in
`neutral`, whose primary is 4.71 opaque. A rise moves the words and never their contrast.

So `rb-reveal` is `from { transform: translateY(16px) }` and nothing else: a child rises 16 px over
the 160 px of its entry, at full opacity at every scroll, with no fill. The cover's entrance (§2) keeps
its fade: it is time-based, on screen from the first paint, and done in 600 ms, so nothing waits
half-faded. Measured: Lighthouse accessibility **100 on all eight subjects** again, the other scores
unchanged; the twin asserts opacity 1 and a translate of more than 15 px 2 px into the entry, between 6
and 10 half way, and 0 at 170. Golden: the one keyframes line in each of the twenty-two.

## Note — sprint 32 día 6: the three engines

Measured on 4 November 2026 with the engines Playwright 1.63 installs — **Chromium 153, Firefox 155,
WebKit 26.6** — by `packages/renderer/test/engines.browser.test.ts` and
`packages/publisher/test/engines.browser.test.ts`, both new. CI installs Chromium alone, so there the
other two are skipped, and the run says so.

| | `animation-timeline: view()` | `anchor-name` | `backdrop-filter` | cross-document, from `file://` |
|---|---|---|---|---|
| Chromium 153 | yes | yes | yes | **transitions** |
| Firefox 155 | **no** | yes | yes | no (`pagereveal` absent) |
| WebKit 26.6 | yes | yes | yes (and `-webkit-`) | does not transition |

What this means for each piece of §1–§3:

- **The reveal (§1)** runs in Chromium and WebKit; **Firefox 155 has no `view()`**, so the
  `@supports` keeps it out and the page is still there — the source that said Firefox 159 had it is
  neither confirmed nor contradicted by this build. In all three, under `no-preference`, every word
  the page draws is at opacity 1 after loading and at every third of a window down to the bottom, on
  `menu-y-paginas` and `cabecera-con-marca` at 1280 and 390. Sabotaged with the fade put back into
  `rb-reveal`: red in Chromium and WebKit, green in Firefox, which is the `@supports` doing its work.
- **The indicator (ADR 0063)**: all three anchor, so all three draw the sliding rule and none the
  entry's own; the test asserts exactly one of the two and that it is the one the engine supports.
  **The fallback — the rule's colour — is exercised by no installed engine**; `header.test.ts` holds
  its CSS.
- **The glass (ADR 0063)**: all three blur; a scrolled bar reads `blur(12px)` over a background at
  alpha 0.88 on `surface`, `ink` and `transparent`, and is opaque on `primary`. The opaque branch
  for an engine without `backdrop-filter` is, like the indicator's, exercised by none.
- **Between pages (§3)**: §3 said a site opened from `file://` navigates without a transition. **That
  is true of WebKit and not of Chromium**: between two pages of the extracted ZIP, Chromium 153 —
  and the installed Google Chrome 156, on a two-page probe from disk the same day — reveal the
  second page with a `viewTransition`. It is the same 200 ms fade with the bar still that the served site has, so a
  downloaded site in Chrome is now identical to the published one, transition included. **Under
  `reduce` no engine transitions**, from disk as from a server — asserted, and sabotaged by moving
  `@view-transition` out of the media block: red in Chromium.
- **Scroll anchoring under a view timeline** (*What is lost*): the one re-layout a published page
  makes mid-scroll is the bar condensing. All three anchor — content grown above the window keeps
  `scrollY` in step in each — and with the bar's `margin-bottom` taken away, the in-flow bar moves the
  page in all three: none saves the condensing on its own, and none undoes it with the margin there.
  The first section moves exactly −400 px on a 400 px scroll with the motion on, `surface` and
  `transparent`, in the three (Firefox reads −400.000015 on `surface`, under its 1/60 px unit).
- **From disk** (the ZIP built by `buildSite`, written by `bundleToZip`, extracted with `unzip`): the
  entry page and a second page load in the three with no console error, no exception, no failed
  request, every image decoded and no face in error. A missing `fonts/` is caught by
  `document.fonts` in Chromium and Firefox and **only by the console in WebKit** («Not allowed to
  load local resource»), which is why the test listens to both.


## Note — sprint 34 día 6: the list gains the fixed bar's line (ADR 0068)

The closed list of what the published page moves (`motion.test.ts`) gains one entry, by
[ADR 0068](0068-the-fixed-bar-can-say-how-much-has-been-read.md): **the line of how much has been read**,
at the foot of a fixed bar whose owner turned it on — `animation: rb-progress auto linear both` and
`animation-timeline: scroll(root)`, inside this ADR's `prefers-reduced-motion: no-preference` and a
feature query. §7 stays true of what it governs — the page's own motion has no switch —; this one is the
owner's, off by default, and the visitor's preference still governs it. And §5's two sheets — the
published page's and the canvas's — now differ in three blocks where the bar carries the line.

## Note — sprint 35 día 3: the canvas's stillness is the page's, not the editor's chrome

§5's rule in the canvas, `main > .rb-section > * { animation: none !important }`, reached the
editor's own chrome as well as the page: the section's verbs and its escalation and composition
popups are children of a section too, and from this day they grow in when somebody opens them. The
first run of the day measured the verbs carrying their arrival class with `animation-name: none`.
The rule is now `main > .rb-section > :not([data-rb-chrome]) { animation: none !important }`
(`editor/canvasStillness.ts`): what it refuses is unchanged — everything the published page animates
is page content, which `canvasStillness.test.ts` still holds against the renderer's sheet — and the
chrome, which never travels to a published page, keeps the motion the editor's budget allows it
(`motionBudget.test.ts`). Recorded by development; it changes no published byte.
