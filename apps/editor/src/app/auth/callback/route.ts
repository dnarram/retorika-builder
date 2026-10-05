import { serverClient } from "@/auth/clients.server.ts";
import { authConfigured } from "@/auth/env.ts";
import { publicOrigin } from "@/auth/publicOrigin.ts";

/**
 * Where Google sends somebody back to, and where the code becomes a session.
 *
 * Google's redirect carries a one-time code in the query string. Exchanging it is what writes the
 * session cookies, and it has to happen on the server: a route handler can write cookies, which
 * is exactly why `serverClient`'s `setAll` is not swallowed here (see the comment there).
 *
 * `runtime = "nodejs"` for the same reason the fonts route sets it — `@supabase/ssr` reads and
 * writes cookies through Next's server APIs, and this route has no business on an edge runtime.
 *
 * **What this route never does is store Google's own tokens.** ADR 0034 §4: Google identifies a
 * person at sign-in and nothing more, Supabase issues the session, and no `provider_token` or
 * `provider_refresh_token` is kept. That is also why `googleSignInOptions` does not ask for
 * offline access — without it Google sends no refresh token to mishandle.
 *
 * **Every redirect below lands on `publicOrigin(request)`, never on `request.url`'s own origin.**
 * Found on the real deployment, 5 October 2026: behind Render's proxy `request.url` is
 * `http://localhost:10000/...`, the internal bind address, so the old code sent every browser
 * that signed in with Google to an address that only exists inside Render's own network. See
 * `apps/editor/src/auth/publicOrigin.ts` for the fix and `docs/tasks/cabecera-de-origen.md` for
 * why its two fallbacks can be trusted.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const code = url.searchParams.get("code");
  // Where to land afterwards. Only a path is accepted: an absolute URL here would make this an
  // open redirector, which is somebody else's phishing page on our domain.
  const raw = url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (!authConfigured()) {
    return Response.redirect(new URL("/entrar?error=unknown", origin), 303);
  }
  if (!code) {
    // Arriving here with no code is either a cancelled consent screen or somebody typing the URL.
    // Neither is an error worth a stack trace; both belong back on the sign-in screen.
    return Response.redirect(new URL("/entrar?error=unknown", origin), 303);
  }

  const { error } = await (await serverClient()).auth.exchangeCodeForSession(code);
  if (error) {
    return Response.redirect(new URL("/entrar?error=expired_link", origin), 303);
  }
  return Response.redirect(new URL(next, origin), 303);
}
