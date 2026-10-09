import type { Sql } from "./connect.ts";
import { photoObjectsOf, type RemoveObjects } from "./photos.ts";

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
 * **What this module does.** `requestDeletion` records that somebody asked, `dueForDeletion` finds
 * whose window has run out, `purgeAccountData` forgets one account's data, and `purgeDueAccounts`
 * ends the accounts that are due — including the Supabase Auth user, which is what leaves nothing
 * to sign in with, and including the photographs in the storage bucket, which are the one part
 * that is not a row. `scripts/purge-accounts.ts` is the only caller of that last one and
 * `docs/runbook.md` §6 says who runs it and how often.
 *
 * > **Correction, 5 October 2026.** This header used to say the Auth user «needs the service-role
 * > key through Supabase's own admin API and cannot be reached from a plain Postgres connection»,
 * > and that was wrong twice over. The role the migrations already run as owns `auth.users`, and
 * > every table that references it cascades — `public.sites`, `public.accounts`, and Supabase's own
 * > `auth.identities`, `auth.sessions` and `auth.refresh_tokens` — so one `delete` finishes the
 * > job. Believing otherwise is what left the sweep **unbuilt**: the untestable half was carved
 * > out, nothing was written to call the testable half, and «borre de verdad» was a sentence on a
 * > screen with no mechanism behind it for a whole sprint. Doing it in SQL is also what makes the
 * > whole thing testable, which is the opposite of what the old note claimed.
 *
 * > **And a second correction, 9 October 2026 (ADR 0037).** «One `delete` finishes the job» is
 * > true of every *row*, and the photographs are not rows: they are files in a Supabase Storage
 * > bucket, and `delete from storage.objects` removes the bookkeeping while the bytes stay in the
 * > object store. So the sweep is no longer pure SQL. It asks a `removeObjects` function — handed
 * > in, implemented in `scripts/purge-accounts.ts` with the service key — to remove them **before**
 * > it ends the account, and **skips the account if that fails**. The order and the skip are both
 * > decisions, argued where they are made below.
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
 * The work itself, inside a transaction the caller owns.
 *
 * **The audit row is written first, and then loses its actor.** Part 17 asks for «quién, cuándo y
 * sobre qué web», and after a real deletion there is no «quién» left to name — which is what
 * «borre de verdad» means. `audit_log.actor_id` is `on delete set null`, so the row survives the
 * cascade and keeps the fact without keeping the person. The two clauses pull in opposite
 * directions and Part 15 wins; this comment exists so the next reader knows it was a decision and
 * not an oversight.
 *
 * `alsoAuthUser` is the difference between removing what Retorika stores and ending the account.
 * Deleting the `auth.users` row cascades through everything — `public.sites`, `public.accounts`,
 * and Supabase's own `auth.identities`, `auth.sessions` and `auth.refresh_tokens`, all of which
 * reference it — so after it there is nothing left to sign in with.
 */
async function purgeWithin(
  tx: Sql,
  userId: string,
  alsoAuthUser: boolean,
): Promise<{ sitesDeleted: number; authUserDeleted: boolean }> {
  await tx`
    insert into public.audit_log (operation, actor_id, detail)
    values ('account_deleted', ${userId}, ${tx.json({
      graceWindowDays: GRACE_WINDOW_DAYS,
      endedTheAccount: alsoAuthUser,
    })})`;

  const sites = await tx`delete from public.sites where owner_id = ${userId}`;
  await tx`delete from public.accounts where id = ${userId}`;
  const authUser = alsoAuthUser
    ? await tx`delete from auth.users where id = ${userId}`
    : { count: 0 };
  return { sitesDeleted: sites.count, authUserDeleted: authUser.count > 0 };
}

/**
 * Removes everything Retorika stores for one account, and records that it happened — but leaves
 * the Supabase Auth user alone, so this is «forget their data» rather than «end the account».
 * `purgeDueAccounts` below is the one that ends it.
 *
 * One transaction: a half-deleted account is worse than either outcome, and «una migración a
 * medias» is already one of the cases the runbook has to describe.
 */
export async function purgeAccountData(
  sql: Sql,
  userId: string,
  removeObjects: RemoveObjects,
): Promise<{ sitesDeleted: number; photosDeleted: number }> {
  // Before the transaction, and for the reason `purgeDueAccounts` writes out at length: a failure
  // here must leave the account intact rather than leave files nothing remembers.
  const photos = await photoObjectsOf(sql, userId);
  if (photos.length > 0) await removeObjects(photos);

  const { sitesDeleted } = (await sql.begin(async (tx) => {
    const result = await purgeWithin(tx, userId, false);
    return { sitesDeleted: result.sitesDeleted };
  })) as { sitesDeleted: number };
  return { sitesDeleted, photosDeleted: photos.length };
}

/**
 * The sweep: every account whose grace window has run out, ended for real.
 *
 * **This is what «borrado de cuenta que borre de verdad» needs in order to be true, and it did not
 * exist.** `dueForDeletion` and `purgeAccountData` shipped in sprint 15 and nothing ever called
 * them: no route, no script, no scheduled job. So the window could expire and nothing happened —
 * found by auditing the project on 5 October 2026, along with the reason nobody could have asked
 * for a deletion in the first place (migration `0002`).
 *
 * **It does nothing unless `confirm` is passed**, and that default is the decision rather than
 * caution for its own sake: this is the one operation in the repository that destroys somebody's
 * work on purpose, and a run that was meant to be a look should not be able to become one that
 * deletes. `scripts/purge-accounts.ts` is the only caller and it requires `--confirm` on the
 * command line.
 *
 * One transaction per account rather than one for all of them: an account either ends or does not,
 * and a sweep that found six and failed on the fourth should leave three ended and two untouched,
 * not roll back the three it had already finished honestly.
 *
 * **The auth user is deleted here, in SQL, and that corrects what sprint 15 day 6 wrote.** That
 * note said this step «needs the service key through Supabase's admin API and cannot be reached
 * from a plain Postgres connection», and splitting it that way is what left the sweep unbuilt and
 * untestable. The role the migrations already run as owns `auth.users`, and every table that
 * references it cascades, so one `delete` finishes the job — against the real Postgres the tests
 * use, like everything else here.
 */
export interface SweepResult {
  /** Everybody whose window has run out, whether or not this run touched them. */
  due: string[];
  /** The ones actually ended. Empty unless `confirm` was passed. */
  ended: string[];
  /** Sites removed along with them, summed. */
  sitesDeleted: number;
  /** Photograph objects removed from the bucket, summed (ADR 0037). */
  photosDeleted: number;
  /**
   * The accounts this run did **not** end, because their photographs could not be removed.
   *
   * Not an error the sweep swallows and not one it dies on: every other account is still ended, and
   * these are named so somebody can look. The next run tries them again.
   */
  skipped: { userId: string; reason: string }[];
}

export async function purgeDueAccounts(
  sql: Sql,
  {
    confirm = false,
    removeObjects,
  }: { confirm?: boolean; removeObjects?: RemoveObjects | undefined } = {},
): Promise<SweepResult> {
  const due = await dueForDeletion(sql);
  if (!confirm) return { due, ended: [], sitesDeleted: 0, photosDeleted: 0, skipped: [] };

  /**
   * **A confirmed sweep without a way to remove the photographs is refused, not run.**
   *
   * The alternative — carry on and leave the files — is the one outcome nobody can repair: the
   * account is gone, so nothing records whose bytes those were, and no later sweep can find an
   * owner who no longer exists. Part 15 asks for a deletion that deletes for real, and half of one
   * is not a smaller version of it. A caller that reaches this line has forgotten something, and
   * finding out now is cheaper than finding out from the storage bill.
   */
  if (!removeObjects) {
    throw new Error(
      "purgeDueAccounts: confirm was passed with no removeObjects. The photographs in the " +
        "`fotos` bucket are files, not rows, so SQL alone would end the account and leave them " +
        "behind with nothing left to say whose they were (ADR 0037).",
    );
  }

  const ended: string[] = [];
  const skipped: { userId: string; reason: string }[] = [];
  let sitesDeleted = 0;
  let photosDeleted = 0;

  for (const userId of due) {
    /**
     * **The photographs go first, and a failure skips the account rather than ending it.**
     *
     * The two orders fail differently, and only one of them fails recoverably:
     *
     * - *Objects, then rows.* A failure leaves an account that is past its window with some of its
     *   photographs gone. Nobody is going to come back to it — the window expired — and the next
     *   run finishes the job. The damage is a few hours of an account that was leaving anyway.
     * - *Rows, then objects.* A failure leaves the account ended and the files in the bucket with
     *   **nothing left that remembers whose they were**: the only handle is the owner id in the
     *   path, and the row that held that id is gone. Storage nobody can attribute and no sweep can
     *   find.
     *
     * So: objects first, and if that throws, this account is skipped and named. The remover is
     * allowed to be partial — Supabase's `remove` takes a list — so a skipped account may have
     * lost some photographs already. That is the cost of the order, it is smaller than the
     * alternative, and it is written here rather than discovered.
     */
    const photos = await photoObjectsOf(sql, userId);
    if (photos.length > 0) {
      try {
        await removeObjects(photos);
      } catch (error) {
        skipped.push({
          userId,
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    const result = (await sql.begin((tx) => purgeWithin(tx, userId, true))) as {
      sitesDeleted: number;
      authUserDeleted: boolean;
    };
    ended.push(userId);
    sitesDeleted += result.sitesDeleted;
    photosDeleted += photos.length;
  }
  return { due, ended, sitesDeleted, photosDeleted, skipped };
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
