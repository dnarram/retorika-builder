import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AA_NORMAL_TEXT, contrastRatio } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { CHROME_SCALE, PILL_REST_BORDER } from "../src/editor/chromeScale.ts";

/**
 * The interface's own colours, measured.
 *
 * **Nothing checked this before.** `pnpm test:a11y` runs axe over the *renderer's* output — every
 * preset × variant × palette a client's site can be — and `editor/styleReview.ts` reviews the
 * colours an owner types into their own document. Neither looks at the application's chrome, so
 * the only thing standing behind «#5B6B82 clears 4.5:1» was a comment somebody wrote once.
 *
 * It was not enough. Sprint 1 day 2 found `--ui-muted` shipping at 2.56:1 — the mockups' own
 * value, failing AA — and fixing it in the components still left the failing value declared in
 * this stylesheet for fourteen sprints, because nothing read it and nothing measured it.
 *
 * **The arithmetic is `packages/tokens`', not a second copy.** `contrastRatio` and `AA_NORMAL_TEXT`
 * are the same functions the client-site palettes are proved with, which is the point: one
 * definition of «readable», used for the tool and for what the tool makes.
 *
 * Thresholds are WCAG's own: **4.5:1** for normal text, **3:1** for large text and for anything
 * that is the visible identity of a control or a state (1.4.11). They are not product preferences
 * and are not negotiable downward.
 */

const CSS = readFileSync(join(import.meta.dirname, "..", "src", "app", "globals.css"), "utf8");

/**
 * The stylesheet injected into the preview iframe, which lives as strings inside `Editor.tsx`.
 *
 * **Comments stripped, and that is not tidiness.** The first version of this read the file whole
 * and found `@media (hover: hover)` in the *prose explaining the rule* rather than in the rule,
 * then failed looking for `.rb-pill:hover` 400 characters later. A guard that can be satisfied by
 * a sentence about the code is the same defect `scripts/secrets-scope.ts` was caught by in sprint
 * 15: it passes while the thing it describes is absent.
 */
const CANVAS = readFileSync(
  join(import.meta.dirname, "..", "src", "questionnaire", "Editor.tsx"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");

/** The `--ui-*` colour tokens, read from the stylesheet that actually ships rather than restated
 * here — a table typed into a test is a table that can agree with itself while the app disagrees. */
function token(name: string): string {
  const found = CSS.match(new RegExp(`--ui-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!found?.[1]) throw new Error(`globals.css declares no --ui-${name}`);
  return found[1];
}

const BG = token("bg");
const SURFACE = token("surface");
const INK = token("ink");
const MUTED = token("muted");
const BRAND = token("brand");
const BRAND_SURFACE = token("brand-surface");
const DANGER = token("danger");
const BORDER_STRONG = token("border-strong");

/** WCAG 1.4.11: a boundary or a graphic that carries meaning. */
const UI_COMPONENT = 3;

describe("the chrome's text", () => {
  const readable: [string, string, string][] = [
    ["ink on a panel", INK, SURFACE],
    ["ink on the app background", INK, BG],
    ["muted on a panel", MUTED, SURFACE],
    ["muted on the app background", MUTED, BG],
    ["danger on a panel", DANGER, SURFACE],
  ];

  for (const [what, fg, bg] of readable) {
    it(`${what} clears AA`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }

  /**
   * **The one the chrome was getting wrong, and the reason this file exists.**
   *
   * The brand blue is a 4.71:1 ink on white and only **4.39:1** on the app background — so brand
   * text belongs on a panel, never straight onto the grey. And on its own tinted surface it is
   * **4.14:1**, which is how the selected page tab came to fail AA while looking deliberate.
   *
   * Asserted as the fact it is, rather than as a pass: the number is fixed by two colours ADR 0015
   * owns, so the fix is never to change them — it is to stop pairing them for normal text, which
   * is what the top bar does from day 2 of this work.
   */
  it("brand blue is not a normal-text colour on the tinted surface, which is why nothing uses it that way", () => {
    expect(contrastRatio(BRAND, BRAND_SURFACE)).toBeLessThan(AA_NORMAL_TEXT);
    // It is fine for large text and for a graphic, which is all it is ever used for.
    expect(contrastRatio(BRAND, BRAND_SURFACE)).toBeGreaterThanOrEqual(UI_COMPONENT);
  });

  it("brand blue on a white panel is readable, which is where it is allowed", () => {
    expect(contrastRatio(BRAND, SURFACE)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

/**
 * The chrome drawn inside the preview, which is the half no stylesheet governs.
 *
 * Direction set this floor explicitly after reading the plan for it: «las píldoras no pueden ser
 * casi invisibles en reposo. Deben ser sutiles pero visibles, con al menos 3:1 de contraste contra
 * el fondo (WCAG 1.4.11), y la guarda chromeContrast.test.ts debe comprobarlo.»
 *
 * The plan it refused would have made a control that only exists while a pointer is on it. What
 * measuring first showed is that the state was **already** below the floor before any of this
 * work: `#A9C9F4` on the white the gap paints is 1.70:1, and the rule beside it 1.62:1.
 */
describe("«Añadir sección aquí», at rest", () => {
  it("clears 3:1 against the white the gap paints behind it", () => {
    expect(contrastRatio(PILL_REST_BORDER, CHROME_SCALE.surface)).toBeGreaterThanOrEqual(
      UI_COMPONENT,
    );
  });

  it("is not the tint it used to be, which measured 1.70:1", () => {
    // Pinned as a number rather than a colour name: whatever the resting border becomes, it may
    // not go back under the floor, and this says what «under» was.
    expect(contrastRatio("#A9C9F4", CHROME_SCALE.surface)).toBeLessThan(UI_COMPONENT);
    expect(contrastRatio(PILL_REST_BORDER, CHROME_SCALE.surface)).toBeGreaterThan(
      contrastRatio("#A9C9F4", CHROME_SCALE.surface),
    );
  });

  it("has its emphasis behind `hover: hover`, so a touch screen gets the visible version", () => {
    // The other half of direction's instruction, and it cannot be measured as a ratio: a device
    // with no pointer must never be shown the quieter of two states. The hover rule is therefore
    // inside the query, and the resting rule outside it — which is what this reads.
    const hover = CANVAS.indexOf("@media (hover: hover)");
    expect(hover, "the pill's emphasis is not inside `@media (hover: hover)`").toBeGreaterThan(-1);
    expect(CANVAS.slice(hover, hover + 400)).toContain(".rb-pill:hover");
    // And a keyboard, which has no pointer either, gets the same emphasis.
    expect(CANVAS).toContain(".rb-pill:focus-visible");
  });
});

describe("the chrome's boundaries and states", () => {
  /**
   * `--ui-border` is a hairline between two things and is **not** held to 3:1 — it carries no
   * information, and a 3:1 hairline everywhere would be a heavier interface, not a clearer one.
   * `--ui-border-strong` is the one for when the boundary *is* the information, and it has to
   * clear 3:1 on **both** surfaces, because a token that only works on white is a trap for
   * whoever reaches for it next.
   */
  it("the strong border clears 3:1 on a panel and on the app background", () => {
    expect(contrastRatio(BORDER_STRONG, SURFACE)).toBeGreaterThanOrEqual(UI_COMPONENT);
    expect(contrastRatio(BORDER_STRONG, BG)).toBeGreaterThanOrEqual(UI_COMPONENT);
  });

  it("the brand blue clears 3:1 as a state marker on both surfaces", () => {
    // The rail's indicator, the selected row's border: a graphic that says «this one».
    expect(contrastRatio(BRAND, SURFACE)).toBeGreaterThanOrEqual(UI_COMPONENT);
    expect(contrastRatio(BRAND, BG)).toBeGreaterThanOrEqual(UI_COMPONENT);
  });
});
