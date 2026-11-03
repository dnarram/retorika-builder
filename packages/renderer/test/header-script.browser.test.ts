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
  // Reduced motion (sprint 32 día 0): these measure the script, and a bar that condenses over 200 ms
  // would be read mid-way — the padding test below grew the bar and read it before it had moved.
  const context = await browser.newContext({
    viewport: { width, height: 700 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: "load" });
  return page;
}

/** A press on the bar's own padding, outside every disclosure in it. */
async function pressOnTheBar(page: Page): Promise<void> {
  const box = await page.locator("header.rb-header").boundingBox();
  if (!box) throw new Error("no bar");
  await page.mouse.click(box.x + 2, box.y + 2);
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
      // On the bar, beside the brand: on a phone the open sheet covers the rest of the screen
      // (sprint 32 día 4), so the bar is the one place outside it.
      await pressOnTheBar(page);
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

/**
 * **«Ir a…» and the rail** (ADR 0060, sprint 31 día 3): what the script does for the two places the
 * bar did not have — the disclosure closes the three ways a visitor expects, and the mark of the
 * section in view moves in a column as it does in the bar.
 */
describe("«Ir a…»", () => {
  const FOLD = { sections: { position: "fold" as const, mobile: "fold" as const, shown: true } };
  const isOpen = (page: Page) =>
    page.evaluate(() => document.querySelector<HTMLDetailsElement>("details.rb-nav-fold")?.open);

  for (const width of [1280, 390]) {
    it(`closes on Escape with the focus back on «Ir a…», and on a press outside, at ${width}px`, async () => {
      const page = await open(withHeader({ ...FOLD, action: undefined }), width);
      try {
        const summary = page.locator("details.rb-nav-fold > summary");
        await summary.click();
        expect(await isOpen(page)).toBe(true);
        await page.keyboard.press("Escape");
        expect(await isOpen(page)).toBe(false);
        expect(
          await page.evaluate(() => document.activeElement?.closest("details")?.className ?? ""),
        ).toBe("rb-nav-fold");
        await summary.click();
        expect(await isOpen(page)).toBe(true);
        // Outside it: on a phone its sheet covers the screen under the bar (sprint 32 día 4), so the
        // press goes on the bar; on a wide screen the page is outside it, as before.
        if (width <= 720) await pressOnTheBar(page);
        else await page.mouse.click(width / 2, 600);
        expect(await isOpen(page)).toBe(false);
      } finally {
        await page.context().close();
      }
    });

    it(`closes when an entry is chosen, and the page still goes there, at ${width}px`, async () => {
      const page = await open(withHeader({ ...FOLD, action: undefined }), width);
      try {
        await page.locator("details.rb-nav-fold > summary").click();
        const entry = page.locator('details.rb-nav-fold a[href="#sec-contact"]');
        await entry.click();
        expect(await isOpen(page)).toBe(false);
        // Nothing fixed above it, so the section lands at the top of the window.
        await expect
          .poll(() =>
            page.evaluate(() =>
              Math.round(document.querySelector("#sec-contact")?.getBoundingClientRect().top ?? 99),
            ),
          )
          .toBe(0);
      } finally {
        await page.context().close();
      }
    });
  }
});

/**
 * **One disclosure open at a time** (sprint 31 día 6). On a phone «Ir a…» and «Menú» share the bar,
 * and their panels hang from it in the same place: two open would lay one over the other. Nothing
 * was added for it — the press that opens one is a press outside the other, which the script already
 * closes; a `<summary>` opened with Enter or Space is pressed too, as a click. Measured here, so the
 * day that stops being true is the day this goes red.
 */
describe("«Ir a…» and «Menú» on a phone", () => {
  const BOTH = { sections: { position: "fold" as const, mobile: "fold" as const, shown: true } };
  const openOf = (page: Page) =>
    page.evaluate(() => ({
      fold: document.querySelector<HTMLDetailsElement>("details.rb-nav-fold")?.open ?? null,
      menu: document.querySelector<HTMLDetailsElement>("details.rb-nav-narrow")?.open ?? null,
    }));

  it("closes the one that was open when the other opens, by pointer and by keyboard", async () => {
    const page = await open(withHeader({ ...BOTH, action: undefined }), 390);
    try {
      await page.locator("details.rb-nav-fold > summary").click();
      expect(await openOf(page)).toEqual({ fold: true, menu: false });
      await page.locator("details.rb-nav-narrow > summary").click();
      expect(await openOf(page)).toEqual({ fold: false, menu: true });

      await page.locator("details.rb-nav-fold > summary").focus();
      await page.keyboard.press("Enter");
      expect(await openOf(page)).toEqual({ fold: true, menu: false });
      await page.locator("details.rb-nav-narrow > summary").focus();
      await page.keyboard.press(" ");
      expect(await openOf(page)).toEqual({ fold: false, menu: true });
    } finally {
      await page.context().close();
    }
  });

  it("gives the focus back to the summary of the one Escape closed", async () => {
    const page = await open(withHeader({ ...BOTH, action: undefined }), 390);
    try {
      for (const which of ["rb-nav-fold", "rb-nav-narrow"] as const) {
        await page.locator(`details.${which} > summary`).focus();
        await page.keyboard.press("Enter");
        // Into the panel, as a keyboard visitor does, and out with Escape.
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(() => document.activeElement?.closest("details")?.className),
        ).toBe(which);
        await page.keyboard.press("Escape");
        expect(await openOf(page)).toEqual({ fold: false, menu: false });
        expect(
          await page.evaluate(() => {
            const el = document.activeElement;
            return el?.tagName === "SUMMARY" ? el.parentElement?.className : el?.tagName;
          }),
        ).toBe(which);
      }
    } finally {
      await page.context().close();
    }
  });
});

describe("the rail", () => {
  it('carries aria-current="location" on the entry in the column, and marks it by its edge', async () => {
    const page = await open(
      withHeader({ sections: { position: "right", shown: true }, action: undefined }),
      1280,
    );
    try {
      const anchors = await page.evaluate(() =>
        [...document.querySelectorAll('.rb-rail .rb-nav[aria-label="Secciones"] a')].map(
          (a) => a.getAttribute("href") ?? "",
        ),
      );
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      const [, second] = anchors as [string, string];
      await page.evaluate((id) => document.querySelector(id)?.scrollIntoView(), second);
      await expect.poll(() => current(page)).toEqual([second]);
      // Once the fade is done, the mark is the bar at the entry's edge in the entry's own colour,
      // and the rule under it is gone.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      const look = await page.evaluate((id) => {
        const a = document.querySelector<HTMLElement>(`.rb-rail a[href="${id}"]`);
        if (!a) throw new Error("no rail entry");
        const style = getComputedStyle(a);
        return { shadow: style.boxShadow, line: style.textDecorationColor, color: style.color };
      }, second);
      expect(look.shadow).toContain(look.color);
      expect(look.shadow).toContain("inset");
      expect(look.line).toBe("rgba(0, 0, 0, 0)");
    } finally {
      await page.context().close();
    }
  });

  /**
   * **David's condition (c)**: with every menu in a rail and nothing fixed above the page, no anchor
   * lands under a ghost. The bar is fixed here on purpose — the owner's «se queda arriba» — and has
   * collapsed, so what sticks is nothing at all, and the measure says so.
   */
  it("lands an anchor at the top of the window when the bar has collapsed into the rail", async () => {
    const page = await open(
      withHeader({
        sticky: true,
        pages: { position: "left", shown: true },
        sections: { position: "left", shown: true, mobile: "row" },
        brandWithPages: true,
      }),
      1280,
    );
    try {
      expect(
        await page.evaluate(() => document.documentElement.style.getPropertyValue("--rb-header-h")),
      ).toBe("0px");
      const href = await page.evaluate(
        () =>
          document
            .querySelector('.rb-rail .rb-nav[aria-label="Secciones"] a')
            ?.getAttribute("href") ?? "",
      );
      await page.locator(`.rb-rail a[href="${href}"]`).click();
      await expect
        .poll(() =>
          page.evaluate(
            (id) => Math.round(document.querySelector(id)?.getBoundingClientRect().top ?? 99),
            href,
          ),
        )
        .toBe(0);
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
