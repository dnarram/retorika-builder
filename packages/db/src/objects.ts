import type { Sql } from "./connect.ts";

/**
 * Finding the stored files that belong to one account, so a deletion can take them too.
 *
 * **Files are not rows, and that is the whole reason this module exists.** Migration `0003` stores
 * an owner's photographs in a private Supabase Storage bucket under `<owner>/<site>/<src>`
 * (ADR 0037), and migration `0004` their own fonts in a second one under `<owner>/<site>/<file>`
 * (ADR 0056). Deleting rows from `storage.objects` with SQL removes the bookkeeping and leaves the
 * bytes in the object store, so the sweep cannot stay pure SQL the way the rest of `deletion.ts`
 * is: it has to ask the Storage API to remove them, with a key that can.
 *
 * So the division is: **this file finds them, and the caller removes them.** Finding is a query
 * and belongs here with the other queries, where the pg suite can prove that one person's folder
 * is never another's. Removing needs a service key and an HTTP call, which is `scripts/` work and
 * is handed in as a function — which is also what lets the pg suite assert the order of operations
 * without a bucket.
 *
 * This was `photos.ts` until sprint 29 día 6, when the second bucket arrived and the bucket became
 * a parameter rather than a second copy of every query.
 */

/**
 * The buckets that hold an owner's files, **in the order the sweep empties them**. Photographs
 * first because they came first and are the larger of the two; the order between them decides
 * nothing else, since both go before the transaction that ends the account.
 */
export const ACCOUNT_BUCKETS = ["fotos", "fuentes"] as const;
export type AccountBucket = (typeof ACCOUNT_BUCKETS)[number];

/**
 * Every object path stored for this account in one bucket, whichever site each belongs to.
 *
 * The first path segment is the owner, which is exactly what both buckets' policies compare
 * against `auth.uid()`, so the same expression that decides what a browser may read decides what a
 * deletion must remove. One rule, two readers.
 *
 * **This runs with a connection that bypasses row-level security**, like everything else in this
 * module's neighbourhood: a sweep acts on behalf of nobody, so there is no JWT for `auth.uid()` to
 * read. The `where` clause is therefore the only thing scoping it, which is why the pg suite has a
 * case that proves it does not return Bob's — and one that proves it does not return the other
 * bucket's.
 */
export async function objectsOf(
  sql: Sql,
  bucket: AccountBucket,
  userId: string,
): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select name
      from storage.objects
     where bucket_id = ${bucket}
       and (storage.foldername(name))[1] = ${userId}
     order by name`;
  return rows.map((row) => row.name);
}

/**
 * How many objects one bucket holds for this account, for a dry run that should not print a
 * hundred paths to say «there are a hundred».
 */
export async function objectCountOf(
  sql: Sql,
  bucket: AccountBucket,
  userId: string,
): Promise<number> {
  const [row] = await sql<{ count: string }[]>`
    select count(*)::text as count
      from storage.objects
     where bucket_id = ${bucket}
       and (storage.foldername(name))[1] = ${userId}`;
  return Number(row?.count ?? 0);
}

/**
 * Removes a set of objects from one bucket, by full path.
 *
 * Implemented by the caller — `scripts/purge-accounts.ts` builds one from
 * `@supabase/supabase-js` and the service key — so that `packages/db` needs no HTTP client and no
 * secret of its own, and so the sweep's order of operations can be tested against a remover that
 * simply records, or refuses.
 *
 * **The bucket is an argument rather than baked into the remover**, because one sweep empties two
 * of them and a remover that silently sent the fonts' paths to the photographs' bucket would remove
 * nothing and report success.
 *
 * **It throws rather than returning false when it cannot finish.** The sweep's decision depends on
 * knowing it failed, and a boolean nobody reads is how the last silent failure in this area got
 * in.
 */
export type RemoveObjects = (bucket: AccountBucket, paths: readonly string[]) => Promise<void>;
