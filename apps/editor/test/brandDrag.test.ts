import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOGO_HEIGHTS } from "@retorika/renderer";
import { parseDocument, type RetorikaDocument, setHeader } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  BRAND_PLACES,
  brandDropOutcome,
  brandDropText,
  brandZoneRects,
  brandZonesFor,
  logoDropOutcome,
  logoDropText,
  logoStep,
  pulledHeight,
  stepOf,
} from "../src/editor/brandDrag.ts";
import { brandPlacePatch, headerStateFor, logoSizePatch } from "../src/editor/headerState.ts";
import { zoneAt } from "../src/editor/menuDrag.ts";
import { DESKTOP_LAYOUT_WIDTH, NARROWEST_WIDTH } from "../src/editor/overflowCheck.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * The brand dragged to its place and the logo stretched to its size (ADR 0069, 0070; sprint 35
 * día 6): the judgement without the DOM. The document is the corpus's `cabecera-con-marca`, the
 * logo site; the bar's box is the canvas at 1280 with a bar of 70 px.
 */

const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures", "documents");
const doc = parseDocument(
  JSON.parse(readFileSync(join(FIXTURES, "cabecera-con-marca.json"), "utf8")),
) as RetorikaDocument;
const brandOf = (d: RetorikaDocument) => headerStateFor(d, undefined).brand;
const with_ = (d: RetorikaDocument, header: Record<string, unknown>) =>
  parseDocument(setHeader(d, header as never));
const BAR = { left: 0, top: 0, width: DESKTOP_LAYOUT_WIDTH, height: 70 };

describe("brandZonesFor", () => {
  it("gives the three places in the panel's words, the brand's own marked", () => {
    const zones = brandZonesFor(brandOf(doc), DESKTOP_LAYOUT_WIDTH);
    expect(zones.map((z) => z.zone)).toEqual(["start", "center", "end"]);
    expect(zones.map((z) => z.label)).toEqual(["Al principio", "En medio", "Al final"]);
    expect(zones.map((z) => z.current)).toEqual([true, false, false]);
    const centred = with_(doc, { brand: { ...doc.header?.brand, place: "center" } });
    expect(brandZonesFor(brandOf(centred), DESKTOP_LAYOUT_WIDTH).map((z) => z.current)).toEqual([
      false,
      true,
      false,
    ]);
    // Stacked with no word: the renderer's own place is the centre, and the centre is marked.
    const stacked = with_(doc, { layout: "stacked" });
    expect(brandZonesFor(brandOf(stacked), DESKTOP_LAYOUT_WIDTH)[1]?.current).toBe(true);
  });

  it("is empty in the phone view, with no brand, and with the brand in a column", () => {
    expect(brandZonesFor(brandOf(doc), NARROWEST_WIDTH)).toEqual([]);
    const bare = with_(doc, { brand: undefined });
    expect(brandOf(bare).shown).toBe(false);
    expect(brandZonesFor(brandOf(bare), DESKTOP_LAYOUT_WIDTH)).toEqual([]);
    const railed = with_(doc, { pages: { shown: true, position: "left" }, brandWithPages: true });
    expect(brandOf(railed).inRail).toBe(true);
    expect(brandZonesFor(brandOf(railed), DESKTOP_LAYOUT_WIDTH)).toEqual([]);
  });
});

describe("brandZoneRects and zoneAt", () => {
  const zones = brandZonesFor(brandOf(doc), DESKTOP_LAYOUT_WIDTH);
  const rects = brandZoneRects(zones, BAR);

  it("cuts the bar in thirds, left to right, in the bar's own box", () => {
    expect(rects.map((r) => r.zone)).toEqual(BRAND_PLACES);
    const third = DESKTOP_LAYOUT_WIDTH / 3;
    expect(rects.map((r) => Math.round(r.left))).toEqual([
      0,
      Math.round(third),
      Math.round(2 * third),
    ]);
    for (const r of rects) {
      expect(r.width).toBeCloseTo(third, 6);
      expect([r.top, r.height]).toEqual([0, 70]);
    }
    // A bar that does not start at the frame's edge — a rail beside it — keeps its own thirds.
    const beside = brandZoneRects(zones, { left: 240, top: 0, width: 1040, height: 60 });
    expect(beside.map((r) => r.left)).toEqual([240, 240 + 1040 / 3, 240 + (2 * 1040) / 3]);
  });

  it("answers the place under a point, and null off the bar", () => {
    expect(zoneAt({ x: 10, y: 35 }, rects)).toBe("start");
    expect(zoneAt({ x: 640, y: 35 }, rects)).toBe("center");
    expect(zoneAt({ x: 1270, y: 35 }, rects)).toBe("end");
    // The boundary belongs to the zone on its right, as every zone does (`zoneAt`).
    expect(zoneAt({ x: DESKTOP_LAYOUT_WIDTH / 3, y: 35 }, rects)).toBe("center");
    expect(zoneAt({ x: 640, y: 71 }, rects)).toBeNull();
    expect(zoneAt({ x: 640, y: -1 }, rects)).toBeNull();
  });
});

describe("brandDropOutcome", () => {
  it("writes nothing over no zone or the place the brand is drawn at, and the segment's patch elsewhere", () => {
    const brand = brandOf(doc);
    expect(brandDropOutcome(null, brand, doc)).toEqual({ kind: "none" });
    // The layout's own place with the key absent: drawn at the start, so the start writes nothing.
    expect(brandDropOutcome("start", brand, doc)).toEqual({ kind: "none" });
    const centre = brandDropOutcome("center", brand, doc);
    expect(centre).toEqual({
      kind: "write",
      zone: "center",
      patch: brandPlacePatch(doc, "center"),
    });
    // Stacked: the renderer's place is the centre; the centre writes nothing, the start does.
    const stacked = with_(doc, { layout: "stacked" });
    expect(brandDropOutcome("center", brandOf(stacked), stacked)).toEqual({ kind: "none" });
    expect(brandDropOutcome("start", brandOf(stacked), stacked).kind).toBe("write");
  });
});

describe("logoStep", () => {
  it("lands on the size nearest the height the hand has reached, larger on a tie", () => {
    expect(logoStep(40, 0).size).toBe("md");
    expect(logoStep(40, 20).size).toBe("lg");
    expect(logoStep(40, -10).size).toBe("sm");
    expect(logoStep(40, -4).size).toBe("md");
    expect(logoStep(40, 100).size).toBe("lg");
    expect(logoStep(40, -100).size).toBe("sm");
    // 48 is as far from 40 as from 56: the larger wins.
    expect(logoStep(40, 8).size).toBe("lg");
    // From a large logo, pulling in by 16 reaches 40 exactly.
    expect(logoStep(56, -16).size).toBe("md");
  });

  it("says the word and the pixels the page draws, in Spanish", () => {
    expect(logoStep(40, 20)).toEqual(stepOf("lg"));
    expect(stepOf("lg")).toEqual({ size: "lg", px: LOGO_HEIGHTS.lg, label: "Grande · 56 px" });
    expect(stepOf("sm").label).toBe("Pequeño · 28 px");
    expect(stepOf("md").label).toBe("Normal · 40 px");
  });

  it("measures a pull by the edge held: down, across scaled to the logo's ratio, or the larger of the two", () => {
    const square = { width: 40, height: 40 };
    const from = { x: 100, y: 100 };
    expect(pulledHeight(from, { x: 100, y: 120 }, square, "bottom")).toBe(20);
    expect(pulledHeight(from, { x: 120, y: 100 }, square, "right")).toBe(20);
    expect(pulledHeight(from, { x: 120, y: 105 }, square, "se")).toBe(20);
    // A wide logo: twenty pixels across is ten of height.
    expect(pulledHeight(from, { x: 120, y: 100 }, { width: 80, height: 40 }, "right")).toBe(10);
    expect(pulledHeight(from, { x: 100, y: 120 }, { width: 80, height: 40 }, "right")).toBe(0);
  });

  it("writes the size's patch, and nothing at the size the logo has", () => {
    const brand = brandOf(doc);
    expect(logoDropOutcome(null, brand, doc)).toEqual({ kind: "none" });
    expect(logoDropOutcome(stepOf("md"), brand, doc)).toEqual({ kind: "none" });
    expect(logoDropOutcome(stepOf("lg"), brand, doc)).toEqual({
      kind: "write",
      size: "lg",
      patch: logoSizePatch(doc, "lg"),
    });
    const large = with_(doc, { brand: { ...doc.header?.brand, logoSize: "lg" } });
    expect(logoDropOutcome(stepOf("lg"), brandOf(large), large)).toEqual({ kind: "none" });
    expect(logoDropOutcome(stepOf("md"), brandOf(large), large)).toEqual({
      kind: "write",
      size: "md",
      patch: logoSizePatch(large, "md"),
    });
  });
});

describe("the words", () => {
  it("names the brand's new place and the logo's new size in the panel's own words", () => {
    expect(brandDropText("center")).toBe("Marca: en medio");
    expect(brandDropText("end")).toBe("Marca: al final");
    expect(logoDropText("lg")).toBe("Logo: grande");
    expect(es["editor.brandDrag.name"]).toBe("Marca");
    // The panel names the gesture and the double click, in the desktop view only.
    expect(es["editor.menuPanel.brandGesture"]).toMatch(/arrastrar la marca/);
    expect(es["editor.menuPanel.brandGesture"]).toMatch(/doble clic/);
  });
});
