/**
 * An element's `style` stops being an open map and becomes four named properties, each bound to
 * its own family of tokens (ADR 0026).
 *
 * **This migration moves no data, and the reason it does not is the whole justification for
 * doing it now.** `ContentElement.style` has existed since phase 0 and **nothing has ever written
 * to it**: no fixture carries one, no document in the prototype corpus carries one, and no producer
 * — not the generator, not the catalogue, not the editor — has ever set the field. So every 1.1.0
 * document is already a valid 1.2.0 document, and `up` has nothing to change but the version it
 * claims.
 *
 * **That stops being true the day somebody writes styles against 1.1.0.** This is a *narrowing*,
 * unlike `0002`, which was additive: `{"wobble": {ref: "color.primary"}}` parsed yesterday and does
 * not parse today, and so does `{color: {ref: "space.md"}}`. If any stored document carried such a
 * thing, this `up` would have to decide what to do with it — drop it silently, which loses work, or
 * refuse to migrate, which locks somebody out of their own site. Neither is a good answer, and the
 * only reason this file does not have to give one is that the set of affected documents is empty.
 * The window for making this change cheaply was open exactly once, and this is it.
 *
 * `down` is a version stamp for the mirror-image reason: every 1.2.0 `style` object is a perfectly
 * valid 1.1.0 open map, since the old key was `z.string()` and the old value was ref-or-exact. The
 * round-trip test compares against it, and here what it proves is that the narrowing really is a
 * narrowing — nothing is added going up, so nothing has to be stripped coming down.
 */

export const migration = {
  version: "1.2.0",
  description:
    "An element's style is four named properties, each admitting only the tokens that mean something for it.",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.2.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.1.0" };
  },
} as const;

export default migration;
