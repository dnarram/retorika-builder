import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";
import { copyrightNotice, reservesPresentedName } from "../packages/publisher/src/licences.ts";
import {
  FONT_FAMILY_PATTERN,
  FONT_GALLERY,
  type FontKind,
  fontFamilySlug,
} from "../packages/schema/src/fontGallery.ts";
import {
  googleFontsCommit,
  type HolderReading,
  holderVerdict,
  readHolderLicences,
} from "./fetch-font-licences.ts";

/**
 * The survey behind the gallery (ADR 0055): which `@fontsource` families pass the four filters of
 * ADR 0046 §3, and what each one weighs the way `scripts/size-budget.ts` weighs it.
 *
 * `pnpm fonts:survey`. **No new dependency, nothing executed, nothing written to the repository.** For
 * each candidate it runs `npm pack @fontsource/<id> --ignore-scripts` into a temporary directory —
 * which downloads the published tarball and runs none of its code — gunzips it, and reads only the
 * entries it needs into memory with the thirty-line ustar reader below. The temporary directory is
 * removed at the end.
 *
 * **Filter 2 is read from the holders, not from the package** (ADR 0045, amended 27 October 2026).
 * `@fontsource`'s `LICENSE` rebuilds its copyright line from the fonts' name tables and dropped the
 * reservation of ten of the families first surveyed — Libre Baskerville, then shipped, among them. So
 * each candidate is also read through `scripts/fetch-font-licences.ts`: google/fonts' `OFL.txt` at
 * one commit for the whole run, and the licence in the author's own repository. A family passes only
 * if neither reserves the name we would present; if the two disagree it is «out — discrepancy» and
 * both notices are printed. The package's own line is still reported, as the evidence of the gap.
 *
 * **The survey admits; it does not choose.** A family that passes is a candidate, and which of them
 * enter the table, under which species and with which substitute, is the judgement written in
 * `packages/schema/src/fontGallery.ts`. The «substitute» column prints that judgement for the rows
 * already in the table and is empty for the rest.
 *
 * The candidate list is where to look, not what to find: Roboto was expected to fall on its licence
 * and the reserved names on filter 2, and the headline families with a single weight on filter 3 —
 * which is ADR 0046 §4's cost, measured here over the «display» species instead of asserted.
 */

const run = promisify(execFile);

interface Candidate {
  id: string;
  /** Where we would file it if it passed — our judgement, printed beside Google's own category. */
  kind: FontKind;
}

const candidate = (kind: FontKind, ids: readonly string[]): Candidate[] =>
  ids.map((id) => ({ id, kind }));

const CANDIDATES: readonly Candidate[] = [
  ...candidate("sans", [
    "albert-sans",
    "archivo",
    "barlow",
    "be-vietnam-pro",
    "cabin",
    "dm-sans",
    "epilogue",
    "figtree",
    "fira-sans",
    "hanken-grotesk",
    "heebo",
    "ibm-plex-sans",
    "instrument-sans",
    "inter",
    "jost",
    "karla",
    "kumbh-sans",
    "lato",
    "lexend",
    "libre-franklin",
    "manrope",
    "montserrat",
    "mulish",
    "noto-sans",
    "nunito",
    "nunito-sans",
    "onest",
    "open-sans",
    "outfit",
    "plus-jakarta-sans",
    "poppins",
    "pt-sans",
    "public-sans",
    "raleway",
    "red-hat-display",
    "roboto",
    "rubik",
    "schibsted-grotesk",
    "sora",
    "source-sans-3",
    "urbanist",
    "work-sans",
  ]),
  ...candidate("serif", [
    "alegreya",
    "bodoni-moda",
    "brygada-1918",
    "cardo",
    "cormorant-garamond",
    "crimson-pro",
    "crimson-text",
    "dm-serif-display",
    "domine",
    "eb-garamond",
    "faustina",
    "frank-ruhl-libre",
    "fraunces",
    "gelasio",
    "ibm-plex-serif",
    "instrument-serif",
    "libre-baskerville",
    "libre-caslon-text",
    "literata",
    "lora",
    "merriweather",
    "newsreader",
    "noto-serif",
    "petrona",
    "playfair-display",
    "pt-serif",
    "source-serif-4",
    "spectral",
    "vollkorn",
    "young-serif",
  ]),
  ...candidate("slab", [
    "aleo",
    "alfa-slab-one",
    "arvo",
    "bitter",
    "bree-serif",
    "crete-round",
    "hepta-slab",
    "josefin-slab",
    "kreon",
    "noticia-text",
    "patua-one",
    "podkova",
    "roboto-slab",
    "rokkitt",
    "solway",
    "zilla-slab",
  ]),
  ...candidate("display", [
    "abril-fatface",
    "anton",
    "antonio",
    "archivo-black",
    "barlow-condensed",
    "bebas-neue",
    "big-shoulders-display",
    "bricolage-grotesque",
    "cinzel",
    "comfortaa",
    "darker-grotesque",
    "familjen-grotesk",
    "fredoka",
    "league-spartan",
    "oswald",
    "passion-one",
    "space-grotesk",
    "syne",
    "teko",
    "unbounded",
    "yanone-kaffeesatz",
  ]),
];

/**
 * The most asked-for families that reserve their name, weighed whole for sprint 30: every subset of
 * 400 and 700, which is what shipping «the whole face» would mean (ADR 0045 §4). The plan named
 * Montserrat, Poppins and Lato; the survey found that Montserrat and Poppins reserve nothing, so they
 * ship as latin slices like any other row, and the list is the reserved names that remain.
 */
const WHOLE_FACE = new Set(["lato", "raleway", "playfair-display", "lora", "merriweather"]);

/** The weights a row must really have (ADR 0046 §4): 700 for `h1`–`h3`, 400 for the cover's tagline. */
const WEIGHTS = [400, 700] as const;

/**
 * The regular-file entries of a ustar archive that `wanted` asks for, read into memory.
 *
 * npm writes ustar with pax extended headers for long names, so a `x` entry's `path=` applies to the
 * entry after it, and a `prefix` field joins the name otherwise. Nothing else in the format is needed
 * to read a tarball npm produced.
 */
function untar(archive: Uint8Array, wanted: (path: string) => boolean): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;
  let paxPath: string | undefined;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start: number, length: number) => {
      const raw = header.subarray(start, start + length);
      const end = raw.indexOf(0);
      return decoder.decode(end === -1 ? raw : raw.subarray(0, end));
    };
    const size = Number.parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1);
    const prefix = field(345, 155);
    const body = archive.subarray(offset + 512, offset + 512 + size);
    if (type === "x") {
      paxPath = /\d+ path=([^\n]*)\n/.exec(decoder.decode(body))?.[1];
    } else {
      const path = paxPath ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
      paxPath = undefined;
      if ((type === "0" || type === "") && wanted(path)) files.set(path, body.slice());
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const gz = (bytes: Uint8Array | undefined) => (bytes ? gzipSync(bytes).length : 0);
const kb = (bytes: number) => (bytes / 1024).toFixed(1);

interface Row {
  id: string;
  kind: FontKind;
  family: string;
  category: string;
  npmVersion: string;
  googleVersion: string;
  ofl: boolean;
  /** Whether `@fontsource`'s rebuilt line reserves the name — reported, never decisive. */
  packaged: boolean;
  /** The holders' two readings, when google/fonts has the family under `ofl/`. */
  holders: HolderReading | undefined;
  missing: number[];
  named: boolean;
  slugged: boolean;
  regular: number;
  bold: number;
  licence: number;
  whole?: number;
  verdict: string;
}

async function survey(
  entry: Candidate,
  dir: string,
  commit: string,
): Promise<Row | { id: string; error: string }> {
  let stdout: string;
  try {
    ({ stdout } = await run("npm", [
      "pack",
      `@fontsource/${entry.id}`,
      "--pack-destination",
      dir,
      "--json",
      "--ignore-scripts",
      "--loglevel=error",
    ]));
  } catch {
    return { id: entry.id, error: `not published as @fontsource/${entry.id}` };
  }
  const [info] = JSON.parse(stdout) as { filename: string; version: string }[];
  if (!info) return { id: entry.id, error: "npm pack reported nothing" };

  const files = untar(gunzipSync(readFileSync(join(dir, info.filename))), (path) =>
    /^package\/(metadata\.json|LICENSE|files\/[a-z0-9-]+-(400|700)-normal\.woff2)$/.test(path),
  );
  const text = (path: string) => new TextDecoder().decode(files.get(path) ?? new Uint8Array());
  const meta = JSON.parse(text("package/metadata.json") || "{}");
  const licence = text("package/LICENSE");
  const face = (weight: number) =>
    files.get(`package/files/${entry.id}-latin-${weight}-normal.woff2`);

  const ofl =
    meta.license?.type === "OFL-1.1" && licence.includes("SIL OPEN FONT LICENSE Version 1.1");
  const latin = Array.isArray(meta.subsets) && meta.subsets.includes("latin");
  const missing = WEIGHTS.filter(
    (weight) => !latin || !meta.weights?.includes(weight) || face(weight) === undefined,
  );
  const family = String(meta.family ?? "");
  const named = FONT_FAMILY_PATTERN.test(family);
  // Every name the table derives comes from the family, so a package whose id is not the family's
  // slug could not be reached from a row at all.
  const slugged = named && fontFamilySlug(family) === entry.id;

  // The package's line, for the record of how far it is from the holders' (never decisive).
  const packaged =
    reservesPresentedName(copyrightNotice(licence), family) ||
    reservesPresentedName(String(meta.license?.attribution ?? ""), family);
  let holders: HolderReading | undefined;
  let unread: string | undefined;
  if (ofl) {
    try {
      holders = await readHolderLicences(family, commit);
    } catch (error) {
      unread = (error as Error).message;
    }
  }

  const reasons: string[] = [];
  if (!ofl) reasons.push(`licence ${meta.license?.type ?? "unknown"}`);
  if (unread !== undefined) reasons.push(unread);
  const verdict = holders === undefined ? undefined : holderVerdict(holders);
  if (verdict !== undefined) reasons.push(verdict);
  if (missing.length > 0) reasons.push(`no real ${missing.join(" or ")}`);
  if (!named) reasons.push("name not emittable");
  else if (!slugged) reasons.push(`id is not the slug of «${family}»`);

  let whole: number | undefined;
  if (WHOLE_FACE.has(entry.id)) {
    whole = gz(files.get("package/LICENSE"));
    for (const [path, bytes] of files) {
      if (/-(400|700)-normal\.woff2$/.test(path)) whole += gz(bytes);
    }
  }

  return {
    id: entry.id,
    kind: entry.kind,
    family,
    category: String(meta.category ?? "?"),
    npmVersion: info.version,
    googleVersion: String(meta.version ?? "?"),
    ofl,
    packaged,
    holders,
    missing,
    named,
    slugged,
    regular: gz(face(400)),
    bold: gz(face(700)),
    // The licence that would travel: the holders' text, or the package's where there is none.
    licence: gz(holders?.googleFonts.text ?? files.get("package/LICENSE")),
    ...(whole === undefined ? {} : { whole }),
    verdict: reasons.length === 0 ? "admitted" : `out — ${reasons.join("; ")}`,
  };
}

/** A small pool, so sixty downloads take seconds rather than a minute and the registry is not hammered. */
async function pooled<T, R>(items: readonly T[], size: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

const dir = mkdtempSync(join(tmpdir(), "retorika-font-survey-"));
try {
  const commit = await googleFontsCommit();
  const results = await pooled(CANDIDATES, 6, (entry) => survey(entry, dir, commit));
  const rows = results.filter((row): row is Row => "family" in row);
  const yes = (flag: boolean) => (flag ? "yes" : "**no**");
  const reserves = (flag: boolean) => (flag ? "**reserves**" : "no");
  const google = (row: Row) =>
    row.holders === undefined
      ? "—"
      : reserves(reservesPresentedName(row.holders.googleFonts.notice, row.family));
  const author = (row: Row) => {
    const reading = row.holders?.author;
    if (reading === undefined || reading === null) return "—";
    if (!("notice" in reading)) return "not located";
    return reserves(reservesPresentedName(reading.notice, row.family));
  };
  const substitute = (row: Row) =>
    FONT_GALLERY.find((entry) => entry.family === row.family)?.substitute ?? "";

  console.log(`# @fontsource survey, ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Gzipped with \`zlib.gzipSync\`, as \`scripts/size-budget.ts\` weighs. «total» is the latin 400 + 700 + the holders' licence that travels beside them. google/fonts read at ${commit.slice(0, 7)}.\n`,
  );
  for (const kind of ["sans", "serif", "slab", "display"] as const) {
    const ofKind = rows
      .filter((row) => row.kind === kind)
      .sort((a, b) => a.family.localeCompare(b.family));
    const admitted = ofKind.filter((row) => row.verdict === "admitted").length;
    console.log(`\n## ${kind} — ${admitted} admitted of ${ofKind.length}\n`);
    console.log(
      "| family | Google category | OFL 1.1 | google/fonts | author | @fontsource line | latin 400+700 | name | 400 KB | 700 KB | licence KB | total KB | npm | Google | verdict | substitute |",
    );
    console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const row of ofKind) {
      console.log(
        `| ${row.family} | ${row.category} | ${yes(row.ofl)} | ${google(row)} | ${author(row)} | ${reserves(row.packaged)} | ${yes(row.missing.length === 0)} | ${yes(row.named && row.slugged)} | ${kb(row.regular)} | ${kb(row.bold)} | ${kb(row.licence)} | ${kb(row.regular + row.bold + row.licence)} | ${row.npmVersion} | ${row.googleVersion} | ${row.verdict} | ${substitute(row)} |`,
      );
    }
  }

  const wholes = rows.filter((row) => row.whole !== undefined);
  if (wholes.length > 0) {
    console.log("\n## The whole face of the reserved names most asked for (for sprint 30)\n");
    console.log(
      "| family | latin 400+700 + licence KB | every subset of 400+700 + licence KB | difference KB |",
    );
    console.log("|---|---|---|---|");
    for (const row of wholes) {
      const latin = row.regular + row.bold + row.licence;
      console.log(
        `| ${row.family} | ${kb(latin)} | ${kb(row.whole ?? 0)} | +${kb((row.whole ?? 0) - latin)} |`,
      );
    }
  }

  const split = rows.filter((row) => row.verdict.includes("discrepancy"));
  if (split.length > 0) {
    console.log("\n## Out on a discrepancy, with both texts\n");
    for (const row of split) {
      const reading = row.holders;
      const authorNotice =
        reading?.author && "notice" in reading.author ? reading.author.notice : "(not located)";
      console.log(`- **${row.family}**`);
      console.log(
        `  - google/fonts \`${reading?.googleFonts.path}\`: «${reading?.googleFonts.notice}»`,
      );
      console.log(`  - author \`${reading?.author?.repository}\`: «${authorNotice}»`);
    }
  }

  const failed = results.filter((row): row is { id: string; error: string } => "error" in row);
  if (failed.length > 0) {
    console.log("\n## Not surveyed\n");
    for (const { id, error } of failed) console.log(`- \`${id}\`: ${error}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
