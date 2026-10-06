import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `pnpm audit`, plus the advisories this repository has decided to live with — and nothing else.
 *
 * **It is a wrapper because pnpm moved the hatch.** The exceptions used to live in
 * `package.json`'s `pnpm.auditConfig.ignoreCves`. pnpm 10 stopped reading the `pnpm` field at all
 * («The "pnpm" field in package.json is no longer read by pnpm»), and pnpm 12 has no `auditConfig`
 * anywhere — `pnpm config list` does not report one, and the facility is now the repeatable
 * `--ignore <GHSA>` flag. So the configuration was still in the repository, still validated by its
 * own script, and connected to nothing: an escape hatch that would have failed in the one
 * situation it exists for — a real advisory with no patch, CI red, and work stopped.
 *
 * Found on 6 October 2026 while pinning `source-map-js` past GHSA-68fv-2mgg-jv7q.
 *
 * The list lives in `audit-exceptions.json` rather than in this file so that adding one is a
 * reviewable change to data, and so `scripts/audit-exceptions.ts` can hold it to its dates.
 */

const file = join(import.meta.dirname, "..", "audit-exceptions.json");
const ignored = Object.keys(
  (JSON.parse(readFileSync(file, "utf8")) as { ignored?: Record<string, unknown> }).ignored ?? {},
);

const args = ["audit", "--audit-level=moderate", ...ignored.flatMap((id) => ["--ignore", id])];
if (ignored.length > 0) {
  console.log(`security-audit: ignoring ${ignored.length} advisory(ies): ${ignored.join(", ")}`);
}

const run = spawnSync("pnpm", args, { stdio: "inherit" });
process.exit(run.status ?? 1);
