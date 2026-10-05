/**
 * Where this application is actually reached from outside, read from inside a request.
 *
 * **Found on the real deployment, 5 October 2026.** `request.url` is the address Node's own HTTP
 * server sees, and behind Render's proxy that is the internal bind address —
 * `http://localhost:10000` — never the public one. `/auth/callback` built its post-login redirect
 * from `new URL(request.url).origin`, so after «Entrar con Google» Supabase correctly sent the
 * browser to `https://retorika-builder.onrender.com/auth/callback`, the route ran, and then
 * redirected the browser to a `localhost` address nobody outside Render's own network can reach.
 * Safari's "no puede abrir la página" was that redirect succeeding exactly as written.
 *
 * Three sources, tried in order, and only the first is validated strictly enough to throw on a
 * mistake — the other two are infrastructure's own report and are trusted as given or not at all:
 *
 * 1. **`APP_ORIGIN`**, an explicit environment variable. Deterministic, and it is what makes this
 *    correct regardless of what any proxy does or does not forward. Validated as a bare
 *    `https://` origin — no path, no query, no fragment — because a value that is anything else
 *    is a deploy mistake, and one that is meant to fail loudly rather than silently redirect
 *    somewhere wrong.
 * 2. **`x-forwarded-proto` and `x-forwarded-host`.** Render's own record of what the request
 *    actually was before its proxy terminated TLS and forwarded it internally — see
 *    `docs/tasks/cabecera-de-origen.md` for why these are trusted here: a request to this
 *    application cannot bypass Render's edge, so the value is infrastructure's report of the
 *    original request rather than an unmediated client claim. A chain of proxies may repeat the
 *    header with commas; the first entry is the one closest to the original client.
 * 3. **`request.url`'s own origin**, which is already correct with nothing in front of it — local
 *    development, and any future deployment that puts nothing between the browser and this
 *    process.
 *
 * Nothing here is a secret, so it is deliberately readable without a `NEXT_PUBLIC_` prefix and
 * without routing through `auth/env.server.ts`. The client-initiated half of this same class of
 * bug — starting the OAuth flow, asking for a password-reset mail — already uses the browser's
 * own `window.location.origin` and needed no fixing: the browser is never behind Render's proxy,
 * only this server process is.
 */

export const ORIGIN_VAR = "APP_ORIGIN";

/** A bare origin and nothing else: no path beyond `/`, no query, no fragment. `allowInsecure`
 * exists only for the header path below — infrastructure's own report is trusted as given rather
 * than forced into a shape we would prefer. Returns `null` rather than throwing, so each caller
 * decides what a bad value means for it. */
function parseOrigin(value: string, { allowInsecure = false } = {}): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && !(allowInsecure && url.protocol === "http:")) return null;
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;
  return url;
}

/** The first entry of a header that may have been repeated by a chain of proxies, trimmed. A
 * single-valued header passes through unchanged. */
function firstOf(headerValue: string): string {
  return (headerValue.split(",")[0] ?? "").trim();
}

export function publicOrigin(request: Request): string {
  const configured = process.env[ORIGIN_VAR];
  if (configured) {
    const parsed = parseOrigin(configured);
    if (!parsed) {
      throw new Error(
        `${ORIGIN_VAR} is set to "${configured}", which is not a bare https:// origin (no ` +
          `path, no query, no fragment). It should look like ` +
          `"https://retorika-builder.onrender.com", with nothing after the host.`,
      );
    }
    return parsed.origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost && forwardedProto) {
    const candidate = `${firstOf(forwardedProto)}://${firstOf(forwardedHost)}`;
    const parsed = parseOrigin(candidate, { allowInsecure: true });
    // A header that does not parse into a plausible origin is dropped rather than thrown on:
    // unlike `APP_ORIGIN`, nobody configured this by hand, so there is nothing to correct and
    // falling through to `request.url` is the honest next guess.
    if (parsed) return parsed.origin;
  }

  return new URL(request.url).origin;
}
