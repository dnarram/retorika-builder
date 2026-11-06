import type { Page } from "@playwright/test";
import type { RetorikaDocument } from "@retorika/schema";
import { headerWidths, phoneAt, railsAt } from "../src/index.ts";
import { measureOverflow } from "./browser-fixtures.ts";

/**
 * **What a drawn header has to satisfy, measured** (sprint 33 día 2, the menu audit).
 *
 * Each check reads one page in one state and returns the findings as lines — empty is the claim —
 * so a run over a matrix can collect every failing state of a combination before failing, and
 * photograph each one. Written once here, in the renderer's own test directory, because two suites
 * read them: `a11y.browser.test.ts`, which CI runs over the fifty-six header combinations, and the
 * menu audit in `apps/editor/audit`, which runs the full matrix in three engines and against the
 * canvas's own document. The numbers in the names are the plan's ten assertions.
 *
 * Every measure is taken as a visitor would take it: a wheel for a scroll, `elementFromPoint` for
 * «what is under this», `checkVisibility()` for «is this drawn». Nothing here reads the document;
 * what the page should show is derived from `header` once, in `expectHeader`, and compared.
 */

export type Part = "pages" | "sections";
export type State = "rest" | "scrolled" | "menu" | "fold";
export type Target = "html" | "dom";

export interface HeaderExpectation {
  pages: "bar" | "left" | "right";
  sections: "bar" | "row" | "left" | "right" | "fold";
  mobile: "row" | "hidden" | "fold";
  sticky: boolean;
  background: "surface" | "primary" | "secondary" | "ink" | "transparent";
  brandWithPages: boolean;
  /** Two rails on opposite sides, which need 1248 px before the second stands (ADR 0060 §3). */
  twoRails: boolean;
  /** The header's own widths (sprint 34 día 1): the phone layout's widest screen, and the narrowest
   * a rail stands on. Read from the renderer, as the stylesheet reads them. */
  phoneWidth: number | "always";
  railsWidth: number | "none";
}

export function expectHeader(doc: RetorikaDocument): HeaderExpectation {
  const header = doc.header;
  const pages = header?.pages?.position ?? "bar";
  const sections = header?.sections?.position ?? "bar";
  return {
    pages,
    sections,
    mobile: header?.sections?.mobile ?? "row",
    sticky: header?.sticky === true,
    background: header?.look?.background ?? "surface",
    brandWithPages: header?.brandWithPages === true,
    twoRails:
      pages !== "bar" && (sections === "left" || sections === "right") && pages !== sections,
    phoneWidth: headerWidths(doc).phone,
    railsWidth: headerWidths(doc).rails,
  };
}

/** The rails that stand at `width`: the pages' from the header's rail width (1024), the sections'
 * from it too or, when two stand on opposite sides, from 1248 (ADR 0060 §3). */
export function railsStanding(h: HeaderExpectation, width: number): ("left" | "right")[] {
  const out: ("left" | "right")[] = [];
  const stands = railsAt({ rails: h.railsWidth }, width);
  if (h.pages !== "bar" && stands) out.push(h.pages);
  if (
    (h.sections === "left" || h.sections === "right") &&
    (h.twoRails ? stands && width >= 1248 : stands) &&
    !out.includes(h.sections)
  ) {
    out.push(h.sections);
  }
  return out.sort();
}

/** How many copies of each menu a visitor sees at `width` in `state` — one wherever it stands, none
 * while it is folded away (ADR 0060 §3: the copies alternate by `display: none`). */
export function expectedCopies(
  h: HeaderExpectation,
  width: number,
  state: State,
): Record<Part, number> {
  if (phoneAt({ phone: h.phoneWidth }, width)) {
    return {
      pages: state === "menu" ? 1 : 0,
      sections: h.mobile === "row" ? 1 : h.mobile === "fold" && state === "fold" ? 1 : 0,
    };
  }
  return { pages: 1, sections: h.sections === "fold" ? (state === "fold" ? 1 : 0) : 1 };
}

const PART_SELECTOR: Record<Part, string> = {
  pages: 'nav[data-part="pagesLinks"]',
  sections: 'nav[data-part="sectionsLinks"]',
};

/** 1. One visible copy per part, and exactly the number the width and the state call for. */
export async function checkCopies(
  page: Page,
  h: HeaderExpectation,
  width: number,
  state: State,
): Promise<string[]> {
  const seen = await page.evaluate((selectors) => {
    const out: Record<string, number> = {};
    for (const [part, selector] of Object.entries(selectors)) {
      out[part] = [...document.querySelectorAll(selector)].filter((el) =>
        el.checkVisibility(),
      ).length;
    }
    return out;
  }, PART_SELECTOR);
  const want = expectedCopies(h, width, state);
  const out: string[] = [];
  for (const part of ["pages", "sections"] as const) {
    if (seen[part] !== want[part]) {
      out.push(`1 copies: ${part} drawn ${seen[part]} times, expected ${want[part]}`);
    }
  }
  return out;
}

/** 2. Nothing past the right edge, and no sideways scroll of the page. */
export async function checkOverflow(page: Page): Promise<string[]> {
  const { scrollWidth, innerWidth, offender } = await measureOverflow(page);
  const out: string[] = [];
  if (offender)
    out.push(`2 overflow: ${offender.selector} ends at ${offender.right} of ${innerWidth}`);
  if (scrollWidth > innerWidth) out.push(`2 overflow: page scrolls sideways (${scrollWidth})`);
  return out;
}

/**
 * 3a. The phone's bar: at or under 72 px (under 15 % of 568), the bound sprint 30 measured. With the
 * sections' row under it the header is bar and row together, so the bar is what stands above the
 * row — and a fixed bar lets go there (`data-phone-row`, `headerMobileCss`).
 */
export async function checkPhoneBar(page: Page, h: HeaderExpectation): Promise<string[]> {
  const m = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("header.rb-header");
    if (!header) return null;
    const box = header.getBoundingClientRect();
    const row = document.querySelector<HTMLElement>(".rb-nav-row");
    const rowTop = row?.checkVisibility() ? row.getBoundingClientRect().top : null;
    return {
      height: box.height,
      bar: rowTop === null ? box.height : rowTop - box.top,
      phoneRow: header.hasAttribute("data-phone-row"),
      position: getComputedStyle(header).position,
    };
  });
  if (!m) return ["3 phone: no header drawn"];
  const out: string[] = [];
  if (m.bar > 72) out.push(`3 phone: the bar is ${m.bar.toFixed(1)} px tall, over 72`);
  // A bar lets go into the flow, and a transparent one over the cover: never `static`, which takes
  // the sheet's box with it (sprint 33 día 3).
  const letGo = h.background === "transparent" ? "absolute" : "relative";
  if (h.sticky && m.phoneRow && m.position !== letGo) {
    out.push(`3 phone: a fixed bar over the sections' row should let go, is ${m.position}`);
  }
  if (h.sticky && !m.phoneRow && m.position !== "sticky" && h.background !== "transparent") {
    out.push(`3 phone: the bar should be sticky, is ${m.position}`);
  }
  return out;
}

/**
 * 3b. A sheet («Menú», or «Ir a…» on a phone), open: from the bar's foot to the bottom of the
 * screen, edge to edge of the page, `<main>` hidden behind it (ADR 0063), and the page held still
 * under a wheel (ADR 0065) — the wheel and never `scrollTo`, which the lock leaves free.
 */
export async function checkSheet(page: Page, disclosure: string): Promise<string[]> {
  const sheet = `${disclosure} > .rb-nav`;
  const m = await page.evaluate(
    ({ disclosure, sheet }) => {
      const d = document.querySelector<HTMLDetailsElement>(disclosure);
      const panel = document.querySelector<HTMLElement>(sheet);
      const bar = document.querySelector<HTMLElement>("header.rb-header");
      if (!d || !panel || !bar) return null;
      const box = panel.getBoundingClientRect();
      return {
        open: d.open,
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        barBottom: bar.getBoundingClientRect().bottom,
        pageRight: document.body.getBoundingClientRect().right,
        innerHeight: window.innerHeight,
        main: getComputedStyle(document.querySelector("main") as Element).visibility,
        scrollY: Math.round(window.scrollY),
      };
    },
    { disclosure, sheet },
  );
  if (!m) return [`3 sheet: ${disclosure} is not on the page`];
  const out: string[] = [];
  if (!m.open) out.push(`3 sheet: ${disclosure} did not open`);
  if (Math.abs(m.top - m.barBottom) > 1) {
    out.push(`3 sheet: top at ${m.top.toFixed(1)}, the bar's foot at ${m.barBottom.toFixed(1)}`);
  }
  if (m.bottom < m.innerHeight - 1) {
    out.push(`3 sheet: bottom at ${m.bottom.toFixed(1)} of ${m.innerHeight}`);
  }
  // Taller than the screen: its last entries are below the edge, and the page cannot scroll to
  // them (ADR 0065). The canvas hangs the sheet from the stylesheet's estimate of the bar, so a bar
  // taller than the estimate — two lines, or the sections' row — is where this fires.
  if (m.bottom > m.innerHeight + 1) {
    out.push(
      `3 sheet: runs ${(m.bottom - m.innerHeight).toFixed(1)} px below the screen, entries out of reach`,
    );
  }
  if (m.top >= m.innerHeight) out.push(`3 sheet: opened below the screen, at ${m.top.toFixed(1)}`);
  if (Math.abs(m.left) > 0.5 || Math.abs(m.right - m.pageRight) > 0.5) {
    out.push(`3 sheet: spans ${m.left.toFixed(1)}–${m.right.toFixed(1)} of a ${m.pageRight} page`);
  }
  if (m.main !== "hidden") out.push(`3 sheet: <main> is ${m.main} behind it`);
  const from = m.scrollY;
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => Math.round(window.scrollY));
  if (after !== from) out.push(`3 sheet: a wheel moved the page from ${from} to ${after}`);
  return out;
}

/** 4. The rails that stand, and only those; `<main>` keeps their width free; a bar with nothing left
 * is no height where they stand (ADR 0060 §2–5). */
export async function checkRails(
  page: Page,
  h: HeaderExpectation,
  width: number,
): Promise<string[]> {
  const want = railsStanding(h, width);
  const m = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("header.rb-header");
    const main = document.querySelector("main")?.getBoundingClientRect();
    return {
      standing: [...document.querySelectorAll<HTMLElement>(".rb-rail")]
        .filter((rail) => rail.checkVisibility())
        .map((rail) => rail.getAttribute("data-side") ?? "?")
        .sort(),
      mainLeft: main?.left ?? Number.NaN,
      mainRight: main?.right ?? Number.NaN,
      innerWidth: window.innerWidth,
      barNone: header?.getAttribute("data-bar") === "none",
      headerHeight: header?.getBoundingClientRect().height ?? Number.NaN,
    };
  });
  const out: string[] = [];
  if (m.standing.join(",") !== want.join(",")) {
    out.push(`4 rails: standing [${m.standing}], expected [${want}]`);
  }
  const left = want.includes("left") ? 240 : 0;
  const right = m.innerWidth - (want.includes("right") ? 240 : 0);
  if (Math.abs(m.mainLeft - left) > 1 || Math.abs(m.mainRight - right) > 1) {
    out.push(
      `4 rails: <main> spans ${m.mainLeft.toFixed(1)}–${m.mainRight.toFixed(1)}, expected ${left}–${right}`,
    );
  }
  // A collapsed bar is no height once every rail it gave its menus to stands.
  const allStand =
    want.length > 0 &&
    (h.pages === "bar" || want.includes(h.pages)) &&
    (!(h.sections === "left" || h.sections === "right") || want.includes(h.sections));
  if (m.barNone && allStand && m.headerHeight > 0.5) {
    out.push(`4 rails: the collapsed bar is ${m.headerHeight.toFixed(1)} px tall`);
  }
  return out;
}

/**
 * 5. «Ir a…» on a wide screen: under the bar by `space.md` — the bar's height as the stylesheet
 * resolves it (`--rb-header-h`: the script's measure on the published page, the estimate in the
 * canvas, read through a probe that takes the same variable the disclosure does), on the side the
 * standing rails leave free, its open panel inside the window (ADR 0060 §7). Where the resolved
 * height and the bar's real foot disagree, the gap is reported as allowed: it is the named
 * divergence between the targets (backlog), and the sheet's own check says what it costs.
 */
export async function checkFold(
  page: Page,
  h: HeaderExpectation,
  width: number,
  opened: boolean,
): Promise<string[]> {
  const m = await page.evaluate(() => {
    const fold = document.querySelector<HTMLDetailsElement>("details.rb-nav-fold");
    const header = document.querySelector<HTMLElement>("header.rb-header");
    if (!fold || !header) return null;
    const summary = fold.querySelector("summary")?.getBoundingClientRect();
    const panel = fold.querySelector(".rb-nav")?.getBoundingClientRect();
    const md = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--space-md"),
    );
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--rb-header-h)";
    header.appendChild(probe);
    const resolved = probe.getBoundingClientRect().height;
    probe.remove();
    return {
      visible: fold.checkVisibility(),
      top: fold.getBoundingClientRect().top,
      left: fold.getBoundingClientRect().left,
      right: fold.getBoundingClientRect().right,
      barBottom: header.getBoundingClientRect().bottom,
      resolved,
      md,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      summaryVisible: summary ? summary.width > 0 : false,
      panel: panel ? { left: panel.left, right: panel.right, bottom: panel.bottom } : null,
      open: fold.open,
    };
  });
  if (!m) return ["5 fold: «Ir a…» is not on the page"];
  const out: string[] = [];
  if (!m.visible || !m.summaryVisible) return ["5 fold: «Ir a…» is not drawn"];
  const expectedTop = m.resolved + m.md;
  if (Math.abs(m.top - expectedTop) > 1) {
    out.push(
      `5 fold: top at ${m.top.toFixed(1)}, the bar's resolved height plus space.md is ${expectedTop.toFixed(1)}`,
    );
  }
  const gap = Math.abs(m.resolved - m.barBottom);
  if (gap > 1) {
    out.push(
      `5 fold (allowed): hangs ${gap.toFixed(1)} px from the bar's real foot (resolved ${m.resolved.toFixed(1)}, foot ${m.barBottom.toFixed(1)})`,
    );
  }
  const onLeft = railsStanding(h, width).includes("right");
  const side = onLeft ? m.left - m.md : m.innerWidth - m.md - m.right;
  if (Math.abs(side) > 1) {
    out.push(`5 fold: ${side.toFixed(1)} px off the ${onLeft ? "left" : "right"} edge's space.md`);
  }
  if (opened) {
    if (!m.open) out.push("5 fold: did not open");
    if (
      !m.panel ||
      m.panel.left < -0.5 ||
      m.panel.right > m.innerWidth + 0.5 ||
      m.panel.bottom > m.innerHeight + 0.5
    ) {
      out.push(`5 fold: open panel runs out of the window ${JSON.stringify(m.panel)}`);
    }
  }
  return out;
}

/**
 * 6. The current page is marked under every visible copy of its entry: in a strip by the anchored
 * rule or by the entry's own underline — one of the two, never neither (ADR 0063 §2) — and in a rail
 * or a sheet by its edge (ADR 0060, ADR 0063's note of día 4).
 */
export async function checkCurrentPage(page: Page, copies: number): Promise<string[]> {
  const marks = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('a[aria-current="page"]')]
      .filter((a) => a.checkVisibility())
      .map((a) => {
        const nav = a.closest<HTMLElement>("nav.rb-nav");
        const where = a.closest(".rb-rail")
          ? "rail"
          : a.closest("details.rb-nav-narrow")
            ? "sheet"
            : "strip";
        const link = a.getBoundingClientRect();
        const style = getComputedStyle(a);
        const after = nav ? getComputedStyle(nav, "::after") : null;
        const afterBox = after && after.content !== "none" ? after : null;
        return {
          where,
          text: (a.textContent ?? "").trim(),
          underline:
            style.textDecorationLine.includes("underline") &&
            !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(style.textDecorationColor),
          edge: style.boxShadow !== "none" && style.boxShadow.includes("inset"),
          indicator: afterBox
            ? Math.abs(Number.parseFloat(afterBox.width) - link.width) <= 1 &&
              afterBox.display !== "none"
            : false,
        };
      }),
  );
  const out: string[] = [];
  if (marks.length !== copies) {
    out.push(
      `6 current: ${marks.length} visible copies of the current page's entry, expected ${copies}`,
    );
  }
  for (const m of marks) {
    const marked = m.where === "strip" ? m.indicator || m.underline : m.edge;
    if (!marked) out.push(`6 current: «${m.text}» in the ${m.where} is not marked`);
  }
  return out;
}

/**
 * 7. A fixed bar, 600 px down: condensed (`data-scrolled`), glass or opaque by its scheme and never
 * transparent over the text, and the page moved by exactly what it scrolled (ADR 0063 §3, §5). The
 * published page only: `data-scrolled` is the script's. Skipped where the bar is collapsed.
 *
 * **What it scrolled, read, and not the 600 asked for** (sprint 34 día 3): at 1101 × 900, the first
 * width a column stands on for the teaser's words, the page has 599 px to scroll (575 under a
 * transparent bar, out of the flow), and the check read the end of the page as a section that moved
 * 1 and 25 px short — in all three engines, with no shift at all. A section that moves by anything
 * but the scroll is the shift this guards; the scroll is measured, the 600 is only asked.
 */
export async function checkScrolled(page: Page, h: HeaderExpectation): Promise<string[]> {
  const rest = await page.evaluate(() => ({
    bar: document.querySelector("header.rb-header")?.getBoundingClientRect().height ?? 0,
    top: document.querySelector("main > .rb-section")?.getBoundingClientRect().top ?? Number.NaN,
  }));
  // A bar with nothing left (`data-bar="none"`) is no height here: nothing to condense.
  if (rest.bar < 0.5) return [];
  const before = rest.top;
  const from = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  const deadline = Date.now() + 1500;
  let m = await readScrolled(page);
  while (!m.scrolled && Date.now() < deadline) {
    await page.waitForTimeout(50);
    m = await readScrolled(page);
  }
  const out: string[] = [];
  if (!m.scrolled) out.push("7 scrolled: no data-scrolled on the bar after 600 px");
  const glass =
    h.background === "surface" || h.background === "transparent" || h.background === "ink";
  if (m.alpha === 0) out.push("7 scrolled: the bar is transparent over the page");
  if (glass && m.blur) {
    if (m.alpha >= 1) out.push(`7 scrolled: glass on ${h.background} is opaque (${m.background})`);
  } else if (m.alpha < 1) {
    out.push(`7 scrolled: ${h.background} should be opaque, is ${m.background} (blur ${m.blur})`);
  }
  const scrolled = m.scrollY - from;
  if (scrolled < 300) out.push(`7 scrolled: the page scrolled ${scrolled} px of the 600 asked`);
  if (Math.abs(m.top - before + scrolled) > 1 / 64) {
    out.push(
      `7 scrolled: the first section moved ${(m.top - before).toFixed(3)}, the page scrolled ${scrolled}`,
    );
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(100);
  return out;
}

async function readScrolled(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("header.rb-header");
    const style = header ? getComputedStyle(header) : null;
    const background = style?.backgroundColor ?? "";
    const slash = /\/\s*([\d.]+)\s*\)$/.exec(background);
    const rgba = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(background);
    const alpha = slash ? Number(slash[1]) : rgba ? Number(rgba[1]) : 1;
    const filter = style?.backdropFilter ?? "none";
    return {
      scrolled: header?.hasAttribute("data-scrolled") ?? false,
      background,
      alpha,
      blur: filter !== "none" && filter !== "",
      top: document.querySelector("main > .rb-section")?.getBoundingClientRect().top ?? Number.NaN,
      scrollY: window.scrollY,
    };
  });
}

/**
 * 11. **The bar holds the lines of its form, or it is the phone's** (sprint 34 día 2, ADR 0067): with
 * the wide strip drawn, the header is no taller than the stylesheet's own estimate of its lines
 * (`--rb-bar-h`, which counts the form: one line, two when stacked, the row) plus a pixel — a line
 * that wrapped is taller. Reads no width and no estimate of the fold: it judges what is drawn, so the
 * estimate that decides where the bar folds is never the judge of whether it folded in time.
 */
export async function checkHoldsItsLines(page: Page): Promise<string[]> {
  const m = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>("header.rb-header");
    const strip = document.querySelector<HTMLElement>(".rb-nav-wide");
    if (!header) return null;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:var(--rb-bar-h)";
    (document.querySelector("main") ?? document.body).append(probe);
    const estimate = probe.getBoundingClientRect().height;
    probe.remove();
    return {
      stripDrawn: strip !== null && strip.checkVisibility(),
      height: header.getBoundingClientRect().height,
      estimate,
    };
  });
  if (!m) return ["11 lines: no header drawn"];
  if (!m.stripDrawn) return [];
  return m.height > m.estimate + 1
    ? [
        `11 lines: the bar is ${m.height.toFixed(1)} px tall with its strip drawn, over its ${m.estimate.toFixed(1)}: a line wrapped`,
      ]
    : [];
}

/** 8. Nothing covers the brand or the first heading at rest: what is under each one's centre is
 * itself — **and no word of the first section starts above the header's foot** (sprint 33 día 6).
 * The centre alone missed a transparent bar, stacked with its row, lying 30 px over the cover's first
 * words: the heading's centre was clear and its top was not. A header in the flow ends where `<main>`
 * begins, so the second half can only ever find a header laid over the page. */
export async function checkCovers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const header = document.querySelector<HTMLElement>("header.rb-header");
    const foot = header?.getBoundingClientRect();
    const first = document.querySelector("main > .rb-section");
    if (header && foot && foot.height > 0 && first) {
      for (const el of first.querySelectorAll<HTMLElement>("*")) {
        const words = [...el.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
        );
        if (!words || !el.checkVisibility()) continue;
        const box = el.getBoundingClientRect();
        const across = box.left < foot.right && box.right > foot.left;
        if (across && box.top < foot.bottom - 0.5) {
          out.push(
            `8 covers: the header's foot at ${foot.bottom.toFixed(1)} lies over «${(el.textContent ?? "").trim().slice(0, 24)}» at ${box.top.toFixed(1)}`,
          );
          break;
        }
      }
    }
    const probe = (selector: string, name: string) => {
      const el = [...document.querySelectorAll<HTMLElement>(selector)].find((e) =>
        e.checkVisibility(),
      );
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!hit || (hit !== el && !el.contains(hit))) {
        const what = hit
          ? `${hit.tagName.toLowerCase()}${hit.className ? `.${String(hit.className).split(" ")[0]}` : ""}`
          : "nothing";
        out.push(`8 covers: ${what} lies over the ${name}`);
      }
    };
    probe(".rb-brand", "brand");
    probe("main h1", "first heading");
    return out;
  });
}

/** Every element of the header and under it, keyed by its path, with the computed values two
 * targets must agree on (assertion 10). */
export interface Snapshot {
  [path: string]: Record<string, string>;
}

/** A page or a frame: the real editor's canvas is a frame of its page (sprint 33 día 3). */
export async function headerSnapshot(page: Pick<Page, "evaluate">): Promise<Snapshot> {
  return page.evaluate(() => {
    const out: Record<string, Record<string, string>> = {};
    const header = document.querySelector<HTMLElement>("header.rb-header");
    if (!header) return out;
    const walk = (el: Element, path: string) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const r = (n: number) => String(Math.round(n * 2) / 2);
      out[path] = {
        class: el.className,
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        color: style.color,
        "background-color": style.backgroundColor,
        "box-shadow": style.boxShadow,
        x: r(box.left),
        y: r(box.top),
        w: r(box.width),
        h: r(box.height),
        current: el.getAttribute("aria-current") ?? "",
      };
      [...el.children].forEach((child, i) => {
        walk(child, `${path}/${child.tagName.toLowerCase()}[${i}]`);
      });
    };
    walk(header, "header");
    return out;
  });
}

/**
 * 10. The canvas's document against the published page, same engine, same width, at rest: every
 * element of the header the same, **but for the divergences the record names** — the script
 * (ADR 0058 §4: a transparent fixed bar is fixed only with `data-rb-js`; the section in view is
 * marked only where it runs, and the mark is a colour and an edge) and the stylesheet's estimate of
 * the bar's height in place of its measure, which is where «Ir a…» hangs from (backlog). Anything
 * else is a defect: the owner would see one thing while editing and another once published.
 */
export function compareSnapshots(
  canvas: Snapshot,
  published: Snapshot,
  h: HeaderExpectation,
): string[] {
  const out: string[] = [];
  const paths = new Set([...Object.keys(canvas), ...Object.keys(published)]);
  for (const path of [...paths].sort()) {
    const a = canvas[path];
    const b = published[path];
    if (!a || !b) {
      out.push(`10 canvas: ${path} is ${a ? "only in the canvas" : "only in the published page"}`);
      continue;
    }
    const isHeader = path === "header";
    const inDisclosure = path.includes("/details[");
    for (const key of Object.keys(a)) {
      if (key === "class" || key === "current") continue;
      if (a[key] === b[key]) continue;
      // Named: a transparent fixed bar is `fixed` with the script and `absolute` without.
      if (isHeader && key === "position" && h.sticky && h.background === "transparent") continue;
      // Named: the entry of the section in view carries the script's mark — a tint and an edge.
      if (b["current"] === "location" && (key === "background-color" || key === "box-shadow"))
        continue;
      // Named: what hangs from `--rb-header-h` — «Ir a…»'s place, a sheet's height — hangs from the
      // bar's estimate in the canvas and from its measure on the page (backlog). Reported as allowed
      // with the number; what it costs the open sheet, `checkSheet` says in the canvas's own state.
      if (inDisclosure && (key === "y" || key === "h")) {
        const delta = Math.abs(Number(a[key]) - Number(b[key]));
        out.push(
          `10 canvas (allowed): ${path} ${key} differs by ${delta} px (estimate vs measure)`,
        );
        continue;
      }
      out.push(`10 canvas: ${path} ${key}: canvas ${a[key]}, published ${b[key]}`);
    }
  }
  return out;
}

/** Opens every `<details>` of the header, or closes them: the sheets, and «Ir a…». */
export async function setDisclosures(page: Page, selector: string, open: boolean): Promise<void> {
  await page.evaluate(
    ({ selector, open }) => {
      for (const d of document.querySelectorAll<HTMLDetailsElement>(selector)) d.open = open;
    },
    { selector, open },
  );
  await page.waitForTimeout(50);
}
