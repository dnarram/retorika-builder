# image-background — the text sits on a solid panel, not behind the photo

> **Claude-only. Exclusive zone.** Every byte this task changes is emitted by `packages/renderer`
> into the client's published site, and it changes what published pages look like. Part 2 names
> the renderer for exactly that reason.
>
> Not delegated to OpenCode under any circumstances, however small the diff looks.

## Objective

In every section where a text element is placed over an image, the text is drawn **on a solid
panel of `color.surface`**, and the panel is drawn over the photo. Contrast then depends only on
the palette, never on the picture, and axe can measure it. No text is ever hidden behind an
image again.

## Where it comes from

- **PR #6, finding 2**, the second of the four renderer fixes, in the agreed order 4, 2, 1, 3.
  Finding 4 is fixed in #7.
- **The symptom:** in all 12 `cover/image-background/*` combinations, at 320 and 1280, axe
  reports `color-contrast` as **not measured** (`bgOverlap`) on `h1`, `h2` and `p`. A screenshot
  at 1280 shows why: not one word of the headline, subheadline or body is visible.
- **The cause** is `packages/catalog/src/cover.ts`, the `image-background` template.
  - The image spans `column 1 / span 12`, `row 1 / span 5`, and the text is placed on rows 2–5
    of the same grid.
  - In the markup the image comes **after** the text elements, and every grid item has
    `z-index: auto`, so the image paints over the text.
  - Nothing in `buildCss` sets a stacking order, and nothing in `sectionNode` knows that two
    placements overlap.
- **The design decision**, taken by the product owner: the text goes on a solid panel in a
  palette colour, over the photo.
  - **The colour is `color.surface`, because it is the only background whose contrast the
    palettes already guarantee.** `packages/tokens/test/contrast.test.ts` checks, for every
    palette, `ink`, `primary`, `secondary` and `muted` against `surface` (≥ 4.5:1), and `surface`
    against `primary`.
  - Those are exactly the headline, subheadline, body and button colours in `buildCss`. On
    `surface`, their contrast is already proven for every palette, whatever the photo.
  - Plain links are not covered, and that is finding 3.
- Advanced dossier §4: the pre-publish check warns of insufficient contrast. It cannot warn
  about what axe cannot measure, and text over a photo is exactly that.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
packages/renderer/src/build.ts                (sectionNode: the panel; buildCss: three lines)
packages/renderer/test/panel.test.ts          (create: the tests of step 4)
fixtures/documents/image-background-full.json (create: every cover slot on image-background)
fixtures/golden/image-background-full.html    (create: generated with UPDATE_GOLDEN=1, then read)
fixtures/golden/barbershop-cover.html         (regenerated: +3 lines, see step 5)
fixtures/golden/edge-long-text-unicode.html   (regenerated: +3 lines)
fixtures/golden/hidden-and-embed.html         (regenerated: +4 lines)
fixtures/golden/physio-free-cover.html        (regenerated: +3 lines)
fixtures/golden/tokens-quoted-fonts.html      (regenerated: +3 lines)
fixtures/golden/xss-attempt.html              (regenerated: +3 lines)
```

No change to:
- `packages/catalog`: the template geometry stays exactly as it is;
- `packages/schema`: the panel never enters the document;
- `packages/tokens`;
- any existing fixture document;
- `packages/renderer/src/html.ts`, `dom.ts` or `escape.ts`.

## Invariants it touches

**`INV_5` — "Publishing produces identical output with tools on or off".** The panel is a pure
function of the section's placements and the elements' `hidden` flags. There is no clock and no
randomness, and attributes are emitted in the renderer's existing sorted order. Two renders of
the same document are byte-identical, and the new golden comes out identical across runs.

**The document rules**, which the panel must not bend:
- **Rule 1 (layout never owns content) and rule 4 (positions relative to the section's grid).**
  The panel is an **empty sibling** placed behind the text. It is **not a wrapper** around the
  text elements, and that is deliberate.
  - A wrapper would take the text out of the section's grid and into its own flow. The
    placements the preset declares, and the placements a free section declares, would then no
    longer position anything.
  - As a sibling, every document element keeps exactly the grid area it has today.
- **Rule 2 (every element carries a role) and rule 5 (no orphan elements).** They are about
  document elements, and the panel is not one. It exists only in the render tree, derived at
  render time like the stylesheet.
  - It carries **no `data-role` and no `data-slot`**, so the editor, which reaches document
    elements through the `"dom"` target, can never select it, list it or edit it.
  - It never enters `packages/schema`.

`INV_1`–`INV_4` are about the document, not its rendering, and are not affected. They stay in
the definition of done as a regression check.

## Steps

### 1. The panel — `sectionNode` in `build.ts`

**The rule is placement-driven, not variant-driven.** The renderer does not learn the name
`image-background`: it learns that text overlapping an image needs a panel. The same bug in a
free section — text placed over a picture by hand — gets the same fix, and a future variant
needs no change here.

**It is decided, so do not improvise.** For each section:

1. **Visible elements:** those `elementNode` actually emits (not `hidden`, with a `value`) and
   that have a placement.
2. **Images:** visible elements whose value is `kind: "image"`.
3. **Overlapping elements:** visible non-image elements whose grid area **intersects** the grid
   area of at least one image. The intervals are half-open: columns `[column, column +
   columnSpan)`, rows `[row, row + rowSpan)`. Touching edges do not intersect.
4. **If there are none, emit no panel and change nothing.** This is the case for every
   `image-right` section in the corpus, which is why those sections' markup stays byte-identical
   (step 5).
5. **Otherwise, the panel's area is the bounding box of the overlapping elements**, and only of
   them: the smallest column and row start, and the largest column and row end.
6. **Emit it as the section's first child**, before any document element:

   ```ts
   element("div", { "aria-hidden": "true", class: "rb-panel", style: /* placementStyle */ }, [])
   ```

   Its `style` is produced by the existing `placementStyle`, so its geometry is written in the
   same format as every other placement: `grid-column:C/span W;grid-row:R/span H`.

   Reuse `placementStyle`; do not write a second formatter. An empty element renders on one
   line (`html.ts:27`), with attributes sorted: `aria-hidden`, `class`, `style`.

A hidden image produces no panel. So does an image with no placement, since it has no grid area
to intersect.

### 2. The stacking order — `buildCss` in `build.ts`

Insert these **three lines**, verbatim, immediately after the line
`"  border-radius: var(--radius-sm); text-decoration: none; }",` and before the blank line that
precedes the media query:

```
.rb-panel { align-self: stretch; margin: calc(-1 * var(--space-md)); z-index: 1;
  background: var(--color-surface); border-radius: var(--radius-lg); pointer-events: none; }
.rb-panel ~ :not(img) { z-index: 2; }
```

Why each declaration is there:

| Declaration | Why |
|---|---|
| `z-index: 1` on the panel, `z-index: 2` on the siblings after it that are not images | Grid items honour `z-index` without `position`. The image keeps `auto` and paints first, the panel over it, the text over the panel. The markup order stays as it is |
| `align-self: stretch` | `.rb-section` sets `align-items: center`, which would give an empty grid item a height of zero, so the panel would not exist on screen |
| `margin: calc(-1 * var(--space-md))` | Grows the stretched panel by one `space-md` on every side, so the text does not touch its edges. At 320px the section padding is `space-lg` (24px) and the growth is `space-md` (16px), so the panel stays inside the viewport. The overflow suite must confirm it |
| `background: var(--color-surface)` | The one colour the palettes guarantee contrast against (see "Where it comes from") |
| `border-radius: var(--radius-lg)` | A token reference, per rule 6. No exact value |
| `pointer-events: none` | The panel is decoration, not an element. In the editor, a click on the part of the photo the panel covers must reach the image underneath, not an empty box nobody can select. Text on the panel still receives its own clicks, because it is drawn above the panel |

**The selector `.rb-panel ~ :not(img)` depends on how an image is emitted today.** Checked
against the code and the corpus while drafting this task, the image is a bare `<img>`, a
**direct child of `<section>`**:

- `elementNode` returns `element("img", …)` for `kind: "image"` (`build.ts:48-49`), with no
  wrapper.
- `sectionNode` pushes each node straight into the section's children.
- In every golden (seven images across six files), the `<img>` line is indented four spaces,
  exactly like the headline beside it: it is a sibling of the text, not nested in anything.
- No `figure`, `picture` or wrapping `div` exists anywhere in `packages/renderer/src` or
  `fixtures/golden`.

So `:not(img)` leaves the image at `z-index: auto`, under the panel.

**If the image were wrapped**, the wrapper would match `:not(img)` and get `z-index: 2`. Since
the image comes after the text in the markup, it would paint over the text again, and the fix
would silently undo itself. That is why it is a stop in "Stop and ask", not something to patch
here.

The media query already forces every section child to `grid-column: 1 / -1`, and the panel is a
section child, so on phones it spans the full width of the rows it covers. The row collisions of
finding 1 are **not** this task.

### 3. The new fixture — `image-background-full.json`

The corpus has exactly one `image-background` section: the first section of `hidden-and-embed`.
In it only the headline is visible, because subheadline and body are hidden. That is a good test
of hidden elements and a poor test of the panel. So add a fixture that fills every cover slot:
- **the content of `barbershop-cover`**, plus the two `secondaryAction` links that the cover
  admits and that fixture leaves empty;
- **variant `image-background`**;
- **its own ids**;
- **the theme of `barbershop-cover`**;
- **an existing asset** from `fixtures/assets/`.

Its overlapping elements are the headline (column 2 / span 8, row 2), subheadline (row 3), body
(row 4), button (column 2 / span 3, row 5) and both links (columns 5 and 8, span 3, row 5). The
panel is therefore exactly:

```
grid-column:2/span 9;grid-row:2/span 4
```

### 4. `test/panel.test.ts`

The panel's geometry is checked directly, against the rendered tree, not only through the
goldens:

- **Bounding box:** `image-background-full` gets the panel `grid-column:2/span 9;grid-row:2/span 4`.
  `hidden-and-embed`'s first section gets `grid-column:2/span 8;grid-row:2/span 1`.
- **Hidden elements do not count:** in `hidden-and-embed`, the hidden subheadline and body do not
  enlarge the box.
- **No overlap, no panel:** every `image-right` section in the corpus renders with no
  `rb-panel`. That includes the free sections of `physio-free-cover` and `hidden-and-embed`.
- **No image, or a hidden image, gives no panel**, even with text placed where an image would be.
- **Edges that only touch do not intersect:** text in the row right after the image's last row
  gets no panel.
- **A free section with text placed over an image gets a panel.** The rule is placement-driven,
  not tied to a variant name.
- **The panel is the section's first child** and carries exactly `aria-hidden="true"`,
  `class="rb-panel"` and `style`. It has **no `data-role`, no `data-slot`** and no children.
- **One renderer, two targets:** `render(doc, "dom")` contains the same panel, with the same
  attributes, as `render(doc, "html")`.
- **The stylesheet:** it contains the three lines of step 2, verbatim, and once.

### 5. The goldens — which ones, and which bytes

Run `UPDATE_GOLDEN=1 pnpm test:golden` **after** the implementation, never before (see issue
#8: `golden.test.ts` writes a missing golden instead of failing). Then read the diff. It must be
**exactly** the following; anything else is a stop.

**Not `pnpm test:golden -u`.** `golden.test.ts` looks for the flag with
`process.argv.includes("-u")`, but Vitest runs tests in worker processes and does not pass its
own command-line flags on to them.
- In a worker, `process.argv` has no `-u`, so that check is never true. A probe test confirmed
  it: the worker's argv came through empty.
- So `pnpm test:golden -u` has never regenerated an existing golden. It only seemed to work
  when the golden was **missing**, which is issue #8's write path, not the flag.
- `UPDATE_GOLDEN=1` is the other trigger the test accepts. Environment variables do reach the
  workers, so that one works.
- `golden.test.ts` and three places in `docs/protocolo.md` still document `-u`. Fixing them is
  outside this task and is recorded in issue #8.

**Each of the six existing goldens gains the same three lines, and nothing else.** After line 43
(`  border-radius: var(--radius-sm); text-decoration: none; }`), and before the blank line at 44,
they gain new lines 44–46:

```
.rb-panel { align-self: stretch; margin: calc(-1 * var(--space-md)); z-index: 1;
  background: var(--color-surface); border-radius: var(--radius-lg); pointer-events: none; }
.rb-panel ~ :not(img) { z-index: 2; }
```

That applies to `barbershop-cover`, `edge-long-text-unicode`, `physio-free-cover`,
`tokens-quoted-fonts`, `xss-attempt` and `hidden-and-embed`.

**`hidden-and-embed.html` also gains one line:** the panel, as the first child of
`sec-cover`.
- Today it sits between line 53 (the `<section … data-section="sec-cover" …>` opening tag) and
  line 54 (the headline).
- After the three CSS lines are added, that is between lines 56 and 57.
- The line is exactly:

```
    <div aria-hidden="true" class="rb-panel" style="grid-column:2/span 8;grid-row:2/span 1"></div>
```

**No line in any golden is removed or modified.**
- `git diff --numstat fixtures/golden` must show `3 0` for five files and `4 0` for
  `hidden-and-embed.html`.
- In total that is **19 insertions, 0 deletions** across the six existing files.

**One new file**, `fixtures/golden/image-background-full.html`, is read in full.
- Its `sec-…` section starts with the panel line, with `grid-column:2/span 9;grid-row:2/span 4`.
- Its `<style>` carries the three lines once.
- Every document element's own `style` is the placement the template declares, and nothing
  else.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| `pnpm install` | completes, lockfile unchanged |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including `panel.test.ts` |
| `pnpm test:invariants` | exit 0, all reported by canonical name (a regression check) |
| `pnpm test:golden` | exit 0 |
| `git diff --numstat fixtures/golden` | `3 0` for five existing goldens, `4 0` for `hidden-and-embed.html`, and nothing else |
| `git status --short fixtures/golden` | the six existing files modified, and exactly one new file: `image-background-full.html` |
| `pnpm size` | exit 0, the new fixture included |
| `pnpm renderer:deps` | exit 0, no dependency added |
| `pre-commit run --all-files` | six hooks, all Passed |

Manual, and it is what closes finding 2:

- [ ] Render `image-background-full` in a real browser at 1280 and at 320. The headline,
      subheadline, body, button and both links are visible on the panel, and the photo shows
      around it.
- [ ] **At 320, look at how much of the photo is left.** On a phone the panel spans the full
      width of the rows it covers. If the photo barely shows — a thin strip above or below the
      panel, or nothing — **report it with a screenshot.** It is a design question about the
      variant on mobile, not something to fix in this task: do not shrink the panel, move rows
      or change the template to make room.
- [ ] On the `feat/a11y` branch with this merged in, run `pnpm test:a11y`, then check the
      three points below.
  - **No** `image-background` combination reports `not measured … [bgOverlap]` on `h1`, `h2` or
    `p`, at any width.
  - The overflow suite is still green at 320, 768 and 1280.
  - Every failure that remains carries the signature of finding 1 (a row collision at 320: a
    link measured against the button, or text over the image in `image-right`) or of finding 3
    (a plain link on `dark-slate`).
  - Report the new count against the 39, split by finding.

- [ ] New tests that failed before and pass now
- [ ] The golden diff is exactly the one in step 5
- [ ] No catalog, schema, token or existing fixture document modified
- [ ] No keys and no real client data

## Out of scope

Things someone could reasonably add unasked, and must not:

- **Finding 1**, the row collisions on phones. The media query forces `grid-column: 1 / -1` but
  keeps each element's row, so elements that shared a row share a cell, and in `image-right` the
  image covers the text at 320. That is the next task, and the panel neither fixes nor hides it.
- **Finding 3**, unstyled plain links, which fail on `dark-slate` even on the panel.
- **Changing the `image-background` template geometry** in `packages/catalog`, for example by
  moving the text off the image. The decision is a panel over the photo.
- **A panel colour other than `color.surface`**, an opacity or a gradient over the photo, or a
  new token for panels. Each is a design decision, and an overlay also makes contrast depend on
  the photo again.
- **Wrapping the text elements in the panel.** See "Invariants it touches": it breaks rule 4.
- **Declaring the panel in `PresetShape`** (`packages/schema`), so that presets opt in. It is a
  schema change with a migration, and the placement-driven rule makes it unnecessary.
- **Fixing `golden.test.ts`** so a missing golden fails. That is issue #8; this task only works
  around it by never running the goldens before the implementation exists.

## If anything is unclear, stop and ask

The executor may **not** decide any of the following.

1. **A golden diff that differs from step 5 in any byte.** That includes:
   - a line removed or modified in any golden;
   - a panel in any section other than `hidden-and-embed`'s `sec-cover` and the new fixture's;
   - different geometry;
   - different attribute order.

   Either the rule was implemented differently, or the survey behind this task was wrong. In
   both cases a published site changes in a way nobody reviewed.
2. **Any section of the corpus other than those two turning out to overlap an image.** The
   survey for this task found none: every `image-right` section, catalog or free, has no text
   intersecting its image. If one does, bring it.
3. **The panel breaking the overflow suite at 320.** Do not shrink the margin and do not change
   the section padding on your own. Bring the width and the element.
4. **axe still reporting `bgOverlap` or `not measured` on text that sits on the panel.** Do not
   add an exception, and do not change axe's options. Bring the combination and the node.
5. **Any reason to make the panel a wrapper, to give it a role, or to move it into the
   document.** Each one bends a document rule, and that is an ADR, not an implementation
   detail.
6. **A palette where `color.surface` under the text still fails axe for `h1`, `h2`, `p` or the
   button.** It would mean the tokens' contrast test and axe disagree. Bring both numbers, and do
   not touch the palette.
7. **An image that is no longer a bare `<img>` child of the section** — wrapped in a `figure`, a
   `picture`, a `div` or anything else, whether it is wrapped today by the time this runs or by
   a change made alongside it. The wrapper would match `.rb-panel ~ :not(img)`, get
   `z-index: 2`, and, coming after the text in the markup, cover it again. Stop and propose the
   selector before writing it.
