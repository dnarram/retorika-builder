import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { bankFileSchema, draftBankFileSchema } from "../src/schema.ts";
import { IntakeRefusal, intake } from "./intake.ts";

/**
 * `pnpm photos:intake <file.png> --sector <sector> --alt "<alt>" --checked YYYY-MM-DD [--generated YYYY-MM-DD]`
 *
 * One PNG per run, because the `alt` is one reviewed text per photograph and this never derives
 * it. Writes `drafts/photos/<id>.webp` and the record into `drafts/<sector>.json`, and prints what
 * it did, what it changed (a flatten, a downsize), and what only a person can check. Approving is
 * `pnpm photos:approve`.
 */

const ROOT = join(import.meta.dirname, "..");

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function takenIds(sector: string): string[] {
  const ids: string[] = [];
  for (const dir of ["bank", "drafts"]) {
    const path = join(ROOT, dir, `${sector}.json`);
    if (!existsSync(path)) continue;
    const file = JSON.parse(readFileSync(path, "utf8")) as { images?: { id: string }[] };
    for (const image of file.images ?? []) ids.push(image.id);
  }
  return ids;
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sector: { type: "string" },
      alt: { type: "string" },
      checked: { type: "string" },
      generated: { type: "string" },
    },
  });
  const file = positionals[0];
  if (!file || !values.sector || !values.alt || !values.checked) {
    console.error(
      'usage: pnpm photos:intake <file.png> --sector <sector> --alt "<alt in Spanish>" --checked YYYY-MM-DD [--generated YYYY-MM-DD]',
    );
    return 2;
  }
  const sectors = readdirSync(join(ROOT, "bank"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""));
  if (!sectors.includes(values.sector)) {
    console.error(
      `photos:intake: "${values.sector}" is not a sector; known: ${sectors.join(", ")}`,
    );
    return 2;
  }
  const png = readFileSync(file);
  const generated = values.generated ?? statSync(file).mtime.toISOString().slice(0, 10);
  try {
    const result = await intake({
      png,
      sector: values.sector,
      alt: values.alt,
      checked: values.checked,
      generated,
      today: today(),
      taken: takenIds(values.sector),
    });
    const draftPath = join(ROOT, "drafts", `${values.sector}.json`);
    const existing = existsSync(draftPath)
      ? draftBankFileSchema.parse(JSON.parse(readFileSync(draftPath, "utf8")))
      : { sector: values.sector, images: [] };
    // The bank file is parsed too, so an intake into a sector whose bank is broken fails here
    // rather than at approval.
    bankFileSchema.parse(
      JSON.parse(readFileSync(join(ROOT, "bank", `${values.sector}.json`), "utf8")),
    );
    mkdirSync(join(ROOT, "drafts", "photos"), { recursive: true });
    writeFileSync(join(ROOT, "drafts", "photos", result.record.file), result.webp);
    writeFileSync(
      draftPath,
      `${JSON.stringify({ ...existing, images: [...existing.images, result.record] }, null, 2)}\n`,
    );
    console.log(
      `photos:intake: ${basename(file)} → drafts/photos/${result.record.file} ` +
        `(${result.record.width}x${result.record.height}, ${(result.record.bytes / 1024).toFixed(1)} KB)`,
    );
    for (const note of result.notes) console.log(`  ${note}`);
    console.log(`  prompt (${result.record.origin.prompt.length} chars) read from the file's XMP`);
    console.log(
      `  generated ${generated}${values.generated ? "" : " (the file's modification date; pass --generated to say otherwise)"}`,
    );
    console.log("  for the reviewer, which no test can check:");
    for (const line of result.forTheReviewer) console.log(`    - ${line}`);
    console.log(`  then: pnpm photos:approve ${result.record.id} --by <name>`);
    return 0;
  } catch (error) {
    if (error instanceof IntakeRefusal) {
      console.error(`photos:intake: refused — ${error.message}`);
      return 1;
    }
    throw error;
  }
}

process.exitCode = await main();
