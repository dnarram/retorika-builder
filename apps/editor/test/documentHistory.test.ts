import { blankItem, blankSection } from "@retorika/catalog";
import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import { recordById } from "@retorika/photobank";
import {
  type ElementAddress,
  type MeasuredBox,
  type OwnFont,
  parseDocument,
  type RetorikaDocument,
  type Theme,
} from "@retorika/schema";
import {
  buildTheme,
  type FontKey,
  STARTING_PALETTE_ID,
  withFamily,
  withOwnFont,
} from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  type Histories,
  type History,
  type HistoryAction,
  historiesReducer,
  initHistories,
  wasPlacementEverMoved,
  wasSectionEverEdited,
} from "../src/editor/documentHistory.ts";

const ANSWERS = {
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["Comidas", "Cenas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
};

const HEADLINE: ElementAddress = { sectionId: "sec-cover", elementId: "el-headline" };
const SUBHEADLINE: ElementAddress = { sectionId: "sec-cover", elementId: "el-subheadline" };

function start(): Histories {
  return initHistories(generateVariants(ANSWERS).map((site) => site.document));
}

/** The headline of variant 0, which every test below reads back. */
function headline(state: Histories, variant = 0): string | undefined {
  const document = state[variant]?.present.document;
  const section = document?.pages[0]?.sections.find((s) => s.id === "sec-cover");
  const element = section?.content.find((el) => el.id === "el-headline");
  return element?.value?.kind === "text" ? element.value.text : undefined;
}

function sectionIds(state: Histories, variant = 0): (string | undefined)[] | undefined {
  return state[variant]?.present.document.pages[0]?.sections.map((s) => s.id);
}

function run(state: Histories, ...actions: HistoryAction[]): Histories {
  return actions.reduce(historiesReducer, state);
}

const edit = (text: string, address: ElementAddress = HEADLINE): HistoryAction => ({
  type: "editText",
  variant: 0,
  address,
  text,
});

const del = (sectionId: string, variant = 0): HistoryAction => ({
  type: "deleteSection",
  variant,
  sectionId,
});

describe("initHistories", () => {
  it("starts one history per variant, with nothing to undo", () => {
    const state = start();
    expect(state).toHaveLength(3);
    for (const history of state) {
      expect(history.past).toEqual([]);
      expect(history.future).toEqual([]);
      expect(history.present.cause).toBeNull();
    }
  });
});

describe("editText", () => {
  it("moves the present forward and leaves the previous document to go back to", () => {
    const state = run(start(), edit("Taberna renovada"));
    expect(headline(state)).toBe("Taberna renovada");
    expect(state[0]?.past).toHaveLength(1);
  });

  it("collapses a run of edits to the same field into one step", () => {
    const state = run(start(), edit("T"), edit("Ta"), edit("Tab"));
    expect(headline(state)).toBe("Tab");
    expect(state[0]?.past).toHaveLength(1);
    expect(headline(historiesReducer(state, { type: "undo", variant: 0 }))).toBe(
      "Taberna Santo Domingo",
    );
  });

  it("keeps edits to different fields as separate steps", () => {
    const state = run(start(), edit("Nuevo titular"), edit("Nuevo subtítulo", SUBHEADLINE));
    expect(state[0]?.past).toHaveLength(2);
  });

  it("touches only the variant it names", () => {
    const state = run(start(), edit("Solo la primera"));
    expect(headline(state, 0)).toBe("Solo la primera");
    expect(headline(state, 1)).toBe("Taberna Santo Domingo");
    expect(state[1]?.past).toEqual([]);
  });

  it("is not a step when the field already says it, which is what a stray blur is", () => {
    // **Found by sprint 12's day-7 walk.** The fields panel commits on every blur, so clicking into
    // a box and clicking out of it — typing nothing — reached here. Every other verb in this file
    // already refused a step that undoes to itself; this one did not.
    const before = start();
    const after = run(before, edit("Taberna Santo Domingo"));
    expect(after[0]).toBe(before[0]);
    expect(after[0]?.past).toEqual([]);
  });

  it("does not throw away the redo stack for a commit that changes nothing", () => {
    // The half that made it a trap rather than a blemish: an undo, then a stray click into a field,
    // and the redo was gone. Measured in a browser with «Rehacer» going dark.
    const edited = run(start(), edit("Taberna renovada"));
    const undone = historiesReducer(edited, { type: "undo", variant: 0 });
    expect(undone[0]?.future).toHaveLength(1);

    const touched = historiesReducer(undone, {
      type: "editText",
      variant: 0,
      address: HEADLINE,
      text: "Taberna Santo Domingo",
    });
    expect(touched[0]?.future).toHaveLength(1);
    expect(headline(historiesReducer(touched, { type: "redo", variant: 0 }))).toBe(
      "Taberna renovada",
    );
  });

  it("is still a step when only the marks moved, because that is a real change", () => {
    const marked = historiesReducer(start(), {
      type: "editText",
      variant: 0,
      address: HEADLINE,
      text: "Taberna Santo Domingo",
      marks: [{ mark: "strong", from: 0, to: 7 }],
    });
    expect(marked[0]?.past).toHaveLength(1);
  });

  it("throws on an address the document does not have", () => {
    expect(() =>
      historiesReducer(start(), edit("x", { sectionId: "sec-cover", elementId: "no-such" })),
    ).toThrow(/no element/);
  });
});

describe("undo and redo", () => {
  it("goes back, then forward again, to the same text", () => {
    const edited = run(start(), edit("Taberna renovada"));
    const undone = historiesReducer(edited, { type: "undo", variant: 0 });
    expect(headline(undone)).toBe("Taberna Santo Domingo");
    const redone = historiesReducer(undone, { type: "redo", variant: 0 });
    expect(headline(redone)).toBe("Taberna renovada");
  });

  it("walks back through several separate steps in order", () => {
    let state = run(start(), edit("Uno"), edit("Dos", SUBHEADLINE), edit("Tres"));
    expect(state[0]?.past).toHaveLength(3);
    state = historiesReducer(state, { type: "undo", variant: 0 });
    expect(headline(state)).toBe("Uno");
    state = historiesReducer(state, { type: "undo", variant: 0 });
    expect(headline(state)).toBe("Uno");
    state = historiesReducer(state, { type: "undo", variant: 0 });
    expect(headline(state)).toBe("Taberna Santo Domingo");
  });

  it("is a no-op, down to the same state object, with nothing to undo or redo", () => {
    const state = start();
    expect(historiesReducer(state, { type: "undo", variant: 0 })).toBe(state);
    expect(historiesReducer(state, { type: "redo", variant: 0 })).toBe(state);
  });

  it("drops what was undone as soon as a new edit lands", () => {
    const undone = historiesReducer(run(start(), edit("Descartada")), { type: "undo", variant: 0 });
    expect(undone[0]?.future).toHaveLength(1);
    const forked = historiesReducer(undone, edit("La que se queda"));
    expect(forked[0]?.future).toEqual([]);
    expect(headline(forked)).toBe("La que se queda");
  });

  it("does not merge an edit into the step it just undid", () => {
    // Undo is an action between the two edits, so retyping the same field opens a new step
    // rather than amending the one that was undone away.
    const undone = historiesReducer(run(start(), edit("Primera")), { type: "undo", variant: 0 });
    const again = historiesReducer(undone, edit("Segunda"));
    expect(again[0]?.past).toHaveLength(1);
    expect(headline(historiesReducer(again, { type: "undo", variant: 0 }))).toBe(
      "Taberna Santo Domingo",
    );
  });

  it("undoes in one variant without disturbing another", () => {
    let state = run(start(), edit("Primera"));
    state = historiesReducer(state, {
      type: "editText",
      variant: 1,
      address: HEADLINE,
      text: "Segunda",
    });
    state = historiesReducer(state, { type: "undo", variant: 0 });
    expect(headline(state, 0)).toBe("Taberna Santo Domingo");
    expect(headline(state, 1)).toBe("Segunda");
  });
});

describe("the fifty-step limit", () => {
  it("keeps the fifty most recent steps and drops the oldest", () => {
    const addresses = [HEADLINE, SUBHEADLINE];
    let state: Histories = start();
    // Alternating fields so each edit is its own step rather than collapsing into one.
    for (let i = 0; i < 60; i += 1) {
      const address = addresses[i % 2];
      if (!address) throw new Error("unreachable");
      state = historiesReducer(state, edit(`texto ${i}`, address));
    }
    expect(state[0]?.past).toHaveLength(50);

    let unwound: Histories = state;
    for (let i = 0; i < 50; i += 1) {
      unwound = historiesReducer(unwound, { type: "undo", variant: 0 });
    }
    // Fifty steps back is as far as it goes: the original text is past the edge.
    expect(headline(unwound)).not.toBe("Taberna Santo Domingo");
    expect(unwound[0]?.past).toEqual([]);
  });
});

describe("the documents themselves", () => {
  it("never mutates the document it started from", () => {
    const state = start();
    const before: RetorikaDocument | undefined = state[0]?.present.document;
    const snapshot = JSON.stringify(before);
    run(state, edit("Cambiada"), edit("Otra vez", SUBHEADLINE));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("deleteSection", () => {
  it("removes the named section from the document, and can be undone", () => {
    const before = sectionIds(start());
    const state = run(start(), del("sec-services"));
    expect(sectionIds(state)).toEqual(before?.filter((id) => id !== "sec-services"));
    const undone = historiesReducer(state, { type: "undo", variant: 0 });
    expect(sectionIds(undone)).toEqual(before);
  });

  it("touches only the variant it names", () => {
    const state = run(start(), del("sec-services"));
    expect(sectionIds(state, 1)).toEqual(sectionIds(start(), 1));
  });

  it("is always its own step, never collapsed with an adjacent edit", () => {
    const state = run(start(), edit("Nuevo titular"), del("sec-services"));
    expect(state[0]?.past).toHaveLength(2);
  });

  it("throws on a section id the document does not have", () => {
    expect(() => historiesReducer(start(), del("no-such-section"))).toThrow(/no section/);
  });
});

/**
 * Whether anybody laid a section out by hand — the question the return dialog asks and the document
 * can no longer answer (ADR 0050, sprint 25 día 2: escalation measures the live page, so a fresh
 * layout equals no re-derivation of the catalog's drawing).
 */
/**
 * **A text's rows are nobody's to rewrite on a commit** (ADR 0050, amendment of sprint 28 día 7).
 *
 * From sprint 25 día 6 to sprint 28 día 7 `editText` carried a measured `rowSpan` with the words,
 * so that a free section's rows stayed eight pixels in the editor. Measured at 1280 with «Diseño»
 * open, that wrote a two-line headline's rows for the width the panel had made, and the panel's
 * closing left six empty rows between it and the subheadline. A span is a minimum and the row grows
 * to its content, in the editor and on the published page alike.
 */
describe("editText leaves a text's rows alone", () => {
  const escalate = (sectionId = "sec-cover"): HistoryAction => ({
    type: "escalateSection",
    variant: 0,
    sectionId,
  });
  const free = () => run(start(), escalate());
  const placementOf = (state: Histories, elementId = "el-headline") =>
    state[0]?.present.document.pages[0]?.sections
      .find((section) => section.id === "sec-cover")
      ?.layout?.placements.find((placement) => placement.elementId === elementId);
  /** The headline's own words, as the document holds them. */
  const wordsOf = (state: Histories) => {
    const element = state[0]?.present.document.pages[0]?.sections
      .find((section) => section.id === "sec-cover")
      ?.content.find((candidate) => candidate.id === "el-headline");
    return element?.value?.kind === "text" ? element.value.text : "";
  };
  const typeInto = (text: string): HistoryAction => ({
    type: "editText",
    variant: 0,
    address: HEADLINE,
    text,
  });

  it("writes the words and not the placement, and one undo takes the words back", () => {
    const before = free();
    const was = placementOf(before);
    expect(was?.rowSpan, "la portada escalada no trajo filas").toBeGreaterThan(0);

    const after = run(before, typeInto("Un titular que ocupa dos líneas en cualquier ancho"));
    expect(wordsOf(after)).toBe("Un titular que ocupa dos líneas en cualquier ancho");
    expect(placementOf(after)).toEqual(was);

    const undone = historiesReducer(after, { type: "undo", variant: 0 });
    expect(undone[0]?.present.document).toEqual(before[0]?.present.document);
  });

  it("opens no step at all when the words did not change", () => {
    const before = free();
    expect(run(before, typeInto(wordsOf(before)))).toBe(before);
  });

  it("is the same for a section the catalog draws, which has no placements", () => {
    const state = run(start(), typeInto("Nuevo titular"));
    const section = state[0]?.present.document.pages[0]?.sections.find((s) => s.id === "sec-cover");
    expect(section?.layout).toBeNull();
    expect(section?.content.find((e) => e.id === "el-headline")?.value).toMatchObject({
      text: "Nuevo titular",
    });
  });
});

describe("wasPlacementEverMoved", () => {
  const escalate = (sectionId = "sec-cover"): HistoryAction => ({
    type: "escalateSection",
    variant: 0,
    sectionId,
  });
  const firstPlaced = (state: Histories, sectionId = "sec-cover") =>
    state[0]?.present.document.pages[0]?.sections.find((s) => s.id === sectionId)?.layout
      ?.placements[0]?.elementId as string;
  const move = (state: Histories, sectionId = "sec-cover"): HistoryAction => ({
    type: "setPlacement",
    variant: 0,
    sectionId,
    elementId: firstPlaced(state, sectionId),
    edit: { column: 9 },
  });

  it("is false for a section fresh from the generator", () => {
    expect(wasPlacementEverMoved(start()[0] as Histories[number], "sec-cover")).toBe(false);
  });

  it("is false for a section escalated and left alone, which is what makes the return silent", () => {
    const state = run(start(), escalate());
    expect(wasPlacementEverMoved(state[0] as Histories[number], "sec-cover")).toBe(false);
  });

  it("is true once an element has been moved in it", () => {
    const free = run(start(), escalate());
    const moved = run(free, move(free));
    expect(wasPlacementEverMoved(moved[0] as Histories[number], "sec-cover")).toBe(true);
  });

  it("is false for another section, and for one whose content was merely edited", () => {
    const free = run(start(), escalate());
    const moved = run(free, move(free));
    expect(wasPlacementEverMoved(moved[0] as Histories[number], "sec-services")).toBe(false);
    const typed = run(start(), edit("Nuevo titular"));
    expect(wasPlacementEverMoved(typed[0] as Histories[number], "sec-cover")).toBe(false);
  });

  it("stays true after the move is undone, which is the safe side of the only wrong answer", () => {
    // The dialog warns about work that was done; undoing one move does not make the section one
    // nobody laid out. Over-warning costs a click, under-warning costs the work.
    const free = run(start(), escalate());
    const moved = run(free, move(free));
    const undone = historiesReducer(moved, { type: "undo", variant: 0 });
    expect(wasPlacementEverMoved(undone[0] as Histories[number], "sec-cover")).toBe(true);
  });
});

describe("wasSectionEverEdited", () => {
  it("is false for a section fresh from the generator", () => {
    const state = start();
    expect(wasSectionEverEdited(state[0] as Histories[number], "sec-cover")).toBe(false);
  });

  it("is true once a field inside the section has been edited", () => {
    const state = run(start(), edit("Nuevo titular"));
    expect(wasSectionEverEdited(state[0] as Histories[number], "sec-cover")).toBe(true);
  });

  it("is false for a section other than the one edited", () => {
    const state = run(start(), edit("Nuevo titular")); // el-headline lives in sec-cover
    expect(wasSectionEverEdited(state[0] as Histories[number], "sec-services")).toBe(false);
  });

  it("stays true even after the edit that caused it is undone", () => {
    // The section was, at some point in this session, written by the user — undoing that one
    // edit does not retroactively make it untouched.
    const edited = run(start(), edit("Nuevo titular"));
    const undone = historiesReducer(edited, { type: "undo", variant: 0 });
    expect(wasSectionEverEdited(undone[0] as Histories[number], "sec-cover")).toBe(true);
  });

  it("is false for a section only ever deleted and restored, never edited", () => {
    // Narrower on purpose: ADR 0014 asks about content the user *wrote*. Being deleted and
    // undone is a structural action, not a write, so it must not make the next delete's toast
    // persist on its own — only actual text edits do that.
    const deleted = run(start(), del("sec-services"));
    const undone = historiesReducer(deleted, { type: "undo", variant: 0 });
    expect(wasSectionEverEdited(undone[0] as Histories[number], "sec-services")).toBe(false);
  });

  it("is false for the original side of a duplicate: copying it does not edit it", () => {
    const duplicated = historiesReducer(start(), {
      type: "duplicateSection",
      variant: 0,
      sectionId: "sec-services",
    });
    expect(wasSectionEverEdited(duplicated[0] as Histories[number], "sec-services")).toBe(false);
  });
});

describe("duplicateSection", () => {
  it("inserts a copy right after the original", () => {
    const before = sectionIds(start());
    const state = historiesReducer(start(), {
      type: "duplicateSection",
      variant: 0,
      sectionId: "sec-cover",
    });
    const at = before?.indexOf("sec-cover") ?? -1;
    expect(sectionIds(state)).toEqual([
      ...(before?.slice(0, at + 1) ?? []),
      "sec-cover-2",
      ...(before?.slice(at + 1) ?? []),
    ]);
  });

  it("can be undone back to the original count", () => {
    const before = sectionIds(start());
    const duplicated = historiesReducer(start(), {
      type: "duplicateSection",
      variant: 0,
      sectionId: "sec-cover",
    });
    const undone = historiesReducer(duplicated, { type: "undo", variant: 0 });
    expect(sectionIds(undone)).toEqual(before);
  });

  it("touches only the variant it names", () => {
    const state = historiesReducer(start(), {
      type: "duplicateSection",
      variant: 0,
      sectionId: "sec-cover",
    });
    expect(sectionIds(state, 1)).toEqual(sectionIds(start(), 1));
  });

  it("throws on a section id the document does not have", () => {
    expect(() =>
      historiesReducer(start(), { type: "duplicateSection", variant: 0, sectionId: "no-such" }),
    ).toThrow(/no section/);
  });
});

describe("moveSection", () => {
  it("moves a section to the given index", () => {
    const state = historiesReducer(start(), {
      type: "moveSection",
      variant: 0,
      sectionId: "sec-cover",
      toIndex: 3,
    });
    expect(sectionIds(state)?.[0]).not.toBe("sec-cover");
    expect(sectionIds(state)).toContain("sec-cover");
  });

  it("can be undone back to the original order", () => {
    const before = sectionIds(start());
    const moved = historiesReducer(start(), {
      type: "moveSection",
      variant: 0,
      sectionId: "sec-cover",
      toIndex: 3,
    });
    const undone = historiesReducer(moved, { type: "undo", variant: 0 });
    expect(sectionIds(undone)).toEqual(before);
  });

  it("throws on a section id the document does not have", () => {
    expect(() =>
      historiesReducer(start(), {
        type: "moveSection",
        variant: 0,
        sectionId: "no-such",
        toIndex: 0,
      }),
    ).toThrow(/no section/);
  });
});

describe("insertSection", () => {
  const blank = () => blankSection("location", "stacked", "sec-location");

  it("puts the section where the pill was clicked", () => {
    const state = run(start(), {
      type: "insertSection",
      variant: 0,
      section: blank(),
      index: 1,
      pageId: "home",
    });
    expect(sectionIds(state)?.[1]).toBe("sec-location-2");
  });

  it("re-mints an id the document already uses, rather than colliding with it", () => {
    // The generated site already has a "sec-location": what the caller hands over is a
    // template's id, and only the document knows which ones are free.
    const state = run(start(), {
      type: "insertSection",
      variant: 0,
      section: blank(),
      index: 0,
      pageId: "home",
    });
    expect(sectionIds(state)?.[0]).toBe("sec-location-2");
  });

  it("keeps re-minting when the same section is added twice in a row", () => {
    const state = run(
      start(),
      { type: "insertSection", variant: 0, section: blank(), index: 0, pageId: "home" },
      { type: "insertSection", variant: 0, section: blank(), index: 0, pageId: "home" },
    );
    const ids = sectionIds(state) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 2)).toEqual(["sec-location-3", "sec-location-2"]);
  });

  it("uses an unused id verbatim when nothing is in the way", () => {
    const state = run(start(), {
      type: "insertSection",
      variant: 0,
      section: blankSection("cover", "image-right", "sec-portada"),
      index: 0,
      pageId: "home",
    });
    expect(sectionIds(state)?.[0]).toBe("sec-portada");
  });

  it("is undone as one step, putting the page back exactly as it was", () => {
    const before = sectionIds(start());
    const state = run(
      start(),
      { type: "insertSection", variant: 0, section: blank(), index: 1, pageId: "home" },
      { type: "undo", variant: 0 },
    );
    expect(sectionIds(state)).toEqual(before);
  });

  it("is redone after an undo", () => {
    const state = run(
      start(),
      { type: "insertSection", variant: 0, section: blank(), index: 1, pageId: "home" },
      { type: "undo", variant: 0 },
      { type: "redo", variant: 0 },
    );
    expect(sectionIds(state)?.[1]).toBe("sec-location-2");
  });

  it("names the section it added, under the id it actually minted", () => {
    const state = run(start(), {
      type: "insertSection",
      variant: 0,
      section: blank(),
      index: 1,
      pageId: "home",
    });
    expect(state[0]?.present.cause).toEqual({
      type: "insertSection",
      sectionId: "sec-location-2",
    });
  });

  it("touches only the variant it names", () => {
    const state = run(start(), {
      type: "insertSection",
      variant: 0,
      section: blank(),
      index: 0,
      pageId: "home",
    });
    expect(sectionIds(state, 1)).toEqual(sectionIds(start(), 1));
  });

  it("does not count as having edited the new section: nothing was written into it", () => {
    // Marker text is what the catalog put there, not what the user typed, so a delete's undo
    // toast should fade for it like any untouched section (ADR 0014).
    const state = run(start(), {
      type: "insertSection",
      variant: 0,
      section: blank(),
      index: 1,
      pageId: "home",
    });
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-location-2")).toBe(false);
  });
});

describe("setImage", () => {
  const COVER_IMAGE: ElementAddress = { sectionId: "sec-cover", elementId: "el-image" };
  // Narrowed rather than typed as the whole union: the throw case below spreads it and replaces
  // one field, which on a union widens to a member that has no `address` at all.
  const upload = (): Extract<HistoryAction, { type: "setImage" }> => ({
    type: "setImage",
    variant: 0,
    address: COVER_IMAGE,
    src: "foto-sec-cover.jpg",
    alt: "Foto de Taberna Santo Domingo",
  });

  function image(state: Histories, variant = 0) {
    const section = state[variant]?.present.document.pages[0]?.sections.find(
      (s) => s.id === "sec-cover",
    );
    const element = section?.content.find((el) => el.id === "el-image");
    return element?.value?.kind === "image" ? element.value : undefined;
  }

  it("points the cover at the uploaded file", () => {
    expect(image(run(start(), upload()))?.src).toBe("foto-sec-cover.jpg");
  });

  it("replaces the alt the photograph arrived with, whoever it described", () => {
    // Until 8 October 2026 this read «Marcador de foto: aquí irá tu foto», because the bank was
    // empty and every cover was the catalog's marker. The fixture's sector now has photographs, so
    // it starts from a bank record's own alt instead — and the claim is the same either way: an
    // alt describing a photograph that is not the owner's cannot survive the owner's arriving.
    const before = image(start());
    expect(before?.sample, "the fixture's cover is no longer a bank photograph").toBeDefined();
    expect(before?.alt).toBe(recordById(before?.sample ?? "")?.alt);
    expect(before?.alt).not.toBe("Foto de Taberna Santo Domingo");
    expect(image(run(start(), upload()))?.alt).toBe("Foto de Taberna Santo Domingo");
  });

  it("is one step: undo restores both the src and the alt", () => {
    const before = image(start());
    const state = run(start(), upload(), { type: "undo", variant: 0 });
    expect(image(state)).toEqual(before);
  });

  it("is redone after an undo", () => {
    const state = run(
      start(),
      upload(),
      { type: "undo", variant: 0 },
      { type: "redo", variant: 0 },
    );
    expect(image(state)?.src).toBe("foto-sec-cover.jpg");
  });

  it("does not merge with a text edit on its way in", () => {
    // Different fields, different steps — the coalescing rule is about typing into one field.
    const state = run(start(), edit("Otro nombre"), upload());
    expect(state[0]?.past).toHaveLength(2);
  });

  it("touches only the variant it names", () => {
    const state = run(start(), upload());
    expect(image(state, 1)?.src).toBe(image(start(), 1)?.src);
  });

  it("counts as having touched the section, so a delete's toast stays put", () => {
    // ADR 0014 keeps the toast on screen for a section the owner put something into. Uploading
    // a photo is the most deliberate thing anyone does here; losing one to a six-second fade
    // would be worse than losing a sentence.
    const state = run(start(), upload());
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(true);
  });

  it("throws for an element that is not an image", () => {
    expect(() =>
      run(start(), { ...upload(), address: { sectionId: "sec-cover", elementId: "el-headline" } }),
    ).toThrow(/no image element/);
  });
});

describe("setTheme", () => {
  /**
   * The verb behind Estilo. Built from real palette ids rather than a synthetic map, because that
   * is what the panel will do — and because a generated `restaurante-bar` starts in the neutral
   * palette with `classic-display` (ADR 0041; it was `warm-terracotta` until 13 October 2026), so
   * "the palette this site already uses" is a case these can actually reach.
   */
  const OWN = { paletteId: STARTING_PALETTE_ID, typePairId: "classic-display" };
  const OTHER = { paletteId: "classic-blue", typePairId: "modern-sans" };

  const restyle = (input: typeof OWN, variant = 0): HistoryAction => ({
    type: "setTheme",
    variant,
    theme: buildTheme(input),
  });

  const theme = (state: Histories, variant = 0) => state[variant]?.present.document.theme;

  it("restyles the whole site in one step", () => {
    const state = run(start(), restyle(OTHER));
    expect(theme(state)?.["color.primary"]).toBe("#1D4ED8");
    expect(theme(state)?.["font.heading"]).toMatch(/^Inter/);
    expect(state[0]?.past).toHaveLength(1);
  });

  it("is undone back to the theme the sector chose", () => {
    const before = theme(start());
    const state = run(start(), restyle(OTHER), { type: "undo", variant: 0 });
    expect(theme(state)).toEqual(before);
  });

  it("is redone after an undo", () => {
    const state = run(
      start(),
      restyle(OTHER),
      { type: "undo", variant: 0 },
      { type: "redo", variant: 0 },
    );
    expect(theme(state)?.["color.primary"]).toBe("#1D4ED8");
  });

  it("adds no step for the palette the site is already using", () => {
    // Otherwise the undo arrow lights up for a step that undoes to itself: press it and nothing
    // appears to happen. That the generator's own theme is reachable from two catalog ids is also
    // what will let the panel say which palette is the current one.
    const initial = start();
    const state = run(initial, restyle(OWN));
    // The reducer hands the very same state array back when a history did not move, which is what
    // stops React re-rendering the preview iframe for a click that changed nothing.
    expect(state).toBe(initial);
    expect(state[0]?.past).toHaveLength(0);
  });

  it("does not perform a redo, which is what a missing reducer branch used to do", () => {
    // The trap this pins: the reducer was a chain of ternaries ending in `: redo(history)`, so a
    // verb without its own branch type-checked and silently redid the future instead. Here the
    // future holds an undone edit; if `setTheme` fell through, that edit would come back and the
    // theme would not change. Both halves are asserted, because either alone could pass by luck.
    const state = run(
      start(),
      edit("Nombre editado"),
      { type: "undo", variant: 0 },
      restyle(OTHER),
    );
    expect(theme(state)?.["color.primary"]).toBe("#1D4ED8");
    expect(headline(state)).not.toBe("Nombre editado");
    expect(state[0]?.future).toHaveLength(0);
  });

  it("touches only the variant it names", () => {
    const state = run(start(), restyle(OTHER));
    expect(theme(state, 1)).toEqual(theme(start(), 1));
    expect(state[1]?.past).toHaveLength(0);
  });

  it("does not count as having edited any section, because it belongs to none", () => {
    // A theme change restyles every section at once, hand-designed ones included, so it is not
    // content the owner put into any one of them. ADR 0014's toast asks about content.
    const state = run(start(), restyle(OTHER));
    const history = state[0];
    if (!history) throw new Error("no history");
    for (const id of sectionIds(state) ?? []) {
      if (id) expect(wasSectionEverEdited(history, id), id).toBe(false);
    }
  });

  it("does not erase the record of an edit made before it", () => {
    const state = run(start(), edit("Nombre editado"), restyle(OTHER));
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(true);
  });

  it("does not merge with the typing around it", () => {
    const state = run(start(), edit("Uno"), restyle(OTHER), edit("Dos"));
    expect(state[0]?.past).toHaveLength(3);
  });

  it("throws on an incomplete theme rather than writing a hole into the document", () => {
    const { "color.ink": _dropped, ...partial } = buildTheme(OTHER);
    expect(() => run(start(), { type: "setTheme", variant: 0, theme: partial as Theme })).toThrow(
      /not a complete theme/,
    );
  });
});

describe("a letter chooser session, as one step", () => {
  /**
   * The three verbs behind the letter chooser (sprint 29 día 1). David's adjustment to the plan:
   * with forty rows and a live preview, walking down with the arrows would write forty steps — so
   * the first choice opens a step, the next ones amend it, «Hecho» closes it, and Escape returns
   * the letter that was there when the dialog opened.
   */
  const choose = (family: string, key: FontKey = "font.heading", variant = 0): HistoryAction => ({
    type: "chooseFamily",
    variant,
    key,
    theme: withFamily(headingOf(variant), key, family),
  });
  // `theme` of the *current* state is what `Variants` composes with; the helper above needs a state
  // to read it from, so the tests build the action inline where the state matters.
  let state: Histories = start();
  const headingOf = (variant: number) => {
    const current = state[variant]?.present.document.theme;
    if (!current) throw new Error("no theme");
    return current;
  };
  const heading = (s: Histories) => s[0]?.present.document.theme["font.heading"];
  const step = (family: string, key: FontKey = "font.heading") => {
    state = run(state, choose(family, key));
    return state;
  };
  const done = () => {
    state = run(state, { type: "settleChooser", variant: 0 });
    return state;
  };
  const cancel = () => {
    state = run(state, { type: "discardChooser", variant: 0 });
    return state;
  };
  const undo = () => {
    state = run(state, { type: "undo", variant: 0 });
    return state;
  };

  it("five choices in a row are one step, and one undo takes them all back", () => {
    state = start();
    const before = heading(state);
    for (const family of ["Bitter", "DM Sans", "EB Garamond", "Figtree", "Spectral"]) step(family);
    expect(heading(state)).toMatch(/^Spectral/);
    expect(state[0]?.past).toHaveLength(1);
    expect(state[0]?.amendable).toBe(true);
    expect(heading(undo())).toBe(before);
  });

  it("«Hecho» closes the step, so the next choice opens its own", () => {
    state = start();
    step("Bitter");
    done();
    expect(state[0]?.amendable).toBe(false);
    step("Spectral");
    expect(state[0]?.past).toHaveLength(2);
    expect(heading(undo())).toMatch(/^Bitter/);
  });

  it("the other half is its own session, even while the first is still open", () => {
    state = start();
    step("Bitter");
    step("Spectral", "font.body");
    expect(state[0]?.past).toHaveLength(2);
    // And choosing for the headings again does not amend the body's step.
    step("Figtree");
    expect(state[0]?.past).toHaveLength(3);
  });

  it("Escape returns the letter that was there on open and leaves no step behind", () => {
    state = start();
    const before = heading(state);
    const depth = state[0]?.past.length ?? 0;
    step("Bitter");
    step("Spectral");
    cancel();
    expect(heading(state)).toBe(before);
    expect(state[0]?.past).toHaveLength(depth);
    expect(state[0]?.future).toHaveLength(0);
    expect(state[0]?.amendable).toBe(false);
  });

  it("Escape with nothing chosen touches nothing", () => {
    state = start();
    const before = state;
    expect(cancel()).toBe(before);
    expect(done()).toBe(before);
  });

  it("Escape does not reach back into a session «Hecho» already closed", () => {
    state = start();
    step("Bitter");
    done();
    cancel();
    expect(heading(state)).toMatch(/^Bitter/);
    expect(state[0]?.past).toHaveLength(1);
  });

  it("an undo pressed with the dialog open closes the session, so the next choice is a new step", () => {
    // `amendable` is what an undo turns off: the restored snapshot may well carry this very cause,
    // and amending it would turn the undo into an edit with nothing left to go back to.
    state = start();
    step("Bitter");
    done();
    step("Spectral");
    undo();
    expect(heading(state)).toMatch(/^Bitter/);
    step("Figtree");
    expect(state[0]?.past).toHaveLength(2);
    expect(heading(undo())).toMatch(/^Bitter/);
  });

  it("choosing the family the token already names is not a step", () => {
    state = start();
    // A generated `restaurante-bar` is on `classic-display`, which heads in EB Garamond — a gallery
    // family, so the chooser can ask for the letter the site already has.
    const before = state;
    expect(step("EB Garamond")).toBe(before);
  });

  it("is not a content cause and names no section", () => {
    state = start();
    step("Bitter");
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(false);
  });
});

describe("setVariant", () => {
  /** The cover ships `image-right`; `image-background` is the other composition the catalog has. */
  const compose = (variantId: string, sectionId = "sec-cover", variant = 0): HistoryAction => ({
    type: "setVariant",
    variant,
    sectionId,
    variantId,
  });

  const variantOf = (state: Histories, sectionId = "sec-cover", variant = 0) =>
    state[variant]?.present.document.pages[0]?.sections.find((s) => s.id === sectionId)?.preset
      .variantId;

  it("swaps the composition in one step", () => {
    const state = run(start(), compose("image-background"));
    expect(variantOf(state)).toBe("image-background");
    expect(state[0]?.past).toHaveLength(1);
  });

  it("moves no content, which is the whole reason it is cheap", () => {
    const before = start()[0]?.present.document.pages[0]?.sections.find(
      (s) => s.id === "sec-cover",
    )?.content;
    const state = run(start(), compose("image-background"));
    const after = state[0]?.present.document.pages[0]?.sections.find(
      (s) => s.id === "sec-cover",
    )?.content;
    expect(after).toEqual(before);
  });

  it("is undone back to the composition the generator chose", () => {
    const before = variantOf(start());
    const state = run(start(), compose("image-background"), { type: "undo", variant: 0 });
    expect(variantOf(state)).toBe(before);
  });

  it("is redone after an undo", () => {
    const state = run(
      start(),
      compose("image-background"),
      { type: "undo", variant: 0 },
      { type: "redo", variant: 0 },
    );
    expect(variantOf(state)).toBe("image-background");
  });

  it("adds no step for the composition the section is already drawn with", () => {
    const initial = start();
    const current = variantOf(initial);
    if (!current) throw new Error("the cover has no variant");
    const state = run(initial, compose(current));
    // Down to the same state object, so React does not re-render the preview for a click that
    // changed nothing.
    expect(state).toBe(initial);
    expect(state[0]?.past).toHaveLength(0);
  });

  it("does not perform a redo, which is what a missing reducer branch used to do", () => {
    // The trap day 1 defused, checked again for the second verb that arrived after it: the future
    // holds an undone edit, and if `setVariant` fell through to `redo` that edit would come back
    // and the composition would not change.
    const state = run(
      start(),
      edit("Nombre editado"),
      { type: "undo", variant: 0 },
      compose("image-background"),
    );
    expect(variantOf(state)).toBe("image-background");
    expect(headline(state)).not.toBe("Nombre editado");
    expect(state[0]?.future).toHaveLength(0);
  });

  it("touches only the variant it names", () => {
    const state = run(start(), compose("image-background"));
    expect(variantOf(state, "sec-cover", 1)).toBe(variantOf(start(), "sec-cover", 1));
    expect(state[1]?.past).toHaveLength(0);
  });

  it("does not count as having edited the section, because it writes nothing into it", () => {
    // ADR 0014's toast asks what the owner contributed. Trying two compositions on a section you
    // never wrote a word into must not keep a delete's toast on screen.
    const state = run(start(), compose("image-background"));
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(false);
  });

  it("does not erase the record of an edit made before it", () => {
    const state = run(start(), edit("Nombre editado"), compose("image-background"));
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(true);
  });

  it("does not merge with the typing around it", () => {
    const state = run(start(), edit("Uno"), compose("image-background"), edit("Dos"));
    expect(state[0]?.past).toHaveLength(3);
  });

  it("throws on a section the document does not have", () => {
    expect(() => run(start(), compose("stacked", "no-such-section"))).toThrow(/no section/);
  });
});

describe("addItem and removeItem", () => {
  /** The services list of variant 0, which the questionnaire filled with two cards. */
  const linesOf = (state: Histories, variant = 0) =>
    state[variant]?.present.document.pages[0]?.sections
      .find((s) => s.id === "sec-services")
      ?.content.find((el) => el.role === "list")?.items;

  const add = (variant = 0): HistoryAction => ({
    type: "addItem",
    variant,
    sectionId: "sec-services",
    slot: "services",
    item: blankItem("services"),
  });

  it("appends a line in one step", () => {
    const before = linesOf(start())?.length ?? 0;
    const state = run(start(), add());
    expect(linesOf(state)).toHaveLength(before + 1);
    expect(state[0]?.past).toHaveLength(1);
  });

  it("is undone back to the lines the questionnaire produced", () => {
    const before = linesOf(start());
    const state = run(start(), add(), { type: "undo", variant: 0 });
    expect(linesOf(state)).toEqual(before);
  });

  it("is redone after an undo", () => {
    const before = linesOf(start())?.length ?? 0;
    const state = run(start(), add(), { type: "undo", variant: 0 }, { type: "redo", variant: 0 });
    expect(linesOf(state)).toHaveLength(before + 1);
  });

  it("removes a named line and can be undone", () => {
    const added = run(start(), add());
    const last = linesOf(added)?.at(-1)?.id;
    if (!last) throw new Error("no line");
    const removed = run(added, {
      type: "removeItem",
      variant: 0,
      sectionId: "sec-services",
      slot: "services",
      itemId: last,
    });
    expect(linesOf(removed)?.some((item) => item.id === last)).toBe(false);
    const undone = run(removed, { type: "undo", variant: 0 });
    expect(linesOf(undone)?.some((item) => item.id === last)).toBe(true);
  });

  it("does not perform a redo, which is what a missing reducer branch used to do", () => {
    const state = run(start(), edit("Nombre editado"), { type: "undo", variant: 0 }, add());
    expect(headline(state)).not.toBe("Nombre editado");
    expect(state[0]?.future).toHaveLength(0);
  });

  it("touches only the variant it names", () => {
    const state = run(start(), add());
    expect(linesOf(state, 1)).toEqual(linesOf(start(), 1));
  });

  it("does not count as having edited the section: the line carries markers, not words", () => {
    const state = run(start(), add());
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-services")).toBe(false);
  });
});

describe("the page verbs", () => {
  /**
   * A document with three pages, built here rather than generated: the generator makes exactly one
   * page (`packages/generator/src/index.ts`), and a page is born by converting a section (ADR
   * 0022), which is a later day's verb. What these pin is the history's half of it.
   */
  function threePages(): Histories {
    const one = start()[0]?.present.document;
    if (!one) throw new Error("no document");
    const home = one.pages[0];
    if (!home) throw new Error("no page");
    return initHistories([
      parseDocument({
        ...one,
        pages: [
          home,
          { ...home, id: "p2", slug: "precios", title: "Precios", sections: [] },
          { ...home, id: "p3", slug: "carta", title: "Nuestra carta", sections: [] },
        ],
      }),
    ]);
  }

  const pagesOf = (state: Histories) =>
    state[0]?.present.document.pages.map((page) => `${page.slug}:${page.title}`);

  it("renames a page in one step, and undoes it", () => {
    const state = run(threePages(), {
      type: "renamePage",
      variant: 0,
      pageId: "p2",
      title: "Tarifas",
    });
    expect(pagesOf(state)?.[1]).toBe("precios:Tarifas");
    expect(state[0]?.past).toHaveLength(1);
    expect(pagesOf(run(state, { type: "undo", variant: 0 }))?.[1]).toBe("precios:Precios");
  });

  it("adds no step for a name that is already the name", () => {
    const initial = threePages();
    const state = run(initial, { type: "renamePage", variant: 0, pageId: "p2", title: "Precios" });
    expect(state).toBe(initial);
  });

  it("reorders, and undoes the reorder", () => {
    const state = run(threePages(), { type: "movePage", variant: 0, pageId: "p3", toIndex: 1 });
    expect(pagesOf(state)?.map((p) => p.split(":")[0])).toEqual(["index", "carta", "precios"]);
    expect(pagesOf(run(state, { type: "undo", variant: 0 }))?.map((p) => p.split(":")[0])).toEqual([
      "index",
      "precios",
      "carta",
    ]);
  });

  it("deletes a page, and undo brings it and its sections back", () => {
    const state = run(threePages(), { type: "deletePage", variant: 0, pageId: "p2" });
    expect(pagesOf(state)).toHaveLength(2);
    expect(pagesOf(run(state, { type: "undo", variant: 0 }))).toHaveLength(3);
  });

  it("refuses to delete or move the entry, and the refusal reaches the caller", () => {
    expect(() => run(threePages(), { type: "deletePage", variant: 0, pageId: "home" })).toThrow(
      /site's entry/,
    );
    expect(() =>
      run(threePages(), { type: "movePage", variant: 0, pageId: "home", toIndex: 1 }),
    ).toThrow(/cannot move/);
  });

  it("does not perform a redo, which is what a missing reducer branch used to do", () => {
    const state = run(
      threePages(),
      edit("Nombre editado"),
      { type: "undo", variant: 0 },
      { type: "renamePage", variant: 0, pageId: "p2", title: "Tarifas" },
    );
    expect(pagesOf(state)?.[1]).toBe("precios:Tarifas");
    expect(headline(state)).not.toBe("Nombre editado");
    expect(state[0]?.future).toHaveLength(0);
  });

  it("takes a page out of the menu in one step, and undo puts it back", () => {
    const state = run(threePages(), {
      type: "setPageInMenu",
      variant: 0,
      pageId: "p2",
      inMenu: false,
    });
    expect(state[0]?.present.document.pages[1]?.inMenu).toBe(false);
    expect(state[0]?.past).toHaveLength(1);
    expect(
      run(state, { type: "undo", variant: 0 })[0]?.present.document.pages[1]?.inMenu,
    ).toBeUndefined();
  });

  it("adds no step for an answer the page already gives", () => {
    const once = run(threePages(), {
      type: "setPageInMenu",
      variant: 0,
      pageId: "p2",
      inMenu: false,
    });
    expect(run(once, { type: "setPageInMenu", variant: 0, pageId: "p2", inMenu: false })).toBe(
      once,
    );
  });

  /**
   * **Stamping the default is a change**, because `undefined !== true`: absence is «nobody has
   * looked at this» and `true` is «I looked and I want it». That is the fact the curated threshold
   * reads (ADR 0043 §5), so the step has to open for it.
   */
  it("opens a step for an explicit «yes» on a page nobody had decided about", () => {
    const state = run(threePages(), {
      type: "setPageInMenu",
      variant: 0,
      pageId: "p2",
      inMenu: true,
    });
    expect(state[0]?.present.document.pages[1]?.inMenu).toBe(true);
    expect(state[0]?.past).toHaveLength(1);
  });

  it("refuses the entry page, which is «Inicio» rather than an entry", () => {
    expect(() =>
      run(threePages(), { type: "setPageInMenu", variant: 0, pageId: "home", inMenu: false }),
    ).toThrow(/Inicio/);
  });

  it("counts as having edited no section at all, because a page is not one", () => {
    // `sectionOf` answers `undefined` for a cause that names a page, so renaming one cannot keep a
    // delete toast alive on a section nobody touched.
    const state = run(threePages(), { type: "renamePage", variant: 0, pageId: "p2", title: "T" });
    const history = state[0];
    if (!history) throw new Error("no history");
    for (const id of sectionIds(state) ?? []) {
      if (id) expect(wasSectionEverEdited(history, id), id).toBe(false);
    }
  });
});

describe("what the history remembers across undo and redo", () => {
  /**
   * The defect these pin: `undo` and `redo` used to rebuild the snapshot they restored with a
   * null cause, so going back and forward again left the edit in the document and no record that
   * anyone had made it. `wasSectionEverEdited` then reported the section untouched, and ADR
   * 0014's delete toast faded on a section the owner had written into.
   */
  it("still knows a text edit happened after undoing and redoing it", () => {
    const state = run(
      start(),
      edit("Otro nombre"),
      { type: "undo", variant: 0 },
      {
        type: "redo",
        variant: 0,
      },
    );
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(headline(state)).toBe("Otro nombre");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(true);
  });

  it("still knows an uploaded photo happened after undoing and redoing it", () => {
    const state = run(
      start(),
      {
        type: "setImage",
        variant: 0,
        address: { sectionId: "sec-cover", elementId: "el-image" },
        src: "foto-sec-cover.jpg",
        alt: "Foto de Taberna Santo Domingo",
      },
      { type: "undo", variant: 0 },
      { type: "redo", variant: 0 },
    );
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(true);
  });

  it("still knows an earlier edit happened after undoing a later one", () => {
    // Two edits to different fields, then one undo: the first edit is still in the document and
    // the history has to say so.
    const state = run(start(), edit("Otro nombre"), edit("Otro lema", SUBHEADLINE), {
      type: "undo",
      variant: 0,
    });
    const history = state[0];
    if (!history) throw new Error("no history");
    expect(headline(state)).toBe("Otro nombre");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(true);
  });

  it("does not merge a keystroke into the very step an undo just restored", () => {
    // The reason the cause used to be cleared, and what `amendable` now guards instead. The
    // restored snapshot carries an editText cause for this very field, so without the flag the
    // next keystroke would amend it — the undo would silently have become an edit, with nothing
    // left to go back to.
    const state = run(
      start(),
      edit("Uno"),
      edit("Dos"),
      { type: "undo", variant: 0 },
      edit("Tres"),
    );
    expect(headline(state)).toBe("Tres");
    // Undoing again lands exactly where the first undo had left it. ("Uno" and "Dos" were
    // consecutive keystrokes in one field, so they were one step, and that step is what the
    // first undo removed.)
    expect(headline(run(state, { type: "undo", variant: 0 }))).toBe("Taberna Santo Domingo");
    // And the step "Tres" opened is still there to redo from.
    expect(state[0]?.past).toHaveLength(1);
  });

  it("still coalesces consecutive typing into one field", () => {
    const state = run(start(), edit("U"), edit("Un"), edit("Uno"));
    expect(state[0]?.past).toHaveLength(1);
    expect(headline(run(state, { type: "undo", variant: 0 }))).toBe("Taberna Santo Domingo");
  });
});

describe("sectionToPage, as one history step", () => {
  const convert = (sectionId: string): HistoryAction => ({
    type: "sectionToPage",
    variant: 0,
    sectionId,
  });

  it("makes the page, moves the section and leaves an avance, all at once", () => {
    const after = run(start(), convert("sec-services"));
    const doc = after[0]?.present.document;
    expect(doc?.pages).toHaveLength(2);
    expect(doc?.pages[1]?.title).toBe("Qué ponemos");
    expect(doc?.pages[0]?.sections.map((s) => s.preset.catalogId)).toEqual([
      "cover",
      "teaser",
      "gallery",
      "location",
      "contact",
      "footer",
    ]);
  });

  it("is one step, so one «Deshacer» takes back the page *and* the avance", () => {
    // The dossier's «y se puede deshacer», as the property that matters. Three separate verbs could
    // never give this: the owner would press undo three times and see two broken half-states.
    const before = start();
    const converted = run(before, convert("sec-services"));
    const undone = run(converted, { type: "undo", variant: 0 });

    expect(undone[0]?.present.document).toEqual(before[0]?.present.document);
    expect(converted[0]?.past).toHaveLength(1);
  });

  it("redoes the whole conversion just as completely", () => {
    const converted = run(start(), convert("sec-services"));
    const again = run(converted, { type: "undo", variant: 0 }, { type: "redo", variant: 0 });
    expect(again[0]?.present.document).toEqual(converted[0]?.present.document);
  });

  it("records which section left and which page it became", () => {
    // The cause carries the page id because only `sectionToPage` knows what it minted, and the
    // editor needs it to be able to open the page it just made.
    const cause = run(start(), convert("sec-services"))[0]?.present.cause;
    expect(cause).toMatchObject({ type: "sectionToPage", sectionId: "sec-services" });
    expect(cause && "pageId" in cause ? cause.pageId : undefined).toBe("page-que-ponemos");
  });

  it("gives the avance the catalog's own label rather than inventing one", () => {
    const doc = run(start(), convert("sec-services"))[0]?.present.document;
    const teaser = doc?.pages[0]?.sections.find((s) => s.preset.catalogId === "teaser");
    expect(teaser?.content[0]?.value).toMatchObject({
      text: "Ver más",
      href: "./que-ponemos.html",
    });
  });

  it("refuses a section that may not become a page, rather than half-doing it", () => {
    expect(() => run(start(), convert("sec-cover"))).toThrow(/cannot become a page/);
  });
});

/**
 * And the conversion undone from the «Páginas» panel — the other half of ADR 0022's «se puede
 * deshacer», which until today was written, tested and imported by nobody.
 *
 * Ctrl+Z already did this, for as long as nothing else had happened since. What it could not do is
 * undo a conversion the owner made yesterday, or one they made before writing a paragraph they want
 * to keep. That is the gap: `deletePage` was the only other way out, and it takes the page's
 * contents with it.
 */
describe("pageToSection, as one history step", () => {
  const convert = (sectionId: string): HistoryAction => ({
    type: "sectionToPage",
    variant: 0,
    sectionId,
  });
  const fold = (pageId: string): HistoryAction => ({ type: "pageToSection", variant: 0, pageId });

  /** A converted document and the page it made, which is what the panel would be listing. */
  function converted(): { state: Histories; pageId: string } {
    const state = run(start(), convert("sec-services"));
    const pageId = state[0]?.present.document.pages[1]?.id;
    if (!pageId) throw new Error("the conversion produced no page");
    return { state, pageId };
  }

  it("puts the section back where the avance was, and removes both", () => {
    const { state, pageId } = converted();
    const doc = run(state, fold(pageId))[0]?.present.document;

    expect(doc?.pages).toHaveLength(1);
    expect(doc?.pages[0]?.sections.map((s) => s.preset.catalogId)).toEqual([
      "cover",
      "services",
      "gallery",
      "location",
      "contact",
      "footer",
    ]);
  });

  it("returns the document to exactly what it was before the conversion", () => {
    // Not "equivalent-looking": equal. Which also proves the link rewriting is undone — a button
    // that `sectionToPage` turned into `./que-ponemos.html` is an anchor again.
    const before = start();
    const { state, pageId } = converted();
    expect(run(state, fold(pageId))[0]?.present.document).toEqual(before[0]?.present.document);
  });

  it("keeps whatever the owner added to the page while it was a page", () => {
    // The reason this is not just `deletePage`. A section written on the converted page comes back
    // with the one that went out, in order, rather than being thrown away with the page.
    const { state, pageId } = converted();
    const grown = run(state, {
      type: "insertSection",
      variant: 0,
      section: blankSection("gallery", "stacked", "sec-extra"),
      index: 1,
      pageId,
    });
    const doc = run(grown, fold(pageId))[0]?.present.document;

    expect(doc?.pages).toHaveLength(1);
    expect(doc?.pages[0]?.sections.map((s) => s.id)).toContain("sec-extra");
  });

  it("is one step, so one «Deshacer» puts the page and the avance back together", () => {
    const { state, pageId } = converted();
    const folded = run(state, fold(pageId));
    const undone = run(folded, { type: "undo", variant: 0 });

    expect(undone[0]?.present.document).toEqual(state[0]?.present.document);
    expect(folded[0]?.past).toHaveLength(2);
  });

  it("redoes just as completely", () => {
    const { state, pageId } = converted();
    const folded = run(state, fold(pageId));
    const again = run(folded, { type: "undo", variant: 0 }, { type: "redo", variant: 0 });
    expect(again[0]?.present.document).toEqual(folded[0]?.present.document);
  });

  it("names the page, and names no section", () => {
    // A page cause. `sectionOf` has to answer `undefined` for it, or folding a page would keep a
    // delete toast alive on a section nobody edited (ADR 0014).
    const { state, pageId } = converted();
    const cause = run(state, fold(pageId))[0]?.present.cause;
    expect(cause).toEqual({ type: "pageToSection", pageId });
  });

  it("refuses the first page, rather than folding the site's entry away", () => {
    expect(() => run(start(), fold("home"))).toThrow(/first page/);
  });

  it("refuses a page no avance points at", () => {
    // Reachable: ADR 0022 lets the owner delete an avance and keep the page. The panel does not
    // offer the button there — `canFoldPage` says so — and the verb refuses if anything else tries.
    const { state, pageId } = converted();
    const teaser = state[0]?.present.document.pages[0]?.sections.find(
      (s) => s.preset.catalogId === "teaser",
    );
    const orphaned = run(state, {
      type: "deleteSection",
      variant: 0,
      sectionId: teaser?.id ?? "",
    });
    expect(() => run(orphaned, fold(pageId))).toThrow(/nothing points at/);
  });
});

describe("insertSection lands on the page the canvas is drawing", () => {
  /**
   * The regression sprint 5 left behind. `insertSection` resolved its page as `doc.pages[0]` under
   * a comment that said so — "Phase 1 has exactly one; when `Páginas` arrives in phase 2 this is
   * where the choice of which one has to come from" — and `Páginas` arrived without anyone coming
   * back. From a converted page, every «Añadir sección aquí» put its section on the home page.
   *
   * It was worse than the wrong page, and the second half is what a page-only test would miss:
   * `wireInsertion` computes the index from the sections it can *see*, which are the rendered
   * page's. So the third gap of a converted page sent `index: 2` to be applied against the home
   * page's own list — the wrong page *and* a meaningless position in it.
   */
  const convert = (sectionId: string): HistoryAction => ({
    type: "sectionToPage",
    variant: 0,
    sectionId,
  });

  /** A two-page document, made the way the editor makes one: by converting a section. */
  function converted(): { state: Histories; pageId: string } {
    const state = run(start(), convert("sec-services"));
    const pageId = state[0]?.present.document.pages[1]?.id;
    if (!pageId) throw new Error("the conversion produced no page");
    return { state, pageId };
  }

  it("puts the section on that page, not on the home page", () => {
    const { state, pageId } = converted();
    const after = run(state, {
      type: "insertSection",
      variant: 0,
      section: blankSection("gallery", "stacked", "sec-gallery"),
      index: 1,
      pageId,
    });

    const doc = after[0]?.present.document;
    expect(doc?.pages[1]?.sections.map((s) => s.preset.catalogId)).toEqual(["services", "gallery"]);
    // And the home page is untouched: this is the half that used to fail, silently, by gaining a
    // section the owner never saw arrive.
    expect(doc?.pages[0]?.sections.map((s) => s.preset.catalogId)).toEqual(
      state[0]?.present.document.pages[0]?.sections.map((s) => s.preset.catalogId),
    );
  });

  it("reads the index against that page's own sections", () => {
    // `index: 0` means "before everything on the page I am looking at". Applied to the home page it
    // would have meant "before the cover", which is a different place entirely.
    const { state, pageId } = converted();
    const after = run(state, {
      type: "insertSection",
      variant: 0,
      section: blankSection("gallery", "stacked", "sec-gallery"),
      index: 0,
      pageId,
    });
    expect(after[0]?.present.document.pages[1]?.sections.map((s) => s.preset.catalogId)).toEqual([
      "gallery",
      "services",
    ]);
  });

  it("throws naming the page when asked for one the document does not have", () => {
    // Rather than the silent `pages[0]` that caused this. An id the editor sends came from a tab it
    // just drew, so a miss is a bug and has to sound like one.
    const { state } = converted();
    expect(() =>
      run(state, {
        type: "insertSection",
        variant: 0,
        section: blankSection("gallery", "stacked", "sec-gallery"),
        index: 0,
        pageId: "no-such-page",
      }),
    ).toThrow(/no page "no-such-page"/);
  });

  it("takes the section back off that page on undo", () => {
    const { state, pageId } = converted();
    const after = run(
      state,
      {
        type: "insertSection",
        variant: 0,
        section: blankSection("gallery", "stacked", "sec-gallery"),
        index: 1,
        pageId,
      },
      { type: "undo", variant: 0 },
    );
    expect(after[0]?.present.document).toEqual(state[0]?.present.document);
  });
});

describe("designing a section by hand, and taking it back", () => {
  /**
   * The escalation as the history sees it (ADR 0025, advanced dossier §5).
   *
   * The verbs themselves are tested in `packages/schema/test/layout.test.ts`. What is being checked
   * here is the thing the dossier leans on for the first minutes — «el deshacer normal cubre la
   * escalada como cualquier otro cambio» — which is only true if it pushes a snapshot like every
   * other verb in this stack.
   */
  const escalate = (
    sectionId = "sec-cover",
    variant = 0,
    boxes?: readonly MeasuredBox[],
  ): HistoryAction => ({
    type: "escalateSection",
    variant,
    sectionId,
    ...(boxes ? { boxes } : {}),
  });

  const revert = (sectionId = "sec-cover", variant = 0): HistoryAction => ({
    type: "revertSection",
    variant,
    sectionId,
  });

  const sourceOf = (state: Histories, sectionId = "sec-cover") =>
    state[0]?.present.document.pages[0]?.sections.find((s) => s.id === sectionId)?.source;

  it("makes the section free and gives it a layout of its own", () => {
    const after = run(start(), escalate());
    const section = after[0]?.present.document.pages[0]?.sections.find((s) => s.id === "sec-cover");
    expect(section?.source).toBe("free");
    expect(section?.layout).not.toBeNull();
  });

  it("is one step, and Ctrl+Z is the whole return for the first minutes", () => {
    const state = start();
    const undone = run(state, escalate(), { type: "undo", variant: 0 });
    expect(undone[0]?.present.document).toEqual(state[0]?.present.document);
    expect(sourceOf(undone)).toBe("catalog");
  });

  it("keeps the words the owner wrote before escalating, and they survive the return", () => {
    // The offer promises nothing moves. The strongest way to say that here is to write something
    // first, then escalate and come back, and find the sentence still in place.
    const written = run(start(), edit("Cocina de Ronda"));
    const back = run(written, escalate(), revert());
    expect(headline(back)).toBe("Cocina de Ronda");
    expect(back[0]?.present.document).toEqual(written[0]?.present.document);
  });

  it("is not amendable, so the next keystroke opens its own step", () => {
    expect(run(start(), escalate())[0]?.amendable).toBe(false);
  });

  it("opens no step for a section that is already designed by hand", () => {
    const free = run(start(), escalate());
    const again = run(free, escalate());
    expect(again).toBe(free);
    expect(again[0]?.past.length).toBe(free[0]?.past.length);
  });

  it("opens no step for reverting a section that is already the catalog's", () => {
    const state = start();
    expect(run(state, revert())).toBe(state);
  });

  it("does not count as having worked on the section's content", () => {
    // The same line `setVariant` falls on. A delete's undo toast must not stop fading because
    // somebody tried designing a section by hand and changed their mind about one they never wrote
    // a word into (ADR 0014).
    const after = run(start(), escalate(), revert());
    expect(wasSectionEverEdited(after[0] as Histories[number], "sec-cover")).toBe(false);
  });

  it("leaves the other variants alone", () => {
    const after = run(start(), escalate());
    expect(after[1]?.present.document).toEqual(start()[1]?.present.document);
  });

  it("throws naming the section when asked for one the document does not have", () => {
    expect(() => run(start(), escalate("sec-nope"))).toThrow(/no section "sec-nope"/);
  });

  /**
   * **What the canvas measured reaches the document** (ADR 0050 §3, sprint 25 día 2).
   *
   * The arithmetic is `packages/schema`'s and tested there; what this stack has to get right is
   * that the boxes travel — the canvas reads them, `Variants` puts them on the action and the
   * reducer hands them to the verb. A reducer that dropped them would still escalate, still open
   * one step, and silently go back to deriving the rows from the theme, which is the kind of
   * regression nothing else here would notice.
   */
  it("writes the rows from the boxes the canvas measured", () => {
    const state = run(
      start(),
      escalate("sec-cover", 0, [{ elementId: "el-headline", top: 160, height: 96 }]),
    );
    const placements = state[0]?.present.document.pages[0]?.sections.find(
      (s) => s.id === "sec-cover",
    )?.layout?.placements;
    expect(placements?.find((p) => p.elementId === "el-headline")).toMatchObject({
      row: 21,
      rowSpan: 12,
    });
    // And an element nobody measured keeps the rhythm's answer rather than landing in row 1.
    expect(placements?.every((placement) => placement.row >= 1)).toBe(true);
    expect(placements?.length ?? 0).toBeGreaterThan(1);
  });

  describe("and then moving something inside its grid", () => {
    const escalated = () => run(start(), escalate());
    const firstElement = (state: Histories) =>
      state[0]?.present.document.pages[0]?.sections.find((s) => s.id === "sec-cover")?.layout
        ?.placements[0]?.elementId as string;
    const place = (state: Histories, edit: Record<string, number>): HistoryAction => ({
      type: "setPlacement",
      variant: 0,
      sectionId: "sec-cover",
      elementId: firstElement(state),
      edit,
    });
    const placementIn = (state: Histories, elementId: string) =>
      state[0]?.present.document.pages[0]?.sections
        .find((s) => s.id === "sec-cover")
        ?.layout?.placements.find((p) => p.elementId === elementId);

    it("is one step, and one undo puts the element back", () => {
      const before = escalated();
      const id = firstElement(before);
      const moved = run(before, place(before, { column: 4, columnSpan: 6 }));
      expect(placementIn(moved, id)).toMatchObject({ column: 4, columnSpan: 6 });
      expect(run(moved, { type: "undo", variant: 0 })[0]?.present.document).toEqual(
        before[0]?.present.document,
      );
    });

    it("is not amendable, so two presses of the same arrow are two steps", () => {
      // Unlike typing. Laying out by hand is a sequence of small deliberate adjustments, and an
      // amalgamated step would take back a whole minute of them at once.
      const before = escalated();
      const twice = run(before, place(before, { column: 2 }), place(before, { column: 3 }));
      expect(twice[0]?.amendable).toBe(false);
      const once = run(twice, { type: "undo", variant: 0 });
      expect(placementIn(once, firstElement(once))).toMatchObject({ column: 2 });
    });

    it("opens no step for the numbers the element already had", () => {
      const before = escalated();
      const current = placementIn(before, firstElement(before));
      const again = run(before, place(before, { column: current?.column as number }));
      expect(again).toBe(before);
    });

    it("does not count as having worked on the section's content", () => {
      // A placement says where an element sits, never what it says (ADR 0014).
      const after = run(escalated(), place(escalated(), { row: 3 }));
      expect(wasSectionEverEdited(after[0] as Histories[number], "sec-cover")).toBe(false);
    });

    it("refuses a section the catalog still draws, naming the verb that would allow it", () => {
      const fresh = start();
      expect(() =>
        run(fresh, {
          type: "setPlacement",
          variant: 0,
          sectionId: "sec-services",
          elementId: "el-headline",
          edit: { column: 2 },
        }),
      ).toThrow(/drawn by the catalog.*escalateSection/s);
    });

    it("refuses to break rule 4, with the arithmetic in the message", () => {
      const before = escalated();
      // On the fine grid (ADR 0050): ninety-six units, and the message counts in them.
      expect(() => run(before, place(before, { column: 90, columnSpan: 8 }))).toThrow(
        /reaches column 97, past the 96-unit grid \(rule 4\)/,
      );
    });

    it("survives the return: reverting drops the layout the moves were written into", () => {
      // Not a defect — rule 1 says layout belongs to the layout object, and `document-rules.md`
      // says losing it on revert is correct. The day-4 dialog is what warns before it happens.
      const before = escalated();
      const moved = run(before, place(before, { column: 5, columnSpan: 4 }));
      const back = run(moved, { type: "revertSection", variant: 0, sectionId: "sec-cover" });
      const section = back[0]?.present.document.pages[0]?.sections.find(
        (s) => s.id === "sec-cover",
      );
      expect(section?.source).toBe("catalog");
      expect(section?.layout).toBeNull();
      // And the words are all still there, which is the half that is promised.
      expect(headline(back)).toBe(headline(before));
    });
  });
});

describe("setMark — bold and italic from the floating toolbar", () => {
  function marksOf(state: Histories, variant = 0) {
    const document = state[variant]?.present.document;
    const section = document?.pages[0]?.sections.find((s) => s.id === "sec-cover");
    const element = section?.content.find((el) => el.id === "el-headline");
    const value = element?.value;
    return value?.kind === "text" ? value.marks : undefined;
  }

  const press = (
    state: Histories,
    range: { from: number; to: number },
    mark: "strong" | "em",
    on: boolean,
  ): Histories =>
    historiesReducer(state, {
      type: "setMark",
      variant: 0,
      address: HEADLINE,
      range,
      mark,
      on,
    } as HistoryAction);

  it("marks a run, and undo takes it back", () => {
    const marked = press(start(), { from: 0, to: 4 }, "strong", true);
    expect(marksOf(marked)).toEqual([{ from: 0, to: 4, mark: "strong" }]);

    const undone = historiesReducer(marked, { type: "undo", variant: 0 });
    expect(marksOf(undone)).toBeUndefined();
  });

  it("opens no step when the press changes nothing", () => {
    // `applyMark` returns the identical document when the words are already marked, so pressing a
    // pressed button must not grow the history — the contract the swatch already keeps.
    const once = press(start(), { from: 0, to: 4 }, "strong", true);
    const twice = press(once, { from: 0, to: 4 }, "strong", true);
    expect(twice).toBe(once);
  });

  it("lets both marks cover the same words, which is what the third owner asked for", () => {
    let state = press(start(), { from: 0, to: 4 }, "strong", true);
    state = press(state, { from: 0, to: 4 }, "em", true);
    expect(marksOf(state)).toEqual([
      { from: 0, to: 4, mark: "strong" },
      { from: 0, to: 4, mark: "em" },
    ]);
  });

  it("takes one mark off and leaves the other", () => {
    let state = press(start(), { from: 0, to: 4 }, "strong", true);
    state = press(state, { from: 0, to: 4 }, "em", true);
    state = press(state, { from: 0, to: 4 }, "strong", false);
    expect(marksOf(state)).toEqual([{ from: 0, to: 4, mark: "em" }]);
  });

  it("counts as working on the section's content", () => {
    // Unlike a colour. ADR 0024 chose `strong` and `em` *because* they mean emphasis and a screen
    // reader conveys them, so a mark changes what the section says — which is what keeps a delete
    // toast from fading out from under somebody who has been marking words.
    const history = press(start(), { from: 0, to: 4 }, "strong", true)[0];
    if (!history) throw new Error("no history for variant 0");
    expect(wasSectionEverEdited(history, "sec-cover")).toBe(true);
  });
});

describe("addEntryPage — una página por ficha (ADR 0040)", () => {
  /** A list made of the generated «Qué hago» cards, which is where an owner's page per entry
   * starts: the lossless way in, then the page. */
  function withList(): Histories {
    return historiesReducer(start(), {
      type: "collectionFromList",
      variant: 0,
      sectionId: "sec-services",
      slot: "services",
      name: "Qué hago",
    });
  }

  it("creates one stored page bound to the list, slugs every ficha, and opens one step", () => {
    const before = withList();
    const collectionId = before[0]?.present.document.collections[0]?.id;
    if (!collectionId) throw new Error("the list was not made");
    const after = historiesReducer(before, {
      type: "addEntryPage",
      variant: 0,
      collectionId,
      titleField: "title",
      title: "Ficha de Qué hago",
    });
    const document = after[0]?.present.document;
    const page = document?.pages.at(-1);
    expect(page?.binding).toEqual({ collectionId, titleField: "title" });
    expect(page?.title).toBe("Ficha de Qué hago");
    expect(document?.pages).toHaveLength(2);
    // Born with a cover whose headline reads the title field, in the home cover's own composition.
    expect(page?.sections[0]?.preset).toEqual({
      catalogId: "cover",
      variantId: document?.pages[0]?.sections[0]?.preset.variantId,
    });
    expect(
      page?.sections[0]?.content.find((element) => element.slot === "headline")?.binding,
    ).toEqual({ collectionId, field: "title" });
    expect(document?.collections[0]?.entries.map((entry) => entry.slug)).toEqual([
      "comidas",
      "cenas",
    ]);
    expect(after[0]?.present.cause).toEqual({
      type: "addEntryPage",
      collectionId,
      pageId: page?.id,
    });
    // One step: undo takes the page and the slugs back together.
    const undone = historiesReducer(after, { type: "undo", variant: 0 });
    expect(undone[0]?.present.document).toBe(before[0]?.present.document);
  });

  it("throws for a second page, which the panel never offers", () => {
    const before = withList();
    const collectionId = before[0]?.present.document.collections[0]?.id ?? "";
    const once = historiesReducer(before, {
      type: "addEntryPage",
      variant: 0,
      collectionId,
      titleField: "title",
      title: "Ficha",
    });
    expect(() =>
      historiesReducer(once, {
        type: "addEntryPage",
        variant: 0,
        collectionId,
        titleField: "title",
        title: "Otra",
      }),
    ).toThrow(/already has its page per entry/);
  });

  it("removes it with deletePage, the ordinary way, and the slugs stay with the fichas", () => {
    const before = withList();
    const collectionId = before[0]?.present.document.collections[0]?.id ?? "";
    const made = historiesReducer(before, {
      type: "addEntryPage",
      variant: 0,
      collectionId,
      titleField: "title",
      title: "Ficha",
    });
    const pageId = made[0]?.present.document.pages.at(-1)?.id ?? "";
    const gone = historiesReducer(made, { type: "deletePage", variant: 0, pageId });
    expect(gone[0]?.present.document.pages).toHaveLength(1);
    expect(gone[0]?.present.document.collections[0]?.entries.map((entry) => entry.slug)).toEqual([
      "comidas",
      "cenas",
    ]);
  });
});

describe("a font the owner brought, added and removed (sprint 29 día 5)", () => {
  const CASA: OwnFont = {
    id: "3f9a7c21",
    family: "Casa Trufa",
    kind: "serif",
    faces: [{ role: "variable", format: "woff2", wght: [300, 800] }],
    licence: { declared: true, at: "2026-10-28T09:00:00.000Z" },
  };
  const theme = (s: Histories) => s[0]?.present.document.theme;
  const add = (s: Histories): HistoryAction => ({
    type: "addOwnFont",
    variant: 0,
    font: CASA,
    theme: withOwnFont(theme(s) as Theme, "font.heading", CASA),
  });

  it("records the font and chooses it in one step, which one undo takes back whole", () => {
    const before = start();
    const added = run(before, add(before));
    expect(added[0]?.present.document.fonts).toEqual([CASA]);
    expect(theme(added)?.["font.heading"]).toMatch(/^'Casa Trufa', /);
    expect(added[0]?.past).toHaveLength(1);
    const undone = run(added, { type: "undo", variant: 0 });
    expect(undone[0]?.present.document).toBe(before[0]?.present.document);
  });

  it("closes a chooser session open behind the import dialog rather than amending it", () => {
    let state = start();
    state = run(state, {
      type: "chooseFamily",
      variant: 0,
      key: "font.heading",
      theme: withFamily(theme(state) as Theme, "font.heading", "Bitter"),
    });
    state = run(state, add(state));
    expect(state[0]?.past).toHaveLength(2);
    expect(state[0]?.amendable).toBe(false);
    // Escape in the chooser reopened afterwards cannot reach back past the font.
    state = run(state, { type: "discardChooser", variant: 0 });
    expect(state[0]?.present.document.fonts).toEqual([CASA]);
  });

  it("«Quitar» takes the family out of the stack, and undo brings back the record and the letter", () => {
    const added = run(start(), add(start()));
    const removed = run(added, { type: "removeOwnFont", variant: 0, fontId: CASA.id });
    expect(removed[0]?.present.document.fonts).toBeUndefined();
    expect(theme(removed)?.["font.heading"]).not.toMatch(/Casa Trufa/);
    const undone = run(removed, { type: "undo", variant: 0 });
    expect(undone[0]?.present.document).toBe(added[0]?.present.document);
  });
});

describe("the header's verbs (sprint 30 día 4)", () => {
  const doc = () => {
    const document = start()[0]?.present.document;
    if (!document) throw new Error("no document");
    return document;
  };
  /** A section of the generated home page that lends a menu entry — any that is not the cover or
   * the footer. */
  const labelled = () => {
    const section = doc().pages[0]?.sections.find(
      (candidate) => !["cover", "footer", "teaser"].includes(candidate.preset.catalogId),
    );
    if (!section) throw new Error("no section lends an entry");
    return { kind: "section" as const, sectionId: section.id };
  };
  const label = (target: { kind: "section"; sectionId: string }, text: string | null) =>
    ({ type: "setMenuLabel", variant: 0, target, label: text }) as const;
  const labelOf = (state: Histories, sectionId: string) =>
    state[0]?.present.document.pages[0]?.sections.find((section) => section.id === sectionId)
      ?.menuLabel;

  it("typing a word into «Se lee como…» is one step, and one «Deshacer» takes it all back", () => {
    const target = labelled();
    const state = run(
      start(),
      label(target, "Ca"),
      label(target, "Car"),
      label(target, "Cart"),
      label(target, "Carta"),
    );
    expect(labelOf(state, target.sectionId)).toBe("Carta");
    expect(state[0]?.past).toHaveLength(1);
    expect(labelOf(run(state, { type: "undo", variant: 0 }), target.sectionId)).toBeUndefined();
  });

  it("another entry, or anything in between, opens a step of its own", () => {
    const target = labelled();
    const home = { kind: "page" as const, pageId: doc().pages[0]?.id ?? "" };
    const state = run(start(), label(target, "Carta"), {
      type: "setMenuLabel",
      variant: 0,
      target: home,
      label: "Portada",
    });
    expect(state[0]?.past).toHaveLength(2);
    const after = run(
      start(),
      label(target, "Ca"),
      { type: "setHeader", variant: 0, patch: { sticky: true } },
      label(target, "Carta"),
    );
    expect(after[0]?.past).toHaveLength(3);
  });

  it("typing after an undo opens a new step, even back onto a step of the same entry", () => {
    const target = labelled();
    // Undone to the label's own step: its cause names this very entry, and only `amendable` —
    // which an undo turns off — keeps the next keystroke from rewriting the step it came back to.
    const undone = run(
      start(),
      label(target, "Carta"),
      { type: "setHeader", variant: 0, patch: { sticky: true } },
      { type: "undo", variant: 0 },
    );
    expect(undone[0]?.present.cause).toEqual({ type: "setMenuLabel", target });
    const state = run(undone, label(target, "Menú"));
    expect(state[0]?.past).toHaveLength(2);
    expect(labelOf(run(state, { type: "undo", variant: 0 }), target.sectionId)).toBe("Carta");
  });

  it("two sections, or two pages, are two entries", () => {
    const one = doc();
    const home = one.pages[0];
    if (!home) throw new Error("no page");
    const [first, second] = home.sections.filter(
      (candidate) => !["cover", "footer", "teaser"].includes(candidate.preset.catalogId),
    );
    if (!first || !second) throw new Error("fewer than two sections lend an entry");
    const sections = run(
      start(),
      label({ kind: "section", sectionId: first.id }, "Carta"),
      label({ kind: "section", sectionId: second.id }, "Menú"),
    );
    expect(sections[0]?.past).toHaveLength(2);

    const pages = initHistories([
      parseDocument({
        ...one,
        pages: [
          home,
          { ...home, id: "p2", slug: "precios", title: "Precios", sections: [] },
          { ...home, id: "p3", slug: "carta", title: "Nuestra carta", sections: [] },
        ],
      }),
    ]);
    const typed = run(
      pages,
      {
        type: "setMenuLabel",
        variant: 0,
        target: { kind: "page", pageId: "p2" },
        label: "Tarifas",
      },
      { type: "setMenuLabel", variant: 0, target: { kind: "page", pageId: "p3" }, label: "Carta" },
    );
    expect(typed[0]?.past).toHaveLength(2);
  });

  it("an empty box goes back to the derived word, and an unchanged one opens no step", () => {
    const target = labelled();
    const once = run(start(), label(target, "Carta"));
    const cleared = run(once, { type: "setHeader", variant: 0, patch: {} }, label(target, ""));
    expect(labelOf(cleared, target.sectionId)).toBeUndefined();
    const initial = start();
    expect(run(initial, label(target, null))).toBe(initial);
  });

  it("a switch, a layout and a button are one step each, and the same value opens none", () => {
    const initial = start();
    const sticky = run(initial, { type: "setHeader", variant: 0, patch: { sticky: true } });
    expect(sticky[0]?.present.document.header).toEqual({ sticky: true });
    expect(sticky[0]?.past).toHaveLength(1);
    expect(sticky[0]?.present.cause).toEqual({ type: "setHeader" });
    expect(run(sticky, { type: "setHeader", variant: 0, patch: { sticky: true } })).toBe(sticky);

    const target = labelled();
    const button = run(initial, {
      type: "setHeaderAction",
      variant: 0,
      action: { kind: "section", sectionId: target.sectionId },
    });
    expect(button[0]?.present.document.header?.action).toEqual({
      kind: "section",
      sectionId: target.sectionId,
    });
    const none = run(button, { type: "setHeaderAction", variant: 0, action: null });
    expect(none[0]?.present.document.header).toBeUndefined();
    expect(none[0]?.past).toHaveLength(2);
  });

  it("none of them makes a section count as written into", () => {
    const target = labelled();
    const state = run(start(), label(target, "Carta"), {
      type: "setHeaderAction",
      variant: 0,
      action: { kind: "section", sectionId: target.sectionId },
    });
    expect(wasSectionEverEdited(state[0] as History, target.sectionId)).toBe(false);
  });
});
