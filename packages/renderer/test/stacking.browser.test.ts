import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * **The stack's ceiling, painted** (ADR 0085, sprint 41 día 7, David's adjustment 1): «ningún
 * elemento traído al frente se pinta sobre la barra fija, sobre la hoja del menú del móvil ni fuera
 * de su sección. En una sección con fondo con motivos, el velo del 40 sigue por debajo de todo lo
 * colocado. Prueba en Chromium con la fixture `capas` más barra fija y fondo; saboteo: quitar el
 * contexto». `capas` is exactly that: a sticky bar with a pages sheet on a phone, a cover with a
 * background with motifs, its photograph brought over a button, and a headline above both.
 */

const ORIGIN = "http://site.test";
let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const doc: RetorikaDocument = parseDocument(
  JSON.parse(readFileSync(join(DOCUMENTS_DIR, "capas.json"), "utf8")),
);

async function open(width: number): Promise<Page> {
  const html = render(doc, "html").html;
  const context = await browser.newContext({
    viewport: { width, height: 700 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/") {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }
    if (url.pathname.startsWith("/assets/")) {
      const name = basename(url.pathname);
      const type = name.endsWith(".png") ? "image/png" : "image/svg+xml";
      return route.fulfill({ contentType: type, body: readFileSync(join(ASSETS_DIR, name)) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  return page;
}

/** What the visitor's pointer meets at the middle of an element's box, by its id or its class. */
function topAt(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) throw new Error(`nothing at ${sel}`);
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      id: hit?.closest<HTMLElement>("[data-id]")?.dataset["id"] ?? null,
      inHeader: hit?.closest(".rb-header") !== null,
      inSheet: hit?.closest(".rb-nav-narrow") !== null,
    };
  }, selector);
}

describe("the stack, painted (ADR 0085)", () => {
  it("puts the photograph over the button sent under it, and the headline over both", async () => {
    const page = await open(1280);
    try {
      expect((await topAt(page, '[data-id="el-cta"]')).id).toBe("el-image");
      expect((await topAt(page, '[data-id="el-headline"]')).id).toBe("el-headline");
      // The veil is the section's `::before`: a point it painted over would answer the section
      // itself, not the photograph.
      expect((await topAt(page, '[data-id="el-image"]')).id).toBe("el-image");
    } finally {
      await page.context().close();
    }
  });

  it("never paints over the fixed bar when the page is scrolled under it", async () => {
    const page = await open(1280);
    try {
      await page.evaluate(() => window.scrollBy(0, 160));
      await page.waitForFunction(() =>
        document.querySelector(".rb-header")?.hasAttribute("data-scrolled"),
      );
      // The photograph (z-index 4) is now under the bar (2): the bar is what the pointer meets.
      const at = await topAt(page, ".rb-header");
      expect(at.inHeader).toBe(true);
    } finally {
      await page.context().close();
    }
  });

  it("never paints over the phone's menu sheet", async () => {
    const page = await open(390);
    try {
      await page.locator("details.rb-nav-narrow > summary").click();
      await expect
        .poll(() => page.locator("details.rb-nav-narrow").getAttribute("open"))
        .not.toBeNull();
      const at = await topAt(page, "details.rb-nav-narrow .rb-nav");
      expect(at.inSheet).toBe(true);
    } finally {
      await page.context().close();
    }
  });
});
