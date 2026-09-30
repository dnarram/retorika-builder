import { presetFor } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import {
  escalateSection,
  moveUpOnMobile,
  type Placement,
  type RetorikaDocument,
  setMobilePatch,
  setPlacement,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  boundsFor,
  designRows,
  MAX_ROW,
  mobileControlsFor,
  selectedRowId,
  stepTo,
} from "../src/editor/designTree.ts";

/**
 * The «Diseño» panel's rows, and the arithmetic that decides whether an arrow is disabled.
 *
 * The point of the second half is the one the memory of this project keeps insisting on: **prevent
 * the invalid state rather than add interface to repair it.** `setPlacement` refuses a placement that
 * breaks rule 4, and that refusal must stay a backstop nobody reaches — an arrow that lights up and
 * then throws is worse than a disabled one, because it looks like it worked.
 */

const doc: RetorikaDocument = generate({
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["Comidas", "Cenas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
}).document;

const free = escalateSection(doc, "sec-cover", presetFor("cover"));

const placement = (column: number, columnSpan: number, row = 1, rowSpan = 1): Placement => ({
  elementId: "el-x",
  column,
  columnSpan,
  row,
  rowSpan,
});

describe("designRows", () => {
  it("lists nothing for a section the catalog still draws", () => {
    // It has no placements, so there is nothing about its position that anyone here can change.
    // "Nothing to list" rather than a tree of rows whose arrows would all refuse.
    expect(designRows(doc, "sec-cover")).toEqual([]);
  });

  it("lists nothing for a section that is not there", () => {
    expect(designRows(free, "sec-nope")).toEqual([]);
  });

  it("lists one row per placement, named from the catalog's Spanish locale", () => {
    const rows = designRows(free, "sec-cover");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.label)).toContain("Titular");
  });

  it("includes the photo, which the fields panel deliberately leaves out", () => {
    // The two panels answer two different questions. A photograph cannot be edited in a text box —
    // so it is not a field — but it has a position, so it is very much a row here.
    expect(designRows(free, "sec-cover").map((row) => row.label)).toContain("Foto");
  });

  it("carries each element's placement, which is what the steppers read", () => {
    const titular = designRows(free, "sec-cover").find((row) => row.label === "Titular");
    expect(titular?.placement).toMatchObject({
      column: expect.any(Number),
      columnSpan: expect.any(Number),
      row: expect.any(Number),
      rowSpan: expect.any(Number),
    });
  });

  it("keeps the stored order rather than sorting by position", () => {
    // Sorting was the first instinct and it is wrong: the list would reorder itself under the
    // cursor every time somebody moved an element, and the row being worked on would jump away
    // mid-edit. Moving the headline to the last row must not move its row in this list.
    const before = designRows(free, "sec-cover").map((row) => row.elementId);
    const moved = setPlacement(free, "sec-cover", before[0] as string, { row: 9 });
    expect(designRows(moved, "sec-cover").map((row) => row.elementId)).toEqual(before);
  });

  it("marks a hidden element and keeps it, because it keeps its placement too", () => {
    const rows = designRows(free, "sec-cover");
    expect(rows.every((row) => row.hidden === false)).toBe(true);
    // Rule 3: hiding never removes, and the placement survives — so losing the row would lose the
    // only way of finding out where the element will come back.
    const hidden = {
      ...free,
      pages: free.pages.map((page, index) =>
        index !== 0
          ? page
          : {
              ...page,
              sections: page.sections.map((section) =>
                section.id !== "sec-cover"
                  ? section
                  : {
                      ...section,
                      content: section.content.map((element, i) =>
                        i === 0 ? { ...element, hidden: true } : element,
                      ),
                    },
              ),
            },
      ),
    };
    const after = designRows(hidden, "sec-cover");
    expect(after).toHaveLength(rows.length);
    expect(after.filter((row) => row.hidden)).toHaveLength(1);
  });

  it("numbers the rows of a slot that holds more than one", () => {
    const rows = designRows(free, "sec-cover").map((row) => row.label);
    // No duplicate label, whatever the preset holds — two rows called the same thing would make the
    // tree unusable for exactly the person this panel is for.
    expect(new Set(rows).size).toBe(rows.length);
  });
});

describe("selectedRowId — one answer, because two of them disagreed", () => {
  /**
   * The browser walk found this: the panel fell back to the first row so that opening «Diseño» had
   * something to step, the canvas outlined whatever the parent's state said, and the parent's state
   * was `null`. The numbers moved the headline while the page outlined nothing. One function now, and
   * both read it.
   */
  const rows = designRows(free, "sec-cover");

  it("answers the named row when it is there", () => {
    const second = rows[1]?.elementId as string;
    expect(selectedRowId(rows, second)).toBe(second);
  });

  it("falls back to the first row when nothing has been chosen", () => {
    expect(selectedRowId(rows, null)).toBe(rows[0]?.elementId);
  });

  it("falls back to the first row when the named one is gone", () => {
    // Reachable: reverting a section and designing it again re-mints nothing, but selecting an
    // element and then switching to another section leaves a name this section does not have.
    expect(selectedRowId(rows, "el-from-another-section")).toBe(rows[0]?.elementId);
  });

  it("is null only when there is nothing to lay out", () => {
    expect(selectedRowId([], "el-headline")).toBeNull();
    expect(selectedRowId(designRows(doc, "sec-cover"), null)).toBeNull();
  });
});

describe("boundsFor — rule 4, as the two limits it actually imposes", () => {
  it("couples moving right to the current span", () => {
    // A 4-wide element can start no later than column 9, because 9 + 4 - 1 is 12.
    expect(boundsFor(placement(1, 4)).column).toEqual({ min: 1, max: 9 });
    expect(boundsFor(placement(1, 12)).column).toEqual({ min: 1, max: 1 });
    expect(boundsFor(placement(1, 1)).column).toEqual({ min: 1, max: 12 });
  });

  it("couples widening to the current column", () => {
    expect(boundsFor(placement(9, 4)).columnSpan).toEqual({ min: 1, max: 4 });
    expect(boundsFor(placement(1, 4)).columnSpan).toEqual({ min: 1, max: 12 });
    expect(boundsFor(placement(12, 1)).columnSpan).toEqual({ min: 1, max: 1 });
  });

  it("never allows a value the verb would refuse, at any position in the grid", () => {
    // The two are the same rule seen from two sides, so the check worth having is the exhaustive
    // one: every legal starting placement, every arrow, and the verb never throws.
    const base = designRows(free, "sec-cover")[0]?.elementId as string;
    for (let column = 1; column <= 12; column += 1) {
      for (let columnSpan = 1; columnSpan <= 12 - column + 1; columnSpan += 1) {
        const at = setPlacement(free, "sec-cover", base, { column, columnSpan });
        const current = designRows(at, "sec-cover").find((row) => row.elementId === base)
          ?.placement as Placement;
        for (const field of ["column", "columnSpan", "row", "rowSpan"] as const) {
          for (const delta of [-1, 1]) {
            const next = stepTo(current, field, delta);
            if (next === undefined) continue;
            expect(
              () => setPlacement(at, "sec-cover", base, { [field]: next }),
              `${field} ${current[field]} → ${next} at column ${column} span ${columnSpan}`,
            ).not.toThrow();
          }
        }
      }
    }
  });

  it("caps the row for the interface's own reasons, not the schema's", () => {
    // The document model has no last row — a grid grows downwards, and `setPlacement` accepts row
    // 40. The cap exists so an arrow held down cannot walk an element off the bottom of a section
    // nobody can scroll to, and the test says which of the two it is.
    expect(boundsFor(placement(1, 1, MAX_ROW)).row).toEqual({ min: 1, max: MAX_ROW });
    expect(() =>
      setPlacement(free, "sec-cover", designRows(free, "sec-cover")[0]?.elementId as string, {
        row: MAX_ROW + 16,
      }),
    ).not.toThrow();
  });

  it("couples the row span to the row, so the two cannot walk past the cap together", () => {
    expect(boundsFor(placement(1, 1, MAX_ROW)).rowSpan).toEqual({ min: 1, max: 1 });
    expect(boundsFor(placement(1, 1, 1)).rowSpan).toEqual({ min: 1, max: MAX_ROW });
  });
});

describe("stepTo", () => {
  it("returns the next value when there is one", () => {
    expect(stepTo(placement(3, 4), "column", 1)).toBe(4);
    expect(stepTo(placement(3, 4), "column", -1)).toBe(2);
  });

  it("returns undefined at each end, which is how the arrow knows to be disabled", () => {
    expect(stepTo(placement(1, 4), "column", -1)).toBeUndefined();
    expect(stepTo(placement(9, 4), "column", 1)).toBeUndefined();
    expect(stepTo(placement(1, 12), "columnSpan", 1)).toBeUndefined();
    expect(stepTo(placement(1, 1), "columnSpan", -1)).toBeUndefined();
    expect(stepTo(placement(1, 1, 1), "row", -1)).toBeUndefined();
    expect(stepTo(placement(1, 1, MAX_ROW), "row", 1)).toBeUndefined();
  });

  it("does not clamp silently: a refused press is undefined, never the limit again", () => {
    // Clamping would make the arrow send the value it already had, which `setPlacement` answers by
    // returning the same document — correct, and invisible. The person would press an arrow that
    // looks enabled and nothing would happen, which is the dead button again.
    expect(stepTo(placement(9, 4), "column", 1)).not.toBe(9);
    expect(stepTo(placement(9, 4), "column", 1)).toBeUndefined();
  });
});

describe("mobileControlsFor — the three buttons of mockup 14", () => {
  /**
   * What the buttons need, and only that: their pressed state and whether each can do anything. The
   * order rule itself lives in `packages/schema` (`mobileSequence`), shared with the renderer so the
   * button and the published CSS cannot drift — the lesson `selectedRowId` above was written for.
   */
  const first = () => designRows(free, "sec-cover")[0]?.elementId as string;
  const second = () => designRows(free, "sec-cover")[1]?.elementId as string;

  it("is undefined for a section the catalog draws, which has no layout to patch", () => {
    // Not a disabled row of buttons: patches live inside `layout` and a catalog section has
    // `layout: null`. The panel shows the family only once the section is free.
    expect(mobileControlsFor(doc, "sec-cover", "el-headline")).toBeUndefined();
  });

  it("is undefined for an element the section does not have", () => {
    expect(mobileControlsFor(free, "sec-cover", "el-nope")).toBeUndefined();
  });

  it("starts unpressed and full width", () => {
    expect(mobileControlsFor(free, "sec-cover", first())).toMatchObject({
      hidden: false,
      narrowerTo: 9,
      span: 12,
    });
  });

  it("asks the derivation which element is first, not the tree", () => {
    // The two orders are different things, and conflating them was the day-6 defect. The tree lists
    // placements — headline, subheadline, text, button, photo on a cover — while the *mobile*
    // derivation puts the photograph first (`.rb-section > img { order: -1 }`, option A). So «Subir»
    // is dead on the photograph and alive on the headline, which is the opposite of what reading the
    // tree would say.
    const photo = designRows(free, "sec-cover").find((row) => row.label === "Foto")?.elementId;
    if (!photo) throw new Error("the cover fixture lost its photo");
    expect(mobileControlsFor(free, "sec-cover", photo)?.canMoveUp).toBe(false);
    expect(mobileControlsFor(free, "sec-cover", first())?.canMoveUp).toBe(true);
    expect(mobileControlsFor(free, "sec-cover", second())?.canMoveUp).toBe(true);
  });

  it("reports «Ocultar aquí» as pressed once the element is hidden on mobile", () => {
    const hidden = setMobilePatch(free, "sec-cover", first(), { hidden: true });
    expect(mobileControlsFor(hidden, "sec-cover", first())?.hidden).toBe(true);
  });

  it("steps the width down the control's own list, and stops at the narrowest", () => {
    // Not every twelfth: a step of one twelfth is invisible, and three quarters, a half and a
    // quarter is the range somebody actually wants for a photograph.
    let at = free;
    const seen: (number | undefined)[] = [];
    for (let press = 0; press < 5; press += 1) {
      const controls = mobileControlsFor(at, "sec-cover", first());
      seen.push(controls?.span);
      if (controls?.narrowerTo === undefined) break;
      at = setMobilePatch(at, "sec-cover", first(), { columnSpan: controls.narrowerTo });
    }
    expect(seen).toEqual([12, 9, 6, 3]);
    expect(mobileControlsFor(at, "sec-cover", first())?.narrowerTo).toBeUndefined();
  });

  it("still steps down from a width nobody's button produced", () => {
    // A span written by hand, or by a control that does not exist yet. The button means something
    // rather than refusing: it goes to the widest entry narrower than the one in force.
    const odd = setMobilePatch(free, "sec-cover", first(), { columnSpan: 8 });
    expect(mobileControlsFor(odd, "sec-cover", first())).toMatchObject({
      span: 8,
      narrowerTo: 6,
    });
  });

  it("is at its narrowest for a hand-written span below the list", () => {
    const tiny = setMobilePatch(free, "sec-cover", first(), { columnSpan: 2 });
    expect(mobileControlsFor(tiny, "sec-cover", first())?.narrowerTo).toBeUndefined();
  });

  it("follows the order the renderer will publish", () => {
    // The two must agree, and they agree because they are the same function (`mobileSequence`, in
    // `packages/schema`). Moving the headline up past the photograph makes the headline first, so its
    // «Subir» goes dead and the photograph's comes alive — the exact opposite of a moment earlier.
    const swapped = moveUpOnMobile(free, "sec-cover", first());
    const photo = designRows(free, "sec-cover").find((row) => row.label === "Foto")?.elementId;
    if (!photo) throw new Error("the cover fixture lost its photo");
    expect(mobileControlsFor(swapped, "sec-cover", first())?.canMoveUp).toBe(false);
    expect(mobileControlsFor(swapped, "sec-cover", photo)?.canMoveUp).toBe(true);
  });
});
