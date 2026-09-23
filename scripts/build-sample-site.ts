import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { buildSite, bundleToZip } from "@retorika/publisher";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";

/**
 * pnpm site:sample <fixture-name | path/to/document.json> [out-dir]
 *
 * Renders a document into a real directory and writes the ZIP beside it (<out-dir>.zip). This
 * is what turns the phase-0 acceptance check — open it by double-clicking, with no server and
 * no network — into something a person can actually do.
 *
 * A bare name is a fixture from fixtures/documents/, and its images are read from
 * fixtures/assets. A path is any document anywhere, and its images are read next to it: the
 * prototype's documents live in docs/design/prototype/, deliberately outside the golden corpus,
 * and each of its folders is self-contained.
 *
 * Built as a download: no baseUrl, so no sitemap, exactly what a client would receive.
 */

const REPO_ROOT = resolve(import.meta.dirname, "..");
const FIXTURES_DIR = join(REPO_ROOT, "fixtures");
const SCRATCH_DIR = join(REPO_ROOT, ".scratch");

const [target, outArg = ".scratch/site"] = process.argv.slice(2);
if (!target) {
  console.error(
    "usage: pnpm site:sample <fixture-name | path/to/document.json> [out-dir]" +
      "   (default out-dir: .scratch/site)",
  );
  process.exit(1);
}

const givenAsPath = target.endsWith(".json") || target.includes("/") || target.includes(sep);
const documentPath = givenAsPath
  ? resolve(target)
  : join(FIXTURES_DIR, "documents", `${target}.json`);
if (!existsSync(documentPath)) {
  console.error(
    givenAsPath
      ? `site:sample: no document at ${target}`
      : `site:sample: no fixture named "${target}" in fixtures/documents/`,
  );
  process.exit(1);
}

// Images are read from where the document itself lives, so a folder outside the fixtures is
// self-contained; a fixture keeps reading fixtures/assets, exactly as before.
const assetsRoot = givenAsPath ? dirname(documentPath) : FIXTURES_DIR;

const out = resolve(outArg);
const zipPath = `${out}.zip`;

// Both the directory and the ZIP beside it must stay out of the repository root.
if (out === REPO_ROOT || dirname(out) === REPO_ROOT) {
  console.error(`site:sample: refusing to write into the repository root (${outArg}).`);
  console.error("Use a path under .scratch/, which is gitignored, e.g. .scratch/site");
  process.exit(1);
}

// A directory left over from another fixture would put stale pages beside the new ones and
// make the double-click check lie. Under .scratch/ it is throwaway by definition and is
// cleared; anywhere else a non-empty directory is someone's, and we stop.
if (existsSync(out) && readdirSync(out).length > 0) {
  if (!out.startsWith(SCRATCH_DIR + sep)) {
    console.error(`site:sample: ${outArg} exists and is not empty; refusing to overwrite it.`);
    process.exit(1);
  }
  rmSync(out, { recursive: true });
}

const document: RetorikaDocument = parseDocument(JSON.parse(readFileSync(documentPath, "utf8")));

// The fixtures keep their images in fixtures/assets and refer to them as "assets/<name>".
const assets = new Map<string, Uint8Array>();
for (const page of document.pages) {
  for (const section of page.sections) {
    for (const el of section.content) {
      if (el.value?.kind === "image") {
        assets.set(el.value.src, new Uint8Array(readFileSync(join(assetsRoot, el.value.src))));
      }
    }
  }
}

const bundle = buildSite(document, {
  siteId: `sample-${basename(documentPath, ".json")}`,
  assets,
});

for (const file of bundle.files) {
  const target = join(out, file.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, file.contents);
}
mkdirSync(dirname(zipPath), { recursive: true });
writeFileSync(zipPath, bundleToZip(bundle));

const shown = (path: string) => relative(process.cwd(), path) || ".";
for (const file of bundle.files) console.log(`  ${shown(join(out, file.path))}`);
console.log(`  ${shown(zipPath)}`);
console.log(`\nOpen ${shown(join(out, bundle.manifest.entry))} by double-clicking it.`);
