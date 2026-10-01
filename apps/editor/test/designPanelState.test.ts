import { presetFor } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import {
  deleteSection,
  escalateSection,
  findSection,
  type PresetShape,
  type RetorikaDocument,
  revertSection,
  type Section,
  type SectionLayout,
  setPlacement,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { designPanelState, designRows } from "../src/editor/designTree.ts";

/**
 * Which of four things the «Diseño» panel says, and in particular when it offers «Diseñar a mano».
 *
 * **This is the state ADR 0025's amendment is about.** Until 1 October 2026 a catalog-placed section
 * got a paragraph telling its owner to find that offer *on the section's header*, and no way to take
 * it — a dead end naming its own exit. Session 3 found an owner who turned the tools on, was told by
 * this panel that the grid existed, and still asked for «más libertad en la posición».
 *
 * The reason it is a function and not a chain of ternaries in the JSX is the `noPlaceable` case
 * below: deciding on the row count instead of on `source` would offer to hand-design a section that
 * already is one.
 */

function site(): RetorikaDocument {
  return generate({
    ...EMPTY_ANSWERS,
    businessName: "Peluquería Vega",
    sector: "peluqueria-barberia" as const,
    services: ["Corte"],
    address: "Calle Espinel 12, Ronda",
    mainAction: "call" as const,
    phone: "600111222",
  }).document;
}

/** Narrowing helpers rather than `!`: a fixture that is not what the test assumes should say so
 * here, with the reason, instead of failing later on a property of `undefined`. */
function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`fixture: no ${what}`);
  return value;
}

function firstSectionId(doc: RetorikaDocument): string {
  const page = need(doc.pages[0], "first page");
  return need(page.sections[0], "first section").id;
}

/** The preset `escalateSection` and `revertSection` both need, read off the section itself. */
function presetOf(doc: RetorikaDocument, sectionId: string): PresetShape {
  const found = need(findSection(doc, sectionId), `section "${sectionId}"`);
  return presetFor(found.section.preset.catalogId);
}

describe("designPanelState", () => {
  it("says nothing is selected when nothing is", () => {
    expect(designPanelState(site(), null)).toBe("noSection");
  });

  it("offers «Diseñar a mano» for a section the catalog places", () => {
    const doc = site();
    expect(designPanelState(doc, firstSectionId(doc))).toBe("offerEscalate");
  });

  it("offers it for every section of a freshly generated site, which is the point", () => {
    // The owner of session 3 turned the tools on and opened this panel. Whichever section he picked,
    // he met the dead end — there was no other state to be in.
    const doc = site();
    for (const page of doc.pages) {
      for (const section of page.sections) {
        expect(designPanelState(doc, section.id), section.id).toBe("offerEscalate");
      }
    }
  });

  it("shows the tree once the section is hand-designed", () => {
    const doc = site();
    const id = firstSectionId(doc);
    expect(designPanelState(escalateSection(doc, id, presetOf(doc, id)), id)).toBe("tree");
  });

  it("goes back to offering it after a return to the catalog's layout", () => {
    // ADR 0025 §7: the return is one click, and it has to put the panel back where it was.
    const doc = site();
    const id = firstSectionId(doc);
    const preset = presetOf(doc, id);
    const escalated = escalateSection(doc, id, preset);
    expect(designPanelState(revertSection(escalated, id, preset), id)).toBe("offerEscalate");
  });

  it("still shows the tree after an element has actually been moved", () => {
    const doc = site();
    const id = firstSectionId(doc);
    const escalated = escalateSection(doc, id, presetOf(doc, id));
    const first = need(designRows(escalated, id)[0], "a placeable row");
    const moved = setPlacement(escalated, id, first.elementId, { column: 2 });
    expect(designPanelState(moved, id)).toBe("tree");
  });

  it("never offers to hand-design a section that already is one, however few rows it has", () => {
    /**
     * The distinction that made this worth extracting. `designRows` leaves out a placement pointing
     * at a **nested** element — deliberately, so a Spanish screen never shows a raw id — so a
     * hand-designed section can have a layout and no rows. Deciding on the row count would then put
     * «Diseñar a mano» in front of somebody who has already pressed it.
     *
     * Built by hand because no click produces it, which is the same honesty `revertReach.test.ts`
     * applies to its surplus branch: unreachable through the interface today, one missing check from
     * real, and not dead code.
     */
    const doc = site();
    const id = firstSectionId(doc);
    const escalated = escalateSection(doc, id, presetOf(doc, id));
    const page = need(escalated.pages[0], "first page");
    const section = need(
      page.sections.find((candidate) => candidate.id === id),
      `section "${id}"`,
    );
    const layout = need(section.layout, "the layout escalation copies in");
    // Written out rather than spread: spreading into a literal makes `grid` optional under
    // `exactOptionalPropertyTypes`, and `SectionLayout` requires it.
    const starvedLayout: SectionLayout = {
      grid: layout.grid,
      placements: [],
      breakpoints: layout.breakpoints,
    };
    const starved: RetorikaDocument = {
      ...escalated,
      pages: [
        {
          ...page,
          // Annotated, because the two branches of the map otherwise widen into a union whose
          // optional fields no longer satisfy `Section`.
          sections: page.sections.map(
            (candidate): Section =>
              candidate.id !== id ? candidate : { ...candidate, layout: starvedLayout },
          ),
        },
        ...escalated.pages.slice(1),
      ],
    };
    expect(section.source).toBe("free");
    expect(designRows(starved, id)).toEqual([]);
    expect(designPanelState(starved, id)).toBe("noPlaceable");
  });

  it("answers noSection for a section the document no longer has", () => {
    /**
     * Found by writing this test's name before its expectation, and reachable: `designSectionId` is
     * set from a canvas click and never cleared, so deleting the section the «Diseño» panel is open
     * on leaves it pointing at a ghost. `isHandDesigned` answers `false` for a ghost, so the panel
     * offered «Diseñar a mano» for a section that was not there — and `escalateSection` throws on a
     * missing id, which made it a dead button that looked alive.
     */
    expect(designPanelState(site(), "sec-does-not-exist")).toBe("noSection");
  });

  it("answers noSection for a section that was really deleted", () => {
    const doc = site();
    const id = firstSectionId(doc);
    const without = deleteSection(doc, id);
    expect(findSection(without, id)).toBeUndefined();
    expect(designPanelState(without, id)).toBe("noSection");
  });
});
