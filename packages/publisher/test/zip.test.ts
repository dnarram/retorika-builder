import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, inflateRawSync } from "node:zlib";
import { invariantTestName, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { buildSite, bundleToZip, type SiteBundle } from "../src/index.ts";

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures");
const DOCUMENTS_DIR = join(FIXTURES_DIR, "documents");

function loadCorpus(): { name: string; document: RetorikaDocument }[] {
  return readdirSync(DOCUMENTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      name: file.replace(/\.json$/, ""),
      document: parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, file), "utf8"))),
    }));
}

function bundleFor(name: string, document: RetorikaDocument): SiteBundle {
  const assets = new Map<string, Uint8Array>();
  for (const page of document.pages) {
    for (const section of page.sections) {
      for (const el of section.content) {
        if (el.value?.kind === "image") {
          assets.set(el.value.src, new Uint8Array(readFileSync(join(FIXTURES_DIR, el.value.src))));
        }
      }
    }
  }
  return buildSite(document, { siteId: name, baseUrl: "https://example.test", assets });
}

interface ParsedEntry {
  name: string;
  method: number;
  versionMadeBy: number;
  externalAttributes: number;
  dosTime: number;
  dosDate: number;
  extraLength: number;
  contents: Uint8Array;
}

/**
 * A deliberately independent reader: it walks the archive from the end, the way unzip
 * does, and cross-checks every central-directory record against its local header.
 */
function parseZip(bytes: Uint8Array): ParsedEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true), "EOCD signature").toBe(0x06054b50);
  expect(view.getUint16(eocd + 20, true), "no archive comment").toBe(0);

  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  expect(cdOffset + cdSize, "central directory ends where EOCD begins").toBe(eocd);

  const decoder = new TextDecoder();
  const entries: ParsedEntry[] = [];
  let at = cdOffset;
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(at, true), "central header signature").toBe(0x02014b50);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    expect(view.getUint32(localOffset, true), `${name}: local header signature`).toBe(0x04034b50);
    expect(view.getUint16(localOffset + 8, true), `${name}: local method`).toBe(method);
    expect(view.getUint32(localOffset + 14, true), `${name}: local crc`).toBe(crc);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    expect(
      decoder.decode(bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength)),
      `${name}: local name`,
    ).toBe(name);

    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    const contents = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw;
    expect(contents.length, `${name}: size`).toBe(size);
    expect(crc32(contents), `${name}: crc`).toBe(crc);

    entries.push({
      name,
      method,
      versionMadeBy: view.getUint16(at + 4, true),
      externalAttributes: view.getUint32(at + 38, true),
      dosTime: view.getUint16(at + 12, true),
      dosDate: view.getUint16(at + 14, true),
      extraLength: extraLength + localExtraLength + commentLength,
      contents,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  expect(at, "central directory size").toBe(eocd);
  return entries;
}

const corpus = loadCorpus();

describe("bundleToZip", () => {
  it("produces an archive whose headers, central directory and EOCD line up", () => {
    for (const { name, document } of corpus) {
      const entries = parseZip(bundleToZip(bundleFor(name, document)));
      expect(entries.length, name).toBeGreaterThan(0);
    }
  });

  it("contains exactly bundle.files, in sorted order, and never the manifest", () => {
    for (const { name, document } of corpus) {
      const bundle = bundleFor(name, document);
      const names = parseZip(bundleToZip(bundle)).map((e) => e.name);
      expect(names, name).toEqual(bundle.files.map((f) => f.path).sort());
      expect(
        names.some((n) => /manifest|\.json$/i.test(n)),
        name,
      ).toBe(false);
    }
  });

  it("decompresses every entry to the original contents", () => {
    for (const { name, document } of corpus) {
      const bundle = bundleFor(name, document);
      const byName = new Map(parseZip(bundleToZip(bundle)).map((e) => [e.name, e.contents]));
      for (const file of bundle.files) {
        expect(byName.get(file.path), `${name}: ${file.path}`).toEqual(file.contents);
      }
    }
  });

  it(`${invariantTestName("INV_5")} (ZIP bytes)`, () => {
    for (const { name, document } of corpus) {
      expect(bundleToZip(bundleFor(name, document)), name).toEqual(
        bundleToZip(bundleFor(name, document)),
      );
    }
  });

  it("uses a fixed timestamp and no extra fields", () => {
    for (const { name, document } of corpus) {
      for (const entry of parseZip(bundleToZip(bundleFor(name, document)))) {
        expect(entry.dosDate, `${name}: ${entry.name}`).toBe(0x0021); // 1980-01-01
        expect(entry.dosTime, `${name}: ${entry.name}`).toBe(0);
        expect(entry.extraLength, `${name}: ${entry.name}`).toBe(0);
      }
    }
  });

  it("marks every entry as a Unix regular file with mode 0644, never mode 000", () => {
    for (const { name, document } of corpus) {
      for (const entry of parseZip(bundleToZip(bundleFor(name, document)))) {
        // High byte 3 means the external attributes carry a Unix mode. With that host
        // byte, attributes of 0 would extract as an unreadable file.
        expect(entry.versionMadeBy >> 8, `${name}: ${entry.name}`).toBe(3);
        expect(entry.externalAttributes >>> 16, `${name}: ${entry.name}`).toBe(0o100644);
      }
    }
  });

  it("stores an entry that deflate would not shrink", () => {
    const incompressible = new Uint8Array([0x9f]);
    const text = new TextEncoder().encode("a".repeat(1000));
    const bundle: SiteBundle = {
      files: [
        { path: "a.txt", contents: text, contentType: "text/plain; charset=utf-8" },
        { path: "b.bin", contents: incompressible, contentType: "application/octet-stream" },
      ],
      manifest: { siteId: "s", schemaVersion: "1.0.0", entry: "index.html", pages: [], assets: [] },
    };
    const [a, b] = parseZip(bundleToZip(bundle));
    expect(a?.method).toBe(8);
    expect(b?.method).toBe(0);
    expect(b?.contents).toEqual(incompressible);
  });

  it.each([
    ["an absolute path", "/index.html"],
    ["a parent path", "../index.html"],
    ["a backslash", "assets\\x.svg"],
    ["a non-ASCII name", "página.html"],
  ])("refuses %s rather than writing a zip-slip entry", (_label, path) => {
    const bundle: SiteBundle = {
      files: [{ path, contents: new Uint8Array([1]), contentType: "text/html" }],
      manifest: { siteId: "s", schemaVersion: "1.0.0", entry: "index.html", pages: [], assets: [] },
    };
    expect(() => bundleToZip(bundle)).toThrow(/unsafe path/);
  });

  it("refuses duplicate paths", () => {
    const file = { path: "index.html", contents: new Uint8Array([1]), contentType: "text/html" };
    const bundle: SiteBundle = {
      files: [file, file],
      manifest: { siteId: "s", schemaVersion: "1.0.0", entry: "index.html", pages: [], assets: [] },
    };
    expect(() => bundleToZip(bundle)).toThrow(/duplicate path/);
  });
});
