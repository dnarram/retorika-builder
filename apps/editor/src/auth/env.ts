/**
 * The PUBLIC half of the Supabase configuration. Safe in a browser bundle, and reached from one.
 *
 * Protocol Part 15, third bullet: «Claves distintas para desarrollo y producción. **La clave de
 * servicio de la base de datos no se usa nunca desde el navegador.**»
 *
 * **The secret half is in `env.server.ts` and this module must never import it.** That split is
 * not tidiness: in Next a module becomes client code because something marked `"use client"`
 * imports it, possibly several files away, and the bundler says nothing about it. These two
 * halves started as one file and `scripts/secrets-scope.ts` refused it on its first run, tracing
 * `forms.tsx → clients.ts → env.ts` to the service key. The gate was right and the file was
 * wrong.
 *
 * Nothing here has a fallback value. ADR 0034 ships Google in testing mode and the whole stack on
 * free plans, so a missing variable is a deployment that is not finished — and an app that
 * silently pretends otherwise is one that looks signed in and is not.
 */

/** Public by design: these reach the browser, and row-level security is what makes that safe. */
export interface PublicConfig {
  url: string;
  anonKey: string;
}

export const PUBLIC_URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
export const PUBLIC_ANON_KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

/** Shared with `env.server.ts`, so both halves refuse a missing value the same way. */
export function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. See .env.example for the names; the values live in .env.local, which ` +
        `is gitignored (protocol Part 15).`,
    );
  }
  return value;
}

/**
 * Readable from anywhere, browser included. `NEXT_PUBLIC_` is what makes that true in Next, and
 * the prefix is on exactly these two and nothing else.
 */
export function publicConfig(): PublicConfig {
  return {
    url: required(PUBLIC_URL_VAR, process.env[PUBLIC_URL_VAR]),
    anonKey: required(PUBLIC_ANON_KEY_VAR, process.env[PUBLIC_ANON_KEY_VAR]),
  };
}

/**
 * Whether sign-in can work at all, without throwing when it cannot.
 *
 * The sign-in screen renders either way: a form that cannot reach its server is still a form
 * somebody can read, tab through and understand, and the e2e suite walks it with no project
 * configured. What it must not do is claim to work — so the screen asks this and says so.
 */
export function authConfigured(): boolean {
  return Boolean(process.env[PUBLIC_URL_VAR] && process.env[PUBLIC_ANON_KEY_VAR]);
}
