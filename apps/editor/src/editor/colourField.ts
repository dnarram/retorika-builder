import {
  type ColorKey,
  hexToOklch,
  inkOn,
  type LegibleAxis,
  legibleSteps,
  type Oklch,
  oklchToHex,
  type PairKey,
  type PaletteColors,
  type UnreadablePair,
  validateTheme,
} from "@retorika/tokens";
import es from "../locales/es.json" with { type: "json" };

/**
 * **The colour field's arithmetic** (sprint 38 día 7, ADR 0077): what the two sliders offer, where they
 * stop, what the track paints as unreachable and what it says there, and what «Ajustar» moves a colour
 * from the wheel or the hex to. Pure, so every rule is asserted rather than walked; `ColourField.tsx`
 * draws it and `@retorika/tokens`' `legibleSteps` and `validateTheme` judge it.
 *
 * **David's P6 is the rule: «lo inválido no nace».** A slider can only stand on a step that keeps every
 * pair the colour is part of at 4.5; the steps it cannot reach are painted on its track before the hand
 * gets there, with a `title` saying which pair stops reading; the wheel and the hex, which can ask for
 * anything, are judged on their `change` and not written when they would break a pair.
 */

/** The colours the field edits: the five the page paints with, and the fill when the palette has one.
 * The accent is in no pair and no rule reads it; the fill's ink is never edited, it is recomputed. */
export type EditableKey =
  | Extract<
      ColorKey,
      "color.primary" | "color.secondary" | "color.muted" | "color.surface" | "color.ink"
    >
  | "color.fill";

export const EDITABLE_KEYS: readonly EditableKey[] = [
  "color.fill",
  "color.primary",
  "color.secondary",
  "color.muted",
  "color.surface",
  "color.ink",
];

/** The palette with one colour in place of its own — and, for the fill, the ink drawn on it recomputed,
 * which is what `legibleSteps` judges it with. Nothing else moves. */
export function withColour(colors: PaletteColors, key: EditableKey, hex: string): PaletteColors {
  const next: PaletteColors = { ...colors, [key]: hex };
  if (key === "color.fill") {
    next["color.onFill"] = inkOn(hex, colors["color.surface"], colors["color.ink"]);
  }
  return next;
}

/** The colour the field shows for a key: the fill falls back to the primary, as the renderer paints it. */
export function colourOf(colors: PaletteColors, key: EditableKey): string {
  return key === "color.fill" ? (colors["color.fill"] ?? colors["color.primary"]) : colors[key];
}

/** The pairs a colour is part of: the fill's own pair is the fill and its ink. */
function involved(key: EditableKey): PairKey[] {
  return key === "color.fill" ? ["color.fill", "color.onFill"] : [key];
}

/** The pairs this colour breaks — and only those: another colour's failure, in a document edited by
 * hand, is that colour's field's to say, not this one's. */
export function unreadableFor(
  colors: PaletteColors,
  key: EditableKey,
  hex: string,
): UnreadablePair[] {
  const keys = involved(key);
  return validateTheme(withColour(colors, key, hex)).filter(
    (pair) => keys.includes(pair.fg) || keys.includes(pair.bg),
  );
}

export interface FieldSteps {
  axis: LegibleAxis;
  /** The input's own numbers: lightness 0…100 and hue 0…355 in fives, which is what a screen reader
   * hears as the range. */
  values: number[];
  /** The colour at each step, from the colour the gesture started on. */
  hexes: string[];
  valid: boolean[];
  /** The step the colour stands on. */
  at: number;
}

/**
 * The slider's steps for one colour and one axis, **from `base`** — the colour the gesture started on,
 * kept for the length of a drag or of a run of arrows, so a lightness pushed to the top and brought
 * back does not come back greyer: a step's colour is always the base's hue and chroma at that
 * lightness, brought into the screen's gamut, and never the last step's.
 */
export function stepsFor(
  colors: PaletteColors,
  key: EditableKey,
  axis: LegibleAxis,
  base: string,
): FieldSteps {
  const judged = legibleSteps(withColour(colors, key, base), key, axis);
  const own = hexToOklch(base);
  const hexes = judged.values.map((value) =>
    oklchToHex((axis === "lightness" ? { ...own, L: value } : { ...own, h: value }) as Oklch),
  );
  const values = judged.values.map((value) =>
    axis === "lightness" ? Math.round(value * 100) : value,
  );
  return { axis, values, hexes, valid: judged.valid, at: judged.at };
}

/** The next step an arrow lands on: one step that way, skipping what is unreachable, or where it is
 * when nothing that way can be reached — an arrow on the last legible step changes nothing. */
export function nextValid(steps: FieldSteps, from: number, direction: 1 | -1): number {
  for (let i = from + direction; i >= 0 && i < steps.valid.length; i += direction) {
    if (steps.valid[i]) return i;
  }
  return from;
}

/** Home and End: the legible extremes, not the input's. */
export function legibleExtremes(steps: FieldSteps): { first: number; last: number } | null {
  const first = steps.valid.indexOf(true);
  if (first < 0) return null;
  return { first, last: steps.valid.lastIndexOf(true) };
}

/** Where a drag stands when the pointer asks for a step: that step if it can be reached, otherwise
 * the last one that could — «un paso que caería en inválido se queda en el último válido». */
export function reachable(steps: FieldSteps, wanted: number, lastValid: number): number {
  return steps.valid[wanted] ? wanted : lastValid;
}

/** The legible step nearest a colour's own, for «Ajustar»; the nearer of two at the same distance is
 * the darker or the earlier, which is the order the steps run in. `null` when none is legible. */
export function nearestValid(steps: FieldSteps, at: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < steps.valid.length; i += 1) {
    if (!steps.valid[i]) continue;
    if (best === null || Math.abs(i - at) < Math.abs(best - at)) best = i;
  }
  return best;
}

/** What the owner calls each colour of a pair, as the other half of a sentence about it. */
const PAIR_WORDS: Record<PairKey | "glass", keyof typeof es> = {
  "color.surface": "editor.style.pair.surface",
  "color.ink": "editor.style.pair.ink",
  "color.primary": "editor.style.pair.primary",
  "color.secondary": "editor.style.pair.secondary",
  "color.muted": "editor.style.pair.muted",
  "color.fill": "editor.style.pair.fill",
  "color.onFill": "editor.style.pair.onFill",
  "color.accent": "editor.style.pair.primary",
  glass: "editor.style.pair.glass",
};

/**
 * Which way a pair reads from the colour being edited: **over** something (the colour is the words —
 * «sobre el fondo») or **under** something (the colour is the ground — «el texto, encima»), and the
 * words for the other half. The glass bar's pairs name the bar: the ink is read over it, the surface
 * is under the ink on it.
 */
export function pairFrom(
  key: EditableKey,
  pair: UnreadablePair,
): { side: "over" | "under"; other: string } {
  const keys = involved(key);
  const editedIsWords =
    keys.includes(pair.fg) && !(key === "color.fill" && pair.fg === "color.onFill");
  if (editedIsWords) {
    return { side: "over", other: es[pair.under ? PAIR_WORDS.glass : PAIR_WORDS[pair.bg]] };
  }
  return { side: "under", other: es[PAIR_WORDS[pair.fg]] };
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The ratio as the owner reads numbers: one decimal, a comma. */
export function ratioWords(ratio: number): string {
  return (Math.floor(ratio * 10) / 10).toFixed(1).replace(".", ",");
}

/** The sentence under a field whose wheel or hex asked for an unreadable colour:
 * «Sobre el fondo: 3,1; necesita 4,5», or «El texto, encima: 3,1; necesita 4,5». */
export function unreadableSentence(key: EditableKey, pair: UnreadablePair): string {
  const { side, other } = pairFrom(key, pair);
  const template =
    side === "over" ? es["editor.style.unreadable.over"] : es["editor.style.unreadable.under"];
  return template
    .replace("{other}", other)
    .replace("{Other}", capitalise(other))
    .replace("{ratio}", ratioWords(pair.ratio));
}

export interface Zone {
  /** First and last step of a run the slider cannot reach, inclusive. */
  from: number;
  to: number;
  /** «Por aquí deja de leerse sobre el fondo», or «Por aquí el texto deja de leerse encima». */
  title: string;
}

/**
 * The runs of unreachable steps the track paints, each with the sentence its `title` carries: the
 * first pair that breaks at the run's middle step, said from the edited colour's side — David's
 * wording, «Por aquí deja de leerse sobre {par}», when the colour is the words, and its mirror when
 * the colour is the ground under them.
 */
export function zonesOf(steps: FieldSteps, colors: PaletteColors, key: EditableKey): Zone[] {
  const zones: Zone[] = [];
  let start: number | null = null;
  const close = (end: number) => {
    if (start === null) return;
    const middle = Math.floor((start + end) / 2);
    const pair = unreadableFor(colors, key, steps.hexes[middle] as string)[0];
    let title = es["editor.style.field.zone"];
    if (pair) {
      const { side, other } = pairFrom(key, pair);
      title = (
        side === "over" ? es["editor.style.field.zoneOver"] : es["editor.style.field.zoneUnder"]
      ).replace("{other}", other);
    }
    zones.push({ from: start, to: end, title });
    start = null;
  };
  steps.valid.forEach((valid, index) => {
    if (!valid && start === null) start = index;
    if (valid) close(index - 1);
  });
  close(steps.valid.length - 1);
  return zones;
}

/** A hex the owner typed, read the way the schema writes colours — `#RRGGBB` — or `null`. Three digits
 * are expanded; anything else is not a colour. */
export function parseTypedHex(text: string): string | null {
  const trimmed = text.trim().replace(/^#?/, "#");
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${[...trimmed.slice(1)].map((c) => c + c).join("")}`.toUpperCase();
  }
  return null;
}
