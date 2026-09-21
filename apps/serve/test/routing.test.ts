import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSite } from "@retorika/publisher";
import { parseDocument } from "@retorika/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { objectKeyFor, siteIdFromHost } from "../src/routing.ts";

/**
 * The tenancy guarantee: no request for site A can ever return a byte of site B. Every
 * case here is a way that guarantee could break, and none of them needs a Worker runtime.
 */

const DOMAIN = "example.com";

describe("siteIdFromHost", () => {
  it.each([
    ["lua.example.com", "lua"],
    ["barberia-el-corte.example.com", "barberia-el-corte"],
    ["a1.example.com", "a1"],
    ["7.example.com", "7"],
  ])("%s -> %s", (host, id) => {
    expect(siteIdFromHost(host, DOMAIN)).toBe(id);
  });

  it("matches the port when the domain carries one, as in local development", () => {
    expect(siteIdFromHost("lua.localhost:8787", "localhost:8787")).toBe("lua");
  });

  it.each([
    ["the apex", "example.com"],
    ["a different domain", "lua.example.org"],
    ["a domain that only ends the same way", "lua.notexample.com"],
    ["a multi-label subdomain", "a.b.example.com"],
    ["an empty label", ".example.com"],
    ["uppercase", "LUA.example.com"],
    ["an underscore", "lu_a.example.com"],
    ["a leading hyphen", "-lua.example.com"],
    ["a trailing hyphen", "lua-.example.com"],
    ["a label longer than 63", `${"a".repeat(64)}.example.com`],
    ["a port that does not match", "lua.example.com:8080"],
    ["an IPv4 address", "192.0.2.1"],
    ["an IPv6 address", "[2001:db8::1]"],
    ["an empty host", ""],
    ["a trailing dot", "lua.example.com."],
    ["a non-ASCII label", "peña.example.com"],
  ])("returns null for %s", (_label, host) => {
    expect(siteIdFromHost(host, DOMAIN)).toBeNull();
  });

  it("returns null rather than matching everything when the domain is empty", () => {
    expect(siteIdFromHost("lua.", "")).toBeNull();
    expect(siteIdFromHost("lua", "")).toBeNull();
  });
});

describe("objectKeyFor", () => {
  it.each([
    ["/", "sites/x/index.html"],
    ["/about", "sites/x/about.html"],
    ["/about.html", "sites/x/about.html"],
    ["/about/", "sites/x/about/index.html"],
    ["/assets/a.svg", "sites/x/assets/a.svg"],
    ["/robots.txt", "sites/x/robots.txt"],
    ["/about?utm=1", "sites/x/about.html"],
    ["/about#team", "sites/x/about.html"],
    ["/assets/a.svg?v=2#x", "sites/x/assets/a.svg"],
    ["/assets/My_Photo-2.JPG", "sites/x/assets/My_Photo-2.JPG"],
  ])("%s -> %s", (path, key) => {
    expect(objectKeyFor("x", path)).toBe(key);
  });

  it.each([
    ["a parent segment", "/../other/index.html"],
    ["a nested parent segment", "/assets/../../other/index.html"],
    ["an encoded parent segment", "/%2e%2e/other"],
    ["a mixed-case encoded parent segment", "/%2E%2e/other"],
    ["an encoded slash", "/..%2f..%2fetc"],
    ["an encoded slash inside a name", "/assets%2fa.svg"],
    ["a double-encoded parent segment", "/%252e%252e/other"],
    ["a current-directory segment", "/./index.html"],
    ["a backslash", "/..\\other\\index.html"],
    ["an encoded backslash", "/%5c..%5cother"],
    ["a NUL byte", "/index.html%00.svg"],
    ["a raw NUL byte", "/index.html\u0000"],
    ["a protocol-relative path", "//other.example.com/"],
    ["an empty segment", "/assets//a.svg"],
    ["a hidden file", "/.env"],
    ["a malformed escape", "/%E0%A4%A"],
    ["a non-ASCII name", "/caf%C3%A9-menu"],
    ["no leading slash", "index.html"],
    ["an empty path", ""],
  ])("returns null for %s", (_label, path) => {
    expect(objectKeyFor("x", path)).toBeNull();
  });

  it.each([
    ["a site id with a slash", "a/b"],
    ["a parent site id", ".."],
    ["an empty site id", ""],
    ["an uppercase site id", "Lua"],
  ])("returns null for %s", (_label, siteId) => {
    expect(objectKeyFor(siteId, "/")).toBeNull();
  });

  it("never leaves sites/<siteId>/, whatever the site id and the path", () => {
    const dangerous = fc.constantFrom(
      "..",
      ".",
      "",
      "%2e%2e",
      "%2E%2E",
      "%2f",
      "%5c",
      "\\",
      "%00",
      "\u0000",
      "%252e",
      "/",
      "//",
      "?",
      "#",
      "ñ",
      "index.html",
      "assets",
      "a.svg",
    );
    const segment = fc.oneof(dangerous, fc.string({ maxLength: 8 }));
    // Joined with "/", and the segments themselves may contain "/", "//" or nothing at
    // all, so separators, empty segments and encoded look-alikes all get generated.
    const path = fc.array(segment, { maxLength: 6 }).map((segments) => `/${segments.join("/")}`);
    const siteId = fc.oneof(
      fc.stringMatching(/^[a-z0-9]([a-z0-9-]{0,10}[a-z0-9])?$/),
      fc.string({ maxLength: 10 }),
      fc.constantFrom("..", "a/b", "a/../b", "sites", ""),
    );

    fc.assert(
      fc.property(siteId, fc.oneof(path, fc.string()), (id, p) => {
        const key = objectKeyFor(id, p);
        if (key === null) return;
        expect(key.startsWith(`sites/${id}/`)).toBe(true);
        const segments = key.split("/");
        for (const s of segments) {
          expect(s).not.toBe("..");
          expect(s).not.toBe(".");
          expect(s).not.toBe("");
          // biome-ignore lint/suspicious/noControlCharactersInRegex: matching NUL is the point
          expect(s).not.toMatch(/[\\\u0000%]/);
        }
        expect(segments[1]).toBe(id);
        expect(id).toMatch(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("the publisher -> serve contract", () => {
  const fixtures = join(import.meta.dirname, "..", "..", "..", "fixtures");
  const documentsDir = join(fixtures, "documents");

  it("serves every file buildSite produces at exactly its own path", () => {
    for (const file of readdirSync(documentsDir).filter((f) => f.endsWith(".json"))) {
      const document = parseDocument(JSON.parse(readFileSync(join(documentsDir, file), "utf8")));
      const assets = new Map<string, Uint8Array>();
      for (const page of document.pages) {
        for (const section of page.sections) {
          for (const el of section.content) {
            if (el.value?.kind === "image") {
              assets.set(el.value.src, new Uint8Array(readFileSync(join(fixtures, el.value.src))));
            }
          }
        }
      }
      const bundle = buildSite(document, { siteId: "x", baseUrl: "https://x.example.com", assets });

      // If publisher ever writes a path serve would refuse, a published file becomes a
      // 404 that no test anywhere else would notice.
      for (const { path } of bundle.files) {
        expect(objectKeyFor("x", `/${path}`), `${file}: ${path}`).toBe(`sites/x/${path}`);
      }
      expect(objectKeyFor("x", "/"), file).toBe(`sites/x/${bundle.manifest.entry}`);
    }
  });
});
