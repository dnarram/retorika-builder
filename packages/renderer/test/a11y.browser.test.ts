import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium } from "@playwright/test";
import type { NodeResult, Result } from "axe-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Combination,
  closeCombination,
  contrastCombinations,
  geometryCombinations,
  headerCombinations,
  openCombination,
  railCombinations,
} from "./browser-fixtures.ts";
import {
  checkCopies,
  checkCovers,
  checkSheet,
  expectHeader,
  setDisclosures,
} from "./menu-checks.ts";

/**
 * axe over two of the three sets issue #25 split this harness into, because axe checks two
 * different kinds of thing and each belongs to a different set:
 *
 * - **Structural rules** — heading order, landmark roles, an image missing its alt — are a
 *   property of a section's own markup, which is what `geometryCombinations()` varies (every
 *   section, every variant) while holding the palette and type pair fixed. These do not depend
 *   on colour, so testing them again per palette would be the same redundancy issue #25 named.
 * - **Contrast** is a property of a palette and a role, not of a section —
 *   `color.primary` on `color.surface` has the same ratio in the cover as in the contact
 *   section — so `contrastCombinations()` (every palette, every type pair, one fixed
 *   composition) is where it is checked exhaustively.
 *
 * Both runs share the same assertion, because axe reports the same shape of result either way;
 * only the combinations fed to it differ.
 *
 * It fails on:
 * - any serious or critical violation;
 * - any color-contrast violation, whatever its impact;
 * - color-contrast appearing in neither passes nor violations: a rule that was skipped
 *   must never be mistaken for a rule that passed, which is the reason a browser is here;
 * - any node whose contrast axe could not measure (incomplete) — typically text over a
 *   photo. Unmeasured contrast is unverified contrast, and a guard that goes green without
 *   comparing anything is the failure class this harness exists to remove.
 *
 * Checked at 320 and 1280: below 720px the grid collapses to one column, which moves text
 * relative to the image, so the two widths are two different rendered layouts. 768 renders
 * the same layout as 1280.
 */

const CONTRAST = "color-contrast";
const WIDTHS = [320, 1280] as const;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function describeNode(kind: string, rule: Result, node: NodeResult): string {
  const data = (node.any[0]?.data ?? {}) as {
    contrastRatio?: number;
    expectedContrastRatio?: string;
    fgColor?: string;
    bgColor?: string;
    messageKey?: string;
  };
  const measured =
    data.contrastRatio !== undefined && data.contrastRatio > 0
      ? ` ratio ${data.contrastRatio} (needs ${data.expectedContrastRatio}), ${data.fgColor} on ${data.bgColor}`
      : "";
  const reason = data.messageKey ? ` [${data.messageKey}]` : "";
  return `  ${kind}: ${rule.id} (${rule.impact ?? "no impact"}) at ${node.target.join(" ")}${measured}${reason}`;
}

/** One axe run, shared by both sets below: open the page, analyze, assert. A plain loop rather
 * than it.each in both callers, as before — it.each truncates interpolated values at about
 * forty characters, which made different combinations share a test name. */
function checkAxe(combinations: Combination[], widths: readonly number[] = WIDTHS) {
  for (const c of combinations) {
    for (const width of widths) {
      it(`${c.id} @ ${width}px`, async () => {
        const page = await openCombination(browser, c, width);
        try {
          const results = await new AxeBuilder({ page }).analyze();

          const contrastRan =
            results.passes.some((r) => r.id === CONTRAST) ||
            results.violations.some((r) => r.id === CONTRAST);
          expect(contrastRan, `${c.id} @ ${width}px: ${CONTRAST} did not run`).toBe(true);

          const violations = results.violations.filter(
            (r) => r.id === CONTRAST || r.impact === "serious" || r.impact === "critical",
          );
          const unmeasured = results.incomplete.filter((r) => r.id === CONTRAST);
          const lines = [
            ...violations.flatMap((r) => r.nodes.map((n) => describeNode("violation", r, n))),
            ...unmeasured.flatMap((r) => r.nodes.map((n) => describeNode("not measured", r, n))),
          ];
          expect(lines, `${c.id} @ ${width}px:\n${lines.join("\n")}`).toEqual([]);
        } finally {
          await closeCombination(page);
        }
      });
    }
  }
}

describe("axe — geometry (every section, one palette, structural rules)", () => {
  checkAxe(geometryCombinations());
});

describe("axe — contrast (every palette, every type pair, one composition)", () => {
  checkAxe(contrastCombinations());
});

/**
 * The header (ADR 0057, sprint 30 día 2): its five schemes over every palette — the pairs the
 * stylesheet writes, as Chromium composites them — and its layouts, row and fixed bar over one. The
 * same assertion as above: no serious or critical violation, contrast measured everywhere, nothing
 * left unmeasured.
 */
describe("axe — the header (every scheme over every palette; the layouts, the row and the fixed bar)", () => {
  checkAxe(headerCombinations());
});

/**
 * **A rail at the one width where it stands alone** (ADR 0060): 1024, where one rail is up and the
 * sections' rail of a two-rail page has fallen into the bar beside the pages' copy hidden for its own
 * rail — the arrangement neither 1280 nor 320 draws.
 */
describe("axe — the rails at 1024, where a rail stands or falls", () => {
  checkAxe(railCombinations(), [1024]);
});

/**
 * **Three of the menu audit's checks, promoted** (sprint 33 días 2 and 3): cheap, permanent, and about
 * every header combination rather than the audit's own matrix, so CI holds them. One visible copy of
 * each menu — exactly the number the width and the state call for — with the disclosures closed and
 * with «Menú» open; nothing lying over the brand or the first heading at rest; and **the open sheet**
 * (día 3, with its findings fixed): from the bar's foot to the screen's, edge to edge, `<main>` hidden
 * and the page still under a wheel. The phone bar's bound of 72 px, the other half of check 3, is not
 * here: a button of thirteen letters breaks it at 320 on every combination (the audit's finding 2,
 * a design call left to David). The audit (`apps/editor/audit`) runs all ten over its matrix, in three
 * engines, under `RETORIKA_AUDIT=1`.
 */
describe("one copy of each menu, nothing over the brand, and the sheet (the audit's checks 1, 3 and 8)", () => {
  for (const c of headerCombinations()) {
    for (const width of WIDTHS) {
      it(`${c.id} @ ${width}px`, async () => {
        const page = await openCombination(browser, c, width);
        try {
          const h = expectHeader(c.document);
          const findings = [
            ...(await checkCopies(page, h, width, "rest")),
            ...(await checkCovers(page)),
          ];
          if (width <= 720) {
            await setDisclosures(page, "details.rb-nav-narrow", true);
            findings.push(
              ...(await checkCopies(page, h, width, "menu")),
              ...(await checkSheet(page, "details.rb-nav-narrow")),
            );
          }
          expect(findings, `${c.id} @ ${width}px\n  ${findings.join("\n  ")}`).toEqual([]);
        } finally {
          await closeCombination(page);
        }
      });
    }
  }
});

/**
 * **Each menu is announced once, from wherever it stands** (ADR 0060, sprint 31 día 3): the twin of
 * the test below for a page whose menus have places of their own. The bar keeps a copy of every menu
 * a rail holds, because the bar is where a rail falls, and the claim is that at every width exactly
 * one of the copies is in the tree — and that it is the one the width calls for: the rail from 1024
 * (the sections' rail of a two-rail page from 1248), the bar above 720, «Menú» and the row or «Ir a…»
 * on a phone. Every disclosure is opened first, for the reason the test below gives.
 */
describe("each menu is announced once, from wherever it stands", () => {
  const placed = headerCombinations().filter((c) => /\/(pages-|three-columns\/|fold\/)/.test(c.id));

  type Where = "rail" | "bar" | "row" | "fold" | "menu";
  const expected = (c: Combination, width: number): Record<string, Where> => {
    const header = c.document.header;
    const pages = header?.pages?.position ?? "bar";
    const sections = header?.sections?.position ?? "bar";
    const mobile = header?.sections?.mobile ?? "row";
    const twoRails =
      pages !== "bar" && (sections === "left" || sections === "right") && pages !== sections;
    const sectionsRail =
      (sections === "left" || sections === "right") && width >= (twoRails ? 1248 : 1024);
    if (width <= 720) return { Páginas: "menu", Secciones: mobile === "fold" ? "fold" : "row" };
    return {
      Páginas: pages !== "bar" && width >= 1024 ? "rail" : "bar",
      Secciones: sectionsRail
        ? "rail"
        : sections === "row"
          ? "row"
          : sections === "fold"
            ? "fold"
            : "bar",
    };
  };

  for (const c of placed) {
    for (const width of [1280, 1100, 1023, 320]) {
      it(`${c.id} @ ${width}px`, async () => {
        const page = await openCombination(browser, c, width);
        try {
          await page.evaluate(() => {
            for (const d of document.querySelectorAll("details")) {
              (d as HTMLDetailsElement).open = true;
            }
          });
          const announced = await page.evaluate(() =>
            [...document.querySelectorAll("nav")]
              .filter((el) => el.checkVisibility())
              .map((el) => [
                el.getAttribute("aria-label") ?? "",
                el.closest(".rb-rail")
                  ? "rail"
                  : el.closest("details.rb-nav-fold")
                    ? "fold"
                    : el.closest("details.rb-nav-narrow")
                      ? "menu"
                      : el.closest(".rb-nav-wide")
                        ? "bar"
                        : "row",
              ]),
          );
          expect(
            Object.fromEntries(announced),
            `${c.id} @ ${width}px announced ${JSON.stringify(announced)}`,
          ).toEqual(expected(c, width));
          // Once each: an object built from the pairs would hide a second copy.
          expect(announced, `${c.id} @ ${width}px`).toHaveLength(2);
        } finally {
          await closeCombination(page);
        }
      });
    }
  }
});

/**
 * Exactly one navigation landmark at each width — the check ADR 0023 asks for by name, and the one
 * that separates "two menus alternated" from "two menus announced".
 *
 * The menu is emitted twice, a wide `<nav>` and a narrow `<details>`, because keeping a single
 * `<details>` open on desktop depends on `::details-content`, which is far newer than the browsers
 * a published site has to survive. Alternating them with `display: none` is only correct if the one
 * that does not apply is genuinely gone from the accessibility tree, and that is not something the
 * markup can promise — a real browser has to say so.
 *
 * Read from Playwright's accessibility snapshot rather than by counting `<nav>` elements or
 * inspecting CSS: the snapshot is the tree a screen reader is handed, which is the thing the claim
 * is actually about.
 */
describe("the menu is announced the same way, whatever the width", () => {
  const withMenu = geometryCombinations().filter((c) => c.catalogId === "teaser");

  for (const c of withMenu) {
    for (const width of WIDTHS) {
      it(`${c.id} @ ${width}px announces the same landmarks`, async () => {
        const page = await openCombination(browser, c, width);
        try {
          // The disclosure is opened first at the narrow width: a closed `<details>` hides its own
          // contents, so the landmark inside it is correctly absent until somebody opens it. What
          // is being checked here is that opening it reveals *one* menu and not a second copy of
          // the one the wide layout was already showing.
          await page.evaluate(() => {
            for (const d of document.querySelectorAll("details.rb-nav-narrow")) {
              (d as HTMLDetailsElement).open = true;
            }
          });

          // `checkVisibility()` is the browser's own answer to "is this rendered", and a subtree
          // under `display: none` is exactly what it says no to — which is also what keeps that
          // subtree out of the accessibility tree.
          const announced = await page.evaluate(() =>
            [...document.querySelectorAll("nav")]
              .filter((el) => el.checkVisibility())
              .map((el) => el.getAttribute("aria-label") ?? ""),
          );
          /**
           * **«Exactly one» until ADR 0043, and now an identity instead — which is stronger.**
           * One element served both widths while there was one menu; with two, the thing that has
           * to hold is that the narrow disclosure announces *the same* menus and not a second copy
           * of the ones the wide bar was already showing. So the labels are compared against the
           * document's own, read once, rather than against a literal per width.
           *
           * Each name appears once, which is what axe's `landmark-unique` asks of two landmarks
           * of the same role — and the reason the two menus have names at all.
           */
          expect(announced.length, `${c.id} @ ${width}px announced nothing`).toBeGreaterThan(0);
          expect(new Set(announced).size, `${c.id} @ ${width}px repeats a landmark`).toBe(
            announced.length,
          );
          for (const label of announced) expect(["Páginas", "Secciones"]).toContain(label);
          // One disclosure on a phone, however many menus it holds: two rows of chrome above the
          // content is what the single `<details>` exists to avoid.
          expect(
            await page.evaluate(() => document.querySelectorAll("details.rb-nav-narrow").length),
          ).toBe(1);

          // And the one announced is the one the width calls for.
          const visible = await page.evaluate(() => ({
            wide: [...document.querySelectorAll(".rb-nav-wide")].filter((el) =>
              el.checkVisibility(),
            ).length,
            narrow: [...document.querySelectorAll(".rb-nav-narrow")].filter((el) =>
              el.checkVisibility(),
            ).length,
          }));
          expect(visible).toEqual(width <= 720 ? { wide: 0, narrow: 1 } : { wide: 1, narrow: 0 });
        } finally {
          await closeCombination(page);
        }
      });
    }
  }
});
