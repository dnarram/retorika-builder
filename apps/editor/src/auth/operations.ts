import type { Client } from "./clients.ts";

/**
 * Signing in, signing out, and getting back in when the password is gone.
 *
 * Every function here takes the client rather than building one, so each is a pure call against a
 * thing that can be stubbed — which is how the rules ADR 0034 fixed are tested on a machine with
 * no Supabase project.
 *
 * The errors come back as values, not exceptions. A wrong password is not an exceptional state,
 * it is the second most ordinary outcome of a sign-in form, and the screen needs the message in
 * Spanish rather than a stack trace.
 */

export type Outcome = { ok: true } | { ok: false; reason: Reason };

/**
 * What went wrong, as a closed vocabulary rather than Supabase's English prose.
 *
 * The screen maps these to `locales/es.json`. Passing the provider's own message straight through
 * would put untranslated English in front of the owner and leak which of the two halves failed —
 * `invalid_credentials` deliberately does not say whether it was the address or the password.
 */
export type Reason =
  | "invalid_credentials"
  | "rate_limited"
  | "weak_password"
  | "expired_link"
  | "unknown";

// `exactOptionalPropertyTypes` is on, so the optional fields have to admit `undefined`
// explicitly: Supabase's AuthError declares them present-but-undefined, not absent.
function reasonFor(error: {
  message: string;
  code?: string | undefined;
  status?: number | undefined;
}): Reason {
  const code = error.code ?? "";
  if (code === "invalid_credentials" || error.status === 400) return "invalid_credentials";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    error.status === 429
  )
    return "rate_limited";
  if (code === "weak_password") return "weak_password";
  if (code === "otp_expired") return "expired_link";
  return "unknown";
}

export async function signInWithPassword(
  client: Client,
  email: string,
  password: string,
): Promise<Outcome> {
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? { ok: false, reason: reasonFor(error) } : { ok: true };
}

export async function signOut(client: Client): Promise<Outcome> {
  const { error } = await client.auth.signOut();
  return error ? { ok: false, reason: reasonFor(error) } : { ok: true };
}

/**
 * The options Google sign-in is started with — and the shape of this is a decision, not a detail.
 *
 * **No `access_type: offline`, and no `prompt: consent`.** ADR 0034 §4: Google expires refresh
 * tokens from an unverified app after 7 days, and this application stays unverified until it has
 * a homepage on a domain we own, which it does not. That expiry cannot sign anybody out of
 * Retorika **because we never ask Google for a refresh token**: Supabase issues its own, and
 * Google only hands one over when `access_type: offline` is requested. Google identifies a person
 * at sign-in and nothing more.
 *
 * So the day somebody wants continued access to a Google API, this function is where it starts,
 * and the 7-day expiry becomes a real problem that needs the domain first. Written as a function
 * with a test behind it rather than as an object literal at the call site, so that change cannot
 * happen by accident.
 */
export function googleSignInOptions(redirectTo: string): {
  provider: "google";
  options: { redirectTo: string };
} {
  return { provider: "google", options: { redirectTo } };
}

export async function startGoogleSignIn(
  client: Client,
  redirectTo: string,
): Promise<{ url: string } | { ok: false; reason: Reason }> {
  const { data, error } = await client.auth.signInWithOAuth(googleSignInOptions(redirectTo));
  if (error) return { ok: false, reason: reasonFor(error) };
  if (!data.url) return { ok: false, reason: "unknown" };
  return { url: data.url };
}

/**
 * Asks for the mail that lets somebody set a new password.
 *
 * On Supabase's free plan this rides their own mail server, which has a send limit low enough to
 * hit while testing — which is why `rate_limited` is one of the reasons above and has its own
 * sentence in Spanish. Resend is the protocol's row for «accesos de cliente, facturas y avisos»
 * and waits for a reason to exist (ADR 0034).
 *
 * **The answer is the same whether or not the address has an account.** Telling somebody that an
 * address is not registered turns this form into a way to find out who has an account here.
 */
export async function requestPasswordReset(
  client: Client,
  email: string,
  redirectTo: string,
): Promise<Outcome> {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error && reasonFor(error) === "rate_limited") return { ok: false, reason: "rate_limited" };
  return { ok: true };
}

/** Sets the new password, for somebody who arrived from that mail and therefore has a session. */
export async function setNewPassword(client: Client, password: string): Promise<Outcome> {
  const { error } = await client.auth.updateUser({ password });
  return error ? { ok: false, reason: reasonFor(error) } : { ok: true };
}
