import { elementStyleSchema, type Role, STYLE_REFS } from "@retorika/schema";
import { CONTRAST_PAIRS, contrastRatio, PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  backgroundOf,
  colorRolesFor,
  EXACT_TODAY,
  hasAnyControl,
  sizeRefsFor,
  toolbarFor,
} from "../src/editor/textToolbar.ts";

/**
 * What the floating toolbar offers, and — the part that matters — what it refuses to offer.
 *
 * The rule this whole file exists for: **a reference is not safe merely by being a reference.**
 * `{ref: "color.surface"}` on a `color.surface` background is 1:1, invisible, and a value the
 * schema accepts without complaint. A control that showed all five colour roles everywhere would
 * be a small version of the free colour picker `REVIEW.md` refuses.
 */

describe("the colour a role sits on", () => {
  it("is color.primary for a button and color.surface for everything else", () => {
    // `build.ts` paints `[role=button]` on `var(--color-primary)`; the page's own background is
    // `var(--color-surface)`.
    expect(backgroundOf("button")).toBe("color.primary");
    for (const role of ["heading", "subheading", "body", "link"] as const) {
      expect(backgroundOf(role), role).toBe("color.surface");
    }
  });

  it("has no third answer for text over a photograph, because the panel is surface too", () => {
    // The sprint plan expected one. The renderer does not have one: `panelArea` puts a
    // `color.surface` panel under any text that overlaps an image, for exactly this reason. So an
    // element over a photo is asked the same question as one on the page, and gets the same answer.
    expect(backgroundOf("body")).toBe("color.surface");
  });
});

describe("the colours the bar offers", () => {
  it("does NOT offer color.surface for a body on a color.surface background", () => {
    // The test asked for by name: try to put `color.surface` text on a `color.surface` background,
    // and the bar does not offer it. It is not offered greyed out either — it is absent.
    expect(backgroundOf("body")).toBe("color.surface");
    expect(colorRolesFor("body")).not.toContain("color.surface");
    // And the schema would have taken it, which is what makes the refusal the toolbar's own job.
    expect(() => elementStyleSchema.parse({ color: { ref: "color.surface" } })).not.toThrow();
  });

  it("does offer color.ink on that same background, so the refusal is not just a blank row", () => {
    expect(colorRolesFor("body")).toContain("color.ink");
    expect(colorRolesFor("body")).toEqual([
      "color.ink",
      "color.primary",
      "color.secondary",
      "color.muted",
    ]);
  });

  it("changes the list for a button, because the background changed", () => {
    // One proved pair on `color.primary`, so one swatch. A control with a single option is honest;
    // one with five of which four are unmeasured is not.
    expect(colorRolesFor("button")).toEqual(["color.surface"]);
    expect(colorRolesFor("button")).not.toContain("color.ink");
  });

  it("offers color.accent to nothing, in any position", () => {
    for (const role of ["heading", "subheading", "body", "button", "link"] as const) {
      expect(colorRolesFor(role), role).not.toContain("color.accent");
    }
  });

  it("offers only what the schema would also accept", () => {
    // Two closed lists that could disagree: `STYLE_REFS.color` (day 2) and the proved pairs (this
    // day). An offer the schema then refuses would be a swatch that throws when pressed.
    for (const role of ["heading", "subheading", "body", "button", "link"] as const) {
      for (const key of colorRolesFor(role)) {
        expect(
          () => elementStyleSchema.parse({ color: { ref: key } }),
          `${role} ${key}`,
        ).not.toThrow();
      }
    }
  });

  it("offers only pairs measured at 4.5:1 in every palette — the arithmetic, not the list", () => {
    // Not a restatement of `CONTRAST_PAIRS`: this recomputes the ratio for each offered
    // combination, so a pair added to that list without measuring it fails here as well as there.
    for (const role of ["heading", "subheading", "body", "button", "link"] as const) {
      const background = backgroundOf(role);
      for (const key of colorRolesFor(role)) {
        for (const palette of PALETTES) {
          const ratio = contrastRatio(palette.colors[key], palette.colors[background]);
          expect(ratio, `${palette.id}: ${key} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("would offer nothing at all if the pair list were empty, rather than falling back", () => {
    // The failure mode worth naming: no silent default. Every offered key traces to a declared
    // pair, so an empty list means an empty row.
    const everyOffered = (["heading", "body", "button"] as const).flatMap(colorRolesFor);
    for (const key of everyOffered) {
      expect(CONTRAST_PAIRS.some((pair) => pair.fg === key)).toBe(true);
    }
  });
});

describe("the sizes the bar offers", () => {
  it("is the three the system declares, and no fourth", () => {
    expect([...sizeRefsFor()]).toEqual(["size.heading", "size.subheading", "size.body"]);
    expect([...sizeRefsFor()]).toEqual([...STYLE_REFS.fontSize]);
  });

  it("offers a step between references, never a free number", () => {
    for (const ref of sizeRefsFor()) {
      expect(() => elementStyleSchema.parse({ fontSize: { ref } }), ref).not.toThrow();
    }
  });
});

describe("which elements get a bar at all", () => {
  it("gives one to the roles whose text a person can click into", () => {
    for (const role of ["heading", "subheading", "body", "button", "link"] as const) {
      expect(toolbarFor({ role }), role).toBeDefined();
    }
  });

  it("gives none to an image or a list", () => {
    // `EDITABLE_TAGS` leaves `img` out because there is no text on a photograph to select; a list
    // is a container rather than something with words of its own.
    for (const role of ["image", "list"] as Role[]) {
      expect(toolbarFor({ role }), role).toBeUndefined();
    }
  });

  it("offers the link control only where there is already a destination", () => {
    // Not a second mechanism: a second door to the fields panel, the way «Fotos» is a second door
    // to a photograph. A heading has nowhere to point, and a greyed-out field beside it would
    // invent one.
    expect(toolbarFor({ role: "button" })?.link).toBe(true);
    expect(toolbarFor({ role: "link" })?.link).toBe(true);
    expect(toolbarFor({ role: "heading" })?.link).toBe(false);
    expect(toolbarFor({ role: "body" })?.link).toBe(false);
  });

  it("draws nothing when nothing applies", () => {
    expect(hasAnyControl({ color: [], size: [], link: false })).toBe(false);
    const heading = toolbarFor({ role: "heading" });
    expect(heading && hasAnyControl(heading)).toBe(true);
  });
});

/**
 * The "Encendido" half of the §4 row — «Añade posición, medidas y espaciado» — and the one thing
 * about it that is a decision rather than a feature: **which exact values ship today.**
 */
describe("what the design tools add", () => {
  it("adds nothing at all when they are off", () => {
    // Not an empty list: `undefined`, because "there is no such control here" and "this control has
    // nothing to offer" are different states and only the second draws an empty row.
    expect(toolbarFor({ role: "heading" })?.measures).toBeUndefined();
    expect(toolbarFor({ role: "heading" }, false)?.measures).toBeUndefined();
  });

  it("adds spacing and corners when they are on, by reference", () => {
    const measures = toolbarFor({ role: "heading" }, true)?.measures;
    expect(measures?.padding).toEqual(["space.xs", "space.sm", "space.md", "space.lg", "space.xl"]);
    expect(measures?.borderRadius).toEqual(["radius.sm", "radius.md", "radius.lg"]);
  });

  it("offers an exact colour only now that the review exists, and never an exact size", () => {
    // ADR 0026 §2. On day 5 this list was `["padding", "borderRadius"]` and this test said so:
    // shipping the colour control a day before the gate that refuses what it can produce would
    // have left a deployed editor in the state `REVIEW.md` refuses, for a day. Day 6 brought the
    // review, so the colour joins — together, which is what the ADR asks.
    expect([...EXACT_TODAY]).toEqual(["color", "padding", "borderRadius"]);
    // `fontSize` stays out, and for a different reason than contrast: every proved pair clears
    // 4.5:1 at any size, but the same §4 sentence promises the check covers «desbordes por debajo
    // de 320 píxeles», and nothing measures that yet. An exact size is the one value in this
    // vocabulary that can cause one.
    expect(EXACT_TODAY).not.toContain("fontSize");
  });

  it("keeps the colour list computed even with the tools on", () => {
    // Turning the tools on adds measurements; it does not relax the contrast rule. Somebody who
    // builds sites for a living gets the same four proved roles on a surface, and the same one on
    // a button — the exception arm is what the switch buys, not an unproved reference.
    expect(colorRolesFor("body")).toEqual(toolbarFor({ role: "body" }, true)?.color);
    expect(toolbarFor({ role: "body" }, true)?.color).not.toContain("color.surface");
    expect(toolbarFor({ role: "button" }, true)?.color).toEqual(["color.surface"]);
  });

  it("every exact value it offers is one the schema accepts", () => {
    // A length for the two measurements, a hex for the colour — the schema narrowed each of them on
    // day 2 precisely so an exact value cannot be something the renderer could not emit.
    const sample: Record<string, string> = {
      color: "#1D4ED8",
      padding: "20px",
      borderRadius: "20px",
    };
    for (const property of EXACT_TODAY) {
      const value = sample[property];
      expect(value, `no sample for ${property}`).toBeDefined();
      expect(
        () => elementStyleSchema.parse({ [property]: { exact: value, exception: true } }),
        property,
      ).not.toThrow();
      // And an unmarked one is still refused, which is rule 6's second arm.
      expect(() => elementStyleSchema.parse({ [property]: { exact: value } }), property).toThrow();
    }
  });

  it("draws a bar with the tools on even where every other control is empty", () => {
    // A hypothetical element whose background has no proved pair: no colours, but measurements
    // still apply, so there is still a bar. `hasAnyControl` has to know that.
    expect(hasAnyControl({ color: [], size: [], link: false })).toBe(false);
    expect(
      hasAnyControl({
        color: [],
        size: [],
        link: false,
        measures: { padding: [], borderRadius: [], exact: [] },
      }),
    ).toBe(true);
  });
});
