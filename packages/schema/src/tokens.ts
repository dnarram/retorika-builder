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
 * A style value is either a reference into the namespace or an exact value that has
 * to declare itself an exception. The `exception: true` literal is not decoration: it
 * is what lets a future audit list every place that opted out of the system.
 */
export const styleValueSchema = z.union([
  z.strictObject({ ref: tokenKeySchema }),
  z.strictObject({ exact: z.string().min(1), exception: z.literal(true) }),
]);
export type StyleValue = z.infer<typeof styleValueSchema>;

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
