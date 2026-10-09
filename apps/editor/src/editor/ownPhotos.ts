import { flattenElements, type RetorikaDocument } from "@retorika/schema";

/**
 * Which photographs in a document are the owner's own, and therefore theirs to store.
 *
 * The mirror of `samplePhotos.ts`'s `listSampleRefs`, which lists the other kind, and the division
 * is the document's own: `sample` absent means the owner put it there, `sample` naming a bank id
 * means we did, and `sample` naming the catalog's marker means nobody has yet. Only the first kind
 * goes to the account — a bank photograph is our bytes, immutable, already served by
 * `/api/muestras/[id]`, and uploading a copy per owner would be paying to store what everybody
 * already shares (ADR 0037 §2).
 *
 * A separate module rather than logic inside `Variants`, for the reason `photoInventory.ts` gives
 * at more length: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so what can be
 * tested lives where it can be.
 */

export function listOwnPhotoSrcs(doc: RetorikaDocument): string[] {
  const srcs: string[] = [];
  const seen = new Set<string>();

  for (const page of doc.pages) {
    for (const section of page.sections) {
      // `flattenElements`, because a gallery's photographs live inside list items — the omission
      // that caused three separate defects in one day of sprint 5.
      for (const element of flattenElements(section.content)) {
        const value = element.value;
        if (value?.kind !== "image") continue;
        // Somebody else's bytes, or nobody's: a bank id or the marker. The marker is a `data:` URI
        // as well, so it is excluded twice over, and that is deliberate — the field is what the
        // document *says*, and the shape of the src is a convention that could change under it.
        if (value.sample !== undefined) continue;
        if (value.src.startsWith("data:")) continue;
        // Hidden elements count. Rule 3 keeps a hidden element so the place to fill it in survives,
        // and a photograph the owner has hidden is still a photograph of theirs; dropping it would
        // mean unhiding it on another computer showed a gap.
        if (seen.has(value.src)) continue;
        seen.add(value.src);
        srcs.push(value.src);
      }
    }
  }

  return srcs;
}
