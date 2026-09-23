# 0003 — Deleting a section is permanent, and rule 3 is scoped to a section

**Status:** accepted · **Date:** 2026-09-16 · **Amended by:** [ADR 0014](0014-deleting-a-section-never-asks.md) (2026-09-23)

> ADR 0014 replaces the confirmation rule below: confirmation is never asked, and the undo toast
> offered afterwards stays instead of fading when the section held content the user wrote.
> Everything else here stands.

## Context

Rule 3 of the technical annex says *"los papeles se ocultan, nunca se borran"* — roles hide,
they are never deleted — so that the client always finds where to change their phone number.

But the concept dossier's phase 1 gives the user *"reordenar, duplicar y borrar"* sections, and
rule 5 says there are no orphan elements: every element belongs to a section. Deleting the
Precios section therefore has to do something with its text, and the two rules point in opposite
directions.

The tempting resolution is a trash inside the document: the section disappears from view but its
content is retained invisibly, so rule 3 holds literally. That is worse than it looks.

## Decision

**Delete is delete, and rule 3 is scoped: within a section, a role hides and is never deleted.**

- Deleting a whole section deletes its content.
- **There is no trash inside the document.** Content the user believes they deleted, silently
  retained where they cannot see it, is exactly what protocol Part 15 forbids — collect the
  minimum, keep it the shortest time, and let a deletion be a real deletion. It would also make
  every export and every template extraction carry invisible passengers.
- The safety net is **undo and named version history**, with entries of the form "Precios section
  deleted". That is recovery the user can see and reason about, rather than a hidden store they
  have to be told about.
- **Confirmation is asked only when the section holds content the user actually wrote.** A
  generated section they never touched is deleted without a prompt. Confirming everything trains
  people to dismiss confirmations.

Rule 3 keeps its full force where it was aimed: reverting to a preset, dropping a layout, an
element that no longer fits. There, content is hidden and recoverable, never dropped.

## Consequences

- `checkAgainstPreset` counts hidden elements as present. A `1..1` slot whose element is hidden
  is valid; the same slot with the element absent is a violation. That asymmetry is rule 3
  expressed as something a test can fail on.
- Version history becomes load-bearing rather than a nicety, and its absence in Phase 0 is a
  known gap: until the editor exists there is no undo, so nothing in Phase 0 deletes anything.
- The export is simpler and honest — what you see is what ships.

## Amends

Rule 3 of the technical annex of the advanced dossier.
