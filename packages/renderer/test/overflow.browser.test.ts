import { type Browser, chromium, type Page } from "@playwright/test";
import { TYPE_PAIRS } from "@retorika/tokens";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Combination,
  closeCombination,
  contrastCombinations,
  geometryCombinations,
  longTextCombinations,
  openCombination,
} from "./browser-fixtures.ts";

/**
 * Horizontal overflow at 320, 768 and 1280 pixels (protocol Part 8.5), over
 * `geometryCombinations()` — every section, every variant, one palette and one type pair, since
 * overflow is a property of a geometry and a typeface rather than of a colour (issue #25).
 *
 * The long-text case gets its own set, `longTextCombinations()`, checked separately below with
 * `measureTextFit`: it is the one place type pairs still vary, because a wider face is exactly
 * what pushes a word past its box.
 *
 * 320 is the width the advanced dossier §4 promises the pre-publish check covers, so it is not
 * negotiable downward: an overflow there is a real section breaking on a real phone.
 */

const WIDTHS = [320, 768, 1280] as const;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

interface Overflow {
  scrollWidth: number;
  innerWidth: number;
  /** The first element whose box passes the right edge, or null. */
  offender: { selector: string; right: number } | null;
}

async function measureOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      for (const name of ["data-slot", "data-section", "data-page"]) {
        const value = el.getAttribute(name);
        if (value !== null) return `${tag}[${name}="${value}"]`;
      }
      const cls = el.getAttribute("class");
      return cls ? `${tag}.${cls.split(/\s+/).join(".")}` : tag;
    };
    const innerWidth = window.innerWidth;
    let offender: { selector: string; right: number } | null = null;
    for (const el of document.querySelectorAll("body *")) {
      const right = el.getBoundingClientRect().right;
      // Half a pixel of tolerance for sub-pixel rounding, never more.
      if (right > innerWidth + 0.5) {
        offender = { selector: describe(el), right: Math.round(right * 10) / 10 };
        break;
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, offender };
  });
}

interface TextOverflow {
  selector: string;
  text: string;
  scrollWidth: number;
  clientWidth: number;
}

/**
 * Every heading and paragraph of the combination's own catalog section that does not fit its
 * own box, found by the `data-preset` the page under test actually carries rather than by a
 * hardcoded "services".
 *
 * That used to be hardcoded, and it was a real gap: a long-text combination for `testimonials`
 * or `footer` puts a `[data-preset="services"]` selector against a page that has no services
 * section at all, so it always matched zero nodes and the assertion always passed without
 * measuring anything — silently skipping the two sections whose own comments call out long text
 * as the risk ("a quote is the one field whose length the owner does not choose from a list",
 * "the inline composition gives [the address] seven columns to overflow out of"). Addressing it
 * by the combination's own `catalogId` is what makes the check see the section it is for.
 *
 * The viewport check alone misses the risk the long-text case exists for: at 768, "Qué hago"
 * composition B's title column is about 210px, and a word wider than that overflows into the
 * cards' column without ever reaching the viewport's edge (docs/tasks/catalog-que-hago.md,
 * step 9).
 */
async function measureTextFit(page: Page, catalogId: string): Promise<TextOverflow[]> {
  return page.evaluate((preset) => {
    const out: TextOverflow[] = [];
    const nodes = document.querySelectorAll(
      `[data-preset="${preset}"] :is(h1, h2, h3, h4, h5, h6, p)`,
    );
    for (const el of nodes) {
      // Half a pixel of tolerance for sub-pixel rounding, as in measureOverflow.
      if (el.scrollWidth > el.clientWidth + 0.5) {
        out.push({
          selector: `${el.tagName.toLowerCase()}[data-slot="${el.getAttribute("data-slot")}"]`,
          text: (el.textContent ?? "").trim(),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    }
    return out;
  }, catalogId);
}

describe("overflow — geometry (every section, one palette, one type pair)", () => {
  const combinations = geometryCombinations();

  // A plain loop rather than it.each: it.each truncates interpolated values at about forty
  // characters, which made different combinations share a test name.
  for (const c of combinations) {
    for (const width of WIDTHS) {
      it(`${c.id} @ ${width}px`, async () => {
        const page = await openCombination(browser, c, width);
        try {
          const { scrollWidth, innerWidth, offender } = await measureOverflow(page);
          const where = `${c.id} @ ${width}px`;
          expect(
            offender,
            `${where}: ${offender?.selector} ends at ${offender?.right}px, past the ${innerWidth}px viewport`,
          ).toBeNull();
          expect(
            scrollWidth,
            `${where}: page scrolls horizontally (${scrollWidth}px)`,
          ).toBeLessThanOrEqual(innerWidth);
        } finally {
          await closeCombination(page);
        }
      });
    }
  }
});

describe("overflow — long text (every composition that declares it, every type pair)", () => {
  const combinations = longTextCombinations();

  for (const c of combinations) {
    for (const width of WIDTHS) {
      it(`${c.id} @ ${width}px`, async () => {
        const page = await openCombination(browser, c, width);
        try {
          const { scrollWidth, innerWidth, offender } = await measureOverflow(page);
          const where = `${c.id} @ ${width}px`;
          expect(
            offender,
            `${where}: ${offender?.selector} ends at ${offender?.right}px, past the ${innerWidth}px viewport`,
          ).toBeNull();
          expect(
            scrollWidth,
            `${where}: page scrolls horizontally (${scrollWidth}px)`,
          ).toBeLessThanOrEqual(innerWidth);

          const unfit = await measureTextFit(page, c.catalogId);
          const lines = unfit.map(
            (u) =>
              `  ${u.selector} "${u.text}": content ${u.scrollWidth}px in a ${u.clientWidth}px box`,
          );
          expect(lines, `${where}: text wider than its own box\n${lines.join("\n")}`).toEqual([]);
        } finally {
          await closeCombination(page);
        }
      });
    }
  }

  /**
   * The type pairs are CSS font stacks, not bundled fonts, so what Chromium actually draws
   * depends on the machine. This prints it, so an overflow result can be read against the
   * font that produced it — and so two pairs quietly collapsing onto the same fallback show up.
   *
   * Drawn from `contrastCombinations()` rather than this describe's own `combinations`: that set
   * is the one that already varies every type pair against a single fixed composition
   * (`cover/image-right`), which is exactly what "one combination per type pair" needs.
   */
  it("reports the font Chromium actually renders for each type pair", async () => {
    const report: string[] = [];
    const withEveryTypePair = contrastCombinations();
    for (const typePair of TYPE_PAIRS) {
      const c = withEveryTypePair.find(
        (x: Combination) => x.typePairId === typePair.id && x.variantId === "image-right",
      );
      if (!c) throw new Error(`no combination for type pair ${typePair.id}`);
      const page = await openCombination(browser, c, 1280);
      try {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const fontsOf = async (selector: string): Promise<string> => {
          const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
          const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
          expect(fonts.length, `${typePair.id}: no font resolved for ${selector}`).toBeGreaterThan(
            0,
          );
          return fonts.map((f) => f.familyName).join(" + ");
        };
        const heading = await fontsOf('[data-slot="headline"]');
        const body = await fontsOf('[data-slot="body"]');
        report.push(`  ${typePair.id.padEnd(16)} heading: ${heading.padEnd(20)} body: ${body}`);
      } finally {
        await closeCombination(page);
      }
    }
    console.log(`Fonts Chromium renders (${process.platform}):\n${report.join("\n")}`);
  });
});
