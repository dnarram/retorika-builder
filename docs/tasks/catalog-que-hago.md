# Catalog: "Qué hago" (services) — and lists, end to end

> **Claude-only. Exclusive zone.** It touches `packages/catalog`, `packages/renderer` and
> `packages/schema` (`revert.ts`), and everything the renderer emits travels to the client's site.
> Part 2 names all three.
>
> Not delegated to OpenCode under any circumstances, however small the diff looks.

## Objective

The second catalog section, **"Qué hago"** (services or products as cards), with its
compositions. With it, the **list container** works end to end for the first time:
- declared in the catalog;
- drawn in both render targets as semantic `<ul>`/`<li>`;
- surviving escalate and revert;
- published with a correct heading order and no overflow at 320.

The list drawing is **generic**. It is written once for the five sections that need lists (Qué
hago, Fotos de trabajos, Opiniones, Precios, Equipo), not for this one.

## Where it comes from

- **Protocol, phase 1:** "catálogo de secciones". **Concept dossier §9:** "Qué hago — Servicios o
  productos en tarjetas", with two or three compositions.
- **The first task of phase 1,** chosen because it depends on no open product decision (the five
  questions, text generation, the stack) and removes the largest technical risk left in the
  model.
- **What the code does today** (checked for this task):
  - **Headings are levelled by role, not by section.** `elementNode` emits every `heading` as
    `<h1>` and every `subheading` as `<h2>`, whatever section they are in. `hidden-and-embed`
    therefore already has three `<h1>`.
  - **Lists are declared but never drawn.** The schema models `items`, and `flattenElements`,
    `listEditableFields` and `applyRevert` walk them. But nothing in `packages/renderer/src`
    reads `items`, and no fixture uses a list.
  - **Revert does not understand lists.** `planRevert` and `escalate` work on
    `flattenElements(section.content)`, so every element inside a list item reaches the slot
    matching. It is then reported as surplus ("the preset declares no slot 'title'").
  - **The invariant tests assume one preset.** INV_1 and INV_2 check every catalog section
    against `presetFor("cover")`, and INV_1 counts hidden elements at the top level only, while
    `listEditableFields` flattens.

## The compositions — approved by the CEO

**The CEO approved all three compositions, A, B and C,** on 2026-09-22. Step 1 ran first on its
own (#16). **Steps 2 to 9 can now go ahead.**

All three are **pure placements**, the same mechanism as the cover. The cards inside the list
flow by a generic rule (step 4), so a composition only decides where the title, the intro and the
list sit on the section grid.

**A — `stacked`, "Tarjetas debajo".** The title and intro on top, the cards in a full-width grid,
about four per row at 1280.

    ┌────────────────────────────────────────────────┐
    │ Qué hacemos                                     │  headline  1/12, row 1
    │ Cortes, barbas y color, sin esperas.            │  intro     1/8,  row 2
    │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
    │ │ Corte   │ │ Barba   │ │ Color   │ │ Niños   │ │  list      1/12, row 3
    │ │ texto…  │ │ texto…  │ │ texto…  │ │ texto…  │ │
    │ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
    └────────────────────────────────────────────────┘

**B — `side`, "Título a un lado".** The title and intro in a column on the left, the cards on the
right, about two per row.

    ┌────────────────────────────────────────────────┐
    │ Qué hacemos      │ ┌──────────┐ ┌──────────┐    │  headline 1/4, row 1
    │ Cortes, barbas…  │ │ Corte    │ │ Barba    │    │  intro    1/4, row 2
    │                  │ └──────────┘ └──────────┘    │  list     5/8, rows 1–2
    │                  │ ┌──────────┐ ┌──────────┐    │
    │                  │ │ Color    │ │ Niños    │    │
    │                  │ └──────────┘ └──────────┘    │
    └────────────────────────────────────────────────┘

**C — `split`, "Título e introducción en una fila".** The title on the left and the intro on the
right, both in row 1, and the cards full width underneath.

    ┌────────────────────────────────────────────────┐
    │ Qué hacemos           │ Cortes, barbas y color,  │  headline 1/5,  row 1
    │                       │ sin esperas.             │  intro    6/7,  row 1
    │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
    │ │ Corte   │ │ Barba   │ │ Color   │ │ Niños   │ │  list     1/12, row 2
    │ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
    └────────────────────────────────────────────────┘

**Still to watch, for B:** at 768 (desktop layout, above the 720px breakpoint)
B's title column, 1/span 4, is about **210px** wide. A long Spanish word at the heading size
("Electrodomésticos", "Especialidades") may not fit. Step 9 tests it with real titles, and an
overflow is a stop.

**The CEO kept all three. Wherever this task says "the approved compositions", it means A, B and
C.**

## The section — `packages/catalog`

- **Catalog id:** `services`, with the visible name in `locales/es.json` ("Qué hago"), like
  `cover`/"Portada". Search aliases go in `search.ts`: "qué hago", "servicios", "productos",
  "tarjetas", "lo que ofrezco", "carta".
- **Top-level slots:**
  - `headline` — `heading`, 1..1;
  - `intro` — `body`, 0..1;
  - `services` — `list`, 1..1.
- **The item shape**, declared and exported by the catalog as `SERVICES_ITEM_SLOTS`:
  - each item: `title` (`heading`, 1..1) and `description` (`body`, 0..1);
  - `SERVICES_ITEMS = { min: 2, max: 6 }`.
  - `checkAgainstPreset` does not validate items today, and extending it is a schema change of
    its own (see "Out of scope"). So item shape is enforced by the catalog's tests and by the
    fixture.

    > Found while executing steps 2–9: `checkAgainstPreset` *did* walk the items, through
    > `flattenElements`, so every visible card title and description was reported as filling a
    > slot the preset does not declare, and INV_1 and INV_2 would have failed over the new
    > fixture. It is the defect step 1 fixed in `revert.ts`. With the product owner's approval
    > it was fixed the same way, in its own commit, before anything else: the check judges the
    > section's top-level elements only (`packages/schema/test/preset-lists.test.ts`).
- **No images in the cards.** Images inside lists arrive with "Fotos de trabajos".

## Order and commits

1. **Step 1, the `revert.ts` change, goes first, in its own commit,** with its tests green
   (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pre-commit`) **before anything in the catalog
   or the renderer is touched.**
   - It is the only schema change in this task, and it has to stand on its own: a reviewer can
     read it, and revert it, without the rest.
   - It does not depend on the compositions, so it may run while they are still pending.
2. **Steps 2 to 9 follow,** now that the compositions are approved (A, B and C).

## Steps

### 1. `packages/schema/src/revert.ts` — a list travels whole (own commit, first)

- `escalate` and `planRevert` work on **the section's top-level elements**, not on
  `flattenElements(...)`. A list element is matched to its slot like any other element, and its
  items travel inside it untouched.
- `applyRevert`'s existing recursion into `items` stays as it is.
- The guard is in its initial state (only `0001-initial` exists), so `schema:guard` accepts
  this. It is still a schema change: it gets its own tests in
  `packages/schema/test/revert-lists.test.ts`:
  - escalate then revert a section with a list gives the identical section (INV_3A shape);
  - no item element is ever reported as surplus;
  - a surplus **list** element (a second list where the preset admits one) is reported as one
    surplus, with its items, not item by item.
- **Those tests must fail against today's `revert.ts`** and pass after. The existing suite must
  stay green, the cover's INV_3A and INV_3B included, which only use top-level elements.

### 2. Heading levels — by section, not by role

A **section heading level** is computed in `sectionNode`:
- **1** for the cover (`section.preset.catalogId === COVER_ID`), which keeps its `<h1>`;
- **2** for every other section.

Then:
- a section `heading` is `h{level}`;
- a section `subheading` is `h{level + 1}`, so the cover's stays `<h2>`, as today;
- a `heading` inside a list item is `h{level + 1}`, which is `<h3>` in "Qué hago".

**Consequence for existing pages: none.** Every existing heading is in a cover section, so every
existing golden's markup stays byte-identical. The three `<h1>` of `hidden-and-embed` (two cover
sections and a free cover-preset section) stay. More than one cover per page gives more than one
`<h1>`, which is a known limitation, recorded under "Out of scope".

### 3. Lists in the renderer — generic, semantic, both targets

`elementNode` renders an element with `role: "list"` as:

    <ul class="rb-list" data-role="list" data-slot="services" role="list" style="…placement…">
      <li class="rb-item" data-item="<item id>">
        <h3 data-role="heading" data-slot="title">Corte</h3>
        <p data-role="body" data-slot="description">…</p>
      </li>
    </ul>

- **Items render in document order.** Each item's elements go through the same `elementNode`,
  with the item heading level. Rule 3 applies inside items: a hidden element is not emitted.
- **An item whose elements are all hidden** is not emitted at all. An empty `<li>` would be
  published.
- **`role="list"` on the `<ul>`** is deliberate: WebKit drops list semantics from a `<ul>` with
  `list-style: none`, and the explicit role restores it for VoiceOver.
- **`data-item`** carries the item id, so the editor can address an item later.
- **The same tree feeds `html` and `dom`**, with no second implementation (ADR 0001).
- The renderer learns nothing about "services": the same code draws every future list section.

### 4. The stylesheet — six lines

Inserted verbatim immediately after the `h2` rule, which today is lines 38–39 of every golden,
and before the paragraph rule:

    .rb-section h3 { font-family: var(--font-heading); font-size: var(--size-body);
      color: var(--color-ink); margin: 0; }
    .rb-list { display: grid; gap: var(--space-md); margin: 0; padding: 0; list-style: none;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
    .rb-item { display: flex; flex-direction: column; gap: var(--space-xs);
      padding-top: var(--space-sm); border-top: 1px solid var(--color-muted); }

- **Text colours** are the palette pairs the tokens already guarantee against `surface`: `ink`
  for the card title and `muted` for the description.
- **The card's top border** is decorative, so the 4.5:1 text contrast does not apply to it.
- **`16rem` and `1fr`** are layout constants of the stylesheet, like the existing `repeat(12, 1fr)`
  and `720px`. They are not document styles, so rule 6 does not apply.
- This position keeps `links.test.ts`'s paragraph, link and button rules contiguous.

### 5. Mobile — one card per row at 320, and how it meets #11

- **The list is a section child,** so #11's rule applies to it unchanged: full width
  (`grid-column: 1 / -1`) and its own row (`grid-row: auto`), after the headline and the intro.
  There is no image, so no `order` and no panel.
- **Inside the list,** the cards flow by `auto-fit`. At 320 the content width is 272px, and two
  cards would need at least 2 × 256px plus the gap, so **there is one card per row**.
  `min(100%, 16rem)` means a card never demands more than the list's width, so **nothing
  overflows**, even narrower than 320.
- **No new mobile rule is added.** The media query stays byte-identical, so `mobile.test.ts`
  stays green.

### 6. The fixture and the goldens

- **New fixture `fixtures/documents/cover-and-services.json`:** barbershop's cover section, then a
  `services` section in the **first approved composition**.
  - The cover comes first so the page has a real heading order: `h1`, then `h2`, then `h3`.
  - Four items; **one item's description hidden**, and **one item entirely hidden** (both its
    elements hidden), to prove rule 3 and the no-empty-`<li>` rule.
  - Generated in `barbershop-cover.json`'s exact format: `json.dumps(…, ensure_ascii=False,
    indent=2)` and a final newline.
- **Regenerate with `UPDATE_GOLDEN=1 pnpm test:golden`,** after the implementation, never
  before. Predicted diff:
  - **every one of the seven existing goldens** gains exactly the six lines of step 4, as new
    lines 40–45, and nothing else: `git diff --numstat` shows **`6 0`** for each, **42
    insertions, 0 deletions**, and no line inside `<body>` changes;
  - **one new golden,** `cover-and-services.html`, read in full: one `<h1>`, **two `<h2>`**,
    three `<h3>` (the fully hidden item is absent), one `<ul role="list">` with three `<li>`.

    > Corrected while executing: this line first said "one `<h2>`", which was a miscount. The
    > fixture carries barbershop's cover whole, subheadline included, and step 2 keeps the
    > cover's subheading an `<h2>`, so the page has two: the cover's subheadline and the
    > services title. Approved by the product owner. Whether the cover's subheadline should be
    > a heading at all is a separate issue, with its own task.

### 7. The invariant tests

In `packages/renderer/test/invariants.test.ts`:
- **INV_1 and INV_2** check each catalog section against **its own preset**,
  `presetFor(section.preset.catalogId)`, not `cover`.
- **INV_1** counts hidden elements with `flattenElements`, the same way `listEditableFields`
  does, so hidden elements inside items are expected and listed.
- **An explicit INV_3A and INV_3B check over the new fixture's services section:** escalate then
  revert gives back the identical section, and a content edit inside an item survives. The
  fast-check generator (`arbitraryDocument`) only knows the cover. Teaching it lists is a schema
  task of its own.

### 8. Unit tests for the section and the lists

- **`packages/renderer/test/lists.test.ts`:**
  - `<ul role="list">` / `<li>` in both targets, with the same attributes;
  - item order;
  - a hidden element inside an item is absent;
  - a fully hidden item is absent;
  - heading levels: `h1` in the cover, `h2` for the services title, `h3` for the cards;
  - the six CSS lines verbatim and once.
- **`packages/catalog/test/services.test.ts`:** slots and cardinality, the item shape, every
  approved composition resolving every slot, and compositions that differ in geometry.

### 9. The accessibility harness

In `packages/renderer/test/browser-fixtures.ts`, `PRESET_CASES` gains a `services` entry.
- Each case now supplies **the page's sections**, not only one section's content:
  - `cover`: the cover alone, as today;
  - `services`: barbershop's cover, then a services section with four visible cards, in the
    composition under test. The page has a realistic heading order.
- **The standard combinations:** `services` × the approved compositions × the four palettes × the
  three type pairs. Each runs axe (contrast, serious/critical) at 1280 and 320, and overflow at
  320, 768 and 1280.

**A long-text case for `services`,** in every approved composition, the four palettes and the
three type pairs:
- the **section title is a single long Spanish word at heading size**, "Electrodomésticos";
- one **card title is long**, "Especialidades de temporada";
- the other texts are as in the standard case.

Overflow is checked at **320, 768 and 1280**, in two ways:
- **the viewport check the harness already does:** no box past the right edge, and
  `scrollWidth <= innerWidth`;
- **a new check for this case: every text element fits its own box**
  (`scrollWidth <= clientWidth` on every heading and paragraph of the services section).
  - The viewport check alone would miss the risk that matters here. At 768, B's title column is
    about 210px. A word wider than that overflows **into the cards' column** without ever
    reaching the viewport's edge.
  - The message names the combination, the width, the element, and both widths in px.

**The prediction: 0 failures in the standard case,** because card text uses `ink` and `muted` on
`surface` and the cards stack one per row at 320. **The long-text case has no prediction.**
Whether "Electrodomésticos" fits 210px at `size.subheading` depends on the font. **If it
overflows in any composition, at any width, it is a stop**, not something to fix inside this
task.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

    packages/schema/src/revert.ts               (step 1: top-level only; own commit, first)
    packages/schema/test/revert-lists.test.ts   (step 1: create)
    packages/schema/src/preset.ts               (checkAgainstPreset: top-level only; own commit, before step 2)
    packages/schema/test/preset-lists.test.ts   (create, with it)
    packages/catalog/src/services.ts            (create)
    packages/catalog/src/index.ts               (register and export)
    packages/catalog/src/search.ts              (aliases)
    packages/catalog/src/locales/es.json        (names)
    packages/catalog/test/services.test.ts      (create)
    packages/renderer/src/build.ts              (heading levels, lists, six CSS lines)
    packages/renderer/test/lists.test.ts        (create)
    packages/renderer/test/invariants.test.ts   (own preset, flattened hidden, INV_3 over the fixture)
    packages/renderer/test/browser-fixtures.ts  (the services cases: standard and long text)
    packages/renderer/test/overflow.browser.test.ts  (the per-element fit check, for the long-text case)
    fixtures/documents/cover-and-services.json  (create)
    fixtures/golden/cover-and-services.html     (create: UPDATE_GOLDEN=1, then read)
    fixtures/golden/*.html                      (the seven existing: +6 lines each, step 6)

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| step 1's commit | on its own, first, with its tests failing before and passing after, and the whole suite green |
| the compositions | approved by the CEO: A, B and C (2026-09-22) |
| `pnpm install` | completes, lockfile unchanged |
| `pnpm typecheck`, `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including the three new test files |
| `pnpm test:invariants` | exit 0, all reported by canonical name |
| `pnpm test:golden` | exit 0 |
| `git diff --numstat fixtures/golden` | `6 0` for each of the seven existing goldens, and nothing else |
| `pnpm test:a11y` | 0 failures, with the standard and long-text services cases included |
| `pnpm size`, `pnpm renderer:deps`, `pnpm schema:guard` | exit 0 |
| `pre-commit run --all-files` | six hooks, all Passed |

Manual:
- [ ] `pnpm site:sample cover-and-services`. At 1280 and at a verified 320 (Playwright): the cards
      are laid out as the composition says, one per row at 320, with no overflow and no
      intersecting boxes.
- [ ] Headings in order in the page's outline: `h1`, then `h2`, then `h3`.

- [ ] New tests that failed before and pass now
- [ ] The golden diff is exactly the one in step 6
- [ ] No keys and no real client data

## Out of scope

- **The other seven sections,** including images in lists ("Fotos de trabajos").
- **Validating item shape in `checkAgainstPreset`.** It needs a way for a preset to declare
  item slots in `PresetShape`, which is a schema interface change.
- **Teaching `arbitraryDocument` to generate lists,** so the fast-check invariants cover them.
- **One `<h1>` per page when a page has several covers.** Today each cover keeps its `<h1>`.
- **Styling headings by level instead of role** beyond the new `h3` rule. The services title is
  an `<h2>` and looks like the cover's subheading, which is acceptable in phase 1's single
  visual style.
- **Fixing long words:** hyphenation (`hyphens: auto` with `lang="es"`), `overflow-wrap`, or a
  smaller title size in narrow columns. If step 9's long-text case overflows, choosing among
  these is a design decision, not part of this task.
- **Lists in the document's mobile patch** (rule 7), the generator, and the editor.

## If anything is unclear, stop and ask

1. **The compositions not yet decided,** or any composition other than the ones chosen with the
   CEO, when step 2 is about to start.
2. **Step 1 not standing on its own:** its tests not failing before the change, the suite not
   green after it, or step 1 needing any change outside `revert.ts` and its test.
3. **A golden diff that differs from step 6 in any byte,** including any change inside an
   existing golden's `<body>`.
4. **Revert still reporting item elements as surplus** after step 1, or INV_3 failing over the
   fixture. Do not special-case the fixture. Bring the case.
5. **The a11y harness reporting anything** on the standard services combinations. Do not add an
   axe exception. Bring the combination, the node and the ratio.
6. **Any overflow in the long-text case,** at 320, 768 or 1280, in any composition: a box past
   the viewport, or a text element wider than its own box. Bring the composition, the width, the
   element and both widths.
7. **Overflow at 320 in the standard case,** or two cards side by side at 320.
8. **Any need to change `PresetShape`,** the document schema's shape, or the media query.
