import {
  FONT_FAMILY_PATTERN,
  type OwnFont,
  type OwnFontFormat,
  type OwnLicenceFormat,
  ownFamilyIssue,
} from "@retorika/schema";

/**
 * What an uploaded font file is, decided by its own first bytes — and the numbers that bound it
 * (ADR 0056, sprint 29 día 5).
 *
 * The sibling of `imageBytes.ts`, and for the same reason: the extension and the `type` the browser
 * reports are whatever the person's file was called, and this one ends up inside a stranger's ZIP.
 * **Pure and free of Node**, so the same functions run in the dialog, in the inspection route and in
 * `/api/download` — the button is the convenience, the route is the guarantee, and both read the
 * same signatures. What needs `node:zlib` (the `name` and `fvar` tables inside a compressed file)
 * lives in `fontInspect.ts`, which only the server imports.
 */

/**
 * **Refused above this, per file** — David's condition 2 (27 October 2026). The inspection route
 * reads `Content-Length` against it before buffering a byte, `/api/download` checks every `font`
 * part against it, and the `fuentes` bucket (día 6) will carry the same number as its
 * `file_size_limit`: a font that can be stored and then not bundled would be a save that lied.
 */
export const MAX_FONT_BYTES = 2 * 1024 * 1024;

/**
 * **Warned above this, per file**, never refused: a 400 KB `.ttf` is a slower page, not a broken
 * one (the memory's «el texto de marcador avisa, el enlace muerto bloquea»). The warning suggests
 * a `.woff2`, which is usually half the weight.
 */
export const HEAVY_FONT_BYTES = 300 * 1024;

/** A licence text the owner attached: a page of OFL is 4 KB, a scanned PDF a few hundred. */
export const MAX_LICENCE_BYTES = 1024 * 1024;

/**
 * **The ceiling on what one compressed font may expand to** — David's adjustment 1. A WOFF2 keeps
 * every table in one brotli stream, and 2 MB of brotli can describe gigabytes; the header's own
 * `totalSfntSize` is the first bound and this is the one that holds when the header lies big.
 */
export const MAX_FONT_EXPANDED_BYTES = 8 * 1024 * 1024;

/** One or two files per font: a regular, a regular and a bold, or one variable file. */
export const MAX_FONT_FILES = 2;

/** What `<input accept>` is given. A filter on the picker, which is all `accept` is; the bytes below
 * are the check. */
export const ACCEPTED_FONT_ACCEPT = ".woff2,.woff,.ttf,.otf";

/**
 * What the first bytes say. The four formats a face may travel as, and three refusals that each
 * deserve their own sentence rather than «no es una fuente»: a collection (`.ttc`, several fonts in
 * one file, whichever the browser picks), and markup (an SVG font, or anything starting with `<`,
 * which can carry script).
 */
export type FontKind = OwnFontFormat | "collection" | "markup" | "unknown";

function startsWith(bytes: Uint8Array, signature: string, at = 0): boolean {
  if (bytes.length < at + signature.length) return false;
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[at + index] !== signature.charCodeAt(index)) return false;
  }
  return true;
}

const SFNT_TRUETYPE = [0x00, 0x01, 0x00, 0x00];

function startsWithBytes(bytes: Uint8Array, signature: readonly number[], at = 0): boolean {
  if (bytes.length < at + signature.length) return false;
  return signature.every((byte, index) => bytes[at + index] === byte);
}

/**
 * The format these bytes actually are, whatever the file was called.
 *
 * A WOFF or WOFF2 wraps an sfnt, and its `flavor` (four bytes after the signature) says which: a
 * `ttcf` flavor is a collection in a wrapper and is refused like a bare `.ttc`. The flavor of a
 * single font does not change the format it travels as — a WOFF2 of a CFF font is still `woff2`.
 */
export function sniffFont(bytes: Uint8Array): FontKind {
  if (startsWith(bytes, "wOF2")) return startsWith(bytes, "ttcf", 4) ? "collection" : "woff2";
  if (startsWith(bytes, "wOFF")) return startsWith(bytes, "ttcf", 4) ? "collection" : "woff";
  if (startsWith(bytes, "ttcf")) return "collection";
  if (startsWith(bytes, "OTTO")) return "otf";
  // `true` is Apple's TrueType tag, older than 0x00010000 and read by every browser the same way.
  if (startsWithBytes(bytes, SFNT_TRUETYPE) || startsWith(bytes, "true")) return "ttf";
  // Markup, after an optional UTF-8 byte-order mark and whitespace: an SVG font, an HTML page
  // saved as `.ttf`. Named so the refusal can say «no es una fuente» about the right thing.
  let at = startsWithBytes(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  while (at < bytes.length && at < 64 && [0x09, 0x0a, 0x0d, 0x20].includes(bytes[at] ?? 0)) {
    at += 1;
  }
  if (bytes[at] === 0x3c) return "markup";
  return "unknown";
}

export function isOwnFontFormat(kind: FontKind): kind is OwnFontFormat {
  return kind === "woff2" || kind === "woff" || kind === "ttf" || kind === "otf";
}

/** The media type a face of this format is stored and served with — from the sniff, never from
 * `File.type`, which is empty or `application/octet-stream` for a `.woff2` on some systems
 * (David's adjustment 7). The publisher's `OWN_FACE_TYPES` is the same table. */
export const FONT_MEDIA_TYPES: Readonly<Record<OwnFontFormat, string>> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

/**
 * What a licence file the owner attached is, by its bytes (David's adjustment 3): a PDF begins
 * `%PDF`; a text is valid UTF-8 with no NUL byte in it — which a binary renamed `.txt` almost
 * always has. `null` is neither. The extension the record declares is not consulted: the sniff
 * decides, and the caller compares.
 */
export function sniffLicence(bytes: Uint8Array): OwnLicenceFormat | null {
  if (startsWith(bytes, "%PDF")) return "pdf";
  if (bytes.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return "txt";
}

/** The schema's own limit on a family's length. */
const MAX_FAMILY_LENGTH = 64;

/**
 * A name from a file's `name` table, made into one this product can write into CSS — or `""` when
 * nothing of it survives, which the dialog answers with a default the owner can change.
 *
 * Accents become their letter («Señorío» → «Senorio»), every other character outside the pattern
 * becomes a space, runs of spaces become one, and a leading digit is dropped because a family must
 * begin with a letter. **The owner is always shown the result** — the name their site will use is
 * never a surprise in the ZIP.
 */
export function sanitiseFamily(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .replace(/^[0-9 ]+/, "")
    .split(" ")
    .filter((word) => word !== "");
  let family = "";
  for (const word of words) {
    const next = family === "" ? word : `${family} ${word}`;
    if (next.length > MAX_FAMILY_LENGTH) break;
    family = next;
  }
  return FONT_FAMILY_PATTERN.test(family) ? family : "";
}

/**
 * The name this font can travel under beside the fonts the document already has: the name itself
 * when it is free, and otherwise the first «Name 2», «Name 3»… that is — the collision ADR 0056
 * describes, resolved with a numeral and **shown** rather than refused. «Karla» uploaded from
 * Karla's own file becomes «Karla 2», which is exactly the corpus fixture.
 */
export function freeFamilyName(
  family: string,
  others: readonly Pick<OwnFont, "family">[] = [],
): string {
  if (ownFamilyIssue(family, others) === undefined) return family;
  for (let numeral = 2; numeral < 100; numeral += 1) {
    const suffix = ` ${numeral}`;
    const candidate = `${family.slice(0, MAX_FAMILY_LENGTH - suffix.length).trimEnd()}${suffix}`;
    if (ownFamilyIssue(candidate, others) === undefined) return candidate;
  }
  throw new Error(`freeFamilyName: no free name for "${family}"`);
}
