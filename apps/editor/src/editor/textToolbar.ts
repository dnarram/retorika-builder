import type { ContentElement, Role, StyleProperty } from "@retorika/schema";
import { STYLE_REFS } from "@retorika/schema";
import { type ColorKey, provedOn } from "@retorika/tokens";

/**
 * The references each control may write, taken from the schema's own narrowed lists rather than
 * declared again.
 *
 * Deriving them is what makes the guarantee a type rather than a runtime filter: `ColorKey`
 * includes `color.accent`, which `elementStyleSchema` refuses, so a function returning `ColorKey[]`
 * hands the caller values the writer would throw on. The compiler caught exactly that on the first
 * build of this day, which is the shape of the check being worth having.
 */
type ColorRef = (typeof STYLE_REFS)["color"][number];
type SizeRef = (typeof STYLE_REFS)["fontSize"][number];
type PaddingRef = (typeof STYLE_REFS)["padding"][number];
type RadiusRef = (typeof STYLE_REFS)["borderRadius"][number];

/**
 * What the floating toolbar offers for a given element, decided here rather than in the DOM code
 * that draws it.
 *
 * The advanced dossier §4, "Apagado" row, word for word: «Texto, tamaño, **color del tema**,
 * enlace». Text is the click-to-edit that has existed since sprint 2; the other three are this.
 *
 * **A control that does not apply is not drawn, not drawn greyed out.** The same rule the `Diseño`
 * rail item follows (ADR 0025 §6): a disabled control tells somebody there is a door they cannot
 * open, and there is no door — a heading has no destination, and greying out a link field beside it
 * would invent one.
 */

/**
 * The colour an element's background resolves to on the published page.
 *
 * **Two answers, not three, and that is measured rather than assumed.** The sprint plan expected a
 * third case for text over a photograph; the renderer does not have one. `build.ts` paints
 * `[role=button]` on `var(--color-primary)`, and everything else sits on the page's own
 * `var(--color-surface)` — *including* text over a photograph, because `panelArea` puts a
 * `color.surface` panel under exactly that text and says why in its own words: «the one background
 * every palette guarantees its text colours against». The panel exists so this question has one
 * fewer answer.
 *
 * So there is no case here for an image, and none for a section variant. If a future rule paints a
 * third background, this function is where it is added and `provedOn` is what will answer "no
 * colours yet" until somebody measures a pair for it.
 */
export function backgroundOf(role: Role): ColorKey {
  return role === "button" ? "color.primary" : "color.surface";
}

/**
 * The colour roles the toolbar may offer for this element, in the order the swatch row draws them.
 *
 * Every entry is a pair `packages/tokens` has proved at 4.5:1 in every palette. A role with no
 * proved pair against this background **is not returned** — not returned disabled. A reference is
 * not safe merely by being a reference: `color.surface` text on a `color.surface` background is
 * 1:1, invisible, and a perfectly legal value of the schema. Offering all five roles everywhere
 * would reproduce in miniature the hazard `REVIEW.md` refuses at full size.
 */
export function colorRolesFor(role: Role): ColorRef[] {
  const admitted: readonly ColorKey[] = STYLE_REFS.color;
  return provedOn(backgroundOf(role)).filter((key): key is ColorRef => admitted.includes(key));
}

/** The size steps, which are the three the system declares and no fourth. A step between
 * references, never a free number: that is rule 6's first arm, and it is what the "Apagado" row
 * means by «tamaño». */
export function sizeRefsFor(): readonly SizeRef[] {
  return STYLE_REFS.fontSize;
}

/**
 * Which controls this element gets.
 *
 * `link` is true only for something that already has a destination — a button or a link. It is a
 * second door to what the fields panel does, the way the «Fotos» panel is a second door to a
 * photograph, and not a second mechanism: pressing it opens that panel on this element rather than
 * editing an href in the frame.
 *
 * `color` can be empty, and the row is then not drawn at all. That is a real state rather than a
 * defensive one — it is what a background with no proved pair produces.
 */
export interface ToolbarControls {
  color: ColorRef[];
  size: readonly SizeRef[];
  link: boolean;
  /**
   * Whether `B` and `I` are drawn — ADR 0024's bold and italic, over a run of characters.
   *
   * **For everybody, switch or no switch.** Rule 6 divides references from exact values and the
   * design-tools switch is that line (ADR 0026); a mark is neither. It is not a colour and not a
   * measure — it is what a word means inside a sentence — so there is nothing for the switch to
   * gate. Two owners out of three asked for it and neither was a professional.
   *
   * **`false` for a button and a link**, which is an interface choice and not a rule: the schema
   * accepts marks on any text value on purpose (ADR 0027 §6), so that the renderer splits every
   * text by one code path. A two-word label has nothing to emphasise *inside* it, and a control
   * that does not apply is not drawn.
   */
  marks: boolean;
  /**
   * The "Encendido" half of the §4 row: «Añade **posición, medidas y espaciado**». Position is the
   * `Diseño` panel's grid, from sprint 8; these are the other two, and they appear only with the
   * design tools on.
   *
   * `undefined` when they are off — not an empty list, because "there is no such control here" and
   * "this control has nothing to offer" are different states and only the second is a row drawn
   * empty.
   */
  measures?: {
    padding: readonly PaddingRef[];
    borderRadius: readonly RadiusRef[];
    /**
     * Which of the four properties accept an exact value, and the list is a decision rather than a
     * capability — the schema has accepted all four since sprint 9 day 2.
     *
     * **Each one joined with the review that makes it safe, never before it.** `color` joined on
     * sprint 9 day 6, the day the download gate learned to refuse a colour under 3:1 (ADR 0026 §2).
     * `fontSize` joined on **sprint 10 day 6**, the day the gate learned to measure the page at 320
     * pixels — the other half of the same dossier §4 sentence, and the reason ADR 0026 gave for
     * holding it back: «a size is the one value in this vocabulary that can cause an overflow, and
     * offering it behind a gate that cannot see what it would cause is the shape of promise ADR
     * 0026 exists to refuse.» The gate can see it now, so the list is complete.
     */
    exact: readonly StyleProperty[];
  };
}

/** Roles the toolbar appears for: the ones whose text a person can click into. `image` is out for
 * the reason `EDITABLE_TAGS` leaves it out — there is no text on a photograph to select — and
 * `list` is a container rather than something with words of its own. */
const TOOLBARED_ROLES: ReadonlySet<Role> = new Set([
  "heading",
  "subheading",
  "body",
  "button",
  "link",
]);

/** The exact values offered, by property. See `ToolbarControls["measures"]` for why each is in or
 * out, and ADR 0026 §2 for the record. */
export const EXACT_TODAY: readonly StyleProperty[] = [
  "color",
  "fontSize",
  "padding",
  "borderRadius",
];

export function toolbarFor(
  element: Pick<ContentElement, "role">,
  designTools = false,
): ToolbarControls | undefined {
  if (!TOOLBARED_ROLES.has(element.role)) return undefined;
  return {
    color: colorRolesFor(element.role),
    size: sizeRefsFor(),
    link: element.role === "button" || element.role === "link",
    marks: element.role !== "button" && element.role !== "link",
    ...(designTools
      ? {
          measures: {
            padding: STYLE_REFS.padding,
            borderRadius: STYLE_REFS.borderRadius,
            exact: EXACT_TODAY,
          },
        }
      : {}),
  };
}

/** Whether the toolbar would draw anything at all. A toolbar with no control in it is not drawn,
 * which is the same rule applied one level up. */
export function hasAnyControl(controls: ToolbarControls): boolean {
  return (
    controls.color.length > 0 ||
    controls.size.length > 0 ||
    controls.link ||
    controls.marks ||
    controls.measures !== undefined
  );
}
