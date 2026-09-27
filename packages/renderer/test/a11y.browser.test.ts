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
