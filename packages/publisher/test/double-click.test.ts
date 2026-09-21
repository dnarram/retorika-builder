import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ContentElement,
  type Page,
  parseDocument,
  type RetorikaDocument,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { buildSite, type SiteBundle } from "../src/index.ts";

/**
 * The acceptance criterion of phase 0, as a test: "publicar un sitio de una sección …,
 * descargar su ZIP, abrirlo con doble clic y que se vea igual" (protocol Part 14).
 *
 * The line it draws is between what a page *loads* and where it *navigates*. Anything
 * loaded (`src`) must be a file in the bundle, because from file:// there is nothing else.
 * A link may leave the site — a map, an email, a phone number — because following it is
 * the visitor's choice and works the same from disk. What it may never be is a path that
 * only a server resolves: a leading "/", an extensionless page, a directory URL.
 */

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

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** The renderer always writes `name="escaped value"`, so a regex is exact here. */
function urlAttributes(html: string): { name: "href" | "src"; value: string }[] {
  return [...html.matchAll(/\s(href|src)="([^"]*)"/g)].map((match) => ({
    name: match[1] as "href" | "src",
    value: (match[2] ?? "").replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e),
  }));
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** Outbound navigation that works identically from file:// and from a server. */
const OUTBOUND_SCHEMES = ["https:", "mailto:", "tel:"];
const INTERNAL_PAGE = /^\.\/([a-z0-9][a-z0-9-]*\.html)(#.*)?$/;

/** Every broken promise in one page, as readable strings; empty means double-click safe. */
function doubleClickProblems(bundle: SiteBundle): string[] {
  const paths = new Set(bundle.files.map((f) => f.path));
  const problems: string[] = [];

  for (const page of bundle.files.filter((f) => f.path.endsWith(".html"))) {
    const html = new TextDecoder().decode(page.contents);
    for (const { name, value } of urlAttributes(html)) {
      const where = `${page.path}: ${name}="${value}"`;

      if (name === "src") {
        if (value.startsWith("/") || SCHEME.test(value) || value.includes("..")) {
          problems.push(`${where} is not a relative bundle path`);
        } else if (!paths.has(value)) {
          problems.push(`${where} names no file in the bundle`);
        }
        continue;
      }

      if (value.startsWith("#")) continue;
      if (SCHEME.test(value)) {
        const scheme = value.slice(0, value.indexOf(":") + 1).toLowerCase();
        if (!OUTBOUND_SCHEMES.includes(scheme)) problems.push(`${where} uses ${scheme}`);
        continue;
      }
      const internal = INTERNAL_PAGE.exec(value);
      if (!internal) {
        problems.push(`${where} is not of the form ./<slug>.html`);
      } else if (!paths.has(internal[1] ?? "")) {
        problems.push(`${where} names no page in the bundle`);
      }
    }
  }
  return problems;
}

function link(id: string, text: string, href: string): ContentElement {
  return {
    id,
    role: "link",
    hidden: false,
    slot: "secondaryAction",
    value: { kind: "link", text, href },
  };
}

/** The fixture's first page, with extra elements appended to its first section. */
function pageWith(base: RetorikaDocument, id: string, slug: string, extra: ContentElement[]): Page {
  const [first] = base.pages;
  const [section] = first?.sections ?? [];
  if (!first || !section) throw new Error("fixture has no section");
  return {
    id,
    slug,
    title: slug,
    sections: [{ ...section, id: `sec-${id}`, content: [...section.content, ...extra] }],
  };
}

/** Three pages linking to each other the way the editor will write them, plus a map. */
function multiPageDocument(base: RetorikaDocument): RetorikaDocument {
  return parseDocument({
    ...base,
    pages: [
      pageWith(base, "home", "inicio", [
        link("el-l1", "Servicios", "./servicios.html"),
        link("el-l2", "Contacto", "./contacto.html#formulario"),
      ]),
      pageWith(base, "services", "servicios", [
        link("el-l3", "Inicio", "./index.html"),
        link("el-l4", "Escríbenos", "mailto:hola@example.test"),
      ]),
      pageWith(base, "contact", "contacto", [
        link("el-l5", "Llámanos", "tel:+34000000000"),
        {
          id: "el-map",
          role: "map",
          hidden: false,
          slot: "secondaryAction",
          value: { kind: "map", label: "Cómo llegar", latitude: 40.4, longitude: -3.7 },
        },
      ]),
    ],
  });
}

const corpus = loadCorpus();
const barbershop = corpus.find((entry) => entry.name === "barbershop-cover")?.document;
if (!barbershop) throw new Error("fixture barbershop-cover is missing");

describe("double-click", () => {
  it("every page of every fixture works from file:// with no server", () => {
    for (const { name, document } of corpus) {
      expect(doubleClickProblems(bundleFor(name, document)), name).toEqual([]);
    }
  });

  it("a multi-page site links by file name and every link resolves", () => {
    const bundle = bundleFor("multi", multiPageDocument(barbershop));

    expect(bundle.files.map((f) => f.path)).toEqual(
      expect.arrayContaining(["index.html", "servicios.html", "contacto.html"]),
    );
    expect(doubleClickProblems(bundle)).toEqual([]);
  });

  it.each([
    ["a root-relative link", "/servicios"],
    ["an extensionless link", "servicios"],
    ["a directory link", "./servicios/"],
    ["a plain http link", "http://example.test"],
    ["a file:// link", "file:///Users/cliente/index.html"],
    ["a link to a page that does not exist", "./precios.html"],
  ])("catches %s", (_label, href) => {
    const doc = parseDocument({
      ...barbershop,
      pages: [pageWith(barbershop, "home", "index", [link("el-bad", "x", href)])],
    });
    // The publisher does not rewrite links (decision 2), so a bad one reaches the page
    // and this suite is what catches it.
    expect(doubleClickProblems(bundleFor("bad", doc))).toHaveLength(1);
  });
});
