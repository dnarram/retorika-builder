# 0058 — A published page carries one script, constant and dispensable, and only where a header is drawn

**Status:** proposed · **Date:** 2026-10-29 · **Decided by:** David, 28 de octubre de 2026, al
aprobar el plan del sprint 30 — the plan named this as the first of «dos cosas que el plan decide por
su cuenta» and he approved it with one adjustment, quoted in §4. · **Recorded by development at his
instruction, with the standing note that development does not sign.** · **Amends:**
[ADR 0001](0001-static-sites-no-runtime.md) (its reading), [ADR 0023](0023-the-menu-and-the-footer-are-derived-chrome.md),
[ADR 0043](0043-the-menu-splits-in-two-and-the-owner-chooses.md) · **Relates to:**
[ADR 0057](0057-the-header-is-the-owners.md), [ADR 0051](0051-the-canvas-keeps-its-document-and-an-edit-is-a-patch.md) ·
**Touches:** `packages/renderer`, `scripts/size-budget.ts`

## Context

ADR 0001 is the constraint everything rests on: a published site is static HTML and CSS that works
from `file://`. It wrote, in the same breath, where a script may appear — «JavaScript appears only in
the sections that genuinely need it — carousel, accordion, form — and counts against an explicit
budget» — and the protocol (Part 8.5) gave the budget: 8 KB gzipped per interactive section, zero
when nothing needs one. No section has needed one. `scripts/size-budget.ts` has failed on any
`<script` since sprint 1, and ADR 0023 and ADR 0043 each wrote «it costs no JavaScript» about the
menu, and meant it.

Three of the six things David named for a professional header (sprint 30 plan) cannot be had
without a script: **Escape** closing the phone's menu and giving the focus back, the **section in
view** marked in the sections menu, and the **shadow** a fixed bar grows once the page has scrolled.
A `<details>` closes on its own `<summary>` and on nothing else; which section is in view is a
question only the browser can answer, and only at run time; and whether the page has scrolled is the
same kind of fact. So the header is the first thing on a published page that genuinely needs one,
which is exactly the case ADR 0001 reserved the word for.

## Decision

### 1. One inline script, constant, at the end of the body

`packages/renderer/src/headerScript.ts` exports **one string**. The `html` target writes it as the
last child of `<body>`, inline — the page opens from `file://`, and one more file is one more thing
to go wrong there — and writes it **only on a page that draws a header** (`headerDrawn`, ADR 0057).
A page with no header carries no script, so «zero JavaScript when no section needs it» stays a
sentence about those pages that is literally true.

**Nothing of the document is in it.** It is the same bytes on every page of every site of every
owner. That is the whole of its security property, and it is asserted rather than trusted:
`headerScript.test.ts` renders two documents — one of them with `<script>` in its business name —
and asserts the same script, equal to the constant, holding no `<`. A script no owner's words can
reach cannot carry anybody's words into a page.

### 2. What it does, in order, and what works without it

| Without the script | With it |
|---|---|
| The `<details>` opens and closes from its `<summary>` | Escape closes it and gives the focus back to «Menú»; a press outside closes it |
| Anchors land; a fixed bar is `sticky` and sections make room by the stylesheet's **estimate** of its height (`--rb-header-h`) | `--rb-header-h` is the bar's real `offsetHeight` |
| A fixed bar has no shadow | `data-scrolled` once the page has scrolled, and the stylesheet draws the shadow |
| No entry says which section is in view | The entry of the section most in view carries `aria-current="location"` (`IntersectionObserver`; nothing on a browser without one) |
| A **transparent** bar that is also fixed is **not fixed**: it lies over the cover and scrolls away with it | `data-rb-js` on `<html>` is written first, and only under that mark is a transparent bar fixed — turning to the `surface` scheme once scrolled |

The last row is David's adjustment 1b: «`transparent` y `sticky` no pueden convivir sin script (una
barra transparente fija sobre texto es ilegible)». The stylesheet's base says `absolute`; the mark
says `fixed`; the script writes the mark. Without the script nothing is fixed and nothing is covered.

No network, no `eval`, no storage, no reading of anything but the header and the sections the header
already links to. Four writes: an attribute on `<html>`, a custom property on `<html>`, an attribute
on the header, `aria-current` on the header's own links.

### 3. The budget: 2 KB gzipped, printed with every run

The protocol allows 8 KB per interactive section. This one is held to **2 KB gzipped**, a quarter of
that, by `headerScript.test.ts` and by `pnpm size`, which weighs the constant once and prints it with
the budget: **0.7 KB on 29 October 2026**. `pnpm size` now fails on any page whose count of `<script`
differs from what `headerDrawn` says — one or zero — so a second script anywhere is still a
regression and not a judgement call.

### 4. The `dom` target does not carry it — the one divergence between the two targets

«One renderer, two targets» (CLAUDE.md, protocol 3.2) exists so the owner never sees one thing while
editing and another once published. This script is the one place the targets differ, and the ADR
says so rather than letting `parity.test.ts` discover it: the editor's canvas is patched by morphdom
(ADR 0051), which would fight every attribute this writes, and the editor has its own scroll, its own
selection and its own «Menú». So the canvas shows the header without the section in view marked and
without the fixed bar's shadow — and the parity test asserts that the script is the **last** root,
**the constant**, present where and only where a header is drawn, and compares every other root node
for node as before.

## What is preserved

- **ADR 0001's constraint**: static HTML and CSS, working from `file://`, no API of ours. The script
  calls nothing. The e2e walk that opens the ZIP from disk still asserts no failed request.
- **ADR 0016**: no `<input>` on a published page; the disclosure is still a `<details>`.
- **Progressive enhancement is the design, not a fallback**: every row of §2's left column is
  tested with the script stripped out (`header-script.browser.test.ts`).

## What is lost, and it is named

- **«It costs no JavaScript»** (ADR 0023, ADR 0043) stops being true of a page that draws a header.
  The menu itself still costs none — the lists, the `<details>`, the anchors — but the page carries
  the header's script, and the sentence is amended in both ADRs.
- **A reader of the published source finds a `<script>`** where for thirty sprints there was none.
  Inline, 0.7 KB, readable, and the same on every site.

## What this does not decide

- **Any second script.** A carousel, an accordion, a form: each is its own decision against the
  protocol's 8 KB, and `pnpm size` fails on it until that decision is written.
- **Running the script in the canvas.** Named above as the divergence; reopening it means teaching
  morphdom to keep the attributes the script writes, which is ADR 0051's territory.
- **An external file instead of inline.** Reopened the day a second script exists and the two share
  code worth caching.

## Consequences

- `packages/renderer`: `headerScript.ts` (the constant), `html.ts` (`pageToHtml` takes the script),
  `index.ts` (passes it where `headerDrawn`). `dom.ts` untouched. The four goldens that draw a header
  gain one line; the sixteen that do not are untouched.
- `scripts/size-budget.ts`: the script's own line and ceiling; the per-page count against
  `headerDrawn`.
- `packages/renderer/test`: `headerScript.test.ts`, `header-script.browser.test.ts`, `parity.test.ts`
  (the declared divergence), `menu.test.ts` («costs no JavaScript» inverted).
- Day by day in `docs/design/REVIEW.md`, sprint 30 día 2.
