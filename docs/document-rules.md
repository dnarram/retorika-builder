# The document rules

This restates the technical annex of the advanced dossier ("Anexo técnico. Las siete reglas del
documento") in English, with the amendments approved in ADRs 0002, 0003 and 0004.

The `.docx` dossiers in `docs/dossiers/` stay untouched: they are the board-approved artefacts
and remain the source of truth for the product. **This file is the source of truth for the
document model**, and where the two disagree, the disagreement is recorded in an ADR — never
left implicit.

---

## The seven rules

1. **Layout never owns content: it holds references only.** No removal of layout can drag text
   or photos with it.

2. **Every element carries a role from a closed vocabulary.** The simple view builds its form by
   walking roles, so it always knows how to offer "change the title", wherever the element sits.

3. **Within a section, a role hides — it is never deleted.** The client always finds where to
   edit, including what is hidden.

   > *Amended by ADR 0003.* The original annex said "roles hide, never delete" without scope,
   > which contradicted the Phase-1 ability to delete a section. The rule governs what happens
   > *inside* a section — reverting to a preset, dropping a layout, an element that no longer
   > fits. Deleting a whole section deletes its content, and there is no hidden trash inside the
   > document. The safety net is undo and named version history.

4. **Positions are relative to the section's grid, never absolute on the page.** There is a
   deterministic reading order, which is what the simple view and the mobile derivation need.

   > *Tested against a real owner, 27 September 2026 — and it held.* Asked what the site lacked,
   > Conchi wanted «la posibilidad de mover libremente las imágenes […] por donde quiera»
   > (`docs/sessions/2026-09-27-conchi.md`). That is this rule, refused in as many words, by the
   > first person outside the team to use the tool unaided.
   >
   > **The rule is not amended and nothing here proposes amending it.** One owner asking is not a
   > case for moving a foundation, and rule 5 below already names exactly what she asked for —
   > "the hole free placement would otherwise open" — so this was foreseen rather than
   > discovered. What free positioning would cost is still what it always was: the deterministic
   > reading order, the mobile derivation of rule 7, and the promise that a site cannot be
   > arranged into something unpublishable.
   >
   > It is recorded because the cost of this rule now has a face, and because the next person to
   > hear the request should hear it as the second time rather than the first. Acting on it would
   > need an ADR before any code, which `CLAUDE.md` already requires.

   > *And it is now the second time, 30 September 2026 — and it still held.* The third session's
   > owner named «más libertad en la posición» among seven things he wanted and could not find
   > (`docs/sessions/2026-09-30-taller.md`). **Two owners out of three have now asked.**
   >
   > **The rule is still not amended.** What changed is the shape of the request, and that is the
   > part worth having: by 30 September the grid *existed* — sprint 8 built placement inside the
   > section's grid (ADR 0025 §7) — and he had the design tools switched on, so both doors were
   > open to him. What he was refused was never placement; it was placement off the grid. Whether
   > he ever opened the `Diseño` panel is not recorded.
   >
   > So the second asking does not say the grid is missing. It says the grid as built did not read
   > as the answer to "I want to move this", which is a question about the control and not about
   > this rule. Two owners is still not a case for moving a foundation, and rule 5 below still
   > names exactly what both of them asked for.

5. **There are no orphan elements: every element belongs to a section, every section to a
   page.** This closes the hole free placement would otherwise open — there is no floating layer
   above the site.

6. **Style is references to the system; an exact value is stored as a marked exception.**
   Changing the palette keeps working across the whole site, hand-designed sections included.

7. **Mobile is a patch over the automatic derivation, not a parallel tree.** If the desktop
   changes, the patch is reapplied and there are never two sites to maintain.

---

## The role vocabulary, v1

Nine roles and one container:

| Role | Notes |
|---|---|
| `heading` | |
| `subheading` | |
| `body` | |
| `image` | |
| `embed` | The opaque block: custom code, third-party widgets, embedded video. The simple view shows it labelled and not editable there. Stripped when a third-party template is extracted. |
| `button` | |
| `link` | |
| `field` | |
| `map` | Published as a static image plus a link to the maps application. An interactive map is optional and counts against the JavaScript budget. |
| `list` | **The container.** A repeater: the preset declares which roles each item carries and how many items are allowed. The same piece the Phase-3 collections will use. |

Icons are **not** a role. They are a selectable property of the preset or the variant.

### The asymmetry that makes this safe to extend

**Adding** a role is backward-compatible and bumps the **minor** version. **Removing or
renaming** one is what breaks, and bumps the **major** version. "Closed" means closed *for this
schema version*, not closed forever — so there is no reason to hoard roles defensively, and no
reason to fear the migration of a later addition.

---

## The token namespace, v1

Style references are validated against a closed list. With an open namespace a typo becomes a
dead reference discovered on a client's published site; with a closed one it is a validation
error at write time. Rule 6 is not checkable without this.

```
color.primary   color.secondary   color.accent
color.surface   color.ink         color.muted
font.heading    font.body
size.heading    size.subheading   size.body
space.xs   space.sm   space.md   space.lg   space.xl
radius.sm  radius.md  radius.lg
```

Extending this list is additive and bumps the minor version, exactly like the roles.

A document's `theme` is a **complete map** from this namespace to values, validated in both
directions: an unknown key is an error, and a missing key is an error too. Totality is what lets
one click restyle the whole site, and what lets the renderer emit the theme as CSS custom
properties in alphabetical order — which is what the determinism of `INV_5` rests on.

The Retorika brand palette does not live here. A document's theme is the client's, not ours.

---

## The five style properties

Sprint 9, schema 1.2.0; the fifth joined in sprint 13, schema 1.7.0. The namespace above says which
*values* exist; this says which **properties an element may set**, and it is the other half of making
rule 6 checkable.

An element's `style` used to be an open map: `{"wobble": {ref: "color.primary"}}` parsed. Closing
the key to a flat list of property names would not have been enough either, because
`{color: {ref: "space.md"}}` publishes `color: 16px` — a dead reference of a different kind, and one
nobody discovers until it is on a client's site. So each property is bound to its own family:

| Property | References it admits | An exact value? |
|---|---|---|
| `color` | `color.primary`, `color.secondary`, `color.surface`, `color.ink`, `color.muted` | a hex triple |
| `fontSize` | `size.heading`, `size.subheading`, `size.body` | a length in pixels |
| `fontFamily` | `font.heading`, `font.body` | **no — and that is the decision** |
| `padding` | `space.xs` … `space.xl` | a length in pixels |
| `borderRadius` | `radius.sm`, `radius.md`, `radius.lg` | a length in pixels |

### The asymmetry in the last column

**Four properties have both of rule 6's arms; `fontFamily` has only the first** (ADR 0032, sprint 13).
A reference here resolves through the type pair the site is on, to a family the ZIP either ships or
degrades from honestly. An **exact** family would be a name somebody types: a face that does not
travel, and a letterform the visitor may never receive — which is the one promise this product has
refused since mockup 17 drew the control struck through.

So the refusal is **not a rule anybody has to remember.** `EXACT_PATTERNS` in `tokens.ts` is partial
over the property list rather than total, and the schema for this one property is built from the
reference arm alone, so there is no shape an exact family could take. Writing one is a **compile
error** as well as a rejected parse — the second half arrived a day after the first and `style.test.ts`
holds it with a `@ts-expect-error` that fails the build if the arm ever comes back.

Two deliberate absences remain:

- **`color.accent` is admitted nowhere.** No rule the renderer emits reads `var(--color-accent)`, a
  test asserts that no document in the corpus does either, and it is the one colour whose contrast is
  asserted in no palette — 3.19:1 on surface in `classic-blue`, under AA.
- **No third family**, and no family of the owner's own. The two in the table are the two the theme
  already carries, so an element chooses between the faces that are already in the ZIP and costs it
  nothing.

  > **This entry said the opposite until 2 October 2026, and both corrections are worth keeping.**
  > It first said «`font.heading` and `font.body` are not here at all», on the stated grounds that
  > ADR 0001 forbids downloading the stacks. **Corrected 1 October 2026:** that ground was false —
  > ADR 0028 self-hosts `modern-sans` and `classic-display`'s faces inside the ZIP, which is shipping
  > bytes the owner already has, not a published page calling out to a third party. The entry then
  > kept refusing the *per-element* typeface, on the grounds that it «could name a face nobody has
  > shipped». **Corrected again 2 October 2026 (ADR 0032):** it cannot, because it cannot name a face
  > at all. A reference is all there is, both references already travel, and the exact arm the
  > objection assumed does not exist. What stays refused is only «tipografías propias» — a family the
  > owner writes — and that reason has not expired.
- **The list is disjoint from `display`, `order`, `width` and the grid columns**, and that is rule 7
  rather than tidiness. **A media query adds no specificity**, so a per-element rule outranks a
  mobile patch: if `display` were here, an element hidden by its own patch would reappear on the
  phone and rule 7 would lose in silence. Those properties belong to rules 4 and 7, and stay there.

An exact value is narrower still: **a colour is a hex triple, and a measurement is a length in
pixels and in no other unit.** The schema is the gate a *stored* document passes, so admitting
`rgb(0 0 0)` would let somebody save a site the renderer cannot publish — an invalid state whose only
repair would be an interface for it. See ADR 0026.

> **Narrowed to pixels on 2 October 2026 (schema 1.6.0), and counted before it was narrowed.** It
> admitted `rem`, `em` and `%`, and **nothing in the product could ever write one**: the floating
> toolbar is the only producer of an exact length and it reads and writes `px`, so a stored `2rem`
> came back as an empty field highlighted as though it held an exception — visible on the page,
> unreadable in the control, and only clearable. Three exact values exist across the corpus and the
> prototype documents, all of them `px` or hex, so the narrowing moved no data. `0` keeps its place
> without a unit, because `0` is a length and the one value for which a unit is noise.

---

## The two marks

Sprint 10, schema 1.3.0. A text value may carry **runs of emphasis over its own characters** — the
first thing in this model that is smaller than an element.

```
{ kind: "text", text: "Solomillo al whisky", marks: [{ from: 0, to: 9, mark: "strong" }] }
```

**The field stays a plain string**, and that is the decision rather than the implementation. A mark
is a pair of offsets *beside* the text, never markup *inside* it: no `execCommand`, no editable
HTML, no second serialisation format. Applying one reads the character offsets of a selection and
dispatches an action like every other edit; the renderer splits the string at those offsets, escapes
each piece separately, and wraps only the marked ones. See ADR 0024.

**There are two and there is no third.** `strong` and `em` are the ones that mean *emphasis* rather
than decoration, and that a screen reader conveys. **Underline is refused permanently** — on the web
an underline means a link, and a word underlined that goes nowhere is the same promise-with-nothing-
behind-it this product refuses everywhere else. Two owners out of three have now asked for it; the
answer has not moved.

Four rules the schema enforces, each refused rather than repaired:

| Rule | Why it is not merely tidiness |
|---|---|
| A run points inside its own text | An offset past the end publishes nothing the owner wrote |
| `from < to` | A mark over nothing is not a mark, and would be a second document meaning the same as one without it |
| **No two runs of the same mark touch or cross** | One meaning, one document. Otherwise the bytes depend on which word somebody marked first, and `removeMark` stops being expressible |
| A boundary may not split a surrogate pair | An emoji is two code units; the renderer escapes each piece separately and the file is written as UTF-8, so a cut between them publishes `Café 🍷 tinto` as `Café �� tinto` |

**Two runs of *different* marks may cover the same characters**, which is the one clause of ADR 0024
that ADR 0027 amends. Read literally, «a run may not overlap another» made bold *and* italic on the
same words impossible — and that is the first thing the third session's owner named. Two runs of the
*same* mark that touch or overlap merge into one; two separated by any unmarked text, **one space
included**, stay two and publish different bytes.

**Offsets are UTF-16 code units** — the units `String.prototype.slice` takes and the units a DOM
`Range` reports inside a text node. The same units at both ends, with no conversion anywhere, is
what keeps a mark from drifting the first time somebody bolds a word after an emoji.

Two deliberate absences, named for the same reason the style table names its three:

- **A mark is a property of the value, not of the role.** ADR 0004's closed vocabulary is untouched:
  a `strong` run inside a body text is still a body text. The schema accepts marks on **any** text
  value, a link's label included, so the renderer splits every text by one code path — one path is
  the safety argument for the only place in this product that escapes a string in pieces. The editor
  draws `B` and `I` only where they mean something, which is an interface choice and reversible.
- **What happens to a mark when the text beneath it changes is not here**, because it is behaviour
  rather than shape: ADR 0027 holds the word processors' convention — inside grows, at the end
  continues, at the start does not, deleting part shrinks, deleting all removes — and the finding
  that those five rows are one offset rule.

---

## The three breakpoint adjustments, in the one bucket there is

**`breakpoints` holds exactly one key, `mobile`** (ADR 0030, schema 1.4.0). It held a `tablet` one
until sprint 12, and nothing could ever publish it: no verb wrote a tablet patch, and the renderer
threw on one from sprint 8 onwards — so a document carrying it was valid, storable and autosavable,
and refused at the one moment that mattered. The schema refuses it now, which is the difference
between an invalid state the product prevents and one it repairs. The advanced dossier §4's
«Escritorio, tablet y móvil, editables» is **not** kept, and ADR 0030 says so rather than letting
the omission be discovered.

A breakpoint patch may do exactly three things, and the type says so rather than accepting a
free-form patch:

1. **hide** the element,
2. change its **order**,
3. change its **size**.

There is no fourth. These are the three the concept dossier promises on screen 5 ("Ocultar en
móvil, cambiar el orden y reducir una foto. Nada más"). `checkInvariants` rejects a patch
carrying any other property, which is what stops the mobile view from quietly growing into the
second design rule 7 exists to prevent.

---

## What a shared link reads

Two optional fields on the document itself, and the only two that describe the site rather than a
page of it (ADR 0029).

| | |
|---|---|
| `siteDescription` | The sentence a shared link shows. **Starts empty and usually stays empty**: the renderer falls back to the cover's subheadline, so this holds a sentence only when somebody chose a different one |
| `siteUrl` | The `https` origin the owner says their site will live at. An origin and nothing else — no path, no query, no trailing slash |

**Derived, never copied**, which is ADR 0022's principle applied a second time. A field born
pre-filled with the subheadline would be stale the first day somebody edited the cover, and then
there would be two sentences and neither in charge. Deriving at the moment of publishing cannot go
stale, and nothing has to be kept in step.

**The chain may end at nothing, and that is an answer.** A cover's `subheadline` is `0..1`, so a
document can have neither — and no description is better than one invented from the business name,
which is a sentence nobody reviewed.

**`siteUrl` is not `buildSite`'s `baseUrl`.** That one says where *this build* is being served from
and is omitted for a download; this says where the owner is going to put the files. Reading one as
the other would put a sitemap in a ZIP. It exists because a preview image must be an absolute URL —
every scraper refuses a relative one — and a ZIP does not know what domain it will be opened under.

## What never enters the document

These keys are rejected by the schema, not ignored. A test asserts the rejection of each one.

| Key | Where it belongs instead |
|---|---|
| `designTools` | The account. Depth is a property of the person looking, never of the site — that is the Wix trap the advanced dossier §2 exists to avoid. |
| `ownerId` | The database. |
| `locked` | The database. |
| `paymentStatus` | The database. |
| `subscription` | The database. |

The document describes a website. It does not describe who paid for it, who owns it, or what
they are allowed to do with it.

---

## Embeds are off by default

The renderer takes `allowEmbeds`, defaulting to `false`. With it off, an `embed` emits a marker
comment and its payload never reaches the output.

**Turning embeds on requires its own ADR.** It is the only surface on which we publish HTML we
cannot escape, and every other guarantee in this file assumes escaped output.

---

## The invariants

These identifiers and names are transcribed from `packages/schema/src/invariants-catalog.ts`,
which is the single source. A test reads this file and fails if any identifier or name below
has drifted from the constant.

| Id | Name |
|---|---|
| `INV_1` | Simple view opens every document and exposes every content field |
| `INV_2` | Removing a section layout yields content equivalent to the preset |
| `INV_3A` | Pure round-trip: revert(escalate(d)) equals d |
| `INV_3B` | No content loss across intermediate content edits |
| `INV_4` | Toggling the design-tools switch 100x leaves the document identical |
| `INV_5` | Publishing produces identical output with tools on or off |

### On `INV_3A` and `INV_3B`

*Amended by ADR 0002.* The original annex stated a single invariant — "escalating and reverting
returns a document identical to the starting one" — which could not hold: §5 of the same dossier
says surplus content is hidden and mobile-only adjustments disappear. Both cannot be true once
any edit happens in between.

So it is two invariants, and their scope is **content**:

- `INV_3A` is the pure case. Escalate and revert with no edits in between, and the document is
  equal on structure and content, ignoring timestamps.
- `INV_3B` is the real case. Across any sequence of content edits, no content id present before
  the revert is absent after it, except ids the user explicitly marked for deletion. What does
  not fit the preset is present with `hidden: true` — never missing.

Layout and breakpoint patches belong to the layout object, and losing them on revert is correct
by rule 1, not a defect.

The guarantee lives in the shape of the API rather than in a dialog: `planRevert` returns the
list of elements that do not fit, and `applyRevert` **rejects the operation** if any element on
that list arrives without an explicit decision. The interface's default for that decision is
"hide".

### On `INV_4`, and where its two halves are proven

*Completed in sprint 8. This section said the opposite for seven sprints, and the reason it could is
worth keeping: the sync test below checks that the identifiers and names match the catalog, never
that the prose around them is still true.*

The design-tools switch exists (ADR 0025). It lives in the browser's `localStorage` under a key of
its own, `retorika.designTools.v1`, separate from the autosaved session — not in an account, because
there are no accounts (ADR 0012 approved `localStorage` alone; ADR 0021 deferred the database). The
row above still reads "the account" because that is where it belongs once accounts exist, and
`apps/editor/src/editor/designTools.ts` is the single file that moves when they do.

The invariant has two halves and they are proven in two places, because no one place can reach both:

- **The document has nowhere to store it.** Every fixture in the golden corpus is offered a
  `designTools` key and the schema refuses it — `packages/renderer/test/invariants.test.ts`. This is
  the half that belongs beside the corpus.
- **A hundred flips write nothing.** The real switch is flipped a hundred times over a real saved
  session and the stored bytes are compared — `apps/editor/test/designTools.test.ts`. A package may
  not import an app, so this half cannot live with the other one.

Both register under the canonical name, so `pnpm test:invariants` runs both and neither can be
dropped without the count changing.

What makes this hold by construction rather than by vigilance: the switch is deliberately **not** a
field of `StoredSession`. Autosave runs when the answers, the histories, the open variant or the page
change; the switch is none of those, so flipping it does not even reach a save. Were it a session
field, every flip would rewrite the document's serialisation — which is exactly the failure the
advanced dossier §4 names: «Si encender las herramientas escribe algo en el proyecto, hemos
reconstruido el problema de Wix.»

It also means `clearSession()` — «Volver a empezar» — throws away the draft and keeps the
preference. Restarting a site is a decision about the site; being someone who lays out pages by hand
is not.

`PROVISIONAL_INVARIANTS` in `packages/schema/src/invariants-catalog.ts` is consequently **empty**.
Adding an entry back is allowed and sometimes right; leaving one there after its gap closes is what
went wrong here.

---

## How this is enforced

Validation happens **on write, not on paint** (protocol Part 8.1). Every mutation goes through
`parseDocument`, so the editor cannot produce a broken document and the renderer does not have
to defend itself against impossible cases.
