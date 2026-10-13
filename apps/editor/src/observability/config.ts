/**
 * Whether error reporting is switched on, and the one variable that switches it.
 *
 * **Optional on purpose, and that is the opposite of `required()` in `../auth/env.ts`.** There a
 * missing variable is «a deployment that is not finished». Here a missing DSN means something
 * else: **this environment does not report** — CI and local development, where nothing should
 * leave the machine and the `e2e` asserts exactly that. Off is not an error.
 *
 * It was also the product's state from 12 to 13 October 2026, for a different reason: Sentry is
 * a third processor of personal data beside the two ADR 0034 §14 named — Supabase and Render —
 * and the privacy notice shown when an account is created named exactly those two. Naming a
 * processor that is not processing anything would be as untrue as hiding one that is, so the
 * capture was built inert (sprint 18 day 1) and waited. **David accepted Sentry's data processing
 * agreement, with EU data residency, on 13 October 2026** (ADR 0034 §14, amended), the notice
 * gained its sentence the same day, and the DSN is set in Render by him. What the sentence
 * promises is held by `init.ts` (`dataCollection` off by name), `scrub.ts` and the project's own
 * IP setting together — `docs/runbook.md` §8.
 *
 * Protocol Part 17 is why it exists at all: «Sin esto, un fallo en el editor de un cliente no se
 * sabe nunca.»
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
