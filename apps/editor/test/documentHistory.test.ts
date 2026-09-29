import { blankItem, blankSection } from "@retorika/catalog";
import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import {
  type ElementAddress,
  parseDocument,
  type RetorikaDocument,
  type Theme,
} from "@retorika/schema";
import { buildTheme } from "@retorika/tokens";
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

describe("setTheme", () => {
  /**
   * The verb behind Estilo. Built from real palette ids rather than a synthetic map, because that
   * is what the panel will do — and because `restaurante-bar` generates `warm-terracotta` with
   * `classic-display`, so "the palette this site already uses" is a case these can actually reach.
   */
  const OWN = { paletteId: "warm-terracotta", typePairId: "classic-display" };
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
