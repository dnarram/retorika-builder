import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RAIL_WIDTH } from "@retorika/renderer";
import { parseDocument, type RetorikaDocument, setHeader } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { headerStateFor } from "../src/editor/headerState.ts";
import {
  dropOutcome,
  dropText,
  FOLD_ZONE,
  type Frame,
  menuName,
  menuOf,
  type Places,
  ROW_ZONE_HEIGHT,
  stackedText,
  zoneAt,
  zoneRects,
  zonesFor,
} from "../src/editor/menuDrag.ts";
import { DESKTOP_LAYOUT_WIDTH, NARROWEST_WIDTH } from "../src/editor/overflowCheck.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * A menu dragged to its zone (ADR 0066, sprint 33 día 4): the judgement without the DOM. The
 * document is the corpus's `menu-y-paginas`, which draws both menus; the frame's numbers are the
 * canvas at 1280 × 800 with a bar of 70 px and `space.md` at 16 — the editor's own at a window of
 * 1440 with no panel.
 */

const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures", "documents");
const doc = parseDocument(
  JSON.parse(readFileSync(join(FIXTURES, "menu-y-paginas.json"), "utf8")),
) as RetorikaDocument;

const placesOf = (d: RetorikaDocument): Places => headerStateFor(d, undefined);
const at = (d: RetorikaDocument, header: Record<string, unknown>) => setHeader(d, header as never);

const FRAME: Frame = {
  width: DESKTOP_LAYOUT_WIDTH,
  height: 800,
  bar: { left: 0, top: 0, width: DESKTOP_LAYOUT_WIDTH, height: 70 },
  headerH: 70,
  spaceMd: 16,
  pagesPosition: "bar",
};

describe("menuOf", () => {
  it("knows the two menu parts and nothing else", () => {
    expect(menuOf("pagesLinks")).toBe("pages");
    expect(menuOf("sectionsLinks")).toBe("sections");
    expect(menuOf("brand")).toBeNull();
    expect(menuOf(null)).toBeNull();
  });
});

describe("zonesFor", () => {
  it("gives the pages three zones and the sections five, each with the panel's word", () => {
    const places = placesOf(doc);
    expect(zonesFor("pages", places, DESKTOP_LAYOUT_WIDTH).map((z) => z.zone)).toEqual([
      "bar",
      "left",
      "right",
    ]);
    expect(zonesFor("sections", places, DESKTOP_LAYOUT_WIDTH).map((z) => z.zone)).toEqual([
      "bar",
      "row",
      "left",
      "right",
      "fold",
    ]);
    for (const z of zonesFor("sections", places, DESKTOP_LAYOUT_WIDTH)) {
      expect(z.label).toBe(es[`editor.menuPanel.position.${z.zone}`]);
    }
  });

  it("marks the zone the menu is in, and the side the other menu holds as stacked", () => {
    const placed = at(doc, {
      pages: { shown: true, position: "left" },
      sections: { shown: true, position: "right" },
    });
    const pages = zonesFor("pages", placesOf(placed), DESKTOP_LAYOUT_WIDTH);
    expect(pages.find((z) => z.zone === "left")).toMatchObject({ current: true, stacked: null });
    expect(pages.find((z) => z.zone === "right")).toMatchObject({
      current: false,
      stacked: "sections",
    });
    const sections = zonesFor("sections", placesOf(placed), DESKTOP_LAYOUT_WIDTH);
    expect(sections.find((z) => z.zone === "left")).toMatchObject({ stacked: "pages" });
    expect(sections.find((z) => z.zone === "right")).toMatchObject({ current: true });
    expect(sections.find((z) => z.zone === "bar")).toMatchObject({ current: false, stacked: null });
  });

  it("does not call a side stacked when the other menu is not drawn", () => {
    const placed = at(doc, {
      pages: { shown: false, position: "left" },
      sections: { shown: true },
    });
    const sections = zonesFor("sections", placesOf(placed), DESKTOP_LAYOUT_WIDTH);
    expect(sections.find((z) => z.zone === "left")?.stacked).toBeNull();
  });

  it("is empty in the phone view", () => {
    expect(zonesFor("pages", placesOf(doc), NARROWEST_WIDTH)).toEqual([]);
    expect(zonesFor("sections", placesOf(doc), 720)).toEqual([]);
    expect(zonesFor("sections", placesOf(doc), 721)).toHaveLength(5);
  });
});

describe("zoneRects", () => {
  const rects = (menu: "pages" | "sections", frame = FRAME) =>
    zoneRects(zonesFor(menu, placesOf(doc), frame.width), frame);

  it("draws a side as the rail's width by the window's height, the bar as its own box", () => {
    const r = Object.fromEntries(rects("pages").map((z) => [z.zone, z]));
    expect(r["left"]).toMatchObject({ left: 0, top: 0, width: RAIL_WIDTH, height: 800 });
    expect(r["right"]).toMatchObject({
      left: DESKTOP_LAYOUT_WIDTH - RAIL_WIDTH,
      top: 0,
      width: RAIL_WIDTH,
      height: 800,
    });
    expect(r["bar"]).toMatchObject(FRAME.bar);
  });

  it("puts the row under the bar, and «Ir a…» a space under the bar's resolved height, on the right", () => {
    const r = Object.fromEntries(rects("sections").map((z) => [z.zone, z]));
    expect(r["row"]).toMatchObject({
      left: 0,
      top: 70,
      width: DESKTOP_LAYOUT_WIDTH,
      height: ROW_ZONE_HEIGHT(16),
    });
    const pill = FOLD_ZONE(16);
    expect(r["fold"]).toMatchObject({
      top: 70 + 16,
      left: DESKTOP_LAYOUT_WIDTH - 16 - pill.width,
      ...pill,
    });
  });

  it("puts «Ir a…» on the left when the pages' rail stands on the right, and a space from the top of a collapsed bar", () => {
    const frame: Frame = {
      ...FRAME,
      bar: { left: 0, top: 0, width: DESKTOP_LAYOUT_WIDTH - RAIL_WIDTH, height: 70 },
      headerH: 0,
      pagesPosition: "right",
    };
    const fold = rects("sections", frame).find((z) => z.zone === "fold");
    expect(fold).toMatchObject({ left: 16, top: 16 });
  });
});

describe("zoneAt", () => {
  const rects = zoneRects(zonesFor("sections", placesOf(doc), FRAME.width), FRAME);

  it("answers the zone under a point, inside and at the edge, and null outside every one", () => {
    expect(zoneAt({ x: 100, y: 400 }, rects)).toBe("left");
    expect(zoneAt({ x: RAIL_WIDTH - 1, y: 400 }, rects)).toBe("left");
    expect(zoneAt({ x: RAIL_WIDTH, y: 400 }, rects)).toBeNull();
    expect(zoneAt({ x: 640, y: 400 }, rects)).toBeNull();
    expect(zoneAt({ x: 640, y: 75 }, rects)).toBe("row");
    expect(zoneAt({ x: 1200, y: 400 }, rects)).toBe("right");
  });

  it("gives the smaller zone where two overlap: the bar over a column's top, the pill inside the right column", () => {
    expect(zoneAt({ x: 100, y: 30 }, rects)).toBe("bar");
    const pill = FOLD_ZONE(16);
    expect(zoneAt({ x: DESKTOP_LAYOUT_WIDTH - 16 - pill.width / 2, y: 70 + 16 + 10 }, rects)).toBe(
      "fold",
    );
  });
});

describe("dropOutcome", () => {
  it("writes nothing over no zone or the menu's own, and the card's patch over another", () => {
    expect(dropOutcome("pages", null, doc)).toEqual({ kind: "none" });
    expect(dropOutcome("pages", "bar", doc)).toEqual({ kind: "none" });
    const left = dropOutcome("pages", "left", doc);
    expect(left.kind).toBe("write");
    if (left.kind !== "write") throw new Error("unreachable");
    expect(setHeader(doc, left.patch).header?.pages?.position).toBe("left");
    // Back to the bar drops the key, as the card does.
    const placed = setHeader(doc, left.patch);
    const back = dropOutcome("pages", "bar", placed);
    if (back.kind !== "write") throw new Error("expected a write");
    expect(setHeader(placed, back.patch).header?.pages?.position).toBeUndefined();
  });

  it("refuses a sections-only word for the pages", () => {
    expect(dropOutcome("pages", "fold", doc)).toEqual({ kind: "none" });
    expect(dropOutcome("pages", "row", doc)).toEqual({ kind: "none" });
    expect(dropOutcome("sections", "fold", doc).kind).toBe("write");
  });
});

describe("the words", () => {
  it("names the menu and its new place in the panel's own words, in Spanish", () => {
    expect(menuName("pages")).toBe("Menú de páginas");
    expect(dropText("pages", "left")).toBe("Menú de páginas: columna izquierda");
    expect(dropText("sections", "fold")).toBe("Navegador de secciones: desplegable «Ir a…»");
    expect(stackedText("pages")).toBe("Se apila bajo el menú de páginas");
    expect(stackedText("sections")).toBe("Se apila bajo el navegador de secciones");
  });
});
