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

## The three breakpoint adjustments

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

### `INV_4` is provisional in Phase 0

The design-tools switch does not exist yet. The only thing genuinely verified today is that the
schema rejects a `designTools` key. What completes this invariant — toggling the real switch a
hundred times over a real document and comparing bytes — arrives with the editor in Phase 1.

It is listed as incomplete on purpose. An invariant that looks covered and is not is worse than
one that admits what it does not yet prove.

---

## How this is enforced

Validation happens **on write, not on paint** (protocol Part 8.1). Every mutation goes through
`parseDocument`, so the editor cannot produce a broken document and the renderer does not have
to defend itself against impossible cases.
