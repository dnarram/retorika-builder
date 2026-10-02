/**
 * An exact length is a number of pixels, and nothing else (ADR 0026 §2, narrowed).
 *
 * **A narrowing, and cheap for the reason `0003` and `0005` were cheap: the affected set is empty.**
 * Counted rather than assumed — three exact values exist across `fixtures/documents/` and the six
 * prototype documents under `docs/design/`, and they are one `28px` and two hex colours. There is no
 * `rem`, no `em` and no `%` anywhere, and nothing can write one: the floating toolbar is the only
 * producer of an exact length in this product, and it writes pixels.
 *
 * **What it closes is a state the owner could see and not edit.** The toolbar reads `px` too, so a
 * stored `2rem` came back as an empty number field wearing the highlight that means «there is an
 * exception here» — visible on the published page, unreadable in the control, and clearable but not
 * changeable. That is the same shape ADR 0030 closed for the tablet bucket.
 *
 * `up` is a version stamp: there is nothing to convert, because there is nothing stored in another
 * unit. **If that ever stops being true this file is wrong**, which is why the claim has its own
 * test rather than living only in this comment.
 *
 * `down` is a version stamp for the mirror reason: every `px` value this version admits was already
 * admitted by 1.5.0, so going back takes nothing away.
 */

export const migration = {
  version: "1.6.0",
  description: "An exact length is a number of pixels; rem, em and % are no longer admitted.",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.6.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.5.0" };
  },
} as const;

export default migration;
