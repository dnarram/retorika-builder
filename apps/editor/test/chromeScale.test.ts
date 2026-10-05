import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The chrome has a scale, and it is the only one.
 *
 * **What this guards against is not ugliness, it is drift.** Nobody ever decided the editor should
 * use thirteen corner radii; it arrived one component at a time, each picking a number that looked
 * right on its own screen — 6, 7, 8, 9, 10, 11, 12, 13, 14, 16 and `full`, seven of them inside a
 * nine-pixel span. Six shadows arrived the same way, each individually tuned, none related to
 * another. That is what «años 2000» turned out to mean when it was measured.
 *
 * So the test is not «is this pretty». It is: the scale is declared in one place, and the chrome
 * reaches for it instead of inventing a new value. The second half is what stops the thirteen from
 * growing back one sprint at a time.
 *
 * Asserted on the stylesheet and the source text, the way `test/scrollbar.test.ts` is: these are
 * facts about what ships, and the browser cannot be asked whether a number was *chosen* or merely
 * typed.
 */

const EDITOR = join(import.meta.dirname, "..", "src");
const CSS = readFileSync(join(EDITOR, "app", "globals.css"), "utf8");
const DECLARATIONS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** The chrome, and only the chrome. `questionnaire/ui.tsx` is a transcription of approved mockups
 * with its own inline styles and is not part of this scale — ADR 0015's shell carve-out is about
 * the editor's own furniture, not the five questions. */
const CHROME = ["editor/EditorShell.tsx"].map((f) => readFileSync(join(EDITOR, f), "utf8"));

/**
 * **A ratchet, not an amnesty.** Every hand-typed radius still in the chrome, named, so a new one
 * cannot be added quietly — the list is matched exactly, so an addition fails just as a removal
 * does. It shrinks as the surfaces are converted and this test is what forces that to be noticed.
 *
 * | value | what wears it | when it goes |
 * |---|---|---|
 * | `rounded-[9px]` ×1 | the page tabs | day 2, the top bar |
 * | `rounded-[9px]` ×2 | «Guardar en mi cuenta», «Descargar» | day 2, the top bar |
 * | `rounded-[9px]` ×1, `rounded-[6px]` ×2 | **the device toggle** | **never** |
 *
 * The device toggle is permanent and is not a lapse: direction excluded it from this work by name
 * — «el cliente dijo que le encanta cómo transiciona de vista pc a vista móvil» — so its shape
 * stays exactly as it is, and the list says so rather than leaving the next reader to wonder.
 */
const OFF_SCALE_RADII = [
  "rounded-[9px]", // DeviceToggle track — excluded by direction, permanent
  "rounded-[6px]", // DeviceToggle, desktop button — idem
  "rounded-[6px]", // DeviceToggle, mobile button — idem
  "rounded-[9px]", // page tabs — day 2
  "rounded-[9px]", // «Guardar en mi cuenta» — day 2
  "rounded-[9px]", // «Descargar» — day 2
] as const;

describe("the shape scale", () => {
  it("declares four radii and no more", () => {
    const declared = [...DECLARATIONS.matchAll(/--ui-radius(?:-\w+)?:\s*(\d+)px/g)].map((m) =>
      Number(m[1]),
    );
    expect(new Set(declared), "the four radii of the scale").toEqual(new Set([8, 12, 16, 20]));
  });

  it("keeps the control radius inside the 11–14 ADR 0015 wrote down", () => {
    const control = DECLARATIONS.match(/--ui-radius:\s*(\d+)px/);
    const value = Number(control?.[1]);
    // «radius 20 for dialogs, 11–14 for controls» — ADR 0015's own table, which the chrome used to
    // contradict in both directions. The scale is not invented here; it is finally obeyed.
    expect(value).toBeGreaterThanOrEqual(11);
    expect(value).toBeLessThanOrEqual(14);
  });

  it("the chrome asks for radii by name, apart from the holdouts named below", () => {
    const found = CHROME.flatMap((source) => source.match(/rounded-\[\d+px\]/g) ?? []);
    expect(found.sort()).toEqual([...OFF_SCALE_RADII].sort());
  });
});

describe("the depth scale", () => {
  it("declares three levels, each of two layers", () => {
    for (const level of [1, 2, 3]) {
      const found = DECLARATIONS.match(new RegExp(`--ui-shadow-${level}:\\s*([^;]+);`));
      expect(found?.[1], `--ui-shadow-${level} is not declared`).toBeDefined();
      // Two offsets separated by a comma: a contact shadow and an ambient one. A single blur is
      // the thing that reads as 2005, and the one-layer version is what was here before.
      expect((found?.[1] ?? "").split("),").length, `--ui-shadow-${level} is a single layer`).toBe(
        2,
      );
    }
  });

  it("the chrome asks for depth by name, with nothing left off the scale", () => {
    const found = CHROME.flatMap((source) => source.match(/shadow-\[[^\]]+\]/g) ?? []);
    expect(found).toEqual([]);
  });
});

describe("motion", () => {
  it("declares one curve and two durations", () => {
    expect(DECLARATIONS).toMatch(/--ui-ease:\s*cubic-bezier\(/);
    expect(DECLARATIONS).toMatch(/--ui-fast:\s*\d+ms/);
    expect(DECLARATIONS).toMatch(/--ui-base:\s*\d+ms/);
  });

  /**
   * **200ms is a test's constraint, not a taste.** The panel guard in
   * `e2e/critical-flows.e2e.test.ts` waits 350ms for the canvas to settle before measuring it. A
   * duration raised past that would not fail honestly — it would make that guard flaky, which is
   * the worst way for a limit to be discovered.
   */
  it("keeps every duration under the 350ms the panel guard waits", () => {
    const durations = [...DECLARATIONS.matchAll(/--ui-(?:fast|base):\s*(\d+)ms/g)].map((m) =>
      Number(m[1]),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const ms of durations) expect(ms).toBeLessThanOrEqual(200);
  });

  /**
   * Adding movement without this would be fixing one accessibility problem by creating another.
   * Nothing in this repository read the preference before the chrome had anything worth
   * suppressing, so there is no older rule to lean on — which is exactly why it needs a guard.
   */
  it("honours prefers-reduced-motion, which nothing in this repository did before", () => {
    expect(DECLARATIONS).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const block = DECLARATIONS.slice(DECLARATIONS.indexOf("prefers-reduced-motion"));
    expect(block, "the override has to beat utilities and inline styles").toContain("!important");
    expect(block).toContain("transition-duration");
    expect(block).toContain("animation-duration");
  });
});

describe("focus", () => {
  /**
   * `apps/editor` had **no** `:focus-visible` rule anywhere, so a keyboard user got whatever the
   * browser drew by default — which on the rail's transparent buttons is close to nothing.
   */
  it("draws a visible ring, once, for everything focusable", () => {
    expect(DECLARATIONS).toMatch(/:focus-visible\s*\{/);
    expect(DECLARATIONS).toMatch(/outline:\s*2px solid var\(--ui-brand\)/);
  });

  /**
   * **In `@layer base`, and this is the half that was wrong first.** Unlayered CSS beats every
   * layered rule whatever its specificity, and Tailwind's utilities are all layered — so an
   * unlayered version of this ring could not be overridden anywhere, and the rail drew one ring
   * around its icon and a second straight across the whole 80px button underneath it.
   */
  it("sits in a layer, so a component can move the ring where it belongs", () => {
    const ring = DECLARATIONS.indexOf(":focus-visible");
    const layer = DECLARATIONS.lastIndexOf("@layer base", ring);
    expect(layer, "the focus ring is not inside @layer base").toBeGreaterThan(-1);
    // and the layer must not have closed before the rule
    expect(DECLARATIONS.slice(layer, ring)).not.toMatch(/\n\}/);
  });
});
