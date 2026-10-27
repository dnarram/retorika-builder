import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { copyrightNotice, reservesPresentedName } from "../packages/publisher/src/licences.ts";

/**
 * Brings each shipped family's licence into the repository **from its holders**, with the commit it
 * was read at (ADR 0045, amended sprint 29). `pnpm fonts:licences [--refresh]`.
 *
 * **Why not the `LICENSE` inside `@fontsource`.** That file rebuilds its copyright line from the fonts'
 * own name tables, and for ten of the ninety-two families surveyed on 27 October 2026 the rebuilt
 * line drops the Reserved Font Name the holder declares. Libre Baskerville was one, and shipped for
 * two sprints because the filter read that line. The licence that travels in a client's ZIP is now
 * the one google/fonts distributes beside the very files `@fontsource` repackages, byte for byte.
 *
 * **Two readings, and a family needs both** (David, 27 October 2026). google/fonts' `ofl/<dir>/OFL.txt`
 * is the text that travels; the licence in the author's own repository — named by the
 * `repository_url` google/fonts records in `METADATA.pb` — is read as well, because the two can
 * disagree: Adobe's `source-serif` reserves «Source» where google/fonts' `sourceserif4/OFL.txt` does
 * not. A family is written here only when **neither** reading reserves the name we present. Where the
 * author's licence cannot be located, google/fonts' reading stands alone, and `sources.json` says so.
 *
 * **Reproducible without the network.** Every reading records the commit it was taken at —
 * google/fonts' `main` from `git ls-remote`, and the author's `HEAD` the same way — so the bytes in
 * `packages/publisher/licences/` can be checked against their source by anybody, and the tests read
 * them offline. The script never runs anything it downloads.
 *
 * By default it reads only the families that have no licence yet and removes the licences of families
 * no longer shipped, so an existing reading keeps its date and commit; `--refresh` reads them all again.
 */

const run = promisify(execFile);

const GOOGLE_FONTS = "https://github.com/google/fonts";

/** Where google/fonts keeps a family: its name, lower-cased, without spaces, under `ofl/`. */
const googleFontsDir = (family: string) => family.toLowerCase().replaceAll(" ", "");

/** The names authors give the licence at the root of their repository, in the order tried. */
const AUTHOR_LICENCE_FILES = [
  "OFL.txt",
  "ofl.txt",
  "LICENSE.txt",
  "LICENSE",
  "LICENSE.md",
  "OFL.md",
  "OFL",
  "LICENCE.txt",
  "LICENCE",
  "License.txt",
  "license.txt",
];

export interface AuthorReading {
  repository: string;
  commit: string;
  path: string;
  notice: string;
}

export interface HolderReading {
  family: string;
  googleFonts: { commit: string; path: string; text: Uint8Array; notice: string };
  /** `null` when google/fonts names no repository; `located: false` when it names one we could not
   * read a licence from. */
  author: AuthorReading | { repository: string; located: false; reason: string } | null;
}

/** The commit a remote's ref points at, read with `git ls-remote` — no API, no rate limit. */
async function remoteCommit(repository: string, ref: string): Promise<string> {
  const { stdout } = await run("git", ["ls-remote", repository, ref], { timeout: 30_000 });
  const commit = stdout.split(/\s/)[0] ?? "";
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`no commit for ${ref} in ${repository}`);
  return commit;
}

/** google/fonts' `main`, read once per run so every licence of one run names the same commit. */
export const googleFontsCommit = () => remoteCommit(GOOGLE_FONTS, "refs/heads/main");

async function fetchBytes(url: string): Promise<Uint8Array | undefined> {
  const response = await fetch(url);
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** The raw URL of a file at a commit, for the two hosts the surveyed families live on. */
function rawUrl(repository: string, commit: string, path: string): string | undefined {
  const github = /^https:\/\/github\.com\/([^/]+\/[^/]+)$/.exec(repository);
  if (github) return `https://raw.githubusercontent.com/${github[1]}/${commit}/${path}`;
  if (repository.startsWith("https://gitlab.com/")) return `${repository}/-/raw/${commit}/${path}`;
  return undefined;
}

/**
 * Where in a GitHub repository its licence lives when the root has none — `googlefonts/dm-fonts`
 * keeps one per family, `Sans/OFL.txt` and `Serif/OFL.txt`. Read from the tree at the commit, and of
 * several, the one whose path names a word of the family, then the shallowest.
 *
 * The one call to GitHub's API in this script, made only for a repository whose root the plain names
 * missed. Unauthenticated, GitHub allows sixty an hour, which the table never reaches and the survey's
 * hundred candidates can: so a refusal says so rather than passing for «no licence», and a
 * `GITHUB_TOKEN` in the environment, when there is one, raises the limit.
 */
async function licenceInTree(repository: string, commit: string, family: string) {
  const github = /^https:\/\/github\.com\/([^/]+\/[^/]+)$/.exec(repository);
  if (!github) return undefined;
  const token = process.env["GITHUB_TOKEN"];
  const response = await fetch(
    `https://api.github.com/repos/${github[1]}/git/trees/${commit}?recursive=1`,
    token ? { headers: { authorization: `Bearer ${token}` } } : undefined,
  );
  if (response.status === 403 || response.status === 429) {
    throw new Error("GitHub's API refused the tree (rate limit); set GITHUB_TOKEN and read again");
  }
  if (!response.ok) return undefined;
  const { tree } = (await response.json()) as { tree: { path: string; type: string }[] };
  const familyWords = family.toLowerCase().split(" ");
  const named = (path: string) =>
    path
      .toLowerCase()
      .split("/")
      .slice(0, -1)
      .some((part) => familyWords.includes(part));
  return tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => /^(ofl|licen[cs]e)(\.(txt|md))?$/i.test(path.split("/").at(-1) ?? ""))
    .sort(
      (a, b) => Number(named(b)) - Number(named(a)) || a.split("/").length - b.split("/").length,
    )
    .at(0);
}

async function readAuthor(repository: string, family: string): Promise<HolderReading["author"]> {
  let commit: string;
  try {
    commit = await remoteCommit(repository, "HEAD");
  } catch (error) {
    return { repository, located: false, reason: (error as Error).message };
  }
  const read = async (path: string) => {
    const url = rawUrl(repository, commit, path);
    if (url === undefined) throw new Error("host not supported");
    return fetchBytes(url);
  };
  try {
    for (const path of AUTHOR_LICENCE_FILES) {
      const bytes = await read(path);
      if (bytes !== undefined) {
        return {
          repository,
          commit,
          path,
          notice: copyrightNotice(new TextDecoder().decode(bytes)),
        };
      }
    }
    const nested = await licenceInTree(repository, commit, family);
    const bytes = nested === undefined ? undefined : await read(nested);
    if (nested !== undefined && bytes !== undefined) {
      return {
        repository,
        commit,
        path: nested,
        notice: copyrightNotice(new TextDecoder().decode(bytes)),
      };
    }
  } catch (error) {
    return { repository, located: false, reason: (error as Error).message };
  }
  return { repository, located: false, reason: "no licence file in the repository" };
}

/** Both readings of one family's licence, at google/fonts' `commit`. */
export async function readHolderLicences(family: string, commit: string): Promise<HolderReading> {
  const dir = `ofl/${googleFontsDir(family)}`;
  const text = await fetchBytes(
    `https://raw.githubusercontent.com/google/fonts/${commit}/${dir}/OFL.txt`,
  );
  if (text === undefined) throw new Error(`${family}: google/fonts has no ${dir}/OFL.txt`);
  const metadata = await fetchBytes(
    `https://raw.githubusercontent.com/google/fonts/${commit}/${dir}/METADATA.pb`,
  );
  const repository = /repository_url:\s*"([^"]+)"/
    .exec(new TextDecoder().decode(metadata ?? new Uint8Array()))?.[1]
    ?.replace(/\.git$/, "")
    .replace(/\/+$/, "")
    .replace("://www.github.com/", "://github.com/");
  return {
    family,
    googleFonts: {
      commit,
      path: `${dir}/OFL.txt`,
      text,
      notice: copyrightNotice(new TextDecoder().decode(text)),
    },
    author: repository === undefined ? null : await readAuthor(repository, family),
  };
}

/**
 * Why a reading keeps a family out, or `undefined` when it may enter.
 *
 * Where the author's licence was located, the two readings must agree; where it was not, google/fonts'
 * reading stands alone — a missing second text is not a discrepancy.
 */
export function holderVerdict(reading: HolderReading): string | undefined {
  const google = reservesPresentedName(reading.googleFonts.notice, reading.family);
  if (reading.author === null || !("notice" in reading.author)) {
    return google ? "Reserved Font Name" : undefined;
  }
  const author = reservesPresentedName(reading.author.notice, reading.family);
  if (google && author) return "Reserved Font Name";
  if (google !== author) return "discrepancy between google/fonts and the author's licence";
  return undefined;
}

async function main() {
  const { SHIPPABLE_FAMILIES } = await import("../packages/renderer/src/fonts.ts");
  const { FONT_SOURCES } = await import("../packages/publisher/src/fonts.ts");
  const refresh = process.argv.includes("--refresh");
  const out = join(import.meta.dirname, "..", "packages", "publisher", "licences");
  const sourcesPath = join(out, "sources.json");
  mkdirSync(out, { recursive: true });
  const previous: Record<string, unknown> = existsSync(sourcesPath)
    ? JSON.parse(readFileSync(sourcesPath, "utf8"))
    : {};

  const shipped = SHIPPABLE_FAMILIES.map(({ family, faces }) => {
    const pkg = FONT_SOURCES[faces[0]?.file ?? ""]?.package;
    if (pkg === undefined) throw new Error(`${family} has no source in FONT_SOURCES`);
    return { family, slug: pkg.replace(/^@fontsource\//, "") };
  });

  const commit = await googleFontsCommit();
  const sources: Record<string, unknown> = {};
  const refused: string[] = [];
  for (const { family, slug } of shipped) {
    if (!refresh && previous[slug] !== undefined && existsSync(join(out, `${slug}.txt`))) {
      sources[slug] = previous[slug];
      continue;
    }
    const reading = await readHolderLicences(family, commit);
    const verdict = holderVerdict(reading);
    if (verdict !== undefined) {
      refused.push(`${family}: ${verdict}`);
      continue;
    }
    writeFileSync(join(out, `${slug}.txt`), reading.googleFonts.text);
    // The text is the file beside this entry and its notice is read from it, so neither is repeated.
    const { commit: read, path } = reading.googleFonts;
    sources[slug] = {
      family,
      read: new Date().toISOString().slice(0, 10),
      googleFonts: { commit: read, path },
      author: reading.author,
    };
    console.log(`fonts:licences: read ${family} at google/fonts ${commit.slice(0, 7)}`);
  }

  // The directory is this script's: a licence for a family no longer shipped is removed with it.
  for (const file of readdirSync(out)) {
    if (file.endsWith(".txt") && sources[file.slice(0, -".txt".length)] === undefined) {
      rmSync(join(out, file));
      console.log(`fonts:licences: removed ${file}, no longer shipped`);
    }
  }
  const sorted = Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(sourcesPath, `${JSON.stringify(sorted, null, 2)}\n`);

  if (refused.length > 0) {
    console.error(`fonts:licences: refused, and not written:\n  ${refused.join("\n  ")}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
