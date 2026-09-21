/**
 * Host and path to an object key. This file is the whole tenancy risk of the Worker: a
 * mistake here serves one client's site under another client's domain.
 *
 * Both functions answer null on any doubt and never throw, so the caller has exactly one
 * failure to handle — a 404 — and never a default site to fall back to.
 */

/** A DNS label: lowercase ASCII, digits and inner hyphens, at most 63 characters. */
const SITE_ID = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * One path segment: ASCII, no leading dot (so neither "..", "." nor a hidden file), no
 * slash, backslash, percent sign or NUL. The same shape publisher's SAFE_SEGMENT writes,
 * which the contract test in test/routing.test.ts holds the two packages to.
 */
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/**
 * The site id from a Host header, or null when the host is not a site host.
 *
 * Returns null - never throws, never guesses - for: the apex domain, an unknown domain,
 * an empty or multi-label subdomain, uppercase, and anything outside [a-z0-9-].
 *
 * The match is exact, port included: a domain of "localhost:8787" serves local
 * development, and a host whose port differs from the domain's is not a site host.
 */
export function siteIdFromHost(host: string, domain: string): string | null {
  if (domain === "") return null;
  const suffix = `.${domain}`;
  if (!host.endsWith(suffix)) return null;
  const label = host.slice(0, -suffix.length);
  return SITE_ID.test(label) ? label : null;
}

/** Each segment decoded exactly once, or null if any segment is malformed or unsafe. */
function safeSegments(pathname: string): string[] | null {
  if (!pathname.startsWith("/")) return null;

  const raw = pathname.slice(1).split("/");
  const segments: string[] = [];
  for (const [i, part] of raw.entries()) {
    // Only the last segment may be empty: that is a trailing slash, i.e. a directory.
    if (part === "" && i === raw.length - 1) {
      segments.push("");
      continue;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      return null;
    }
    // Tested after decoding, so %2e%2e, %2f, %5c and %00 are judged as what they mean.
    // Decoding once means %252e stays "%2e" and fails here too.
    if (!SEGMENT.test(decoded)) return null;
    segments.push(decoded);
  }
  return segments;
}

/**
 * The object key for a request path within a site, or null if the path is unsafe.
 *
 * Returns null for: "..", percent-encoded traversal, a backslash, a NUL byte, an
 * absolute path that escapes the prefix, and anything else that would resolve outside
 * "sites/<siteId>/".
 *
 * Mapping: "/" and any path ending in "/" gain "index.html"; an extensionless last segment
 * gains ".html", so the pretty URL is answered even though publisher writes explicit
 * .html links — the link that ships stays the one that works from file://.
 *
 * VERSIONS: the layout is flat, sites/<siteId>/<path>, because the publish flow that
 * writes to storage is not designed yet. Protocol Part 16 wants each publish kept as a
 * version, with rollback as moving a pointer. When that arrives it changes this function
 * (the key gains the version) AND forces fetch in index.ts to read the site's current
 * version from R2 before it can build any key: one extra read per request.
 */
export function objectKeyFor(siteId: string, pathname: string): string | null {
  if (!SITE_ID.test(siteId)) return null;

  const withoutQuery = pathname.split(/[?#]/, 1)[0] ?? "";
  const segments = safeSegments(withoutQuery);
  if (segments === null) return null;

  const last = segments.length - 1;
  const name = segments[last] ?? "";
  if (name === "") segments[last] = "index.html";
  else if (!name.includes(".")) segments[last] = `${name}.html`;

  // Built from parts that were each validated, never concatenated and checked afterwards.
  return ["sites", siteId, ...segments].join("/");
}
