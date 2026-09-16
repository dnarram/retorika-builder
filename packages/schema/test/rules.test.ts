import { describe, expect, it } from "vitest";
import { GRID_COLUMNS, type Section } from "../src/document.ts";
import { checkInvariants } from "../src/invariants.ts";
import { parseDocument } from "../src/parse.ts";
import { TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`]));

function documentWith(section: Section): unknown {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Test",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
    collections: [],
  };
}

function coverSection(overrides: Partial<Section> = {}): Section {
  return {
    id: "section-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    content: [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Tu perro, como nuevo" },
      },
    ],
    layout: null,
    ...overrides,
  };
}

const layout = (placements: unknown[], breakpoints: unknown = {}) => ({
  grid: { columns: GRID_COLUMNS },
  placements,
  breakpoints,
});

describe("rule 1 — layout never owns content", () => {
  it("rejects a placement pointing at an element that is not in the section", () => {
    const section = coverSection({
      source: "free",
      layout: layout([
        { elementId: "el-does-not-exist", column: 1, columnSpan: 6, row: 1, rowSpan: 1 },
      ]) as Section["layout"],
    });
    expect(() => parseDocument(documentWith(section))).toThrow(/rule 1/);
  });
});

describe("rule 4 — positions are relative to the section grid", () => {
  it("rejects a span that runs off the twelfth column", () => {
    const section = coverSection({
      source: "free",
      layout: layout([
        { elementId: "el-headline", column: 10, columnSpan: 6, row: 1, rowSpan: 1 },
      ]) as Section["layout"],
    });
    expect(() => parseDocument(documentWith(section))).toThrow(/rule 4/);
  });

  it("rejects a column beyond the grid at the schema level", () => {
    const section = coverSection({
      source: "free",
      layout: layout([
        { elementId: "el-headline", column: 13, columnSpan: 1, row: 1, rowSpan: 1 },
      ]) as Section["layout"],
    });
    expect(() => parseDocument(documentWith(section))).toThrow();
  });
});

describe("rule 5 — no orphan elements", () => {
  it("rejects the same section id appearing twice", () => {
    const doc = {
      schemaVersion: "1.0.0",
      id: "doc-1",
      siteName: "Test",
      theme,
      pages: [
        { id: "home", slug: "index", title: "Inicio", sections: [coverSection()] },
        { id: "about", slug: "about", title: "Sobre", sections: [coverSection()] },
      ],
      collections: [],
    };
    expect(() => parseDocument(doc)).toThrow(/rule 5/);
  });

  it("rejects a binding to a collection that does not exist", () => {
    const section = coverSection({
      content: [
        {
          id: "el-headline",
          role: "heading",
          hidden: false,
          slot: "headline",
          value: { kind: "text", text: "x" },
          binding: { collectionId: "services", field: "name" },
        },
      ],
    });
    expect(() => parseDocument(documentWith(section))).toThrow(/rule 5/);
  });
});

describe("rule 7 — mobile is a patch, not a parallel tree", () => {
  it("accepts the three adjustments the dossier promises", () => {
    const section = coverSection({
      source: "free",
      layout: layout([{ elementId: "el-headline", column: 1, columnSpan: 6, row: 1, rowSpan: 1 }], {
        mobile: [{ elementId: "el-headline", hidden: true, order: 2, columnSpan: 12 }],
      }) as Section["layout"],
    });
    expect(() => parseDocument(documentWith(section))).not.toThrow();
  });

  it("rejects a fourth kind of adjustment, which is how a second design starts", () => {
    const section = coverSection({
      source: "free",
      layout: layout([{ elementId: "el-headline", column: 1, columnSpan: 6, row: 1, rowSpan: 1 }], {
        mobile: [{ elementId: "el-headline", backgroundColor: "#fff" }],
      }) as Section["layout"],
    });
    expect(() => parseDocument(documentWith(section))).toThrow();
  });

  it("rejects a patch for an element the desktop never places", () => {
    const section = coverSection({
      source: "free",
      layout: layout([{ elementId: "el-headline", column: 1, columnSpan: 6, row: 1, rowSpan: 1 }], {
        mobile: [{ elementId: "el-unplaced", hidden: true }],
      }) as Section["layout"],
    });
    expect(() => parseDocument(documentWith(section))).toThrow(/rule 7/);
  });
});

describe("rule 6 — style is references to the system", () => {
  // These two build deliberately invalid style values, so they go through `unknown`.
  // TypeScript rejecting them at compile time is the first line of the same defence.
  const sectionWithStyle = (style: unknown): Section =>
    ({
      ...coverSection(),
      content: [
        {
          id: "el-headline",
          role: "heading",
          hidden: false,
          slot: "headline",
          value: { kind: "text", text: "x" },
          style,
        },
      ],
    }) as unknown as Section;

  it("rejects a token key outside the closed namespace, so a typo is not a dead reference", () => {
    const section = sectionWithStyle({ color: { ref: "color.primry" } });
    expect(() => parseDocument(documentWith(section))).toThrow();
  });

  it("requires an exact value to mark itself an exception", () => {
    const section = sectionWithStyle({ color: { exact: "#156FE7" } });
    expect(() => parseDocument(documentWith(section))).toThrow();
  });
});

describe("the theme is a complete map", () => {
  it("rejects a theme missing a key, because a partial theme cannot restyle the whole site", () => {
    const partial = { ...theme };
    delete (partial as Record<string, unknown>)["color.primary"];
    const doc = { ...(documentWith(coverSection()) as object), theme: partial };
    expect(() => parseDocument(doc)).toThrow();
  });

  it("rejects a theme carrying a key outside the namespace", () => {
    const doc = {
      ...(documentWith(coverSection()) as object),
      theme: { ...theme, "color.brand": "#fff" },
    };
    expect(() => parseDocument(doc)).toThrow();
  });
});

describe("checkInvariants", () => {
  it("returns no violations for a well-formed document", () => {
    const doc = parseDocument(documentWith(coverSection()));
    expect(checkInvariants(doc)).toEqual([]);
  });
});
