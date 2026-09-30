import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * Rule 6's emission, measured in the browser that has to obey it.
 *
 * Everything here is a claim about **specificity**, and specificity is the one thing a unit test
 * cannot check: a string comparison confirms the rule was written, never that it wins. The failure
 * this suite exists to catch is silent by nature — a colour that is in the stylesheet, is correct,
 * and simply never applies because something else outranks it.
 *
 * The fixture is chosen for that: `estilo-por-elemento` colours the cover's tagline and a plain
 * link, which are exactly the two elements this stylesheet reaches with **(0,2,1)** rules
 * (`.rb-section p.rb-subtitle` and `.rb-section a:not([role=button])`, where `:not()` takes its
 * argument's specificity). With two attributes instead of three the per-element rule would be
 * (0,2,0) and lose to both.
 */

const ORIGIN = "http://site.test";
const ASSET_TYPES: Readonly<Record<string, string>> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

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

async function open(doc: RetorikaDocument, width = 1280): Promise<Page> {
  const html = render(doc, "html").html;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/") {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }
    if (url.pathname.startsWith("/assets/")) {
      const name = basename(url.pathname);
      const contentType = ASSET_TYPES[name.slice(name.lastIndexOf(".") + 1)];
      if (!contentType) throw new Error(`no content type for ${name}`);
      return route.fulfill({ contentType, body: readFileSync(join(ASSETS_DIR, name)) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  const response = await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  if (response?.status() !== 200) throw new Error("page did not load");
  return page;
}

function computed(page: Page, elementId: string, property: string): Promise<string> {
  return page.evaluate(
    ([id, prop]) => {
      const el = document.querySelector(`[data-id="${id}"]`);
      if (!el) throw new Error(`no element ${id}`);
      return getComputedStyle(el).getPropertyValue(prop as string);
    },
    [elementId, property] as const,
  );
}

describe("rule 6 — an element's own style, as the browser resolves it", () => {
  it("beats the (0,2,1) rule that targets the cover's tagline", async () => {
    // `.rb-section p.rb-subtitle` sets color.secondary. The element asks for color.muted. With a
    // two-attribute selector this test goes red with the tagline still teal, which is the whole
    // reason `data-role` is in the selector.
    const page = await open(fixture("estilo-por-elemento"));
    try {
      // color.muted is #475569; color.secondary, which would win without the third attribute, is
      // #0F766E.
      expect(await computed(page, "el-subheadline", "color")).toBe("rgb(71, 85, 105)");
    } finally {
      await page.context().close();
    }
  });

  it("beats the (0,2,1) rule that targets a plain link", async () => {
    // `.rb-section a:not([role=button])` sets color.primary (#1D4ED8). The element asks for
    // color.secondary (#0F766E).
    const page = await open(fixture("estilo-por-elemento"));
    try {
      expect(await computed(page, "el-secondary", "color")).toBe("rgb(15, 118, 110)");
    } finally {
      await page.context().close();
    }
  });

  it("beats the (0,2,0) rules too, on an h1 and on a list card", async () => {
    const page = await open(fixture("estilo-por-elemento"));
    try {
      // `.rb-section h1` sets color.primary and size.heading; the element asks for ink and the
      // subheading size.
      expect(await computed(page, "el-headline", "color")).toBe("rgb(15, 23, 42)");
      expect(await computed(page, "el-headline", "font-size")).toBe("24px");
      // Inside a list item, which is the walk a renderer forgets first.
      expect(await computed(page, "el-card-1-title", "color")).toBe("rgb(122, 31, 31)");
      expect(await computed(page, "el-card-1-title", "padding")).toBe("8px");
    } finally {
      await page.context().close();
    }
  });

  it("follows the palette for a reference, and does not for an exception", async () => {
    // Rule 6's promise, measured: «Cambiar la paleta sigue funcionando en toda la web». The theme's
    // colours are replaced wholesale; the referenced colour moves with them and the exact one does
    // not, which is precisely what "exception" means.
    const original = fixture("estilo-por-elemento");
    const repainted = parseDocument({
      ...original,
      theme: { ...original.theme, "color.muted": "#123456", "color.secondary": "#654321" },
    });
    const page = await open(repainted);
    try {
      expect(await computed(page, "el-subheadline", "color")).toBe("rgb(18, 52, 86)");
      expect(await computed(page, "el-secondary", "color")).toBe("rgb(101, 67, 33)");
      // The exception stays where it was put.
      expect(await computed(page, "el-card-1-title", "color")).toBe("rgb(122, 31, 31)");
      expect(await computed(page, "el-image", "border-radius")).toBe("28px");
    } finally {
      await page.context().close();
    }
  });

  it("still applies below 720px, where rule 7's patches also live", async () => {
    // The two vocabularies are disjoint, so a style rule and a mobile patch never contest the same
    // declaration — but a colour is a colour on a phone, and this is where that is checked rather
    // than assumed.
    const page = await open(fixture("estilo-por-elemento"), 320);
    try {
      expect(await computed(page, "el-subheadline", "color")).toBe("rgb(71, 85, 105)");
      expect(await computed(page, "el-image", "border-radius")).toBe("28px");
    } finally {
      await page.context().close();
    }
  });

  it("publishes nothing for a hidden element", async () => {
    const page = await open(fixture("estilo-por-elemento"));
    try {
      const html = await page.content();
      expect(html).not.toContain("el-oculto");
      // The magenta exception the hidden element carries reaches neither the markup nor the CSS.
      expect(html.toUpperCase()).not.toContain("#FF00FF");
    } finally {
      await page.context().close();
    }
  });

  it("cannot be escaped by an id, which is the injection this stylesheet used to allow", async () => {
    // `idSchema` has no pattern, so this id is a valid document. Before `cssAttributeValue` it
    // published `[data-section="sec-a"] * { display: none } …` — an arbitrary rule in the client's
    // own stylesheet. The check is what a browser does with it, not what the string looks like:
    // the styled element must keep its colour, and the paragraph the injected rule aimed at must
    // stay visible.
    const nasty = 'sec-a"] * { display: none } [data-section="sec-a';
    const doc = parseDocument({
      ...fixture("estilo-por-elemento"),
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Reformas Vega",
          sections: [
            {
              id: nasty,
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Reformas Vega" },
                  style: { color: { ref: "color.ink" } },
                },
                {
                  id: "el-body",
                  role: "body",
                  hidden: false,
                  slot: "body",
                  value: { kind: "text", text: "Sigo aquí." },
                },
              ],
            },
          ],
        },
      ],
    });

    const page = await open(doc);
    try {
      // Nothing was blanked: the injected `* { display: none }` never became a rule.
      expect(await computed(page, "el-body", "display")).not.toBe("none");
      // And the escaped selector still addresses the element it was written for. `.rb-section h1`
      // paints an h1 `color.primary` (#1D4ED8); ink here means the per-element rule matched through
      // an id full of quotes and braces.
      expect(await computed(page, "el-headline", "color")).toBe("rgb(15, 23, 42)");
      // The id really is the whole hostile string, rather than something the renderer trimmed.
      const carried = await page.evaluate(
        (id) =>
          [...document.querySelectorAll("[data-section]")].filter(
            (el) => el.getAttribute("data-section") === id,
          ).length,
        nasty,
      );
      expect(carried).toBe(1);
    } finally {
      await page.context().close();
    }
  });
});
