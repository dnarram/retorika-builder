import type { RetorikaDocument } from "@retorika/schema";
import { listOwnPhotoSrcs } from "./ownPhotos.ts";
import { listSampleRefs } from "./samplePhotos.ts";

/**
 * Where the bytes of every photograph a document names have to be fetched from.
 *
 * **Two sources now, and the document decides which** (ADR 0037). A bank photograph is ours and
 * comes from `/api/muestras/<id>`, as it has since sprint 6. A photograph of the owner's comes from
 * their own folder in the account's bucket — but only for a site that *is* in the account: for one
 * living in this browser the bytes are already here, in IndexedDB, and asking a server for them
 * would be asking for something nobody uploaded.
 *
 * A pure function rather than two loops inside the effect, for the reason `photoInventory.ts` gives
 * at more length: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so what can be
 * tested lives where it can be, and the effect becomes a loop over data.
 */

export type PhotoSource =
  /** Ours, immutable, shared by every owner of this sector. `id` is the bank id. */
  | { kind: "bank"; id: string; src: string }
  /** The owner's, in their own folder of the bucket. */
  | { kind: "account"; src: string };

/**
 * The sources for one document, in the order a reader scrolls past them, with no duplicates.
 *
 * **The bank half runs for an account site too.** A site saved before its owner replaced the cover
 * still names the bank photograph the generator chose, and that is the right thing for it to name:
 * the bytes are ours and are not going to be stored once per owner. So a site opened from the
 * account can have photographs from both sources at once, which is exactly the case that would
 * have been missed by asking «is this site in the account?» and fetching only one way.
 */
export function photoSources(
  doc: RetorikaDocument,
  options: { fromAccount: boolean },
): PhotoSource[] {
  const sources: PhotoSource[] = [
    ...listSampleRefs(doc).map((ref): PhotoSource => ({ kind: "bank", id: ref.id, src: ref.src })),
  ];
  if (options.fromAccount) {
    // `listOwnPhotoSrcs` excludes the bank and the marker, so these two lists cannot overlap —
    // asserted in the tests rather than assumed here, because that is a property of the document's
    // own `sample` field and not of this function.
    for (const src of listOwnPhotoSrcs(doc)) sources.push({ kind: "account", src });
  }
  return sources;
}
