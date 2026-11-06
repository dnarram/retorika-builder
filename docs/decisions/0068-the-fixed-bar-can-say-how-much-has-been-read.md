# 0068 — The fixed bar can say how much has been read

**Status:** proposed · **Date:** 2026-11-06 · **Decided by:** David, 5 de noviembre de 2026, opening
sprint 34 — his fifth decision: the reading-progress line of the fixed bar is **an owner's option,
off**, with three conditions (it is offered only with «Se queda arriba al bajar» and its key goes when
the fixed bar does; the generator never turns it on; it is decorative — `aria-hidden`, never a landmark
nor a `progressbar` with a value, and inside the bar, so it does not count against the phone bar's
72 px) — and, approving the plan, his adjustment 3: **the line reads `scroll(root)`, written out**. ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** · **Amends:** [ADR 0062](0062-the-published-site-moves-just-enough-without-a-byte-of-script.md)
(its closed list of what the published page moves gains one entry; §7's «no switch» stays true of the
page's own motion, and this one is the owner's) · **Relates to:**
[ADR 0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md) (the fixed bar it lives on),
[ADR 0058](0058-a-published-page-carries-one-script-and-it-is-constant.md) (no byte of script),
[ADR 0057](0057-the-header-is-the-owners.md) (the header is the owner's) · **Touches:**
`packages/schema` (`header.progress`, schema 1.18.0, migration `0019`), `packages/renderer`
(`header.ts`), the «Menú» panel. No byte of the script.

## Context

A fixed bar (ADR 0063 §3) stays at the top while the visitor reads; on a long page it says nothing of
where they are in it. Browsers of 2026 can drive an animation by the scroll of a container, with no
script: a line at the foot of the bar that grows as the page is read is a transform on a timeline —
nothing laid out, nothing measured. The sprint 33 backlog priced it at half a day. David took it with
his conditions, and with the one decision a timeline asks: **which scroller it reads**.

## Decision

### 1. An owner's option, only on a fixed bar, off for every site

`header.progress` is `true` or absent. The schema **refuses it without `sticky: true`** (a refinement on
the header), so the state nobody can see is a state nobody can save. The «Menú» panel offers «Muestra
cuánto se ha leído» only under a ticked «Se queda arriba al bajar», with its note — «Al publicar, una
línea en el borde de la barra crece a medida que se baja. En el lienzo no se ve.» — and **unticking the
fixed bar takes the key away in the same patch** (`stickyPatch`), one step of history, so «Deshacer»
brings both back together. The generator never writes it, nor the fixed bar: a new site is born
without either (David's condition b, held by a test over every sector and main action).

### 2. Two pixels at the bar's foot, a transform on the root's scroll

On the published page, `data-progress` on the header and the bar's own `::after`: absolute at its foot,
2 px, from the left — `transform: scaleX()` from 0 to 1 on `@keyframes rb-progress`, `animation:
rb-progress auto linear both`, **`animation-timeline: scroll(root)`**. A transform: no layout, so no
layout shift. In the primary over `surface` and the transparent bar, in `surface` over the coloured
schemes, as the indicator under the current entry is. **Written out as `scroll(root)` and never
`scroll()`** (adjustment 3): `scroll()` follows the nearest scroller, which is the root today — and the
day an ancestor of the bar had `overflow`, the line would stand still and nothing would turn red. The
engines' test reads the computed value.

### 3. Only for somebody who has not asked for less, and only where the browser can

The block sits inside `@media (prefers-reduced-motion: no-preference)` and `@supports
(animation-timeline: scroll(root))`, and the line is **empty before its animation** (`scaleX(0)`): an
engine without scroll timelines draws nothing rather than a full bar. Measured on día 6 from the real
ZIP opened from disk at 1280: **Chromium 153 and WebKit 26.6** read `scroll(root)`, the line at 0 at
the top and 1 at the bottom; **Firefox 155** has no scroll timelines and draws no line; under reduced
motion, none in any engine.

### 4. Decorative, inside the bar, and not where the bar is not fixed

A pseudo-element with no text is in no accessibility tree: no landmark, no `progressbar`, no value read
out (condition c). It lies inside the bar, so the bar measures the same with it and without it — the
phone's 72 px is untouched. No line where the fixed bar lets go over the sections' row on a phone (it is
in the flow there, ADR 0063's note of sprint 33 día 3), nor where the bar collapses to nothing with every
menu in a column (it would lie across the top of the page).

### 5. For the published page only

The canvas carries no `animation-timeline` — the lesson of sprint 32 día 1 on functions that break the
canvas's scroll anchoring by their mere presence — and the canvas is still anyway (ADR 0062 §5). The
attribute is in both targets, as every attribute of the header is; the rule is not. **The published and
the canvas's sheets now differ in three blocks**: the page's motion, the anchored indicator, and this
line where the bar carries it (`motion.test.ts`).

## What is preserved

- The script: not a byte (ADR 0058). The phone bar's 72 px. Every saved site: the key is absent from all
  of them, and `up` of `0019` seals and moves nothing.
- ADR 0062 §7 — the page's motion has no switch — is still true of what it governs. This is the owner's
  option on the owner's bar, and the visitor's `prefers-reduced-motion` still governs it.

## What is lost, and it is named

- **Firefox 155 shows no line.** The site is the same without it.
- **The canvas does not show it**, by §5, and the panel says so.

## Consequences

- `packages/schema`: `header.progress` (`z.literal(true)`), the refinement, `SCHEMA_VERSION` 1.18.0,
  migration `0019` (`down` drops the key and keeps the fixed bar), the snapshot.
- `packages/renderer`: `HeaderSettings.progress`, `data-progress`, `progressCss` (html target only),
  `collapseBar` hiding the line under a bar of no height. Goldens unchanged: no corpus site carries it.
- The editor: `stickyPatch`, `progressPatch`, the box and its note.
- Tests: the migration's round trip and refusal; the sheet and the canvas's (`header.test.ts`,
  `motion.test.ts`); the patch; the generator; the three engines (`engines.browser.test.ts`); the
  Lighthouse subject «cabecera fija con logo» with the line on; a walk.
- Day by day in `docs/design/REVIEW.md`, sprint 34 día 6.
