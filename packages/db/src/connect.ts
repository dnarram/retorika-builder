import postgres from "postgres";

/**
 * The connection to the application's database.
 *
 * **Server only.** Protocol Part 15: «La clave de servicio de la base de datos no se usa nunca
 * desde el navegador.» Nothing in this package may be imported from a client component. The
 * browser reaches these tables through Supabase's own client with a key that can act only as
 * `authenticated`, and the row-level security policies in `migrations/` are what that key is
 * allowed to do.
 *
 * The URL comes from the environment and never from a literal. `.env.example` lists the names
 * with no values, which is what Part 15 asks for.
 */

/** The variable every entry point reads. */
export const URL_VAR = "DATABASE_URL";

/**
 * Supabase's transaction pooler. ADR 0012 requires it rather than the direct connection, and
 * gives the reason: "Render's free instances hibernate and wake, and direct connections are
 * exhausted by that pattern." That is a decision easy to lose by copying the wrong string out of
 * a dashboard — the direct connection is the one Supabase shows first — so it is checked here
 * instead of remembered. A local Postgres is on 5432 and is left alone.
 */
const POOLER_PORT = "6543";

export function assertPooled(url: string): void {
  const parsed = new URL(url);
  const hosted =
    parsed.hostname.endsWith(".supabase.com") || parsed.hostname.endsWith(".supabase.co");
  if (hosted && parsed.port !== POOLER_PORT) {
    throw new Error(
      `${URL_VAR} points at ${parsed.hostname}:${parsed.port || "5432"}, which is the direct ` +
        `connection. ADR 0012 requires the transaction pooler on port ${POOLER_PORT}: a service ` +
        `that hibernates and wakes exhausts direct connections.`,
    );
  }
}

export function databaseUrl(): string {
  const url = process.env[URL_VAR];
  if (!url) {
    throw new Error(
      `${URL_VAR} is not set. See .env.example for the names; the values live in .env.local, ` +
        `which is gitignored (protocol Part 15).`,
    );
  }
  assertPooled(url);
  return url;
}

export type Sql = postgres.Sql<Record<string, never>>;

export function connect(url: string = databaseUrl()): Sql {
  assertPooled(url);
  // The pooler is in transaction mode, so prepared statements cannot be reused between
  // checkouts. postgres.js names this exactly.
  return postgres(url, { prepare: false });
}
