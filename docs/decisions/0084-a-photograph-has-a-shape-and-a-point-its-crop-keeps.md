# 0084 — A photograph has a shape, and a point its crop keeps

**Status:** proposed · **Date:** 2026-11-25 · **Decided by:** David, 25 de noviembre de 2026,
planning sprint 41 «Estirar, agrandar y mover»: of what «agrandar y empequeñecer» should do beyond the
box, he chose *«La foto toma el alto que le des»* — a photograph's bottom edge changing its height for
real, cropped rather than keeping 4:3, with a draggable point deciding which part stays — together
with the corner that scales it (ADR 0082). The plan carried two of the shapes this ADR takes as
defaults he could veto, *a* (the shape stored as a ratio on the placement, not a height in pixels) and
*b* (the point on the photograph's value, removed with the photograph), and *c* (a phone holds the
shape between 3:4 and 3:1); he approved the plan with them. · **Recorded by development, with the
standing note that development does not sign.** · **Relates to:**
[ADR 0082](0082-the-sides-stretch-the-box-and-the-corners-scale-what-is-inside.md) (the corner that
scales a photograph), [ADR 0050](0050-a-hand-designed-section-is-a-fine-grid-and-the-hand-decides-where.md)
§3 (rows are a floor and the content pushes), [ADR 0011](0011-sample-photos-per-sector.md)
(`sample`, the obligation `focus` copies) · **Touches:** `packages/schema` (1.23.0, migration `0024`),
`packages/renderer`, `apps/editor` (a type narrowed, nothing yet drawn — día 5 is the editor). **One golden
is new — `foto-con-forma`; the other 27 are byte-identical.**

## Context

**A photograph's height was never the owner's.** `.rb-section img` is `width: 100%; height: auto`, and
the catalog fixes a crop for the cases where an owner's photo would otherwise decide the page: the
cover at 4:3 (3:2 behind the words), a gallery at 4:3, a team at 1:1, all `object-position: center`.
A pull on a photograph's bottom edge in a hand-designed section grew its grid area and nothing anyone
could see: the photograph stayed its ratio, four pixels above the area's new floor (ADR 0050 día 4's
walk named it as «crece sin estirarse»). And which part of a cropped photograph survives the crop has
been a sentence in the backlog since the cover was cropped: «which part they *want* kept is a question
this cannot answer».

## Decision

### 1. The shape is a ratio on the placement, and absent is the catalog's

`placementSchema.ratio?: {width, height}`, whole numbers from 1 to 9999, written in lowest terms by
the one verb that writes it (`setPhotoShape`): 448 × 300 and 112 × 75 are the same photograph and one
value. **Absent is the photograph nobody shaped**, which keeps the catalog's crop and draws exactly
what it drew before 1.23.0 — «untouched» and «given a shape» are two stored states, not a guess.

**A ratio and not a height in pixels** (default *a*). A height would crop differently at every width
the page is drawn at — the canvas lays out at 1280 (ADR 0061), the visitor's screen at anything — and
on a phone, where every element is one column, a height would be a number written for a width that is
not there. A ratio is the same photograph everywhere. Rows stay what ADR 0050 made them, a floor the
content pushes: the area follows the photograph's height, not the other way round.

**Only a photograph has one.** `checkInvariants` refuses a ratio on any other placement (rule 4): an
`aspect-ratio` on a text would clip its words and on a list crop its cards. Only a hand-designed
section has placements, so only a photograph placed by hand can be shaped; `revertSection` drops the
shape with the layout. **`PlacementEdit` narrows to the four numbers** of rule 4, so a drag or a
stepper, which build their edits from those, can neither carry a shape nor drop one by spreading.

### 2. The point is on the photograph, and the middle is no point

`image.focus?: {x, y}`, whole percent from 0 to 100, written by `setImageFocus` — rounded, clamped,
and **50/50 stored as absent**, so a photograph centred by hand and one nobody touched are the same
document and publish the same bytes. **On the value and not on the placement** (default *b*): it is a
fact about the photograph, a card's photograph has no placement and is cropped all the same, and a new
photograph has its own middle — **replacing the photograph removes the point**, in the same line that
removes `sample` (ADR 0011's obligation, copied).

### 3. Drawn as `aspect-ratio`, `object-fit` and `object-position`, by rule 6's selector

`photoShapeCss` writes, per photograph and only where a fact is stored, `aspect-ratio: W / H;
object-fit: cover` for a shape and `object-position: X% Y%` for a point, under the same `(0,3,0)`
selector rule 6's own block uses. **That selector outranks the catalog's `(0,2,1)` crops** —
`.rb-cover.rb-image-background img` asks for 3:2, `.rb-gallery .rb-item img` for 4:3 — without one
`!important`; the browser suite asserts it on a background cover, the case a two-attribute selector
would lose silently. None of the three properties is `width`, `display` or `order` (rule 6's
disjointness note): «Foto menor» still narrows a shaped photograph on a phone, and its height follows.

**On a phone a shape outside 3:4 – 3:1 is drawn at the nearer limit** (default *c*), in a query after
the rule it patches: a tall strip at the phone's full width would be three screens of one picture,
and a band thinner than 3:1 a line. The point is kept.

### 4. Schema 1.23.0, migration `0024`

`up` seals and moves nothing: both keys are optional and absent on every document written before. `down`
is lossy and says so: every `ratio` and every `focus`, a card's included, goes; the photographs go back
to the catalog's shape, centred, and nothing else moves. Round-tripped in `migrations.test.ts`.

## What is preserved

- **Rule 4**: a shape is a proportion on the section's grid, never a pixel; no `x`, no `y`.
- **Rule 6**: the stylesheet block stays disjoint from `width`, `display`, `order` and the grid.
- **Rule 7**: a phone is still one column, «Foto menor» still a twelfth, and the shape is held there.
- **Every saved site, byte for byte**: none carries a shape or a point. The corpus's 27 goldens do not move.

## What is lost, and it is named

- **The content box at 1296 px and up is 1200, not 1184** (ADR 0064's measure): a shaped photograph is
  1.35 % taller there than in the canvas at 1280. A ratio cannot help that and is not meant to.
- **A shaped photograph six hundred pixels tall can push a row** below it, as any content does in a
  hand-designed section (ADR 0050's amendment): the row is a floor.
- **`down` loses both facts**, as said.

## What this does not decide

- **The editor's doors** — the bottom edge that writes a shape, the corner that keeps it, the draggable
  point, «Forma original»: día 5.
- **A point for the logo or a section's background**: they are not cropped by `object-fit`.
- **A shape for a card's photograph**: a card has no placement; its crop is the catalog's (ADR 0086 keeps
  the inside of a card as the catalog draws it).

## Consequences

- `packages/schema`: `document.ts` (`ratio`, `focus`, `SCHEMA_VERSION` 1.23.0), `layout.ts`
  (`setPhotoShape`, `PlacementEdit` narrowed), `fields.ts` (`setImageFocus`; `setElementImageSrc`
  drops the point), `invariants.ts` (a shape is a photograph's), migration `0024` and its block in
  `migrations.test.ts`, tests in `layout.test.ts` and `fields.test.ts`, the snapshot.
- `packages/renderer/src/build.ts`: `photoShapeCss`; `test/photo-shape.test.ts` and four cases in
  `element-style.browser.test.ts`. Five sabotages, each red: emitting for every photograph (28 goldens),
  a two-attribute selector (the background cover), the phone's limits swapped (unit and browser),
  replacing the photograph keeping its point, and the invariant gone.
- `apps/editor`: `designTree.ts` and `DesignPanel.tsx` name the four numbers rather than every key of
  a placement — the only editor change today.
- `fixtures/documents/foto-con-forma.json` (the free cover's photograph at 4:1 with its point at 30 % 70 %,
  and a team member's photograph with a point) and its golden.
- `docs/document-rules.md`: a note under rule 4.
- The record is `docs/design/REVIEW.md`, sprint 41 día 4.
