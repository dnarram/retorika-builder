# 0002 — The escalate/revert invariant is restated as two, scoped to content

**Status:** accepted · **Date:** 2026-09-16

## Context

The advanced dossier's technical annex lists as an invariant: *"Escalar y volver devuelve un
documento idéntico al de partida"* — escalating a section to free layout and reverting it
returns a document identical to the starting one.

Section 5 of the same dossier says two things that contradict it:

- while the section was free, the designer could add two photos and a button the catalog has
  nowhere to put, and *"lo que sobra se guarda oculto por defecto"* — the surplus is stored
  hidden;
- *"los ajustes hechos solo para móvil pertenecen a la maquetación, así que también
  desaparecen"* — mobile-only adjustments belong to the layout and disappear on revert.

A document carrying newly hidden elements, minus its mobile patches, is not identical to the one
we started with. Both statements cannot be true once any edit happens in between. Written as it
stood, the invariant could only be satisfied by never editing, which is not the case worth
testing.

## Decision

**Split it into two invariants, and scope both to content.**

- `INV_3A` — *Pure round-trip: revert(escalate(d)) equals d.* For every valid document, escalate
  then revert with no edits in between, and the result is equal on structure and content,
  ignoring timestamps. Verified as a fast-check property.
- `INV_3B` — *No content loss across intermediate content edits.* For any sequence of content
  edits, no content id present before the revert is absent after it, except ids the user
  explicitly marked for deletion. What does not fit the preset is present with `hidden: true`,
  never missing. Verified as a fast-check property.

**Scope.** The invariant is about content. Layout and per-breakpoint adjustments belong to the
layout object, and their disappearance on revert is correct by rule 1 — layout never owns
content — rather than a defect to be engineered around.

**The guarantee lives in the shape of the API, not in a dialog.** A dialog can be dismissed,
skipped or rebuilt wrongly in a future screen; a function signature cannot.

- `planRevert(section, preset)` returns the plan, including the list of elements that do not fit.
- `applyRevert(section, preset, decisions)` **rejects the operation** if any element on that list
  arrives without an explicit decision.

The interface's default for that decision is "hide", so the dossier's promise — *"nada se borra
en silencio"* — is the path of least resistance rather than a thing to remember.

## Consequences

- The engine can never lose content by accident: losing it requires a caller to say so, per
  element, in a typed argument.
- `docs/document-rules.md` carries the restated wording; the `.docx` annex stays as approved.
- The canonical identifiers and names of all five invariants live in exactly one place,
  `packages/schema/src/invariants-catalog.ts`. Test names are read from that constant and a test
  asserts the documentation still matches it. This is not ceremony: the numbering drifted three
  times while planning this work, every time because a second hand-written copy existed.

## Amends

The technical annex of the advanced dossier, "Las siete reglas del documento", and §11 "Cómo se
demuestra", third bullet.
