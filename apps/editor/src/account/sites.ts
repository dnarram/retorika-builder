import type { RetorikaDocument } from "@retorika/schema";
import { SCHEMA_VERSION, safeParseDocument } from "@retorika/schema";
import { migrateToCurrent } from "@retorika/schema/migrations";
import type { Client } from "../auth/clients.ts";

/**
 * Reading and writing the sites that belong to whoever is signed in.
 *
 * **Why this goes through the Supabase client and not through Drizzle, which corrects what the
 * last pull request said.** Day 2 promised "Drizzle arrives with the first typed query", and that
 * was the wrong place to put it. A Drizzle connection uses `DATABASE_URL`, whose role **bypasses
 * row-level security** — so every ownership check would move back into TypeScript, which is
 * precisely what ADR 0034 §7 refused and what the policy suite was written to prevent. The
 * Supabase client carries the signed-in person's JWT, which is the only thing those policies can
 * see. So user-scoped data goes through here, and **Drizzle's place is the server-side work that
 * is deliberately not user-scoped** — the audit log no browser may write, and day 6's deletion
 * sweep. One tool per job, and the reason written down rather than the promise quietly dropped.
 *
 * Everything takes the client rather than building one, so each call is testable against a stub.
 * What is *not* tested here is whether the policies hold: that is SQL, and
 * `packages/db/test/policies.pg.test.ts` proves it against a real Postgres.
 */

/** What the account screen needs to list somebody's sites without loading any of them. */
export interface SiteSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface LoadedSite {
  id: string;
  name: string;
  document: RetorikaDocument;
  /** The version this was read at. A save must carry it back, or it is refused. */
  version: number;
}

export type SaveFailure =
  /** Somebody else — or another tab — wrote since this was read. ADR 0034 §8. */
  | "stale"
  /** The row is not there, or not theirs. The policies make those indistinguishable, on purpose. */
  | "missing"
  | "unknown";

export type SaveResult = { ok: true; version: number } | { ok: false; reason: SaveFailure };

/**
 * A stored document is migrated and re-validated on the way out.
 *
 * The same two steps `loadSession` already does for `localStorage`, and for the same reason: a row
 * written at 1.8.0 and read after 1.9.0 ships has to come back as a current document, and one that
 * no longer validates must not reach the editor at all. Returning null rather than throwing
 * because the caller has a screen to draw either way.
 */
function documentFrom(stored: unknown): RetorikaDocument | null {
  if (typeof stored !== "object" || stored === null) return null;
  let migrated: Record<string, unknown>;
  try {
    migrated = migrateToCurrent(stored as Record<string, unknown>);
  } catch {
    return null;
  }
  const result = safeParseDocument(migrated);
  return result.ok ? result.document : null;
}

export async function listSites(client: Client): Promise<SiteSummary[]> {
  const { data, error } = await client
    .from("sites")
    .select("id,name,updated_at")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    updatedAt: String(row.updated_at),
  }));
}

export async function loadSite(client: Client, id: string): Promise<LoadedSite | null> {
  const { data, error } = await client
    .from("sites")
    .select("id,name,document,version")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const document = documentFrom(data.document);
  if (!document) return null;
  return {
    id: String(data.id),
    name: String(data.name),
    document,
    version: Number(data.version),
  };
}

/**
 * Creates a site. **Never an upsert, and that is the point.**
 *
 * David's adjustment of 4 October: if there is an anonymous web in the browser and the account
 * already has one, neither is overwritten — the anonymous one is offered as a *new* site. So this
 * only ever inserts, and nothing in this module can replace a site the owner did not name.
 */
export async function createSite(
  client: Client,
  site: { ownerId: string; name: string; document: RetorikaDocument },
): Promise<{ ok: true; id: string; version: number } | { ok: false; reason: SaveFailure }> {
  const { data, error } = await client
    .from("sites")
    .insert({
      owner_id: site.ownerId,
      name: site.name,
      document: site.document,
      schema_version: SCHEMA_VERSION,
    })
    .select("id,version")
    .single();
  if (error || !data) return { ok: false, reason: "unknown" };
  return { ok: true, id: String(data.id), version: Number(data.version) };
}

/**
 * Saves an edit, and refuses one that carried a version somebody already replaced.
 *
 * The version travels in the `where`, not in a check-then-write: two tabs that both read version
 * 4 and both save would both pass a read-first check, and the second would silently win. Matching
 * on it means the second update finds no row — which is a refusal the owner can be told about,
 * rather than a loss they discover later (ADR 0034 §8).
 *
 * The increment is written out rather than expressed as `version + 1` in SQL because PostgREST
 * sends values, not expressions. It is equivalent *because* of the `eq("version", ...)` above:
 * only a writer holding the current version can set the next one.
 */
export async function saveSite(
  client: Client,
  edit: { id: string; version: number; document: RetorikaDocument; name?: string },
): Promise<SaveResult> {
  const next = edit.version + 1;
  const { data, error } = await client
    .from("sites")
    .update({
      document: edit.document,
      schema_version: SCHEMA_VERSION,
      version: next,
      updated_at: new Date().toISOString(),
      ...(edit.name === undefined ? {} : { name: edit.name }),
    })
    .eq("id", edit.id)
    .eq("version", edit.version)
    .select("version");
  if (error) return { ok: false, reason: "unknown" };
  // No row matched. Either the version moved on, or the row is not visible to this person — and
  // the policies make those two indistinguishable from here, deliberately. "stale" is the honest
  // reading for a site the editor had already loaded.
  if (!data || data.length === 0) return { ok: false, reason: "stale" };
  return { ok: true, version: next };
}

export function renameOf(document: RetorikaDocument): string {
  // The site's name is the business's, which the questionnaire already asked for and the document
  // already carries. Nobody is made to name their web twice.
  return document.siteName.trim() === "" ? "Mi web" : document.siteName.trim();
}

/**
 * Every site with its document, for the copy an owner takes before deleting the account.
 *
 * Protocol Part 16's first rule: «**La exportación siempre funciona**, incluso con la cuenta
 * caducada o en disputa», and that rule beats anything in ADR 0034 it collides with. Which is why
 * this is an ordinary read through the ordinary policies and needs no special case: a pending
 * deletion changes nothing about what somebody can take with them.
 */
export async function exportSites(client: Client): Promise<{
  exportedAt: string;
  schemaVersion: string;
  sites: { id: string; name: string; document: unknown; schemaVersion: string }[];
}> {
  const { data, error } = await client
    .from("sites")
    .select("id,name,document,schema_version")
    .order("updated_at", { ascending: false });
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    sites:
      error || !data
        ? []
        : data.map((row) => ({
            id: String(row.id),
            name: String(row.name),
            document: row.document,
            schemaVersion: String(row.schema_version),
          })),
  };
}

/** What the account screen needs to know about a pending deletion. */
export interface AccountState {
  deletionRequestedAt: string | null;
}

export async function accountState(client: Client, userId: string): Promise<AccountState> {
  const { data } = await client
    .from("accounts")
    .select("deletion_requested_at")
    .eq("id", userId)
    .maybeSingle();
  return {
    deletionRequestedAt: data?.deletion_requested_at ? String(data.deletion_requested_at) : null,
  };
}

/**
 * Asks for the account to be deleted, from the browser, through the ordinary policies.
 *
 * The owner updating their own `accounts` row is all this is — `accounts_update_own` is what
 * allows it, and what stops it being done to anybody else. **The actual removal is not this**: a
 * sweep runs after the grace window with a connection that can reach `auth.users`, which no
 * browser key can (`packages/db/src/deletion.ts`, and `docs/runbook.md` for who runs it).
 */
export async function requestAccountDeletion(client: Client, userId: string): Promise<boolean> {
  const { error } = await client
    .from("accounts")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", userId)
    .is("deletion_requested_at", null);
  return !error;
}

export async function cancelAccountDeletion(client: Client, userId: string): Promise<boolean> {
  const { error } = await client
    .from("accounts")
    .update({ deletion_requested_at: null })
    .eq("id", userId);
  return !error;
}
