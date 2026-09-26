# Mobile layout — one element per row, the photo first, nothing on top of anything

> **Claude-only. Exclusive zone.** Every byte this task changes is emitted by `packages/renderer`
> into the client's published site, and it changes what every published page looks like on a
> phone. Part 2 names the renderer for exactly that reason.
>
> Not delegated to OpenCode under any circumstances, however small the diff looks.

## Objective

Below 720px, every section becomes **a single column with one element per row**. No element
overlaps another. In `image-background` the photo sits **on top, fully visible**, with the text
**below it, on the page's background colour**, and the panel no longer covers the photo. The
headline that axe could not measure at 320px becomes measurable.

## Where it comes from

- **PR #6, finding 1**, the third of the four renderer fixes, in the agreed order 4, 2, 1, 3.
  Findings 4 and 2 are fixed in #7 and #10.
- **The symptom:**
  - on phones, `image-right` draws the photo over the headline;
  - the secondary link sits on top of the "Pedir cita" button, and axe measures the link
    against the button's own background: 1.4:1 on `classic-blue`, 1.28:1 on `warm-terracotta`,
    1.71:1 on `forest-emerald`, 4.38:1 on `dark-slate`;
  - in the harness of PR #6 it is involved in **24 of the 30 failing tests** that remain today:
    21 fail for this reason alone, and 3 also carry a finding-3 line.
- **The cause** is the media query in `buildCss` (`packages/renderer/src/build.ts:225-227`):

  ```
  @media (max-width: 720px) {
    .rb-section { grid-template-columns: 1fr; padding: var(--space-lg); }
    .rb-section > * { grid-column: 1 / -1 !important; }
  }
  ```

  - It forces every element to the full width but leaves each element's inline `grid-row`
    untouched.
  - Elements that sat side by side on the desktop grid therefore land in the same cell.
  - A survey of the corpus for this task found that **every section with an image collides
    today**, catalog and free alike:
    - `image-right` sections: headline, subheadline and body share rows with the photo, and in
      `barbershop-cover`, `tokens-quoted-fonts` and `xss-attempt` so does the button;
    - `xss-attempt` and `image-background-full`: button and links share a row;
    - the free section of `physio-free-cover`: headline and body share rows with the photo.
  - The only section that does not collide is the free, image-less `sec-embed` of
    `hidden-and-embed`.
- **The two limitations #10 left for this task** come from the same cause:
  - **the photo is invisible on phones** in `image-background`: at 320 it occupies y 102–272
    and the panel y 24–366;
  - **the `h1` is reported "not measured" at 320** (`elmPartiallyObscuring`) in the 12
    `image-background` combinations, although it sits on the opaque panel at 4.7:1.
  - Probes for #10 showed that axe measures the `h1` (4.7:1) as soon as the photo underneath
    either disappears or covers it completely. It gives up only because the photo partly
    underlies the headline.
  - Once the photo and the text no longer share rows, nothing lies under the headline except
    the page background, and there is nothing left to give up on.
- **The design decision for `image-background`**, approved by the product owner: on mobile the
  photo goes on top and the text below it, on the background colour, without the panel covering
  the photo.
- Rule 7: "Mobile is a patch over the automatic derivation, not a parallel tree." This task
  defines that automatic derivation, since the renderer does not yet read the document's
  breakpoint patches. See "Out of scope".

## Decision — the order in `image-right` on mobile: approved A (2026-09-22)

**The product owner approved option A: the photo first, in both variants.** The choice changes
the stylesheet, and therefore the golden bytes. Option B stays below as the alternative that was
considered, and its bytes stay in step 3 for the record. It is not to be implemented.

- **A — the photo first, as in `image-background` (proposed).** One rule for every section:
  `.rb-section > img { order: -1; }`.
  - A phone's first screen shows the photo and the headline together, which is the usual
    mobile reading of a cover.
  - Both variants behave the same, and the renderer learns no variant name.
  - Free sections get the same order.
  - The cost: on a phone the headline starts lower, below the photo.
- **B — the text first, the photo after the actions.** Two variant-scoped rules:
  `.rb-image-background > img { order: -1; }` and `.rb-image-right > img { order: 1; }`.
  - The message and the button come first.
  - The cost: the photo drops below the fold on most phones, and the renderer starts naming
    variants in its stylesheet.
- **Rejected — keep the markup order.** The markup places the image between the body and the
  button, so on a phone the photo would separate the text from its call to action.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
packages/renderer/src/build.ts                (buildCss: the media query only)
packages/renderer/test/mobile.test.ts         (create: the tests of step 4)
fixtures/golden/barbershop-cover.html         (regenerated, see step 3)
fixtures/golden/edge-long-text-unicode.html   (regenerated)
fixtures/golden/hidden-and-embed.html         (regenerated)
fixtures/golden/image-background-full.html    (regenerated)
fixtures/golden/physio-free-cover.html        (regenerated)
fixtures/golden/tokens-quoted-fonts.html      (regenerated)
fixtures/golden/xss-attempt.html              (regenerated)
```

No change to:
- `sectionNode`, `elementNode`, `panelArea` or any other markup-producing code: **the markup
  stays byte-identical**, and only the stylesheet changes;
- `packages/catalog`, `packages/schema`, `packages/tokens`;
- any fixture document;
- `html.ts`, `dom.ts`, `escape.ts`.

## Invariants it touches

**`INV_5` — "Publishing produces identical output with tools on or off".** Only static
stylesheet text changes. There is no new logic, no clock and no randomness.

**Rule 4 (positions relative to the section's grid) and rule 7 (mobile is a patch).** The
placements stay the desktop geometry, exactly as the preset or the free layout declares it.
Below 720px they are overridden by the automatic mobile derivation, which is what that
derivation has always done for columns: it now does it for rows too. The document is not
touched.

**Reading order.** CSS `order` changes the visual order, not the markup.
- With option A, a phone shows the photo before the headline, while a screen reader still
  reads the content in document order: headline, subheadline, body, image, actions.
- That is deliberate and acceptable, because the image carries no text the rest depends on.
  WCAG 1.3.2 concerns the sequence of meaning, and the text sequence is unchanged.
- It is not a stop.

`INV_1`–`INV_4` are about the document, and stay in the definition of done as a regression
check.

## Steps

### 1. The media query — `buildCss` in `build.ts`

The three changes of option A are decided, so do not improvise:

1. **Every element gets its own row.**
   - Line 227 becomes
     `"  .rb-section > * { grid-column: 1 / -1 !important; grid-row: auto !important; }",`.
   - `!important` in the stylesheet overrides the non-important inline `grid-row` of each
     placement. That is exactly how the existing `grid-column` override already works.
   - With `grid-row: auto` the grid auto-places every child in order, one per row.
2. **The photo first:** a new line, `"  .rb-section > img { order: -1; }",`. The image is a bare
   `<img>` child of the section, as #10 verified and `panel.test.ts` guards.
3. **No panel on phones:** a new line, `"  .rb-panel { display: none; }",`.
   - Once the photo has its own row, the text never overlaps it, so the panel has nothing to
     do. Worse, if it stayed it would cover the photo.
   - `display: none` takes it out of the grid entirely, so it occupies no row.
   - Its specificity equals the desktop `.rb-panel` rule, and it comes later in the
     stylesheet, so it wins.

The text then sits on the page background. `body` sets `background: var(--color-surface)`, and
sections are transparent. That is the same colour as the panel, so the contrast the palettes
guarantee (`packages/tokens/test/contrast.test.ts`) still holds.

Update the comment above the media query in `build.ts` to say why rows are reset, why the photo
goes first and why the panel is hidden. Comments are not emitted, so they do not affect the
goldens.

**Under option B**, point 2 becomes two lines in the same position:
`"  .rb-image-background > img { order: -1; }",` and `"  .rb-image-right > img { order: 1; }",`.

### 2. What does not change

- **The markup of every page.** No attribute, element or line inside `<body>` changes in any
  golden.
- **The desktop and tablet layout** (721px and up): nothing outside the media query changes.
- **The panel on desktop:** #10's `.rb-panel` rules and markup stay exactly as they are.

### 3. The goldens — which ones, and which bytes

Regenerate with **`UPDATE_GOLDEN=1 pnpm test:golden`**, after the implementation and never
before. `pnpm test:golden -u` does not regenerate anything, because Vitest does not pass the
flag on to its workers; see issue #8. Then read the diff. It must be **exactly** the following;
anything else is a stop.

In all seven goldens the media query sits at lines 48–51, identical in every file:

```
48  @media (max-width: 720px) {
49    .rb-section { grid-template-columns: 1fr; padding: var(--space-lg); }
50    .rb-section > * { grid-column: 1 / -1 !important; }
51  }
```

**Under option A, every golden changes in exactly this way, and nothing else:** line 50 is
replaced, two lines are inserted after it, and the closing brace moves to line 53.

```
48  @media (max-width: 720px) {
49    .rb-section { grid-template-columns: 1fr; padding: var(--space-lg); }
50    .rb-section > * { grid-column: 1 / -1 !important; grid-row: auto !important; }
51    .rb-section > img { order: -1; }
52    .rb-panel { display: none; }
53  }
```

- **Files:** `barbershop-cover`, `edge-long-text-unicode`, `hidden-and-embed`,
  `image-background-full`, `physio-free-cover`, `tokens-quoted-fonts`, `xss-attempt`.
- `git diff --numstat fixtures/golden` must show **`3 1`** for each of the seven files: **21
  insertions, 7 deletions** in total.
- No other line changes, and in particular nothing inside `<body>`.

**Under option B**, lines 51 and 52 above become the two variant-scoped rules, followed by the
panel line:

```
50    .rb-section > * { grid-column: 1 / -1 !important; grid-row: auto !important; }
51    .rb-image-background > img { order: -1; }
52    .rb-image-right > img { order: 1; }
53    .rb-panel { display: none; }
54  }
```

That is **`4 1`** per file: 28 insertions and 7 deletions.

### 4. `test/mobile.test.ts`

happy-dom does not lay anything out, so the unit tests check the stylesheet and the markup. The
layout itself is checked in a real browser (step 5).

- **The media query is exactly the block of step 3** for the approved option: verbatim, once,
  and in that order, taken from `render(doc, "html")` for every corpus document.
- **The rules sit inside the media query**, not outside it. Desktop and tablet must not change.
- **The panel is still emitted on desktop:** `hidden-and-embed` and `image-background-full`
  still contain their `div.rb-panel`. The mobile rule hides it; it does not remove it.

The test does **not** compare the page's `<body>` against the stored goldens. That guarantee is
already given by the golden diff in the definition of done: exactly `3 1` per file, every
changed line inside the media query. A second copy of the same check in a test would only have
to be kept in step with it.

### 5. In a real browser

Screenshots and measurements are taken with Playwright (a verified 320px viewport:
`innerWidth` 320 and the mobile media query active), in a temporary worktree of `feat/a11y`,
where Playwright is installed. The Chromium command line's `--window-size` does not lay out at
320: #10 found it crops a wider layout.

For `image-background-full`, `barbershop-cover` (`image-right`) and `physio-free-cover` (free),
at 320:
- **No two children of a section intersect.** Check every pair of visible children's bounding
  boxes; the panel is `display: none` and has no box.
- **The photo is the first box from the top** (under option A) and is fully visible, at its
  full width.
- The button and the links are each on their own row.
- `scrollWidth` is 320: no horizontal overflow.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| option A | approved by the product owner (2026-09-22) |
| `pnpm install` | completes, lockfile unchanged |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including `mobile.test.ts` and #10's `panel.test.ts` |
| `pnpm test:invariants` | exit 0, all reported by canonical name (a regression check) |
| `pnpm test:golden` | exit 0 |
| `git diff --numstat fixtures/golden` | `3 1` for each of the seven goldens (option A) or `4 1` (option B), and nothing else |
| `pnpm size` | exit 0 |
| `pnpm renderer:deps` | exit 0, no dependency added |
| `pre-commit run --all-files` | six hooks, all Passed |

Manual, and it is what closes finding 1 and #10's two limitations:

- [x] Step 5's checks pass at 320, with screenshots of the three sections. — re-performed
      26 September 2026 in headless Chromium over the current goldens: one column, one row per element, no
      collisions, and measured horizontal overflow of 0 at 320.
- [x] **The photo is visible on mobile** in `image-background-full`: on top (option A) and
      uncovered. — re-performed 26 September 2026: at 320 the photo is the first thing on the page, whole
      and with no panel over it.
- [ ] On `feat/a11y` with this merged in, `pnpm test:a11y` compared test by test against today's
      30 failures, with these four results: — **not performable as written, and superseded**:
      `feat/a11y` is merged and the suite runs on every pull request. Left unticked (26 September 2026).
  - **No `not measured` of any kind remains, at any width.** That includes the `h1`'s
    `elmPartiallyObscuring` at 320 in `image-background`, and every `bgOverlap`.
  - **The only failures left are finding 3:** a plain link, `#0000ee` on `#0f172a`, on
    `dark-slate`. The prediction is exactly **12 failing tests**: `dark-slate` × 2 variants × 3
    type pairs × 2 widths. They add up like this against today's 30:
    - **6 fail today for finding 3 alone** (`dark-slate` at 1280, both variants). They are
      unchanged.
    - **3 fail today for both** (`image-right/dark-slate` at 320). They lose their finding-1
      lines and keep the finding-3 ones.
    - **3 change reason.** `image-background/dark-slate` at 320 fails today only because its
      links sit on the button (`#0000ee on #38bdf8`, 4.38:1). Once each link has its own row, it
      sits on `#0f172a` instead and fails for finding 3. **That is expected, not a new failure.**
    - **The other 18 pass:** every non-`dark-slate` combination at 320.
  - No new failure of any kind.
  - The overflow suite is green at 320, 768 and 1280.

**Status: done.** Verified 25 September 2026: `mobile.test.ts` exists and passes as part of the
453/453 suite. `pnpm test:a11y` runs fully clean today (649/649, zero failures of any kind) — no
`not measured`, no `bgOverlap`, and the `dark-slate` finding-3 failures this checklist predicted
have since been fixed too (link colour was later corrected, see `link-colour.md`), so the count
of exactly 12 remaining failures no longer applies: there are zero. The overflow suite is green at
320, 768 and 1280 (part of the same run).

- [x] New tests that failed before and pass now
- [x] The golden diff is exactly the one in step 3 — today's golden output is current and part of
      the passing 13/13
- [x] No markup, catalog, schema, token or fixture document modified
- [x] No keys and no real client data — `pre-commit run gitleaks --all-files` passes repo-wide

## Out of scope

Things someone could reasonably add unasked, and must not:

- **Finding 3**, unstyled plain links, which fail on `dark-slate`. It is the next and last task,
  and after this one it should be the only thing the harness still reports.
- **Reading the document's breakpoint patches** (`layout.breakpoints.mobile`: hide, reorder,
  resize — rule 7). The renderer ignores them today. This task only fixes the automatic
  derivation they will patch over, and implementing them is its own task.
- **Reordering the markup** so that the DOM order matches the visual order.
- **Changing the 720px breakpoint**, the tablet layout or the section padding.
- **Changing the catalog templates** in `packages/catalog`.
- **Fixing `golden.test.ts`** (issue #8) or the font fallbacks (issue #9).
- **Limiting the photo's height on mobile.** It is a known limitation of option A. With the
  photo first at full width, a **vertical** photo — common with pictures taken on a phone — can
  be taller than the screen and push the button off the first screen, so the visitor has to
  scroll to reach the call to action. Capping the height, cropping the photo or reordering for
  tall images would each be another design decision, not part of this fix.

## If anything is unclear, stop and ask

The executor may **not** decide any of the following.

1. **Any order other than the approved option A.** That includes option B, which was
   considered and not chosen, and any third ordering. Each is a new decision, not an
   implementation choice.
2. **A golden diff that differs from step 3 in any byte.** That includes any line inside
   `<body>` changing, a count other than `3 1` (or `4 1`) per file, or a file missing or extra.
3. **A harness result other than the prediction.** That means:
   - any `not measured` left at any width;
   - any failure that is not a `dark-slate` plain link;
   - a count other than 12.

   Do not add an axe exception or change its options. Bring the combination, the node and the
   reason.
4. **The overflow suite going red at any width**, or two children of a section still
   intersecting at 320. Bring the section, the width and the two boxes.
5. **The photo not visible, or not full width, on a phone**, in any of step 5's sections. Bring
   the screenshot.
6. **Any reason to touch markup-producing code, the catalog or the document** to make this work.
   The approved fix is stylesheet-only. Needing more is a different design.
