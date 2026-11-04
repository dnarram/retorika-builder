# 0065 — The phone's sheet holds the page still, without a byte of script

**Status:** proposed · **Date:** 2026-11-04 · **Decided by:** David, 4 de noviembre de 2026, al
planificar el sprint 33 — his first decision with its two conditions (`scrollbar-gutter: stable`,
measured at 720 with a scrollbar drawn; the iPhone first on its list, and this ADR saying why) — and
his first adjustment approving the plan (a lock is measured by the wheel, never by `scrollTo`). ·
**Recorded by development at his instruction, with the standing note that development does not
sign.** · **Amends:** [ADR 0063](0063-the-bar-is-of-2026-and-it-is-the-same-for-every-site.md), its
note of sprint 32 día 4 («This is also why the body's scroll is not locked»). · **Relates to:**
[ADR 0058](0058-a-published-page-carries-one-script-and-it-is-constant.md) (still four writes),
[ADR 0057](0057-the-header-is-the-owners.md) (the header's phone is its own derivation, rule 7 does
not reach it) · **Touches:** `packages/renderer` (`phoneSheet`, `header.ts`).

## Context

David, opening sprint 33: in the editor's phone view, «Menú» opens onto a very long dark sheet, the
page seems to be only a menu, and the content is very far down. Reproduced on 4 November 2026 in the
three places he named before anything was touched (`docs/design/REVIEW.md`, sprint 33 día 1). In the
published page, at 390 × 844 and 320 × 568, in Chromium and in WebKit, with the bar fixed and not,
in ink and in surface:

| With the sheet open | Measured |
|---|---|
| The sheet's height against the window less the bar | equal: 788 / 788, 512 / 512 |
| A wheel of 2000 px over the sheet | `scrollY` 2000, in every case and both engines |
| A touch gesture of 1500 px (Chromium, CDP) | `scrollY` 1501–1507 |
| What is under the centre of the screen after the wheel, bar not fixed | `<body>`, blank |

The sheet does not overflow — its entries fit — so the wheel chains to the page. With a bar in the
flow the sheet is in the flow's coordinates and leaves with the bar, and what is left is the page's
full height with `<main>` hidden (ADR 0063's note: hidden so the keyboard cannot reach it): a blank
page as long as the content. With a fixed bar the sheet stays, and the page runs on behind it,
invisible, to wherever the visitor happens to let go. The note of sprint 32 día 4 decided not to lock
the scroll because «nothing behind can be seen or reached». Measured, the page behind does not need
to be seen for its scroll to carry the sheet away.

## Decision

### 1. While a sheet is open, the page does not scroll under it — by the stylesheet

In the phone's block (≤ 720 px), for each disclosure that is a sheet there — «Menú» always, «Ir a…»
where the phone shows it:

```css
html:has(.rb-nav-narrow[open]) { overflow: hidden; }
```

The root's `overflow` is the viewport's, so the visitor's wheel, finger and keys stop moving the page;
the sheet itself still scrolls inside when its entries outgrow it (`overflow: hidden auto`, the
rail's rule). `:has` is Baseline since 2023; where it is missing the page scrolls behind as it did.
**No script**: ADR 0058's four writes stay four, and its bytes are the same. The backlog row that said
a lock would cost «a fifth write» is closed by not needing one.

**Only the visitor's scroll is held.** `overflow: hidden` leaves a programmatic scroll free (David's
adjustment 1), which is what keeps «Ir a…» working: choosing an entry closes the sheet (the script) and
the browser goes to the anchor either way. Every assertion of the lock therefore scrolls as a person
does — `page.mouse.wheel`, and in Chromium a touch gesture over CDP — and reads `scrollY` after; a
`scrollTo` only places the page before the sheet opens.

### 2. And the page keeps its width when the lock comes and goes

```css
html { scrollbar-gutter: stable; }   /* in the same block, once */
```

On a phone the scrollbar overlays and nothing changes. In a narrow desktop window with a classic
scrollbar — Windows, Linux, or a Mac set to show them — `overflow: hidden` takes the scrollbar away
and the content widens by its width the moment the sheet opens, and narrows again when it closes.
With the gutter kept, the content's width is the same open and closed.

Measured at 720 × 900 in Chromium 153 with a real classic scrollbar of 15 px — launched without
Playwright's `--hide-scrollbars` and, on macOS, with the system's own `AppleShowScrollBars Always`
for that one process: the content 705 px wide closed and **705 open with the gutter, 720 without
it**. Two instruments were wrong first, and are named so nobody picks them up again: a scrollbar
styled with `::-webkit-scrollbar` takes 15 px, but Chromium keeps no root gutter for it (705 → 720
with the gutter too); and `documentElement.clientWidth` reads the full 720 under `overflow: hidden`
even while the gutter is kept, since the root has no scrollbar then. The content is what is measured.

### 3. The engines measured are desktop engines, and the iPhone goes first on its list

Chromium is measured with the wheel and with a touch gesture; WebKit and Firefox with the wheel — the
WebKit Playwright drives is the desktop one, and WebKit has no CDP to synthesise a finger. **Safari on
an iPhone did not respect `overflow: hidden` on the root for a touch scroll once its toolbar had
collapsed**: WebKit bug 240859 (2022), reproduced by a commenter on iOS 18.7.8 and not on iOS 26.4.2
(7 June 2026), resolved as moved to Safari on 8 June 2026, with a remaining case tracked as bug 317941
(26 June 2026). On an iPhone older than iOS 26 the page may still run behind the sheet as it did
before this ADR — no worse — and that is why the lock is **the first thing on the iPhone list** of PR
#250: open «Menú» on the phone of the sprint, drag the sheet, and see whether the page moved.

## What is preserved

- **The page at rest**: the eighteen goldens without a header are untouched, and the four with one
  gain the two lines and nothing else (diff read; none of the corpus puts «Ir a…» on the phone, so its
  lock is held by `header.test.ts`).
- **The script**, byte for byte: 829 B gzipped of the 2 KB.
- **The keyboard**: `<main>` is still hidden under the sheet (ADR 0063's note), and Escape still
  closes it and gives the focus back (the script, ADR 0058).
- **The canvas**: the rule is the header's own and reaches the `dom` sheet as every rule of the phone
  block does, so the editor's phone view holds still under «Menú» too — the same wheel, measured.

## What is lost, and it is named

- **A gutter in a narrow desktop window with a scrollbar drawn**, at or under 720 px: the page keeps
  room for a scrollbar that a short page does not need. On a phone, nothing.
- **An iPhone before iOS 26**: the lock may not hold under a finger once Safari's toolbar has
  collapsed (§3). Not measured on a device; first on the list.

## What this does not decide

- **Closing the sheet on a scroll attempt.** A press outside and Escape close it (the script); a
  scroll now does nothing, which is what a sheet that covers the screen means.
- **The rail and «Ir a…» on a wide screen.** Neither covers the page, and the page scrolls under them
  as it should.

## Consequences

- `packages/renderer`: `phoneSheet` (`header.ts`) writes the lock per disclosure; `headerMobileCss`
  writes the gutter once in its block; the four goldens with a header move by those lines, read.
- Tests: `header.test.ts` (the rules, inside the phone's block, once each); `header.browser.test.ts`
  (the wheel at 390 × 844 with a fixed bar and in the flow, at 600 and at the top, and a finger in
  Chromium; the sheet that overflows still scrolls inside at 320 × 568 with ten pages; the content's
  width at 720 with a classic scrollbar; «Ir a…» still lands on its section); `engines.browser.test.ts` (the wheel in the three
  engines); the editor's walk of sprint 33 día 1 (the canvas's phone view under the same wheel).
- Day by day in `docs/design/REVIEW.md`, sprint 33 día 1.

Sources read on 4 November 2026: https://bugs.webkit.org/show_bug.cgi?id=240859 ·
https://bugs.webkit.org/show_bug.cgi?id=153852
