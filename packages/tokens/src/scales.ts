import type { TokenKey } from "@retorika/schema";

export type SizeKey = Extract<TokenKey, `size.${string}`>;
export type SpaceKey = Extract<TokenKey, `space.${string}`>;
export type RadiusKey = Extract<TokenKey, `radius.${string}`>;

export interface Scale {
  id: string;
  sizes: Record<SizeKey, string>;
  spaces: Record<SpaceKey, string>;
  radii: Record<RadiusKey, string>;
}

export const DEFAULT_SCALE_ID = "default";

export const SCALES: readonly Scale[] = [
  {
    id: "default",
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
];
