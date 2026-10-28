import type { OwnFont } from "@retorika/schema";
import type { Client } from "../auth/clients.ts";
import { FONT_MEDIA_TYPES, isOwnFontFormat, sniffFont, sniffLicence } from "../editor/fontBytes.ts";
import { fontFileType, ownFontFiles, type StoredFontFile } from "../editor/ownFonts.ts";
import { photoSyncPlan } from "./photoSync.ts";

/**
 * The owner's own fonts, in the account rather than in one browser (ADR 0056, sprint 29 día 6) —
 * the sibling of `photoStorage.ts`, over the `fuentes` bucket migration `0004` creates.
 *
 * Until today a font lived in the browser that imported it (`retorika.fonts`, `ownFonts.ts`), so a
 * saved site opened on another computer named faces nobody could send, and its download was
 * blocked with «Falta el archivo de tu fuente». This is the file that makes «la fuente viaja con la
 * cuenta» true.
 *
 * **Everything here takes the `Client` rather than building one**, as `photoStorage.ts` and
 * `sites.ts` do: the client carries the signed-in person's own session, and what it may do is
 * decided by the policies in `packages/db/migrations/0004-*.sql`, proven as SQL by
 * `packages/db/test/storage.pg.test.ts`. What is proven here, in `fontStorage.test.ts`, is the half
 * that is ours: the path, the content type, the sniff on the way back, and what a failure reports.
 *
 * **Two things differ from the photographs, and both are on purpose.** The content type is read
 * from the bytes rather than fixed, because four face formats and two licence formats share one
 * bucket (David's adjustment 7). And the sync is a function here rather than a loop in `Variants`,
 * because a font is several files that only mean something together, and the count the indicator
 * shows is of fonts rather than of files — arithmetic worth a test of its own.
 */

/** The bucket migration `0004` creates. Private: a published site never reads from it (ADR 0001). */
export const FONT_BUCKET = "fuentes";

/**
 * Where one file of a font lives: `<owner>/<site>/<file>`.
 *
 * The first segment is the whole of ownership, as for a photograph; the second makes a site's
 * fonts a listable prefix, which the reconciliation and the account purge each need; the third is
 * the name the renderer mints — `propia-<id>-<role>.<format>` or `LICENCIA-propia-<id>.<txt|pdf>`.
 *
 * **Per site, although a font's name is already unique in the whole browser** (its id is random,
 * `ownFonts.ts`): the folder is the site so that a site's files are exactly its prefix, which is
 * what lets one site's reconciliation delete what its document stopped naming without reasoning
 * about any other site's. The same font in two sites is two copies, which is what ADR 0037 already
 * chose for a photograph reused in two webs.
 *
 * It refuses the three things `photoObjectPath` refuses, and one more: a file name this product
 * does not mint. `fontFileType` is the authority for that and throws.
 */
export function fontObjectPath(ownerId: string, siteId: string, file: string): string {
  for (const part of [ownerId, siteId, file]) {
    if (part === "" || part.includes("/") || part.includes("\\") || part.includes("..")) {
      throw new Error(`fontObjectPath: refusing "${part}" as a path segment`);
    }
  }
  fontFileType(file);
  return `${ownerId}/${siteId}/${file}`;
}

/**
 * The content type these bytes are stored under, **read from the bytes** — or `null` when the bytes
 * are not what the minted name says.
 *
 * David's adjustment 7: a browser reports a `.woff2` as `application/octet-stream` or as nothing on
 * some systems, and the bucket's `allowed_mime_types` would refuse it. So `File.type` is never
 * read. The sniff decides the type, and the name — which this product minted from the format the
 * import sniffed — must agree with it: a face whose bytes are a different format from its name
 * would be bundled under a `format()` that lies, and `/api/download` refuses exactly that, so the
 * store refuses it first.
 */
export function storedContentType(file: string, bytes: Uint8Array): string | null {
  const declared = fontFileType(file);
  const face = sniffFont(bytes);
  let sniffed: string | null = null;
  if (isOwnFontFormat(face)) sniffed = FONT_MEDIA_TYPES[face];
  else {
    const licence = sniffLicence(bytes);
    if (licence === "pdf") sniffed = "application/pdf";
    else if (licence === "txt") sniffed = "text/plain";
  }
  return sniffed === declared ? sniffed : null;
}

/** The last segment of an object path, which is the minted file name. */
function fileOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Stores one file of a font, typed by its bytes.
 *
 * It takes a `Blob` — what the editor holds behind an object URL, or a `File` — and reads its bytes
 * rather than its `type`, which is the point. `false` when the bytes are not what the name says
 * (nothing is sent) or when the store refuses, the contract `uploadPhoto` has.
 *
 * `upsert` because a file whose upload half-landed is sent again under the same name by the next
 * reconciliation. **No `cacheControl: "0"`, unlike a photograph**: a photograph's key is stable per
 * slot while its picture changes, but a font file's name carries a random id minted at import, so
 * the bytes under a name never change and a cached copy is never a stale one.
 */
export async function uploadFontFile(client: Client, path: string, blob: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const contentType = storedContentType(fileOf(path), bytes);
  if (contentType === null) return false;
  // A fresh, concrete ArrayBuffer, for the reason `uploadPhoto` gives.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const { error } = await client.storage
    .from(FONT_BUCKET)
    .upload(path, new Blob([buffer], { type: contentType }), { contentType, upsert: true });
  return !error;
}

/**
 * Reads one file back, or `null`. **Re-sniffed before anything makes a face of it**: the bucket
 * trusts the content type the uploader declared, and this is the side that does not have to.
 */
export async function downloadFontFile(client: Client, path: string): Promise<Uint8Array | null> {
  const { data, error } = await client.storage.from(FONT_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return storedContentType(fileOf(path), bytes) === null ? null : bytes;
}

/** Every font file stored for one site, as full paths. Empty when the store refuses. */
export async function listFontObjects(
  client: Client,
  ownerId: string,
  siteId: string,
): Promise<string[]> {
  const prefix = `${ownerId}/${siteId}`;
  const { data, error } = await client.storage.from(FONT_BUCKET).list(prefix);
  if (error || !Array.isArray(data)) return [];
  return data.filter((entry) => entry.name !== "").map((entry) => `${prefix}/${entry.name}`);
}

/** Removes font files by full path. `false` when the store refused. */
export async function removeFontObjects(
  client: Client,
  paths: readonly string[],
): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await client.storage.from(FONT_BUCKET).remove([...paths]);
  return !error;
}

/** Every file a document's own fonts name: each face, and the licence where one was attached. */
export function siteFontFiles(fonts: readonly OwnFont[]): string[] {
  return fonts.flatMap((font) => {
    const { faces, licence } = ownFontFiles(font);
    return licence === undefined ? faces : [...faces, licence];
  });
}

/**
 * Brings the account's copy of a site's fonts in line with its document, and says which fonts are
 * still not there.
 *
 * **Only ever called after a save the database accepted** — the rule ADR 0037 §5 wrote for the
 * photographs, for the same reason: a tab holding a document that lost the race names fonts the
 * winning one may have taken out, and letting it tidy up would delete the winner's. The caller is
 * `afterAcceptedSave`'s `reconcile`, or the first save's `onSaved`, which is an insert and so
 * accepted by definition.
 *
 * The arithmetic is `photoSyncPlan`, which was written over file names and is reused as it is.
 *
 * **What it answers is fonts, not files**, by family: a font is short if any one of its files is —
 * a regular without its bold still draws the headings wrong — and «2 fuentes sin subir» for the
 * regular and the bold of one font would count a thing the owner never made. A file is short when
 * the store refused it, or when neither the bucket nor this browser has it (a font imported in a
 * browser whose upload never landed). A file that is in the bucket and not here is not short: the
 * opening fetched it, or will.
 *
 * `blobFor` is the seam, as `bytesFor` is for `uploadSitePhotos`: the bytes live behind object
 * URLs, which the node project these tests run in cannot fetch.
 */
export async function reconcileSiteFonts(
  client: Client,
  site: { ownerId: string; siteId: string },
  fonts: readonly OwnFont[],
  held: readonly string[],
  blobFor: (file: string) => Promise<Blob | undefined>,
): Promise<{ short: string[] }> {
  const prefix = `${site.ownerId}/${site.siteId}/`;
  const plan = photoSyncPlan({
    wanted: siteFontFiles(fonts),
    remote: (await listFontObjects(client, site.ownerId, site.siteId)).map((path) =>
      path.slice(prefix.length),
    ),
    local: held,
    pathFor: (file) => fontObjectPath(site.ownerId, site.siteId, file),
  });

  const failed: string[] = [];
  for (const file of plan.upload) {
    let blob: Blob | undefined;
    try {
      blob = await blobFor(file);
    } catch {
      // A revoked object URL. Nothing was stored.
      blob = undefined;
    }
    const path = fontObjectPath(site.ownerId, site.siteId, file);
    if (!blob || !(await uploadFontFile(client, path, blob))) failed.push(file);
  }

  // Last, and a failure is not counted: a file no document names costs storage and tells the owner
  // nothing. The next reconciliation tries again.
  if (plan.remove.length > 0) await removeFontObjects(client, plan.remove);

  const missing = new Set([...plan.missing, ...failed]);
  return {
    short: fonts
      .filter((font) => siteFontFiles([font]).some((file) => missing.has(file)))
      .map((font) => font.family),
  };
}

/**
 * The files of a site's fonts that this browser does not hold, fetched out of the owner's folder —
 * what a site opened on another computer needs before its preview draws the letter and its
 * download is allowed.
 *
 * `fetched` is what arrived and passed the sniff; `failed` is what did not — not in the bucket (a
 * site saved before fonts travelled, or from a browser whose upload never landed), refused, or not
 * what its name says. The caller stores the first in IndexedDB beside the ones imported here, and
 * leaves the second to the download gate's `fontsMissing`, which already says what to do.
 */
export async function fetchSiteFonts(
  client: Client,
  site: { ownerId: string; siteId: string },
  files: readonly string[],
): Promise<{ fetched: StoredFontFile[]; failed: string[] }> {
  const fetched: StoredFontFile[] = [];
  const failed: string[] = [];
  for (const file of files) {
    let bytes: Uint8Array | null = null;
    try {
      bytes = await downloadFontFile(client, fontObjectPath(site.ownerId, site.siteId, file));
    } catch {
      bytes = null;
    }
    if (bytes) fetched.push({ file, bytes });
    else failed.push(file);
  }
  return { fetched, failed };
}
