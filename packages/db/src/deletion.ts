import type { Sql } from "./connect.ts";

/**
 * Deleting an account, and meaning it.
 *
 * Protocol Part 15, `docs/protocolo.md:1075` — **the only clause in the whole protocol written
 * specifically about accounts**:
 *
 * > - Borrado de cuenta que borre de verdad, con una ventana de gracia razonable.
 *
 * «Razonable» was quantified nowhere, and ADR 0034 §12 sets it at **30 days**: long enough to undo
 * a decision made in anger or by mistake, short enough to honour «guardarlo el menor tiempo
 * posible».
 *
 * **What this module does and what it deliberately does not.** It removes everything Retorika
 * stores — the sites, the account row — and records that the deletion happened. It does **not**
 * delete the Supabase Auth user, because that needs the service-role key through Supabase's own
 * admin API and cannot be reached from a plain Postgres connection. That call is the sweep's last
 * step and it is named in `docs/runbook.md`; splitting it this way is what makes the half that
 * holds the data testable against a real database instead of described in a comment.
 *
 * Everything here runs with a connection that bypasses row-level security, which is correct and is
 * the exception the policies were written around: a sweep acts on behalf of nobody, so there is no
 * JWT for `auth.uid()` to read. That is also why this lives in `packages/db` and never in the
 * browser's reach — `scripts/secrets-scope.ts` enforces the second half of that sentence.
 */

/** ADR 0034 §12. In days, because that is the unit the sentence is written in. */
export const GRACE_WINDOW_DAYS = 30;

/**
 * Marks an account for deletion. Idempotent on purpose: asking twice does not restart the clock,
 * because somebody who clicks it again a week later meant the first click.
 */
export async function requestDeletion(sql: Sql, userId: string): Promise<{ requestedAt: Date }> {
  const [row] = await sql<{ deletion_requested_at: Date }[]>`
    update public.accounts
       set deletion_requested_at = coalesce(deletion_requested_at, now())
     where id = ${userId}
    returning deletion_requested_at`;
  if (!row) throw new Error(`no account row for ${userId}`);
  return { requestedAt: row.deletion_requested_at };
}

/** Changing your mind, which is the entire point of a grace window. */
export async function cancelDeletion(sql: Sql, userId: string): Promise<void> {
  await sql`update public.accounts set deletion_requested_at = null where id = ${userId}`;
}

/**
 * The accounts whose window has run out.
 *
 * The cutoff is computed in the database rather than in Node: a sweep run from a laptop in one
 * timezone must not delete an account an hour early because of where it was run from.
 */
export async function dueForDeletion(sql: Sql): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id
      from public.accounts
     where deletion_requested_at is not null
       and deletion_requested_at < now() - make_interval(days => ${GRACE_WINDOW_DAYS})`;
  return rows.map((row) => row.id);
}

/**
 * Removes everything Retorika stores for one account, and records that it happened.
 *
 * **The audit row is written first, and then loses its actor.** Part 17 asks for «quién, cuándo y
 * sobre qué web», and after a real deletion there is no «quién» left to name — which is what
 * «borre de verdad» means. `audit_log.actor_id` is `on delete set null`, so the row survives the
 * cascade and keeps the fact without keeping the person. The two clauses pull in opposite
 * directions and Part 15 wins; this comment exists so the next reader knows it was a decision and
 * not an oversight.
 *
 * One transaction: a half-deleted account is worse than either outcome, and «una migración a
 * medias» is already one of the four cases the runbook has to describe.
 */
export async function purgeAccountData(
  sql: Sql,
  userId: string,
): Promise<{ sitesDeleted: number }> {
  return sql.begin(async (tx) => {
    await tx`
      insert into public.audit_log (operation, actor_id, detail)
      values ('account_deleted', ${userId}, ${tx.json({ graceWindowDays: GRACE_WINDOW_DAYS })})`;

    const sites = await tx`delete from public.sites where owner_id = ${userId}`;
    await tx`delete from public.accounts where id = ${userId}`;
    return { sitesDeleted: sites.count };
  }) as Promise<{ sitesDeleted: number }>;
}

/**
 * Everything a departing owner is entitled to take with them, for the export the commitment
 * requires **before** anything is removed.
 *
 * Protocol Part 16: «**La exportación siempre funciona**, incluso con la cuenta caducada o en
 * disputa», and «Si alguna vez una decisión técnica choca con una de estas tres, gana la regla.»
 * A deletion path with no export in front of it would be exactly that collision.
 */
export async function exportAccount(
  sql: Sql,
  userId: string,
): Promise<{ sites: { id: string; name: string; document: unknown; schemaVersion: string }[] }> {
  const rows = await sql<
    { id: string; name: string; document: unknown; schema_version: string }[]
  >`select id, name, document, schema_version from public.sites where owner_id = ${userId}
     order by updated_at desc`;
  return {
    sites: rows.map((row) => ({
      id: row.id,
      name: row.name,
      document: row.document,
      schemaVersion: row.schema_version,
    })),
  };
}
