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

/**
 * **An exact letter larger than the theme's heading comes down to the heading on a phone**
 * (ADR 0083, sprint 41 día 1a). The size tokens are flat rem, `styleDeclarations` writes an exact
 * length as it is, and the shared block under 720 px never touches `font-size` — so before this a
 * 96 px headline was 96 px on a 390 phone too. Measured on `letra-exacta-grande`, whose theme's
 * heading is 40 px: one exact letter above it on the cover, one on a card, one equal to it and one
 * below it.
 */
describe("an exact letter on a phone (ADR 0083)", () => {
  /** The headline's box, and whether any of its words was broken across two lines. */
  function headline(page: Page) {
    return page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-id="el-headline"]');
      if (!el) throw new Error("no headline");
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      const range = document.createRange();
      const node = el.firstChild;
      if (!node) throw new Error("an empty headline");
      // Each word's own client rects: a word drawn on two lines has two.
      const broken = [...(node.textContent ?? "").matchAll(/\S+/g)].filter((match) => {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        return range.getClientRects().length > 1;
      }).length;
      return {
        height: el.getBoundingClientRect().height,
        lines: Math.round(el.getBoundingClientRect().height / lineHeight),
        broken,
      };
    });
  }

  it("comes down to the heading at 390, above it and only above it", async () => {
    const page = await open(fixture("letra-exacta-grande"), 390);
    try {
      const measured = await headline(page);
      // The record, before and after, read off this line rather than reasoned about.
      console.info(`letra-exacta-grande at 390: ${JSON.stringify(measured)}`);
      expect(await computed(page, "el-headline", "font-size")).toBe("40px");
      expect(await computed(page, "el-card-1-title", "font-size")).toBe("40px");
      // Equal to the heading is not above it, and below it is the owner's to keep.
      expect(await computed(page, "el-services-headline", "font-size")).toBe("40px");
      expect(await computed(page, "el-body", "font-size")).toBe("28px");
      // What the cap is for: no word of «Reformamos tu casa» broken in two on a phone.
      expect(measured.broken).toBe(0);
    } finally {
      await page.context().close();
    }
  });

  it("keeps every exact letter as it was written above 720 px", async () => {
    const page = await open(fixture("letra-exacta-grande"), 1280);
    try {
      expect(await computed(page, "el-headline", "font-size")).toBe("96px");
      expect(await computed(page, "el-card-1-title", "font-size")).toBe("56px");
      expect(await computed(page, "el-services-headline", "font-size")).toBe("40px");
      expect(await computed(page, "el-body", "font-size")).toBe("28px");
    } finally {
      await page.context().close();
    }
  });
});

/**
 * **A photograph's shape and its point, as the browser draws them** (ADR 0084, sprint 41 día 4). The
 * claims are about specificity and geometry: the shape outranks the catalog's 4:3, the crop is a
 * crop and not a squash, the point is the one stored, and a phone draws the shape at its limit.
 */
describe("a photograph's shape and its point (ADR 0084)", () => {
  /** The photograph's box and the three properties that decide what it shows. */
  function photo(page: Page, elementId: string) {
    return page.evaluate((id) => {
      const el = document.querySelector<HTMLImageElement>(`[data-id="${id}"]`);
      if (!el) throw new Error(`no photograph ${id}`);
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        ratio: box.width / box.height,
        fit: style.objectFit,
        position: style.objectPosition,
      };
    }, elementId);
  }

  it("keeps the shape given by hand over the catalog's, crops it, and keeps its point", async () => {
    const page = await open(fixture("foto-con-forma"), 1280);
    try {
      const cover = await photo(page, "el-image");
      // 4:1, where `.rb-cover img` alone would draw 4:3.
      expect(cover.ratio).toBeCloseTo(4, 1);
      expect(cover.fit).toBe("cover");
      expect(cover.position).toBe("30% 70%");
      // A card's photograph keeps the team's square and takes its own point.
      const member = await photo(page, "el-member-1-photo");
      expect(member.ratio).toBeCloseTo(1, 1);
      expect(member.position).toBe("50% 20%");
      // And a photograph with no point is still centred.
      expect((await photo(page, "el-member-2-photo")).position).toBe("50% 50%");
    } finally {
      await page.context().close();
    }
  });

  it("outranks the catalog's (0,2,1) crop of a cover whose photograph is its background", async () => {
    // `.rb-cover.rb-image-background img` asks for 3:2 at (0,2,1): a selector of two attributes,
    // (0,2,0), would lose to it and the shape would be silently ignored. The third attribute is
    // what this case is for — the image-right cover above is outranked by two.
    const raw = JSON.parse(JSON.stringify(fixture("foto-con-forma"))) as RetorikaDocument;
    const cover = raw.pages[0]?.sections[0];
    if (!cover) throw new Error("no cover");
    cover.preset = { ...cover.preset, variantId: "image-background" };
    const page = await open(parseDocument(raw), 1280);
    try {
      expect((await photo(page, "el-image")).ratio).toBeCloseTo(4, 1);
    } finally {
      await page.context().close();
    }
  });

  it("draws a shape wider than 3:1 at 3:1 on a phone", async () => {
    const page = await open(fixture("foto-con-forma"), 390);
    try {
      const cover = await photo(page, "el-image");
      expect(cover.ratio).toBeCloseTo(3, 1);
      expect(cover.position).toBe("30% 70%");
    } finally {
      await page.context().close();
    }
  });
});
