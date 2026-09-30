import { TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE_ID, SCALES } from "../src/index.ts";

/**
 * «El sistema» — the eleven sizes, spaces and radii the dossier §6 calls «Escala tipográfica,
 * espaciados, radios y sombras **como sistema**», and which until sprint 9 had exactly one setting.
 *
 * Two of these tests are load-bearing for something outside this file:
 *
 * - **The order test is what lets the browser suite skip "compact".**
 *   `packages/renderer/test/browser-fixtures.ts` measures overflow for "generous" and argues that
 *   "compact" cannot overflow where the default does not, because every one of its values is
 *   smaller. That argument is only sound while it is true, so it is asserted here rather than
 *   written in a comment there.
 * - **The default's eleven values are pinned literally.** Every document ever generated carries
 *   them and the whole golden corpus renders with them, so a change is a change to two hundred
 *   published pages. Pinning them means such a change arrives as a red test and a deliberate edit,
 *   never as a side effect of tuning the other two.
 */

/** px, or rem converted at the 16px root the published page never overrides. */
function pixels(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(value);
  if (!match?.[1] || !match[2]) throw new Error(`not a px or rem length: "${value}"`);
  return Number(match[1]) * (match[2] === "rem" ? 16 : 1);
}

describe("the scales", () => {
  it("declare every size, space and radius key of the namespace, and no others", () => {
    const expected = {
      sizes: TOKEN_KEYS.filter((k) => k.startsWith("size.")),
      spaces: TOKEN_KEYS.filter((k) => k.startsWith("space.")),
      radii: TOKEN_KEYS.filter((k) => k.startsWith("radius.")),
    };
    for (const scale of SCALES) {
      expect(Object.keys(scale.sizes).sort(), scale.id).toEqual([...expected.sizes].sort());
      expect(Object.keys(scale.spaces).sort(), scale.id).toEqual([...expected.spaces].sort());
      expect(Object.keys(scale.radii).sort(), scale.id).toEqual([...expected.radii].sort());
    }
  });

  it("has three, named by id, with the default among them", () => {
    expect(SCALES.map((s) => s.id)).toEqual(["compact", "default", "generous"]);
    expect(SCALES.some((s) => s.id === DEFAULT_SCALE_ID)).toBe(true);
  });

  it("keeps the default's eleven values exactly as every stored document carries them", () => {
    const scale = SCALES.find((s) => s.id === DEFAULT_SCALE_ID);
    if (!scale) throw new Error("no default scale");
    expect(scale.sizes).toEqual({
      "size.heading": "2.5rem",
      "size.subheading": "1.5rem",
      "size.body": "1rem",
    });
    expect(scale.spaces).toEqual({
      "space.xs": "4px",
      "space.sm": "8px",
      "space.md": "16px",
      "space.lg": "24px",
      "space.xl": "48px",
    });
    expect(scale.radii).toEqual({
      "radius.sm": "4px",
      "radius.md": "8px",
      "radius.lg": "16px",
    });
  });

  it("orders every one of the eleven the same way: compact < default < generous", () => {
    // The claim the overflow suite stands on. Strictly smaller, not merely "no larger": two scales
    // that agreed on a value would make one of the three a partial duplicate of another, and
    // `identifyScale` compares all eleven to decide which one a theme came from.
    const [compact, base, generous] = SCALES;
    if (!compact || !base || !generous) throw new Error("expected three scales");
    for (const key of Object.keys(base.sizes) as (keyof typeof base.sizes)[]) {
      expect(pixels(compact.sizes[key]), key).toBeLessThan(pixels(base.sizes[key]));
      expect(pixels(base.sizes[key]), key).toBeLessThan(pixels(generous.sizes[key]));
    }
    for (const key of Object.keys(base.spaces) as (keyof typeof base.spaces)[]) {
      expect(pixels(compact.spaces[key]), key).toBeLessThan(pixels(base.spaces[key]));
      expect(pixels(base.spaces[key]), key).toBeLessThan(pixels(generous.spaces[key]));
    }
    for (const key of Object.keys(base.radii) as (keyof typeof base.radii)[]) {
      expect(pixels(compact.radii[key]), key).toBeLessThan(pixels(base.radii[key]));
      expect(pixels(base.radii[key]), key).toBeLessThan(pixels(generous.radii[key]));
    }
  });

  it("orders each scale's own steps, so xs is the smallest and xl the largest", () => {
    for (const scale of SCALES) {
      const spaces = ["space.xs", "space.sm", "space.md", "space.lg", "space.xl"] as const;
      for (let i = 1; i < spaces.length; i += 1) {
        const previous = spaces[i - 1];
        const current = spaces[i];
        if (!previous || !current) throw new Error("unreachable");
        expect(pixels(scale.spaces[previous]), `${scale.id} ${previous} < ${current}`).toBeLessThan(
          pixels(scale.spaces[current]),
        );
      }
      expect(pixels(scale.radii["radius.sm"]), scale.id).toBeLessThan(
        pixels(scale.radii["radius.md"]),
      );
      expect(pixels(scale.radii["radius.md"]), scale.id).toBeLessThan(
        pixels(scale.radii["radius.lg"]),
      );
      expect(pixels(scale.sizes["size.body"]), scale.id).toBeLessThan(
        pixels(scale.sizes["size.subheading"]),
      );
      expect(pixels(scale.sizes["size.subheading"]), scale.id).toBeLessThan(
        pixels(scale.sizes["size.heading"]),
      );
    }
  });

  it("never draws body text below the 12px nobody should be asked to read", () => {
    // Not a WCAG threshold — there is no minimum font size in WCAG — but a floor of our own, and
    // the one number in "compact" that is a decision rather than a proportion. 0.9375rem is 15px.
    for (const scale of SCALES) {
      expect(pixels(scale.sizes["size.body"]), scale.id).toBeGreaterThanOrEqual(12);
    }
  });

  it("keeps the h1 above the 24px where WCAG's large-text threshold begins", () => {
    // Only `size.heading` is claimed here, and deliberately: `size.subheading` is 24px in the
    // default scale and **20px in "compact"**, which crosses that line. Crossing it is allowed —
    // below 24px axe asks 4.5:1 of the text instead of 3:1, and `contrast.test.ts` already asserts
    // all five pairs at 4.5:1 in every palette, so the stricter question has a green answer. The
    // browser suite checks it rather than trusting the arithmetic: `contrastCombinations` runs axe
    // over all three scales for exactly this reason.
    for (const scale of SCALES) {
      expect(pixels(scale.sizes["size.heading"]), scale.id).toBeGreaterThanOrEqual(24);
    }
  });
});
