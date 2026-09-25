import { presetFor } from "@retorika/catalog";
import { buildSite, bundleToZip } from "@retorika/publisher";
import {
  checkAgainstPreset,
  DocumentValidationError,
  flattenElements,
  listEditableFields,
  parseDocument,
  type RetorikaDocument,
} from "@retorika/schema";

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

const MAX_BODY_BYTES = 256 * 1024;
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

export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response("request too large", { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("invalid JSON body", { status: 400 });
  }
  if (typeof payload !== "object" || payload === null) {
    return new Response("invalid request body", { status: 400 });
  }
  const { document: rawDocument } = payload as Record<string, unknown>;

  let document: RetorikaDocument;
  try {
    document = parseDocument(rawDocument);
    assertBounds(document);
    assertPresetsMatch(document);
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
  // not accept. `assets` is always empty: every image this app produces is a self-contained
  // data: URI (see packages/generator/src/placeholder-image.ts), which buildSite leaves inline
  // and needs no bundled file for.
  const zip = new Uint8Array(
    bundleToZip(buildSite(document, { siteId: document.id, assets: new Map() })),
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
