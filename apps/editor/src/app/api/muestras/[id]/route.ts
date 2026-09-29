import { recordById } from "@retorika/photobank";
import { readSampleBytes } from "@retorika/photobank/server";

/**
 * The bytes of one bank photograph, by its id.
 *
 * This exists because the generator cannot fetch them. `generateVariants` runs in the browser, so
 * a generated document can only *name* the photograph it chose — `packages/generator/src/index.ts`
 * says so where it builds an empty asset map. The editor asks here for each one and then treats
 * the answer exactly as it treats a photograph the owner uploaded: into IndexedDB, into the
 * preview's object URL map, and into the multipart form `/api/download` reads. That sameness is
 * deliberate — a bank photograph is an upload the app made on the owner's behalf, so nothing
 * downstream needs a second case for it.
 *
 * **The id is never a path.** `readSampleBytes` looks it up in the parsed, validated bank and takes
 * the filename from the record it finds, so a segment shaped like `../../../etc/passwd` is simply
 * an id nothing matches — a 404, not a traversal. That is the whole reason the lookup happens
 * before any `join`, and `packages/photobank/test/server.test.ts` proves both halves.
 *
 * `runtime = "nodejs"`: reading a file needs a filesystem, and this is the only route that does.
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // Asked separately from `readSampleBytes` so an unknown id is a plain 404 rather than a 500 with
  // a stack trace: it is a public endpoint, and "no such photograph" is an ordinary answer.
  const record = recordById(id);
  if (!record) return new Response("not found", { status: 404 });

  let bytes: Uint8Array;
  try {
    bytes = readSampleBytes(id);
  } catch {
    // The record exists but its file does not — a bank that passed review with a missing file.
    // Worth a 500 rather than a 404: the request was fine, the bank is not.
    return new Response("bank image is missing its file", { status: 500 });
  }

  // Copied into a fresh, concrete ArrayBuffer. `readFileSync`'s Uint8Array is typed over the
  // generic ArrayBufferLike, which `Response`'s BodyInit does not accept — the same step, for the
  // same reason, that `photoBlob` and the download route each take and each say so.
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.byteLength),
      // A bank photograph is immutable: its id names a reviewed file that never changes in place,
      // because approving a new one mints a new id. Safe to cache hard, and worth it — the editor
      // asks for these on every load of a generated site.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
