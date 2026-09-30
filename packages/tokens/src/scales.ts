import type { TokenKey } from "@retorika/schema";

export type SizeKey = Extract<TokenKey, `size.${string}`>;
export type SpaceKey = Extract<TokenKey, `space.${string}`>;
export type RadiusKey = Extract<TokenKey, `radius.${string}`>;

export interface Scale {
  id: string;
  /** Key into `locales/es.json`, the same contract `Palette.nameKey` and `TypePair.nameKey` use. */
  nameKey: string;
  sizes: Record<SizeKey, string>;
  spaces: Record<SpaceKey, string>;
  radii: Record<RadiusKey, string>;
}

export const DEFAULT_SCALE_ID = "default";

/**
 * The three settings of "el sistema" — the advanced dossier §6's «Escala tipográfica, espaciados,
 * radios y sombras **como sistema**».
 *
 * Until sprint 9 there was exactly one, which made "as a system" a system with a single setting:
 * `buildTheme` took a `scaleId`, `withPalette` was careful not to reset it, and no screen ever
 * offered a second value to reset it to. These are the other two.
 *
 * **Named by character, never by number**, which is the rule `TYPE_PAIRS` already follows and for
 * the same reason: "Compacta" says what the owner will see, and "0.875x" says what a developer
 * chose. There is no "pequeña / mediana / grande" either — those read as a quality ladder, and
 * none of the three is better than the others.
 *
 * **`default`'s eleven values are byte-identical to what they were**, deliberately: every document
 * ever generated carries them, the whole golden corpus is rendered with them, and a sprint that
 * adds two options is not the sprint to move the one everybody is already on. The two new scales
 * are the only thing here that is new.
 *
 * **The numbers were measured, not guessed.** `packages/renderer/test/overflow.browser.test.ts`
 * runs the full section matrix at 320, 768 and 1280 px, and `scales.test.ts` pins the arithmetic
 * these three have to keep — see the header there for what "generous" cost before it was 3rem.
 */
export const SCALES: readonly Scale[] = [
  {
    id: "compact",
    nameKey: "scale.compact",
    sizes: {
      "size.heading": "2rem",
      "size.subheading": "1.25rem",
      "size.body": "0.9375rem",
    },
    spaces: {
      "space.xs": "3px",
      "space.sm": "6px",
      "space.md": "12px",
      "space.lg": "18px",
      "space.xl": "32px",
    },
    radii: {
      "radius.sm": "2px",
      "radius.md": "4px",
      "radius.lg": "8px",
    },
  },
  {
    id: "default",
    nameKey: "scale.default",
    sizes: {
      "size.heading": "2.5rem",
      "size.subheading": "1.5rem",
      "size.body": "1rem",
    },
    spaces: {
      "space.xs": "4px",
      "space.sm": "8px",
      "space.md": "16px",
      "space.lg": "24px",
      "space.xl": "48px",
    },
    radii: {
      "radius.sm": "4px",
      "radius.md": "8px",
      "radius.lg": "16px",
    },
  },
  {
    id: "generous",
    nameKey: "scale.generous",
    sizes: {
      "size.heading": "3rem",
      "size.subheading": "1.75rem",
      "size.body": "1.0625rem",
    },
    spaces: {
      "space.xs": "6px",
      "space.sm": "12px",
      "space.md": "24px",
      "space.lg": "36px",
      "space.xl": "72px",
    },
    radii: {
      "radius.sm": "6px",
      "radius.md": "14px",
      "radius.lg": "28px",
    },
  },
];
