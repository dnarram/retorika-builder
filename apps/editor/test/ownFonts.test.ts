import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ownFontKeysFor, ownLicencePath } from "@retorika/publisher";
import { OWN_FONT_ID_PATTERN, type OwnFont, parseDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { fontFileType, mintFontId, ownFontFiles } from "../src/editor/ownFonts.ts";

/**
 * The names the browser stores an owner's font under, which are also the names `/api/download`
 * receives it under — so they are checked here against the publisher's own, the second source.
 */

const DOC = parseDocument(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../../fixtures/documents/letra-propia.json", import.meta.url)),
      "utf8",
    ),
  ),
);
const KARLA_2 = DOC.fonts?.[0] as OwnFont;

describe("ownFontFiles", () => {
  it("names the faces and the licence as the publisher asks for them, the licence without fonts/", () => {
    const { faces, licence } = ownFontFiles(KARLA_2);
    expect(faces).toEqual(["propia-3f9a7c21-regular.woff2", "propia-3f9a7c21-bold.woff"]);
    expect(`fonts/${licence}`).toBe(ownLicencePath(KARLA_2));
    // Every key the publisher wants for this document, and nothing it does not.
    expect([...faces, `fonts/${licence}`].sort()).toEqual([...ownFontKeysFor(DOC)].sort());
  });

  it("has no licence file for a font whose owner attached none", () => {
    const { licenceFile: _, ...bare } = KARLA_2;
    expect(ownFontFiles(bare).licence).toBeUndefined();
  });
});

describe("fontFileType", () => {
  it("types a stored file by the name this product minted", () => {
    expect(fontFileType("propia-3f9a7c21-regular.woff2")).toBe("font/woff2");
    expect(fontFileType("propia-3f9a7c21-bold.woff")).toBe("font/woff");
    expect(fontFileType("propia-3f9a7c21-variable.ttf")).toBe("font/ttf");
    expect(fontFileType("LICENCIA-propia-3f9a7c21.pdf")).toBe("application/pdf");
    expect(fontFileType("LICENCIA-propia-3f9a7c21.txt")).toBe("text/plain");
  });

  it("refuses a name it did not mint, whatever its extension", () => {
    for (const file of [
      "Karla-Regular.woff2",
      "propia-3f9a7c21-regular.svg",
      "../propia-3f9a7c21-bold.woff",
    ]) {
      expect(() => fontFileType(file)).toThrow(/not a name this product mints/);
    }
  });
});

describe("mintFontId", () => {
  it("is eight lower-case hex digits that the document does not already use", () => {
    const id = mintFontId([KARLA_2]);
    expect(id).toMatch(OWN_FONT_ID_PATTERN);
    expect(id).not.toBe(KARLA_2.id);
  });
});
