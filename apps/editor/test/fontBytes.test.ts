import { OWN_FACE_TYPES } from "@retorika/publisher";
import { FONT_GALLERY } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  FONT_MEDIA_TYPES,
  freeFamilyName,
  sanitiseFamily,
  sniffFont,
  sniffLicence,
} from "../src/editor/fontBytes.ts";

const bytes = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0));

describe("sniffFont", () => {
  it.each([
    ["wOF2\0\x01\0\0", "woff2"],
    ["wOF2OTTO", "woff2"],
    ["wOFF\0\x01\0\0", "woff"],
    ["\0\x01\0\0\0\x0c", "ttf"],
    ["true\0\x0c", "ttf"],
    ["OTTO\0\x0c", "otf"],
    ["ttcf\0\x01", "collection"],
    ["wOF2ttcf", "collection"],
    ["wOFFttcf", "collection"],
    ["<svg>", "markup"],
    ["\xef\xbb\xbf\n <?xml", "markup"],
    ["%PDF-1.7", "unknown"],
    ["", "unknown"],
  ])("reads %j as %s", (head, kind) => {
    expect(sniffFont(bytes(head))).toBe(kind);
  });
});

describe("sniffLicence", () => {
  it("reads a PDF by its first bytes and a text by being UTF-8 with no NUL", () => {
    expect(sniffLicence(bytes("%PDF-1.4\n%âãÏÓ"))).toBe("pdf");
    expect(sniffLicence(new TextEncoder().encode("SIL OPEN FONT LICENSE — Versión 1.1"))).toBe(
      "txt",
    );
  });

  it("refuses a binary renamed .txt and invalid UTF-8", () => {
    expect(sniffLicence(bytes("wOF2\0\x01\0\0"))).toBeNull();
    expect(sniffLicence(Uint8Array.of(0x41, 0xc3, 0x28))).toBeNull();
  });
});

describe("sanitiseFamily", () => {
  it.each([
    ["Casa Trufa Sans", "Casa Trufa Sans"],
    ["Señorío Display", "Senorio Display"],
    ["  Brand_Sans-Pro  ", "Brand Sans Pro"],
    ["8bit Wonder", "bit Wonder"],
    [".New York", "New York"],
    ["你好", ""],
    ["../evil", "evil"],
  ])("makes %j into %j", (name, family) => {
    expect(sanitiseFamily(name)).toBe(family);
  });

  it("keeps whole words within the schema's 64 characters", () => {
    const long = sanitiseFamily(`${"Palabra ".repeat(12)}Final`);
    expect(long.length).toBeLessThanOrEqual(64);
    expect(long.endsWith("Palabra")).toBe(true);
  });
});

describe("freeFamilyName", () => {
  it("keeps a free name as it is", () => {
    expect(freeFamilyName("Casa Trufa")).toBe("Casa Trufa");
  });

  it("gives a gallery family's name a numeral, case-insensitively — the corpus fixture's «Karla 2»", () => {
    expect(FONT_GALLERY.some((row) => row.family === "Karla")).toBe(true);
    expect(freeFamilyName("Karla")).toBe("Karla 2");
    expect(freeFamilyName("karla")).toBe("karla 2");
  });

  it("counts past the names the document's own fonts already hold", () => {
    expect(freeFamilyName("Karla", [{ family: "Karla 2" }])).toBe("Karla 3");
    expect(freeFamilyName("Marca", [{ family: "marca" }])).toBe("Marca 2");
  });

  it("gives a CSS keyword a numeral too", () => {
    expect(freeFamilyName("Serif")).toBe("Serif 2");
  });
});

describe("the media type of a face", () => {
  it("is the publisher's own table, so a face is stored and bundled under one type", () => {
    expect(FONT_MEDIA_TYPES).toEqual(OWN_FACE_TYPES);
  });
});
