/**
 * The single source of truth for the invariant numbering.
 *
 * Test names are read from here and never typed by hand, and a test in
 * test/documentation-sync.test.ts fails if docs/document-rules.md stops matching.
 * There is exactly one copy of this list on purpose: the numbering drifted three
 * times while this work was being planned, every time because a second
 * hand-written copy existed somewhere.
 */

export const INVARIANTS = {
  INV_1: "Simple view opens every document and exposes every content field",
  INV_2: "Removing a section layout yields content equivalent to the preset",
  INV_3A: "Pure round-trip: revert(escalate(d)) equals d",
  INV_3B: "No content loss across intermediate content edits",
  INV_4: "Toggling the design-tools switch 100x leaves the document identical",
  INV_5: "Publishing produces identical output with tools on or off",
} as const;

export type InvariantId = keyof typeof INVARIANTS;

/** The name a test registers itself under, e.g. "INV_1 — Simple view opens ...". */
export function invariantTestName(id: InvariantId): string {
  return `${id} — ${INVARIANTS[id]}`;
}

/**
 * Invariants that Phase 0 cannot fully prove yet, with what would complete them.
 *
 * An invariant that looks covered and is not is worse than one that admits the gap,
 * so the gap is data rather than a comment someone has to remember to read.
 */
export const PROVISIONAL_INVARIANTS: Partial<Record<InvariantId, string>> = {
  INV_4:
    "The design-tools switch does not exist in phase 0. Only the schema's rejection of a " +
    "designTools key is verified; toggling the real switch a hundred times over a real " +
    "document arrives with the editor in phase 1.",
};
