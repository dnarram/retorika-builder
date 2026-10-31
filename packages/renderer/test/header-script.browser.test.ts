import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HEADER_SCRIPT } from "../src/headerScript.ts";
import { render } from "../src/index.ts";
import { DOCUMENTS_DIR } from "./corpus.ts";

/**
 * **The header's script, in the browser it runs in** (ADR 0058) — and the page without it, because
 * the script is progressive and every claim about it has a twin: what works with it, and what still
 * works when it is gone.
 *
 * The site under test is the corpus's `cabecera-con-marca`: three pages, a brand, a button, and a
 * sections row on the home page, drawn tall enough to scroll by giving the sections room.
 */

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

/** `cabecera-con-marca` with the header the test asks for, its sections shown as the bar's own. */
function withHeader(header: RetorikaDocument["header"]): RetorikaDocument {
  const doc = fixture("cabecera-con-marca");
  return parseDocument({ ...doc, header: { ...doc.header, ...header } });
}

/** Every section a screen tall, so there is somewhere to scroll to and one section in view at a time. */
const TALL = "<style>.rb-section{min-height:100vh}</style>";

async function open(
  doc: RetorikaDocument,
  width: number,
  options: { script?: boolean } = {},
): Promise<Page> {
  let html = render(doc, "html").html.replace("</head>", `${TALL}</head>`);
  if (options.script === false) html = html.replace(`<script>${HEADER_SCRIPT}</script>`, "");
  const context = await browser.newContext({ viewport: { width, height: 700 } });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "load" });
  return page;
}

/** The sections marked as in view — by destination, since the wide bar and the phone's row each
 * carry a copy of the entry and the script marks both. */
const current = (page: Page) =>
  page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('.rb-nav a[aria-current="location"]')].map(
        (a) => a.getAttribute("href") ?? "",
      ),
    ),
  ]);

describe("the script's mark and measure", () => {
  it("marks <html> and writes the bar's real height, and the page without it keeps the estimate", async () => {
    const page = await open(withHeader({}), 1280);
    try {
      const marked = await page.evaluate(() => ({
        js: document.documentElement.hasAttribute("data-rb-js"),
        h: document.documentElement.style.getPropertyValue("--rb-header-h"),
        offset: document.querySelector<HTMLElement>(".rb-header")?.offsetHeight,
      }));
      expect(marked.js).toBe(true);
      expect(marked.h).toBe(`${marked.offset}px`);
    } finally {
      await page.context().close();
    }
    const bare = await open(withHeader({}), 1280, { script: false });
    try {
      const estimate = await bare.evaluate(() => ({
        js: document.documentElement.hasAttribute("data-rb-js"),
        inline: document.documentElement.style.getPropertyValue("--rb-header-h"),
        computed: getComputedStyle(document.documentElement)
          .getPropertyValue("--rb-header-h")
          .trim(),
      }));
      expect(estimate.js).toBe(false);
      expect(estimate.inline).toBe("");
      expect(estimate.computed).toContain("calc(");
    } finally {
      await bare.context().close();
    }
  });
});

describe("the measure follows the bar", () => {
  /**
   * **Found by the sprint 30 día 6 walk, in the ZIP opened from disk**: the script measured the bar
   * once, when it ran, and the site's own letter arrived after — the bar grew from 66 to 69 px, the
   * variable stayed at 66, and an anchor landed 3 px under a fixed bar. A bar grows after the script
   * for reasons nothing in the page announces with a `resize`: a font swapping in, a logo decoding.
   */
  it("writes the new height when the bar grows after the script has run", async () => {
    const page = await open(withHeader({ sticky: true }), 1280);
    try {
      const grown = await page.evaluate(async () => {
        const bar = document.querySelector<HTMLElement>(".rb-header");
        if (!bar) throw new Error("no bar");
        const before = bar.offsetHeight;
        // Padding, so only the border box grows: the observer's default content box would not see
        // it (sabotaged: without `box: 'border-box'` this reads the old height).
        bar.style.paddingTop = `${before}px`;
        // A ResizeObserver delivers with a later rendering update, not synchronously. Up to two
        // seconds, by timers. **Green file by file even when the script watched the content box**:
        // there the first delivery could land after this change and read the new height by luck;
        // the full suite, slower, caught it, and is where the sabotage was run.
        const variable = () => document.documentElement.style.getPropertyValue("--rb-header-h");
        for (let wait = 0; wait < 40 && variable() !== `${bar.offsetHeight}px`; wait += 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return {
          grew: bar.offsetHeight > before,
          h: document.documentElement.style.getPropertyValue("--rb-header-h"),
          offset: bar.offsetHeight,
        };
      });
      expect(grown.grew).toBe(true);
      expect(grown.h).toBe(`${grown.offset}px`);
    } finally {
      await page.context().close();
    }
  });
});

describe("the phone's menu", () => {
  it("closes on Escape and gives the focus back to «Menú», and closes on a press outside", async () => {
    const page = await open(withHeader({}), 390);
    try {
      const summary = page.locator("details.rb-nav-narrow > summary");
      await summary.click();
      expect(await page.evaluate(() => document.querySelector("details")?.open)).toBe(true);
      await page.keyboard.press("Escape");
      expect(await page.evaluate(() => document.querySelector("details")?.open)).toBe(false);
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("SUMMARY");

      await summary.click();
      expect(await page.evaluate(() => document.querySelector("details")?.open)).toBe(true);
      await page.mouse.click(195, 600);
      expect(await page.evaluate(() => document.querySelector("details")?.open)).toBe(false);
    } finally {
      await page.context().close();
    }
  });

  it("still opens and closes by itself when the script is gone", async () => {
    const page = await open(withHeader({}), 390, { script: false });
    try {
      await page.locator("details.rb-nav-narrow > summary").click();
      expect(await page.evaluate(() => document.querySelector("details")?.open)).toBe(true);
      await page.keyboard.press("Escape");
      // Escape is the script's; without it the disclosure stays open, and the summary closes it.
      expect(await page.evaluate(() => document.querySelector("details")?.open)).toBe(true);
      await page.locator("details.rb-nav-narrow > summary").click();
      expect(await page.evaluate(() => document.querySelector("details")?.open)).toBe(false);
    } finally {
      await page.context().close();
    }
  });
});

describe("the section in view", () => {
  it('carries aria-current="location" on its entry, and the entry moves as the page scrolls', async () => {
    // The sections share the bar here, so the wide `<nav Secciones>` is the one marked.
    const page = await open(
      withHeader({ sections: { position: "bar", shown: true }, action: undefined }),
      1280,
    );
    try {
      const anchors = await page.evaluate(() =>
        [...document.querySelectorAll('.rb-nav-wide .rb-nav[aria-label="Secciones"] a')].map(
          (a) => a.getAttribute("href") ?? "",
        ),
      );
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      const [first, second] = anchors as [string, string];

      await page.evaluate((id) => document.querySelector(id)?.scrollIntoView(), first);
      await expect.poll(() => current(page)).toEqual([first]);

      await page.evaluate((id) => document.querySelector(id)?.scrollIntoView(), second);
      await expect.poll(() => current(page)).toEqual([second]);
      // The page's own entry is a different token, and the sections' never borrow it.
      expect(
        await page.evaluate(() => document.querySelectorAll('[aria-current="page"]').length),
      ).toBe(0);
    } finally {
      await page.context().close();
    }
  });
});

describe("a fixed bar", () => {
  it("gains data-scrolled once the page has scrolled, and loses it at the top", async () => {
    const page = await open(withHeader({ sticky: true, sections: { mobile: "hidden" } }), 1280);
    try {
      const scrolled = () =>
        page.evaluate(() => document.querySelector(".rb-header")?.hasAttribute("data-scrolled"));
      expect(await scrolled()).toBe(false);
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect.poll(scrolled).toBe(true);
      const position = await page.evaluate(() => ({
        top: document.querySelector(".rb-header")?.getBoundingClientRect().top,
        shadow: getComputedStyle(document.querySelector(".rb-header") as Element).boxShadow,
      }));
      expect(position.top).toBe(0);
      expect(position.shadow).not.toBe("none");
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(scrolled).toBe(false);
    } finally {
      await page.context().close();
    }
  });

  it("lands an anchor under the bar, not behind it", async () => {
    const page = await open(
      withHeader({ sticky: true, sections: { mobile: "hidden", shown: true }, action: undefined }),
      1280,
    );
    try {
      const href = await page.evaluate(
        () =>
          document.querySelector('.rb-nav[aria-label="Secciones"] a')?.getAttribute("href") ?? "",
      );
      await page.locator(`.rb-nav-wide .rb-nav[aria-label="Secciones"] a[href="${href}"]`).click();
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const bar = document.querySelector(".rb-header") as HTMLElement;
            const target = document.querySelector(id) as HTMLElement;
            return Math.round(target.getBoundingClientRect().top - bar.offsetHeight);
          }, href),
        )
        .toBeGreaterThanOrEqual(-1);
    } finally {
      await page.context().close();
    }
  });
});

describe("transparent and fixed", () => {
  const transparentFixed = () =>
    withHeader({
      sticky: true,
      look: { background: "transparent" },
      sections: { mobile: "hidden" },
    });

  it("is fixed with the script, and turns to surface once the page has scrolled", async () => {
    const page = await open(transparentFixed(), 1280);
    try {
      const read = () =>
        page.evaluate(() => {
          const bar = document.querySelector(".rb-header") as HTMLElement;
          const style = getComputedStyle(bar);
          return { position: style.position, background: style.backgroundColor };
        });
      const atTop = await read();
      expect(atTop.position).toBe("fixed");
      expect(atTop.background).toBe("rgba(0, 0, 0, 0)");
      // The cover made room: its first line sits below the bar.
      const room = await page.evaluate(() => {
        const bar = document.querySelector(".rb-header") as HTMLElement;
        const first = document.querySelector("main > .rb-section") as HTMLElement;
        return Number.parseFloat(getComputedStyle(first).paddingTop) - bar.offsetHeight;
      });
      expect(room).toBeGreaterThan(0);

      await page.evaluate(() => window.scrollTo(0, 400));
      await expect.poll(async () => (await read()).background).not.toBe("rgba(0, 0, 0, 0)");
      expect((await read()).position).toBe("fixed");
    } finally {
      await page.context().close();
    }
  });

  it("is not fixed without the script: it stays over the cover and scrolls away with it", async () => {
    const page = await open(transparentFixed(), 1280, { script: false });
    try {
      expect(
        await page.evaluate(
          () => getComputedStyle(document.querySelector(".rb-header") as Element).position,
        ),
      ).toBe("absolute");
      await page.evaluate(() => window.scrollTo(0, 800));
      const top = await page.evaluate(
        () => document.querySelector(".rb-header")?.getBoundingClientRect().top ?? 0,
      );
      expect(top).toBeLessThan(0);
    } finally {
      await page.context().close();
    }
  });
});
