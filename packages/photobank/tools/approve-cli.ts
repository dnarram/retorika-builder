import { join } from "node:path";
import { parseArgs } from "node:util";
import { ApproveRefusal, approve } from "./approve.ts";

/** `pnpm photos:approve <sector>.NN --by <name> [--allow-partial]` — the review, as an act. */
const ROOT = join(import.meta.dirname, "..");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { by: { type: "string" }, "allow-partial": { type: "boolean", default: false } },
});
const id = positionals[0];
if (!id || !values.by) {
  console.error("usage: pnpm photos:approve <sector>.NN --by <name> [--allow-partial]");
  process.exitCode = 2;
} else {
  try {
    const record = approve({
      id,
      by: values.by,
      today: new Date().toISOString().slice(0, 10),
      root: ROOT,
      allowPartial: values["allow-partial"],
    });
    console.log(
      `photos:approve: ${record.id} is in the bank, approved by ${record.review.by} on ${record.review.date}`,
    );
  } catch (error) {
    if (error instanceof ApproveRefusal) {
      console.error(`photos:approve: refused — ${error.message}`);
      process.exitCode = 1;
    } else throw error;
  }
}
