import { type Browser, chromium } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeCombination, headerCombinations, openCombination } from "./browser-fixtures.ts";

/**
 * The page at rest against the page in motion (sprint 32 día 0).
 *
 * The accessibility and overflow suites open every page under `prefers-reduced-motion: reduce`, so
 * they measure the settled page. This file is their twin: it opens the same page twice, once for a
 * visitor who asked for less movement and once for one who did not, and asserts that the second
 * sees movement and that the movement ends where the first one started. A stylesheet whose entrance
 * never ended, or never ran, would pass the suites that measure and fail here.
 *
 * Today the only movement a published page has is «Ir a…» coming in (header.ts, `rb-fold-in`). The
 * days that follow add to the list and this file grows with it.
 */

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

describe("movement exists for a visitor who did not ask for less, and ends at rest", () => {
  it("«Ir a…» plays under no-preference and ends fully visible and in place", async () => {
    const page = await openCombination(browser, FOLD(), 1280, true);
    try {
      await page.click(".rb-nav-fold > summary");
      const running = await page.evaluate(() => document.getAnimations().length);
      expect(running).toBeGreaterThan(0);
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
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

  it("«Ir a…» does not play under reduce: the harness page is the settled one", async () => {
    const page = await openCombination(browser, FOLD(), 1280);
    try {
      await page.click(".rb-nav-fold > summary");
      const running = await page.evaluate(() => document.getAnimations().length);
      expect(running).toBe(0);
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
