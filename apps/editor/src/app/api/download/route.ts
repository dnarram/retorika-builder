import {
  type Answers,
  EMPTY_ANSWERS,
  generate,
  type MainAction,
  SECTOR_IDS,
  type SectorId,
  VARIANTS,
} from "@retorika/generator";
import { buildSite, bundleToZip } from "@retorika/publisher";
import { applyTextEdits } from "@retorika/schema";

/**
 * The ZIP, built in memory and sent straight in the response — Render's disk is ephemeral, so
 * nothing here is ever written to it (day 5 of the sprint plan). The request carries the five
 * answers, not a site id: there is no account and nothing saved server-side to look one up by,
 * and `generate()` is deterministic, so recomputing from the answers is exactly as correct as
 * looking up a stored copy would be. `edits` (day 6) layers the same click-to-edit changes the
 * live preview already shows on top of that regenerated document before it is packaged.
 */
export const runtime = "nodejs";

const MAX_EDITS = 64;
const MAX_EDIT_LENGTH = 2000;

const SECTOR_ID_SET: ReadonlySet<string> = new Set(SECTOR_IDS);
const MAIN_ACTION_SET: ReadonlySet<string> = new Set<MainAction>([
  "call",
  "book",
  "message",
  "email",
  "visit",
]);

function isSectorId(value: unknown): value is SectorId {
  return typeof value === "string" && (value === "otro" || SECTOR_ID_SET.has(value));
}

function isMainAction(value: unknown): value is MainAction {
  return typeof value === "string" && MAIN_ACTION_SET.has(value);
}

/**
 * Reconstructs `Answers` from an untrusted JSON body, field by field: this is a public,
 * unauthenticated endpoint, so nothing from the wire reaches `generate()` unchecked. `logo` is
 * never read by `generate()` (colour extraction from it is not built yet — ADR 0011's gap), so
 * it is left out rather than round-tripped as a `File`, which JSON cannot carry anyway.
 */
function parseAnswers(body: unknown): Answers {
  if (typeof body !== "object" || body === null) throw new Error("answers must be an object");
  const a = body as Record<string, unknown>;
  const str = (key: string): string => (typeof a[key] === "string" ? (a[key] as string) : "");
  if (a.sector !== null && !isSectorId(a.sector)) throw new Error("invalid sector");
  if (a.mainAction !== null && !isMainAction(a.mainAction)) throw new Error("invalid mainAction");

  return {
    ...EMPTY_ANSWERS,
    businessName: str("businessName"),
    sector: a.sector === null ? null : a.sector,
    otherSectorDescription: str("otherSectorDescription"),
    services: Array.isArray(a.services)
      ? a.services.filter((s): s is string => typeof s === "string")
      : [],
    address: str("address"),
    hours: str("hours"),
    noPremises: a.noPremises === true,
    mainAction: a.mainAction === null ? null : a.mainAction,
    bookingLink: str("bookingLink"),
    alsoPhone: a.alsoPhone === true,
    phone: str("phone"),
    whatsapp: str("whatsapp"),
    email: str("email"),
  };
}

/**
 * `edits` travels as elementId -> current text for every editable field the preview shows,
 * not a diff (see FullPreview.tsx: it is re-read from the live DOM at download time rather
 * than trusted from React state, to dodge a stale-closure race). Validated the same way as
 * `answers`: a public endpoint, so bounded in count and length before it reaches
 * applyTextEdits, even though an oversized or malformed entry there could only ever replace
 * a value already in the document, never add structure.
 */
function parseEdits(body: unknown): Record<string, string> {
  if (body === undefined) return {};
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("edits must be an object");
  }
  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length > MAX_EDITS) throw new Error("too many edits");
  const edits: Record<string, string> = {};
  for (const [elementId, text] of entries) {
    if (typeof text !== "string" || text.length > MAX_EDIT_LENGTH) {
      throw new Error(`invalid edit for "${elementId}"`);
    }
    edits[elementId] = text;
  }
  return edits;
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("invalid JSON body", { status: 400 });
  }
  if (typeof payload !== "object" || payload === null) {
    return new Response("invalid request body", { status: 400 });
  }
  const { answers: rawAnswers, variantIndex, edits: rawEdits } = payload as Record<string, unknown>;

  let answers: Answers;
  let edits: Record<string, string>;
  try {
    answers = parseAnswers(rawAnswers);
    edits = parseEdits(rawEdits);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "invalid request", {
      status: 400,
    });
  }

  const variant = VARIANTS[typeof variantIndex === "number" ? variantIndex : -1];
  if (!variant) return new Response("invalid variantIndex", { status: 400 });

  const { document, assets } = generate(answers, variant);
  const edited = applyTextEdits(document, edits);
  // Copied into a fresh, concrete ArrayBuffer: bundleToZip's Uint8Array is backed by whatever
  // Buffer.concat handed it, typed as the generic ArrayBufferLike that Response's BodyInit
  // does not accept.
  const zip = new Uint8Array(bundleToZip(buildSite(edited, { siteId: edited.id, assets })));

  return new Response(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${edited.id}.zip"`,
      "Content-Length": String(zip.byteLength),
    },
  });
}
