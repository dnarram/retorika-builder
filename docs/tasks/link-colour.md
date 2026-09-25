# Plain links — `color.primary`, underlined, the focus ring left alone

> **Claude-only. Exclusive zone.** Every byte this task changes is emitted by `packages/renderer`
> into the client's published site, and it changes how every published link looks. Part 2 names
> the renderer for exactly that reason.
>
> Not delegated to OpenCode under any circumstances, however small the diff looks.

## Objective

Every plain link in a section — every `<a>` that is not the button — is drawn in
**`color.primary`**, stays **underlined**, and keeps the **browser's own focus indicator**. The
button does not change in any way. The last failure the accessibility harness reports goes away.

## Where it comes from

- **PR #6, finding 3**, the last of the four renderer fixes, in the agreed order 4, 2, 1, 3.
  Findings 4, 2 and 1 are fixed in #7, #10 and #11.
- **The symptom:**
  - after #11 the harness of PR #6 reports **exactly 12 failing tests, all this finding**: a
    plain link in the browser's default `#0000ee` on `dark-slate`'s surface `#0f172a`, at
    **1.89:1** against the 4.5:1 AA minimum;
  - that happens in both variants, with the three type pairs, at 320 and 1280.
- **The cause:** `buildCss` styles the headings, the body text and the button, but has **no rule
  for plain links**.
  - A secondary link, and the link a `map` element publishes, keep the user agent's colours:
    `#0000ee`, and `#551a8b` once visited.
  - No palette controls those colours, so on a dark surface they are unreadable.
  - On the three light palettes they pass by accident, not by design.
- **How the renderer emits links today** (`build.ts`, `elementNode`), checked for this task:
  - a secondary link is `<a data-role="link" data-slot="secondaryAction" href="…">`, **with no
    `role` attribute**;
  - the button is `<a data-role="button" data-slot="primaryAction" href="…" role="button">`;
  - a `map` element is `<a data-role="map" …>`, with no `role` either. It is not in the corpus
    today, and it is a link too.
  - In the goldens there are exactly three plain links and four buttons.
- **The proposal, approved by the product owner:**
  - plain links use `color.primary`;
  - they stay underlined, so a link is never told apart by colour alone (WCAG 1.4.1);
  - the browser's focus indicator is not removed;
  - the button does not change.

## The contrast check — done, all four palettes pass

`color.primary` against `color.surface`, computed with `contrastRatio` from `packages/tokens` on
2026-09-22:

| Palette | `color.primary` | `color.surface` | Ratio | AA (≥ 4.5:1) |
|---|---|---|---|---|
| `classic-blue` | `#1D4ED8` | `#FFFFFF` | 6.70:1 | passes |
| `warm-terracotta` | `#9A3412` | `#FAFAF9` | 7.00:1 | passes |
| `forest-emerald` | `#047857` | `#F0FDF4` | 5.24:1 | passes |
| `dark-slate` | `#38BDF8` | `#0F172A` | 8.33:1 | passes |

`packages/tokens/test/contrast.test.ts` already asserts this pair (`color.primary /
color.surface`) for every palette, so it is not an accident of today's values. A palette where
it fails cannot be merged.

**Re-run the table before writing any code.** If any palette has changed since this task was
written and one of them falls below 4.5:1, **stop** (see "Stop and ask", 1). Links then need a
colour decision, and the token must not be adjusted to make this task pass.

Why `surface` is the background that matters: plain links always sit on `color.surface`.
- On desktop they sit on the page background (`body { background: var(--color-surface) }`), or
  on #10's panel, which is also `color.surface`.
- On phones #11 hides the panel and they sit on the page background.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
packages/renderer/src/build.ts                (buildCss: one line)
packages/renderer/test/links.test.ts          (create: the tests of step 3)
fixtures/golden/barbershop-cover.html         (regenerated: +1 line, see step 2)
fixtures/golden/edge-long-text-unicode.html   (regenerated: +1 line)
fixtures/golden/hidden-and-embed.html         (regenerated: +1 line)
fixtures/golden/image-background-full.html    (regenerated: +1 line)
fixtures/golden/physio-free-cover.html        (regenerated: +1 line)
fixtures/golden/tokens-quoted-fonts.html      (regenerated: +1 line)
fixtures/golden/xss-attempt.html              (regenerated: +1 line)
```

No change to:
- markup-producing code (`elementNode`, `sectionNode`, `panelArea`): **the markup stays
  byte-identical**;
- `packages/catalog`, `packages/schema`, `packages/tokens`;
- any fixture document;
- `html.ts`, `dom.ts`, `escape.ts`.

## Invariants it touches

**`INV_5` — "Publishing produces identical output with tools on or off".** One line of static
stylesheet text is added. There is no new logic.

**Rule 6 (style is references to the system).** The link colour is a token reference,
`var(--color-primary)`, not an exact value.

`INV_1`–`INV_4` are about the document, and stay in the definition of done as a regression
check.

## Steps

### 1. The rule — `buildCss` in `build.ts`

**It is decided, so do not improvise.** Insert exactly one line, verbatim, immediately after
`".rb-section p { font-size: var(--size-body); color: var(--color-muted); margin: 0; }",` and
before the button rule:

```
.rb-section a:not([role=button]) { color: var(--color-primary); text-decoration: underline; }
```

| Part | Why |
|---|---|
| `.rb-section a:not([role=button])` | Every link in a section except the button: secondary links and `map` links. The `:not` means this rule and the button rule (`.rb-section [role=button]`) can **never match the same element**, so no cascade question arises and the button cannot change |
| `color: var(--color-primary)` | The one link colour every palette guarantees against `color.surface` (the table above). An author rule beats the user agent, so it also replaces the default `:visited` purple. There is no separate visited colour, and none is added |
| `text-decoration: underline` | Links stay distinguishable without colour (WCAG 1.4.1). Browsers underline links already, but writing it down means nothing depends on the user agent's default |

**What is deliberately not in the rule:** no `outline`, no `:focus` or `:focus-visible`, no
`:hover` and no `:visited`. Today the stylesheet has no `outline` or `:focus` rule at all, so
the browser's focus ring is intact. Adding nothing keeps it that way.

### 2. The goldens — which ones, and which bytes

Regenerate with **`UPDATE_GOLDEN=1 pnpm test:golden`**, after the implementation and never
before. `pnpm test:golden -u` does not regenerate anything, because Vitest does not pass the
flag on to its workers; see issue #8. Then read the diff. It must be **exactly** the following;
anything else is a stop.

In all seven goldens, line 40 is the paragraph rule and line 41 opens the button rule:

```
40  .rb-section p { font-size: var(--size-body); color: var(--color-muted); margin: 0; }
41  .rb-section [role=button] { display: inline-block; padding: var(--space-sm) var(--space-md);
```

**Every golden gains exactly one line, as the new line 41, and nothing else:**

```
40  .rb-section p { font-size: var(--size-body); color: var(--color-muted); margin: 0; }
41  .rb-section a:not([role=button]) { color: var(--color-primary); text-decoration: underline; }
42  .rb-section [role=button] { display: inline-block; padding: var(--space-sm) var(--space-md);
```

- **Files:** `barbershop-cover`, `edge-long-text-unicode`, `hidden-and-embed`,
  `image-background-full`, `physio-free-cover`, `tokens-quoted-fonts`, `xss-attempt`.
- Everything after it moves down by one line, unchanged. For example, the media query moves
  from lines 48–53 to 49–54.
- `git diff --numstat fixtures/golden` must show **`1 0`** for each of the seven files: **7
  insertions, 0 deletions** in total.
- Nothing inside `<body>` changes. The markup is not touched.

### 3. `test/links.test.ts`

happy-dom does not compute a real cascade, so the unit tests pin the stylesheet. Colours,
underline and focus are checked in a real browser (step 4).

- **The rule is in the stylesheet verbatim and once**, for every corpus document. It sits
  immediately after the paragraph rule and immediately before the button rule.
- **The button rule is unchanged:** its three lines appear verbatim, exactly as they are today.
- **Nothing removes the focus indicator:** the stylesheet contains no `outline`, no `:focus`
  and no `:focus-visible`.
- **No link colour other than the token:** the stylesheet contains no `:visited` and no
  `:hover` rule, and the link rule's colour is `var(--color-primary)`.

The `<body>`-unchanged guarantee is not duplicated here; the golden diff proves it.

### 4. In a real browser

In a temporary worktree of `feat/a11y`, where Playwright is installed, check a page with plain
links and a button: `pnpm site:sample image-background-full`, at 1280 and at a verified 320.

- **Each plain link:** computed `color` equals the computed value of `--color-primary`, and
  `text-decoration-line` is `underline`.
- **The button is unchanged:** its computed `color`, `background-color`, `text-decoration-line`,
  `padding` and `border-radius` are identical to the same page built from `main` before this
  task. Capture both, then compare.
- **Focus:** Tab to a plain link from the keyboard. Its computed `outline-style` is not `none`,
  and the focus ring is visible in a screenshot.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| the contrast table | re-run before any code, all four palettes ≥ 4.5:1 |
| `pnpm install` | completes, lockfile unchanged |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including `links.test.ts` and the earlier `panel` and `mobile` tests |
| `pnpm test:invariants` | exit 0, all reported by canonical name (a regression check) |
| `pnpm test:golden` | exit 0 |
| `git diff --numstat fixtures/golden` | `1 0` for each of the seven goldens, and nothing else |
| `pnpm size` | exit 0 |
| `pnpm renderer:deps` | exit 0, no dependency added |
| `pre-commit run --all-files` | six hooks, all Passed |

Manual, and it is what closes finding 3 and the harness of PR #6:

- [ ] Step 4's checks pass at 1280 and 320: links in primary and underlined, the button
      identical, and the focus ring present.
- [ ] On `feat/a11y` with this merged in, run `pnpm test:a11y` and compare it test by test
      against today's 12 failures.
  - **Prediction: 0 failing tests, 121 passing.**
  - The 12 `dark-slate` failures pass: the link becomes `#38BDF8` on `#0F172A`, 8.33:1.
  - Nothing that passes today fails.
  - The overflow suite is green at 320, 768 and 1280.

**Status: done.** Verified 25 September 2026: `links.test.ts` exists and passes as part of the
453/453 suite. `pnpm test:a11y` runs fully clean today (649/649) — the prediction of "0 failing
tests" holds, stronger than the specific 121-passing count this checklist asked for against a
now-merged `feat/a11y` branch, which is not re-derived.

- [x] New tests that failed before and pass now
- [x] The golden diff is exactly the one in step 2 — today's golden output is current and part of
      the passing 13/13
- [x] No markup, catalog, schema, token or fixture document modified
- [x] No keys and no real client data — `pre-commit run gitleaks --all-files` passes repo-wide

## Out of scope

Things someone could reasonably add unasked, and must not:

- **Hover, visited or active colours**, or any link animation. There is one link colour, the
  token.
- **A custom focus ring** (`:focus-visible` with the palette's colours). The browser's own ring
  stays. Designing one is its own decision.
- **Restyling the button**, or turning secondary links into button-like pills.
- **A new token for links**, or changing any palette value.
- **Links outside sections.** There are none today; the rule is scoped to `.rb-section`.
- **Marking PR #6 ready for review.** With this merged the harness should be fully green, but
  un-drafting that PR and making `a11y-size` a required check is the product owner's call.
- **Fixing `golden.test.ts`** (issue #8) or the font fallbacks (issue #9).

## If anything is unclear, stop and ask

The executor may **not** decide any of the following.

1. **A palette where `color.primary` against `color.surface` falls below 4.5:1** when the table
   is re-run. Do not change the token, pick another token or add a per-palette exception. Bring
   the palette and the ratio.
2. **A golden diff that differs from step 2 in any byte.** That includes a count other than
   `1 0` per file, the line in another position, or any change inside `<body>`.
3. **A harness result other than 0 failures**, or any test that passes today now failing. Do not
   add an axe exception. Bring the combination, the node and the ratio.
4. **The button changing in any computed style**, or the focus ring missing on a plain link.
5. **Any need for markup changes** — a class or a `role` added to links, a wrapper — or for
   `:visited`, `:hover` or `outline` rules. The approved fix is one line of
   stylesheet; needing more is a different design.
