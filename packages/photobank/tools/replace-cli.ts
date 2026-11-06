import { join } from "node:path";
import { parseArgs } from "node:util";
import { FLOOR_EXEMPT_IDS } from "../src/schema.ts";
import { ReplaceRefusal, replace } from "./replace.ts";

/**
 * `pnpm photos:replace <old-id> <draft-id> --by <name>` — a reviewed draft takes an approved
 * photograph's place, under its id and file. The draft has to be in git (committed or `git add`ed)
 * for the `git mv` to take it, the same as `photos:approve`.
 */
const ROOT = join(import.meta.dirname, "..");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { by: { type: "string" } },
});
const [oldId, draftId] = positionals;
if (!oldId || !draftId || !values.by) {
  console.error("usage: pnpm photos:replace <old-id> <draft-id> --by <name>");
  process.exitCode = 2;
} else {
  try {
    const { record, underFloor } = replace({
      oldId,
      draftId,
      by: values.by,
      today: new Date().toISOString().slice(0, 10),
      root: ROOT,
    });
    console.log(
      `photos:replace: ${record.id} is now ${draftId}'s ${record.width}x${record.height}, ` +
        `approved by ${record.review.by} on ${record.review.date}; its file is still ${record.file}`,
    );
    if (underFloor.length > 0) {
      console.log(`photos:replace: still under the floor: ${underFloor.join(", ")}`);
    } else if (FLOOR_EXEMPT_IDS.size > 0) {
      console.log(
        "photos:replace: none is left under the floor. In this same pull request, delete " +
          "FLOOR_EXEMPT_IDS and FLOOR_EXEMPTION_FAILS_FROM (src/schema.ts) and their two tests " +
          "in test/bank.test.ts — «lets the nine of restaurante-bar through by id» and «has no " +
          "photograph left under the floor, or is still inside the exemption's window».",
      );
    }
  } catch (error) {
    if (error instanceof ReplaceRefusal) {
      console.error(`photos:replace: refused — ${error.message}`);
      process.exitCode = 1;
    } else throw error;
  }
}
