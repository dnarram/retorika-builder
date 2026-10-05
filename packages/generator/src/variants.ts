import type { CoverVariant, ServicesVariant } from "@retorika/catalog";

/**
 * The three combinations `docs/design/prototype/` already used and you approved: same content,
 * three real compositions.
 *
 * **`v3` moved from `image-right` to `image-left` on 5 October 2026**, and that is the one thing
 * here that was re-decided. There were only two cover compositions for three cards, so `v1` and
 * `v3` shared one: the top of two previews was identical and the difference lived in a services
 * layout further down, often below the fold of the card. The screen exists to offer three visible
 * choices, so the covers are now three. See `packages/catalog/src/cover.ts`.
 */
export interface VariantChoice {
  id: "v1" | "v2" | "v3";
  cover: CoverVariant;
  services: ServicesVariant;
}

export const VARIANTS: readonly [VariantChoice, VariantChoice, VariantChoice] = [
  { id: "v1", cover: "image-right", services: "stacked" },
  { id: "v2", cover: "image-background", services: "side" },
  { id: "v3", cover: "image-left", services: "split" },
];
