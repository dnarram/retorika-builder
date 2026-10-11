/**
 * Whether error reporting is switched on, and the one variable that switches it.
 *
 * **Optional on purpose, and that is the opposite of `required()` in `../auth/env.ts`.** There a
 * missing variable is «a deployment that is not finished». Here a missing DSN means something
 * else: **David has not said yes.** Sentry is a third processor of personal data beside the two
 * ADR 0034 §14 names — Supabase and Render — and the privacy notice shown when an account is
 * created names exactly those two. Naming a processor that is not processing anything would be
 * as untrue as hiding one that is, so until direction accepts Sentry's data processing agreement
 * and the notice gains its sentence, this stays off, and off is not an error.
 *
 * Protocol Part 17 is why it exists at all: «Sin esto, un fallo en el editor de un cliente no se
 * sabe nunca.» Sprint 18 day 1 builds the capture inert; day 7 turns it on if it is approved.
 *
 * `NEXT_PUBLIC_` because the browser needs it too, and a DSN is public by design: it identifies a
 * project to send events to and authorises nothing else. `scripts/secrets-scope.ts` refuses any
 * `NEXT_PUBLIC_` name that claims to be a secret, and this one does not.
 */

export const DSN_VAR = "NEXT_PUBLIC_SENTRY_DSN";

/** The DSN, or `undefined` while reporting is off. An empty string counts as off. */
export function sentryDsn(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = env[DSN_VAR]?.trim();
  return value ? value : undefined;
}

/** Whether reporting is on: one place to ask, so nothing initialises on its own judgement. */
export function reportingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return sentryDsn(env) !== undefined;
}
