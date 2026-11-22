import { type Browser, chromium } from "@playwright/test";
import { contrastRatio, mixHex, type RetorikaDocument, veilFor } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GLASS_MIX } from "../src/header.ts";
import { render } from "../src/index.ts";
import { closeCombination, openHtml } from "./browser-fixtures.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * **A background with motifs, measured in Chromium** (ADR 0081, sprint 40 día 5; David's adjustment
 * 3 approving the sprint): the site's picture is never painted between the cover's photograph and
 * the words over it, and the fixed bar's glass still reads over the veiled motif once the page has
 * scrolled. The stylesheet's rules are asserted in `background.test.ts`; this opens the published
 * page and reads what the browser computed.
 */

const fixture = (): RetorikaDocument => {
  const found = loadCorpus().find((entry) => entry.name === "fondo-con-motivos");
  if (!found) throw new Error("no corpus fixture fondo-con-motivos");
  return found.document;
};

/** The alpha of a computed colour Chromium writes as `color(srgb r g b / a)` or `rgba(…)`. */
function alphaOf(computed: string): number {
  const slash = /\/\s*([0-9.]+)\s*\)$/.exec(computed);
  if (slash?.[1]) return Number(slash[1]);
  const rgba = /^rgba?\([^)]*?,\s*([0-9.]+)\)$/.exec(computed);
  return rgba?.[1] ? Number(rgba[1]) : 1;
}

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

describe("a background with motifs, in Chromium", () => {
  it("lies under everything: the cover's words sit on their panel over the photograph, and nothing between them paints the picture", async () => {
    const doc = fixture();
    const page = await openHtml(browser, render(doc, "html").html, 1280, "fondo-con-motivos");
    try {
      const read = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        if (!h1) throw new Error("no h1");
        const box = h1.getBoundingClientRect();
        const stack = document.elementsFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        const name = (el: Element) =>
          `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(" ")[0]}` : ""}`;
        const h1At = stack.indexOf(h1);
        const bodyAt = stack.indexOf(document.body);
        const between = stack.slice(h1At + 1, bodyAt).map((el) => ({
          name: name(el),
          image: getComputedStyle(el).backgroundImage,
        }));
        // The panel under the words is `pointer-events: none`, so the pointer never meets it: read
        // it by name instead — where it is, what it paints, and that it lies over the photograph.
        const panel = document.querySelector(".rb-panel");
        const img = document.querySelector(".rb-cover img");
        if (!panel || !img) throw new Error("no panel or no cover photograph");
        const p = panel.getBoundingClientRect();
        const panelHolds = {
          words:
            p.left <= box.left &&
            p.right >= box.right &&
            p.top <= box.top &&
            p.bottom >= box.bottom,
          background: getComputedStyle(panel).backgroundColor,
          zIndex: getComputedStyle(panel).zIndex,
          imgZIndex: getComputedStyle(img).zIndex,
        };
        const veil = getComputedStyle(document.body, "::before");
        return {
          order: stack.map(name),
          between,
          panel: panelHolds,
          body: {
            isolation: getComputedStyle(document.body).isolation,
            image: getComputedStyle(document.body).backgroundImage,
          },
          veil: {
            position: veil.position,
            zIndex: veil.zIndex,
            background: veil.backgroundColor,
          },
        };
      });
      // The words over the photograph under the pointer, and between them the panel of the surface:
      // it holds the words' box, paints the surface, and stacks above the photograph.
      expect(read.order.indexOf("h1"), JSON.stringify(read.order)).toBeLessThan(
        read.order.indexOf("img"),
      );
      expect(read.panel.words).toBe(true);
      expect(read.panel.background).toBe(rgbOf(doc.theme["color.surface"]));
      expect(Number(read.panel.zIndex)).toBeGreaterThan(
        read.panel.imgZIndex === "auto" ? 0 : Number(read.panel.imgZIndex),
      );
      // Nothing between the words and the body carries the picture: only the body does, and the
      // veil is the body's own child, under all of its content.
      for (const el of read.between) expect(el.image, el.name).toBe("none");
      expect(read.body.image).toContain("motivo.png");
      expect(read.body.isolation).toBe("isolate");
      expect(read.veil.position).toBe("absolute");
      expect(read.veil.zIndex).toBe("-1");
      const background = doc.background;
      if (!background) throw new Error("the fixture has a site background");
      const alpha = veilFor(
        {
          "color.surface": doc.theme["color.surface"],
          "color.ink": doc.theme["color.ink"],
          "color.primary": doc.theme["color.primary"],
          "color.secondary": doc.theme["color.secondary"],
          "color.muted": doc.theme["color.muted"],
        },
        background.extremes,
      );
      expect(alphaOf(read.veil.background)).toBeCloseTo(alpha / 100, 2);
    } finally {
      await closeCombination(page);
    }
  });

  it("keeps the fixed bar's words readable over the veiled motif once the page has scrolled", async () => {
    const doc = fixture();
    const page = await openHtml(browser, render(doc, "html").html, 1280, "fondo-con-motivos-bar");
    try {
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForFunction(() =>
        document.querySelector("header.rb-header")?.hasAttribute("data-scrolled"),
      );
      const bar = await page.evaluate(() => {
        const header = document.querySelector("header.rb-header");
        const entry = header?.querySelector("nav a");
        if (!header || !entry) throw new Error("no fixed bar with an entry");
        return {
          glass: getComputedStyle(header).backgroundColor,
          words: getComputedStyle(entry).color,
          veil: getComputedStyle(document.body, "::before").backgroundColor,
        };
      });
      // The bar is glass — the surface at GLASS_MIX — over whatever lies under it: here the veil's
      // own composite over the motif. The arithmetic is the tokens' proof, read here from what the
      // page actually computed.
      expect(alphaOf(bar.glass)).toBeCloseTo(GLASS_MIX, 2);
      const background = doc.background;
      if (!background) throw new Error("the fixture has a site background");
      const alpha = alphaOf(bar.veil);
      for (const under of [background.extremes.darkest, background.extremes.lightest]) {
        const veiled = mixHex(doc.theme["color.surface"], under, alpha);
        const glass = mixHex(doc.theme["color.surface"], veiled, GLASS_MIX);
        expect(contrastRatio(doc.theme["color.ink"], glass), under).toBeGreaterThanOrEqual(4.5);
      }
      expect(bar.words).toBe(rgbOf(doc.theme["color.ink"]));
    } finally {
      await closeCombination(page);
    }
  });
});

function rgbOf(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
