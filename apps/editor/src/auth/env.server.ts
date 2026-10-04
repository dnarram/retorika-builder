/**
 * The SECRET half of the Supabase configuration. **Server only, and nothing that a `"use client"`
 * module can reach may import this file.**
 *
 * `scripts/secrets-scope.ts` walks the import graph and fails the build if anything does, which
 * is the check that caught the first version of this code living in `env.ts` alongside the public
 * half. Protocol Part 15: «La clave de servicio de la base de datos no se usa nunca desde el
 * navegador.»
 *
 * Nothing in sprint 15 needs this to sign anybody in — the anon key does that, and row-level
 * security is what makes the anon key safe (ADR 0034 §7). The only caller is the audit log, which
 * no browser may write (§17).
 */

import { required } from "./env.ts";

export const SERVICE_KEY_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * The key that bypasses row-level security. **Server only, and this throws if it is ever reached
 * from a browser** rather than trusting that it will not be: `window` existing here means a
 * bundler has pulled this module into client code, which is the mistake Part 15 is written about.
 *
 * It is not needed to sign anybody in — `anonKey` does that — and nothing in sprint 15 calls this
 * except the audit log, which no browser may write (ADR 0034 §17).
 */
export function serviceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      `${SERVICE_KEY_VAR} was read in a browser. It bypasses row-level security and protocol ` +
        `Part 15 forbids it leaving the server. Something imported a server module into client code.`,
    );
  }
  return required(SERVICE_KEY_VAR, process.env[SERVICE_KEY_VAR]);
}
