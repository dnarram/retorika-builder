import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@retorika/renderer";
import { type OwnFont, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { readFontBundle } from "../src/fontBytes.ts";
import { OWN_FACE_TYPES, ownFontKeysFor, ownLicencePath } from "../src/fonts.ts";
import { buildSite } from "../src/site.ts";
import { fixtureFontBundle } from "./fixtureFonts.ts";

/**
 * A font the owner brought, in the bundle (ADR 0056 §6): it travels as it was uploaded, with the
 * licence they attached and no OFL, and a bundle refuses to carry one without the owner's
 * declaration — checked by the publisher itself, not only by the parser.
 */

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures");

const fixture = (): RetorikaDocument =>
  parseDocument(
    JSON.parse(readFileSync(join(FIXTURES_DIR, "documents", "letra-propia.json"), "utf8")),
  );

const assetsFor = (document: RetorikaDocument): Map<string, Uint8Array> => {
  const assets = new Map<string, Uint8Array>();
  for (const page of document.pages) {
    for (const section of page.sections) {
      for (const el of section.content) {
        if (el.value?.kind !== "image" || el.value.src.startsWith("data:")) continue;
        assets.set(el.value.src, new Uint8Array(readFileSync(join(FIXTURES_DIR, el.value.src))));
      }
    }
  }
  return assets;
};

const bundleFor = (document: RetorikaDocument, fonts = fixtureFontBundle(document)) =>
  buildSite(document, { siteId: "propia", assets: assetsFor(document), fonts });

describe("an owner's own font in the bundle", () => {
  it("lists the keys the caller must supply: each face by file, the licence by path", () => {
    expect(ownFontKeysFor(fixture())).toEqual([
      "propia-3f9a7c21-regular.woff2",
      "propia-3f9a7c21-bold.woff",
      "fonts/LICENCIA-propia-3f9a7c21.txt",
    ]);
    // And `readFontBundle` has none of them: those bytes are the owner's, not a package's.
    const shipped = readFontBundle(fixture());
    expect([...shipped.keys()].sort()).toEqual([
      "fonts/OFL-Gelasio.txt",
      "gelasio-latin-400-normal.woff2",
      "gelasio-latin-700-normal.woff2",
    ]);
  });

  it("sends the own faces without an OFL beside them, because there is none to send", async () => {
    const bundle = bundleFor(fixture());
    const paths = bundle.files.map((file) => file.path);
    expect(paths.filter((path) => path.startsWith("fonts/"))).toEqual([
      "fonts/LICENCIA-propia-3f9a7c21.txt",
      "fonts/OFL-Gelasio.txt",
      "fonts/gelasio-latin-400-normal.woff2",
      "fonts/gelasio-latin-700-normal.woff2",
      "fonts/propia-3f9a7c21-bold.woff",
      "fonts/propia-3f9a7c21-regular.woff2",
    ]);
    expect(paths.filter((path) => path.includes("OFL"))).toEqual(["fonts/OFL-Gelasio.txt"]);
  });

  it("writes each face with the media type of the format the record declares, bytes untouched", () => {
    const bundle = bundleFor(fixture());
    const byPath = new Map(bundle.files.map((file) => [file.path, file]));
    const regular = byPath.get("fonts/propia-3f9a7c21-regular.woff2");
    const bold = byPath.get("fonts/propia-3f9a7c21-bold.woff");
    const licence = byPath.get("fonts/LICENCIA-propia-3f9a7c21.txt");
    expect(regular?.contentType).toBe("font/woff2");
    expect([...(regular?.contents.slice(0, 4) ?? [])]).toEqual([0x77, 0x4f, 0x46, 0x32]); // wOF2
    expect(bold?.contentType).toBe("font/woff");
    expect([...(bold?.contents.slice(0, 4) ?? [])]).toEqual([0x77, 0x4f, 0x46, 0x46]); // wOFF
    expect(licence?.contentType).toBe("text/plain; charset=utf-8");
    expect(new TextDecoder().decode(licence?.contents)).toContain("SIL Open Font License");
    expect(OWN_FACE_TYPES).toEqual({
      woff2: "font/woff2",
      woff: "font/woff",
      ttf: "font/ttf",
      otf: "font/otf",
    });
  });

  it("names in the CSS exactly the own faces the bundle carries", () => {
    const document = fixture();
    const css = render(document, "html").css;
    const carried = bundleFor(document)
      .files.map((file) => file.path)
      .filter((path) => path.startsWith("fonts/propia-"));
    expect(carried).toHaveLength(2);
    for (const path of carried) expect(css).toContain(`url("${path}")`);
    for (const match of css.matchAll(/url\("(fonts\/propia-[^"]+)"\)/g)) {
      expect(carried, `the CSS names ${match[1]}`).toContain(match[1]);
    }
  });

  it("lists the own faces and the attached licence in the manifest", () => {
    expect(bundleFor(fixture()).manifest.fonts).toEqual([
      "fonts/LICENCIA-propia-3f9a7c21.txt",
      "fonts/OFL-Gelasio.txt",
      "fonts/gelasio-latin-400-normal.woff2",
      "fonts/gelasio-latin-700-normal.woff2",
      "fonts/propia-3f9a7c21-bold.woff",
      "fonts/propia-3f9a7c21-regular.woff2",
    ]);
  });

  it("refuses a bundle whose own face was handed no bytes", () => {
    const document = fixture();
    const fonts = fixtureFontBundle(document);
    fonts.delete("propia-3f9a7c21-bold.woff");
    expect(() => bundleFor(document, fonts)).toThrow(
      /missing the owner's font bytes for "propia-3f9a7c21-bold.woff"/,
    );
  });

  it("refuses a bundle that lost the licence the owner attached", () => {
    const document = fixture();
    const fonts = fixtureFontBundle(document);
    fonts.delete("fonts/LICENCIA-propia-3f9a7c21.txt");
    expect(() => bundleFor(document, fonts)).toThrow(/missing the licence the owner attached/);
    // Without the attachment in the record there is nothing to require, and nothing is written.
    const detached: RetorikaDocument = {
      ...document,
      fonts: document.fonts?.map(({ licenceFile: _file, ...font }) => font),
    };
    expect(ownLicencePath({ id: "3f9a7c21" })).toBeUndefined();
    const paths = bundleFor(detached, fonts).files.map((file) => file.path);
    expect(paths.some((path) => path.includes("LICENCIA"))).toBe(false);
  });

  it("refuses a bundle whose own font carries no declaration, however the document was built", () => {
    // Hand-assembled, never through `parseDocument`, which would have refused it first: the
    // publisher's check is its own, for a document that reached it some other way.
    const document = fixture();
    const undeclared = document.fonts?.map(
      (font) =>
        ({ ...font, licence: { declared: false, at: font.licence.at } }) as unknown as OwnFont,
    );
    expect(() => bundleFor({ ...document, fonts: undeclared })).toThrow(
      /carries no licence declaration, so it cannot be published/,
    );
    const missing = document.fonts?.map(
      (font) => ({ ...font, licence: undefined }) as unknown as OwnFont,
    );
    expect(() => bundleFor({ ...document, fonts: missing })).toThrow(/no licence declaration/);
  });

  it("refuses a font file the page asks for that neither the table nor the record accounts for", () => {
    // Reached by hand: the renderer only ever names files it derived, so this is the floor under
    // a `fonts` map or a render output that disagrees with the record.
    const document = fixture();
    const stripped: RetorikaDocument = { ...document, fonts: [] };
    // With no record the stack names nothing shippable and the bundle is simply lighter.
    const paths = bundleFor(stripped, readFontBundle(stripped)).files.map((file) => file.path);
    expect(paths.some((path) => path.includes("propia"))).toBe(false);
  });

  it("ships nothing of an own font no stack names", () => {
    const document = fixture();
    const spare: OwnFont = {
      id: "0a1b2c3d",
      family: "Letra de Reserva",
      kind: "serif",
      faces: [{ role: "regular", format: "otf" }],
      licence: { declared: true, at: "2026-10-27T18:00:00Z" },
      licenceFile: "pdf",
    };
    const withSpare = parseDocument({ ...document, fonts: [...(document.fonts ?? []), spare] });
    expect(ownFontKeysFor(withSpare)).toEqual(ownFontKeysFor(document));
    const paths = bundleFor(withSpare).files.map((file) => file.path);
    expect(paths.some((path) => path.includes("0a1b2c3d"))).toBe(false);
  });
});
