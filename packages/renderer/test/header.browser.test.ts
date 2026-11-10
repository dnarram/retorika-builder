import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Browser,
  type BrowserContextOptions,
  type BrowserType,
  chromium,
  firefox,
  type Page,
  webkit,
} from "@playwright/test";
import { type Header, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { buildTheme, GALLERY_FAMILIES, PALETTES, SCALES, TYPE_PAIRS } from "@retorika/tokens";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BAR_EXCESS,
  BAR_EXCESS_DIGITS,
  BAR_SIZES,
  GLYPH_ADVANCES,
  GLYPHS,
  KERNING_LABELS,
  KERNING_MARGINS,
} from "../src/glyphAdvances.ts";
import { PHONE_BAR_MAX, SCROLLBAR_LANE } from "../src/header.ts";
import { headerWidths, render, SHIPPABLE_FAMILIES } from "../src/index.ts";
import { headerCase, openHtml } from "./browser-fixtures.ts";
import { ASSETS_DIR, DOCUMENTS_DIR, loadCorpus } from "./corpus.ts";
import { checkHoldsItsLines } from "./menu-checks.ts";

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
  await page.evaluate(() => Promise.all(timed().map((a) => a.finished)));
}

/**
 * The animations that end: a section's view-timeline animation (ADR 0062) runs for as long as the page
 * can scroll and its `finished` never settles, so a wait on every animation of the document never
 * returns (measured on día 2: 60 s). Only the ones on the document's own timeline are waited for.
 * Declared on `window` for the page's own code to call.
 */
declare function timed(): Animation[];

const TIMED = `window.timed = () => document.getAnimations().filter((a) => a.timeline === document.timeline);`;

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

/**
 * The page at rest. The context asks for reduced motion (sprint 32 día 0), so a measurement is of
 * the settled page whatever the stylesheet animates; a test that measures motion itself passes
 * `motion` and gets the visitor who has not asked for less (the fold's entrance, `openFold`).
 */
async function open(
  doc: RetorikaDocument,
  width: number,
  height: number,
  pageId?: string,
  motion = false,
  extra: BrowserContextOptions & { on?: Browser } = {},
): Promise<Page> {
  const html = render(doc, "html", pageId === undefined ? {} : { pageId }).html;
  const { on, ...options } = extra;
  const context = await (on ?? browser).newContext({
    viewport: { width, height },
    reducedMotion: motion ? "no-preference" : "reduce",
    ...options,
  });
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
  await page.addInitScript(TIMED);
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

/** `withLogo` at the owner's logo size, on a scale of the system (ADR 0069). */
function withLogoSized(logoSize: "md" | "lg", scaleId: string): RetorikaDocument {
  const doc = withLogo();
  return parseDocument({
    ...doc,
    theme: buildTheme({
      paletteId: PALETTES[0]?.id ?? "",
      typePairId: TYPE_PAIRS[0]?.id ?? "",
      scaleId,
    }),
    header: { ...doc.header, brand: { ...doc.header?.brand, logoSize } },
  });
}

describe("the header on the smallest phone", () => {
  /**
   * **The large logo on a phone is what the bar can give it under 72 px** (ADR 0069, rule 7): 55 at
   * the default scale, and **47 at the generous one, which is the case that proves the cut** — 56
   * would put the bar at 81. Read off the drawn logo, against the same expression the estimate uses.
   */
  for (const [logoSize, scaleId, expected] of [
    ["md", "default", 40],
    ["lg", "default", 55],
    ["lg", "generous", 47],
  ] as const) {
    it(`keeps the bar at or under ${PHONE_BAR_MAX}px with a long name and a ${logoSize} logo (${scaleId}: ${expected} px), and nothing past the edge`, async () => {
      const page = await open(withLogoSized(logoSize, scaleId), 320, 568);
      try {
        const m = await page.evaluate(() => {
          const header = document.querySelector("header");
          const logo = document.querySelector<HTMLImageElement>("img.rb-logo");
          if (!header || !logo) throw new Error("no header or logo");
          // The bar as the audit's check 3 reads it: what stands above the sections' row.
          const row = document.querySelector<HTMLElement>(".rb-nav-row");
          const box = header.getBoundingClientRect();
          return {
            header: row ? row.getBoundingClientRect().top - box.top : box.height,
            logo: logo.getBoundingClientRect().height,
            loaded: logo.complete && logo.naturalWidth > 0,
          };
        });
        expect(m.loaded, "the logo did not load, so nothing was measured").toBe(true);
        expect(m.logo).toBe(expected);
        expect(m.header, `bar is ${m.header}px`).toBeLessThanOrEqual(PHONE_BAR_MAX);
      } finally {
        await page.context().close();
      }
    });
  }

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

  /** `<main>`'s width, which menus stand in a rail and which in the bar, and whether the bar is the
   * phone's — «Menú» drawn — at one width. The last since sprint 34 día 3: the bar folds where its
   * words do not fit (ADR 0067), and a width that says «the bar» has to say which bar it measured. */
  async function columns(doc: RetorikaDocument, width: number) {
    const page = await open(doc, width, 900);
    try {
      return await page.evaluate(() => ({
        main: Math.round(document.querySelector("main")?.getBoundingClientRect().width ?? 0),
        menu: [...document.querySelectorAll<HTMLElement>("details.rb-nav-narrow > summary")].some(
          (summary) => summary.checkVisibility(),
        ),
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
      menu: false,
      rails: ["left", "right"],
      inBar: [],
      scroll: 0,
    });
    expect(await columns(doc, 1247)).toEqual({
      main: 1247 - 240,
      menu: false,
      rails: ["left"],
      inBar: ["Secciones"],
      scroll: 0,
    });
  });

  /**
   * **On words that hold their line at 1023** (sprint 34 día 3): `cabecera-con-marca`'s, with its
   * logo, fold the bar up to 917 (ADR 0067), so the bar this falls into at 1023 is the wide one —
   * and `menu: false` says so, measured, rather than the number.
   */
  it("stands at 1024 with 784 for the content, and falls into the bar at 1023", async () => {
    const doc = placed({ pages: { shown: true, position: "right" } });
    expect(await columns(doc, 1024)).toEqual({
      main: 784,
      menu: false,
      rails: ["right"],
      inBar: [],
      scroll: 0,
    });
    expect(await columns(doc, 1023)).toEqual({
      main: 1023,
      menu: false,
      rails: [],
      inBar: ["Páginas"],
      scroll: 0,
    });
  });

  /**
   * **And on words that do not** (sprint 34 día 3, ADR 0067 §3, which amends ADR 0060 §3): the
   * teaser's own, with the sections in a right column. With the column standing, the brand, the pages
   * and the button do not fit the 1024 − 240 left to them, so the header is the phone's up to N and
   * the column stands from N + 1 — never a column beside «Menú», and never at 1024 for this site.
   */
  it("stands from just above the fold when the bar folds past 1024, and not at 1024", async () => {
    const doc = headerCase("rail-past-the-fold", PALETTES[0]?.id ?? "", {
      sections: { shown: true, position: "right" },
    }).document;
    const w = headerWidths(doc);
    if (w.phone === "always") throw new Error(JSON.stringify(w));
    expect(w.phone, "this case needs words that fold the bar past 1024").toBeGreaterThan(1024);
    expect(w.rails).toBe(w.phone + 1);
    for (const width of [1024, w.phone]) {
      const folded = await columns(doc, width);
      expect(folded, `${width}px`).toMatchObject({ menu: true, rails: [], inBar: [] });
      // `<main>` takes the whole page but for the scroll bar's gutter the phone's header keeps
      // (`scrollbar-gutter: stable`, ADR 0065): none under macOS's overlay bars, 15 px on CI's Linux,
      // where `scroll` — the page's width against the window's — is that gutter, negative.
      expect(folded.main - Math.min(0, folded.scroll), `${width}px`).toBe(width);
    }
    expect(await columns(doc, w.rails)).toEqual({
      main: w.rails - 240,
      menu: false,
      rails: ["right"],
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
        const page = await open(placed(header), 1280, 720, undefined, true);
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

  for (const logoSize of ["md", "lg"] as const) {
    it(`keeps the bar at or under 72px at 320 with a long name, a ${logoSize} logo, the button, «Ir a…» and «Menú»`, async () => {
      const base = placed(FOLD);
      const doc = parseDocument({
        ...base,
        header: { ...base.header, brand: { ...base.header?.brand, logoSize } },
      });
      const page = await open(doc, 320, 568);
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
  }

  for (const sticky of [false, true]) {
    it(`hangs its panel under the bar at 390, covering none of it${sticky ? ", fixed" : ""}`, async () => {
      const page = await open(placed({ ...FOLD, sticky }), 390, 800, undefined, true);
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

/**
 * **The rail on a phone** (ADR 0060 §3, sprint 31 día 6): no column exists under 1024, so a page whose
 * menus stand in columns on a wide screen is the phone header ADR 0057 drew — the brand and the button
 * back in the bar, the pages behind «Menú», the sections where the owner put them on a phone. Measured
 * for each of the three phone places over three arrangements of columns, every bar fixed: the bar at
 * or under 72 px — under 15 % of 568 —, nothing past the edge, nothing over the next thing in the bar,
 * and a fixed bar that stays fixed except under the sections' row, where it lets go as it always has.
 */
describe("the rail on a phone", () => {
  const arrangements: [string, Partial<Header>, "left" | "right" | "fold"][] = [
    [
      "pages and brand left, sections right",
      { pages: { shown: true, position: "left" }, brandWithPages: true },
      "right",
    ],
    ["pages right, sections left", { pages: { shown: true, position: "right" } }, "left"],
    ["pages left, sections behind «Ir a…»", { pages: { shown: true, position: "left" } }, "fold"],
  ];

  for (const [name, header, sectionsAt] of arrangements) {
    for (const mobile of ["row", "hidden", "fold"] as const) {
      for (const [width, height] of [
        [320, 568],
        [390, 844],
      ] as const) {
        it(`${name}, sections on a phone: ${mobile} — at ${width}×${height}`, async () => {
          const page = await open(
            placed({
              ...header,
              sticky: true,
              sections: { shown: true, position: sectionsAt, mobile },
            }),
            width,
            height,
          );
          try {
            const b = await boxes(page, {
              header: "header.rb-header",
              row: "header > .rb-nav-row",
              logo: "header > .rb-brand img.rb-logo",
              brand: "header > .rb-brand",
              action: "header > .rb-nav-action",
              fold: "header > .rb-nav-fold > summary",
              menu: "header > .rb-nav-narrow > summary",
            });
            const where = `${name} / ${mobile} @ ${width}: ${JSON.stringify(b)}`;
            const facts = await page.evaluate(() => ({
              rails: [...document.querySelectorAll<HTMLElement>(".rb-rail")].filter((rail) =>
                rail.checkVisibility(),
              ).length,
              position: getComputedStyle(document.querySelector("header") as Element).position,
              scrollWidth: document.documentElement.scrollWidth,
              logoLoaded: [...document.images].every((img) => img.complete && img.naturalWidth > 0),
            }));
            expect(facts.logoLoaded, "an image did not load, so nothing was measured").toBe(true);
            // No column, and the brand and the button back in the bar.
            expect(facts.rails, where).toBe(0);
            expect(b.brand, where).not.toBeNull();
            expect(b.action, where).not.toBeNull();
            expect(b.menu, where).not.toBeNull();
            // The sections where the owner put them on a phone.
            expect(b.row !== null, where).toBe(mobile === "row");
            expect(b.fold !== null, where).toBe(mobile === "fold");
            // The bar, without the row that scrolls with the page: at or under 72, under 15 % of the
            // height — and one line, nothing over the next thing in it, nothing past the edge.
            const rowHeight = b.row ? b.row.bottom - b.row.top : 0;
            const bar = (b.header?.bottom ?? 999) - (b.header?.top ?? 0) - rowHeight;
            expect(bar, where).toBeLessThanOrEqual(72);
            expect(bar, where).toBeLessThan(0.15 * height);
            const line = [b.logo, b.action, b.fold, b.menu].filter(
              (box): box is Box => box !== null && box !== undefined,
            );
            for (let i = 1; i < line.length; i += 1) {
              expect((line[i - 1]?.right ?? 0) <= (line[i]?.left ?? 0) + 0.5, where).toBe(true);
            }
            expect(b.menu?.right ?? 999, where).toBeLessThanOrEqual(width);
            expect(facts.scrollWidth, where).toBeLessThanOrEqual(width);
            // Fixed stays fixed, except over the row, where bar and row would pass the bound: there
            // it lets go into the flow, `relative` and not `static`, which took the sheet's box with
            // it (sprint 33 día 3, the menu audit's finding 1).
            expect(facts.position, where).toBe(mobile === "row" ? "relative" : "sticky");
          } finally {
            await page.context().close();
          }
        });
      }
    }
  }
});

/**
 * **The bar of 2026** (ADR 0063, sprint 32 día 1), measured where the stylesheet cannot be trusted to
 * mean what it says: a fixed bar once scrolled, and the indicator under the current entry.
 */
describe("a fixed bar once scrolled: condensed, glass, and the page does not move", () => {
  /** `scrollTo(0, 400)` on the page, then every transition finished, then the measurements. */
  async function scrolled(page: Page): Promise<{
    barHeight: number;
    headerH: number;
    firstTop: number;
    backdrop: string;
    background: string;
    marginBottom: string;
    position: string;
    scrollY: number;
    barRect: number;
    firstOffsetTop: number;
    docHeight: number;
  }> {
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector(".rb-header")?.hasAttribute("data-scrolled")),
      )
      .toBe(true);
    await page.evaluate(() => Promise.all(timed().map((a) => a.finished)));
    return page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>("header.rb-header");
      const first = document.querySelector<HTMLElement>("main > .rb-section");
      if (!bar || !first) throw new Error("no bar or no first section");
      const style = getComputedStyle(bar);
      return {
        barHeight: bar.offsetHeight,
        headerH: Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--rb-header-h"),
        ),
        firstTop: first.getBoundingClientRect().top,
        backdrop: style.backdropFilter,
        background: style.backgroundColor,
        marginBottom: style.marginBottom,
        position: style.position,
        scrollY: window.scrollY,
        barRect: bar.getBoundingClientRect().height,
        firstOffsetTop: first.offsetTop,
        docHeight: document.documentElement.scrollHeight,
      };
    });
  }

  async function atRest(
    page: Page,
  ): Promise<{ barHeight: number; firstTop: number; md: number; sm: number }> {
    return page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>("header.rb-header");
      const first = document.querySelector<HTMLElement>("main > .rb-section");
      if (!bar || !first) throw new Error("no bar or no first section");
      const px = (token: string) => {
        const probe = document.createElement("div");
        probe.style.height = `var(${token})`;
        document.body.append(probe);
        const v = probe.getBoundingClientRect().height;
        probe.remove();
        return v;
      };
      return {
        barHeight: bar.offsetHeight,
        firstTop: first.getBoundingClientRect().top,
        md: px("--space-md"),
        sm: px("--space-sm"),
      };
    });
  }

  for (const background of ["surface", "transparent", "primary"] as const) {
    it(`moves the first section exactly −400 px on a 400 px scroll, ${background} (adjustments 1 and 7)`, async () => {
      // With motion on: the condensing is a transition, and the page must be still once it ends.
      const page = await open(
        placed({ sticky: true, look: { background }, sections: { mobile: "hidden" } }),
        1280,
        900,
        undefined,
        true,
      );
      try {
        const rest = await atRest(page);
        const after = await scrolled(page);
        expect(
          after.firstTop - rest.firstTop,
          `the first section moved more than the scroll: ${JSON.stringify({ rest, after })}`,
        ).toBe(-400);
        // Condensed: the bar is shorter by what the padding gave up, and the measure follows it.
        // `offsetHeight` is an integer and a fixed bar can sit on a half pixel: within one.
        expect(
          Math.abs(rest.barHeight - after.barHeight - 2 * (rest.md - rest.sm)),
        ).toBeLessThanOrEqual(1);
        expect(Math.abs(after.headerH - after.barHeight)).toBeLessThanOrEqual(1);
        if (background === "transparent") {
          // Fixed, out of the flow: its margin moves nothing, and the cover made its room by the
          // estimate (`--rb-bar-h`), which is why the −400 above held with the bar 16 px shorter.
          expect(after.position).toBe("fixed");
        } else {
          expect(Number.parseFloat(after.marginBottom)).toBe(2 * (rest.md - rest.sm));
        }
      } finally {
        await page.context().close();
      }
    });
  }

  it("is glass on surface and on ink once scrolled, and opaque on primary (GLASS_MIX)", async () => {
    for (const [background, glass] of [
      ["surface", true],
      ["ink", true],
      ["primary", false],
      ["secondary", false],
    ] as const) {
      const page = await open(
        placed({ sticky: true, look: { background }, sections: { mobile: "hidden" } }),
        1280,
        900,
      );
      try {
        const after = await scrolled(page);
        expect(after.backdrop, background).toBe(glass ? "blur(12px)" : "none");
        // A glass background computes to a `color(srgb … / 0.88)` — a `color-mix` result — and an
        // opaque one to a plain `rgb(…)` with no alpha.
        if (glass) expect(after.background, background).toMatch(/\/ 0\.88\)$/);
        else expect(after.background, background).toMatch(/^rgb\(/);
      } finally {
        await page.context().close();
      }
    }
  });
});

describe("the indicator under the current entry", () => {
  /** The strip's pages nav, its `::after`, and the entry that is current, as the browser laid them out. */
  async function indicator(page: Page): Promise<
    { left: number; width: number; display: string } & {
      entry: { left: number; width: number } | null;
    }
  > {
    return page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(
        ".rb-nav-wide > .rb-nav[data-part=pagesLinks]",
      );
      if (!nav) throw new Error("no pages nav");
      const after = getComputedStyle(nav, "::after");
      const current = nav.querySelector<HTMLElement>("a[aria-current]");
      const navBox = nav.getBoundingClientRect();
      const box = current?.getBoundingClientRect();
      return {
        left: Number.parseFloat(after.left),
        width: Number.parseFloat(after.width),
        display: after.display,
        entry: box ? { left: box.left - navBox.left, width: box.width } : null,
      };
    });
  }

  it("is anchored under the page you are on, and slides to the next when the current one changes", async () => {
    // A page other than the home: on the home page no entry is current (there is no «Inicio» there)
    // and the indicator has nothing to stand under.
    const page = await open(fixture("cabecera-con-marca"), 1280, 900, "page-que-ponemos", true);
    try {
      expect(await page.evaluate(() => CSS.supports("anchor-name: --rb-x"))).toBe(true);
      const before = await indicator(page);
      expect(before.entry).not.toBeNull();
      expect(before.display).toBe("block");
      expect(Math.abs(before.left - (before.entry?.left ?? -1))).toBeLessThanOrEqual(1);
      expect(Math.abs(before.width - (before.entry?.width ?? -1))).toBeLessThanOrEqual(1);
      // The rule's own colour is transparent where the indicator stands in for it.
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(
              document.querySelector(
                ".rb-nav-wide > .rb-nav[data-part=pagesLinks] a[aria-current]",
              ) as Element,
            ).textDecorationColor,
        ),
      ).toBe("rgba(0, 0, 0, 0)");
      // Move the current page to another entry and let the slide finish.
      await page.evaluate(() => {
        const nav = document.querySelector(".rb-nav-wide > .rb-nav[data-part=pagesLinks]");
        const links = [...(nav?.querySelectorAll("a") ?? [])];
        for (const a of links) a.removeAttribute("aria-current");
        links.at(-1)?.setAttribute("aria-current", "page");
      });
      await page.evaluate(() => Promise.all(timed().map((a) => a.finished)));
      const after = await indicator(page);
      expect(after.entry?.left).not.toBe(before.entry?.left);
      expect(Math.abs(after.left - (after.entry?.left ?? -1))).toBeLessThanOrEqual(1);
      expect(Math.abs(after.width - (after.entry?.width ?? -1))).toBeLessThanOrEqual(1);
      // And gone the moment nothing is current.
      await page.evaluate(() => {
        for (const a of document.querySelectorAll(".rb-nav-wide a"))
          a.removeAttribute("aria-current");
      });
      expect((await indicator(page)).display).toBe("none");
    } finally {
      await page.context().close();
    }
  });
});

describe("the bar has the page's measure (ADR 0064)", () => {
  /** The left edge of the brand's first box and of the cover's headline, and of the button's right
   * edge against the cover's content box, at a width. */
  async function edges(page: Page) {
    return page.evaluate(() => {
      const brand = document.querySelector<HTMLElement>(".rb-header > .rb-brand");
      const h1 = document.querySelector<HTMLElement>("main > .rb-section:first-child h1");
      const section = document.querySelector<HTMLElement>("main > .rb-section:first-child");
      if (!brand || !h1 || !section) throw new Error("no brand, headline or first section");
      const s = getComputedStyle(section);
      const box = section.getBoundingClientRect();
      return {
        brand: brand.getBoundingClientRect().left,
        h1: h1.getBoundingClientRect().left,
        contentLeft: box.left + Number.parseFloat(s.paddingLeft),
        contentRight: box.right - Number.parseFloat(s.paddingRight),
        barRight: (() => {
          const bar = document.querySelector<HTMLElement>("header.rb-header") as HTMLElement;
          const b = bar.getBoundingClientRect();
          return b.right - Number.parseFloat(getComputedStyle(bar).paddingRight);
        })(),
      };
    });
  }

  for (const width of [1680, 1280]) {
    it(`lines the brand up with the content's left edge, and the bar's right with its right, at ${width}`, async () => {
      const page = await open(fixture("cabecera-con-marca"), width, 900);
      try {
        const e = await edges(page);
        expect(Math.abs(e.brand - e.contentLeft), JSON.stringify(e)).toBeLessThanOrEqual(1);
        expect(Math.abs(e.barRight - e.contentRight), JSON.stringify(e)).toBeLessThanOrEqual(1);
        if (width === 1680) expect(e.contentLeft).toBe((1680 - 1200) / 2);
      } finally {
        await page.context().close();
      }
    });
  }

  it("takes a rail's width out of the bar's measure, so the brand still lines up beside it, at 1680", async () => {
    // The pages in a left rail and the brand left in the bar: the bar's padding is a share of the
    // `<body>`, not of the narrower `<main>`, unless the rail's width is taken out (`--rb-rail-l`).
    const page = await open(placed({ pages: { shown: true, position: "left" } }), 1680, 900);
    try {
      const e = await edges(page);
      expect(Math.abs(e.brand - e.contentLeft), JSON.stringify(e)).toBeLessThanOrEqual(1);
      expect(e.contentLeft).toBe(240 + (1680 - 240 - 1200) / 2);
    } finally {
      await page.context().close();
    }
  });
});

describe("the phone's menu is a sheet (sprint 32 día 4)", () => {
  const FOLD_PHONE = {
    sections: { shown: true, position: "bar" as const, mobile: "fold" as const },
  };

  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ] as const) {
    it(`covers from the bar's foot to the bottom of the screen, and hides the page behind, at ${width}×${height}`, async () => {
      const page = await open(placed(FOLD_PHONE), width, height);
      try {
        await page.click(".rb-nav-narrow > summary");
        const m = await page.evaluate(() => {
          const bar = document.querySelector("header.rb-header") as HTMLElement;
          const sheet = document.querySelector(".rb-nav-narrow > .rb-nav") as HTMLElement;
          const s = sheet.getBoundingClientRect();
          return {
            barBottom: bar.getBoundingClientRect().bottom,
            sheetTop: s.top,
            sheetBottom: s.bottom,
            sheetLeft: s.left,
            sheetRight: s.right,
            innerHeight,
            pageRight: document.body.getBoundingClientRect().right,
            main: getComputedStyle(document.querySelector("main") as Element).visibility,
            word: (
              document.querySelector(".rb-nav-narrow > summary") as HTMLElement
            ).innerText.trim(),
          };
        });
        expect(Math.abs(m.sheetTop - m.barBottom)).toBeLessThanOrEqual(1);
        expect(m.sheetBottom).toBeGreaterThanOrEqual(m.innerHeight - 1);
        // Edge to edge of the page, which is the window less a scrollbar's lane where the engine
        // keeps one: since ADR 0065's `scrollbar-gutter: stable`, Chromium on Linux keeps 15 px even
        // with its scrollbars hidden (CI read 305 at 320 and 375 at 390), as every desktop with a
        // classic scrollbar does whenever the page scrolls. A phone overlays: 0, and 320 here.
        expect([m.sheetLeft, m.sheetRight]).toEqual([0, m.pageRight]);
        expect(m.main).toBe("hidden");
        expect(m.word).toBe("Cerrar");
        // Opening «Ir a…» closes «Menú» (the script's press outside), and its sheet takes over.
        await page.click(".rb-nav-fold > summary");
        expect(
          await page.evaluate(() => ({
            menu: (document.querySelector(".rb-nav-narrow") as HTMLDetailsElement).open,
            fold: (document.querySelector(".rb-nav-fold") as HTMLDetailsElement).open,
            main: getComputedStyle(document.querySelector("main") as Element).visibility,
          })),
        ).toEqual({ menu: false, fold: true, main: "hidden" });
        // Escape closes it and the page is back.
        await page.keyboard.press("Escape");
        expect(
          await page.evaluate(
            () => getComputedStyle(document.querySelector("main") as Element).visibility,
          ),
        ).toBe("visible");
      } finally {
        await page.context().close();
      }
    });
  }
});

/**
 * `withLogo` with ten pages, so «Menú» holds more entries than a 320 × 568 sheet shows and has to
 * scroll inside itself.
 */
function tenPages(header: Partial<Header>): RetorikaDocument {
  const doc = placed(header);
  const model = doc.pages[1];
  if (!model) throw new Error("no second page to copy");
  const more = Array.from({ length: 8 }, (_, i) => ({
    ...model,
    id: `page-extra-${i}`,
    slug: `extra-${i}`,
    title: `Página de más ${i + 1}`,
    sections: model.sections.map((section) => ({ ...section, id: `${section.id}-extra-${i}` })),
  }));
  return parseDocument({ ...doc, pages: [...doc.pages, ...more] });
}

/**
 * A wheel where a person turns it, over the middle of the window, and the page's scroll once the
 * browser has acted on it. **Never `scrollTo`** (David's adjustment 1 of sprint 33): `overflow:
 * hidden` holds the visitor's scroll and leaves a script's free, so a `scrollTo` would move the page
 * under a correct lock. 400 ms is what a 2000 px wheel took to land in full without the lock
 * (measured on día 1); the sabotage below is what says it is long enough.
 */
async function wheel(page: Page, dy: number): Promise<number> {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(400);
  return page.evaluate(() => Math.round(window.scrollY));
}

describe("the phone's sheet holds the page still (sprint 33 día 1, ADR 0065)", () => {
  const LONG = (header: Partial<Header>) =>
    eightSections(placed({ sections: { shown: true, mobile: "hidden" }, ...header }));

  for (const sticky of [true, false]) {
    it(`does not let a wheel move the page under the open sheet, ${sticky ? "fixed bar, opened at 600" : "bar in the flow, opened at the top"}`, async () => {
      const page = await open(LONG({ sticky }), 390, 844);
      try {
        // Placed by script, before the sheet opens: the one thing `scrollTo` is for here.
        const from = sticky ? 600 : 0;
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), from);
        await page.click(".rb-nav-narrow > summary");
        expect(await wheel(page, 2000)).toBe(from);
        // The sheet is still where it opened, edge to edge under the bar.
        const sheet = await boxes(page, { sheet: ".rb-nav-narrow > .rb-nav" });
        expect(Math.round(sheet["sheet"]?.bottom ?? 0)).toBeGreaterThanOrEqual(843);
        // Closed, the page is where it was and scrolls again.
        await page.keyboard.press("Escape");
        expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(from);
        expect(await wheel(page, 300)).toBeGreaterThan(from);
      } finally {
        await page.context().close();
      }
    });
  }

  /**
   * **The finger proves it moves a page before it is asked not to** (sprint 33 día 6, the backlog's
   * «a test that cannot fail in CI»). This used `Input.synthesizeScrollGesture`, which scrolled a
   * page 1506 px on this Mac and nothing at all on CI's Linux — so there it asserted «not moved»
   * with or without the lock. A finger is now the touchscreen's own (`Input.dispatchTouchEvent`, as
   * the día 5 walk measured it scrolling the canvas in CI), and the same finger first moves the
   * page with the sheet closed: an instrument that moves nothing fails here, by name.
   */
  it("does not let a finger move it either (a touch gesture, Chromium)", async () => {
    const page = await open(LONG({ sticky: true }), 390, 844, undefined, false, {
      hasTouch: true,
      isMobile: true,
    });
    try {
      const cdp = await page.context().newCDPSession(page);
      const swipe = async () => {
        const send = (type: "touchStart" | "touchMove" | "touchEnd", y?: number) =>
          cdp.send("Input.dispatchTouchEvent", {
            type,
            touchPoints: y === undefined ? [] : [{ x: 195, y }],
          });
        await send("touchStart", 700);
        for (let step = 1; step <= 10; step += 1) await send("touchMove", 700 - step * 50);
        // Still before lifting, so the swipe ends as a drag and not as a fling still running.
        await page.waitForTimeout(100);
        await send("touchEnd");
        // Until the page has stopped: two reads 100 ms apart that agree.
        let last = -1;
        for (;;) {
          const now = await page.evaluate(() => Math.round(window.scrollY));
          if (now === last) return now;
          last = now;
          await page.waitForTimeout(100);
        }
      };
      expect(await swipe(), "the finger should move a page with the sheet closed").toBeGreaterThan(
        0,
      );
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.click(".rb-nav-narrow > summary");
      expect(await swipe()).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  it("still scrolls inside itself when its entries outgrow the screen, at 320 × 568", async () => {
    const page = await open(tenPages({ sections: { shown: true, mobile: "hidden" } }), 320, 568);
    try {
      await page.click(".rb-nav-narrow > summary");
      const outgrows = await page.evaluate(() => {
        const sheet = document.querySelector(".rb-nav-narrow > .rb-nav") as HTMLElement;
        return sheet.scrollHeight - sheet.clientHeight;
      });
      expect(outgrows, "ten pages should not fit a 320 × 568 sheet").toBeGreaterThan(0);
      expect(await wheel(page, 400)).toBe(0);
      expect(
        await page.evaluate(
          () => (document.querySelector(".rb-nav-narrow > .rb-nav") as HTMLElement).scrollTop,
        ),
      ).toBeGreaterThan(0);
    } finally {
      await page.context().close();
    }
  });

  // David's condition 1a: a narrow desktop window with a scrollbar drawn — a classic one, that takes
  // its width from the page, as on Windows and Linux. Two instruments were wrong before this one, and
  // both are written down so nobody picks them up again (measured on día 1):
  // - **A scrollbar styled with `::-webkit-scrollbar`** takes 15 px, but Chromium (153) keeps no
  //   gutter for it on the root: the content widened 705 → 720 with `scrollbar-gutter: stable` too.
  // - **`documentElement.clientWidth`** reads the full 720 under `overflow: hidden` even while the
  //   gutter is kept, since the root has no scrollbar then. What holds still is the content, so the
  //   content is what is measured.
  // A real classic scrollbar, then: Playwright launches Chromium with `--hide-scrollbars`, so this
  // launch leaves it out, which on Linux (CI) is enough; on macOS the system overlays scrollbars, and
  // Chromium takes `-AppleShowScrollBars Always` from its own command line as a preference of that
  // one process — through a wrapper, because Playwright refuses a bare `Always` among the arguments.
  // The test first proves that a scrollbar is drawn.
  it("keeps the page's width when it opens, at 720 with a scrollbar drawn", async () => {
    let executablePath: string | undefined;
    if (process.platform === "darwin") {
      executablePath = join(tmpdir(), "retorika-chromium-classic-scrollbars.sh");
      writeFileSync(
        executablePath,
        `#!/bin/sh\nexec "${chromium.executablePath()}" "$@" -AppleShowScrollBars Always\n`,
      );
      chmodSync(executablePath, 0o755);
    }
    const drawn = await chromium.launch({
      ignoreDefaultArgs: ["--hide-scrollbars"],
      ...(executablePath === undefined ? {} : { executablePath }),
    });
    const page = await open(LONG({}), 720, 900, undefined, false, { on: drawn });
    try {
      const width = () =>
        page.evaluate(() => ({
          main: Math.round(document.querySelector("main")?.getBoundingClientRect().width ?? 0),
          section: Math.round(
            document.querySelector("main > .rb-section")?.getBoundingClientRect().width ?? 0,
          ),
        }));
      const scrollbar = await page.evaluate(
        () => window.innerWidth - document.documentElement.clientWidth,
      );
      expect(scrollbar, "no scrollbar drawn, so this measures nothing").toBeGreaterThan(0);
      const closed = await width();
      await page.click(".rb-nav-narrow > summary");
      expect(await width()).toEqual(closed);
    } finally {
      await drawn.close();
    }
  });

  it("lets «Ir a…» still take the visitor to the section chosen", async () => {
    const page = await open(
      eightSections(
        placed({ sticky: true, sections: { shown: true, position: "bar", mobile: "fold" } }),
      ),
      390,
      844,
    );
    try {
      await page.click(".rb-nav-fold > summary");
      // The first entry, far enough from the end for the page to bring it all the way up: the last
      // one sits where the page cannot scroll it to the bar (measured: `scrollY` at its maximum).
      const entry = page.locator(".rb-nav-fold > .rb-nav a").first();
      const href = (await entry.getAttribute("href")) ?? "";
      await entry.click();
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const section = document.querySelector(id) as HTMLElement;
            const bar = document.querySelector("header.rb-header") as HTMLElement;
            return {
              open: (document.querySelector(".rb-nav-fold") as HTMLDetailsElement).open,
              scrolled: window.scrollY > 0,
              underTheBar: Math.abs(section.getBoundingClientRect().top - bar.offsetHeight) <= 1,
            };
          }, href),
        )
        .toEqual({ open: false, scrolled: true, underTheBar: true });
    } finally {
      await page.context().close();
    }
  });
});

/**
 * **The sheet hangs from the bar it has, not from an estimate of it** (sprint 33 día 3, the menu
 * audit's findings 1, 3, 4 and 5). On the teaser's header — no logo, so the bar is as tall as its
 * letter and its height has a fraction — measured before this day in Chromium:
 *
 * - **A fixed bar over the phone's row** let go by `position: static`, which took from the sheet the
 *   box its `top: 100%` is a share of: «Menú» opened at 844 of 844, below the screen, on a blank page.
 * - **A transparent fixed bar over the row** did not let go at all: the script's `fixed` weighed more.
 * - **The sheet's height was the screen less `--rb-header-h`**, and that is never quite the bar: the
 *   script's measure is rounded and counts the hairline the sheet starts above (842.6 of 844), and
 *   where no script runs — the canvas, a visitor without one — it is the one-line estimate, short of
 *   a bar with the row under it (67 px below the screen at 320, the last entries out of reach).
 *
 * Every case here is the sheet against the screen: top at the bar's foot, bottom at the screen's
 * foot to half a pixel, the bar in the place its scheme gives it.
 */
describe("the phone's sheet hangs from the bar it has (sprint 33 día 3)", () => {
  const palette = PALETTES[0]?.id ?? "";
  const teaser = (header: Partial<Header>) =>
    headerCase("día 3", palette, header as RetorikaDocument["header"]).document;
  const ROW = { shown: true, position: "bar" as const, mobile: "row" as const };
  /** The page without its script: what the canvas hangs the sheet from (the estimate). */
  const withoutScript = (html: string) => html.replace(/<script>[\s\S]*?<\/script>/g, "");

  async function sheetAgainstScreen(page: Page) {
    await page.click(".rb-nav-narrow > summary");
    return page.evaluate(() => {
      const bar = document.querySelector("header.rb-header") as HTMLElement;
      const sheet = (
        document.querySelector(".rb-nav-narrow > .rb-nav") as HTMLElement
      ).getBoundingClientRect();
      return {
        foot: bar.getBoundingClientRect().bottom,
        top: sheet.top,
        bottom: sheet.bottom,
        innerHeight,
        position: getComputedStyle(bar).position,
      };
    });
  }

  const cases: [string, Partial<Header>, string, boolean][] = [
    [
      "a fixed bar over the row lets go and keeps the sheet's box",
      { sticky: true, sections: ROW },
      "relative",
      true,
    ],
    [
      "a transparent fixed bar over the row lets go as a transparent one",
      { sticky: true, sections: ROW, look: { background: "transparent" } },
      "absolute",
      true,
    ],
    [
      "a fixed surface bar, whose measure is rounded and has a hairline",
      { sticky: true, sections: { ...ROW, mobile: "hidden" } },
      "sticky",
      true,
    ],
    [
      "a bar with the row, where no script measures it (the canvas)",
      { sections: ROW },
      "relative",
      false,
    ],
    [
      "a fixed bar with the row, where no script measures it (the canvas)",
      { sticky: true, sections: ROW },
      "relative",
      false,
    ],
  ];
  for (const [what, header, position, script] of cases) {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
    ] as const) {
      it(`${what}, at ${width}×${height}`, async () => {
        const html = render(teaser(header), "html").html;
        const page = await openHtml(browser, script ? html : withoutScript(html), width, what);
        try {
          await page.setViewportSize({ width, height });
          const m = await sheetAgainstScreen(page);
          expect(m.position).toBe(position);
          expect(Math.abs(m.top - m.foot), `top ${m.top}, foot ${m.foot}`).toBeLessThanOrEqual(1);
          expect(Math.abs(m.bottom - m.innerHeight), `bottom ${m.bottom}`).toBeLessThanOrEqual(0.5);
        } finally {
          await page.context().close();
        }
      });
    }
  }
});

describe("an owner's exact bar colour holds once scrolled (sprint 32 día 5)", () => {
  for (const background of ["surface", "ink", "transparent", "primary"] as const) {
    it(`keeps #5a1a1a, opaque and without glass, on the ${background} scheme after scrolling`, async () => {
      const page = await open(
        placed({
          sticky: true,
          look: { background },
          sections: { shown: true, mobile: "hidden" },
          style: { bar: { color: { exact: "#5a1a1a", exception: true } } },
        }),
        1280,
        700,
      );
      try {
        const read = () =>
          page.evaluate(
            () => getComputedStyle(document.querySelector(".rb-header") as Element).backgroundColor,
          );
        expect(await read()).toBe("rgb(90, 26, 26)");
        await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
        await expect
          .poll(() =>
            page.evaluate(() =>
              document.querySelector(".rb-header")?.hasAttribute("data-scrolled"),
            ),
          )
          .toBe(true);
        expect(await read()).toBe("rgb(90, 26, 26)");
      } finally {
        await page.context().close();
      }
    });
  }
});

/**
 * **The bar's estimate against the bar, form by form, in the three engines** (sprint 33 día 6,
 * David's decision on the menu audit's first two rows).
 *
 * `--rb-bar-h` is all a transparent bar's cover has to make room with, and all «Ir a…» hangs from
 * where no script measures — the canvas. It was one line for every bar, and a stacked bar with its
 * row measured 150.4 over a cover that made room for 72. Now it is a sum per form (`barEstimate`),
 * and David's condition is the bound: **never more than a pixel short of the bar the engine measures,
 * never more than 16 over — and a form that falls outside is corrected in the formula, never here.**
 *
 * **What the formula cannot know is a line its words do not fit on**: the teaser's own labels — a
 * logo, the pages, «Contacto» and «Dónde estamos» — wrap the bar at 768, and no stylesheet measures
 * a line's words (the backlog's row, sprint 33 día 6). So the labels here are short enough for one
 * line at 768, and **each case first proves the bar holds the lines its form has**: an engine that
 * wraps it with its own letter fails that precondition by name, rather than passing or failing the
 * bound for a reason the bound is not about.
 */
describe("the bar's estimate against the bar it measures (sprint 33 día 6)", () => {
  const ENGINES: readonly [string, BrowserType][] = [
    ["chromium", chromium],
    ["firefox", firefox],
    ["webkit", webkit],
  ];
  const installed = (type: BrowserType): boolean => {
    try {
      return existsSync(type.executablePath());
    } catch {
      return false;
    }
  };
  // With its stored size (the fixture is 2 × 2): a logo with none is counted four times as wide as
  // tall by the fold's estimate (ADR 0067), which folded this form at 768 and measured the phone's
  // bar instead of the one this test is about.
  const LOGO = { name: true, logo: { src: "assets/portada.png", width: 2, height: 2 } };
  /** The form, and the lines it is drawn on: the brand's own and the rest's, then the row. */
  const FORMS: readonly {
    name: string;
    header: Partial<Header>;
    lines: number;
    /** The widths the form is measured at: the three bands, unless the form folds in one of them. */
    widths?: readonly number[];
  }[] = [
    { name: "one line", header: {}, lines: 1 },
    { name: "one line, a logo", header: { brand: LOGO }, lines: 1 },
    { name: "stacked", header: { layout: "stacked" }, lines: 2 },
    { name: "stacked, a logo", header: { layout: "stacked", brand: LOGO }, lines: 2 },
    { name: "the row", header: { sections: { position: "row" } }, lines: 2 },
    { name: "the row, a logo", header: { brand: LOGO, sections: { position: "row" } }, lines: 2 },
    {
      name: "stacked, the row",
      header: { layout: "stacked", sections: { position: "row" } },
      lines: 3,
    },
    {
      name: "stacked, the row, a logo, small",
      header: {
        layout: "stacked",
        brand: LOGO,
        sections: { position: "row" },
        look: { size: "small" },
      },
      lines: 3,
    },
    // The brand at its sizes (ADR 0069): the large logo and the heading-sized name on one line,
    // and the large logo on the stacked brand's own line — the estimate counts both.
    {
      name: "one line, a large logo, a heading-sized name",
      header: { brand: { ...LOGO, logoSize: "lg", nameSize: "heading" } },
      lines: 1,
      // The heading-sized name folds this form at 846 (measured against its real break at 756, the
      // same slack as the rest), so at 768 the bar is the phone's and the strip is not there to hold.
      widths: [1024, 1280],
    },
    {
      name: "stacked, a large logo",
      header: { layout: "stacked", brand: { ...LOGO, logoSize: "lg" } },
      lines: 2,
    },
  ];
  /** The teaser with labels short enough for one line at 768: the brand, the pages, the button. */
  const formDocument = (header: Partial<Header>, background: "transparent" | "surface") => {
    const doc = headerCase("estimate", PALETTES[0]?.id ?? "", {
      ...header,
      look: { ...header.look, background },
    }).document;
    const labels = ["Carta", "Fotos", "Reservar"];
    return parseDocument({
      ...doc,
      siteName: "El Corte",
      pages: doc.pages.map((p, i) => (i === 0 ? p : { ...p, menuLabel: labels[i - 1] })),
    });
  };

  for (const [engine, type] of ENGINES) {
    describe(engine, () => {
      let browser: Browser | undefined;
      beforeAll(async () => {
        if (installed(type)) browser = await type.launch();
      });
      afterAll(async () => {
        await browser?.close();
      });

      for (const form of FORMS) {
        for (const background of ["transparent", "surface"] as const) {
          it(`${form.name}, ${background}: within −1 and +16 of the bar at 768, 1024 and 1280`, async (context) => {
            if (!browser) {
              context.skip(`${engine} is not installed here (CI installs Chromium alone)`);
              return;
            }
            const html = render(formDocument(form.header, background), "html").html;
            for (const width of form.widths ?? [768, 1024, 1280]) {
              const page = await openHtml(browser, html, width, `${engine}/${form.name}`);
              try {
                const m = await page.evaluate(() => {
                  const header = document.querySelector<HTMLElement>(".rb-header");
                  const main = document.querySelector("main");
                  if (!header || !main) throw new Error("no header");
                  const probe = document.createElement("div");
                  probe.style.cssText =
                    "position:absolute;visibility:hidden;height:var(--rb-bar-h)";
                  main.append(probe);
                  const estimate = probe.getBoundingClientRect().height;
                  probe.remove();
                  // The lines the bar is drawn on, by where its visible words sit.
                  const words = [
                    ...header.querySelectorAll(
                      ":scope > .rb-brand, :scope > .rb-nav-action, :scope > .rb-nav-wide a, :scope > .rb-nav-row a",
                    ),
                  ].filter((el) => el.getClientRects().length > 0);
                  const middles = words
                    .map((el) => {
                      const r = el.getBoundingClientRect();
                      return r.top + r.height / 2;
                    })
                    .sort((a, b) => a - b);
                  let lines = 0;
                  let last = Number.NEGATIVE_INFINITY;
                  for (const y of middles) {
                    if (y - last > 6) lines += 1;
                    last = y;
                  }
                  return {
                    bar: header.getBoundingClientRect().height,
                    estimate,
                    lines,
                    strip:
                      header.querySelector<HTMLElement>(".rb-nav-wide")?.checkVisibility() ?? false,
                  };
                });
                const said = `${engine}, ${form.name}, ${background}, at ${width}: ${JSON.stringify(m)}`;
                // The wide bar, measured (sprint 34 día 3): a form folded at 768 is the phone's bar,
                // one line like «one line», and its estimate would pass for the wide one's.
                expect(m.strip, `the strip is drawn — ${said}`).toBe(true);
                expect(m.lines, `the bar's lines — ${said}`).toBe(form.lines);
                expect(m.estimate, said).toBeGreaterThanOrEqual(m.bar - 1);
                expect(m.estimate, said).toBeLessThanOrEqual(m.bar + 16);
              } finally {
                await page.context().close();
              }
            }
          });
        }
      }
    });
  }
});

/**
 * **The fold's estimate against the width the bar really breaks at** (sprint 34 día 2, ADR 0067;
 * David's condition: the estimate is conservative on purpose, and it is measured, not supposed).
 *
 * `headerWidths` sums the advances of every glyph of what the bar holds and says up to which width
 * the bar is the phone's. Here each site is opened **with its fold written back to 720** — the
 * `@media` lines rewritten in the html — and the widest viewport at which its one line wraps is found
 * by bisection: the truth. The estimate must never be under it, and David's expected slack is under
 * 40 px: a bar folded that much earlier than it had to is the price of never wrapping. The logo is
 * given its stored size here (2 × 2, the fixture's), so the number is the words'; a logo with no stored
 * size is counted four times as wide as tall, by design, and the one case of that below only has to
 * come out long. **David's sabotage**: three labels of twenty letters, and the html rewritten so the bar
 * never folds — the audit's check 11 must go red at 768.
 *
 * **Sprint 34 día 3: the truth of the visitor the estimate is written for, in the letter the site is
 * published in.** The estimate keeps a classic scroll bar's 15 px out of the width (`SCROLLBAR_LANE`:
 * Windows, Linux), and a browser Playwright launches draws none — `--hide-scrollbars`, and macOS's
 * overlay ones — so the truth of día 2 was a visitor with no lane, and 15 px of every slack were the
 * Windows visitor's. The bisection now runs in a Chromium that keeps its scroll bars, with one of 15 px
 * styled in (`withLane`), and the lane is measured before anything else. And the page's faces are
 * served (`openHtml`, día 3), so the forty families the product ships are drawn in their own letter,
 * which none of the twenty of día 2 was.
 *
 * **The gate is that the bar never wraps, here and on CI's Linux** (David, día 3, when Linux drew
 * Poppins 3.5 % wider than macOS and the estimate fell 2 px short there): «los 40 px no eran una regla,
 * eran una expectativa mía con el dato de ayer». The slack is printed every run, and the bound that
 * watches it is 60 px for a site whose two families the product ships, with the 3 % of kerning
 * untouched: a family past 60 is looked at by itself — its hinting, its capitals — and the margin is
 * never widened for all of them.
 */
describe("the fold's estimate is never under the width the bar breaks at (sprint 34 día 2)", () => {
  /** A Chromium that draws scroll bars, for the truth below. */
  let laned: Browser;
  beforeAll(async () => {
    laned = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  });
  afterAll(async () => {
    await laned?.close();
  });
  /** The page with a classic scroll bar of `SCROLLBAR_LANE` px: a styled one takes its width out of
   * the layout on every platform, and a `@media` width still counts it — Windows, drawn on any machine. */
  const withLane = (html: string): string =>
    html.replace(
      "</head>",
      `<style>::-webkit-scrollbar { width: ${SCROLLBAR_LANE}px; } ::-webkit-scrollbar-thumb { background: #999; }</style></head>`,
    );
  /** The html with its fold undone: `@media` lines of the header written back to 720 and 1024. */
  const unfolded = (doc: RetorikaDocument): string => {
    const w = headerWidths(doc);
    if (w.phone === "always") throw new Error("a bar that never fits has no fold to undo");
    let html = render(doc, "html").html;
    html = html
      .replaceAll(`(max-width: ${w.phone}px)`, "(max-width: 720px)")
      .replaceAll(`(min-width: ${w.phone + 1}px)`, "(min-width: 721px)");
    if (w.rails !== 1024)
      html = html.replaceAll(`(min-width: ${w.rails}px)`, "(min-width: 1024px)");
    return html;
  };
  /** Whether the bar has wrapped at this width: taller than its own estimate of its lines. */
  const wraps = (page: Page) =>
    page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".rb-header");
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;height:var(--rb-bar-h)";
      document.querySelector("main")?.append(probe);
      const estimate = probe.getBoundingClientRect().height;
      probe.remove();
      return (header?.getBoundingClientRect().height ?? 0) > estimate + 1;
    });
  /** The widest viewport in [721, 1700] at which the bar wraps with a scroll bar's lane, or 720 when
   * none — and the families the page drew its faces from, every declared face loaded (`openHtml`
   * fails the page otherwise). */
  async function truthOf(doc: RetorikaDocument): Promise<{ truth: number; faces: string[] }> {
    const page = await openHtml(laned, withLane(unfolded(doc)), 1700, "truth");
    try {
      const lane = await page.evaluate(() => innerWidth - document.documentElement.clientWidth);
      if (lane !== SCROLLBAR_LANE) throw new Error(`the page drew a lane of ${lane} px`);
      const faces = await page.evaluate(() =>
        [
          ...new Set([...document.fonts].map((face) => face.family.replace(/^["']|["']$/g, ""))),
        ].sort(),
      );
      let lo = 720;
      let hi = 1700;
      if (await wraps(page)) return { truth: 1700, faces };
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        await page.setViewportSize({ width: mid, height: 900 });
        if (await wraps(page)) lo = mid;
        else hi = mid;
      }
      return { truth: lo, faces };
    } finally {
      await page.context().close();
    }
  }
  const sizedLogo = { name: true, logo: { src: "assets/portada.png", width: 2, height: 2 } };
  const LOOKS: readonly { name: string; header: Partial<Header> }[] = [
    { name: "plain", header: {} },
    { name: "a logo", header: { brand: sizedLogo } },
    { name: "capitals", header: { look: { uppercase: true } } },
    { name: "small", header: { look: { size: "small" } } },
  ];
  const sites: [string, RetorikaDocument][] = [
    ...loadCorpus()
      .filter((entry) => entry.document.header !== undefined)
      .map((entry): [string, RetorikaDocument] => [entry.name, entry.document]),
    ...TYPE_PAIRS.flatMap((pair) =>
      SCALES.flatMap((scale) =>
        [false, true].map((logo): [string, RetorikaDocument] => {
          const base = headerCase(
            "truth",
            PALETTES[0]?.id ?? "",
            logo ? { brand: sizedLogo } : {},
          ).document;
          return [
            `teaser ${pair.id} ${scale.id}${logo ? " with a logo" : ""}`,
            parseDocument({
              ...base,
              theme: buildTheme({
                paletteId: PALETTES[0]?.id ?? "",
                typePairId: pair.id,
                scaleId: scale.id,
              }),
            }),
          ];
        }),
      ),
    ),
    // **The forty families the product ships** (sprint 34 día 3), each as the heading and the body —
    // the brand and the button at 700, the entries at 400 — over the teaser's own words, with its
    // faces served: the sites the 60 px bound is for, which none of the twenty above is. The look
    // and the scale rotate over them, so every family is drawn and each look meets ten of them.
    ...GALLERY_FAMILIES.map((row, i): [string, RetorikaDocument] => {
      const look = LOOKS[i % LOOKS.length];
      const scale = SCALES[i % SCALES.length];
      if (!look || !scale) throw new Error("the rotation ran out of values");
      const base = headerCase("truth", PALETTES[0]?.id ?? "", look.header).document;
      return [
        `${row.family}, ${look.name}, ${scale.id}`,
        parseDocument({
          ...base,
          theme: {
            ...buildTheme({
              paletteId: PALETTES[0]?.id ?? "",
              typePairId: TYPE_PAIRS[0]?.id ?? "",
              scaleId: scale.id,
            }),
            "font.heading": row.stack,
            "font.body": row.stack,
          },
        }),
      ];
    }),
  ];

  /** Whether both of the bar's families are in the glyph table: the 60 px bound is for them.
   * A family the product does not ship is counted at the fallback — the widest of six system stacks,
   * glyph by glyph — and may run longer, by design; it only has to come out at or over the truth
   * (`cabecera-con-marca`'s body is Charter: 40 over, 48 of them on the fallback and the margin). */
  const firstFamily = (stack: string) =>
    (stack.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "");
  const shipped = (doc: RetorikaDocument) =>
    (["font.heading", "font.body"] as const).every(
      (key) => firstFamily(doc.theme[key]) in GLYPH_ADVANCES,
    );

  for (const [name, doc] of sites) {
    const bound = shipped(doc) ? ", by under 60 px" : " (a family the product does not ship)";
    it(`${name}: the estimate is at or over the truth${bound}`, async () => {
      const { truth, faces } = await truthOf(doc);
      // Drawn in its own letter, or the bound measured nothing: a shipped family's faces are on the
      // page and loaded (a second source: the page's own faces against the table's keys).
      for (const key of ["font.heading", "font.body"] as const) {
        const family = firstFamily(doc.theme[key]);
        if (family in GLYPH_ADVANCES) expect(faces, `${name}: ${family}`).toContain(family);
      }
      const estimate = headerWidths(doc);
      expect(estimate.phone, name).not.toBe("always");
      const phone = estimate.phone as number;
      process.stdout.write(
        `fold ${name}: truth ${truth}, estimate ${phone}, slack ${phone - truth}\n`,
      );
      expect(phone, `${name}: truth ${truth}`).toBeGreaterThanOrEqual(truth);
      if (shipped(doc)) expect(phone - truth, `${name}: slack`).toBeLessThan(60);
    });
  }

  it("counts a logo with no stored size as four times as wide as tall, and comes out long", async () => {
    const doc = headerCase("unsized", PALETTES[0]?.id ?? "", {
      brand: { name: true, logo: { src: "assets/portada.png" } },
    }).document;
    const { truth } = await truthOf(doc);
    const estimate = headerWidths(doc);
    expect(estimate.phone).not.toBe("always");
    expect(estimate.phone as number).toBeGreaterThanOrEqual(truth);
    expect((estimate.phone as number) - truth).toBeGreaterThan(40);
  });

  /**
   * **The table is what the faces draw** (sprint 34 día 3): every advance in `glyphAdvances.ts` against
   * the glyph drawn alone, kerning off, by the face it names, from the bytes the site ships — at
   * 1000 px, where a platform that draws whole pixels is off by half a thousandth. The table is
   * generated, and its first method, ten copies of a glyph, called up the forms fonts keep for repeats
   * («ff», «tt», Cormorant Garamond's capitals, Manrope's «--»): 63 advances short, up to 0.15 em,
   * and Cormorant's «TERRAZA» 5 % narrower in the estimate than drawn.
   */
  it("every advance in the glyph table is the glyph as its face draws it alone", async () => {
    const rules = SHIPPABLE_FAMILIES.flatMap(({ family, faces }) =>
      faces.map(
        (face) =>
          `@font-face { font-family: "${family}"; font-weight: ${face.weight}; src: url("fonts/${face.file}") format("woff2"); }`,
      ),
    );
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${rules.join("\n")}
      body { margin: 0; font-size: 1000px; } span { white-space: pre; display: inline-block; }
      </style></head><body></body></html>`;
    const page = await openHtml(browser, html, 1280, "glyphs");
    try {
      const off = await page.evaluate((table) => {
        const out: string[] = [];
        for (const [family, weights] of Object.entries(table)) {
          for (const [weight, advances] of Object.entries(weights)) {
            const host = document.createElement("div");
            host.style.cssText = `font-family: "${family}"; font-weight: ${weight}; font-kerning: none;`;
            document.body.append(host);
            for (const [glyph, em] of Object.entries(advances as Record<string, number>)) {
              const span = document.createElement("span");
              span.textContent = glyph;
              host.append(span);
              const drawn = span.getBoundingClientRect().width / 1000;
              span.remove();
              if (Math.abs(drawn - em) > 0.0015) {
                out.push(`${family} ${weight} «${glyph}»: table ${em}, drawn ${drawn.toFixed(4)}`);
              }
            }
            host.remove();
          }
        }
        return out;
      }, GLYPH_ADVANCES);
      expect(off, off.join("\n")).toEqual([]);
    } finally {
      await page.context().close();
    }
  });

  /**
   * **And at every size the bar takes, never narrower than this machine draws** (David's decision of
   * día 3: the table holds the widest measured on macOS and on CI's Linux). The table's advance there
   * — the em by the size, and what `BAR_EXCESS` adds from the widest machine measured — against each
   * glyph drawn alone, kerning off, here: on this Mac, and on CI's Linux, where the measure of día 3
   * found Poppins 3.5 % wider at 13.125 px. A machine whose letter outgrows the measure — a new
   * engine, a new hinting — goes red here before any bar wraps, and `pnpm fonts:measure` on it is what
   * brings its letter in.
   */
  it("holds at every bar size at least what this machine draws", async () => {
    const rows = Object.entries(GLYPH_ADVANCES).flatMap(([family, weights]) =>
      ([400, 700] as const).flatMap((weight) =>
        BAR_SIZES.map((size) => {
          const excess = BAR_EXCESS[family]?.[weight]?.[String(size)];
          if (excess === undefined) throw new Error(`no excess for ${family} ${weight} ${size}`);
          const table = GLYPHS.map(
            (g, i) =>
              (weights[weight][g] ?? 0) * size + BAR_EXCESS_DIGITS.indexOf(excess[i] ?? "") / 16,
          );
          return { family, weight, size, table };
        }),
      ),
    );
    const rules = SHIPPABLE_FAMILIES.flatMap(({ family, faces }) =>
      faces.map(
        (face) =>
          `@font-face { font-family: "${family}"; font-weight: ${face.weight}; src: url("fonts/${face.file}") format("woff2"); }`,
      ),
    );
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${rules.join("\n")}
      body { margin: 0; } span { white-space: pre; display: inline-block; }
      </style></head><body></body></html>`;
    const page = await openHtml(browser, html, 1280, "bar sizes");
    try {
      const wider = await page.evaluate(
        ({ rows, glyphs }) => {
          const out: string[] = [];
          for (const { family, weight, size, table } of rows) {
            const host = document.createElement("div");
            host.style.cssText = `font-family: "${family}"; font-weight: ${weight}; font-size: ${size}px; font-kerning: none;`;
            const spans = glyphs.map((g) => {
              const span = document.createElement("span");
              span.textContent = g;
              host.append(span);
              return span;
            });
            document.body.append(host);
            spans.forEach((span, i) => {
              const drawn = span.getBoundingClientRect().width;
              const held = table[i] ?? 0;
              if (drawn > held + 0.001) {
                out.push(
                  `${family} ${weight} ${size}px «${glyphs[i]}»: drawn ${drawn}, table ${held.toFixed(4)}`,
                );
              }
            });
            host.remove();
          }
          return out;
        },
        { rows, glyphs: [...GLYPHS] },
      );
      expect(wider, wider.slice(0, 40).join("\n")).toEqual([]);
    } finally {
      await page.context().close();
    }
  });

  /**
   * **Kerning never widens a label past the table's margin, on this machine** (David's decision of
   * día 3: «el 1,5 % no es una constante suelta: la prueba conservadora lo deriva»). Every label the
   * margins were measured over, in every shipped family and weight, drawn whole with kerning against
   * its glyphs drawn alone, at 100 px — in lower case, and in capitals with the bar's letter-spacing,
   * taken out of both sides since the renderer adds it exactly. The widest of each case is printed
   * every run; past its margin, the table's margin has to rise, and the PR that raises it says so.
   */
  it("never lets kerning widen a label past the table's margin, in lower case or in capitals", async () => {
    const rules = SHIPPABLE_FAMILIES.flatMap(({ family, faces }) =>
      faces.map(
        (face) =>
          `@font-face { font-family: "${family}"; font-weight: ${face.weight}; src: url("fonts/${face.file}") format("woff2"); }`,
      ),
    );
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${rules.join("\n")}
      body { margin: 0; font-size: 100px; } span { white-space: pre; display: inline-block; }
      </style></head><body></body></html>`;
    const page = await openHtml(browser, html, 1280, "kerning");
    try {
      const widest = await page.evaluate(
        ({ families, labels }) => {
          const out = { lower: { ratio: 0, at: "" }, upper: { ratio: 0, at: "" } };
          for (const family of families) {
            for (const weight of [400, 700]) {
              for (const kase of ["lower", "upper"] as const) {
                const upper = kase === "upper";
                for (const label of labels) {
                  const text = upper ? label.toUpperCase() : label;
                  const host = document.createElement("div");
                  host.style.cssText = `font-family: "${family}"; font-weight: ${weight};${upper ? " letter-spacing: 6px;" : ""}`;
                  const whole = document.createElement("span");
                  whole.textContent = text;
                  host.append(whole);
                  const alone = [...text].map((g) => {
                    const span = document.createElement("span");
                    span.style.fontKerning = "none";
                    span.textContent = g;
                    host.append(span);
                    return span;
                  });
                  document.body.append(host);
                  const spacing = upper ? 6 * [...text].length : 0;
                  const sum = alone.reduce((t, span) => t + span.getBoundingClientRect().width, 0);
                  const ratio = (whole.getBoundingClientRect().width - spacing) / (sum - spacing);
                  if (ratio > out[kase].ratio) {
                    out[kase] = { ratio, at: `${family} ${weight} «${text}»` };
                  }
                  host.remove();
                }
              }
            }
          }
          return out;
        },
        { families: Object.keys(GLYPH_ADVANCES), labels: [...KERNING_LABELS] },
      );
      for (const kase of ["lower", "upper"] as const) {
        process.stdout.write(
          `kerning ${kase}: widest ${(100 * (widest[kase].ratio - 1)).toFixed(2)} % at ${widest[kase].at}, margin ${(100 * (KERNING_MARGINS[kase] - 1)).toFixed(1)} %\n`,
        );
        expect(widest[kase].ratio, `${kase}: ${widest[kase].at}`).toBeLessThanOrEqual(
          KERNING_MARGINS[kase],
        );
      }
    } finally {
      await page.context().close();
    }
  });

  it("three labels of twenty letters: folded, the bar holds; unfolded by sabotage, check 11 is red at 768", async () => {
    const base = headerCase("twenty", PALETTES[0]?.id ?? "", {}).document;
    const doc = parseDocument({
      ...base,
      pages: base.pages.map((p, i) => (i === 0 ? p : { ...p, menuLabel: "Reservas para grupos" })),
    });
    const w = headerWidths(doc);
    expect(w.phone === "always" || w.phone >= 768, JSON.stringify(w)).toBe(true);
    // Folded: at 768 the strip is not drawn and the bar is the phone's.
    const folded = await openHtml(browser, render(doc, "html").html, 768, "twenty");
    try {
      expect(await checkHoldsItsLines(folded)).toEqual([]);
      expect(await folded.locator(".rb-nav-wide").evaluate((el) => el.checkVisibility())).toBe(
        false,
      );
      expect(
        await folded
          .locator("details.rb-nav-narrow > summary")
          .evaluate((el) => el.checkVisibility()),
      ).toBe(true);
    } finally {
      await folded.context().close();
    }
    // Sabotaged: the fold written back to 720, the strip drawn at 768 and wrapped — red.
    const sabotaged = await openHtml(browser, unfolded(doc), 768, "twenty/sabotaged");
    try {
      const findings = await checkHoldsItsLines(sabotaged);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatch(/^11 lines: .* a line wrapped$/);
    } finally {
      await sabotaged.context().close();
    }
  });
});
