import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium } from "@playwright/test";
import type { NodeResult, Result } from "axe-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Combination,
  closeCombination,
  contrastCombinations,
  geometryCombinations,
  openCombination,
} from "./browser-fixtures.ts";

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
function checkAxe(combinations: Combination[]) {
  for (const c of combinations) {
    for (const width of WIDTHS) {
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
describe("the menu is announced once, whatever the width", () => {
  const withMenu = geometryCombinations().filter((c) => c.catalogId === "teaser");

  for (const c of withMenu) {
    for (const width of WIDTHS) {
      it(`${c.id} @ ${width}px has one navigation landmark`, async () => {
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
          expect(announced, `${c.id} @ ${width}px announced ${announced.length}`).toEqual([
            "Secciones",
          ]);

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
