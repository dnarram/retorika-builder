import { imageSourcesOf, type RetorikaDocument } from "@retorika/schema";

/**
 * Which images in a document are the owner's own, and therefore theirs to store.
 *
 * The mirror of `samplePhotos.ts`'s `listSampleRefs`, which lists the other kind, and the division
 * is the document's own: `sample` absent means the owner put it there, `sample` naming a bank id
 * means we did, and `sample` naming the catalog's marker means nobody has yet. Only the first kind
 * goes to the account — a bank photograph is our bytes, immutable, already served by
 * `/api/muestras/[id]`, and uploading a copy per owner would be paying to store what everybody
 * already shares (ADR 0037 §2).
 *
 * **The logo is always the owner's** (ADR 0059): it has no `sample` arm because nobody but the
 * owner can put one there, and the schema refuses a `data:` logo. It is listed through the same
 * walk as the photographs — `imageSourcesOf` — and that is not a nicety: this list is what the
 * account's reconciliation keeps, and `photoSyncPlan` **deletes from the bucket what the document
 * does not name**. A walk of this file's own that forgot the logo would have deleted it on the save
 * after the one that uploaded it.
 *
 * A separate module rather than logic inside `Variants`, for the reason `photoInventory.ts` gives
 * at more length: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so what can be
 * tested lives where it can be.
 */

export function listOwnPhotoSrcs(doc: RetorikaDocument): string[] {
  const srcs: string[] = [];
  const seen = new Set<string>();

  for (const source of imageSourcesOf(doc)) {
    if (source.kind === "element") {
      // Somebody else's bytes, or nobody's: a bank id or the marker. The marker is a `data:` URI
      // as well, so it is excluded twice over, and that is deliberate — the field is what the
      // document *says*, and the shape of the src is a convention that could change under it.
      if (source.sample !== undefined) continue;
      if (source.src.startsWith("data:")) continue;
    }
    // Hidden elements count. Rule 3 keeps a hidden element so the place to fill it in survives,
    // and a photograph the owner has hidden is still a photograph of theirs; dropping it would
    // mean unhiding it on another computer showed a gap.
    if (seen.has(source.src)) continue;
    seen.add(source.src);
    srcs.push(source.src);
  }

  return srcs;
}
