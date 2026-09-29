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
 * Invariants that cannot be fully proven yet, with what would complete them.
 *
 * An invariant that looks covered and is not is worse than one that admits the gap,
 * so the gap is data rather than a comment someone has to remember to read.
 *
 * **Empty since sprint 8, and that is the point of it being empty.** Its only entry was
 * `INV_4`, which could not be proven because the design-tools switch did not exist:
 * flipping a local boolean a hundred times proves nothing about a document. The switch
 * exists now (ADR 0025), and the invariant is proven in the two places its two halves
 * live — the corpus's refusal of a `designTools` key in
 * `packages/renderer/test/invariants.test.ts`, and a hundred flips of the real switch
 * against a real stored session in `apps/editor/test/designTools.test.ts`.
 *
 * Adding an entry back is allowed and sometimes right. What is not allowed is leaving one
 * here after the gap closes, which is how this became a phase-0 note that outlived phase 0.
 */
export const PROVISIONAL_INVARIANTS: Partial<Record<InvariantId, string>> = {};
