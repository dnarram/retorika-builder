import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicConfig } from "./env.ts";

/**
 * The browser's Supabase client.
 *
 * It carries the anon key, so it can only act as `authenticated`, and what it is allowed to do is
 * decided by the row-level security policies in `packages/db/migrations/` rather than here. That
 * is ADR 0034 §7, and it is why this never needs the service key.
 *
 * **The server client is in `clients.server.ts`,** because it reads cookies through
 * `next/headers` and nothing a `"use client"` module imports may reach that. The two started as
 * one file; `scripts/secrets-scope.ts` is what keeps them apart.
 */

export type Client = SupabaseClient;

/** The session lives in cookies, so the server can read it on the next request. */
export function browserClient(): Client {
  const { url, anonKey } = publicConfig();
  return createBrowserClient(url, anonKey);
}
