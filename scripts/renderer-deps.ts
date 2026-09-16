import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The renderer dependency allowlist (protocol Part 9.1).
 *
 * Everything that lands in packages/renderer travels to the client's published site, and
 * ADR 0001 says that site carries no runtime framework. A dependency added here is the
 * easiest way to break that promise without noticing, so it is checked rather than
 * trusted.
 */

const ALLOWED = new Set(["@retorika/schema", "@retorika/catalog"]);

const manifestPath = join(import.meta.dirname, "..", "packages", "renderer", "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  dependencies?: Record<string, string>;
};

const offenders = Object.keys(manifest.dependencies ?? {}).filter((name) => !ALLOWED.has(name));

if (offenders.length > 0) {
  console.error(
    "renderer-deps: packages/renderer declares runtime dependencies outside the allowlist:",
  );
  for (const name of offenders) console.error(`  ${name}`);
  console.error(`\nAllowed: ${[...ALLOWED].join(", ")}`);
  console.error("Everything here ships to the client's site. Discuss before adding one.");
  process.exit(1);
}

console.log(`renderer-deps: ok (${Object.keys(manifest.dependencies ?? {}).length} allowed deps).`);
