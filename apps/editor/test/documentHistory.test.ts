import { blankSection } from "@retorika/catalog";
import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import type { ElementAddress, RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  type Histories,
  type HistoryAction,
  historiesReducer,
  initHistories,
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
    const state = run(start(), { type: "insertSection", variant: 0, section: blank(), index: 1 });
    expect(sectionIds(state)?.[1]).toBe("sec-location-2");
  });

  it("re-mints an id the document already uses, rather than colliding with it", () => {
    // The generated site already has a "sec-location": what the caller hands over is a
    // template's id, and only the document knows which ones are free.
    const state = run(start(), { type: "insertSection", variant: 0, section: blank(), index: 0 });
    expect(sectionIds(state)?.[0]).toBe("sec-location-2");
  });

  it("keeps re-minting when the same section is added twice in a row", () => {
    const state = run(
      start(),
      { type: "insertSection", variant: 0, section: blank(), index: 0 },
      { type: "insertSection", variant: 0, section: blank(), index: 0 },
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
    });
    expect(sectionIds(state)?.[0]).toBe("sec-portada");
  });

  it("is undone as one step, putting the page back exactly as it was", () => {
    const before = sectionIds(start());
    const state = run(
      start(),
      { type: "insertSection", variant: 0, section: blank(), index: 1 },
      { type: "undo", variant: 0 },
    );
    expect(sectionIds(state)).toEqual(before);
  });

  it("is redone after an undo", () => {
    const state = run(
      start(),
      { type: "insertSection", variant: 0, section: blank(), index: 1 },
      { type: "undo", variant: 0 },
      { type: "redo", variant: 0 },
    );
    expect(sectionIds(state)?.[1]).toBe("sec-location-2");
  });

  it("names the section it added, under the id it actually minted", () => {
    const state = run(start(), { type: "insertSection", variant: 0, section: blank(), index: 1 });
    expect(state[0]?.present.cause).toEqual({
      type: "insertSection",
      sectionId: "sec-location-2",
    });
  });

  it("touches only the variant it names", () => {
    const state = run(start(), { type: "insertSection", variant: 0, section: blank(), index: 0 });
    expect(sectionIds(state, 1)).toEqual(sectionIds(start(), 1));
  });

  it("does not count as having edited the new section: nothing was written into it", () => {
    // Marker text is what the catalog put there, not what the user typed, so a delete's undo
    // toast should fade for it like any untouched section (ADR 0014).
    const state = run(start(), { type: "insertSection", variant: 0, section: blank(), index: 1 });
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

  it("replaces the placeholder's alt, which stops being true the moment a photo arrives", () => {
    expect(image(start())?.alt).toBe("Marcador de foto: aquí irá tu foto");
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
