/**
 * What an uploaded photo is, decided by its own first bytes.
 *
 * Never by the file extension and never by the `type` the browser reports: both are chosen by
 * whoever picked the file, and this one ends up inside a stranger's ZIP, opened by
 * double-clicking, with the page's own origin. ADR 0018.
 *
 * **SVG is absent on purpose, not by oversight.** An SVG is a document — it can carry `<script>`
 * — and `safeUrl` does not help, because the browser never parses a bundled file through it. The
 * placeholder is an SVG because this repository wrote it; an upload is a different thing.
 *
 * Used twice, deliberately: in the browser, so the person is told before anything is stored, and
 * again in `/api/download`, which is the guarantee. Same rule as a dead destination — the button
 * is the convenience, the route is the filter.
 */

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** What `<input accept>` is given. Not a check — a filter on the picker, which is the only thing
 * `accept` is. The bytes below are the check. */
export const ACCEPTED_IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

function startsWith(bytes: Uint8Array, signature: readonly number[], at = 0): boolean {
  if (bytes.length < at + signature.length) return false;
  return signature.every((byte, index) => bytes[at + index] === byte);
}

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];

/** HEIC and HEIF, which is what an iPhone writes unless its owner changed a setting. Recognised
 * only so the refusal can say something useful instead of "formato no admitido". */
const FTYP = [0x66, 0x74, 0x79, 0x70];
const HEIC_BRANDS = ["heic", "heix", "hevc", "heim", "heis", "hevm", "mif1", "msf1"];

export type ImageKind = AcceptedImageType | "image/heic" | "unknown";

/** The format these bytes actually are, whatever the file was called. */
export function sniffImage(bytes: Uint8Array): ImageKind {
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, PNG)) return "image/png";
  // A WebP is a RIFF container whose form type, four bytes after the size, reads "WEBP".
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  // ISO base media: a `ftyp` box at offset 4, then a four-character brand.
  if (startsWith(bytes, FTYP, 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (HEIC_BRANDS.includes(brand)) return "image/heic";
  }
  return "unknown";
}

export function isAcceptedImage(kind: ImageKind): kind is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(kind);
}

/** The extension the published file gets, from what the bytes say rather than what they were
 * called. `buildSite` reads the extension to choose a content type, so the two must agree. */
export function extensionFor(type: AcceptedImageType): string {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}
