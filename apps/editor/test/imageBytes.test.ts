import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  extensionFor,
  isAcceptedImage,
  sniffImage,
} from "../src/editor/imageBytes.ts";

/**
 * What an upload is, decided by its own first bytes (ADR 0018). These are the only checks
 * standing between a file someone chose and a file inside a stranger's ZIP, so they are written
 * against hostile inputs rather than tidy ones.
 */

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") flat.push(...[...part].map((c) => c.charCodeAt(0)));
    else flat.push(...part);
  }
  return new Uint8Array(flat);
}

const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF");
const PNG = bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = bytes("RIFF", [0x24, 0x00, 0x00, 0x00], "WEBPVP8 ");
const HEIC = bytes([0x00, 0x00, 0x00, 0x18], "ftypheic");

describe("sniffImage", () => {
  it("recognises a JPEG", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
  });

  it("recognises a PNG", () => {
    expect(sniffImage(PNG)).toBe("image/png");
  });

  it("recognises a WebP by its RIFF container and its form type", () => {
    // "RIFF" alone is not enough — a WAV starts the same way and differs only at offset 8.
    expect(sniffImage(WEBP)).toBe("image/webp");
    expect(sniffImage(bytes("RIFF", [0x24, 0x00, 0x00, 0x00], "WAVEfmt "))).toBe("unknown");
  });

  it("recognises HEIC, only so the refusal can say something useful", () => {
    expect(sniffImage(HEIC)).toBe("image/heic");
    expect(isAcceptedImage(sniffImage(HEIC))).toBe(false);
  });

  it("recognises the other ISO brands an Apple device writes", () => {
    for (const brand of ["heix", "mif1", "msf1", "heim"]) {
      expect(sniffImage(bytes([0x00, 0x00, 0x00, 0x18], "ftyp", brand)), brand).toBe("image/heic");
    }
  });

  it("does not call an MP4 a photo, though it is the same container", () => {
    expect(sniffImage(bytes([0x00, 0x00, 0x00, 0x18], "ftypisom"))).toBe("unknown");
  });

  it("refuses an SVG, which is the one that matters", () => {
    // Not an oversight: an SVG is a document and can carry a script, and it would be opened
    // from the filesystem with the published page's own origin.
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("unknown");
    expect(sniffImage(bytes('<?xml version="1.0"?><svg></svg>'))).toBe("unknown");
  });

  it("refuses an SVG however it was renamed, because the name is never read", () => {
    const svg = bytes("<svg/>");
    expect(isAcceptedImage(sniffImage(svg))).toBe(false);
  });

  it("refuses HTML, a PDF, a ZIP and an executable", () => {
    expect(sniffImage(bytes("<!doctype html>"))).toBe("unknown");
    expect(sniffImage(bytes("%PDF-1.7"))).toBe("unknown");
    expect(sniffImage(bytes("PK", [0x03, 0x04]))).toBe("unknown");
    expect(sniffImage(bytes([0x7f], "ELF"))).toBe("unknown");
  });

  it("refuses an empty file and a file shorter than any signature", () => {
    expect(sniffImage(new Uint8Array())).toBe("unknown");
    expect(sniffImage(bytes([0xff, 0xd8]))).toBe("unknown");
    expect(sniffImage(bytes([0x89, 0x50]))).toBe("unknown");
  });

  it("refuses a file that merely contains a signature further in", () => {
    // Only the first bytes are the format. A signature appearing later is data, not a header.
    expect(sniffImage(bytes("junk", [0xff, 0xd8, 0xff]))).toBe("unknown");
  });
});

describe("isAcceptedImage", () => {
  it("accepts exactly the three the decision names", () => {
    expect([...ACCEPTED_IMAGE_TYPES]).toEqual(["image/jpeg", "image/png", "image/webp"]);
    for (const type of ACCEPTED_IMAGE_TYPES) expect(isAcceptedImage(type)).toBe(true);
  });

  it("rejects everything else, including the two named kinds of not-a-photo", () => {
    expect(isAcceptedImage("unknown")).toBe(false);
    expect(isAcceptedImage("image/heic")).toBe(false);
  });
});

describe("extensionFor", () => {
  it("gives the extension buildSite reads to choose a content type", () => {
    // If these two disagreed, a published photo would be served as the wrong type.
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
  });
});
