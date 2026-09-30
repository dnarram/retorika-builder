import { GALLERY_PHOTOS } from "@retorika/catalog";
import {
  MAX_PAGES,
  parseDocument,
  type RetorikaDocument,
  SCHEMA_VERSION,
  type Section,
  type StyleValue,
  setElementStyle,
  type Theme,
  TOKEN_KEYS,
} from "@retorika/schema";
import { PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { downloadGateFor, MAX_PHOTOS } from "../src/editor/downloadGate.ts";
import type { PhotoCounts } from "../src/editor/photoInventory.ts";

/**
 * `downloadGateFor` — what pressing «Descargar» does, and `MAX_PHOTOS` — the number that used to
 * be a leftover `10`, tested against the two named cases sprint 6 day 5 exists to fix.
 */

function counts(overrides: Partial<PhotoCounts>): PhotoCounts {
  const base: PhotoCounts = { empty: 0, sample: 0, own: 0, total: 0 };
  return { ...base, ...overrides };
}

/** A real palette rather than placeholder strings: the review measures the theme's own colours, so
 * a theme of `value-color.surface` would make every ratio a thrown error rather than a number. */
const classicBlue = PALETTES.find((palette) => palette.id === "classic-blue");
if (!classicBlue) throw new Error("no classic-blue palette");
const theme = {
  ...(Object.fromEntries(TOKEN_KEYS.map((key) => [key, "1rem"])) as Theme),
  ...classicBlue.colors,
} as Theme;

const section: Section = {
  id: "sec-cover",
  preset: { catalogId: "cover", variantId: "image-right" },
  source: "catalog",
  layout: null,
  content: [
    {
      id: "el-headline",
      role: "heading",
      hidden: false,
      slot: "headline",
      value: { kind: "text", text: "Barbería El Corte" },
    },
    {
      id: "el-cta",
      role: "button",
      hidden: false,
      slot: "primaryAction",
      value: { kind: "link", text: "Llamar", href: "tel:+34600111222" },
    },
    {
      id: "el-oculto",
      role: "body",
      hidden: true,
      slot: "body",
      value: { kind: "text", text: "Oculto" },
    },
  ],
};

function docWith(...styles: [elementId: string, value: StyleValue][]): RetorikaDocument {
  let doc = parseDocument({
    schemaVersion: SCHEMA_VERSION,
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
    collections: [],
  });
  for (const [elementId, value] of styles) {
    doc = setElementStyle(doc, { sectionId: "sec-cover", elementId }, "color", value);
  }
  return doc;
}

/** No exceptions at all, which is what every document this product has ever produced looks like. */
const plain = docWith();

describe("MAX_PHOTOS", () => {
  it("is derived from MAX_PAGES and the gallery's own item range, not a round number picked by feel", () => {
    expect(MAX_PHOTOS).toBe(MAX_PAGES * (GALLERY_PHOTOS.max + 1));
  });

  it("comfortably covers two galleries — the case the sprint 6 plan named as already broken", () => {
    // "Dos galerías — trivial desde que hay páginas — son 17 y la descarga se niega con un 413."
    // The old cap was 10; a single gallery alone already needed 8.
    expect(MAX_PHOTOS).toBeGreaterThan(2 * GALLERY_PHOTOS.max);
  });

  it("is well above the old value of 10 — the number this replaced", () => {
    expect(MAX_PHOTOS).toBeGreaterThan(10);
  });
});

describe("downloadGateFor", () => {
  it("is ready when nothing needs saying — an empty document", () => {
    expect(downloadGateFor(counts({}), plain)).toEqual({ kind: "ready" });
  });

  it("is ready when every photograph is already the owner's", () => {
    expect(downloadGateFor(counts({ own: 5, total: 5 }), plain)).toEqual({ kind: "ready" });
  });

  it("warns about sample photographs alone", () => {
    expect(downloadGateFor(counts({ sample: 3, total: 3 }), plain)).toEqual({
      kind: "warn",
      sample: 3,
      empty: 0,
    });
  });

  it("warns about unfilled markers alone", () => {
    expect(downloadGateFor(counts({ empty: 2, total: 2 }), plain)).toEqual({
      kind: "warn",
      sample: 0,
      empty: 2,
    });
  });

  it("warns about both at once, and reports both counts — the case a mixed site produces", () => {
    expect(downloadGateFor(counts({ sample: 1, empty: 1, own: 1, total: 3 }), plain)).toEqual({
      kind: "warn",
      sample: 1,
      empty: 1,
    });
  });

  it("does not warn about photographs already the owner's, mixed in with the rest", () => {
    const gate = downloadGateFor(counts({ own: 10, sample: 1, total: 11 }), plain);
    expect(gate.kind).toBe("warn");
    expect(gate).not.toHaveProperty("own");
  });

  it("blocks once the real files exceed MAX_PHOTOS, regardless of state", () => {
    const gate = downloadGateFor(counts({ own: MAX_PHOTOS + 1, total: MAX_PHOTOS + 1 }), plain);
    expect(gate).toEqual({ kind: "tooManyPhotos", count: MAX_PHOTOS + 1, max: MAX_PHOTOS });
  });

  it("blocking wins over warning: over the cap and carrying sample photographs still blocks", () => {
    const gate = downloadGateFor(
      counts({ own: MAX_PHOTOS, sample: 2, total: MAX_PHOTOS + 2 }),
      plain,
    );
    expect(gate.kind).toBe("tooManyPhotos");
  });

  it("is ready at exactly the cap — the boundary is inclusive, not exclusive", () => {
    expect(downloadGateFor(counts({ own: MAX_PHOTOS, total: MAX_PHOTOS }), plain).kind).not.toBe(
      "tooManyPhotos",
    );
  });

  it("never counts empty markers toward the cap — a marker needs no file", () => {
    // A document with more placeholder holes than MAX_PHOTOS is unusual but not a real bound
    // violation: nothing about an unfilled marker makes a request larger.
    const gate = downloadGateFor(counts({ empty: MAX_PHOTOS + 5, total: MAX_PHOTOS + 5 }), plain);
    expect(gate.kind).not.toBe("tooManyPhotos");
  });

  it("reproduces the case the sprint 6 plan named: two full galleries, no longer blocked", () => {
    const twoGalleries = 2 * GALLERY_PHOTOS.max; // 17 with a cover, per the plan's own count
    const gate = downloadGateFor(counts({ own: twoGalleries, total: twoGalleries }), plain);
    expect(gate.kind).not.toBe("tooManyPhotos");
  });
});

/**
 * The contrast review's place in the gate (sprint 9 day 6).
 *
 * The order is the claim worth testing: which of two true things a person is told first is a
 * decision, and this is where it is recorded as one.
 */
describe("the gate with the contrast review in it", () => {
  const unreadable = "#FDFDFD";
  const justLegible = "#949494";

  it("blocks an unreadable colour, with no way past", () => {
    const gate = downloadGateFor(
      counts({}),
      docWith(["el-headline", { exact: unreadable, exception: true }]),
    );
    expect(gate.kind).toBe("unreadable");
    if (gate.kind === "unreadable") {
      expect(gate.findings).toHaveLength(1);
      expect(gate.findings[0]?.level).toBe("block");
    }
  });

  it("puts the unreadable colour before the photo warning", () => {
    // A site whose text nobody can read is not in a state where "some of your photographs are
    // still ours" is the useful thing to say. Both are true; this is which one is said first.
    const gate = downloadGateFor(
      counts({ sample: 2, total: 2 }),
      docWith(["el-headline", { exact: unreadable, exception: true }]),
    );
    expect(gate.kind).toBe("unreadable");
  });

  it("puts the photo warning before the low-contrast warning", () => {
    // The other way round, and for the mirror reason: the photo warning is about the whole site,
    // the contrast one about a single element somebody deliberately painted.
    const gate = downloadGateFor(
      counts({ sample: 2, total: 2 }),
      docWith(["el-headline", { exact: justLegible, exception: true }]),
    );
    expect(gate.kind).toBe("warn");
  });

  it("still puts too-many-photos first of all, which fails on the server regardless", () => {
    const gate = downloadGateFor(
      counts({ own: MAX_PHOTOS + 1, total: MAX_PHOTOS + 1 }),
      docWith(["el-headline", { exact: unreadable, exception: true }]),
    );
    expect(gate.kind).toBe("tooManyPhotos");
  });

  it("warns about a colour between the two thresholds when nothing else has anything to say", () => {
    const gate = downloadGateFor(
      counts({ own: 1, total: 1 }),
      docWith(["el-headline", { exact: justLegible, exception: true }]),
    );
    expect(gate.kind).toBe("lowContrast");
    if (gate.kind === "lowContrast") expect(gate.findings[0]?.level).toBe("warn");
  });

  it("is ready for a document that uses only references, which is every document today", () => {
    expect(
      downloadGateFor(counts({ own: 1, total: 1 }), docWith(["el-headline", { ref: "color.ink" }])),
    ).toEqual({
      kind: "ready",
    });
  });
});

/**
 * Going past one warning is going past **that** warning.
 *
 * Found by walking the download: a site with an unfilled photo marker *and* a hard-to-read colour
 * showed the photo warning, and «Descargar igualmente» downloaded — so the second warning was never
 * said at all. Both were true; the owner was told one of them.
 */
describe("two warnings are two warnings", () => {
  const justLegible = "#808080";

  it("says the photo warning first, then the contrast one, then downloads", () => {
    const doc = docWith(["el-headline", { exact: justLegible, exception: true }]);
    const photos = counts({ empty: 1, total: 1 });

    expect(downloadGateFor(photos, doc).kind).toBe("warn");
    expect(downloadGateFor(photos, doc, new Set(["photos"])).kind).toBe("lowContrast");
    expect(downloadGateFor(photos, doc, new Set(["photos", "contrast"]))).toEqual({
      kind: "ready",
    });
  });

  it("does not let a block be accepted, which is what a block means", () => {
    const doc = docWith(["el-headline", { exact: "#FDFDFD", exception: true }]);
    // Every combination a caller could pass, including ones the interface never produces.
    for (const accepted of [[], ["photos"], ["contrast"], ["photos", "contrast"]] as const) {
      expect(
        downloadGateFor(counts({ empty: 1, total: 1 }), doc, new Set(accepted)).kind,
        accepted.join("+") || "none",
      ).toBe("unreadable");
    }
  });

  it("accepting a warning that was never raised changes nothing", () => {
    expect(downloadGateFor(counts({ own: 1, total: 1 }), plain, new Set(["contrast"]))).toEqual({
      kind: "ready",
    });
  });
});
