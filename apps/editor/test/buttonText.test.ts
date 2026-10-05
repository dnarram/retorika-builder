import { describe, expect, it } from "vitest";
import {
  compactButton,
  dangerButton,
  primaryButton,
  secondaryButton,
} from "../src/questionnaire/ui.tsx";

/**
 * A button's text cannot leave its button, and these are the properties that make that true.
 *
 * **The defect, measured on 5 October 2026 after David reported seeing it.** Five copies of a
 * button style, each with a fixed `height` and **zero horizontal padding**. A `<button>` wraps its
 * text by default, so a label wider than the box grew downwards while the border did not, and the
 * overflow was painted outside it. In the 96px a `Card` had at 320px, real labels spilled 19 to 46
 * pixels past the bottom edge.
 *
 * Asserted on the style objects rather than only in a browser, because two of the screens that
 * carry the longest labels — `/cuenta` and `/mis-webs` — need a session the test suite cannot get.
 * They are protected by *using* these objects, so this is where the guarantee has to live.
 * `e2e/critical-flows.e2e.test.ts` measures the painted text of every reachable button on top.
 */

const ALL = {
  primaryButton,
  secondaryButton,
  dangerButton,
  compactButton,
};

describe("every shared button style", () => {
  it("grows to hold its text rather than fixing a height it can overflow", () => {
    for (const [name, style] of Object.entries(ALL)) {
      expect(style, `${name} has a fixed height, so a wrapped label escapes it`).not.toHaveProperty(
        "height",
      );
      expect(style.minHeight, `${name} has no minHeight`).toBeGreaterThan(0);
    }
  });

  it("keeps real horizontal padding, so text never starts at the border", () => {
    for (const [name, style] of Object.entries(ALL)) {
      const horizontal = Number(String(style.padding).split(" ")[1]?.replace("px", ""));
      expect(horizontal, `${name} has no horizontal padding`).toBeGreaterThanOrEqual(16);
    }
  });

  it("centres on both axes, so one line and three lines both sit right", () => {
    for (const [name, style] of Object.entries(ALL)) {
      expect(style.display, name).toBe("inline-flex");
      expect(style.alignItems, name).toBe("center");
      expect(style.justifyContent, name).toBe("center");
      expect(style.textAlign, name).toBe("center");
    }
  });

  it("gives a wrapped label room to breathe between its lines", () => {
    // `lineHeight: 1` was part of what made two lines look like one line and a mistake.
    for (const [name, style] of Object.entries(ALL)) {
      expect(style.lineHeight, name).toBeGreaterThanOrEqual(1.2);
    }
  });

  it("sizes itself with border-box, so padding cannot push it past its own width", () => {
    for (const [name, style] of Object.entries(ALL)) {
      expect(style.boxSizing, name).toBe("border-box");
    }
  });
});

describe("the screens that have no mockup use the shared styles and not their own", () => {
  it("has no hand-rolled fixed-height button left in the account or auth code", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    function files(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...files(full));
        else if (/\.tsx?$/.test(entry)) out.push(full);
      }
      return out;
    }

    const roots = ["account", "auth"].map((d) => join(import.meta.dirname, "..", "src", d));
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of files(root)) {
        const source = readFileSync(file, "utf8");
        /**
         * A bare numeric `height` inside something that looks like a button.
         *
         * Lower-case `height` only, with a non-letter in front: `minHeight` is the fix and
         * `lineHeight` is unrelated, and the first version of this matched `lineHeight: 1.25`
         * four times and called it a defect. The window matters too — a `height` is only
         * suspicious when it shares a style object with something that makes the element
         * clickable, so 240 characters either side are read rather than the whole file.
         */
        for (const match of source.matchAll(/(?<![A-Za-z])height: (\d+)/g)) {
          const at = match.index ?? 0;
          const around = source.slice(Math.max(0, at - 240), at + 240);
          if (/cursor: "pointer"|textDecoration: "none"/.test(around)) {
            offenders.push(`${file.slice(file.indexOf("apps/editor"))}: height: ${match[1]}`);
          }
        }
      }
    }
    expect(
      offenders,
      "a button with a fixed height is one wrapped label away from painting text outside itself",
    ).toEqual([]);
  });
});
