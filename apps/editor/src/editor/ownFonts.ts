import { ownFaceFile } from "@retorika/renderer";
import type { OwnFont, OwnFontFace } from "@retorika/schema";
import { FONT_MEDIA_TYPES } from "./fontBytes.ts";

/**
 * The bytes of the fonts an owner brought, kept in the browser between reloads (ADR 0056, sprint
 * 29 día 5) — the sibling of `photos.ts`, and in its own database, `retorika.fonts`.
 *
 * **Keyed by file name alone, with no scope**, and that is the one place this differs from the
 * photographs. A photograph is named from its section and element, so every site's cover is
 * `foto-sec-cover-el-image.jpg` and two sites in one browser collide without a scope. A face is
 * named from its record's id — eight hex digits from `crypto.getRandomValues` — and its role, so
 * `propia-3f9a7c21-regular.woff2` is one font in the whole browser, whichever card or saved site it
 * belongs to.
 *
 * **Nothing here deletes a face when its font is taken out of a document.** «Quitar» is a step the
 * owner can undo, and an undo that brought the record back without its bytes would be a preview in
 * the fallback letter and a download refused. The bytes go with «Volver a empezar», as the
 * photographs' do; a few hundred kilobytes outliving a record is the cost of an undo that works.
 *
 * `openDatabase` and `finish` are written again rather than shared with `photos.ts`: two uses, and
 * CLAUDE.md waits for the third. The plan counted this as the third database; it is the second.
 */

const DB_NAME = "retorika.fonts";
const DB_VERSION = 1;
const STORE = "files";

/** A stored file as the editor holds it while a session is open: the object URL of its bytes and
 * how many there are, which the download gate weighs. */
export interface FontFileHandle {
  url: string;
  size: number;
}

export interface StoredFontFile {
  /** `propia-<id>-<role>.<format>` for a face, `LICENCIA-propia-<id>.<txt|pdf>` for a licence. */
  file: string;
  bytes: Uint8Array;
}

/**
 * The files of one font, as this module stores them and as `/api/download` receives them: its faces
 * by the name the renderer mints (`ownFaceFile`, the one authority for it), and the licence the
 * owner attached by the name the publisher writes it under, without the `fonts/` directory —
 * `ownFonts.test.ts` holds the two spellings together.
 */
export function ownFontFiles(font: OwnFont): { faces: string[]; licence: string | undefined } {
  return {
    faces: font.faces.map((face) => ownFaceFile(font, face)),
    licence:
      font.licenceFile === undefined ? undefined : `LICENCIA-propia-${font.id}.${font.licenceFile}`,
  };
}

/** The face file for one face of a font about to be recorded — the same minting, from the parts. */
export function faceFileFor(id: string, face: Pick<OwnFontFace, "role" | "format">): string {
  return ownFaceFile({ id }, face);
}

const FACE_FILE = /^propia-[0-9a-f]{8}-(?:regular|bold|variable)\.(woff2|woff|ttf|otf)$/;
const LICENCE_FILE = /^LICENCIA-propia-[0-9a-f]{8}\.(txt|pdf)$/;

/** The media type a stored file is handed to the browser with, read from the name this product
 * minted — never from the owner's file — or a throw for a name it did not mint. */
export function fontFileType(file: string): string {
  const face = FACE_FILE.exec(file)?.[1];
  if (face !== undefined) return FONT_MEDIA_TYPES[face as keyof typeof FONT_MEDIA_TYPES];
  const licence = LICENCE_FILE.exec(file)?.[1];
  if (licence === "txt") return "text/plain";
  if (licence === "pdf") return "application/pdf";
  throw new Error(`ownFonts: "${file}" is not a name this product mints`);
}

/** A `Blob` of these bytes, typed by the file's name. Copied into a concrete `ArrayBuffer` for the
 * reason `photoBlob` gives. */
export function fontFileBlob(file: string, bytes: Uint8Array): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: fontFileType(file) });
}

/** Eight lower-case hex digits that no font of this document already has. */
export function mintFontId(taken: readonly Pick<OwnFont, "id">[]): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const id = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    if (!taken.some((font) => font.id === id)) return id;
  }
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
 * Every file of one font in one transaction, or none: a face stored without its sibling is a font
 * half there. `false` rather than a throw when the store will not take them — the caller turns that
 * into `No guardado`, exactly as `savePhoto`'s callers do.
 */
export async function saveFontFiles(files: readonly StoredFontFile[]): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    for (const file of files) store.put(file, file.file);
    await finish(transaction);
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Everything stored. An unreadable store yields nothing: the document still names its fonts, and
 * the preview draws them in their fallback until the bytes come back from somewhere. */
export async function loadFontFiles(): Promise<StoredFontFile[]> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    await finish(transaction);
    db.close();
    const rows = (request.result as Partial<StoredFontFile>[]) ?? [];
    return rows.flatMap((row) =>
      typeof row.file === "string" && row.bytes instanceof Uint8Array
        ? [{ file: row.file, bytes: row.bytes }]
        : [],
    );
  } catch {
    return [];
  }
}

/** «Volver a empezar» means gone, here as in `localStorage` and the photographs' store. */
export async function clearFontFiles(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    await finish(transaction);
    db.close();
  } catch {
    // Nothing to do and nothing worth saying, as for the photographs.
  }
}
