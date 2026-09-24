import type { CoverVariant, ServicesVariant } from "@retorika/catalog";

/**
 * The three combinations `docs/design/prototype/` already used and you approved: same content,
 * three real compositions. Not re-decided here.
 */
export interface VariantChoice {
  id: "v1" | "v2" | "v3";
  cover: CoverVariant;
  services: ServicesVariant;
}

export const VARIANTS: readonly [VariantChoice, VariantChoice, VariantChoice] = [
  { id: "v1", cover: "image-right", services: "stacked" },
  { id: "v2", cover: "image-background", services: "side" },
  { id: "v3", cover: "image-right", services: "split" },
];
