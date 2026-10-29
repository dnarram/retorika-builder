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
