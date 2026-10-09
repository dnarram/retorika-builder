import { type AcceptedImageType, extensionFor, isAcceptedImage, sniffImage } from "./imageBytes.ts";

/**
 * A photo the owner uploaded: recognised, resized, re-encoded, and kept where a few hundred
 * kilobytes of binary belong — which is not the JSON session `localStorage` rewrites on every
 * debounce. ADR 0018.
 *
 * Re-encoding is not only about size. A canvas draws pixels and nothing else, so what comes out
 * the other side has **no metadata at all** — no camera, no timestamp and, the one that matters,
 * no GPS coordinates. Nobody uploads a picture of their shop expecting to publish where they
 * were standing when they took it.
 */

/** Refused before decoding: a phone photo is 3-12 MB, so this only catches something that is not
 * a photo at all. The real bound on what travels is the re-encode below. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * The longest edge a published cover needs. A cover is drawn full width, so this is generous for
 * a laptop and enough for a phone at 2x; beyond it the file grows and nothing on screen improves.
 * The photo is a separate file, so none of it counts against Part 8.5's 60 KB page budget — what
 * it bounds is the size of the ZIP the owner has to upload somewhere.
 */
const MAX_EDGE = 1600;

/** JPEG, always, whatever went in. One output format means one extension and one content type,
 * and a photograph is what this slot holds — transparency on a full-bleed cover means nothing.
 * 0.82 is the usual knee: visually indistinguishable from 0.95 at a fraction of the bytes. */
const OUTPUT_TYPE: AcceptedImageType = "image/jpeg";
const OUTPUT_QUALITY = 0.82;

export type PhotoRejection =
  | { reason: "tooLarge" }
  | { reason: "heic" }
  | { reason: "unsupported" }
  | { reason: "undecodable" };

export interface PreparedPhoto {
  bytes: Uint8Array;
  type: AcceptedImageType;
  width: number;
  height: number;
}

export type PhotoResult = { ok: true; photo: PreparedPhoto } | { ok: false; error: PhotoRejection };

/**
 * A `Blob` of these bytes.
 *
 * Copied into a fresh, concrete `ArrayBuffer` rather than handed the view directly: a
 * `Uint8Array` is typed over the generic `ArrayBufferLike`, which `BlobPart` does not accept,
 * and a cast would only hide that. The download route does the same thing to the ZIP, for the
 * same reason, and says so there too.
 */
export function photoBlob(bytes: Uint8Array, type = "image/jpeg"): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type });
}

/**
 * The file name this photo takes inside the ZIP, which is also the `src` the document carries.
 *
 * Derived from the section **and the element**, and stable so that re-uploading over the same
 * image replaces it rather than accumulating a second file.
 *
 * The element id joined sprint 5 day 3, when "Fotos de trabajos" made a section able to hold more
 * than one photograph. Until then every section had at most one image slot, so the section alone
 * was unique and the name was shorter for it. In a gallery it was actively wrong: eight cards all
 * resolved to `foto-sec-gallery.jpg`, so each upload silently overwrote the last one's bytes and
 * the published page showed the same photograph eight times. Found in the browser — nothing failed,
 * which is what made it worth finding there.
 *
 * `(sectionId, elementId)` is unique across the whole document: section ids are minted unique by
 * `mintSectionId`, and document rule 5 scopes element-id uniqueness to the whole section, items
 * included. Older sessions are unaffected — a document carries its srcs as data and IndexedDB is
 * keyed by them, so a photo uploaded under the old name keeps resolving under the old name.
 */
export function photoSrcFor(sectionId: string, elementId: string): string {
  return `foto-${sectionId}-${elementId}.${extensionFor(OUTPUT_TYPE)}`;
}

function scaled(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };
  const ratio = MAX_EDGE / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * A file from the picker, turned into bytes that are safe to bundle.
 *
 * The sniff comes first and is the only thing trusted: `file.type` is whatever the browser felt
 * like reporting, and the extension is whatever the file was called.
 */
export async function preparePhoto(file: File): Promise<PhotoResult> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: { reason: "tooLarge" } };

  const original = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(original);
  if (kind === "image/heic") return { ok: false, error: { reason: "heic" } };
  if (!isAcceptedImage(kind)) return { ok: false, error: { reason: "unsupported" } };

  let bitmap: ImageBitmap;
  try {
    // `from-image` applies the EXIF rotation a phone writes rather than encoding it, which is why
    // a photo taken sideways comes out upright instead of on its side. Browsers that do not know
    // the option ignore it.
    bitmap = await createImageBitmap(new Blob([original], { type: kind }), {
      imageOrientation: "from-image",
    });
  } catch {
    // Recognised bytes that still will not decode: truncated, or a format the browser cannot read.
    return { ok: false, error: { reason: "undecodable" } };
  }

  const size = scaled(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { ok: false, error: { reason: "undecodable" } };
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY);
  });
  if (!blob) return { ok: false, error: { reason: "undecodable" } };

  return {
    ok: true,
    photo: {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      type: OUTPUT_TYPE,
      width: size.width,
      height: size.height,
    },
  };
}

// ---------------------------------------------------------------------------
// Where the bytes live between a reload
// ---------------------------------------------------------------------------

const DB_NAME = "retorika.photos";
const DB_VERSION = 1;
const STORE = "photos";

/**
 * Which set of photographs a stored one belongs to.
 *
 * **It was the variant number alone until 9 October 2026, and that was a collision waiting for a
 * second source of documents.** The three cards are three documents and all three carry a section
 * called `sec-cover`, so the variant was enough while every document came from this browser's own
 * session. Since ADR 0034 a document can also come from the account, and `photoSrcFor` builds its
 * name from the section and the element — which means the cover of *every* site is
 * `foto-sec-cover-el-image.jpg`. One key, two sites, and whichever was written last is what both
 * of them showed.
 *
 * So a site opened from the account is its own scope, keyed by the site's id. Nothing is dropped
 * to achieve that: the alternative considered was not storing an account site's photographs here
 * at all, which trades a collision for a photograph that disappears on reload, and a silent loss
 * of somebody's work is worse than the thing it fixes.
 */
export type PhotoScope =
  /** One of the three cards of this browser's session. */
  | { kind: "variant"; variant: number }
  /** One site opened from the account, whichever card it is shown in. */
  | { kind: "site"; siteId: string };

/** The scope as it is written into the store. `v0` and `site:<uuid>` cannot collide: a uuid is
 * never a digit, and the prefix is there so a reader of the raw store can tell which is which. */
export function scopeKey(scope: PhotoScope): string {
  return scope.kind === "variant" ? `v${scope.variant}` : `site:${scope.siteId}`;
}

function keyFor(scope: PhotoScope, src: string): string {
  return `${scopeKey(scope)}:${src}`;
}

export interface StoredPhoto {
  /** `scopeKey`'s output, not the scope itself: what is in the store is a string, and reading it
   * back as one keeps this record honest about what it is. */
  scope: string;
  src: string;
  bytes: Uint8Array;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB.open failed"));
  });
}

function finish(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("transaction failed"));
  });
}

/**
 * `false` rather than a throw when the store will not take it — no quota, a private window,
 * site data switched off. The caller turns that into `No guardado`, the same as a full
 * `localStorage` already does. A photo that was not written must never show a tick.
 */
export async function savePhoto(
  scope: PhotoScope,
  src: string,
  bytes: Uint8Array,
): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    const stored: StoredPhoto = { scope: scopeKey(scope), src, bytes };
    transaction.objectStore(STORE).put(stored, keyFor(scope, src));
    await finish(transaction);
    db.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Everything stored, for putting a reloaded session back together. An unreadable store yields an
 * empty list: the documents still load, and their covers show the placeholder again.
 *
 * **Records written before scopes existed are read, not discarded.** Until 9 October 2026 a record
 * was `{ variant, src, bytes }`; anybody who had used the editor has some, and dropping them would
 * mean a deploy quietly losing the photograph they uploaded yesterday. A record with a numeric
 * `variant` and no `scope` is exactly a variant-scoped one, so it is read as one. Nothing is
 * rewritten in place: the next save writes the new shape under the new key, and the old record is
 * simply never the one that matters again.
 */
export async function loadPhotos(): Promise<StoredPhoto[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    await finish(transaction);
    db.close();
    const rows = (request.result as (Partial<StoredPhoto> & { variant?: number })[]) ?? [];
    return rows.flatMap((row) => {
      if (!row.src || !row.bytes) return [];
      const scope =
        row.scope ??
        (typeof row.variant === "number"
          ? scopeKey({ kind: "variant", variant: row.variant })
          : undefined);
      return scope === undefined ? [] : [{ scope, src: row.src, bytes: row.bytes }];
    });
  } catch {
    return [];
  }
}

/** "Volver a empezar" means gone, here as well as in `localStorage`. */
export async function clearPhotos(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    await finish(transaction);
    db.close();
  } catch {
    // Nothing to do and nothing worth saying: the caller is on its way to a blank questionnaire.
  }
}
