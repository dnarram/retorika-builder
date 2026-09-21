import AxeBuilder from "@axe-core/playwright";
import { type Browser, chromium } from "@playwright/test";
import type { NodeResult, Result } from "axe-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allCombinations, closeCombination, openCombination } from "./browser-fixtures.ts";

/**
 * axe over the published HTML of every combination (protocol Part 8.5).
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

describe("axe", () => {
  const combinations = allCombinations();

  // A plain loop rather than it.each: it.each truncates interpolated values at about forty
  // characters, which made different combinations share a test name.
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
});
