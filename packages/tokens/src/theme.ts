import type { Theme } from "@retorika/schema";
import { TOKEN_KEYS } from "@retorika/schema";
import { PALETTES } from "./palettes.ts";
import { DEFAULT_SCALE_ID, SCALES } from "./scales.ts";
import { TYPE_PAIRS } from "./typography.ts";

export interface BuildThemeInput {
  paletteId: string;
  typePairId: string;
  /** Defaults to DEFAULT_SCALE_ID. */
  scaleId?: string;
}

/**
 * A complete Theme: every key of the namespace, no more and no fewer.
 * Throws on an unknown id, and throws if the assembled map is missing any key.
 */
export function buildTheme(input: BuildThemeInput): Theme {
  const palette = PALETTES.find((p) => p.id === input.paletteId);
  if (!palette) {
    throw new Error(
      `Unknown paletteId "${input.paletteId}". Known: ${PALETTES.map((p) => p.id).join(", ")}`,
    );
  }

  const typePair = TYPE_PAIRS.find((t) => t.id === input.typePairId);
  if (!typePair) {
    throw new Error(
      `Unknown typePairId "${input.typePairId}". Known: ${TYPE_PAIRS.map((t) => t.id).join(", ")}`,
    );
  }

  const scaleId = input.scaleId ?? DEFAULT_SCALE_ID;
  const scale = SCALES.find((s) => s.id === scaleId);
  if (!scale) {
    throw new Error(`Unknown scaleId "${scaleId}". Known: ${SCALES.map((s) => s.id).join(", ")}`);
  }

  const assembled: Record<string, string> = {
    ...palette.colors,
    ...typePair.fonts,
    ...scale.sizes,
    ...scale.spaces,
    ...scale.radii,
  };

  for (const key of TOKEN_KEYS) {
    if (!(key in assembled) || !assembled[key]) {
      throw new Error(`Assembled theme is missing token key "${key}"`);
    }
  }

  const assembledKeys = Object.keys(assembled);
  if (assembledKeys.length !== TOKEN_KEYS.length) {
    throw new Error(
      `Assembled theme has unexpected number of keys: expected ${TOKEN_KEYS.length}, got ${assembledKeys.length}`,
    );
  }

  return assembled as unknown as Theme;
}
