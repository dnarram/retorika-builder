# 0014 — Deleting a section never asks, and the undo toast stays when the content was the user's

**Status:** accepted · **Date:** 2026-09-23 · **Decided by:** the CEO · **Amends:** [ADR 0003](0003-section-deletion-is-permanent.md)

## Context

[ADR 0003](0003-section-deletion-is-permanent.md) settled that delete is delete, with undo and
version history as the safety net, and added: "Confirmation is asked only when the section holds
content the user actually wrote."

The phase 1 screens (`docs/design/HANDOFF.md`, D8, and
`docs/design/mockups/11-state-section-deleted.html`) draw no dialog at all. The section goes, a
dashed placeholder briefly marks the gap, a dark toast reads `Has borrado la sección «Opiniones»`
with a `Deshacer` button, and the undo arrow in the top bar lights up.

The two cannot both be true, and both have a point. A dialog on every delete trains people to
dismiss dialogs, which is what ADR 0003 was avoiding with its "only when". But a toast that fades
after a few seconds is a weaker net than a dialog for a section the user spent ten minutes
writing.

## Decision

- **No confirmation dialog, ever.** Deleting a section is immediate.
- **The toast is the confirmation, offered after the fact instead of before it,** with
  `Deshacer`, plus the undo arrow and the version history entry ADR 0003 already requires.
- **The toast does not fade when the section held content the user wrote.** It stays until the
  user dismisses it or acts on it.
  - A generated section the user never touched: the toast behaves normally and fades.
  - A section they edited: it waits. What distinguishes the two is exactly the condition ADR 0003
    used for its dialog, so the rule it was protecting is kept and only the moment changes.

## What this amends

ADR 0003's line "Confirmation is asked only when the section holds content the user actually
wrote" is replaced by: **confirmation is never asked; the undo it offers afterwards is persistent
in precisely that case.** Everything else in ADR 0003 stands, including that delete is delete,
that there is no trash inside the document, and that version history is load-bearing.

## Consequences

- The editor needs to know whether a section's content was ever edited by the user. That is a
  property of the document's history, not a new field to invent: it is what version history
  already tracks.
- Phase 1 has undo (protocol, Fase 1), so the net exists before the first delete does.
- The toast's Spanish copy comes from the mockup into `apps/editor/src/locales/es.json`, like
  every other interface string.
