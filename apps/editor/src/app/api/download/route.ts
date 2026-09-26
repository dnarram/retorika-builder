import { presetFor } from "@retorika/catalog";
import { buildSite, bundleToZip } from "@retorika/publisher";
import {
  checkAgainstPreset,
  DocumentValidationError,
  flattenElements,
  listDeadDestinations,
  listEditableFields,
  parseDocument,
  type RetorikaDocument,
} from "@retorika/schema";
import { isAcceptedImage, sniffImage } from "../../../editor/imageBytes.ts";

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
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_PHOTOS = 10;
const MAX_PAGES = 5;
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
 * one. Filling a destination in by hand does not exist yet; when it does, this is the rule it
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

export async function POST(request: Request): Promise<Response> {
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
  try {
    document = parseDocument(rawDocument);
    assertBounds(document);
    assertPresetsMatch(document);
    assertNoDeadDestinations(document);
    assets = await readPhotos(form, document);
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
  const zip = new Uint8Array(bundleToZip(buildSite(document, { siteId: document.id, assets })));

  return new Response(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${document.id}.zip"`,
      "Content-Length": String(zip.byteLength),
    },
  });
}
