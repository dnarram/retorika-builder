import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHROME_SCALE } from "../src/editor/chromeScale.ts";

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
const CHROME = [
  "editor/EditorShell.tsx",
  "editor/panelKit.tsx",
  "questionnaire/StylePanel.tsx",
  "questionnaire/PagesPanel.tsx",
  "questionnaire/PhotosPanel.tsx",
  "questionnaire/CollectionsPanel.tsx",
  "questionnaire/DesignPanel.tsx",
  "questionnaire/SharePanel.tsx",
].map((f) => readFileSync(join(EDITOR, f), "utf8"));

/**
 * **A ratchet, not an amnesty.** Every hand-typed radius still in the chrome, named, so a new one
 * cannot be added quietly — the list is matched exactly, so an addition fails just as a removal
 * does. It shrinks as the surfaces are converted and this test is what forces that to be noticed.
 *
 * | value | what wears it | when it goes |
 * |---|---|---|
 * | ~~`rounded-[9px]` ×3~~ | ~~page tabs, «Guardar en mi cuenta», «Descargar»~~ | **gone, day 2** |
 * | ~~`rounded-[11px]`, `rounded-[9px]`, `rounded-[7px]`, `rounded-[6px]`~~ | ~~the six panels~~ | **gone, day 3** |
 * | `rounded-[9px]` ×1, `rounded-[6px]` ×2 | **the device toggle** | **never** |
 *
 * `CHROME` grew on day 3 from one file to eight, which is what turned those four panel radii up —
 * they had been sitting outside the guard's reach the whole time it was passing.
 *
 * The device toggle is the only entry left and it is permanent, not a lapse: direction excluded it
 * from this work by name — «el cliente dijo que le encanta cómo transiciona de vista pc a vista
 * móvil» — so its shape stays exactly as it is, and the list says so rather than leaving the next
 * reader to wonder whether it was forgotten.
 */
const OFF_SCALE_RADII = [
  "rounded-[9px]", // DeviceToggle track — excluded by direction, permanent
  "rounded-[6px]", // DeviceToggle, desktop button — idem
  "rounded-[6px]", // DeviceToggle, mobile button — idem
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
  it("declares its curves and its durations", () => {
    // `--ui-ease` answers a press; `--ui-ease-shape` carries a surface changing shape, and is
    // symmetric so the travel is watchable rather than over before the eye arrives.
    expect(DECLARATIONS).toMatch(/--ui-ease:\s*cubic-bezier\(/);
    expect(DECLARATIONS).toMatch(/--ui-ease-shape:\s*cubic-bezier\(/);
    expect(DECLARATIONS).toMatch(/--ui-fast:\s*\d+ms/);
    expect(DECLARATIONS).toMatch(/--ui-base:\s*\d+ms/);
    expect(DECLARATIONS).toMatch(/--ui-slow:\s*\d+ms/);
  });

  /**
   * **Every duration token, not a named two — which is the hole this had.**
   *
   * The pattern used to read `--ui-(?:fast|base)`, so it checked the durations that existed when
   * it was written and would have waved through any that arrived later. `--ui-slow` arrived with
   * the canvas's reflow and was exactly that case.
   *
   * The ceiling is 400ms and it is about a person rather than a test now: the panel guard used to
   * wait a fixed 350ms for the canvas to settle, which made a duration raised past it flaky rather
   * than failing; that guard polls until the width stops moving instead. What is left is the rule
   * that a chrome transition nobody asked to watch must not outstay its welcome.
   */
  it("keeps every duration a transition anybody has to wait through under 400ms", () => {
    const durations = [...DECLARATIONS.matchAll(/--ui-[\w-]*?(?:fast|base|slow):\s*(\d+)ms/g)].map(
      (m) => Number(m[1]),
    );
    expect(durations.length, "no duration tokens matched — the pattern has drifted").toBe(3);
    for (const ms of durations) expect(ms).toBeLessThanOrEqual(400);
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

describe("the canvas's copy of the scale", () => {
  /**
   * The chrome inside the preview iframe cannot read `globals.css` — it is a different document,
   * styled by a string `Editor.tsx` injects. So `chromeScale.ts` transcribes the scale for it, and
   * this is what stops the transcription drifting from the original.
   *
   * The same arrangement `overflowCheck.ts` has with the renderer's breakpoint. A copied value
   * with nothing holding the copy to its source is a value that will be wrong one day with every
   * test still green — which is exactly how the canvas ended up with 13px, 11px, 9px and 7px
   * corners while the application's own side had settled on four.
   */
  const pairs: [keyof typeof CHROME_SCALE, string][] = [
    ["bg", "--ui-bg"],
    ["surface", "--ui-surface"],
    ["border", "--ui-border"],
    ["borderStrong", "--ui-border-strong"],
    ["ink", "--ui-ink"],
    ["muted", "--ui-muted"],
    ["brand", "--ui-brand"],
    ["brandSurface", "--ui-brand-surface"],
    ["danger", "--ui-danger"],
    ["radiusSm", "--ui-radius-sm"],
    ["radius", "--ui-radius"],
    ["radiusLg", "--ui-radius-lg"],
    ["radiusXl", "--ui-radius-xl"],
    ["shadow1", "--ui-shadow-1"],
    ["shadow2", "--ui-shadow-2"],
    ["shadow3", "--ui-shadow-3"],
    ["ease", "--ui-ease"],
    ["easeShape", "--ui-ease-shape"],
    ["fast", "--ui-fast"],
    ["base", "--ui-base"],
  ];

  for (const [key, custom] of pairs) {
    it(`${key} says what ${custom} says`, () => {
      const found = DECLARATIONS.match(new RegExp(`${custom}:\\s*([^;]+);`));
      expect(found?.[1], `globals.css declares no ${custom}`).toBeDefined();
      expect(CHROME_SCALE[key]).toBe((found?.[1] ?? "").trim());
    });
  }

  /**
   * Tokens the canvas deliberately does not carry, each named rather than silently absent.
   *
   * A list is only worth having if an addition has to argue with it: a token that reached the
   * stylesheet and not the canvas would otherwise be indistinguishable from one nobody noticed.
   */
  const EDITOR_ONLY = [
    // The save tick in the top bar. The preview has no equivalent state to mark.
    "ok",
    // The canvas's own reflow is animated by `globals.css` on the card that *holds* the iframe,
    // from the editor's document, and nothing inside the preview runs for that long.
    //
    // `ease-shape` was excused here beside it, on the grounds that nothing inside the preview
    // animated at all. That stopped being true on 7 October 2026: the «Diseñada a mano» bar moved
    // into the flow and arrives the way the rail's items do, with the same curve. So it is carried
    // now, and the exception it used to have is gone rather than left to go stale.
    "slow",
  ];

  it("transcribes every token the stylesheet declares, apart from the ones named here", () => {
    const declared = [...DECLARATIONS.matchAll(/--ui-([\w-]+):/g)].flatMap((m) => m[1] ?? []);
    const expected = declared.filter((name) => !EDITOR_ONLY.includes(name));
    expect(expected.length).toBe(pairs.length);
    // And the exceptions have to be real: a stale name here would quietly widen the hole.
    for (const name of EDITOR_ONLY) {
      expect(declared, `${name} is excused but not declared`).toContain(name);
    }
  });
});
