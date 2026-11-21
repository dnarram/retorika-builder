import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Background } from "../src/background.ts";
import { contrastRatio, mixHex } from "../src/colour.ts";
import type { RetorikaDocument } from "../src/document.ts";
import { imageSourcesOf, rewriteImageSources } from "../src/images.ts";
import { parseDocument } from "../src/parse.ts";
import { setBackground } from "../src/setBackground.ts";
import { VEIL_TEXT_KEYS, type VeilColours, veilFor } from "../src/veil.ts";

/**
 * A background with motifs (ADR 0081, sprint 40 día 5): the record, the one verb that writes it,
 * the walk that bundles its picture, and the veil the words over it need.
 */

const DOCUMENTS = join(import.meta.dirname, "..", "..", "..", "fixtures", "documents");
const fixture = (name: string): RetorikaDocument =>
  parseDocument(JSON.parse(readFileSync(join(DOCUMENTS, `${name}.json`), "utf8")));

const motif: Background = {
  src: "bg-0a1b2c3d.png",
  width: 320,
  height: 320,
  paint: "tile",
  extremes: { darkest: "#1B2A4A", lightest: "#F2E8DA" },
};

/** The neutral palette's colours, as every site starts. */
const NEUTRAL: VeilColours = {
  "color.surface": "#FFFFFF",
  "color.ink": "#0F172A",
  "color.primary": "#156FE7",
  "color.secondary": "#105CB1",
  "color.muted": "#475569",
};

describe("veilFor", () => {
  const clears = (colours: VeilColours, under: string, alpha: number) =>
    VEIL_TEXT_KEYS.every(
      (key) =>
        contrastRatio(colours[key], mixHex(colours["color.surface"], under, alpha / 100)) >= 4.5,
    );

  it("is the least opacity at which every text colour reads over both extremes", () => {
    const alpha = veilFor(NEUTRAL, { darkest: "#000000", lightest: "#FFFFFF" });
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThanOrEqual(100);
    expect(clears(NEUTRAL, "#000000", alpha)).toBe(true);
    expect(clears(NEUTRAL, "#FFFFFF", alpha)).toBe(true);
    expect(clears(NEUTRAL, "#000000", alpha - 1) && clears(NEUTRAL, "#FFFFFF", alpha - 1)).toBe(
      false,
    );
  });

  it("needs no veil at all for a motif as pale as the surface, and most of one for black on white", () => {
    expect(veilFor(NEUTRAL, { darkest: "#F8FAFC", lightest: "#FFFFFF" })).toBe(0);
    expect(veilFor(NEUTRAL, { darkest: "#000000", lightest: "#FFFFFF" })).toBeGreaterThan(60);
  });

  it("grows with the motif's darkness, never the other way", () => {
    let last = -1;
    for (const darkest of ["#F0F0F0", "#C0C0C0", "#909090", "#606060", "#303030", "#000000"]) {
      const alpha = veilFor(NEUTRAL, { darkest, lightest: "#FFFFFF" });
      expect(alpha, darkest).toBeGreaterThanOrEqual(last);
      last = alpha;
    }
  });

  it("changes with the palette: a dark surface needs a different veil for the same motif", () => {
    const dark: VeilColours = {
      "color.surface": "#0F172A",
      "color.ink": "#F8FAFC",
      "color.primary": "#93C5FD",
      "color.secondary": "#BFDBFE",
      "color.muted": "#CBD5E1",
    };
    const extremes = { darkest: "#1B2A4A", lightest: "#F2E8DA" };
    expect(veilFor(dark, extremes)).not.toBe(veilFor(NEUTRAL, extremes));
  });

  it("is a whole hundredth, the same every time", () => {
    const extremes = { darkest: "#1B2A4A", lightest: "#F2E8DA" };
    const alpha = veilFor(NEUTRAL, extremes);
    expect(Number.isInteger(alpha)).toBe(true);
    expect(veilFor(NEUTRAL, extremes)).toBe(alpha);
  });
});

describe("setBackground", () => {
  const doc = fixture("cover-and-services");

  it("writes a background under the site and takes it off again, the key going with it", () => {
    const withSite = setBackground(doc, { kind: "site" }, motif);
    expect(withSite.background).toEqual(motif);
    const off = setBackground(withSite, { kind: "site" }, null);
    expect(Object.hasOwn(off, "background")).toBe(false);
    expect(off).toEqual(doc);
  });

  it("writes a background under one section and leaves the others alone", () => {
    const withSection = setBackground(doc, { kind: "section", sectionId: "sec-services" }, motif);
    const services = withSection.pages[0]?.sections.find((s) => s.id === "sec-services");
    const cover = withSection.pages[0]?.sections.find((s) => s.id === "sec-cover");
    expect(services?.background).toEqual(motif);
    expect(cover && Object.hasOwn(cover, "background")).toBe(false);
    const off = setBackground(withSection, { kind: "section", sectionId: "sec-services" }, null);
    expect(off).toEqual(doc);
  });

  it("gives the very same document back for the same value, so no history step opens", () => {
    const withSite = setBackground(doc, { kind: "site" }, motif);
    expect(setBackground(withSite, { kind: "site" }, { ...motif })).toBe(withSite);
    expect(setBackground(doc, { kind: "site" }, null)).toBe(doc);
    expect(setBackground(doc, { kind: "section", sectionId: "sec-cover" }, null)).toBe(doc);
  });

  it("refuses a section that is not there, and a record the schema refuses", () => {
    expect(() => setBackground(doc, { kind: "section", sectionId: "sec-nowhere" }, motif)).toThrow(
      /no section/,
    );
    const reversed = { ...motif, extremes: { darkest: "#F2E8DA", lightest: "#1B2A4A" } };
    expect(() => setBackground(doc, { kind: "site" }, reversed)).toThrow();
  });
});

describe("the image walk, with backgrounds", () => {
  const doc = setBackground(
    setBackground(fixture("cover-and-services"), { kind: "site" }, motif),
    { kind: "section", sectionId: "sec-services" },
    { ...motif, src: "bg-9f8e7d6c.jpg", paint: "cover" },
  );

  it("names the site's background after the logo and before the pages, and a section's with its place", () => {
    const sources = imageSourcesOf(doc);
    expect(sources[0]).toEqual({
      kind: "background",
      src: "bg-0a1b2c3d.png",
      scope: { kind: "site" },
    });
    expect(sources.find((s) => s.kind === "background" && s.scope.kind === "section")).toEqual({
      kind: "background",
      src: "bg-9f8e7d6c.jpg",
      scope: { kind: "section", pageId: "home", sectionId: "sec-services" },
    });
  });

  it("rewrites both srcs, and returns the same document when nothing moves", () => {
    const moved = rewriteImageSources(doc, (src) => `assets/${src}`);
    expect(moved.background?.src).toBe("assets/bg-0a1b2c3d.png");
    expect(moved.pages[0]?.sections.find((s) => s.id === "sec-services")?.background?.src).toBe(
      "assets/bg-9f8e7d6c.jpg",
    );
    expect(rewriteImageSources(doc, (src) => src)).toBe(doc);
  });
});
