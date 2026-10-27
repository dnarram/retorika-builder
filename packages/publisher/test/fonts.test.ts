import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fontFilesFor, render, SHIPPABLE_FAMILIES } from "@retorika/renderer";
import {
  FONT_GALLERY,
  type FontKind,
  flattenElements,
  parseDocument,
  type RetorikaDocument,
} from "@retorika/schema";
import { GALLERY_FAMILIES, withFamily } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { readFontBundle } from "../src/fontBytes.ts";
import { FONT_DATA_KEYS, fontDataFor } from "../src/fontData/index.ts";
import { FONT_SOURCES, licencesFor } from "../src/fonts.ts";
import { copyrightNotice, reservesPresentedName } from "../src/licences.ts";
import { buildSite } from "../src/site.ts";

/**
 * The three conditions this sprint's plan attached to shipping the faces, each with its own test.
 *
 * 1. **Only the weights the pairs use, and only the latin subset.**
 * 2. **Every ZIP with a face carries the OFL text of that face.**
 * 3. **The `woff2` travel exactly as `@fontsource` ships them** — no subsetting, no rewriting.
 *
 * The third used to be explained as a licence requirement: «Playfair Display is published with
 * Reserved Font Name "Playfair Display", and the OFL §3 lets that name travel only with an unmodified
 * face». **That reasoning was wrong and the family is gone** (18 October 2026, ADR 0045): what we
 * ship is the latin slice of four in woff2, which OFL 1.1 calls a Modified Version twice over, so §3
 * applied to us whether or not we subsetted further. Condition 3 survives as what it always was —
 * tidiness, reproducibility, and not inventing a font pipeline — and the licence question is now
 * answered by a filter instead: **no family this product ships may reserve its name**, asserted
 * below over every row rather than argued about one.
 */

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures");
const LICENCES_DIR = join(import.meta.dirname, "..", "licences");

/** What `pnpm fonts:licences` recorded for each family: where each reading came from. */
interface LicenceSource {
  family: string;
  read: string;
  googleFonts: { commit: string; path: string };
  author:
    | { repository: string; commit: string; path: string; notice: string }
    | { repository: string; located: false; reason: string }
    | null;
}

const LICENCE_SOURCES: Record<string, LicenceSource> = JSON.parse(
  readFileSync(join(LICENCES_DIR, "sources.json"), "utf8"),
);

/** Each shipped package once, with the family it carries and the slug its licence is filed under. */
function shippedPackages(): { family: string; pkg: string; slug: string }[] {
  return SHIPPABLE_FAMILIES.map(({ family, faces }) => {
    const pkg = FONT_SOURCES[faces[0]?.file ?? ""]?.package ?? "";
    return { family, pkg, slug: pkg.replace(/^@fontsource\//, "") };
  });
}
const DOCUMENTS_DIR = join(FIXTURES_DIR, "documents");

function corpus(): { name: string; document: RetorikaDocument }[] {
  return readdirSync(DOCUMENTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      name: file.replace(/\.json$/, ""),
      document: parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, file), "utf8"))),
    }));
}

function assetsFor(document: RetorikaDocument): Map<string, Uint8Array> {
  const assets = new Map<string, Uint8Array>();
  for (const page of document.pages) {
    for (const section of page.sections) {
      for (const el of flattenElements(section.content)) {
        if (el.value?.kind !== "image" || el.value.src.startsWith("data:")) continue;
        assets.set(el.value.src, new Uint8Array(readFileSync(join(FIXTURES_DIR, el.value.src))));
      }
    }
  }
  return assets;
}

async function bundleFor(document: RetorikaDocument) {
  return buildSite(document, {
    siteId: "s",
    assets: assetsFor(document),
    fonts: readFontBundle(document),
  });
}

const withHeading = (document: RetorikaDocument, stack: string): RetorikaDocument => ({
  ...document,
  theme: { ...document.theme, "font.heading": stack },
});

const plain = () => {
  const found = corpus().find((entry) => entry.name === "barbershop-cover");
  if (!found) throw new Error("fixture barbershop-cover is missing");
  return found.document;
};

describe("condition 1 — only the weights the pairs use, and only the latin subset", () => {
  it("ships the latin subset and no other", () => {
    for (const [name, source] of Object.entries(FONT_SOURCES)) {
      expect(name, "the key is the file the stylesheet names").toBe(source.file);
      expect(source.file, name).toContain("-latin-");
      // `@fontsource` names every other coverage explicitly, so excluding them by name is exact
      // rather than hopeful.
      for (const other of ["latin-ext", "cyrillic", "greek", "vietnamese"]) {
        expect(source.file.includes(`-${other}-`), `${name} must not be ${other}`).toBe(false);
      }
    }
  });

  it("ships normal only, never an italic the pages cannot ask for", () => {
    // No rule in `build.ts` sets `font-style: italic` for a heading, and `@font-face` declares
    // `font-style: normal`, so an italic file would be bytes nobody could ever see.
    for (const name of Object.keys(FONT_SOURCES)) {
      expect(name).toContain("-normal.woff2");
      expect(name).not.toContain("-italic");
    }
  });

  it("ships exactly the weights the renderer's table declares, and no more", () => {
    const declared = new Set(
      SHIPPABLE_FAMILIES.flatMap(({ faces }) => faces.map((face) => face.file)),
    );
    expect([...declared].sort()).toEqual(Object.keys(FONT_SOURCES).sort());
  });

  it("puts a font in the bundle only when the page asks for one", async () => {
    for (const { name, document } of corpus()) {
      const bundle = await bundleFor(document);
      const faces = bundle.files.filter((file) => file.path.endsWith(".woff2"));
      const asked = fontFilesFor(document);
      expect(faces.map((f) => f.path).sort(), name).toEqual(
        asked.map((file) => `fonts/${file}`).sort(),
      );
    }
  });

  it("gives a site on editorial-serif a bundle with no font bytes at all", async () => {
    const bundle = await bundleFor(plain());
    expect(bundle.files.some((file) => file.path.startsWith("fonts/"))).toBe(false);
    expect(bundle.manifest.fonts).toEqual([]);
  });
});

describe("condition 2 — a face never travels without its licence", () => {
  it("puts the OFL text beside every face, under the names agreed", async () => {
    const bundle = await bundleFor(withHeading(plain(), "'EB Garamond', Georgia, serif"));
    const paths = bundle.files.map((file) => file.path).sort();
    expect(paths).toContain("fonts/OFL-EBGaramond.txt");
    expect(paths).toContain("fonts/eb-garamond-latin-400-normal.woff2");
    expect(paths).toContain("fonts/eb-garamond-latin-700-normal.woff2");
  });

  it("uses the Inter licence for Inter", async () => {
    const bundle = await bundleFor(withHeading(plain(), "Inter, system-ui, sans-serif"));
    expect(bundle.files.map((f) => f.path)).toContain("fonts/OFL-Inter.txt");
  });

  it("carries one licence for a family's two faces, not one per file", async () => {
    const bundle = await bundleFor(withHeading(plain(), "Inter, sans-serif"));
    const licences = bundle.files.filter((file) => file.path.startsWith("fonts/OFL-"));
    expect(licences).toHaveLength(1);
  });

  it("carries four faces and two licences when the two halves are different families", async () => {
    /**
     * **The download gate of the gallery** (ADR 0046, sprint 24 día 6): an owner who sets the
     * headings in one shipped family and the text in another gets both, whole.
     *
     * Built through `withFamily`, the very verb the Estilo panel calls, rather than by writing two
     * stacks here: what is being checked is the road from a click to a ZIP, and a hand-written stack
     * would be checking a copy of it. Two **different** families is the case that could not happen
     * before today — until the gallery, a theme's two tokens came from one pair.
     */
    const theme = withFamily(
      withFamily(plain().theme, "font.heading", "Spectral"),
      "font.body",
      "Figtree",
    );
    const bundle = await bundleFor({ ...plain(), theme });
    const paths = bundle.files.map((file) => file.path).sort();

    expect(paths.filter((path) => path.endsWith(".woff2"))).toEqual([
      "fonts/figtree-latin-400-normal.woff2",
      "fonts/figtree-latin-700-normal.woff2",
      "fonts/spectral-latin-400-normal.woff2",
      "fonts/spectral-latin-700-normal.woff2",
    ]);
    expect(paths.filter((path) => path.startsWith("fonts/OFL-"))).toEqual([
      "fonts/OFL-Figtree.txt",
      "fonts/OFL-Spectral.txt",
    ]);
    // And each licence is the right one: two faces with one family's text beside both would satisfy
    // a count and not the OFL.
    for (const [path, holder] of [
      ["fonts/OFL-Figtree.txt", "Figtree"],
      ["fonts/OFL-Spectral.txt", "Spectral"],
    ] as const) {
      const file = bundle.files.find((candidate) => candidate.path === path);
      expect(new TextDecoder().decode(file?.contents), path).toContain(holder);
    }
  });

  it("brings both halves whole for every pairing an owner could ask for", async () => {
    // Not every pair of the eight — that would be 28 ZIPs — but every family in each role once,
    // against a different one in the other, so no row can be the one that loses its licence.
    for (const [index, { family }] of GALLERY_FAMILIES.entries()) {
      const other = GALLERY_FAMILIES[(index + 1) % GALLERY_FAMILIES.length]?.family ?? "";
      const theme = withFamily(
        withFamily(plain().theme, "font.heading", family),
        "font.body",
        other,
      );
      const bundle = await bundleFor({ ...plain(), theme });
      const paths = bundle.files.map((file) => file.path);
      expect(
        paths.filter((path) => path.endsWith(".woff2")),
        family,
      ).toHaveLength(4);
      expect(
        paths.filter((path) => path.startsWith("fonts/OFL-")),
        family,
      ).toHaveLength(2);
    }
  });

  it("**fails to build a bundle with a face and no licence**", () => {
    // The condition as a refusal rather than a convention. `readFontBundle` derives the licences, so
    // this is what a caller assembling the map by hand would do wrong.
    const doc = withHeading(plain(), "Inter, sans-serif");
    const facesOnly = new Map<string, Uint8Array>([
      ["inter-latin-400-normal.woff2", new Uint8Array([1])],
      ["inter-latin-700-normal.woff2", new Uint8Array([1])],
    ]);
    expect(() => buildSite(doc, { siteId: "s", assets: assetsFor(doc), fonts: facesOnly })).toThrow(
      /missing licence text for "fonts\/OFL-Inter.txt", which a shipped face requires/,
    );
  });

  it("fails to build a bundle whose face bytes are missing", () => {
    const doc = withHeading(plain(), "Inter, sans-serif");
    expect(() => buildSite(doc, { siteId: "s", assets: assetsFor(doc), fonts: new Map() })).toThrow(
      /missing font bytes for "inter-latin-400-normal.woff2"/,
    );
  });

  it("fails loudly rather than quietly when `fonts` is omitted entirely", () => {
    const doc = withHeading(plain(), "Inter, sans-serif");
    expect(() => buildSite(doc, { siteId: "s", assets: assetsFor(doc) })).toThrow(
      /missing font bytes/,
    );
  });

  it("the licence text is the OFL, and says so", async () => {
    const bytes = readFontBundle(withHeading(plain(), "Inter, sans-serif"));
    const text = new TextDecoder().decode(bytes.get("fonts/OFL-Inter.txt"));
    expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(text).toContain("Copyright");
  });

  /**
   * **The filter, as a refusal over every row** (ADR 0045): no family this product ships may present
   * a name its holders reserve.
   *
   * **Read from the holders' texts, never from the package's `LICENSE`.** Until sprint 29 this test
   * read `@fontsource`'s file, whose copyright line is rebuilt from the fonts' name tables — and for
   * Libre Baskerville that rebuilt line drops «with Reserved Font Name Libre Baskerville», which
   * google/fonts' `OFL.txt` declares. The test passed for two sprints over a family it exists to
   * refuse. Now it reads what `pnpm fonts:licences` brought in from google/fonts and from the
   * author's own repository, with the commit each was read at, offline.
   *
   * **Both readings must agree** (David, 27 October 2026): Adobe's `source-serif` reserves «Source»
   * where google/fonts' text for Source Serif 4 does not, and a discrepancy keeps a family out until
   * somebody resolves it.
   *
   * **The reserved name is compared with the presented one**, not the phrase searched for: Bitter's
   * holders reserve «Bitter Pro» and we present «Bitter» — the reading David dated in ADR 0055.
   * **The copyright notice and not the licence body**, because every OFL's own §3 contains the
   * phrase — the mistake made first in sprint 24, and caught before anything was written down.
   */
  it("ships no family whose holders reserve the name it presents, in either reading", () => {
    const packages = shippedPackages();
    expect(packages.length, "the table ships no families at all").toBeGreaterThan(0);

    for (const { family, slug } of packages) {
      const licence = readFileSync(join(LICENCES_DIR, `${slug}.txt`), "utf8");
      expect(licence, `${family} is not under the OFL`).toContain(
        "SIL OPEN FONT LICENSE Version 1.1",
      );
      expect(
        reservesPresentedName(copyrightNotice(licence), family),
        `${family}: google/fonts' licence reserves the name we present`,
      ).toBe(false);

      const author = LICENCE_SOURCES[slug]?.author;
      if (author && "notice" in author) {
        expect(
          reservesPresentedName(author.notice, family),
          `${family}: the author's licence reserves the name we present`,
        ).toBe(false);
      }
    }
  });

  /**
   * **Where every licence came from, so it can be checked by somebody else**: each family has the
   * holders' text beside it and the commit it was read at, and nothing is kept for a family no longer
   * shipped — which is how Libre Baskerville's licence left with it.
   */
  it("keeps the holders' licence of every shipped family, with its commit, and nothing else", () => {
    const slugs = shippedPackages()
      .map(({ slug }) => slug)
      .sort();
    const files = readdirSync(LICENCES_DIR)
      .filter((file) => file.endsWith(".txt"))
      .map((file) => file.slice(0, -".txt".length))
      .sort();
    expect(files).toEqual(slugs);
    expect(Object.keys(LICENCE_SOURCES).sort()).toEqual(slugs);

    for (const { family, slug } of shippedPackages()) {
      const source = LICENCE_SOURCES[slug];
      expect(source?.family, slug).toBe(family);
      expect(source?.googleFonts.commit, `${family}: google/fonts commit`).toMatch(
        /^[0-9a-f]{40}$/,
      );
      expect(source?.googleFonts.path, family).toMatch(/^ofl\/[a-z0-9]+\/OFL\.txt$/);
      const author = source?.author;
      if (author && "commit" in author) {
        expect(author.commit, `${family}: author commit`).toMatch(/^[0-9a-f]{40}$/);
      }
    }
  });

  /**
   * **The four filters of ADR 0046, read from each package's own `metadata.json`** rather than from
   * anything written here. That file declares the family name, the subsets, the weights and the
   * licence — including its copyright line — so it is where the gallery's conditions can be checked
   * against the thing they are conditions about.
   *
   * **It is also the only place a wrong family name can be caught.** The renderer's own test builds a
   * document out of the table's name and selects the row with it, so a row misspelled in both halves
   * looks right there — found by sabotaging one. Here the name is compared against the package.
   */
  it("every row satisfies the gallery's four filters, read from the package", () => {
    const read = createRequire(import.meta.url);
    expect(SHIPPABLE_FAMILIES.length, "the gallery ships no families at all").toBeGreaterThan(0);

    for (const { family, faces } of SHIPPABLE_FAMILIES) {
      // Found through the face the renderer would ask for, which is the same key the ZIP is written
      // by: a row whose files have no source is a row that publishes a name and ships no bytes.
      const pkg = FONT_SOURCES[faces[0]?.file ?? ""]?.package;
      expect(pkg, `${family} is in the renderer's table and in no source`).toBeDefined();
      const meta = JSON.parse(
        readFileSync(join(dirname(read.resolve(`${pkg}/package.json`)), "metadata.json"), "utf8"),
      );

      // 1. The name the renderer emits is the family the package declares — not a near miss, and not
      //    a name we invented. This is the assertion the renderer cannot make about itself.
      expect(meta.family, `${pkg} calls itself ${meta.family}`).toBe(family);
      // 2. The licence is the OFL, from the package's own declaration as well as from its text.
      expect(meta.license?.type, `${pkg} is not declared OFL-1.1`).toBe("OFL-1.1");
      // 3. No Reserved Font Name, on the copyright line the package carries in its attribution.
      expect(
        String(meta.license?.attribution ?? ""),
        `${pkg} declares a Reserved Font Name`,
      ).not.toContain("Reserved Font Name");
      // 4. Latin, and real 400 and 700 — not weights the browser would have to synthesise.
      expect(meta.subsets, `${pkg} has no latin subset`).toContain("latin");
      for (const { weight } of faces) {
        expect(meta.weights, `${pkg} has no real ${weight}`).toContain(weight);
      }
      // And the family name is one the stylesheet can actually emit: `escape.ts`'s pattern admits no
      // apostrophe, no hyphen and no accent, which is why it is a filter and not a preference.
      expect(family, `${family} does not match the pattern a stack may carry`).toMatch(
        /^[A-Za-z][A-Za-z0-9]*(?: [A-Za-z0-9]+)*$/,
      );
    }
  });

  /**
   * **The species against the package's own `category`** (ADR 0055 §2). Google has no slab — it files
   * them as `serif` — and files most headline families as `sans-serif`, so «slab» and «de cartel» are
   * our judgement; what this holds is that the judgement never contradicts the letter's construction.
   * In particular **a headline family must not be a serif**: `GENERIC_OF.display` falls back as a sans,
   * and a serif display would reach a visitor without its face in the wrong species. Cinzel passed the
   * survey and stays out on this test alone.
   */
  it("files every row under a species its own package agrees with", () => {
    const read = createRequire(import.meta.url);
    const agrees: Record<FontKind, readonly string[]> = {
      sans: ["sans-serif"],
      serif: ["serif"],
      slab: ["serif"],
      display: ["display", "sans-serif"],
    };
    for (const { family, kind } of FONT_GALLERY) {
      const pkg = `@fontsource/${family.toLowerCase().replace(/ /g, "-")}`;
      const meta = JSON.parse(
        readFileSync(join(dirname(read.resolve(`${pkg}/package.json`)), "metadata.json"), "utf8"),
      );
      expect(agrees[kind], `${family} is filed as ${kind}; Google says ${meta.category}`).toContain(
        meta.category,
      );
    }
  });

  it("derives the licence list from the faces, so neither can be forgotten", () => {
    expect(licencesFor(["inter-latin-400-normal.woff2"])).toEqual(["fonts/OFL-Inter.txt"]);
    expect(
      licencesFor(["inter-latin-400-normal.woff2", "eb-garamond-latin-700-normal.woff2"]),
    ).toEqual(["fonts/OFL-EBGaramond.txt", "fonts/OFL-Inter.txt"]);
    expect(() => licencesFor(["not-a-face.woff2"])).toThrow(/no source for font file/);
  });
});

/**
 * Whether two byte strings are the same, compared natively.
 *
 * **Not `toEqual`**, which walks a `Uint8Array` element by element: over the twenty-five families of
 * sprint 29 día 2 — fifty faces and twenty-five licences, about 1.3 MB — that took 8.7 s on the CI
 * runner under coverage and timed the test out, where it took 1.3 s here. A diff of binary data says
 * nothing a reader can use anyway; the message beside each assertion names the file.
 */
function sameBytes(actual: Uint8Array | undefined, expected: Uint8Array): boolean {
  if (actual === undefined) return false;
  return Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength).equals(expected);
}

describe("condition 3 — the woff2 travel exactly as the package ships them", () => {
  it("**the generated data is byte-for-byte what the package ships**", () => {
    /**
     * The condition as a check rather than a promise, and the reason `fontData.ts` exists at all.
     *
     * Those bytes are in source because three ways of reading them from `node_modules` each worked in
     * tests and failed inside Next's bundled server runtime (`scripts/generate-font-data.ts` records
     * all three). Carrying them has one obvious hazard — a generated file going stale against a bumped
     * version — and this is the guard: every face and every licence is compared against the package's
     * own file, so `pnpm fonts:generate` being forgotten is a red build and not a silent wrong font.
     */
    const require_ = createRequire(import.meta.url);
    const seen = new Set<string>();
    for (const [name, source] of Object.entries(FONT_SOURCES)) {
      const dir = dirname(require_.resolve(`${source.package}/package.json`));
      const face = readFileSync(join(dir, "files", source.file));
      expect(
        sameBytes(fontDataFor(name), face),
        `${name} must be the package's bytes, unmodified`,
      ).toBe(true);
      if (!seen.has(source.licencePath)) {
        seen.add(source.licencePath);
        const slug = source.package.replace(/^@fontsource\//, "");
        const holders = readFileSync(join(LICENCES_DIR, `${slug}.txt`));
        expect(sameBytes(fontDataFor(source.licencePath), holders), source.licencePath).toBe(true);
        // **And not the package's.** The two texts differ for every family shipped today (measured
        // 27 October 2026), so equality with the holders' file is a statement about which one was read
        // — the sabotage of reading `LICENSE` again goes red here.
        const packaged = readFileSync(join(dir, "LICENSE"));
        expect(
          sameBytes(fontDataFor(source.licencePath), packaged),
          `${source.licencePath} is @fontsource's`,
        ).toBe(false);
      }
    }
    // And nothing else is carried: a key with no source would be bytes nobody can account for.
    expect([...FONT_DATA_KEYS].sort()).toEqual([...Object.keys(FONT_SOURCES), ...seen].sort());
  });

  it("carries the holders' licence in the ZIP, byte for byte, and not the package's", async () => {
    const doc = withHeading(plain(), "Gelasio, Georgia, serif");
    const bundle = await bundleFor(doc);
    const licence = bundle.files.find((file) => file.path === "fonts/OFL-Gelasio.txt");
    expect(licence, "the Gelasio licence is not in the ZIP").toBeDefined();
    expect(licence?.contents).toEqual(
      new Uint8Array(readFileSync(join(LICENCES_DIR, "gelasio.txt"))),
    );
    const dir = dirname(createRequire(import.meta.url).resolve("@fontsource/gelasio/package.json"));
    expect(licence?.contents).not.toEqual(new Uint8Array(readFileSync(join(dir, "LICENSE"))));
  });

  it("is byte-for-byte the file from `@fontsource` by the time it reaches the ZIP", async () => {
    const bundle = await bundleFor(withHeading(plain(), "Inter, sans-serif"));
    for (const file of bundle.files.filter((f) => f.path.endsWith(".woff2"))) {
      const name = file.path.slice("fonts/".length);
      const source = FONT_SOURCES[name];
      expect(source, name).toBeDefined();
      const dir = dirname(
        createRequire(import.meta.url).resolve(`${source?.package}/package.json`),
      );
      const fromPackage = readFileSync(join(dir, "files", source?.file ?? ""));
      expect(
        sameBytes(file.contents, fromPackage),
        `${name} must be the package's bytes, unmodified`,
      ).toBe(true);
    }
  });

  /**
   * **One generated module per package, and none left behind** (ADR 0055). `pnpm fonts:generate`
   * removes the module of a package the table no longer names; read from the directory and not from
   * the index, because an orphan is exactly the file nothing imports.
   */
  it("keeps exactly one generated module per package, and none for a package no longer shipped", () => {
    const modules = readdirSync(join(import.meta.dirname, "..", "src", "fontData"))
      .filter((file) => file.endsWith(".ts") && file !== "index.ts")
      .map((file) => file.slice(0, -".ts".length))
      .sort();
    expect(modules).toEqual(
      shippedPackages()
        .map(({ slug }) => slug)
        .sort(),
    );
  });

  /**
   * **Every package pinned exactly, in this package's manifest and in the root's** — the condition
   * ADR 0046 found broken the first time, when `pnpm install --frozen-lockfile` would have caught it in
   * CI. The publisher's own manifest is what `fonts.test.ts` resolves from; the root's is what
   * `scripts/generate-font-data.ts` resolves from. A range would let a different face in under a
   * licence reading made of another one.
   */
  it("pins every shipped package exactly, in this package's manifest and in the root's", () => {
    const manifest = (path: string) => JSON.parse(readFileSync(path, "utf8"));
    const own = manifest(join(import.meta.dirname, "..", "package.json"));
    const root = manifest(join(import.meta.dirname, "..", "..", "..", "package.json"));
    const rootPins: Record<string, string> = { ...root.dependencies, ...root.devDependencies };
    const packages = shippedPackages()
      .map(({ pkg }) => pkg)
      .sort();

    for (const pkg of packages) {
      const pinned = own.dependencies?.[pkg];
      expect(pinned, `${pkg} is not pinned exactly in packages/publisher`).toMatch(
        /^\d+\.\d+\.\d+$/,
      );
      expect(rootPins[pkg], `${pkg} is pinned differently in the root`).toBe(pinned);
    }
    // And nothing declared that the table does not ship: a stray face package is bytes nobody reads.
    const fontsource = (deps: Record<string, string>) =>
      Object.keys(deps)
        .filter((name) => name.startsWith("@fontsource/"))
        .sort();
    expect(fontsource(own.dependencies)).toEqual(packages);
    expect(fontsource(rootPins)).toEqual(packages);
  });

  it("keeps the package's own file name, so the ZIP says what it carries", () => {
    // `inter-latin-400-normal.woff2`, not a tidier name of ours: a reader can check the file against
    // the package without trusting anything written here.
    for (const [name, source] of Object.entries(FONT_SOURCES)) expect(name).toBe(source.file);
  });

  it("declares it is a woff2, and nothing else is shipped as one", async () => {
    const bundle = await bundleFor(withHeading(plain(), "Inter, sans-serif"));
    for (const file of bundle.files) {
      if (file.path.endsWith(".woff2")) {
        expect(file.contentType).toBe("font/woff2");
        // The woff2 signature, so a mislabelled or truncated file is caught here rather than by a
        // browser that silently falls back.
        expect([...file.contents.slice(0, 4)]).toEqual([0x77, 0x4f, 0x46, 0x32]); // "wOF2"
      } else {
        expect(file.contentType).not.toBe("font/woff2");
      }
    }
  });
});

describe("the bundle and the stylesheet agree", () => {
  it("names in the CSS exactly the faces the bundle carries", async () => {
    const doc = withHeading(plain(), "Inter, sans-serif");
    const bundle = await bundleFor(doc);
    const css = render(doc, "html").css;
    const carried = bundle.files
      .filter((file) => file.path.endsWith(".woff2"))
      .map((file) => file.path);
    expect(carried.length).toBeGreaterThan(0);
    for (const path of carried) expect(css).toContain(`url("${path}")`);
    // And nothing the bundle does not carry.
    for (const match of css.matchAll(/url\("(fonts\/[^"]+)"\)/g)) {
      expect(carried, `the CSS names ${match[1]}`).toContain(match[1]);
    }
  });

  it("refuses a face the product does not ship, however it got into the theme", () => {
    // `fontFilesFor` would not report it, so this is the publisher's own floor rather than a
    // duplicate of the renderer's — a hand-assembled `fonts` map cannot smuggle a file in.
    expect(() => licencesFor(["geist-latin-400-normal.woff2"])).toThrow(/no source for font file/);
  });

  it("lists the fonts in the manifest, so `serve` can route them", async () => {
    const bundle = await bundleFor(withHeading(plain(), "Inter, sans-serif"));
    expect(bundle.manifest.fonts).toEqual([
      "fonts/OFL-Inter.txt",
      "fonts/inter-latin-400-normal.woff2",
      "fonts/inter-latin-700-normal.woff2",
    ]);
  });
});
