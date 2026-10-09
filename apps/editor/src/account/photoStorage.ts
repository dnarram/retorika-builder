import type { Client } from "../auth/clients.ts";
import { PHOTO_CONTENT_TYPE } from "../editor/downloadGate.ts";
import { isAcceptedImage, sniffImage } from "../editor/imageBytes.ts";

/**
 * The owner's photographs, in the account rather than in one browser (ADR 0037).
 *
 * **The bytes travel the path a bank photograph already took.** Since sprint 6 a bank photograph
 * has gone from `/api/muestras/<id>` into IndexedDB, into the object-URL map the preview reads, and
 * into the multipart form the download builds — and `samplePhotos.ts` says what that makes it: «an
 * upload the app made on the owner's behalf». An account photograph is the same shape with a
 * different source, so nothing downstream needs a third case.
 *
 * **Everything here takes the `Client` rather than building one**, exactly as `sites.ts` does, so
 * each call is testable against a stub and none of it can reach for a key it should not have. The
 * client carries the signed-in person's own session; what it is allowed to do is decided by the
 * policies in `packages/db/migrations/0003-*.sql`, not here. What those policies hold is proven by
 * `packages/db/test/storage.pg.test.ts` against a real Postgres, not by this file.
 */

/** The bucket migration `0003` creates. Private: a published site never reads from it (ADR 0001). */
export const PHOTO_BUCKET = "fotos";

/**
 * Where one photograph lives: `<owner>/<site>/<src>`.
 *
 * The first segment is what every policy compares against `auth.uid()`, so it is the whole of
 * ownership. The second makes a site's photographs a listable prefix, which is what reconciliation
 * and the account purge each need. The third is the document's own `src` — unchanged, so the
 * document needs no new field, and stable per slot, so replacing a photograph overwrites one
 * object instead of accumulating two.
 *
 * **It refuses a `src` that could leave the folder**, and that is defence in depth rather than a
 * live worry: `photoSrcFor` builds `foto-<section>-<element>.jpg` from ids the schema controls, and
 * a bank photograph never comes here at all. The check exists because this function turns a string
 * into a path, and the one before it in this repository that did — `readSampleBytes` — earned its
 * own guard for the same reason.
 */
export function photoObjectPath(ownerId: string, siteId: string, src: string): string {
  for (const part of [ownerId, siteId, src]) {
    if (part === "" || part.includes("/") || part.includes("\\") || part.includes("..")) {
      throw new Error(`photoObjectPath: refusing "${part}" as a path segment`);
    }
  }
  return `${ownerId}/${siteId}/${src}`;
}

/**
 * Stores one photograph, replacing whatever was in that slot.
 *
 * `upsert` because the key is stable per slot: an owner who changes the cover photograph is
 * replacing an object, not adding one, and the bucket's `update` policy exists for this.
 *
 * **`cacheControl` is zero on purpose.** The key does not change when the picture does, so a cached
 * copy would show somebody their old photograph after they replaced it — the interface lying about
 * their own work, which this project does not trade for bandwidth. ADR 0037 §7 says the egress cost
 * of that is measured and written down rather than assumed away.
 *
 * `false` rather than a throw when the store refuses, the same contract `savePhoto` has for
 * IndexedDB: the caller turns it into `No guardado`, and a photograph that was not written never
 * shows a tick.
 */
export async function uploadPhoto(
  client: Client,
  path: string,
  bytes: Uint8Array,
): Promise<boolean> {
  // A fresh, concrete ArrayBuffer: a Uint8Array is typed over the generic ArrayBufferLike, which
  // BlobPart does not accept. `photoBlob` and the download route each take the same step and each
  // say so where they take it.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const { error } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(path, new Blob([buffer], { type: PHOTO_CONTENT_TYPE }), {
      contentType: PHOTO_CONTENT_TYPE,
      upsert: true,
      cacheControl: "0",
    });
  return !error;
}

/**
 * Reads one photograph back, or `null`.
 *
 * **The bytes are sniffed before anyone makes an image of them.** Nothing of ours uploads anything
 * but a re-encoded JPEG, and the bucket's `allowed_mime_types` says so too — but the bucket trusts
 * the content type the uploader declares, and this is the side that does not have to. The same
 * reasoning `/api/download` gives for re-sniffing bytes the browser already checked: one side is
 * the convenience, the other is the guarantee.
 */
export async function downloadPhoto(client: Client, path: string): Promise<Uint8Array | null> {
  const { data, error } = await client.storage.from(PHOTO_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return isAcceptedImage(sniffImage(bytes)) ? bytes : null;
}

/**
 * Every object stored for one site, as full paths.
 *
 * The prefix is what makes this one call rather than a guess per `src`: reconciliation has to know
 * what is up there that the document no longer names, which is not something the document can say.
 */
export async function listPhotoObjects(
  client: Client,
  ownerId: string,
  siteId: string,
): Promise<string[]> {
  const prefix = `${ownerId}/${siteId}`;
  const { data, error } = await client.storage.from(PHOTO_BUCKET).list(prefix);
  if (error || !data) return [];
  // `list` answers with names relative to the prefix, and every caller works in full paths.
  return data.filter((entry) => entry.name !== "").map((entry) => `${prefix}/${entry.name}`);
}

/** Removes objects by full path. `false` when the store refused, so a caller can say so. */
export async function removePhotos(client: Client, paths: readonly string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await client.storage.from(PHOTO_BUCKET).remove([...paths]);
  return !error;
}

export interface PhotoUploadReport {
  uploaded: string[];
  /** By `src`, which is what the download gate and the «Fotos» panel are already keyed by. */
  failed: string[];
}

/**
 * Stores every photograph a site references, and reports what did not make it.
 *
 * **`bytesFor` is the seam, and it is what makes this testable at all.** The bytes live in the
 * browser as object URLs in the editor's `photoUrls` map, so reading them means `fetch` and a
 * `Blob` — neither of which exists in the node project `apps/editor`'s unit tests run in. Handing
 * the lookup in as a function leaves this loop, which is the part with the reporting and the order
 * in it, under test; the caller's three lines of `fetch` are covered by the walk.
 *
 * **A `src` with no bytes is not a failure.** It is a photograph this browser does not hold —
 * a site opened on another computer before day 3 taught it to fetch them — and there is nothing to
 * upload. It is reported as neither uploaded nor failed, and the count of what is still missing is
 * day 4's indicator.
 *
 * Sequential rather than parallel. A site carries one photograph today and at most 45, the
 * failures have to be attributable, and nothing here is fast enough to be worth a race.
 */
export async function uploadSitePhotos(
  client: Client,
  site: { ownerId: string; siteId: string; srcs: readonly string[] },
  bytesFor: (src: string) => Promise<Uint8Array | undefined>,
): Promise<PhotoUploadReport> {
  const report: PhotoUploadReport = { uploaded: [], failed: [] };
  for (const src of site.srcs) {
    const bytes = await bytesFor(src);
    if (!bytes) continue;
    const ok = await uploadPhoto(client, photoObjectPath(site.ownerId, site.siteId, src), bytes);
    if (ok) report.uploaded.push(src);
    else report.failed.push(src);
  }
  return report;
}
