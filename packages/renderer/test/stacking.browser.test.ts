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

/** `capas` without its section's background: the background isolates the section on its own (ADR
 * 0081), so only here is the stack's own `isolation` the one thing between the photograph and the bar. */
const bare: RetorikaDocument = (() => {
  const raw = JSON.parse(JSON.stringify(doc)) as RetorikaDocument;
  const cover = raw.pages[0]?.sections[0];
  if (cover) delete cover.background;
  return parseDocument(raw);
})();

async function open(width: number, which: RetorikaDocument = doc): Promise<Page> {
  const html = render(which, "html").html;
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

/** What the visitor's pointer meets at a point of an element's box — its middle unless `dx` pixels
 * from its left edge are asked for — by the id of what is there, or whether it is the bar or the sheet. */
function topAt(page: Page, selector: string, dx?: number) {
  return page.evaluate(
    ([sel, offset]) => {
      const el = document.querySelector<HTMLElement>(sel as string);
      if (!el) throw new Error(`nothing at ${sel}`);
      const box = el.getBoundingClientRect();
      const x = offset === null ? box.left + box.width / 2 : box.left + (offset as number);
      const hit = document.elementFromPoint(x, box.top + box.height / 2);
      return {
        id: hit?.closest<HTMLElement>("[data-id]")?.dataset["id"] ?? null,
        inHeader: hit?.closest(".rb-header") !== null,
        inSheet: hit?.closest(".rb-nav-narrow") !== null,
      };
    },
    [selector, dx ?? null] as const,
  );
}

describe("the stack, painted (ADR 0085)", () => {
  it("puts the photograph over the button sent under it, and the headline over both", async () => {
    const page = await open(1280);
    try {
      expect((await topAt(page, '[data-id="el-cta"]')).id).toBe("el-image");
      // Ten pixels in from the headline's left edge, which is over the photograph: the headline's
      // middle is past the photograph's right edge and would say nothing about the stack.
      expect((await topAt(page, '[data-id="el-headline"]', 10)).id).toBe("el-headline");
      // The veil is the section's `::before`: a point it painted over would answer the section
      // itself, not the photograph.
      expect((await topAt(page, '[data-id="el-image"]')).id).toBe("el-image");
    } finally {
      await page.context().close();
    }
  });

  it("never paints over the fixed bar when the page is scrolled under it, with or without a background", async () => {
    for (const which of [doc, bare]) {
      const page = await open(1280, which);
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
    }
  });

  it("never paints over the phone's menu sheet, with or without a background", async () => {
    for (const which of [doc, bare]) {
      const page = await open(390, which);
      try {
        // Scrolled first, so the photograph is under the bar and the sheet that hangs from it: at the
        // top of the page nothing placed is there, and the case would hold with no ceiling at all.
        await page.evaluate(() => window.scrollBy(0, 120));
        await page.locator("details.rb-nav-narrow > summary").click();
        await expect
          .poll(() => page.locator("details.rb-nav-narrow").getAttribute("open"))
          .not.toBeNull();
        const at = await topAt(page, "details.rb-nav-narrow .rb-nav");
        expect(at.inSheet).toBe(true);
      } finally {
        await page.context().close();
      }
    }
  });
});
