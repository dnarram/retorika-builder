import { parseDocument } from "@retorika/schema";

/**
 * What leaves this application in an error report, and what never does.
 *
 * The privacy notice shown when an account is created says what is stored and who processes it.
 * An error report is a second channel out of the application, and nothing in that notice covers
 * it — so this function makes the report carry **nothing the notice would have to mention**: no
 * document, no photograph bytes, no email address, no session, no identity. What is left is what
 * an error is: a message, a stack, a URL path, a release, and the shape of the request.
 *
 * **Pure, and tested as a pure function.** `beforeSend` is the SDK's hook for this and it runs in
 * the browser and in Node; the rule it applies should not need either to be proven. The `editor`
 * test project runs in Node with no DOM, which is enough.
 *
 * Four rules, each with its reason:
 *
 * 1. **A whole document is dropped wherever it appears.** Somebody will one day attach `doc` to an
 *    error «to help», and a document is the owner's entire website — every word they typed. Found
 *    by shape first (`schemaVersion` and `pages`) and then by `parseDocument`, so a stray object
 *    with those two keys is not mistaken for one, and a real one cannot slip past by being nested.
 * 2. **Keys that name the things the notice is about are removed by name**, recursively: `document`,
 *    `doc`, `photo`, `photos`, `bytes`, `email`. A key is a promise about its value, and these
 *    promises are the ones the report must not keep.
 * 3. **Anything shaped like an email address is replaced** in every string — messages, exception
 *    values, breadcrumbs, URLs. An account stores an email and nothing else (ADR 0034), so the
 *    email is the identity, and it can appear in a message as easily as in a field.
 * 4. **`blob:` and `data:` URLs are replaced**, because both are a photograph by another name — a
 *    `data:` URL *is* the bytes — and `user`, `request.cookies` and `request.headers` are dropped
 *    whole: the first is an identity, the others carry the session.
 *
 * The replacement strings are Spanish and square-bracketed on purpose: a report that reads
 * «[correo retirado]» says that something was there and why it is not, which is what a person
 * reading the error needs to know.
 */

/**
 * Any event the SDK hands to `beforeSend`.
 *
 * `object` and not a shape, and the reason is a typing fact worth one line: the SDK's `ErrorEvent`
 * is an interface, and an interface is not assignable to a `Record<string, unknown>` — it carries
 * no index signature — so a structural type here would refuse the very events this is for. The
 * rules below read the event as `unknown` anyway; the fields they care about are `message`,
 * `exception.values[].value`, `breadcrumbs[].message` and `.data`, `extra`, `contexts`, `tags`,
 * `request` and `user`, and none of the rules depends on a field being present.
 */
export type ScrubbableEvent = object;

const REMOVED_KEYS: ReadonlySet<string> = new Set([
  "document",
  "doc",
  "photo",
  "photos",
  "bytes",
  "email",
]);

export const DOCUMENT_REMOVED = "[documento retirado]";
export const EMAIL_REMOVED = "[correo retirado]";
export const URL_REMOVED = "[url retirada]";

/** Good enough to find an address in prose; precision is not the goal, absence is. */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function looksLikeDocument(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "schemaVersion" in value &&
    "pages" in value
  );
}

function isDocument(value: unknown): boolean {
  if (!looksLikeDocument(value)) return false;
  try {
    parseDocument(value);
    return true;
  } catch {
    // Shaped like one and refused by the schema: an object someone built by hand, not a site.
    // Still dropped by rule 2 if it sits under a named key; otherwise it is not ours to judge.
    return false;
  }
}

function scrubString(value: string): string {
  if (value.startsWith("blob:") || value.startsWith("data:")) return URL_REMOVED;
  return value.replace(EMAIL, EMAIL_REMOVED);
}

/** Walk any value, applying the four rules, without mutating the input. */
function scrubValue(value: unknown, depth = 0): unknown {
  // A bound on nesting, so a circular structure handed in by a library cannot recurse for ever.
  if (depth > 12) return undefined;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (typeof value === "object" && value !== null) {
    if (isDocument(value)) return DOCUMENT_REMOVED;
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (REMOVED_KEYS.has(key.toLowerCase())) continue;
      out[key] = scrubValue(inner, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * The event with nothing personal in it, or the same shape back when there was nothing to do.
 *
 * Generic so the SDK's own event type survives the call: `beforeSend` has to hand back what it was
 * given, minus what it removed, and a narrower type would not be accepted there.
 */
export function scrubEvent<T extends object>(event: T): T {
  const scrubbed = scrubValue(event) as Record<string, unknown>;
  // Whole fields that are an identity or a session, whatever is inside them.
  delete scrubbed["user"];
  const request = scrubbed["request"];
  if (typeof request === "object" && request !== null) {
    const safeRequest = { ...(request as Record<string, unknown>) };
    delete safeRequest["cookies"];
    delete safeRequest["headers"];
    scrubbed["request"] = safeRequest;
  }
  return scrubbed as T;
}
