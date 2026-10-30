import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * **The header, in the browser that has to hold it** (ADR 0057).
 *
 * Two claims no string comparison can make, both David's conditions on approving sprint 30:
 *
 * 1. **A long business name and a logo do not break the bar on the smallest phone.** The brand is
 *    one line cut with an ellipsis, so at 320×568 the bar stays at or under 72px — under 15% of
 *    the viewport — and nothing runs past the right edge. Measured with «Taberna Santo Domingo»,
 *    which is the corpus's own long name.
 * 2. **The keyboard reaches everything in reading order**: the skip link, the brand (a link away
 *    from home), the pages, the button, the sections' row. And the brand is the *second* stop, the
 *    skip link being the first on every page that draws a header.
 */

const ORIGIN = "http://cabecera.test";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function fixture(name: string): RetorikaDocument {
  return parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, `${name}.json`), "utf8")));
}

/** `cabecera-con-marca` with a logo beside its name: the widest brand the corpus can make. */
function withLogo(): RetorikaDocument {
  const doc = fixture("cabecera-con-marca");
  return parseDocument({
    ...doc,
    header: { ...doc.header, brand: { name: true, logo: { src: "assets/portada.png" } } },
  });
}

async function open(
  doc: RetorikaDocument,
  width: number,
  height: number,
  pageId?: string,
): Promise<Page> {
  const html = render(doc, "html", pageId === undefined ? {} : { pageId }).html;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/")
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    if (url.pathname.startsWith("/assets/")) {
      return route.fulfill({
        contentType: "image/png",
        body: readFileSync(join(ASSETS_DIR, url.pathname.slice("/assets/".length))),
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.evaluate(() => Promise.allSettled([...document.images].map((img) => img.decode())));
  return page;
}

async function tab(page: Page): Promise<{ text: string; href: string; cls: string }> {
  await page.keyboard.press("Tab");
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { text: "", href: "", cls: "" };
    return {
      text: (el.textContent ?? "").trim(),
      href: el.getAttribute("href") ?? "",
      cls: el.className,
    };
  });
}

describe("the header on the smallest phone", () => {
  it("keeps the bar at or under 72px with a long name and a logo, and nothing past the edge", async () => {
    const page = await open(withLogo(), 320, 568);
    try {
      const measured = await page.evaluate(() => {
        const header = document.querySelector("header");
        const brand = document.querySelector(".rb-brand-name");
        const logo = document.querySelector<HTMLImageElement>("img.rb-logo");
        if (!header || !brand || !logo) throw new Error("no header, brand or logo");
        // The bar alone, without the sections' row under it: that row is the phone's menu and
        // scrolls with the page; the bound David set is on what sticks.
        const row = document.querySelector<HTMLElement>(".rb-nav-row");
        const rowHeight = row ? row.getBoundingClientRect().height : 0;
        return {
          header: header.getBoundingClientRect().height - rowHeight,
          logo: logo.getBoundingClientRect().height,
          logoLoaded: logo.complete && logo.naturalWidth > 0,
          ellipsis: brand.scrollWidth > brand.clientWidth,
          brandRight: brand.getBoundingClientRect().right,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });
      expect(measured.logoLoaded, "the logo did not load, so nothing was measured").toBe(true);
      expect(measured.logo).toBe(40);
      expect(measured.header, `bar is ${measured.header}px`).toBeLessThanOrEqual(72);
      // The name is cut rather than wrapped: its content is wider than its box.
      expect(measured.ellipsis, "the long name was not cut with an ellipsis").toBe(true);
      expect(measured.brandRight).toBeLessThanOrEqual(measured.innerWidth + 0.5);
      expect(measured.scrollWidth).toBeLessThanOrEqual(measured.innerWidth);
    } finally {
      await page.context().close();
    }
  });
});

describe("the bar's height when the site's letter arrives", () => {
  /**
   * Sprint 30 día 7, measured before it was written: with `line-height: normal` a line of the bar
   * took the letter's own ascent and descent, 18px in the fallback and 21px in EB Garamond, so the
   * bar grew 87 → 90px when the face arrived and pushed the whole page down — Lighthouse's 0.023 on
   * the fixed-header subject. The bar's line-height is a number now, and this swaps the letter for
   * one with very different metrics and asserts the bar does not move.
   *
   * **It carries its own control**, so it cannot pass on a machine whose fonts happen to agree: the
   * same swap with the bar forced back to `normal` must change its height, which is what proves the
   * probe letter really is drawing and really is taller.
   */
  const PROBE_FACE = join(ASSETS_DIR, "..", "fonts", "propia-3f9a7c21-regular.woff2");

  async function barHeights(width: number): Promise<{ fixed: number[]; normal: number[] }> {
    const page = await open(fixture("cabecera-con-marca"), width, 900);
    try {
      await page.route("**/probe.woff2", (route) =>
        route.fulfill({ contentType: "font/woff2", body: readFileSync(PROBE_FACE) }),
      );
      return await page.evaluate(async () => {
        const header = document.querySelector<HTMLElement>("header.rb-header");
        if (!header) throw new Error("no header");
        const style = (css: string) => {
          const el = document.createElement("style");
          el.textContent = css;
          document.head.append(el);
          return el;
        };
        const measure = () => header.getBoundingClientRect().height;
        const swap = async () => {
          const face = style(
            `@font-face { font-family: "Probe"; src: url("/probe.woff2") format("woff2");
               ascent-override: 140%; descent-override: 60%; }
             html:root { --font-heading: "Probe"; --font-body: "Probe"; }`,
          );
          await document.fonts.load('16px "Probe"');
          const faces = [...document.fonts].map((f) => `${f.family}:${f.status}`);
          if (!faces.some((f) => /^"?Probe"?:loaded$/.test(f)))
            throw new Error(`the probe letter did not load, so nothing was measured: ${faces}`);
          const height = measure();
          face.remove();
          return height;
        };
        const fixed = [measure(), await swap()];
        const reset = style(".rb-header, .rb-header * { line-height: normal !important; }");
        const normal = [measure(), await swap()];
        reset.remove();
        return { fixed, normal };
      });
    } finally {
      await page.context().close();
    }
  }

  for (const width of [1280, 390]) {
    it(`keeps its height at ${width}px whichever letter draws it`, async () => {
      const { fixed, normal } = await barHeights(width);
      // The control: with `normal`, the taller letter makes a taller bar.
      expect(normal[1], `control did not move: ${normal.join(" → ")}`).toBeGreaterThan(
        (normal[0] ?? 0) + 2,
      );
      expect(fixed[1], `the bar moved: ${fixed.join(" → ")}`).toBe(fixed[0]);
    });
  }
});

describe("the sections' row on a phone", () => {
  /** One page, five headed sections: more entries than 320px holds on one line. */
  function fiveSections(): RetorikaDocument {
    const doc = fixture("menu-explicito");
    const home = doc.pages[0];
    if (!home) throw new Error("no home page");
    const services = home.sections.find((s) => s.id === "sec-services");
    if (!services) throw new Error("no services section");
    const more = ["location", "gallery", "team"].map((kind) => ({
      ...services,
      id: `sec-${kind}`,
      preset: { catalogId: kind, variantId: "stacked" },
      content: [],
      layout: null,
    }));
    return parseDocument({
      ...doc,
      pages: [
        { ...home, sections: [home.sections[0], services, ...more, ...home.sections.slice(2)] },
      ],
    });
  }

  it("scrolls sideways inside its own box and never makes the page scroll", async () => {
    const page = await open(fiveSections(), 320, 568);
    try {
      const measured = await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>(".rb-nav-row");
        if (!row) throw new Error("no row");
        const links = [...row.querySelectorAll("a")];
        return {
          entries: links.length,
          rowRight: row.getBoundingClientRect().right,
          rowScrolls: row.scrollWidth > row.clientWidth + 0.5,
          lastLinkRight: links.at(-1)?.getBoundingClientRect().right ?? 0,
          pageScrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });
      expect(measured.entries).toBe(5);
      // The entries run past the edge inside the row — that is the scroller doing its job…
      expect(measured.rowScrolls).toBe(true);
      expect(measured.lastLinkRight).toBeGreaterThan(measured.innerWidth);
      // …and neither the row nor the page runs past it.
      expect(measured.rowRight).toBeLessThanOrEqual(measured.innerWidth + 0.5);
      expect(measured.pageScrollWidth).toBeLessThanOrEqual(measured.innerWidth);
    } finally {
      await page.context().close();
    }
  });
});

describe("the header with a keyboard", () => {
  it("walks skip link, brand, pages, button and sections' row, in that order, away from home", async () => {
    const page = await open(fixture("cabecera-con-marca"), 1280, 900, "page-que-ponemos");
    try {
      const stops = [];
      for (let i = 0; i < 6; i += 1) stops.push(await tab(page));
      expect(stops.map((s) => [s.text, s.href])).toEqual([
        ["Saltar al contenido", "#rb-main"],
        ["Taberna Santo Domingo", "./index.html"],
        ["Inicio", "./index.html"],
        // The page the visitor is on stays in the strip, marked current (ADR 0043).
        ["Qué ponemos", "./que-ponemos.html"],
        ["Dónde", "./donde-estamos.html"],
        ["Contacto", "./index.html#sec-contact"],
      ]);
      expect(stops[1]?.cls).toBe("rb-brand");
      expect(stops[5]?.cls).toBe("rb-nav-action");
      // The converted page's own section is its h1 and lends no anchor: no row, and the next stop
      // is already inside <main>.
      expect(await page.evaluate(() => document.querySelector(".rb-nav-row"))).toBeNull();
    } finally {
      await page.context().close();
    }
  });

  it("makes the brand a span on the home page, so the second stop is the first page link", async () => {
    const page = await open(fixture("cabecera-con-marca"), 1280, 900);
    try {
      expect((await tab(page)).cls).toBe("rb-skip");
      const second = await tab(page);
      expect([second.text, second.href]).toEqual(["Qué ponemos", "./que-ponemos.html"]);
    } finally {
      await page.context().close();
    }
  });

  it("lands in <main> when the skip link is pressed", async () => {
    const page = await open(fixture("cabecera-con-marca"), 1280, 900);
    try {
      await tab(page);
      await page.keyboard.press("Enter");
      // Polled: the page scrolls smoothly (ADR 0057, David's point 7), so the landing is a moment
      // later than the press — read at once, `<main>` was still 101px down.
      await expect.poll(() => page.evaluate(() => location.hash)).toBe("#rb-main");
      await expect
        .poll(() =>
          page.evaluate(() =>
            Math.round(document.querySelector("main")?.getBoundingClientRect().top ?? 1),
          ),
        )
        .toBeLessThanOrEqual(0);
    } finally {
      await page.context().close();
    }
  });
});
