/**
 * Pages are revalidated on every visit, so a republish is visible at once; the ETag makes
 * that a 304 with no body when nothing changed.
 *
 * Assets are cached for five minutes and then revalidated the same way. Not `immutable`:
 * publisher names assets by their original basename, not by a hash of their contents, so
 * a client who replaces photo.jpg with a new photo.jpg would otherwise leave visitors on
 * the old one for a year. `immutable` becomes right the day publisher hashes asset names.
 */
export function cacheControlFor(key: string): string {
  const relative = key.split("/").slice(2).join("/");
  return relative.startsWith("assets/")
    ? "public, max-age=300, must-revalidate"
    : "public, no-cache";
}

/**
 * Sent on every response, errors included.
 *
 * nosniff because content types come from the object's stored metadata, which publisher
 * set, and a browser must not second-guess them. No Access-Control-Allow-Origin: nothing
 * needs it, and it is easier to add later than to withdraw. No CSP yet: a strict one could
 * break a future section that genuinely needs JavaScript, so it is a decision of its own.
 */
export function securityHeaders(): Record<string, string> {
  return {
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
  };
}
