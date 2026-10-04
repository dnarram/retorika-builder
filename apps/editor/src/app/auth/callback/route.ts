import { serverClient } from "@/auth/clients.server.ts";
import { authConfigured } from "@/auth/env.ts";

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
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Where to land afterwards. Only a path is accepted: an absolute URL here would make this an
  // open redirector, which is somebody else's phishing page on our domain.
  const raw = url.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (!authConfigured()) {
    return Response.redirect(new URL("/entrar?error=unknown", url.origin), 303);
  }
  if (!code) {
    // Arriving here with no code is either a cancelled consent screen or somebody typing the URL.
    // Neither is an error worth a stack trace; both belong back on the sign-in screen.
    return Response.redirect(new URL("/entrar?error=unknown", url.origin), 303);
  }

  const { error } = await (await serverClient()).auth.exchangeCodeForSession(code);
  if (error) {
    return Response.redirect(new URL("/entrar?error=expired_link", url.origin), 303);
  }
  return Response.redirect(new URL(next, url.origin), 303);
}
