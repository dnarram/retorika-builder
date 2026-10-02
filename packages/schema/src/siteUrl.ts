/**
 * Where the owner says their site will live, and the rule for what counts as an answer (ADR 0029).
 *
 * **Here rather than in `packages/publisher`, for the reason `slug.ts` gives about itself.** The
 * publisher already has `assertOrigin`, and it runs inside `buildSite` — the last thing before a ZIP
 * is written. A rule checked there fails at the moment of download rather than where the value was
 * typed. Rules about what a document may contain belong beside every other rule about what a
 * document may contain.
 *
 * **It is also stricter than the publisher's, deliberately.** `assertOrigin` accepts `http:` as well
 * as `https:`, because it describes where *this build* is being served from, which is not ours to
 * narrow. This describes where the owner's **published** site will be, and a preview card fetched
 * over plain http is one browsers increasingly refuse — so the two are different questions with
 * different answers, which is why there are two checks rather than one shared one.
 */

/** Why a typed address is not one this document can hold. */
export type SiteUrlIssue =
  /** `http://…`. Not upgraded silently: it is what they wrote, and quietly changing it would be
   *  the product deciding something it was not asked to decide. */
  | "insecure"
  /** Anything after the host: a page, a query, a fragment. The document holds an origin. */
  | "path"
  /** Not an address at all. */
  | "malformed";

/** What the editor shows back, for a box whose emptiness is a perfectly good answer. */
export type SiteUrlReading =
  | { kind: "empty" }
  | { kind: "ok"; url: string }
  | { kind: "issue"; issue: SiteUrlIssue };

/**
 * The stored form: `https://` and a host, and nothing else.
 *
 * `URL.origin` is what decides it rather than a regular expression — it is the browser's own idea of
 * an origin, including how it lowercases a host and how it punycodes one, and a pattern written here
 * would be a second opinion about the same thing.
 */
export function siteUrlIssue(value: string): SiteUrlIssue | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "malformed";
  }
  if (url.protocol === "http:") return "insecure";
  if (url.protocol !== "https:") return "malformed";
  // `origin` drops a trailing slash, a path, a query and a fragment, so comparing against it is the
  // whole check: equal means the string was already nothing but an origin.
  return url.origin === value ? undefined : "path";
}

/**
 * What somebody typed, read as an address.
 *
 * **A bare host gains `https://`,** because «midominio.es» is what a person writes when asked where
 * their website is, and refusing it would be the product asking them to speak its dialect.
 * «www.midominio.es» is a host like any other and keeps its `www`.
 *
 * **A single trailing slash is dropped rather than refused.** «midominio.es/» is the same place and
 * people type it; a path is not, and is refused.
 *
 * **`http://` is refused and never upgraded.** Rewriting somebody's scheme to a different one is a
 * decision about their site, and this box is not where that gets made.
 */
export function readSiteUrl(typed: string): SiteUrlReading {
  const trimmed = typed.trim();
  if (trimmed === "") return { kind: "empty" };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return { kind: "issue", issue: "malformed" };
  }
  if (url.protocol === "http:") return { kind: "issue", issue: "insecure" };
  if (url.protocol !== "https:") return { kind: "issue", issue: "malformed" };
  // Anything past the host is a different place rather than a typo. A lone `/` is the same place,
  // which is why the comparison is against it and not against the empty string.
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return { kind: "issue", issue: "path" };
  }

  // **`url.origin` and not the string that went in**, which is what makes this a normaliser rather
  // than a validator wearing one's coat: it lowercases the host and punycodes it, so «MiDominio.es»
  // comes back as what a visitor will actually type. Returning the typed form instead made exactly
  // that case report «escribe solo la dirección» — found by the contract test below, not by reading.
  return { kind: "ok", url: url.origin };
}
