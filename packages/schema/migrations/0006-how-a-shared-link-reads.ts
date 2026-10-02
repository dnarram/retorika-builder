/**
 * A document may say what a shared link shows: a description and the origin it will live at
 * (ADR 0029).
 *
 * **Additive, so `up` is a version stamp.** Both fields are optional and neither replaces anything:
 * a 1.4.0 document is already a valid 1.5.0 one, and the renderer's fallback — the cover's
 * subheadline — is what every document written before today publishes, which is also what they will
 * publish after it. Nothing has to be filled in on the way up, and that is the point of deriving
 * rather than copying.
 *
 * `down` strips both, for the reason `0002` strips `sample`: 1.4.0 is a strict schema with nowhere
 * to put them, so carrying them down would produce a document that does not parse at the version it
 * claims. The key is deleted rather than set to `undefined`, which the strict schema and
 * `exactOptionalPropertyTypes` both treat as a different thing.
 */

export const migration = {
  version: "1.5.0",
  description:
    "A document may carry the description and the origin a shared link reads from (ADR 0029).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.5.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const { siteDescription: _description, siteUrl: _url, ...rest } = input;
    return { ...rest, schemaVersion: "1.4.0" };
  },
} as const;

export default migration;
