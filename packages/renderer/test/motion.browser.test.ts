import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { closeCombination, headerCombinations, openCombination } from "./browser-fixtures.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * The page at rest against the page in motion (sprint 32 día 0, and día 2's vocabulary).
 *
 * The accessibility and overflow suites open every page under `prefers-reduced-motion: reduce`, so
 * they measure the settled page. This file is their twin: it opens the same page twice, once for a
 * visitor who asked for less movement and once for one who did not, and asserts that the second
 * sees movement and that the movement ends where the first one started. A stylesheet whose entrance
 * never ended, or never ran, would pass the suites that measure and fail here.
 *
 * What moves (ADR 0062, ADR 0063): «Ir a…» coming in; a section's children rising as the visitor
 * scrolls to them, on a view timeline that ends 160 px after each one shows; the cover's words; the
 * page fading into the next with the bar still.
 */

const ORIGIN = "http://movimiento.test";
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

const FOLD = () => {
  const c = headerCombinations().find((h) => h.id.startsWith("header/fold/"));
  if (!c) throw new Error("no «Ir a…» combination in headerCombinations()");
  return c;
};

function fixture(name: string): RetorikaDocument {
  return parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, `${name}.json`), "utf8")));
}

const ASSET_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/**
 * A whole site served by routes, every page of it, so a navigation between two of its pages is a
 * same-origin navigation the browser may transition. `motion` opens it for the visitor who did not
 * ask for less; the default is the settled page.
 */
async function openSite(doc: RetorikaDocument, motion = false): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
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
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  return page;
}

/** The computed opacity and transform of the first child of a section. */
function stateOf(page: Page, section: string): Promise<{ opacity: string; transform: string }> {
  return page.evaluate((id) => {
    const el = document.querySelector<HTMLElement>(`[data-section="${id}"] > *`);
    if (!el) throw new Error(`no child in ${id}`);
    const style = getComputedStyle(el);
    return { opacity: style.opacity, transform: style.transform };
  }, section);
}

describe("«Ir a…» exists for a visitor who did not ask for less, and ends at rest", () => {
  it("plays under no-preference and ends fully visible and in place", async () => {
    const page = await openCombination(browser, FOLD(), 1280, true);
    try {
      await page.click(".rb-nav-fold > summary");
      const running = await page.evaluate(() => document.getAnimations().length);
      expect(running).toBeGreaterThan(0);
      // The panel's own animations, not the document's: a section's view-timeline animation never
      // finishes while the page can scroll, and a wait on all of them never returns (measured: 60 s).
      await page.evaluate(() =>
        Promise.all(
          (document.querySelector(".rb-nav-fold > .rb-nav") as HTMLElement)
            .getAnimations()
            .map((a) => a.finished),
        ),
      );
      const rest = await page.evaluate(() => {
        const panel = document.querySelector(".rb-nav-fold > .rb-nav") as HTMLElement;
        const style = getComputedStyle(panel);
        return { opacity: style.opacity, transform: style.transform };
      });
      expect(rest.opacity).toBe("1");
      expect(rest.transform).toBe("none");
    } finally {
      await closeCombination(page);
    }
  });

  it("does not play under reduce: the harness page is the settled one", async () => {
    const page = await openCombination(browser, FOLD(), 1280);
    try {
      await page.click(".rb-nav-fold > summary");
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      const opacity = await page.evaluate(
        () =>
          getComputedStyle(document.querySelector(".rb-nav-fold > .rb-nav") as HTMLElement).opacity,
      );
      expect(opacity).toBe("1");
    } finally {
      await closeCombination(page);
    }
  });
});

describe("a section comes in as the visitor scrolls to it (ADR 0062)", () => {
  it("is invisible below the fold and at rest once scrolled to, on a view timeline", async () => {
    const page = await openSite(fixture("menu-y-paginas"), true);
    try {
      expect(await page.evaluate(() => CSS.supports("animation-timeline: view()"))).toBe(true);
      // The contact section, well under the first screen at 720 px.
      const below = await page.evaluate(
        () => document.querySelector('[data-section="sec-contact"]')?.getBoundingClientRect().top,
      );
      expect(below).toBeGreaterThan(720);
      // Under the fold it is its ordinary self (no fill): what axe reads at load. The fade starts
      // the moment it shows.
      expect((await stateOf(page, "sec-contact")).opacity).toBe("1");
      const timeline = await page.evaluate(() => {
        const el = document.querySelector('[data-section="sec-contact"] > *') as HTMLElement;
        return el.getAnimations().map((a) => a.timeline?.constructor.name);
      });
      expect(timeline).toContain("ViewTimeline");
      await page.evaluate(() =>
        document.querySelector('[data-section="sec-contact"]')?.scrollIntoView({ block: "center" }),
      );
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
      await expect.poll(async () => (await stateOf(page, "sec-contact")).opacity).toBe("1");
      expect((await stateOf(page, "sec-contact")).transform).toBe("none");
      // The cover, the first section, never had it: its photograph is the LCP element.
      expect(
        await page.evaluate(() =>
          [...document.querySelectorAll('[data-section="sec-cover"] > *')].some((el) =>
            el.getAnimations().some((a) => a.timeline?.constructor.name === "ViewTimeline"),
          ),
        ),
      ).toBe(false);
      expect(
        await page.evaluate(
          () =>
            document.querySelector<HTMLElement>('[data-section="sec-cover"] img')?.getAnimations()
              .length,
        ),
      ).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  it("has finished 160 px after a child shows, however tall the child (adjustment 3)", async () => {
    const page = await openSite(fixture("menu-y-paginas"), true);
    try {
      // A 1600 px child, taller than the window: on a percentage range it would stay half-faded
      // with its top in view.
      await page.addStyleTag({
        content: '[data-section="sec-contact"] > :first-child { min-height: 1600px; }',
      });
      const top = await page.evaluate(
        () => (document.querySelector('[data-section="sec-contact"] > *') as HTMLElement).offsetTop,
      );
      const at = (y: number) =>
        page.evaluate(async (top) => {
          window.scrollTo({ top, behavior: "instant" });
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          return getComputedStyle(
            document.querySelector('[data-section="sec-contact"] > *') as HTMLElement,
          ).opacity;
        }, y);
      // Its top just under the bottom edge: not yet shown, and so its ordinary self (no fill).
      expect(Number(await at(top - 720 - 10))).toBe(1);
      // Just shown, 2 px in: at the start of its fade (2 of the 24 px, about 0.08).
      expect(Number(await at(top - 720 + 2))).toBeLessThan(0.15);
      // 12 px in, half way through the fade's 24 px: half faded; 80 px in, the fade is done and the
      // rise is half way (transform, not opacity, is what still moves).
      const half = Number(await at(top - 720 + 12));
      expect(half).toBeGreaterThan(0.3);
      expect(half).toBeLessThan(0.7);
      expect(Number(await at(top - 720 + 80))).toBe(1);
      const rising = await page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector('[data-section="sec-contact"] > *') as HTMLElement,
          ).transform,
      );
      expect(rising).not.toBe("none");
      // 160 px after it showed — with 1440 px of it still under the fold — at rest.
      expect(Number(await at(top - 720 + 170))).toBe(1);
    } finally {
      await page.context().close();
    }
  });

  it("shows everything, moving nothing, for a visitor who asked for less", async () => {
    const page = await openSite(fixture("menu-y-paginas"));
    try {
      expect((await stateOf(page, "sec-contact")).opacity).toBe("1");
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    } finally {
      await page.context().close();
    }
  });
});

describe("the cover's words come in once (ADR 0062)", () => {
  it("rise 80 ms apart and end at rest within 600 ms; the photograph never moves", async () => {
    const page = await openSite(fixture("menu-y-paginas"), true);
    try {
      const names = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-section="sec-cover"] > *')].map((el) => ({
          tag: el.tagName,
          animations: el.getAnimations().map((a) => (a as CSSAnimation).animationName),
          delay: el.getAnimations().map((a) => a.effect?.getTiming().delay),
        })),
      );
      const h1 = names.find((n) => n.tag === "H1");
      expect(h1?.animations).toEqual(["rb-rise"]);
      expect(h1?.delay).toEqual([0]);
      const p = names.find((n) => n.tag === "P");
      expect(p?.delay).toEqual([80]);
      for (const n of names.filter((n) => n.tag === "IMG" || n.tag === "DIV")) {
        expect(n.animations, n.tag).toEqual([]);
      }
      await page.evaluate(() =>
        Promise.all(
          [...document.querySelectorAll<HTMLElement>('[data-section="sec-cover"] > *')]
            .flatMap((el) => el.getAnimations())
            .map((a) => a.finished),
        ),
      );
      const h1Style = await page.evaluate(() => {
        const style = getComputedStyle(
          document.querySelector('[data-section="sec-cover"] h1') as Element,
        );
        return { opacity: style.opacity, transform: style.transform };
      });
      expect(h1Style).toEqual({ opacity: "1", transform: "none" });
    } finally {
      await page.context().close();
    }
  });
});

describe("the page fades into the next and the bar stays (ADR 0062)", () => {
  it("transitions a same-origin navigation for the visitor who did not ask for less, and not for the one who did", async () => {
    for (const motion of [true, false]) {
      const page = await openSite(fixture("menu-y-paginas"), motion);
      try {
        await page.addInitScript(() => {
          window.addEventListener("pagereveal", (event) => {
            (window as unknown as { __vt: boolean }).__vt =
              (event as unknown as { viewTransition: unknown }).viewTransition !== null;
          });
        });
        expect(await page.evaluate(() => "startViewTransition" in document)).toBe(true);
        expect(
          await page.evaluate(
            () =>
              getComputedStyle(document.querySelector(".rb-header") as Element).viewTransitionName,
          ),
        ).toBe(motion ? "rb-header" : "none");
        await page.reload({ waitUntil: "load" });
        await page.click('.rb-nav-wide a[href="./que-ponemos.html"]');
        await page.waitForURL("**/que-ponemos.html");
        await expect
          .poll(() => page.evaluate(() => (window as unknown as { __vt?: boolean }).__vt))
          .toBe(motion);
      } finally {
        await page.context().close();
      }
    }
  });
});
