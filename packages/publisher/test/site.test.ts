import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { render } from "@retorika/renderer";
import {
  type ContentElement,
  invariantTestName,
  parseDocument,
  type RetorikaDocument,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { buildSite } from "../src/index.ts";

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

/** Resolves every image src against fixtures/, the way scripts/build-sample-site.ts does. */
function assetsFor(doc: RetorikaDocument): Map<string, Uint8Array> {
  const assets = new Map<string, Uint8Array>();
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const el of section.content) {
        if (el.value?.kind === "image") {
          assets.set(el.value.src, new Uint8Array(readFileSync(join(FIXTURES_DIR, el.value.src))));
        }
      }
    }
  }
  return assets;
}

const corpus = loadCorpus();
const barbershop = corpus.find((entry) => entry.name === "barbershop-cover")?.document;
if (!barbershop) throw new Error("fixture barbershop-cover is missing");

/** Sets the src of every image, or only of the images on one page. */
function withImageSrc(doc: RetorikaDocument, src: string, onPage?: number): RetorikaDocument {
  const mapElement = (el: ContentElement): ContentElement =>
    el.value?.kind === "image" ? { ...el, value: { ...el.value, src } } : el;
  return {
    ...doc,
    pages: doc.pages.map((page, i) =>
      onPage !== undefined && onPage !== i
        ? page
        : {
            ...page,
            sections: page.sections.map((section) => ({
              ...section,
              content: section.content.map(mapElement),
            })),
          },
    ),
  };
}

function withPages(doc: RetorikaDocument, slugs: string[]): RetorikaDocument {
  const [first] = doc.pages;
  if (!first) throw new Error("fixture has no pages");
  return parseDocument({
    ...doc,
    pages: slugs.map((slug, i) => ({
      ...first,
      id: `page-${i}`,
      slug,
      title: `Página ${i}`,
      // Rule 5: a section id is unique across the document.
      sections: first.sections.map((section) => ({ ...section, id: `${section.id}-${i}` })),
    })),
  });
}

describe("buildSite", () => {
  it("produces an index.html for every fixture", () => {
    for (const { name, document } of corpus) {
      const bundle = buildSite(document, { siteId: name, assets: assetsFor(document) });
      expect(
        bundle.files.map((f) => f.path),
        name,
      ).toContain("index.html");
      expect(bundle.manifest.entry, name).toBe("index.html");
    }
  });

  it("never emits an absolute or parent-relative path", () => {
    for (const { name, document } of corpus) {
      const bundle = buildSite(document, {
        siteId: name,
        baseUrl: "https://example.test",
        assets: assetsFor(document),
      });
      for (const file of bundle.files) {
        expect(file.path.startsWith("/"), `${name}: ${file.path}`).toBe(false);
        expect(file.path.includes(".."), `${name}: ${file.path}`).toBe(false);
        expect(file.path.includes("\\"), `${name}: ${file.path}`).toBe(false);
      }
    }
  });

  it("bundles a file for every AssetRef the renderer reports", () => {
    for (const { name, document } of corpus) {
      const bundle = buildSite(document, { siteId: name, assets: assetsFor(document) });
      const paths = new Set(bundle.files.map((f) => f.path));
      for (const ref of render(document, "html").assets) {
        expect(paths.has(`assets/${basename(ref.src)}`), `${name}: ${ref.src}`).toBe(true);
      }
      for (const asset of bundle.manifest.assets) {
        expect(paths.has(asset), `${name}: ${asset}`).toBe(true);
      }
    }
  });

  it("copies asset bytes unchanged", () => {
    const assets = assetsFor(barbershop);
    const bundle = buildSite(barbershop, { siteId: "s", assets });
    const file = bundle.files.find((f) => f.path === "assets/barbershop.svg");
    expect(file?.contents).toEqual(assets.get("assets/barbershop.svg"));
    expect(file?.contentType).toBe("image/svg+xml");
  });

  it("throws on a missing asset rather than publishing a broken image", () => {
    expect(() => buildSite(barbershop, { siteId: "s", assets: new Map() })).toThrow(
      /missing asset.*assets\/barbershop\.svg/,
    );
  });

  it("rewrites image src to assets/<basename> and leaves the input untouched", () => {
    const doc = withImageSrc(barbershop, "uploads/2026/photo.svg");
    const before = JSON.stringify(doc);
    const bundle = buildSite(doc, {
      siteId: "s",
      assets: new Map([["uploads/2026/photo.svg", new Uint8Array([60, 115, 118, 103, 62])]]),
    });

    const index = new TextDecoder().decode(
      bundle.files.find((f) => f.path === "index.html")?.contents,
    );
    expect(index).toContain('src="assets/photo.svg"');
    expect(index).not.toContain("uploads/2026");
    expect(bundle.manifest.assets).toEqual(["assets/photo.svg"]);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("does not touch any href", () => {
    const bundle = buildSite(barbershop, { siteId: "s", assets: assetsFor(barbershop) });
    const index = new TextDecoder().decode(
      bundle.files.find((f) => f.path === "index.html")?.contents,
    );
    expect(index).toContain('href="#reservas"');
  });

  it("throws when two different srcs share a basename", () => {
    const twoPages = withPages(barbershop, ["inicio", "otra"]);
    const doc = withImageSrc(withImageSrc(twoPages, "a/photo.svg", 0), "b/photo.svg", 1);
    const bytes = new Uint8Array([1]);
    expect(() =>
      buildSite(doc, {
        siteId: "s",
        assets: new Map([
          ["a/photo.svg", bytes],
          ["b/photo.svg", bytes],
        ]),
      }),
    ).toThrow(/same file name/);
  });

  it.each([
    ["an unsafe asset name", "photos/..", /unsafe asset name/],
    ["a hidden asset name", "photos/.htaccess", /unsafe asset name/],
    ["a query string", "photo.svg?v=2", /unsafe asset name/],
    ["an unknown extension", "assets/notes.pdf", /unsupported asset type/],
  ])("throws on %s", (_label, src, message) => {
    const doc = withImageSrc(barbershop, src);
    expect(() =>
      buildSite(doc, { siteId: "s", assets: new Map([[src, new Uint8Array([1])]]) }),
    ).toThrow(message);
  });

  it("leaves a data: URI image inline, needing no asset file at all", () => {
    // The generator's placeholder photo (ADR 0011 has no photobank yet) is a data: URI
    // precisely so no publisher wiring is needed to carry it into the ZIP.
    const src = "data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E";
    const doc = withImageSrc(barbershop, src);
    const bundle = buildSite(doc, { siteId: "s", assets: new Map() });
    const index = new TextDecoder().decode(
      bundle.files.find((f) => f.path === "index.html")?.contents,
    );
    expect(index).toContain(src);
    expect(bundle.manifest.assets).toEqual([]);
    expect(bundle.files.some((f) => f.path.startsWith("assets/"))).toBe(false);
  });

  it("never places the manifest in files", () => {
    for (const { name, document } of corpus) {
      const bundle = buildSite(document, {
        siteId: name,
        baseUrl: "https://example.test",
        assets: assetsFor(document),
      });
      const serialised = JSON.stringify(bundle.manifest);
      for (const file of bundle.files) {
        expect(file.path, name).not.toMatch(/manifest|\.json$/i);
        expect(new TextDecoder().decode(file.contents), name).not.toContain(serialised);
      }
    }
  });

  it(`${invariantTestName("INV_5")} (publisher bundle)`, () => {
    for (const { name, document } of corpus) {
      const options = {
        siteId: name,
        baseUrl: "https://example.test",
        assets: assetsFor(document),
      };
      expect(buildSite(document, options), name).toEqual(buildSite(document, options));
    }
  });

  it("emits sitemap.xml only with a baseUrl, and robots.txt always", () => {
    const assets = assetsFor(barbershop);
    const download = buildSite(barbershop, { siteId: "s", assets });
    const served = buildSite(barbershop, { siteId: "s", baseUrl: "https://example.test", assets });

    const paths = (b: typeof download) => b.files.map((f) => f.path);
    const text = (b: typeof download, path: string) =>
      new TextDecoder().decode(b.files.find((f) => f.path === path)?.contents);

    expect(paths(download)).not.toContain("sitemap.xml");
    expect(paths(download)).toContain("robots.txt");
    expect(text(download, "robots.txt")).not.toMatch(/sitemap/i);

    expect(paths(served)).toContain("sitemap.xml");
    expect(text(served, "robots.txt")).toContain("Sitemap: https://example.test/sitemap.xml");
    expect(text(served, "sitemap.xml")).toContain("<loc>https://example.test/index.html</loc>");
  });

  it.each([
    ["a trailing slash", "https://example.test/"],
    ["a path", "https://example.test/site"],
    ["a relative URL", "example.test"],
    ["a non-http scheme", "ftp://example.test"],
  ])("throws on a baseUrl with %s", (_label, baseUrl) => {
    expect(() =>
      buildSite(barbershop, { siteId: "s", baseUrl, assets: assetsFor(barbershop) }),
    ).toThrow(/baseUrl/);
  });

  it("writes the first page as index.html and every other page as <slug>.html", () => {
    const doc = withPages(barbershop, ["inicio", "servicios", "contacto"]);
    const bundle = buildSite(doc, { siteId: "s", assets: assetsFor(doc) });

    expect(bundle.manifest.pages).toEqual([
      { slug: "inicio", path: "index.html", title: "Página 0" },
      { slug: "servicios", path: "servicios.html", title: "Página 1" },
      { slug: "contacto", path: "contacto.html", title: "Página 2" },
    ]);
    const servicios = new TextDecoder().decode(
      bundle.files.find((f) => f.path === "servicios.html")?.contents,
    );
    expect(servicios).toContain('data-page="page-1"');
    expect(bundle.files.map((f) => f.path)).toEqual([...bundle.files.map((f) => f.path)].sort());
  });

  it.each([
    ["a duplicate slug", ["inicio", "servicios", "servicios"], /slug collision/],
    ["a later page named index", ["inicio", "index"], /slug collision/],
    ["an unsafe slug", ["inicio", "../fuera"], /unsafe slug/],
    ["an uppercase slug", ["inicio", "Servicios"], /unsafe slug/],
  ])("throws on %s", (_label, slugs, message) => {
    const doc = withPages(barbershop, slugs);
    expect(() => buildSite(doc, { siteId: "s", assets: assetsFor(doc) })).toThrow(message);
  });

  it("records the source schemaVersion and the siteId in the manifest", () => {
    const bundle = buildSite(barbershop, { siteId: "site-42", assets: assetsFor(barbershop) });
    expect(bundle.manifest.siteId).toBe("site-42");
    expect(bundle.manifest.schemaVersion).toBe(barbershop.schemaVersion);
  });
});
