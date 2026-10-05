import { connect, GRACE_WINDOW_DAYS, purgeDueAccounts } from "@retorika/db";

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
 * It needs `DATABASE_URL` and nothing else. The deletion is SQL — every table that references
 * `auth.users` cascades from it — so there is no service key here and no admin API call, which is
 * also what makes the whole thing testable: `packages/db/test/deletion.pg.test.ts` runs this exact
 * code path against a real database and then goes looking for the rows.
 *
 * **Who runs it, and when, is `docs/runbook.md` §6.** Until something schedules it, the window is
 * a floor rather than a promise of the exact moment — which is why the account screen says «a
 * partir del» and not «el».
 */

const confirm = process.argv.includes("--confirm");

const sql = connect();
try {
  const result = await purgeDueAccounts(sql, { confirm });

  if (result.due.length === 0) {
    console.log(
      `accounts:purge: nobody has been waiting ${GRACE_WINDOW_DAYS} days. Nothing to do.`,
    );
  } else if (!confirm) {
    console.log(
      `accounts:purge: ${result.due.length} account(s) past the ${GRACE_WINDOW_DAYS}-day window:`,
    );
    for (const id of result.due) console.log(`  ${id}`);
    console.log("\nNothing was deleted. Re-run with --confirm to end them.");
  } else {
    console.log(
      `accounts:purge: ended ${result.ended.length} account(s) and removed ` +
        `${result.sitesDeleted} site(s).`,
    );
    for (const id of result.ended) console.log(`  ${id}`);
    // Said out loud because it is the point: after this there is nothing left to sign in with,
    // and on the free plan there is no backup to go back to (docs/tasks/copias.md).
    console.log("\nThis cannot be undone.");
  }
} finally {
  await sql.end();
}
