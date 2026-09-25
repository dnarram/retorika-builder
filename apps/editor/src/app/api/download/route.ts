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

/**
 * The ZIP, built in memory and sent straight in the response — Render's disk is ephemeral, so
 * nothing here is ever written to it (day 5 of the sprint plan). The request carries the five
 * answers, not a site id: there is no account and nothing saved server-side to look one up by,
 * and `generate()` is deterministic, so recomputing from the answers is exactly as correct as
 * looking up a stored copy would be.
 */
export const runtime = "nodejs";

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
  const { answers: rawAnswers, variantIndex } = payload as Record<string, unknown>;

  let answers: Answers;
  try {
    answers = parseAnswers(rawAnswers);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "invalid answers", {
      status: 400,
    });
  }

  const variant = VARIANTS[typeof variantIndex === "number" ? variantIndex : -1];
  if (!variant) return new Response("invalid variantIndex", { status: 400 });

  const { document, assets } = generate(answers, variant);
  // Copied into a fresh, concrete ArrayBuffer: bundleToZip's Uint8Array is backed by whatever
  // Buffer.concat handed it, typed as the generic ArrayBufferLike that Response's BodyInit
  // does not accept.
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
