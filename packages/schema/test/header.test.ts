import { describe, expect, it } from "vitest";
import { listDeadDestinations, listLinksTo } from "../src/destinations.ts";
import type { RetorikaDocument, Section } from "../src/document.ts";
import {
  deletePage,
  deleteSection,
  LOGO_MAX_EDGE,
  menuLabelIssue,
  pageToSection,
  parseDocument,
  sectionToPage,
  setHeader,
  setHeaderAction,
  setMenuLabel,
} from "../src/index.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * The header is the owner's (ADR 0057): a set of references and preferences outside the pages. What
 * this file holds is that **the one reference it carries — the button — can never dangle**: the
 * schema refuses a button at a place the document does not hold, and every verb that removes or
 * moves a destination re-points or drops the button before the gate.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

/** The avance `sectionToPage` asks the caller for — the catalog's shape, written here because this
 * package may not import the catalog. */
function teaserSection(sectionId: string, href: string, text: string): Section {
  return {
    id: sectionId,
    preset: { catalogId: "teaser", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-link",
        role: "link",
        hidden: false,
        slot: "link",
        value: { kind: "link", text, href },
      },
    ],
  };
}
const makeTeaser = (args: { sectionId: string; href: string; pageTitle: string }) =>
  teaserSection(args.sectionId, args.href, "Ver más");

function section(id: string, catalogId: string, title: string): Section {
  return {
    id,
    preset: { catalogId, variantId: catalogId === "cover" ? "image-right" : "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: `el-${id}`,
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: title },
      },
    ],
  };
}

function documentWith(header?: RetorikaDocument["header"]): RetorikaDocument {
  return parseDocument({
    schemaVersion: "1.15.0",
    id: "doc-cabecera",
    siteName: "Taberna",
    theme,
    collections: [],
    ...(header === undefined ? {} : { header }),
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Taberna",
        sections: [
          section("sec-cover", "cover", "Taberna"),
          section("sec-prices", "prices", "Lo que cuesta"),
          teaserSection("sec-avance", "./donde-estamos.html", "Ver más"),
          section("sec-contact", "contact", "Te esperamos"),
        ],
      },
      {
        id: "p2",
        slug: "donde-estamos",
        title: "Dónde estamos",
        sections: [section("sec-location", "location", "Dónde estamos")],
      },
    ],
  });
}

describe("the header's button points at a place that exists", () => {
  it("accepts a section and a page the document holds", () => {
    expect(() =>
      documentWith({ action: { kind: "section", sectionId: "sec-contact" } }),
    ).not.toThrow();
    expect(() => documentWith({ action: { kind: "page", pageId: "p2" } })).not.toThrow();
  });

  it("refuses a section the document does not hold", () => {
    expect(() => documentWith({ action: { kind: "section", sectionId: "sec-gone" } })).toThrow(
      /not in the document/,
    );
  });

  it("refuses a page the document does not hold, and the entry page", () => {
    expect(() => documentWith({ action: { kind: "page", pageId: "p9" } })).toThrow(
      /not in the document/,
    );
    expect(() => documentWith({ action: { kind: "page", pageId: "home" } })).toThrow(/entry page/);
  });

  it("refuses a section that is no destination: the cover, the footer, an avance", () => {
    expect(() => documentWith({ action: { kind: "section", sectionId: "sec-cover" } })).toThrow(
      /no destination/,
    );
    expect(() => documentWith({ action: { kind: "section", sectionId: "sec-avance" } })).toThrow(
      /no destination/,
    );
  });

  it("is a dead destination when it dangles, so the download gate would see it", () => {
    // Unreachable through `parseDocument`, and kept all the same: the route is a public endpoint and
    // the filter is the validation, not the trust.
    const doc = documentWith();
    const dangling = {
      ...doc,
      header: { action: { kind: "section", sectionId: "sec-gone" } },
    } as RetorikaDocument;
    expect(listDeadDestinations(dangling).map((d) => d.sectionId)).toEqual(["header"]);
    expect(
      listDeadDestinations(documentWith({ action: { kind: "section", sectionId: "sec-contact" } })),
    ).toEqual([]);
  });

  it("counts among what points at a page before that page is deleted", () => {
    const doc = documentWith({ action: { kind: "page", pageId: "p2" } });
    expect(listLinksTo(doc, "p2").map((d) => d.sectionId)).toEqual(["header", "sec-avance"]);
  });
});

describe("the verbs that move or remove a destination carry the button along", () => {
  it("drops the button when its section is deleted", () => {
    const doc = documentWith({
      action: { kind: "section", sectionId: "sec-contact" },
      brand: { name: true },
    });
    const after = deleteSection(doc, "sec-contact");
    expect(after.header).toEqual({ brand: { name: true } });
  });

  it("leaves the button alone when another section is deleted", () => {
    const doc = documentWith({ action: { kind: "section", sectionId: "sec-contact" } });
    expect(deleteSection(doc, "sec-prices").header).toEqual(doc.header);
  });

  it("drops the button when its page, or the page holding its section, is deleted", () => {
    const atPage = documentWith({ action: { kind: "page", pageId: "p2" } });
    expect(deletePage(atPage, "p2").header).toBeUndefined();
    const atSection = documentWith({ action: { kind: "section", sectionId: "sec-location" } });
    expect(deletePage(atSection, "p2").header).toBeUndefined();
  });

  it("follows a section onto the page it becomes, and comes back when the page folds", () => {
    const doc = documentWith({ action: { kind: "section", sectionId: "sec-prices" } });
    const converted = sectionToPage(doc, "sec-prices", makeTeaser);
    const made = converted.pages.at(-1);
    expect(made?.sections.map((s) => s.id)).toEqual(["sec-prices"]);
    expect(converted.header?.action).toEqual({ kind: "page", pageId: made?.id });

    const folded = pageToSection(converted, made?.id ?? "");
    expect(folded.header?.action).toEqual({ kind: "section", sectionId: "sec-prices" });
  });

  it("carries the section's own label onto the page it becomes", () => {
    const labelled = setMenuLabel(
      documentWith(),
      { kind: "section", sectionId: "sec-prices" },
      "Carta",
    );
    const converted = sectionToPage(labelled, "sec-prices", makeTeaser);
    expect(converted.pages.at(-1)?.menuLabel).toBe("Carta");
  });
});

describe("the owner's own label", () => {
  it("judges the trimmed text against two and twenty characters", () => {
    expect(menuLabelIssue("Ir")).toBeUndefined();
    expect(menuLabelIssue("  Carta  ")).toBeUndefined();
    expect(menuLabelIssue("x")).toBe("short");
    expect(menuLabelIssue("   ")).toBe("short");
    expect(menuLabelIssue("Veintiún caracteres!!")).toBe("long");
    expect(menuLabelIssue("Veinte caracteres..")).toBeUndefined();
  });

  it("writes the trimmed word, and an empty word takes it away", () => {
    const doc = documentWith();
    const labelled = setMenuLabel(doc, { kind: "section", sectionId: "sec-prices" }, "  Carta ");
    expect(labelled.pages[0]?.sections[1]?.menuLabel).toBe("Carta");
    const cleared = setMenuLabel(labelled, { kind: "section", sectionId: "sec-prices" }, "");
    expect(Object.hasOwn(cleared.pages[0]?.sections[1] ?? {}, "menuLabel")).toBe(false);
    expect(setMenuLabel(cleared, { kind: "section", sectionId: "sec-prices" }, null)).toBe(cleared);
  });

  it("labels a page, the first one included: that is how «Inicio» is renamed", () => {
    const doc = documentWith();
    expect(setMenuLabel(doc, { kind: "page", pageId: "p2" }, "Dónde").pages[1]?.menuLabel).toBe(
      "Dónde",
    );
    expect(setMenuLabel(doc, { kind: "page", pageId: "home" }, "Portada").pages[0]?.menuLabel).toBe(
      "Portada",
    );
  });

  it("refuses a label outside the bounds, and a label on a section that lends no entry", () => {
    const doc = documentWith();
    expect(() => setMenuLabel(doc, { kind: "section", sectionId: "sec-prices" }, "x")).toThrow(
      /short/,
    );
    expect(() =>
      setMenuLabel(doc, { kind: "section", sectionId: "sec-prices" }, "Veintiún caracteres!!"),
    ).toThrow(/long/);
    expect(() => setMenuLabel(doc, { kind: "section", sectionId: "sec-cover" }, "Arriba")).toThrow(
      /lends no menu entry/,
    );
    expect(() => setMenuLabel(doc, { kind: "section", sectionId: "sec-avance" }, "Ver")).toThrow(
      /lends no menu entry/,
    );
  });

  it("is refused by the schema untrimmed or out of bounds, so no verb can smuggle one", () => {
    const doc = documentWith();
    const raw = JSON.parse(JSON.stringify(doc)) as {
      pages: { sections: { menuLabel?: string }[] }[];
    };
    (raw.pages[0]?.sections[1] ?? {}).menuLabel = " Carta";
    expect(() => parseDocument(raw)).toThrow();
    (raw.pages[0]?.sections[1] ?? {}).menuLabel = "C";
    expect(() => parseDocument(raw)).toThrow();
    (raw.pages[0]?.sections[0] ?? {}).menuLabel = "Portada";
    (raw.pages[0]?.sections[1] ?? {}).menuLabel = "Carta";
    expect(() => parseDocument(raw)).toThrow(/lends no menu entry/);
  });
});

describe("setHeader", () => {
  it("replaces the keys it is given and keeps the rest", () => {
    const doc = documentWith({ brand: { name: true }, sticky: false });
    const next = setHeader(doc, { layout: "centered", sticky: true });
    expect(next.header).toEqual({ brand: { name: true }, sticky: true, layout: "centered" });
  });

  it("returns the same document when nothing changes, so no history step opens", () => {
    const doc = documentWith({ brand: { name: true } });
    expect(setHeader(doc, { brand: { name: true } })).toBe(doc);
    expect(setHeaderAction(doc, null)).toBe(doc);
  });

  it("takes a key away with undefined, and the button away with null", () => {
    const doc = documentWith({ brand: { name: true }, action: { kind: "page", pageId: "p2" } });
    expect(setHeaderAction(doc, null).header).toEqual({ brand: { name: true } });
    expect(setHeader(doc, { brand: undefined }).header).toEqual({
      action: { kind: "page", pageId: "p2" },
    });
  });

  it("refuses a logo that is not a raster file, by the shape of its name", () => {
    expect(() => documentWith({ brand: { logo: { src: "assets/logo.png" } } })).not.toThrow();
    expect(() => documentWith({ brand: { logo: { src: "logo-3f9a7c21.webp" } } })).not.toThrow();
    expect(() => documentWith({ brand: { logo: { src: "assets/logo.svg" } } })).toThrow();
    expect(() =>
      documentWith({ brand: { logo: { src: "data:image/png;base64,AAAA" } } }),
    ).toThrow();
    expect(() => documentWith({ brand: { logo: { src: "../evil.png" } } })).toThrow();
  });

  it("keeps a logo's size as both sides or neither, whole pixels up to the edge it is kept at", () => {
    const logo = (size: Record<string, unknown>) =>
      documentWith({ brand: { logo: { src: "logo-3f9a7c21.png", ...size } } });
    expect(() => logo({})).not.toThrow();
    expect(() => logo({ width: 512, height: 205 })).not.toThrow();
    expect(() => logo({ width: 1, height: LOGO_MAX_EDGE })).not.toThrow();
    // One side alone is a ratio nobody can draw.
    expect(() => logo({ width: 512 })).toThrow();
    expect(() => logo({ height: 205 })).toThrow();
    // Nothing the editor keeps is larger than its edge, nor empty, nor a fraction of a pixel.
    expect(() => logo({ width: LOGO_MAX_EDGE + 1, height: 205 })).toThrow();
    expect(() => logo({ width: 0, height: 205 })).toThrow();
    expect(() => logo({ width: 512.5, height: 205 })).toThrow();
  });
});
