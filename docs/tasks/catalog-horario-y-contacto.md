# Catalog: "Horario y ubicación" and "Contacto y reservas"

> **Claude-only. Exclusive zone.** `packages/catalog`, and the fixture and goldens that prove
> what it publishes. Not delegated to OpenCode under any circumstances.

## Objective

The two sections that questions 4 and 5 of the questionnaire feed (ADR 0010), so that the
generator has somewhere to put answers it already collects. With them the catalog goes from two
sections to four, and **the prototype's hand-written free section stops being necessary**.

## Where it comes from

- **Concept dossier §9:** "Horario y ubicación — Mapa, dirección y horas de apertura" and
  "Contacto y reservas — Formulario, teléfono y WhatsApp".
- **ADR 0010:** question 4 feeds "Horario y ubicación"; question 5 feeds the main button and
  "Contacto y reservas".
- **The prototype** (`docs/design/prototype/`) had to write "Contacto" as a **free section**,
  because the catalog has no such preset. That is the evidence this is the next piece.
- **Checked for this task:**
  - `safeUrl` is a deny-list (`javascript:`, `vbscript:`, non-image `data:`), so **`tel:`,
    `mailto:` and `https://wa.me/…` pass through untouched**. No renderer change is needed.
  - `role: "map"` renders as a link only. ADR 0004 promises "a static image plus a link", and
    the image half does not exist.
  - Heading levels are by section since the "Qué hago" task, so both new sections get `<h2>`
    with no work.

## The sections

**`location` — "Horario y ubicación"**

| Slot | Role | Cardinality |
|---|---|---|
| `headline` | heading | 1..1 |
| `address` | body | 1..1 |
| `hours` | body | 0..1 |
| `map` | map | 0..1 |

Two compositions: **`stacked`** (one column) and **`split`** (title and address at 1/6, hours and
map at 7/6).

**`contact` — "Contacto y reservas"**

| Slot | Role | Cardinality |
|---|---|---|
| `headline` | heading | 1..1 |
| `body` | body | 0..1 |
| `primaryAction` | button | 1..1 |
| `secondaryAction` | link | 0..3 |

Two compositions: **`stacked`** and **`side`** (text at 1/7, actions at 8/5).

**No form**, and **ADR 0016** in this same branch says so and amends dossier §9. Three links cover
what the dossier's form was for: `tel:`, `https://wa.me/…` and `mailto:`. The `field` role stays
unused, so the orphan `<input>` the renderer would emit is never published.

## A gap this task records and does not close

**`primaryAction` is 1..1, so a contact section with no action is not valid** — which is right: a
contact section with nothing to contact is furniture. Question 5 always yields an action unless
it is skipped, and if it is skipped ADR 0010 says there is no main button, so the section is not
generated either. Consistent so far.

**But question 4 is independent of question 5.** Someone can answer where they are and skip what
a visitor should do, and that site then has an address and opening hours and **no way at all to
get in touch** — which for a taverna is worse than having no site.

The answer is not in the catalog. It is probably either that the location section adopts the map
link as its action, or that the generator refuses that combination and asks again. **It is a
generator decision**, recorded here and as an open case in ADR 0016, and taken when the generator
is built.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

    packages/catalog/src/layout.ts              (create: the shared slot resolution)
    packages/catalog/src/cover.ts               (use it)
    packages/catalog/src/services.ts            (use it, and step 3's minimum)
    packages/catalog/src/location.ts            (create)
    packages/catalog/src/contact.ts             (create)
    packages/catalog/src/index.ts               (register and export)
    packages/catalog/src/search.ts              (aliases)
    packages/catalog/src/locales/es.json        (names)
    packages/catalog/test/location.test.ts      (create)
    packages/catalog/test/contact.test.ts       (create)
    packages/catalog/test/services.test.ts      (step 3: one card)
    packages/renderer/test/browser-fixtures.ts  (the two new preset cases)
    fixtures/documents/contacto-y-horario.json  (create)
    fixtures/golden/contacto-y-horario.html     (create: UPDATE_GOLDEN=1, then read)
    docs/decisions/0016-contact-section-has-links-not-a-form.md  (create)

**No change to `packages/renderer/src`.** `git diff --stat -- packages/renderer/src` must be
empty, and needing a change there is a stop.

## Steps

### 1. `layout.ts` — the shared slot resolution (its own commit, first)

`cover.ts` and `services.ts` resolve slot templates to placements with the same twenty lines.
CLAUDE.md says "no abstraction at two uses; wait for the third": this task is the third and the
fourth, so it is extracted now rather than copied twice more.

- `resolvePlacements(templates, variantId, elements)` returns the placements, and the
  unknown-variant error keeps naming the section it belongs to.
- **The goldens must stay byte-identical.** This is a refactor: it changes no output. A single
  changed byte in the existing seven is a stop.
- **Its own commit, separate from the new sections,** so "not one byte in the seven goldens" can
  be seen in isolation in the history.

### 2. The two presets

Registered in `index.ts`, with their aliases in `search.ts` and their Spanish names in
`locales/es.json`. Each gets a test file following `cover.test.ts`: slots and cardinality, every
variant placing every element and staying inside twelve columns, the compositions differing
pairwise, an unknown variant throwing, and every slot and variant having a locale key.

### 3. Issue #21, in its own commit

`SERVICES_ITEMS` from `{ min: 2, max: 6 }` to `{ min: 1, max: 6 }`, with a test for a single
card. ADR 0013 already decided it; this only makes the code say it.

### 4. The fixture and its golden

`contacto-y-horario.json`: a cover, `location` in `split` **with `hours` left out** to exercise
the optional slot, and `contact` in `stacked` with a `tel:` button and two secondary links
(WhatsApp and `mailto:`).

**Predicted diff: one new golden file and nothing else.** The stylesheet does not change, so the
seven existing goldens keep every byte.

**The contact details are filler and cannot be anyone's.** `example.com` is reserved for exactly
this, and the phone numbers start with a zero, which no Spanish number does — a plausible-looking
number would be somebody's, and this is a public repository. Any fixture that needs a phone from
now on uses the same shape.

### 5. The a11y harness

`PRESET_CASES` gains both sections, or `allCombinations()` throws by design. 2 sections × 2
compositions × 4 palettes × 3 type pairs = **48 combinations**, taking the suite from 409 tests
to **649**.

**Measured, on this machine, with `--maxWorkers 2`:**

| Sections | Tests | Wall clock |
|---|---|---|
| 2 (cover, services) | 409 | 31.3 s |
| 4 (with location and contact) | 649 | **64.9 s** |

Twice the sections, twice the time, and about 100 ms a test. The five sections still missing are
roughly twelve more compositions, which is **around 1,400 tests and well over two minutes** — the
point where nobody runs it before pushing and CI becomes the only place it happens.

The issue proposes representative sampling instead of the full cross product:
- **contrast is a property of a palette and a role**, not of a section;
- **overflow is a property of a typeface, a width and a geometry**, not of a palette.

At nine sections the full product is minutes, which is where people stop running it before
pushing. The issue carries the measured times rather than an intuition.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| `pnpm typecheck`, `pnpm lint` | exit 0 |
| `pnpm test` | green, with the three new catalog test files |
| `pnpm test:invariants` | green, all by canonical name |
| `pnpm test:golden` | green |
| `git diff --numstat fixtures/golden` | **only the new file** |
| `git diff --stat -- packages/renderer/src` | **empty** |
| `pnpm test:a11y` | 649 tests, 0 failures, with its time recorded |
| `pnpm size`, `pnpm renderer:deps`, `pnpm schema:guard` | exit 0 |
| `pre-commit run --all-files` | six hooks, all Passed |

Manual: `pnpm site:sample contacto-y-horario`, opened from the filesystem at 1280 and at a
verified 320 — the `tel:` and WhatsApp links are real links, the map link opens OpenStreetMap,
and nothing overflows.

**Status: done.** Verified 25 September 2026: `pnpm site:sample contacto-y-horario` built a real
ZIP; its `index.html` carries `tel:+34000000000`, `https://wa.me/34000000000`,
`mailto:hola@example.com` and an OpenStreetMap link — all real, none placeholder. `pnpm test`
(453/453), `pnpm test:golden` (13/13), `pnpm size`, `pnpm renderer:deps` and `pnpm schema:guard`
all green.

- [x] New tests that failed before and pass now
- [x] No keys and no real client data — `pre-commit run gitleaks --all-files` passes repo-wide

## Out of scope

- **A contact form**, in any shape: `mailto:` as a form action, a third-party endpoint, or an API
  of ours. ADR 0016 records why.
- **The static map image** of ADR 0004. It needs a tile provider and a licence, the same shape as
  the photo bank: recorded, not improvised.
- **Section anchors** (`id` on `<section>`), which would let the cover's button reach the contact
  section, and **issue #19**. Both rewrite every golden's `<body>`, and both wait until after the
  usability sessions.
- **Closing the gap above**: location without contact is a generator decision.
- The other five catalog sections, the generator, and the editor.

## If anything is unclear, stop and ask

1. **Any change needed in `packages/renderer/src`.**
2. **Any byte moving in the seven existing goldens**, which would mean step 1's refactor is not a
   refactor.
3. **axe reporting anything** on the new sections, or any overflow at 320, 768 or 1280.
4. **A form turning out to be necessary** — for example if **either** of the two owners says they
   expect messages to arrive from the web. One person in a sample of two is half of it, not an
   outlier, and it reopens ADR 0016 rather than being solved in code.
5. **The a11y suite already taking long enough to be a problem**, rather than at nine sections.
