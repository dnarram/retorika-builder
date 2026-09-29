import { PLACEHOLDER_SAMPLE_ID } from "@retorika/catalog";
import { flattenElements, type RetorikaDocument } from "@retorika/schema";

/**
 * Which bank photographs a document names, so the app can go and fetch their bytes.
 *
 * A generated document can only *name* the photograph the bank chose: `generateVariants` runs in
 * the browser, so it cannot read a file. The bytes are fetched from `/api/muestras/<id>` and then
 * stored exactly like a photograph the owner uploaded — same IndexedDB store, same object URL map,
 * same multipart field on the way to `/api/download`. **A bank photograph is an upload the app made
 * on the owner's behalf**, and being literally that is what keeps the preview, the ZIP and the size
 * bounds from each needing a second case.
 *
 * A separate module rather than logic inside `Variants`, for the reason `photoInventory.ts` gives
 * at more length: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so a component
 * cannot be unit-tested here at all. What can be tested lives here.
 */

export interface SampleRef {
  /** The bank id — what `/api/muestras/<id>` takes, and what the document's `sample` field says. */
  id: string;
  /** The name the file takes in the bundle, which is the document's `src` and the key everything
   * downstream is already keyed by. */
  src: string;
}

/**
 * Every bank photograph the document references, deduplicated and in document order.
 *
 * Three kinds of image exist and only one of them belongs here. An image with no `sample` is the
 * owner's own and its bytes are already stored. An image whose `sample` is the catalog's marker is
 * a `data:` URI, self-contained, needing no file. What is left — a `sample` naming a bank id — is
 * the one kind whose bytes live on the server and have to be fetched.
 *
 * Deduplicated by src because the same photograph may legitimately appear twice (a sector with
 * eight images and a gallery of eight will not repeat, but nothing guarantees that for a smaller
 * bank), and fetching it twice would store the same bytes under the same key twice.
 *
 * `flattenElements`, because a gallery's photographs live inside list items — the omission that
 * caused three separate defects in one day of sprint 5.
 */
export function listSampleRefs(doc: RetorikaDocument): SampleRef[] {
  const refs: SampleRef[] = [];
  const seen = new Set<string>();

  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        const value = element.value;
        if (value?.kind !== "image") continue;
        const id = value.sample;
        if (id === undefined || id === PLACEHOLDER_SAMPLE_ID) continue;
        if (seen.has(value.src)) continue;
        seen.add(value.src);
        refs.push({ id, src: value.src });
      }
    }
  }

  return refs;
}
