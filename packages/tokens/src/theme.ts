import type { Theme } from "@retorika/schema";
import { FILL_KEYS, TOKEN_KEYS } from "@retorika/schema";
import type { PaletteColors } from "./derive.ts";
import { PALETTES } from "./palettes.ts";
import { DEFAULT_SCALE_ID, SCALES } from "./scales.ts";
import { TYPE_PAIRS } from "./typography.ts";

/**
 * The colours come from one of two places, never both: a predefined palette by its id, or a palette
 * already derived (`derivePalette`, sprint 38 día 3) — the six colours and, when it needs one, the fill
 * pair. The pair travels into the theme as it came and is never invented here.
 */
export type BuildThemeInput = {
  typePairId: string;
  /** Defaults to DEFAULT_SCALE_ID. */
  scaleId?: string;
} & ({ paletteId: string; colors?: never } | { colors: PaletteColors; paletteId?: never });

/**
 * A complete Theme: every key of the namespace, no more and no fewer.
 * Throws on an unknown id, and throws if the assembled map is missing any key.
 */
export function buildTheme(input: BuildThemeInput): Theme {
  const colors: PaletteColors | undefined =
    input.colors ?? PALETTES.find((p) => p.id === input.paletteId)?.colors;
  if (!colors) {
    throw new Error(
      `Unknown paletteId "${input.paletteId}". Known: ${PALETTES.map((p) => p.id).join(", ")}`,
    );
  }
  // The six, without the fill pair: the count below is of the namespace's nineteen, and the pair is
  // appended after the check, only when the colours carry it.
  const { "color.fill": fill, "color.onFill": onFill, ...six } = colors;

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
    ...six,
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

  if ((fill === undefined) !== (onFill === undefined)) {
    throw new Error("A palette's fill comes with its ink or not at all (ADR 0074)");
  }
  const withFill =
    fill === undefined ? assembled : { ...assembled, [FILL_KEYS[0]]: fill, [FILL_KEYS[1]]: onFill };
  return withFill as unknown as Theme;
}
