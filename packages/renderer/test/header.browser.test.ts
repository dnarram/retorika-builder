import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { type Header, parseDocument, type RetorikaDocument } from "@retorika/schema";
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

/** `withLogo` with each menu placed: the corpus's long name, a logo, «Contacto» as the button. */
function placed(header: Partial<Header>): RetorikaDocument {
  const doc = withLogo();
  return parseDocument({ ...doc, header: { ...doc.header, ...header } });
}

/**
 * The home page with eight sections that lend an entry — «Servicios» and seven more, the last as
 * long as a label may be (20 characters) — so a column has more than a window holds when it is short.
 */
function eightSections(doc: RetorikaDocument): RetorikaDocument {
  const home = doc.pages[0];
  const services = home?.sections.find((s) => s.id === "sec-services-home");
  if (!home || !services) throw new Error("no home page or no services section");
  const labels = [
    "Carta del día",
    "Vinos de la casa",
    "Raciones",
    "Postres",
    "Menú de grupos",
    "Terraza",
    "Reservas para grupos",
  ];
  const more = labels.map((menuLabel, i) => ({ ...services, id: `sec-extra-${i}`, menuLabel }));
  const at = home.sections.indexOf(services) + 1;
  return parseDocument({
    ...doc,
    pages: [
      { ...home, sections: [...home.sections.slice(0, at), ...more, ...home.sections.slice(at)] },
      ...doc.pages.slice(1),
    ],
  });
}

type Box = { left: number; top: number; right: number; bottom: number };

/** The boxes of the given selectors as drawn — `null` for one that is absent or not rendered. */
async function boxes(
  page: Page,
  selectors: Record<string, string>,
): Promise<Record<string, Box | null>> {
  return page.evaluate((wanted) => {
    const out: Record<string, { left: number; top: number; right: number; bottom: number } | null> =
      {};
    for (const [name, selector] of Object.entries(wanted)) {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el?.checkVisibility()) {
        out[name] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      out[name] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return out;
  }, selectors);
}

/** Whether two boxes share any area. Touching edges do not count: a box under another, flush, is
 * exactly what «under the bar» means. */
function overlap(a: Box | null | undefined, b: Box | null | undefined): boolean {
  if (!a || !b) return false;
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Opens «Ir a…» and waits for its panel to finish coming in: measured mid-way, it is 4 px higher
 * than where it stays (the animation's start), and read as covering the bar's last pixels. */
async function openFold(page: Page): Promise<void> {
  await page.click(".rb-nav-fold > summary");
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
}

/** What a token resolves to on this page, in pixels. */
async function tokenPx(page: Page, token: string): Promise<number> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.height = `var(${name})`;
    document.body.append(probe);
    const px = probe.getBoundingClientRect().height;
    probe.remove();
    return px;
  }, token);
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

  it("walks skip link, pages, button, the sections' rail on the right, then the page (ADR 0060)", async () => {
    // The home page, where the brand is a span and no stop (above). **The order of the document is
    // the order of reading**: the rail stands at the right edge of the screen and is reached after
    // the bar and before the content, which is where it sits in the markup — the eye reads a page
    // with a column beside it the same way, header first, then the column, then the page.
    const page = await open(placed({ sections: { shown: true, position: "right" } }), 1280, 900);
    try {
      const stops = [];
      for (let i = 0; i < 6; i += 1) stops.push(await tab(page));
      expect(stops.slice(0, 5).map((s) => [s.text, s.href])).toEqual([
        ["Saltar al contenido", "#rb-main"],
        ["Qué ponemos", "./que-ponemos.html"],
        ["Dónde", "./donde-estamos.html"],
        ["Contacto", "#sec-contact"],
        ["Servicios", "#sec-services-home"],
      ]);
      const where = await page.evaluate(() => ({
        rail: document.activeElement?.closest(".rb-rail") !== null,
        main: document.activeElement?.closest("main") !== null,
      }));
      expect(where, `sixth stop: ${JSON.stringify(stops[5])}`).toEqual({ rail: false, main: true });
      // The fifth was the rail's copy, not the bar's hidden one.
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(() =>
          document.activeElement?.closest(".rb-rail")?.getAttribute("data-side"),
        ),
      ).toBe("right");
    } finally {
      await page.context().close();
    }
  });
});

describe("the rail (ADR 0060)", () => {
  /** The pages, the brand and the eight sections in one left rail: the fullest column there is. */
  const fullest = () =>
    eightSections(
      placed({
        pages: { shown: true, position: "left" },
        sections: { shown: true, position: "left" },
        brandWithPages: true,
      }),
    );

  async function railFacts(page: Page) {
    return page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('.rb-rail[data-side="left"]');
      if (!rail?.checkVisibility()) throw new Error("no rail drawn");
      const r = rail.getBoundingClientRect();
      const entries = [...rail.querySelectorAll<HTMLElement>("a, .rb-brand")];
      return {
        width: rail.offsetWidth,
        entries: rail.querySelectorAll(".rb-nav a").length,
        widest: Math.max(...entries.map((el) => el.getBoundingClientRect().right)) - r.left,
        railRight: r.right - r.left,
        bottom: r.bottom,
        scrollsDown: rail.scrollHeight > rail.clientHeight,
        scrollsAcross: rail.scrollWidth > rail.clientWidth,
        logoLoaded: [...rail.querySelectorAll<HTMLImageElement>("img.rb-logo")].every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
        pageScroll: document.documentElement.scrollWidth - innerWidth,
      };
    });
  }

  it("holds a logo and ten entries at 1280×720 inside its 240px, and nothing runs across", async () => {
    const page = await open(fullest(), 1280, 720);
    try {
      const facts = await railFacts(page);
      expect(facts.logoLoaded, "the logo did not load, so nothing was measured").toBe(true);
      // Two pages and eight sections.
      expect(facts.entries).toBe(10);
      expect(facts.width).toBeLessThanOrEqual(256);
      // No entry, the long one and the brand with its long name included, is wider than the rail.
      expect(facts.widest).toBeLessThanOrEqual(facts.railRight + 0.5);
      expect(facts.scrollsAcross).toBe(false);
      expect(facts.bottom).toBeLessThanOrEqual(720);
      expect(facts.pageScroll).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  it("scrolls down inside itself, and never the page, when the window is shorter than it", async () => {
    const page = await open(fullest(), 1280, 400);
    try {
      const facts = await railFacts(page);
      expect(facts.scrollsDown, "at 400px tall the column fitted, so nothing was proved").toBe(
        true,
      );
      expect(facts.scrollsAcross).toBe(false);
      expect(facts.bottom).toBeLessThanOrEqual(400);
      // The last entry is reachable: scrolled into view inside the rail, it is inside the window.
      const last = await page.evaluate(() => {
        const rail = document.querySelector<HTMLElement>('.rb-rail[data-side="left"]');
        const link = [...(rail?.querySelectorAll<HTMLElement>(".rb-nav a") ?? [])].at(-1);
        if (!rail || !link) throw new Error("no last entry");
        rail.scrollTop = rail.scrollHeight;
        return { bottom: link.getBoundingClientRect().bottom, pageY: scrollY };
      });
      expect(last.bottom).toBeLessThanOrEqual(400);
      expect(last.pageY).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  /** `<main>`'s width and which menus stand in a rail, at one width. */
  async function columns(doc: RetorikaDocument, width: number) {
    const page = await open(doc, width, 900);
    try {
      return await page.evaluate(() => ({
        main: Math.round(document.querySelector("main")?.getBoundingClientRect().width ?? 0),
        rails: [...document.querySelectorAll<HTMLElement>(".rb-rail")]
          .filter((rail) => rail.checkVisibility())
          .map((rail) => rail.getAttribute("data-side")),
        inBar: [...document.querySelectorAll<HTMLElement>(".rb-nav-wide > nav")]
          .filter((nav) => nav.checkVisibility())
          .map((nav) => nav.getAttribute("aria-label")),
        scroll: document.documentElement.scrollWidth - innerWidth,
      }));
    } finally {
      await page.context().close();
    }
  }

  it("stands as three columns at 1280 and lets the sections fall into the bar at 1247", async () => {
    const doc = placed({
      pages: { shown: true, position: "left" },
      sections: { shown: true, position: "right" },
    });
    expect(await columns(doc, 1280)).toEqual({
      main: 800,
      rails: ["left", "right"],
      inBar: [],
      scroll: 0,
    });
    expect(await columns(doc, 1247)).toEqual({
      main: 1247 - 240,
      rails: ["left"],
      inBar: ["Secciones"],
      scroll: 0,
    });
  });

  it("stands at 1024 with 784 for the content, and falls into the bar at 1023", async () => {
    const doc = placed({ pages: { shown: true, position: "right" } });
    expect(await columns(doc, 1024)).toEqual({
      main: 784,
      rails: ["right"],
      inBar: [],
      scroll: 0,
    });
    expect(await columns(doc, 1023)).toEqual({
      main: 1023,
      rails: [],
      inBar: ["Páginas"],
      scroll: 0,
    });
  });
});

/**
 * **«Ir a…» covers nothing of the header** (David's condition on planning sprint 31, and his
 * adjustment 2 with its erratum on approving it). On a wide screen it floats under the bar; measured
 * here against the bar, the button and a right rail, closed and open, with a fixed bar at the top and
 * further down, and with a bar in the flow at the top of the page — the case a `top` without the bar's
 * height would have drawn over the button. And the sum itself, in pixels: its top is the bar's bottom
 * plus `space.md`. With the sign turned, both go red: the disclosure rises into the bar.
 */
describe("«Ir a…» under the bar", () => {
  const FOLD = { sections: { shown: true, position: "fold" as const, mobile: "fold" as const } };
  const cases: [string, Partial<Header>][] = [
    ["a bar in the flow", FOLD],
    ["a fixed bar", { ...FOLD, sticky: true }],
    ["the pages in a right rail", { ...FOLD, pages: { shown: true, position: "right" } }],
    [
      "the pages in a right rail, with the brand",
      {
        ...FOLD,
        pages: { shown: true, position: "right" },
        brandWithPages: true,
      },
    ],
  ];

  for (const [name, header] of cases) {
    for (const scrolled of [0, 600]) {
      it(`covers neither the bar nor the button nor a rail at 1280, ${name}, scrolled ${scrolled}px`, async () => {
        const page = await open(placed(header), 1280, 720);
        try {
          await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scrolled);
          const md = await tokenPx(page, "--space-md");
          for (const state of ["closed", "open"] as const) {
            if (state === "open") await openFold(page);
            const b = await boxes(page, {
              header: "header.rb-header",
              action: "header > .rb-nav-action",
              rail: ".rb-rail",
              fold: ".rb-nav-fold",
              panel: ".rb-nav-fold[open] > .rb-nav",
              brand: "header > .rb-brand",
            });
            const where = `${name}, scrolled ${scrolled}, ${state}: ${JSON.stringify(b)}`;
            expect(b.fold, where).not.toBeNull();
            if (state === "open") expect(b.panel, where).not.toBeNull();
            for (const part of [b.fold, b.panel]) {
              // The header box is the bar: zero tall when it has collapsed, and then nothing to cover.
              expect(overlap(part, b.header), where).toBe(false);
              expect(overlap(part, b.action), where).toBe(false);
              expect(overlap(part, b.brand), where).toBe(false);
              expect(overlap(part, b.rail), where).toBe(false);
            }
            // The sum, in pixels, wherever the bar is: under it by `space.md` when it is in view.
            const barBottom = Math.max(0, b.header?.bottom ?? 0);
            const barHeight = (b.header?.bottom ?? 0) - (b.header?.top ?? 0);
            const expectedTop = scrolled === 0 || header.sticky ? barBottom + md : barHeight + md;
            expect(b.fold?.top ?? 0, where).toBeGreaterThanOrEqual(expectedTop - 1);
            expect(b.fold?.top ?? 0, where).toBeLessThanOrEqual(expectedTop + 1);
          }
        } finally {
          await page.context().close();
        }
      });
    }
  }

  it("goes to the free side when the pages' rail is on the right", async () => {
    const page = await open(placed(cases[2]?.[1] ?? {}), 1280, 720);
    try {
      const b = await boxes(page, { fold: ".rb-nav-fold", rail: ".rb-rail" });
      expect(b.rail?.left).toBe(1280 - 240);
      expect(b.fold?.left).toBeLessThan(640);
    } finally {
      await page.context().close();
    }
  });

  it("is no height of bar when it has the bar to itself, and hangs a space from the top", async () => {
    const page = await open(
      placed({ ...FOLD, brand: undefined, action: undefined, pages: { shown: false } }),
      1280,
      720,
    );
    try {
      const md = await tokenPx(page, "--space-md");
      const b = await boxes(page, { header: "header.rb-header", fold: ".rb-nav-fold" });
      expect((b.header?.bottom ?? -1) - (b.header?.top ?? 0)).toBe(0);
      expect(Math.round(b.fold?.top ?? 0)).toBe(Math.round(md));
    } finally {
      await page.context().close();
    }
  });
});

describe("«Ir a…» on the phone", () => {
  const FOLD = { sections: { shown: true, position: "fold" as const, mobile: "fold" as const } };

  it("keeps the bar at or under 72px at 320 with a long name, a logo, the button, «Ir a…» and «Menú»", async () => {
    const page = await open(placed(FOLD), 320, 568);
    try {
      const b = await boxes(page, {
        header: "header.rb-header",
        logo: "header > .rb-brand img.rb-logo",
        action: "header > .rb-nav-action",
        fold: "header > .rb-nav-fold > summary",
        menu: "header > .rb-nav-narrow > summary",
      });
      const where = JSON.stringify(b);
      for (const part of ["logo", "action", "fold", "menu"])
        expect(b[part], `${part}: ${where}`).not.toBeNull();
      expect((b.header?.bottom ?? 99) - (b.header?.top ?? 0), where).toBeLessThanOrEqual(72);
      // One line: the four share it, in this order, none over the next.
      expect((b.logo?.right ?? 999) <= (b.action?.left ?? 0), where).toBe(true);
      expect((b.action?.right ?? 999) <= (b.fold?.left ?? 0), where).toBe(true);
      expect((b.fold?.right ?? 999) <= (b.menu?.left ?? 0), where).toBe(true);
      expect(b.menu?.right ?? 999, where).toBeLessThanOrEqual(320);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
    } finally {
      await page.context().close();
    }
  });

  for (const sticky of [false, true]) {
    it(`hangs its panel under the bar at 390, covering none of it${sticky ? ", fixed" : ""}`, async () => {
      const page = await open(placed({ ...FOLD, sticky }), 390, 800);
      try {
        await openFold(page);
        const b = await boxes(page, {
          header: "header.rb-header",
          action: "header > .rb-nav-action",
          menu: "header > .rb-nav-narrow > summary",
          panel: ".rb-nav-fold[open] > .rb-nav",
        });
        const where = JSON.stringify(b);
        expect(b.panel, where).not.toBeNull();
        expect(b.panel?.top ?? 0, where).toBeGreaterThanOrEqual((b.header?.bottom ?? 0) - 1);
        expect(overlap(b.panel, b.action), where).toBe(false);
        expect(overlap(b.panel, b.menu), where).toBe(false);
        expect(b.panel?.right ?? 999, where).toBeLessThanOrEqual(390);
        // A fixed bar stays fixed with «Ir a…» on the phone: one line, not the row's two.
        expect(
          await page.evaluate(
            () => getComputedStyle(document.querySelector("header") as Element).position,
          ),
        ).toBe(sticky ? "sticky" : "relative");
      } finally {
        await page.context().close();
      }
    });
  }
});
