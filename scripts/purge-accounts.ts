import {
  connect,
  GRACE_WINDOW_DAYS,
  photoObjectCountOf,
  purgeDueAccounts,
  type RemoveObjects,
} from "@retorika/db";
import { createClient } from "@supabase/supabase-js";

/**
 * The sweep that ends the accounts whose grace window has run out.
 *
 * Protocol Part 15: «Borrado de cuenta que borre de verdad, con una ventana de gracia razonable»,
 * and ADR 0034 §12 sets that window at thirty days. **This script is what makes the sentence true.**
 * Sprint 15 built `dueForDeletion` and `purgeAccountData`, tested them against a real Postgres,
 * and then called them from nowhere at all — so a window could run out and nothing happened. Found
 * by auditing the project on 5 October 2026.
 *
 * ```sh
 * pnpm accounts:purge              # says who is due and ends nobody
 * pnpm accounts:purge --confirm    # ends them
 * ```
 *
 * **A plain run deletes nothing**, and that default is the decision: this is the one operation in
 * the repository that destroys somebody's work on purpose, and a run that was meant to be a look
 * must not be able to become one that deletes. `purgeDueAccounts` enforces it too, so forgetting
 * the flag cannot destroy anything even if this file is bypassed.
 *
 * **It needs `DATABASE_URL`, and since ADR 0037 it needs the service key too** — which is a change
 * worth stating plainly, because the previous version of this comment said the opposite and was
 * right when it was written. Rows still cascade from `auth.users` and still need nothing but SQL.
 * The photographs are **not rows**: they are files in a private Supabase Storage bucket, and
 * `delete from storage.objects` removes the bookkeeping while the bytes stay in the object store.
 * Removing a file needs the Storage API, and reaching it past the bucket's own policies needs a key
 * that bypasses them.
 *
 * So `packages/db` finds the objects in SQL — testable, like everything else there — and the
 * removing is here, where a secret is allowed to be. `purgeDueAccounts` refuses a confirmed run
 * that was handed no remover, because ending an account and leaving its files is the one outcome
 * nobody can repair: the only handle on those bytes is the owner id in their path, and the row
 * holding that id would be gone.
 *
 * **Who runs it, and when, is `docs/runbook.md` §6.** Until something schedules it, the window is
 * a floor rather than a promise of the exact moment — which is why the account screen says «a
 * partir del» and not «el».
 */

const confirm = process.argv.includes("--confirm");

const PHOTO_BUCKET = "fotos";
const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const SERVICE_KEY_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * The remover: the Storage API, with the key that can reach past the bucket's own policies.
 *
 * **Built only for a confirmed run**, so a dry run needs no secret at all. The look must stay
 * possible on a machine that has `DATABASE_URL` and nothing else — the question «who is past the
 * window» destroys nothing and should not ask for a key that could.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` is reused rather than given a second name: the project's URL is the
 * same URL whoever is reading it, and it is public by design. The key beside it is not.
 *
 * Chunked at 100 paths, which is a limit on how much is asked at once rather than a documented
 * ceiling: a sweep of several accounts with galleries could otherwise send one request with
 * hundreds of names in it, and a failure would tell us nothing about which half landed.
 */
function storageRemover(): RemoveObjects {
  const url = process.env[URL_VAR];
  const key = process.env[SERVICE_KEY_VAR];
  if (!url || !key) {
    throw new Error(
      `accounts:purge --confirm needs ${URL_VAR} and ${SERVICE_KEY_VAR} as well as DATABASE_URL. ` +
        `Since ADR 0037 an account's photographs are files in the \`${PHOTO_BUCKET}\` bucket, and ` +
        `removing a file needs the Storage API rather than SQL. A dry run needs neither.`,
    );
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  return async (paths) => {
    for (let start = 0; start < paths.length; start += 100) {
      const batch = [...paths].slice(start, start + 100);
      const { error } = await client.storage.from(PHOTO_BUCKET).remove(batch);
      // Thrown rather than reported: `purgeDueAccounts` decides what to do with a failure, and it
      // can only do that if it hears about one. A boolean nobody reads is how the last silent
      // failure in this area got in.
      if (error) throw new Error(`storage.remove failed: ${error.message}`);
    }
  };
}

const sql = connect();
try {
  const result = await purgeDueAccounts(sql, {
    confirm,
    ...(confirm ? { removeObjects: storageRemover() } : {}),
  });

  if (result.due.length === 0) {
    console.log(
      `accounts:purge: nobody has been waiting ${GRACE_WINDOW_DAYS} days. Nothing to do.`,
    );
  } else if (!confirm) {
    console.log(
      `accounts:purge: ${result.due.length} account(s) past the ${GRACE_WINDOW_DAYS}-day window:`,
    );
    // The photograph count per account, so «--confirm» is not the first time anybody learns how
    // much is about to leave the bucket. Counted rather than listed: a hundred paths to say «a
    // hundred» is noise, and a uuid is already all the dry run prints.
    for (const id of result.due) {
      const photos = await photoObjectCountOf(sql, id);
      console.log(`  ${id}  ${photos} photograph(s)`);
    }
    console.log("\nNothing was deleted. Re-run with --confirm to end them.");
  } else {
    console.log(
      `accounts:purge: ended ${result.ended.length} account(s), removed ` +
        `${result.sitesDeleted} site(s) and ${result.photosDeleted} photograph(s).`,
    );
    for (const id of result.ended) console.log(`  ${id}`);
    if (result.skipped.length > 0) {
      // Named rather than summarised: each one is an account that asked to be deleted and was not,
      // which is the single failure protocol Part 15 wrote a clause about.
      console.log(
        `\n${result.skipped.length} account(s) were NOT ended, because their photographs could ` +
          `not be removed. Ending them anyway would leave files with nothing left to say whose ` +
          `they were. The next run tries again.`,
      );
      for (const entry of result.skipped) console.log(`  ${entry.userId}  ${entry.reason}`);
    }
    // Said out loud because it is the point: after this there is nothing left to sign in with,
    // and on the free plan there is no backup to go back to (docs/tasks/copias.md).
    console.log("\nThis cannot be undone.");
  }
  if (result.skipped.length > 0) process.exitCode = 1;
} finally {
  await sql.end();
}
