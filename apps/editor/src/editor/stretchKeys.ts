import { FINE_COLUMNS, type Placement, type PlacementEdit } from "@retorika/schema";
import { MAX_ROW } from "./designTree.ts";

/**
 * **Stretching and scaling from the keyboard** (ADR 0082's día 6 amendment, sprint 41), decided
 * without a DOM. The house rule that a pointer gesture ships with its keyboard in the same sprint:
 * the corner that scales and the sides that stretch (ADR 0082) get `+` and `−`, and `E`.
 *
 * **No modifier is free for this**, which is why these are letters: Alt+arrows is back and forward
 * on Windows, Control+arrows is Spaces on the Mac, ⌘+arrows the start and end of a line, and Shift
 * already means «eight at a time» (ADR 0050 día 6). So:
 *
 * - `+` and `−` scale the chosen element — its letter and box, or its photograph — a tenth a press;
 * - `E` enters «estirando», where the arrows change the width and the height with the top-left
 *   corner still, Shift eight at a time, until `E`, Escape or Intro leave it.
 *
 * None of them reaches a text being written in: the canvas leaves a `contentEditable` alone before
 * asking this, so «e» and «+» are letters there.
 */
export type StretchKey =
  | { readonly kind: "scale"; readonly steps: 1 | -1 }
  | { readonly kind: "enter" }
  | { readonly kind: "leave" }
  | { readonly kind: "stretch"; readonly columns: number; readonly rows: number }
  | { readonly kind: "none" };

const NONE: StretchKey = { kind: "none" };
/** Eight units, a catalog column — the same «Shift» the arrows have. */
const SHIFT_UNITS = 8;
/** What one press of `+` multiplies by, and `−` divides by. */
export const SCALE_STEP = 1.1;

export function stretchKey(
  press: {
    readonly key: string;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
  },
  stretching: boolean,
): StretchKey {
  if (press.altKey || press.ctrlKey || press.metaKey) return NONE;
  // `+` needs Shift on some layouts and not on the Spanish one, so Shift is allowed for it; `=` is
  // the same key unshifted on a US keyboard. The numeric pad's keys report `+` and `-` as well.
  if (press.key === "+" || press.key === "=") return { kind: "scale", steps: 1 };
  if (press.key === "-" || press.key === "_") return { kind: "scale", steps: -1 };
  if (press.key === "e" || press.key === "E") {
    return stretching ? { kind: "leave" } : { kind: "enter" };
  }
  if (!stretching) return NONE;
  if (press.key === "Escape" || press.key === "Enter") return { kind: "leave" };
  const step = press.shiftKey ? SHIFT_UNITS : 1;
  const columns = press.key === "ArrowLeft" ? -step : press.key === "ArrowRight" ? step : 0;
  const rows = press.key === "ArrowUp" ? -step : press.key === "ArrowDown" ? step : 0;
  if (columns === 0 && rows === 0) return NONE;
  return { kind: "stretch", columns, rows };
}

/** The factor a run of `+` and `−` presses asks for. */
export function scaleOf(steps: number): number {
  return SCALE_STEP ** steps;
}

/**
 * The placement a run of stretching presses asks for: the top-left corner still, the far edges by
 * the run's totals, clamped at the grid and at one unit and one row — never refused, as a held key
 * stopping dead for no visible reason would be the dead control this editor refuses.
 */
export function stretchedBox(placement: Placement, columns: number, rows: number): PlacementEdit {
  const edit: PlacementEdit = {};
  const columnSpan = Math.min(
    FINE_COLUMNS - placement.column + 1,
    Math.max(1, placement.columnSpan + columns),
  );
  const rowSpan = Math.min(MAX_ROW - placement.row + 1, Math.max(1, placement.rowSpan + rows));
  if (columnSpan !== placement.columnSpan) edit.columnSpan = columnSpan;
  if (rowSpan !== placement.rowSpan) edit.rowSpan = rowSpan;
  return edit;
}
