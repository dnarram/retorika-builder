import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fontFilesFor, render, SHIPPABLE_FAMILIES } from "@retorika/renderer";
import { flattenElements, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { readFontBundle } from "../src/fontBytes.ts";
import { FONT_DATA_KEYS, fontDataFor } from "../src/fontData.ts";
import { FONT_SOURCES, licencesFor } from "../src/fonts.ts";
import { buildSite } from "../src/site.ts";

/**
 * The three conditions this sprint's plan attached to shipping the faces, each with its own test.
 *
 * 1. **Only the weights the pairs use, and only the latin subset.**
 * 2. **Every ZIP with a face carries the OFL text of that face.**
 * 3. **The `woff2` travel exactly as `@fontsource` ships them** — no subsetting, no rewriting.
 *
 * The third is also a licence requirement rather than only tidiness, which is the part worth knowing:
 * Playfair Display is published **with Reserved Font Name "Playfair Display"**, and the OFL §3 lets
 * that name travel only with an unmodified face. Subsetting would force a rename, in the renderer's
 * table, in the theme stacks and in the editor's specimen.
 */

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures");
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
    const bundle = await bundleFor(withHeading(plain(), "'Playfair Display', Georgia, serif"));
    const paths = bundle.files.map((file) => file.path).sort();
    expect(paths).toContain("fonts/OFL-PlayfairDisplay.txt");
    expect(paths).toContain("fonts/playfair-display-latin-400-normal.woff2");
    expect(paths).toContain("fonts/playfair-display-latin-700-normal.woff2");
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

  it("records that Playfair Display reserves its name and Inter does not", async () => {
    /**
     * The thing worth knowing about these two licences, and the reason condition 3 is a licence
     * matter: the OFL §3 forbids using a Reserved Font Name for a **Modified Version**. Shipping the
     * file unchanged is what lets the family keep the name the theme stacks, the renderer's table and
     * the editor's specimen all spell.
     */
    const bytes = readFontBundle(
      withHeading(
        { ...plain(), theme: { ...plain().theme, "font.body": "Inter, sans-serif" } },
        "'Playfair Display', serif",
      ),
    );
    const playfair = new TextDecoder().decode(bytes.get("fonts/OFL-PlayfairDisplay.txt"));
    const inter = new TextDecoder().decode(bytes.get("fonts/OFL-Inter.txt"));

    expect(playfair).toContain('with Reserved Font Name "Playfair Display"');
    // Inter's copyright line declares none. The phrase still appears further down, because the OFL's
    // own definitions section explains the term — so the assertion is about the copyright line.
    const interCopyright = inter.slice(0, inter.indexOf("This Font Software is licensed"));
    expect(interCopyright).not.toContain("Reserved Font Name");
  });

  it("derives the licence list from the faces, so neither can be forgotten", () => {
    expect(licencesFor(["inter-latin-400-normal.woff2"])).toEqual(["fonts/OFL-Inter.txt"]);
    expect(
      licencesFor(["inter-latin-400-normal.woff2", "playfair-display-latin-700-normal.woff2"]),
    ).toEqual(["fonts/OFL-Inter.txt", "fonts/OFL-PlayfairDisplay.txt"]);
    expect(() => licencesFor(["not-a-face.woff2"])).toThrow(/no source for font file/);
  });
});

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
      const face = new Uint8Array(readFileSync(join(dir, "files", source.file)));
      expect(fontDataFor(name), `${name} must be the package's bytes, unmodified`).toEqual(face);
      if (!seen.has(source.licencePath)) {
        seen.add(source.licencePath);
        const licence = new Uint8Array(readFileSync(join(dir, "LICENSE")));
        expect(fontDataFor(source.licencePath), source.licencePath).toEqual(licence);
      }
    }
    // And nothing else is carried: a key with no source would be bytes nobody can account for.
    expect([...FONT_DATA_KEYS].sort()).toEqual([...Object.keys(FONT_SOURCES), ...seen].sort());
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
      const fromPackage = new Uint8Array(readFileSync(join(dir, "files", source?.file ?? "")));
      expect(file.contents, `${name} must be the package's bytes, unmodified`).toEqual(fromPackage);
    }
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
