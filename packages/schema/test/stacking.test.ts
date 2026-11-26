import { describe, expect, it } from "vitest";
import type { ContentElement, RetorikaDocument, Section } from "../src/index.ts";
import {
  bringToFront,
  coveredByPhoto,
  isLayered,
  parseDocument,
  sendToBack,
  stackingFor,
} from "../src/index.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * The stack of a hand-designed section (ADR 0085, sprint 41 día 7): its default — photographs under
 * everything, each in document order — the two verbs that change it, and what a photograph covers.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

const el = (
  id: string,
  role: ContentElement["role"],
  value: ContentElement["value"],
  hidden = false,
) => ({ id, role, hidden, slot: id, value }) as ContentElement;

/** A heading, a button, a link, a map, a field and a hidden text, all under one photograph's area. */
function doc(): RetorikaDocument {
  const content: ContentElement[] = [
    el("el-heading", "heading", { kind: "text", text: "Mesas en la plaza" }),
    el("el-image", "image", { kind: "image", src: "foto.jpg", alt: "La plaza" }),
    el("el-button", "button", { kind: "link", text: "Reservar", href: "#contacto" }),
    el("el-link", "link", { kind: "link", text: "Ver la carta", href: "#carta" }),
    el("el-map", "map", { kind: "map", label: "Cómo llegar" }),
    el("el-field", "field", { kind: "field", name: "nombre", label: "Tu nombre" }),
    el("el-hidden", "body", { kind: "text", text: "Oculto" }, true),
    el("el-aside", "body", { kind: "text", text: "Lejos" }),
  ];
  const area = (id: string, column = 1) => ({
    elementId: id,
    column,
    columnSpan: 40,
    row: 1,
    rowSpan: 10,
  });
  const section: Section = {
    id: "sec-a",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "free",
    layout: {
      grid: { columns: 96 },
      placements: [
        area("el-heading"),
        area("el-image"),
        area("el-button"),
        area("el-link"),
        area("el-map"),
        area("el-field"),
        area("el-hidden"),
        area("el-aside", 57),
      ],
      breakpoints: {},
    },
    content,
  };
  return parseDocument({
    schemaVersion: "1.24.0",
    id: "doc-1",
    siteName: "Taberna",
    theme,
    collections: [],
    pages: [{ id: "home", slug: "index", title: "Taberna", sections: [section] }],
  });
}
const sectionOf = (d: RetorikaDocument) => d.pages[0]?.sections[0] as Section;

describe("stackingFor", () => {
  it("is photographs under everything else, each in document order, when nobody reordered", () => {
    expect(stackingFor(sectionOf(doc()))).toEqual([
      "el-image",
      "el-heading",
      "el-button",
      "el-link",
      "el-map",
      "el-field",
      "el-hidden",
      "el-aside",
    ]);
    expect(isLayered(sectionOf(doc()))).toBe(false);
  });
});

describe("bringToFront and sendToBack", () => {
  it("puts the photograph on top, writing the whole stack densely", () => {
    const front = bringToFront(doc(), "sec-a", "el-image");
    expect(stackingFor(sectionOf(front)).at(-1)).toBe("el-image");
    expect(sectionOf(front).layout?.placements.map((p) => p.layer)).toEqual([
      1, 8, 2, 3, 4, 5, 6, 7,
    ]);
    expect(isLayered(sectionOf(front))).toBe(true);
  });

  it("puts the default back as no layers at all, so nobody reordered is a stored fact again", () => {
    const front = bringToFront(doc(), "sec-a", "el-image");
    const back = sendToBack(front, "sec-a", "el-image");
    expect(sectionOf(back).layout?.placements.some((p) => p.layer !== undefined)).toBe(false);
  });

  it("is no change for what is already there, and refuses an element with no placement", () => {
    const d = doc();
    expect(sendToBack(d, "sec-a", "el-image")).toBe(d);
    expect(bringToFront(d, "sec-a", "el-aside")).toBe(d);
    expect(() => bringToFront(d, "sec-a", "el-nada")).toThrow(/no placement/);
  });
});

describe("coveredByPhoto — what a photograph paints over (ADR 0085, David's adjustment 2)", () => {
  it("finds nothing when nobody reordered: photographs paint under everything", () => {
    expect(coveredByPhoto(doc())).toEqual([]);
  });

  it("counts every visible thing under the photograph, not only text, and not what is hidden or beside it", () => {
    const covered = coveredByPhoto(bringToFront(doc(), "sec-a", "el-image"));
    expect(covered.map(({ elementId, role, words }) => ({ elementId, role, words }))).toEqual([
      { elementId: "el-heading", role: "heading", words: "Mesas en la plaza" },
      { elementId: "el-button", role: "button", words: "Reservar" },
      { elementId: "el-link", role: "link", words: "Ver la carta" },
      { elementId: "el-map", role: "map", words: "Cómo llegar" },
      { elementId: "el-field", role: "field", words: "Tu nombre" },
    ]);
    expect(covered[0]?.photo).toEqual({ elementId: "el-image", alt: "La plaza" });
  });

  it("lets go of what was brought back above the photograph", () => {
    const front = bringToFront(doc(), "sec-a", "el-image");
    const button = bringToFront(front, "sec-a", "el-button");
    expect(coveredByPhoto(button).map((c) => c.elementId)).not.toContain("el-button");
  });
});
