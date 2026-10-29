import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { DOCUMENTS_DIR } from "./corpus.ts";

/**
 * **The two menus, by keyboard alone, in the browser that has to be operated.**
 *
 * ADR 0043 publishes the navigation twice — a wide bar and a narrow `<details>` — and alternates
 * them with `display: none`, with **no JavaScript at all**. Three claims come out of that, and not
 * one of them can be made by comparing strings:
 *
 * 1. **Every destination is reachable with Tab**, in the order the page reads in.
 * 2. **The copy the width does not call for is not in the tab order.** This is the one worth a
 *    browser: a hidden copy whose links were still focusable would hand a keyboard visitor a run
 *    of invisible stops before the first word of the site, and it would look perfect in the markup
 *    and in any snapshot. `display: none` is what prevents it — the same property the a11y matrix
 *    leans on for the accessibility tree — so it is checked rather than assumed.
 * 3. **The disclosure opens from the keyboard.** A `<summary>` is a button by nature, but a menu
 *    on a phone that needed a pointer would make the whole narrow layout unusable, and there is no
 *    script here to make up for it.
 *
 * The site under test is the corpus's own `menu-y-paginas`: three pages, two of them pointed at by
 * avances, and one headed section on the home page — so **both** menus are drawn, which is the
 * shape this file exists for.
 *
 * The focus ring is the browser's own: the published stylesheet deliberately sets no `:focus` rule
 * (`build.ts`, «the browser's focus ring stays»). So what is asserted is that nothing we emit has
 * taken it away — `outline-style: auto` is Chromium's ring, and `none` would be the failure.
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

interface Stop {
  tag: string;
  text: string;
  href: string;
  /** Which copy of the menu the stop is in, so a hidden one cannot pass for the visible one.
   * `row` is the sections row under the bar (ADR 0057), which the phone shows instead of folding
   * the sections into the disclosure; `skip` is the link that jumps the whole header. */
  where: "wide" | "narrow" | "row" | "skip" | "elsewhere";
  outline: string;
}

/** Press Tab once and describe whatever now has focus. */
async function tab(page: Page): Promise<Stop> {
  await page.keyboard.press("Tab");
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) {
      return { tag: "", text: "", href: "", where: "elsewhere" as const, outline: "" };
    }
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? "").trim(),
      href: el.getAttribute("href") ?? "",
      where: el.classList.contains("rb-skip")
        ? ("skip" as const)
        : el.closest(".rb-nav-wide")
          ? ("wide" as const)
          : el.closest(".rb-nav-narrow")
            ? ("narrow" as const)
            : el.closest(".rb-nav-row")
              ? ("row" as const)
              : ("elsewhere" as const),
      outline: getComputedStyle(el).outlineStyle,
    };
  });
}

async function open(width: number): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.setContent(render(fixture("menu-y-paginas"), "html").html);
  return page;
}

describe("the two menus, with a keyboard and nothing else", () => {
  it("walks the wide bar in reading order: the skip link, the pages, then this page's sections", async () => {
    const page = await open(1280);
    try {
      // **«Saltar al contenido» is the first Tab on every page that draws a header** (ADR 0057,
      // WCAG 2.4.1): off-screen until it has focus, on screen the moment it does, and Enter lands
      // in `<main>`.
      const skip = await tab(page);
      expect([skip.tag, skip.text, skip.href, skip.where]).toEqual([
        "a",
        "Saltar al contenido",
        "#rb-main",
        "skip",
      ]);
      const onScreen = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight && box.width > 0;
      });
      expect(onScreen, "the skip link is not on screen while focused").toBe(true);

      const first = await tab(page);
      const second = await tab(page);
      const third = await tab(page);

      expect([first, second, third].map((stop) => [stop.text, stop.href])).toEqual([
        ["Qué ponemos", "./que-ponemos.html"],
        ["Dónde estamos", "./donde-estamos.html"],
        ["Contacto", "#sec-contact"],
      ]);
      // The pages first and the sections after, which is the order the bar is drawn in.
      for (const stop of [first, second, third]) {
        expect(stop.where, stop.text).toBe("wide");
        // Nothing we publish has removed the browser's own ring.
        expect(stop.outline, `${stop.text} has no focus ring`).not.toBe("none");
      }
    } finally {
      await page.context().close();
    }
  });

  /**
   * **The narrow copy is not in the tab order on a wide screen**, and the wide one is not on a
   * phone. Checked by walking far enough to leave the menu entirely: every stop up to the first
   * link inside `<main>` has to belong to the copy the width calls for.
   */
  it("keeps the copy the width does not call for out of the tab order", async () => {
    const wide = await open(1280);
    try {
      const stops: Stop[] = [];
      for (let i = 0; i < 7; i += 1) stops.push(await tab(wide));
      expect(stops.filter((stop) => stop.where === "narrow")).toEqual([]);
      // The phone's row of sections is not in the tab order on a wide screen either.
      expect(stops.filter((stop) => stop.where === "row")).toEqual([]);
      // And the summary of the hidden disclosure is never one of the stops.
      expect(stops.map((stop) => stop.text)).not.toContain("Menú");
    } finally {
      await wide.context().close();
    }

    const phone = await open(390);
    try {
      const stops: Stop[] = [];
      for (let i = 0; i < 5; i += 1) stops.push(await tab(phone));
      expect(stops.filter((stop) => stop.where === "wide")).toEqual([]);
    } finally {
      await phone.context().close();
    }
  });

  it("opens the phone's disclosure with Enter and walks the same destinations", async () => {
    const page = await open(390);
    try {
      expect((await tab(page)).where).toBe("skip");
      const summary = await tab(page);
      expect(summary.tag).toBe("summary");
      expect(summary.text).toBe("Menú");
      expect(summary.outline, "the summary has no focus ring").not.toBe("none");
      expect(await page.evaluate(() => document.querySelector("details")?.open ?? false)).toBe(
        false,
      );

      await page.keyboard.press("Enter");
      expect(await page.evaluate(() => document.querySelector("details")?.open ?? false)).toBe(
        true,
      );

      const first = await tab(page);
      const second = await tab(page);
      const third = await tab(page);
      expect([first, second, third].map((stop) => [stop.text, stop.href])).toEqual([
        ["Qué ponemos", "./que-ponemos.html"],
        ["Dónde estamos", "./donde-estamos.html"],
        ["Contacto", "#sec-contact"],
      ]);
      // The pages inside the disclosure; the section in the row under the bar (ADR 0057).
      expect([first.where, second.where, third.where]).toEqual(["narrow", "narrow", "row"]);
    } finally {
      await page.context().close();
    }
  });

  /**
   * **A curated site offers only what is left, and nothing hidden waits in the tab order.** The
   * `menu-curado` fixture has one destination: a sections strip that is absent rather than empty,
   * and a pages strip of one link (ADR 0043 §5).
   */
  it("walks a curated site's single destination, with nothing else to find", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      await page.setContent(render(fixture("menu-curado"), "html").html);
      expect((await tab(page)).where).toBe("skip");
      const first = await tab(page);
      expect([first.text, first.href, first.where]).toEqual([
        "Qué ponemos",
        "./que-ponemos.html",
        "wide",
      ]);
      // The next stop is already out of the menu: there is no second entry and no empty strip.
      expect((await tab(page)).where).toBe("elsewhere");
    } finally {
      await context.close();
    }
  });
});
