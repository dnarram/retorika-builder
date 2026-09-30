import { z } from "zod";

/**
 * Rule 6: style is references to the system; an exact value is a marked exception.
 *
 * The namespace is closed because otherwise the rule is not checkable: with an open
 * namespace a typo becomes a dead style reference that nobody discovers until it is
 * on a client's published site. Closed, it is a validation error at write time.
 *
 * Extending the list is additive and bumps the minor version, exactly like the roles
 * (ADR 0004).
 */
export const TOKEN_KEYS = [
  "color.primary",
  "color.secondary",
  "color.accent",
  "color.surface",
  "color.ink",
  "color.muted",
  "font.heading",
  "font.body",
  "size.heading",
  "size.subheading",
  "size.body",
  "space.xs",
  "space.sm",
  "space.md",
  "space.lg",
  "space.xl",
  "radius.sm",
  "radius.md",
  "radius.lg",
] as const;

export const tokenKeySchema = z.enum(TOKEN_KEYS);
export type TokenKey = z.infer<typeof tokenKeySchema>;

/**
 * Rule 6, as a shape rather than a sentence — the vocabulary an element's own style may use.
 *
 * A style value is either a reference into the namespace or an exact value that has to declare
 * itself an exception. The `exception: true` literal is not decoration: it is what lets
 * `listStyleExceptions` find every place that opted out of the system.
 *
 * **Four properties, each bound to its own family of tokens** (ADR 0026). Until sprint 9 the map's
 * key was an open `z.string()`, so `{"wobble": {ref: "color.primary"}}` parsed. Closing it to a flat
 * enum of names would not have been enough: `{color: {ref: "space.md"}}` publishes `color: 16px`, a
 * dead reference nobody discovers until it is on a client's site — which is the argument this file
 * already makes for closing the namespace at all. So each property carries the only references that
 * mean anything for it.
 *
 * **`color.accent` is admitted nowhere**, and that is measured rather than preferred: no rule the
 * renderer emits reads `var(--color-accent)`, `packages/renderer/test/theme-css.test.ts` asserts
 * that no corpus document does either, and it is the one colour whose contrast is asserted in no
 * palette — 3.19:1 on surface in `classic-blue`, under AA.
 *
 * **The window for doing this cheaply is open exactly once.** No stored document carries `style` —
 * not a fixture, not a prototype document, not any producer — so narrowing the key moves no data.
 * The day somebody writes styles against 1.1.0 that stops being true.
 */
export const STYLE_PROPERTIES = ["color", "fontSize", "padding", "borderRadius"] as const;
export type StyleProperty = (typeof STYLE_PROPERTIES)[number];

/** Which references each property admits. Data rather than four schemas, because the toolbar has
 * to offer exactly this list and a second copy of it would drift from the one that validates. */
export const STYLE_REFS = {
  color: ["color.primary", "color.secondary", "color.surface", "color.ink", "color.muted"],
  fontSize: ["size.heading", "size.subheading", "size.body"],
  padding: ["space.xs", "space.sm", "space.md", "space.lg", "space.xl"],
  borderRadius: ["radius.sm", "radius.md", "radius.lg"],
} as const satisfies Record<StyleProperty, readonly TokenKey[]>;

/**
 * What an exact value may be, per property — narrower than what the renderer's `cssThemeValue`
 * would let through, and narrower on purpose.
 *
 * The schema is the gate a *stored* document passes. If it admitted `rgb(0 0 0)` and the renderer
 * refused it at publish time, a person could save a site that cannot be published, and the repair
 * would have to be an interface for a state that should never have existed. So the invalid state is
 * made unreachable here instead: **a colour is a hex triple or nothing**, and a measurement is a
 * plain length. `cssThemeValue` stays where it is as the boundary check it always was — it simply
 * never has to fire for a document this schema accepted.
 */
const EXACT_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const EXACT_LENGTH = /^(?:0|\d{1,4}(?:\.\d{1,3})?(?:px|rem|em|%))$/;

const EXACT_PATTERNS = {
  color: EXACT_COLOR,
  fontSize: EXACT_LENGTH,
  padding: EXACT_LENGTH,
  borderRadius: EXACT_LENGTH,
} as const satisfies Record<StyleProperty, RegExp>;

function styleValueFor(property: StyleProperty) {
  return z.union([
    z.strictObject({ ref: z.enum(STYLE_REFS[property]) }),
    z.strictObject({
      exact: z.string().regex(EXACT_PATTERNS[property]),
      exception: z.literal(true),
    }),
  ]);
}

/**
 * An element's style: up to four properties, every one optional.
 *
 * A `z.strictObject` of optionals rather than a `z.record` keyed by the enum — a record would
 * demand *every* key, and an element that only recolours its text carries one property.
 */
export const elementStyleSchema = z.strictObject({
  color: styleValueFor("color").optional(),
  fontSize: styleValueFor("fontSize").optional(),
  padding: styleValueFor("padding").optional(),
  borderRadius: styleValueFor("borderRadius").optional(),
});
export type ElementStyle = z.infer<typeof elementStyleSchema>;

/** One property's value, whichever property it belongs to. */
export type StyleValue = NonNullable<ElementStyle[StyleProperty]>;

/**
 * A document's theme is a *complete* map from the namespace to values: an unknown key
 * is an error and a missing key is an error too.
 *
 * Totality is what makes the global palette change real — one click restyles the whole
 * site, hand-designed sections included — and what lets the renderer emit the theme as
 * CSS custom properties in a fixed alphabetical order, which is what the determinism of
 * INV_5 and the golden files rest on.
 *
 * The Retorika brand palette does not live here. A document's theme is the client's.
 */
export const themeSchema = z.strictObject(
  Object.fromEntries(TOKEN_KEYS.map((key) => [key, z.string().min(1)])) as {
    [K in TokenKey]: z.ZodString;
  },
);
export type Theme = z.infer<typeof themeSchema>;

/** Token keys in the fixed order the renderer emits them. Sorted, so output is stable. */
export const SORTED_TOKEN_KEYS: readonly TokenKey[] = [...TOKEN_KEYS].sort();

/** The CSS custom property a token key maps to, e.g. "color.primary" -> "--color-primary". */
export function tokenToCssVariable(key: TokenKey): string {
  return `--${key.replace(/\./g, "-")}`;
}
