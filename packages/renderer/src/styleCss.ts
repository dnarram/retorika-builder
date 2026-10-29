import {
  type ElementStyle,
  STYLE_PROPERTIES,
  type StyleProperty,
  tokenToCssVariable,
} from "@retorika/schema";
import { cssThemeValue } from "./escape.ts";

/**
 * Rule 6 as CSS declarations, shared by the two things that carry a style: an element
 * (`elementStyleCss` in `build.ts`) and, since ADR 0057, a part of the header (`header.ts`).
 *
 * Moved here from `build.ts` on sprint 30 día 2 because `header.ts` needed it and `build.ts`
 * imports `header.ts`: the table could not stay where it was without closing a circle. Not an
 * abstraction at two uses — a relocation, with the two readers named.
 */

/** The CSS property each of rule 6's five properties writes. Written out rather than derived by
 * camel-to-kebab, so adding one is a decision somebody makes here rather than a transformation that
 * happens to produce something — which is exactly how `fontFamily` arrived (ADR 0032), with the
 * typechecker naming this table as one of the three places that had to answer. */
export const CSS_PROPERTY: Record<StyleProperty, string> = {
  color: "color",
  fontSize: "font-size",
  fontFamily: "font-family",
  padding: "padding",
  borderRadius: "border-radius",
};

/**
 * The declarations one style writes, in `STYLE_PROPERTIES` order — fixed, so the same document is
 * the same bytes (INV_5). A reference becomes `var(--token)`, which is what makes rule 6 true: an
 * element that references `color.primary` follows the palette forever. An exact value is emitted
 * literally, after the boundary check `cssThemeValue` makes, and does not — which is precisely what
 * «excepción» means. `rename` lets a caller say that one property means another on its target, the
 * way the header's bar reads `color` as its background.
 */
export function styleDeclarations(
  style: ElementStyle,
  label: string,
  rename: Partial<Record<StyleProperty, string>> = {},
): string[] {
  const declarations: string[] = [];
  for (const property of STYLE_PROPERTIES) {
    const value = style[property];
    if (value === undefined) continue;
    const css =
      "ref" in value
        ? `var(${tokenToCssVariable(value.ref)})`
        : cssThemeValue(`${label}.${property}`, value.exact);
    declarations.push(`${rename[property] ?? CSS_PROPERTY[property]}: ${css}`);
  }
  return declarations;
}
