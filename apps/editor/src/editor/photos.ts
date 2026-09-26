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

/** The file name this photo takes inside the ZIP, which is also the `src` the document carries.
 * Derived from the section so two sections cannot collide, and stable so re-uploading replaces
 * rather than accumulates. */
export function photoSrcFor(sectionId: string): string {
  return `foto-${sectionId}.${extensionFor(OUTPUT_TYPE)}`;
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

/** Keyed by the variant as well as the src: the three cards are three documents, and all three
 * carry a section called `sec-cover`. Without the variant they would overwrite each other. */
function keyFor(variant: number, src: string): string {
  return `${variant}:${src}`;
}

export interface StoredPhoto {
  variant: number;
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
export async function savePhoto(variant: number, src: string, bytes: Uint8Array): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put({ variant, src, bytes }, keyFor(variant, src));
    await finish(transaction);
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Everything stored, for putting a reloaded session back together. An unreadable store yields
 * an empty list: the documents still load, and their covers show the placeholder again. */
export async function loadPhotos(): Promise<StoredPhoto[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    await finish(transaction);
    db.close();
    return (request.result as StoredPhoto[]) ?? [];
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
