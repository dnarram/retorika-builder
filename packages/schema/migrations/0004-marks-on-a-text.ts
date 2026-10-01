/**
 * A text value may carry marked runs — bold and italic over a span of characters (ADR 0024, with
 * ADR 0027 deciding what happens to one when the text beneath it changes).
 *
 * **Additive, like `0002` and unlike `0003`.** The field is new and optional: every 1.2.0 document
 * is already a valid 1.3.0 document, because none of them has a `marks` key and absent is the
 * legal state. So `up` has nothing to change but the version it claims, and nothing can be lost on
 * the way through.
 *
 * `down` is where the asymmetry lives, and it is worth stating rather than leaving to be noticed.
 * A 1.3.0 document **can** carry marks, and 1.2.0 has no place to put them, so going back
 * **drops them** — the text survives intact and the emphasis does not. That is the honest answer
 * for a narrowing: the alternative would be refusing to migrate down, which locks somebody out of
 * their own site over formatting. It is written here so a reader of a `down` that looks like a
 * version stamp knows it is not one.
 *
 * **What this file does not have to answer, and the window for that is now closed.** `0003` could
 * be a pure version stamp because nothing had ever written to `style`. The same is true here on the
 * day it is written: no fixture, no generator and no editor has ever produced a `marks` key. The
 * day after the toolbar ships, a document saved against 1.2.0 can carry one — and then an `up` that
 * only stamps a version would be wrong, because `marksSchema` validates a normal form that an older
 * writer had no reason to produce. Nothing needs doing today; it needed saying.
 */

export const migration = {
  version: "1.3.0",
  description: "A text value may carry marked runs: strong and em over a span of characters.",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.3.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    return { ...stripMarks(input), schemaVersion: "1.2.0" };
  },
} as const;

/**
 * Every `marks` key removed, wherever a value carries one.
 *
 * Written as a walk over unknown JSON rather than over the parsed document, because a `down`
 * migration runs on input that does not satisfy the *current* schema by definition, and parsing it
 * first would be asking the new schema to validate something on its way to being old.
 */
function stripMarks(input: unknown): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node === null || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      // Only on something that is a text-carrying value: a collection one day called `marks`
      // for its own reasons should not be silently emptied by a migration about typography.
      if (key === "marks" && "kind" in node && (node.kind === "text" || node.kind === "link")) {
        continue;
      }
      out[key] = walk(value);
    }
    return out;
  };
  return walk(input) as Record<string, unknown>;
}

export default migration;
