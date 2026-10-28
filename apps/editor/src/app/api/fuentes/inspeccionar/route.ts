import { MAX_FONT_BYTES } from "../../../../editor/fontBytes.ts";
import { inspectFont } from "../../../../editor/fontInspect.ts";
import { isSameOrigin, limited } from "../../publicGuard.ts";

/**
 * `POST /api/fuentes/inspeccionar` — the bytes of one font file in, what the file says about itself
 * out (ADR 0056, sprint 29 día 5): the family its `name` table gives, made writable, the `wght`
 * range of a variable file, the weight class that tells a regular from a bold, and the format the
 * bytes really are.
 *
 * **Why the server reads it.** A WOFF2 keeps `name` and `fvar` inside one brotli stream, and a
 * browser has no brotli to hand a script; Node has it, and zlib for a WOFF's tables. This is a route
 * of the editor and never of a published site (ADR 0001): nothing a visitor of a client's web loads
 * ever comes here.
 *
 * **What it costs one caller, bounded in order, before a byte is decompressed:**
 *
 * 1. A page of this application, or a 403 (`isSameOrigin`).
 * 2. Twenty requests a minute per address, shared with `/api/download`, or a 429.
 * 3. A declared `Content-Length` of at most `MAX_FONT_BYTES`: a 411 without one and a 413 above it,
 *    read **before** the body is buffered (David's adjustment 2). The body is then read against the
 *    same cap as it streams in, because a header is a claim and the bytes are the fact.
 * 4. The sniff, and then expansion capped at `totalSfntSize` and 8 MB (`fontInspect.ts`).
 *
 * The body is the file's bytes and nothing else — no multipart, no name, no `Content-Type` read: the
 * file's name is the owner's and its type is whatever their system guessed, and neither is evidence.
 * Measured on the worst file the caps admit: see ADR 0056 §10 for the number and why the
 * decompression stays in this request rather than in a worker.
 */
export const runtime = "nodejs";

/** The body, read up to `max` bytes; `null` the moment it goes past, without reading the rest. */
async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (reader === undefined) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return new Response("cross-origin request", { status: 403 });
  const tooMany = limited(request);
  if (tooMany !== null) return tooMany;

  const declared = request.headers.get("content-length");
  if (declared === null || !/^\d+$/.test(declared)) {
    return new Response("a font is sent with its Content-Length", { status: 411 });
  }
  if (Number(declared) > MAX_FONT_BYTES) {
    return new Response(`a font file is at most ${MAX_FONT_BYTES} bytes`, { status: 413 });
  }
  const bytes = await readCapped(request, MAX_FONT_BYTES);
  if (bytes === null) {
    return new Response(`a font file is at most ${MAX_FONT_BYTES} bytes`, { status: 413 });
  }

  const started = performance.now();
  const result = inspectFont(bytes);
  // How long the inspection held this process, for whoever measures it from outside — the number
  // ADR 0056 §10 was taken from, and the one to look at again if the caps ever move.
  const timing = { "Server-Timing": `inspect;dur=${(performance.now() - started).toFixed(1)}` };
  if (!result.ok) return Response.json({ reason: result.reason }, { status: 422, headers: timing });
  return Response.json(result.font, { headers: timing });
}
