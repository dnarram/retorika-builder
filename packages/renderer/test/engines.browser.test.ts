import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  type Browser,
  type BrowserType,
  chromium,
  firefox,
  type Page,
  webkit,
} from "@playwright/test";
import { type Header, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * **The same site in the three engines** (sprint 32 día 6).
 *
 * Every other browser suite launches Chromium, which is the engine that has everything this sprint
 * reached for: scroll-driven animations, anchor positioning, cross-document view transitions,
 * `backdrop-filter`. The published page is meant to degrade by `@supports` and by media query where
 * an engine lacks one, and a fallback nobody opens in the engine that takes it is a fallback that
 * has never run. This file opens the same two sites in Chromium, Firefox and WebKit and asserts
 * what must hold in all three, whatever each one supports:
 *
 * 1. every word drawn is drawn at full opacity, after loading and all the way down, for the visitor
 *    who has not asked for less movement — the one the motion is for, and the one a broken fallback
 *    would leave looking at an empty section;
 * 2. the current page is marked under its entry, by the sliding indicator where the engine anchors
 *    and by the entry's own rule where it does not — one of the two, never neither, never both;
 * 3. a fixed bar once scrolled is glass where the engine blurs and opaque where it does not, and in
 *    no engine a transparent bar over the text.
 *
 * What each engine supports is printed once at the end (for REVIEW.md), so a run says which branch of
 * each fallback it exercised. **An engine Playwright has not installed is skipped saying so** — CI
 * installs Chromium alone — never silently: the skip shows in the count and the reason in the output.
 */

const ORIGIN = "http://motores.test";

const ENGINES: readonly [string, BrowserType][] = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];

function installed(type: BrowserType): boolean {
  try {
    return existsSync(type.executablePath());
  } catch {
    return false;
  }
}

function fixture(name: string): RetorikaDocument {
  return parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, `${name}.json`), "utf8")));
}

/** `cabecera-con-marca` with its header changed, every page of it. */
function withHeader(header: Partial<Header>): RetorikaDocument {
  const doc = fixture("cabecera-con-marca");
  return parseDocument({ ...doc, header: { ...doc.header, ...header } });
}

const SITES = ["menu-y-paginas", "cabecera-con-marca"] as const;
const WIDTHS = [1280, 390] as const;

const ASSET_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** What each engine said it supports, printed after the run. */
const supportReport: string[] = [];

/**
 * A whole site served by routes, every page of it. `motion` is the visitor who has not asked for
 * less; the default is the settled page the other suites measure.
 */
async function openSite(
  browser: Browser,
  doc: RetorikaDocument,
  width: number,
  motion: boolean,
  path = "/",
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height: width < 721 ? 844 : 900 },
    reducedMotion: motion ? "no-preference" : "reduce",
  });
  const page = await context.newPage();
  const pages = new Map(
    doc.pages.map((p, i) => [
      i === 0 ? "/" : `/${p.slug}.html`,
      render(doc, "html", { pageId: p.id }).html,
    ]),
  );
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    const html = pages.get(url.pathname === "/index.html" ? "/" : url.pathname);
    if (html !== undefined) {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }
    if (url.pathname.startsWith("/assets/")) {
      const name = basename(url.pathname);
      const contentType = ASSET_TYPES[name.slice(name.lastIndexOf(".") + 1)];
      if (!contentType) throw new Error(`no content type for asset ${name}`);
      return route.fulfill({ contentType, body: readFileSync(join(ASSETS_DIR, name)) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}${path}`, { waitUntil: "load" });
  await page.evaluate(() => Promise.allSettled([...document.images].map((img) => img.decode())));
  return page;
}

/**
 * Waits for every animation on the document's own timeline to end: the cover's words, a bar's
 * transition. Not a section's reveal — on a view timeline it runs for as long as the page can scroll
 * and its `finished` never settles (sprint 32 día 2).
 */
function settle(page: Page): Promise<unknown> {
  return page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.timeline === document.timeline)
        .map((a) => a.finished),
    ),
  );
}

/**
 * Every run of text the page draws — inside the window when `inView` — whose effective opacity (its
 * own times every ancestor's) is not 1, described. Empty is the claim. A word in a closed menu or a
 * hidden copy is not drawn and is not counted.
 */
function faded(page: Page, inView: boolean): Promise<string[]> {
  return page.evaluate((inView) => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el) continue;
      if (!el.checkVisibility({ visibilityProperty: true })) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (inView && (box.bottom <= 0 || box.top >= window.innerHeight)) continue;
      let opacity = 1;
      for (let e: Element | null = el; e; e = e.parentElement) {
        opacity *= Number(getComputedStyle(e).opacity);
      }
      if (opacity !== 1) out.push(`«${text.slice(0, 40)}» at ${opacity.toFixed(3)}`);
    }
    return out;
  }, inView);
}

/** The alpha of a computed colour, in whatever form the engine writes it. */
function alphaOf(color: string): number {
  const slash = /\/\s*([\d.]+)\s*\)$/.exec(color);
  if (slash) return Number(slash[1]);
  const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color);
  if (rgba) return Number(rgba[1]);
  if (/^rgb\([^,]+,[^,]+,[^,]+\)$/.test(color) || /^color\(srgb [-\d.e\s]+\)$/.test(color))
    return 1;
  throw new Error(`a computed colour this test cannot read: ${color}`);
}

for (const [name, type] of ENGINES) {
  const present = installed(type);
  if (!present) {
    // Straight to stderr and not through `console`: the run is silent by default, and a skip whose
    // reason nobody reads is the silent skip this file refuses.
    process.stderr.write(
      `engines.browser: ${name} is not installed (${type.executablePath()}); its tests are skipped. ` +
        `\`pnpm exec playwright install ${name}\` installs it.\n`,
    );
  }

  describe.skipIf(!present)(`${name}`, () => {
    let browser: Browser;
    beforeAll(async () => {
      browser = await type.launch();
      const page = await browser.newPage();
      const supports = await page.evaluate(() => ({
        "animation-timeline: view()": CSS.supports("animation-timeline: view()"),
        "anchor-name": CSS.supports("anchor-name: --x"),
        "backdrop-filter": CSS.supports("backdrop-filter: blur(1px)"),
        "-webkit-backdrop-filter": CSS.supports("-webkit-backdrop-filter: blur(1px)"),
        startViewTransition: "startViewTransition" in document,
      }));
      supportReport.push(`${name} ${browser.version()}: ${JSON.stringify(supports)}`);
      await page.close();
    });
    afterAll(async () => {
      await browser?.close();
    });

    for (const site of SITES) {
      for (const width of WIDTHS) {
        it(`draws every word at full opacity after loading and all the way down, ${site} at ${width}`, async () => {
          const page = await openSite(browser, fixture(site), width, true);
          try {
            await settle(page);
            expect(await faded(page, false), "after loading").toEqual([]);
            const height = await page.evaluate(() => document.documentElement.scrollHeight);
            // A third of a window at a time, so every section crosses the bottom edge — the moment a
            // reveal starts — at some step, and is looked at there.
            const step = Math.round((width < 721 ? 844 : 900) / 3);
            for (let y = step; y < height; y += step) {
              await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
              await page.evaluate(
                () =>
                  new Promise((r) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => r(0))),
                  ),
              );
              expect(await faded(page, true), `scrolled to ${y}`).toEqual([]);
            }
            await settle(page);
            expect(await faded(page, false), "at the bottom").toEqual([]);
          } finally {
            await page.context().close();
          }
        });
      }
    }

    it("marks the current page under its entry: the indicator where it anchors, the rule where it does not", async () => {
      // A page other than the first: the first is reached by the brand and has no entry of its own.
      const page = await openSite(
        browser,
        fixture("cabecera-con-marca"),
        1280,
        true,
        "/que-ponemos.html",
      );
      try {
        const mark = await page.evaluate(() => {
          const nav = document.querySelector<HTMLElement>(
            ".rb-nav-wide > .rb-nav[data-part=pagesLinks]",
          );
          const current = nav?.querySelector<HTMLElement>("a[aria-current]");
          if (!nav || !current) throw new Error("no pages strip or no current entry");
          const after = getComputedStyle(nav, "::after");
          const navBox = nav.getBoundingClientRect();
          const box = current.getBoundingClientRect();
          const entry = getComputedStyle(current);
          const indicator =
            after.content !== "none" &&
            after.display !== "none" &&
            Number.parseFloat(after.width) > 0;
          return {
            anchors: CSS.supports("anchor-name: --x"),
            indicator,
            indicatorLeft: Number.parseFloat(after.left),
            indicatorWidth: Number.parseFloat(after.width),
            entryLeft: box.left - navBox.left,
            entryWidth: box.width,
            underline:
              entry.textDecorationLine.includes("underline") &&
              entry.textDecorationColor !== "rgba(0, 0, 0, 0)" &&
              entry.textDecorationColor !== "transparent",
          };
        });
        const where = JSON.stringify(mark);
        expect(mark.indicator !== mark.underline, `exactly one mark: ${where}`).toBe(true);
        expect(mark.indicator, where).toBe(mark.anchors);
        if (mark.indicator) {
          expect(Math.abs(mark.indicatorLeft - mark.entryLeft), where).toBeLessThanOrEqual(1);
          expect(Math.abs(mark.indicatorWidth - mark.entryWidth), where).toBeLessThanOrEqual(1);
        }
      } finally {
        await page.context().close();
      }
    });

    for (const [background, glass] of [
      ["surface", true],
      ["ink", true],
      ["transparent", true],
      ["primary", false],
    ] as const) {
      it(`is glass where it blurs and opaque where it does not once scrolled, never see-through, ${background}`, async () => {
        const page = await openSite(
          browser,
          withHeader({ sticky: true, look: { background } }),
          1280,
          false,
        );
        try {
          await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
          await expect
            .poll(() =>
              page.evaluate(() =>
                document.querySelector(".rb-header")?.hasAttribute("data-scrolled"),
              ),
            )
            .toBe(true);
          await settle(page);
          const bar = await page.evaluate(() => {
            const style = getComputedStyle(document.querySelector(".rb-header") as Element);
            return {
              backdrop: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
              background: style.backgroundColor,
              blurs:
                CSS.supports("backdrop-filter: blur(1px)") ||
                CSS.supports("-webkit-backdrop-filter: blur(1px)"),
            };
          });
          const where = JSON.stringify(bar);
          const alpha = alphaOf(bar.background);
          if (glass && bar.blurs) {
            expect(bar.backdrop, where).toBe("blur(12px)");
            expect(alpha, where).toBe(0.88);
          } else {
            expect(bar.backdrop || "none", where).toBe("none");
            expect(alpha, where).toBe(1);
          }
        } finally {
          await page.context().close();
        }
      });
    }

    // ADR 0065 (sprint 33 día 1): with the phone's sheet open, the page does not move under a wheel,
    // and moves again once it is closed. The wheel and never `scrollTo`, which `overflow: hidden`
    // leaves free (David's adjustment 1). A desktop engine each: WebKit here is not Safari on an
    // iPhone, which is first on its own list (the ADR says why).
    it("holds the page still under the open sheet at 390 × 844, and lets it go when closed", async () => {
      // Sections hidden on the phone: with their row under it a fixed bar lets go there
      // (`data-phone-row`), and pressing «Menú» would scroll the page back up to reach it.
      const page = await openSite(
        browser,
        withHeader({ sticky: true, sections: { shown: true, mobile: "hidden" } }),
        390,
        false,
      );
      try {
        const wheel = async (dy: number) => {
          await page.mouse.move(195, 422);
          await page.mouse.wheel(0, dy);
          await page.waitForTimeout(400);
          return page.evaluate(() => Math.round(window.scrollY));
        };
        await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
        await page.click(".rb-nav-narrow > summary");
        expect(await wheel(2000)).toBe(300);
        await page.keyboard.press("Escape");
        expect(await wheel(200)).toBeGreaterThan(300);
      } finally {
        await page.context().close();
      }
    });

    // ADR 0062 named the question for this day: whether an engine's scroll anchoring moves the page
    // under a view timeline. The bar's condensing is the one re-layout a published page makes
    // mid-scroll, and its `margin-bottom` gives back what its padding takes so that the page does not
    // rest on any engine's anchoring. All three anchor (measured on día 6: content grown above the
    // window keeps `scrollY` in step in each), and with the margin taken away the in-flow bar moves
    // the page in all three — none of them saves the condensing on its own. With the motion on.
    for (const background of ["surface", "transparent"] as const) {
      it(`moves the first section exactly −400 px on a 400 px scroll while the bar condenses, ${background}`, async () => {
        const page = await openSite(
          browser,
          withHeader({ sticky: true, look: { background } }),
          1280,
          true,
        );
        try {
          await settle(page);
          const top = () =>
            page.evaluate(
              () =>
                document.querySelector("main > .rb-section")?.getBoundingClientRect().top ?? NaN,
            );
          const before = await top();
          await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
          await expect
            .poll(() =>
              page.evaluate(() =>
                document.querySelector(".rb-header")?.hasAttribute("data-scrolled"),
              ),
            )
            .toBe(true);
          await settle(page);
          const after = await top();
          const scrollY = await page.evaluate(() => window.scrollY);
          expect(scrollY).toBe(400);
          // Within a sixty-fourth of a pixel, under any engine's layout unit (WebKit's 1/64, Firefox's
          // 1/60): Firefox reads −400.000015 on surface (día 6, twice), arithmetic and not movement.
          expect(Math.abs(after - before + 400), `moved ${after - before}`).toBeLessThan(1 / 64);
        } finally {
          await page.context().close();
        }
      });
    }
  });
}

afterAll(() => {
  // For REVIEW.md: which branch of each fallback this run exercised, engine by engine.
  // To stdout directly, like the skips: the run is silent by default.
  process.stdout.write(
    `engines.browser — what each engine supports:\n  ${supportReport.join("\n  ")}\n`,
  );
});
