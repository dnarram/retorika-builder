import { presetFor } from "@retorika/catalog";
import { buildSite, bundleToZip, ownFontKeysFor, readFontBundle } from "@retorika/publisher";
import { ownFacesFor, ownFontsFor } from "@retorika/renderer";
import {
  checkAgainstPreset,
  DocumentValidationError,
  flattenElements,
  listDeadDestinations,
  listEditableFields,
  MAX_PAGES,
  type OwnLicenceFormat,
  parseDocument,
  type RetorikaDocument,
} from "@retorika/schema";
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from "../../../editor/downloadGate.ts";
import {
  MAX_FONT_BYTES,
  MAX_LICENCE_BYTES,
  sniffFont,
  sniffLicence,
} from "../../../editor/fontBytes.ts";
import { isAcceptedImage, sniffImage } from "../../../editor/imageBytes.ts";
import { limited } from "../publicGuard.ts";

/**
 * The ZIP, built in memory and sent straight in the response — Render's disk is ephemeral, so
 * nothing here is ever written to it (day 5 of the sprint plan).
 *
 * The request carries the document itself now (day 3), not the five answers plus a diff of text
 * edits: `apps/editor` holds the document as its own state since day 2, and a section that can be
 * added, deleted, duplicated or reordered (this sprint's remaining days) is no longer something
 * `generate(answers)` can reproduce — the whole point of those verbs is that the document stops
 * being a pure function of the five answers. Sending the document is also simply what the app
 * already has, with no reconstruction needed on either end.
 *
 * That makes this the one place a client fully controls the bytes that become a published site,
 * so it is revalidated exactly as strictly as any other document that reaches `parseDocument` in
 * this codebase — the schema (structure, roles, invariants), each catalog section against its own
 * preset, and a handful of size bounds a legitimate document never approaches, all before
 * `buildSite` ever sees it.
 */
export const runtime = "nodejs";

// Room for the document and a handful of photos. The document itself is kilobytes; almost all
// of this is the photos, which the browser has already resized and re-encoded (ADR 0018) — a
// 1600px JPEG lands in the low hundreds of kilobytes, so the caps below are headroom rather
// than a target.
//
// **Plus the owner's own fonts, at their worst case, since sprint 29 día 5** — and unlike the
// photographs that worst case is exact, because the font caps are hard: two fonts named by the two
// stacks, two faces each, 2 MiB a face (`MAX_FONT_BYTES`), and a licence of 1 MiB beside each
// (`MAX_LICENCE_BYTES`): 4 × 2 + 2 × 1 = 10 MiB. The plan said 4; below 10, a document the editor
// lets an owner build would meet a bare 413 here, which is the failure `MAX_PHOTOS` moved to
// `downloadGate.ts` to end. The limit per address in `publicGuard.ts` bounds how often.
const MAX_BODY_BYTES = (12 + 10) * 1024 * 1024;
/** Faces a request may carry: two fonts of two faces. A licence is one per font. */
const MAX_FONT_PARTS = 4;
const MAX_LICENCE_PARTS = 2;
// MAX_PHOTO_BYTES moved to `downloadGate.ts` with ADR 0037, for the same reason MAX_PHOTOS is
// there: the storage bucket now has a `file_size_limit` too, and a photograph that can be stored
// and then not bundled is a save that lied.
// MAX_PHOTOS lives in `../../../editor/downloadGate.ts`, shared with the editor's own pre-flight
// check (sprint 6 day 5) so both sides of the request agree about the same number for the same
// reason — a client that thinks it can send 45 and a server that only accepts 10 is exactly the
// bare-413 failure this sprint's plan named and asked to stop happening.
// `MAX_PAGES` comes from `@retorika/schema` since sprint 5 day 4: `sectionToPage` refuses to build
// a sixth page, and the two numbers must be one number — a page that can be created and then not
// downloaded is exactly the failure this bound was meant to be the last line of defence against.
const MAX_SECTIONS = 40;
const MAX_ELEMENTS = 400;
const MAX_FIELD_LENGTH = 4000;

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Bounds no real document from this app's own generator or editor ever approaches — a five
 * question flow with four catalog sections is nowhere close. They exist only for a request that
 * did not come from this app: `parseDocument` and `checkAgainstPreset` already reject a
 * malformed or structurally invalid document, but neither has an opinion on a *valid* document
 * built absurdly large on purpose.
 */
function assertBounds(doc: RetorikaDocument): void {
  if (doc.pages.length > MAX_PAGES) {
    throw new RequestError(`too many pages (${doc.pages.length})`, 413);
  }
  let sectionCount = 0;
  let elementCount = 0;
  for (const page of doc.pages) {
    sectionCount += page.sections.length;
    for (const section of page.sections) elementCount += flattenElements(section.content).length;
  }
  if (sectionCount > MAX_SECTIONS)
    throw new RequestError(`too many sections (${sectionCount})`, 413);
  if (elementCount > MAX_ELEMENTS)
    throw new RequestError(`too many elements (${elementCount})`, 413);

  for (const field of listEditableFields(doc)) {
    if (field.text !== undefined && field.text.length > MAX_FIELD_LENGTH) {
      throw new RequestError(
        `field "${field.elementId}" exceeds ${MAX_FIELD_LENGTH} characters`,
        413,
      );
    }
  }
}

/**
 * `parseDocument` only checks the seven document rules — it has no idea a `services` section
 * needs at least one card, because that is the catalog's opinion, not the schema's. A client
 * could send a structurally valid document that no catalog preset would ever produce (an empty
 * required slot, a section id `presetFor` does not recognise), so every catalog-sourced section
 * is checked against its own preset the same way `checkAgainstPreset` already guards the
 * generator's own output. A free section answers to no preset and is skipped.
 */
function assertPresetsMatch(doc: RetorikaDocument): void {
  for (const page of doc.pages) {
    for (const section of page.sections) {
      if (section.source !== "catalog") continue;
      let preset: ReturnType<typeof presetFor>;
      try {
        preset = presetFor(section.preset.catalogId);
      } catch {
        throw new RequestError(`section "${section.id}": unknown catalog section`, 400);
      }
      const violations = checkAgainstPreset(section, preset);
      if (violations.length > 0) {
        throw new RequestError(
          `section "${section.id}" fails its preset: ${violations.map((v) => v.message).join("; ")}`,
          400,
        );
      }
    }
  }
}

/**
 * A button that points nowhere never travels inside a ZIP.
 *
 * The published site is a file with no server behind it, so a dead `href` does not fail softly:
 * the visitor presses "Reserva tu cita" and the page reloads itself. Refused here rather than
 * only in the button that starts the download, because this route is the guarantee and the
 * button is the convenience — this is a public, unauthenticated endpoint, and the filter is the
 * validation, not the trust.
 *
 * Nothing this app produces can reach here: a section added from the editor is either built
 * blank by the catalog, which refuses to invent a destination and so never carries a link slot
 * it cannot fill, or built from the questionnaire's own answer to question 5, which has a real
 * one. **Filling a destination in by hand does exist** — `FieldsPanel` draws the box labelled «A
 * dónde lleva» and routes it through `fillSlot`, since sprint 3 day 4 — and this sentence said it did
 * not until the sprint-14 planning sweep read the two against each other. The rule below is what it
 * has to satisfy.
 */
function assertNoDeadDestinations(doc: RetorikaDocument): void {
  const dead = listDeadDestinations(doc);
  const first = dead[0];
  if (!first) return;
  throw new RequestError(
    `section "${first.sectionId}": "${first.text}" (slot "${first.slot}") points nowhere` +
      (dead.length > 1 ? `, and ${dead.length - 1} more link(s) like it` : ""),
    400,
  );
}

/** Every image src the document actually references, data: URIs excluded — those are inline and
 * need no file. This is the set a request is allowed to send bytes for, and must send them all. */
function referencedPhotoSrcs(doc: RetorikaDocument): Set<string> {
  const srcs = new Set<string>();
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        const value = element.value;
        if (value?.kind !== "image") continue;
        if (value.src.startsWith("data:")) continue;
        srcs.add(value.src);
      }
    }
  }
  return srcs;
}

/**
 * The uploaded photos, checked as strictly as the document is.
 *
 * The browser already refused anything that is not a JPEG, a PNG or a WebP by its own first
 * bytes (ADR 0018), and the bytes are re-read here for the same reason the dead-destination rule
 * lives here: this is a public, unauthenticated endpoint, and the filter is the validation, not
 * the trust. `file.type` and the filename are whatever the caller chose; only the bytes are
 * evidence.
 *
 * A photo the document does not reference is refused rather than dropped. Dropping it would be a
 * malformed request answered with a ZIP, and the difference between "you sent something odd" and
 * "your site is missing an image" is worth keeping.
 */
async function readPhotos(form: FormData, doc: RetorikaDocument): Promise<Map<string, Uint8Array>> {
  const wanted = referencedPhotoSrcs(doc);
  const uploads = form.getAll("photo").filter((entry): entry is File => entry instanceof File);
  if (uploads.length > MAX_PHOTOS) {
    throw new RequestError(`too many photos (${uploads.length})`, 413);
  }

  const assets = new Map<string, Uint8Array>();
  for (const upload of uploads) {
    const src = upload.name;
    if (!wanted.has(src)) {
      throw new RequestError(`photo "${src}" is not referenced by the document`, 400);
    }
    if (upload.size > MAX_PHOTO_BYTES) {
      throw new RequestError(`photo "${src}" exceeds ${MAX_PHOTO_BYTES} bytes`, 413);
    }
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!isAcceptedImage(kind)) {
      throw new RequestError(`photo "${src}" is not a JPEG, a PNG or a WebP`, 400);
    }
    assets.set(src, bytes);
  }

  for (const src of wanted) {
    if (!assets.has(src)) {
      throw new RequestError(`the document references "${src}", which was not sent`, 400);
    }
  }
  return assets;
}

/**
 * The owner's own font files, checked as strictly as the photographs are (ADR 0056, sprint 29
 * día 5) — and through **one** reader for the faces and the licences, which is David's adjustment
 * 3: a licence file is bytes from outside too.
 *
 * - A `font` part's name must be exactly one face file the document's stylesheet names
 *   (`ownFontKeysFor`), and a `fontLicence` part's exactly one licence it names, under `fonts/`.
 *   Anything else is refused rather than dropped, for the reason `readPhotos` gives.
 * - Each face is at most `MAX_FONT_BYTES` and **re-sniffed**: its bytes must be the format the
 *   record declares. A WOFF2 declared `ttf` is refused, never relabelled — the record is what the
 *   renderer wrote `format()` from, so a mismatch is a page that asks the browser for the wrong
 *   thing. A collection and markup are refused by the same sniff.
 * - Each licence is at most `MAX_LICENCE_BYTES`; a PDF begins `%PDF`, a text is UTF-8 with no NUL,
 *   and the sniff must agree with the extension the record declares.
 * - Every key the document names must have arrived, or the bundle would be missing a file.
 *
 * The publisher checks the owner's declaration itself (`buildSite`); this is the bytes' half.
 */
async function readFonts(form: FormData, doc: RetorikaDocument): Promise<Map<string, Uint8Array>> {
  const wanted = new Set(ownFontKeysFor(doc));
  const formatOf = new Map(ownFacesFor(doc).map((face) => [face.file, face.face.format]));
  const licenceOf = new Map<string, OwnLicenceFormat>(
    ownFontsFor(doc).flatMap((font) =>
      font.licenceFile === undefined
        ? []
        : [[`fonts/LICENCIA-propia-${font.id}.${font.licenceFile}`, font.licenceFile] as const],
    ),
  );
  const faces = form.getAll("font").filter((entry): entry is File => entry instanceof File);
  const licences = form
    .getAll("fontLicence")
    .filter((entry): entry is File => entry instanceof File);
  if (faces.length > MAX_FONT_PARTS || licences.length > MAX_LICENCE_PARTS) {
    throw new RequestError("too many font files", 413);
  }

  const bytes = new Map<string, Uint8Array>();
  for (const [upload, kind] of [
    ...faces.map((file) => [file, "face"] as const),
    ...licences.map((file) => [file, "licence"] as const),
  ]) {
    const key = kind === "face" ? upload.name : `fonts/${upload.name}`;
    if (!wanted.has(key) || (kind === "face") !== formatOf.has(key)) {
      throw new RequestError(`font file "${upload.name}" is not named by the document`, 400);
    }
    if (bytes.has(key)) throw new RequestError(`font file "${upload.name}" was sent twice`, 400);
    const cap = kind === "face" ? MAX_FONT_BYTES : MAX_LICENCE_BYTES;
    if (upload.size > cap) {
      throw new RequestError(`font file "${upload.name}" exceeds ${cap} bytes`, 413);
    }
    const data = new Uint8Array(await upload.arrayBuffer());
    if (kind === "face") {
      const sniffed = sniffFont(data);
      if (sniffed !== formatOf.get(key)) {
        throw new RequestError(
          `font file "${upload.name}" is ${sniffed}, not the ${formatOf.get(key)} the document declares`,
          400,
        );
      }
    } else if (sniffLicence(data) !== licenceOf.get(key)) {
      throw new RequestError(
        `licence "${upload.name}" is not the ${licenceOf.get(key)} declared`,
        400,
      );
    }
    bytes.set(key, data);
  }

  for (const key of wanted) {
    if (!bytes.has(key)) {
      throw new RequestError(`the document names the font file "${key}", which was not sent`, 400);
    }
  }
  return bytes;
}

export async function POST(request: Request): Promise<Response> {
  // Twenty requests a minute per address, shared with `/api/fuentes/inspeccionar` (sprint 29 día 5,
  // ADR 0056 §10): the two public routes that take a stranger's bytes and work on them. Before the
  // length check, so a caller past the limit costs nothing more than a map lookup.
  const tooMany = limited(request);
  if (tooMany !== null) return tooMany;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response("request too large", { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("invalid multipart body", { status: 400 });
  }

  const rawDocumentText = form.get("document");
  if (typeof rawDocumentText !== "string") {
    return new Response("invalid request body: no document", { status: 400 });
  }
  let rawDocument: unknown;
  try {
    rawDocument = JSON.parse(rawDocumentText);
  } catch {
    return new Response("invalid JSON document", { status: 400 });
  }

  let document: RetorikaDocument;
  let assets: Map<string, Uint8Array>;
  let ownFonts: Map<string, Uint8Array>;
  try {
    document = parseDocument(rawDocument);
    assertBounds(document);
    assertPresetsMatch(document);
    assertNoDeadDestinations(document);
    assets = await readPhotos(form, document);
    ownFonts = await readFonts(form, document);
  } catch (error) {
    if (error instanceof RequestError) {
      return new Response(error.message, { status: error.status });
    }
    if (error instanceof DocumentValidationError) {
      return new Response(error.message, { status: 400 });
    }
    throw error;
  }

  // Copied into a fresh, concrete ArrayBuffer: bundleToZip's Uint8Array is backed by whatever
  // Buffer.concat handed it, typed as the generic ArrayBufferLike that Response's BodyInit does
  // not accept. `assets` carries the owner's uploaded photos and nothing else — the placeholder
  // is a self-contained data: URI (packages/catalog/src/placeholder-image.ts) which buildSite
  // leaves inline and needs no bundled file for.
  // The faces this site's stylesheet will name, with their licence texts, read before the bundle is
  // built: `buildSite` is synchronous and pure on purpose, so fetching bytes is the caller's job here
  // exactly as it is for photos. It takes the document rather than a list, so there is no way to hand
  // over a set of faces that disagrees with the ones the page asks for.
  //
  // Empty for every site on `editorial-serif`, which is most of them — one Map allocation, no read.
  // The owner's own faces and licences join the table's in the same map, under the keys
  // `ownFontKeysFor` named — the two sets cannot collide, since one is `propia-…` and `LICENCIA-…`
  // and the other is `@fontsource`'s names and `OFL-…`.
  const fonts = new Map([...readFontBundle(document), ...ownFonts]);

  // `siteUrl` is the owner's declared public address, and since 13 October 2026 (ADR 0029,
  // amended) it is what the ZIP's `sitemap.xml` is built on — as well as `og:url`. It is already
  // an `https://` origin and nothing else: `siteUrlIssue` guards the schema, which is stricter
  // than the publisher's own `assertOrigin`. No address typed, no sitemap, exactly as before.
  const zip = new Uint8Array(
    bundleToZip(
      buildSite(document, {
        siteId: document.id,
        assets,
        fonts,
        ...(document.siteUrl === undefined ? {} : { baseUrl: document.siteUrl }),
      }),
    ),
  );

  return new Response(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${document.id}.zip"`,
      "Content-Length": String(zip.byteLength),
    },
  });
}
