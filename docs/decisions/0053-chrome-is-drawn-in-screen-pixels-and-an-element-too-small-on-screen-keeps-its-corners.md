# 0053 — Chrome is drawn in screen pixels, and an element too small on screen keeps its corners

**Status:** proposed · **Date:** 2026-10-25 · **Decided by: David, 23 de octubre de 2026**, answering
the question sprint 25 día 8 left open — whether the canvas's chrome keeps its size on screen when the
canvas is drawn smaller — «sí», with three conditions of his own and two adjustments made while
approving the sprint 27 plan, each quoted where it lands below · **Recorded by development, which does
not sign** · **Relates to:** [ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md)
§6 (the gestures' thresholds are already divided by the zoom),
[ADR 0051](0051-the-canvas-keeps-its-document-and-an-edit-is-a-patch.md) (the chrome is redrawn after
every patch), [ADR 0052](0052-the-keyboard-enters-a-section-and-the-bar-acts-on-the-words-the-hand-chose.md)
(the floating bar) · **Touches:** `apps/editor` only. **Neither `packages/renderer` nor
`packages/schema`: the published page does not change by a byte, and no golden moves.**

## Context

The canvas is the client's page laid out at desktop width — 1024 at the narrowest — and scaled into
whatever room the editor leaves it: `EditorShell` computes a zoom from that room and draws the card
with `transform: scale(zoom)`. For the page that is the point: the owner sees their site as it will be.
For the chrome drawn inside the frame over the page — the handles, the section's verbs, the text bar,
the outlines, the guides, the badges — it is a defect: the chrome is scaled with the page.

Measured on 25 October 2026 in Chromium at 1024 × 900 with «Diseño» open, where the zoom is
**0.7379**: a 44 px touch handle was **32.5** on screen, a 32 px verb **23.6**, the text bar's grip
**17.7 × 19.2** — under the 24 × 24 that WCAG 2.2 §2.5.8 asks of a pointer target, which
`chromeScale.ts` has cited since sprint 20 — the cluster's 8 px inset and the bar's 8 px gap **5.9**,
and a 2 px outline **1.48**.

What already existed: `zoomOf(iframeDoc)` measured the zoom from the frame's box against its own
layout width and divided the gestures' thresholds by it in four places (ADR 0050 §6). `handlesFor`
took a `target` argument nobody passed. The chrome's stylesheet was about seven hundred lines of
`px` literals. `redrawChrome` ran after a patch and when the design tools were switched, never when
the width changed. And the zoom was a `const` inside `EditorShell` that never crossed into the frame.

## David's conditions, literal (23 October 2026)

> 1. **Todo el cromo, no solo las asas.** Bordes de selección, guías (1 px), verbos, barra de texto,
>    insignias y anuncios visuales se dibujan divididos por el zoom, para que una línea de 1 px no
>    acabe en 0,74 y se vea borrosa.
> 2. **Degradación por tamaño en pantalla, como Canva.** Si el elemento mide en pantalla menos de
>    tres asas de ancho o alto, pierde las asas de borde de ese eje y conserva las esquinas. Los
>    cuatro steppers del panel siguen cubriendo el redimensionado (2.5.7). El umbral es un número en
>    pantalla, escrito en el ADR.
> 3. **El zoom cambia sin edición.** Abrir o cerrar un panel cambia el zoom sin tocar el documento, y
>    bajo el parche del sprint 26 el cromo solo se repinta tras una edición. El `ResizeObserver` que
>    recalcula el zoom también llama a `redrawChrome`. Una caminata abre «Campos» con un elemento
>    elegido y asevera que las asas miden lo mismo en pantalla antes y después.

And while approving the plan: **adjustment 1** — «tres por eje —esquina, borde, esquina— es el mínimo
sin solape con objetivos de 44 px; con dos, el asa de borde se monta sobre las de esquina», so the
threshold rises at zoom 1 as well; and **adjustment 5** — «también las distancias del cromo»: every
visual displacement of the chrome from the element is divided too, or at three quarters the chrome
grows while the air around it shrinks.

## Decision

### 1. Every length of the chrome is a length of the screen

`screenPx(n)` in `chromeScale.ts` writes `calc(Npx / var(--rb-zoom, 1))`, and the chrome's stylesheet
uses it for every length it declares: sizes, borders, outlines and their offsets, paddings, gaps,
radii written in the sheet, font sizes, the tooltip's `calc(100% + 6px)`, the arrival's `translateY`.
At zoom 1 it is N pixels exactly, so a canvas drawn at its own size draws exactly what it drew before.
Icons go through `screenIcon(n)`, because a presentation attribute cannot be divided by a variable:
the `width`/`height` attributes stay and an inline style that wins over them is added. The alignment
guides, which are drawn by script, are `screenPx(1)` thick.

**Three things keep the frame's pixels, on purpose:**

- **The gaps' bands between sections** (`.rb-gap`, its height and padding). They are the room the
  canvas's rhythm takes in the page's flow, and there are six of them: grown with the zoom, they would
  move the client's whole page down the frame each time a panel opened. The pill drawn inside each band
  is chrome and is divided; it fits its band at every zoom the canvas reaches.
- **The screen-reader-only live region** (`.rb-announce`), which is clipped to one pixel and drawn
  nowhere.
- **The scale's own string tokens** — `CHROME_SCALE`'s radii and shadows, which are `"12px"`-shaped
  strings interpolated into the sheet. Named here rather than converted: they are not what makes a
  control usable or a line legible, and converting them means changing the tokens' type for every
  other reader.

### 2. The distances too, in the stylesheet and in the arithmetic (adjustment 5)

In the sheet, by §1. In the script, where the chrome is placed by arithmetic: the text bar's gap from
its words (`TOOLBAR_GAP`), the inset that holds the cluster and the text bar off a section's edges
(`BAR_INSET`, in the clamp, the corners, the arrows and the drag), the room the verbs' word needs below
the cluster (`TIP_ROOM`), and the gap and inset of a menu anchored under a moved cluster — each divided
by `zoomOf(iframeDoc)` where it is used. `BAR_STEP`, the sixteen pixels an arrow nudges a bar, stays a
step of the frame: it is a distance the hand travels, not one the eye measures.

### 3. `--rb-zoom` is written on the frame's root, and it is a measurement

`writeZoom` writes `zoomOf(iframeDoc)` as `--rb-zoom` on the frame's `<html>`, which the patch never
touches: at wiring, at the start of every `redrawChrome`, and when the zoom changes (§5). It is the one
custom property of the chrome besides `--rb-enter-offset`, and for the same reason: only the code that
measures can write it. `chromeScale.ts`'s note that «a string cannot read a CSS variable from another
document» stays true of the tokens; the zoom is not a token.

### 4. The handles: forty-four on screen, and their thresholds on screen (condition 2, adjustment 1)

The painter passes `target: HANDLE_TOUCH / zoom` to `handlesFor`, the argument nobody passed, and the
stylesheet draws the target at `screenPx(HANDLE_TOUCH)` — so what is placed is what is drawn, 44 px of
the screen. Because every threshold inside `handlesFor` is a multiple of that target, every threshold
is a number of the screen, as condition 2 asks.

**The rule, written as development read it, for David to confirm.** A side keeps its midpoint handle
while the box is **at least three targets long on that side and two targets across it** — 132 px along
and 88 px across, on screen. The corners stay always.

- *Three along* is condition 2 and adjustment 1, read by adjustment 1's own reason: corner, edge,
  corner along a side. The top and the bottom handles sit between two corners on a side as long as the
  box is wide, so they need it three targets wide; the left and the right need it three tall.
- *Two across* is the rule sprint 25 día 7 found and is kept beside it. The top and bottom handles
  face each other across the box's height, and on a box under two targets tall they meet over its
  middle — where a finger drags a chosen element (ADR 0049 §7). **Measured on this day**: with the
  three-only rule, the top handle covered the centre of a 272 × 36 button in the unit test that guards
  that middle.

Where the two readings differ — a box three targets long but under two across, such as a heading of
528 × 52 — the element keeps its corners only, which is what it had before this ADR. The four steppers
of the «Colocación» panel keep covering resize for every size (WCAG 2.5.7), as condition 2 says.

### 5. The zoom changes without an edit (condition 3)

The canvas is `children` of `EditorShell` and the zoom is born inside the shell, so the notice is an
output prop: `onZoomChange(zoom)`, called from an effect when the zoom the shell computed changes —
after the card has its new `transform`, which is what `zoomOf` measures. The `Editor` answers with
`redrawChrome`, recorded in the probe as `redraw` with `cause: "zoom"`. **The edit serial does not
move**: nothing was edited, and a walk waiting for an edit must not be woken by a panel. Not a
`ResizeObserver` on the `<iframe>`: its `contentRect` ignores the `transform`, and the frame's own box
does not change when the card is scaled. The shell's own observer, which recalculates the room, is what
changes the zoom, so it is what triggers the redraw — condition 3 as written.

## What this does not decide

- **Whether the floating bar and the verbs should also be *placed* differently at a lower zoom.** They
  are placed in the frame's pixels by `barPosition`; only their sizes and their distances are the
  screen's. The plan named this as open and it stays open.
- ~~**The chrome that sits in the page's flow and is not a gap band** — the «Diseñada a mano» bar, the
  hole a deleted section leaves, the lines' «Añadir» pill. It is divided like the rest, so at a lower
  zoom it takes more of the frame and pushes what is below it by the difference. Read off the code, not
  measured: the «Diseñada a mano» bar opens its own room by its measured height (`--rb-enter-offset`),
  which is measured after the division, so its arrival still opens exactly the room it takes.~~
  **Measured and decided on sprint 28 día 2 (26 October 2026)** — the amendment at the end.
- **The outlines**, which is the part of condition 1 this does not meet (below).

## What is measured on día 7 (25 October 2026)

Chromium, 1024 × 900, the cover designed by hand, the headline chosen; the walks under `sprint 27 día
7` in `critical-flows.e2e.test.ts` measure every box in the frame's pixels and multiply by the zoom read
from outside the frame (the frame's box over its own layout width), so they do not take the editor's
word for it.

| With «Diseño» open, zoom 0.7379 | Before | Día 7 |
|---|---|---|
| a verb | 23.6 × 23.6 | **32 × 32** |
| the cluster's grip | 17.7 × 23.6 | **24 × 32** |
| the text bar's grip | 17.7 × 19.2 | **24 × 26** |
| the cluster's distance from its section's top and right | 5.9 | **8** |
| the text bar's distance from its words | 5.9 | **8** |
| a guide's thickness, an edge held at the section's centre | 0.74 by the arithmetic the condition names (not measured before) | **0.99** |
| the chosen section's 2 px outline | 1.48 | **1.48** — see below |

| With a finger, opening «Campos» with the headline chosen | Before | Día 7 |
|---|---|---|
| the zoom | 1 → 0.7379 | 1 → 0.7379 |
| a handle | 44 → **32.5** | 44 → **44** |
| the handles drawn | 8 → 8 | **6 → 4**: the headline is 320 × 104 on screen at zoom 1 and 224.7 × 76.7 at three quarters, under two targets across |
| verbs over the chosen element | none | none |

**The part of condition 1 that is not met: outlines.** The selection outline's rule reads
`calc(2px / var(--rb-zoom, 1))` — 2.71 px of the frame at this zoom — and **Chromium snaps an outline's
width and offset to whole device pixels when it computes them**: `getComputedStyle` answers «2px» for
the width and «-2px» for the offset, with `--rb-zoom` at 0.7379 and a device pixel ratio of 1. So on
screen the outline is 1.48 px, before this day and after it. What is drawn as a box comes out exact —
the guide is 0.99 — and what is drawn as an outline does not, at this zoom; at a zoom where the divided
width falls just above a whole pixel it does (3.03 → 3 at 0.66, which is 1.98 on screen — by the same
arithmetic, not measured). On a 2× screen the snap is to half pixels: 2.71 → 2.5 → 1.84 on screen
(arithmetic, not measured). **The options, for David**: draw the selection as a box — a `box-shadow`
ring or a pseudo-element — which is exact on screen and which forced-colors mode drops, the very reason
the focus rings in this stylesheet are outlines; or accept the outline as it is.

**A crash the first full run found, and two more of the same kind it pointed at.** The first full
suite with this ADR's code went red on «nada sobresale en un móvil» at 320 and at 768: 30 s waiting
for the cover after «Ver a tamaño real», and the page had thrown `TypeError: Cannot read properties of
null (reading 'dataset')`. On a phone the shell's first zoom arrives while the frame has a document
and no root yet — a state the walks' own `editSerialOf` already names — and
`onZoomChange` read `documentElement.dataset` on it inside an effect, which took the whole editor down.
Read with `?.` it is a frame not wired yet, and the redraw waits for the wiring. Two older effects
read the same mark the same way (the switch's redraw and the patch), so they got the same two
characters; they had not been seen crashing, and whether either is the intermittent that sprint 17's
mouseless walk has hit in CI since día 4 — same wait, same line — is **not established**.

**Sabotages.**

| Sabotage | What went red |
|---|---|
| `screenPx` returning the frame's pixels (the sheet without the division) | both walks: a verb 23.6, a handle 32.5 |
| `onZoomChange` answered with nothing | both walks — the zoom written at wiring stayed, so opening «Diseño» or «Campos» left the chrome at the old size |
| sizes divided, distances not (the cluster's inset in the sheet, the bar's gap in the arithmetic) | both walks, at the distances: the cluster 5.9 from its section's top. **Not** at «no verb over the chosen element», which the plan named: on this cover the cluster is never near the headline, so it is the distance assertions that guard adjustment 5 |

## Decided on 25 October 2026, by development, under David's delegation

The three questions this ADR left for David were answered by development on 25 October 2026, when he
wrote, merging the pull request of día 7: «Actua como experto y decide lo mejor para el proyecto para
conseguir los objetivos marcados en el proyecto». Recorded as that, not as his signature.

1. **The handles' rule stays three along and two across.** It is the only reading that keeps both of
   his conditions true at once: condition 2's corner–edge–corner, and the middle of a chosen element
   free for the finger that drags it — the literal three-only rule was measured covering the centre
   of a 272 × 36 button. Where the two differ the element keeps its corners, which is what it had.
2. **The outlines are accepted as Chromium draws them.** What snapping costs is at most one pixel of
   the frame — 0.52 of the screen for the 2 px selection at 0.7379 — and the outline stays visible
   and in contrast, which is what WCAG 1.4.11 asks of a state's marker; it asks nothing of its
   thickness. Drawing the selection as a box would make it exact and would make it disappear in
   forced-colors mode, for the people who most need to see what is chosen — the same reason this
   stylesheet keeps its focus rings as outlines. And it would mean rewriting half a dozen outline
   rules and the walks that measure them for a change the eye cannot reliably see.
3. **What keeps the frame's pixels stays as built**: the gaps' bands (so a panel never moves the
   client's page), the screen-reader-only region, and the scale's string tokens. Every control and
   every word of the chrome is at screen size, which is what the ADR is for.

## Consequences

- **The chrome measures on screen what it measures at zoom 1**, at every width the canvas is scaled
  to, and the walks say so in numbers.
- **The handles a box gets depend on the zoom**, which is condition 2 working: the same element can
  have its edge handles at 1440 and only its corners at 1024 with a panel open.
- **Flow chrome grows in the frame at a lower zoom**, by a measured amount, and stays at screen size
  (the amendment of 26 October 2026).
- **Two ADRs proposed in this sprint on top of ten unsigned**: 0052 and this one.

**Still `proposed`.** This ADR until David signs it.

## Amendment — the chrome in the page's flow at a lower zoom, measured (26 October 2026, sprint 28 día 2)

**What was open.** Three pieces of chrome sit *in the page's flow* rather than over it: the «Diseñada
a mano» bar before a hand-designed section, the hole a deleted section leaves, and the «Añadir» pill
under a section's lines. Divided by the zoom like every other length of the chrome (§1), each takes
more of the frame at a lower zoom and pushes what is below it by the difference — read off the code
when this ADR was written, and not measured. The plan for sprint 28 día 2: measure first, then decide
with this ADR in the hand, and write the decision here even if it is «as built».

**Measured**, Chromium at 1024 × 900, the design tools on, the walk «a 1024, la barra «Diseñada a
mano», el hueco y la píldora «Añadir» miden lo mismo en pantalla…» in `critical-flows.e2e.test.ts`,
«Diseño» closed (zoom 1) against open (zoom 0.7379):

| In the flow | Frame px | On screen | What is below moves, with «Diseño» open |
|---|---|---|---|
| the «Diseñada a mano» bar | 44 → 57.9 | 44 → 42.7 | **13.9** px of the frame more (10.3 on screen) |
| the hole (its box; 22 px of margin above and below it, 138 → 185.2 in all) | 94 → 125.6 | 94 → 92.7 | **47.2** (34.8 on screen) |
| the lines' «Añadir» pill (10 px of margin above it, 40 → 54.2 in all) | 30 → 40.7 | 30 → 30 | **14.2** (10.5 on screen) |

In both states the next thing in the flow starts exactly after the box and the margin under it: each
piece opens the room it takes and nothing else moves. The page's own sections and the gaps' bands keep
their frame pixels, as §1 says.

**The 1.3 px on screen is the font, not the division.** Every line box inside the bar and the hole is
about one pixel of the screen shorter at the lower zoom — the badge 23 → 22, the name 15 → 14, «Volver
a la original» 25 → 24, the hole's two sentences 18 → 17.7 and 16 → 15.5 — because a `line-height:
normal` line box is built from font metrics Chromium rounds to whole pixels, and 11 px of the screen
is 14.9 of the frame. The same family as the outline snap in «What is measured on día 7», and below
anything the eye reads. The pill, whose height is its padding, comes out exact.

**Decision: as built — every piece stays at screen size and opens its room by its own height.**

1. **All three carry a control or words**: «Volver a la original» is a button, the pill is a button,
   the hole is two sentences. Kept in the frame's pixels like the gaps' bands, the button would be
   23.6 px tall at 0.7379 — under the 24 × 24 of WCAG 2.2 §2.5.8 that this ADR exists to meet. The
   bands keep the frame's pixels because they are rhythm with a pill *inside* them that is divided;
   these are not rhythm.
2. **The cost is bounded and only while a panel is open**: ten to thirty-five pixels of the screen per
   piece, the hole being transient and the bar one per hand-designed section. A page with three
   hand-designed sections and a panel open is about forty frame pixels longer than it would be in the
   frame's pixels.
3. **Nothing moves under the hand because of it.** The bar's arrival opens exactly its measured room
   (`--rb-enter-offset`, measured after the division). When a panel opens, a piece above what is on
   screen grows behind the browser's own scroll anchoring, which sprint 28 día 1 measured absorbing a
   220 px re-flow; the room the page is given at its end (`overscrollFor`) is what keeps the greatest
   scroll from falling. A piece *inside* what is on screen while the panel opens moves the content
   below it by the numbers in the table, up to 47 px of the frame for a hole — the same kind of move as
   the chrome's own growth, which condition 1 asked for, and accepted with it.

Nothing in `apps/editor` changes for this amendment; the walk that measured it stays, asserting the
rule of §1 on the flow chrome — the same size on screen at either zoom, within the two pixels the font
costs — and that what is below starts after the box and its margin.
