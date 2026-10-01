import { describe, expect, it } from "vitest";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { parseDocument } from "../src/parse.ts";
import {
  addItem,
  clearSlot,
  deleteSection,
  duplicateSection,
  fillSlot,
  findSection,
  insertSection,
  mintElementId,
  mintSectionId,
  moveItem,
  moveSection,
  removeItem,
  setVariant,
} from "../src/sections.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

const cover: Section = {
  id: "sec-cover",
  preset: { catalogId: "cover", variantId: "image-right" },
  source: "catalog",
  layout: null,
  content: [
    {
      id: "el-headline",
      role: "heading",
      hidden: false,
      slot: "headline",
      value: { kind: "text", text: "Barbería El Corte" },
    },
    {
      id: "el-image",
      role: "image",
      hidden: false,
      slot: "image",
      value: { kind: "image", src: "a.svg", alt: "Foto" },
    },
  ],
};

const location: Section = {
  id: "sec-location",
  preset: { catalogId: "location", variantId: "stacked" },
  source: "catalog",
  layout: null,
  content: [
    {
      id: "el-loc-headline",
      role: "heading",
      hidden: false,
      slot: "headline",
      value: { kind: "text", text: "Dónde estamos" },
    },
    {
      id: "el-address",
      role: "body",
      hidden: false,
      slot: "address",
      value: { kind: "text", text: "Calle Espinel 24" },
    },
  ],
};

const contact: Section = {
  id: "sec-contact",
  preset: { catalogId: "contact", variantId: "stacked" },
  source: "catalog",
  layout: null,
  content: [
    {
      id: "el-contact-headline",
      role: "heading",
      hidden: false,
      slot: "headline",
      value: { kind: "text", text: "Te esperamos" },
    },
    {
      id: "el-contact-cta",
      role: "button",
      hidden: false,
      slot: "primaryAction",
      value: { kind: "link", text: "Llámanos", href: "tel:+34600000000" },
    },
  ],
};

function documentWith(sections: Section[]): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections }],
    collections: [],
  };
}

const doc = documentWith([cover, location]);

describe("findSection", () => {
  it("finds a section by id, with the page it lives on", () => {
    const found = findSection(doc, "sec-location");
    expect(found?.section.id).toBe("sec-location");
    expect(found?.page.id).toBe("home");
  });

  it("returns undefined for an id that does not exist", () => {
    expect(findSection(doc, "no-such-section")).toBeUndefined();
  });
});

describe("deleteSection", () => {
  it("removes exactly the named section, leaving the others in order", () => {
    const edited = deleteSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual(["sec-location"]);
  });

  it("leaves the surviving section's content byte-for-byte the same", () => {
    const edited = deleteSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections[0]).toEqual(location);
  });

  it("never mutates the document it started from", () => {
    const snapshot = JSON.stringify(doc);
    deleteSection(doc, "sec-cover");
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it("throws on an id that does not exist, rather than silently doing nothing", () => {
    expect(() => deleteSection(doc, "no-such-section")).toThrow(/no section "no-such-section"/);
  });

  it("produces a document that still parses", () => {
    const edited = deleteSection(doc, "sec-cover");
    expect(() => parseDocument(edited)).not.toThrow();
  });

  it("deleting the last section on a page leaves an empty, still-valid page", () => {
    const onePage = documentWith([cover]);
    const edited = deleteSection(onePage, "sec-cover");
    expect(edited.pages[0]?.sections).toEqual([]);
    expect(() => parseDocument(edited)).not.toThrow();
  });
});

const doc3 = documentWith([cover, location, contact]);

describe("mintSectionId", () => {
  it("appends -2 to an id already used by the section itself", () => {
    expect(mintSectionId(doc, "sec-cover")).toBe("sec-cover-2");
  });

  it("counts past every suffix already taken", () => {
    const withDuplicate = documentWith([cover, { ...cover, id: "sec-cover-2" }, location]);
    expect(mintSectionId(withDuplicate, "sec-cover")).toBe("sec-cover-3");
  });

  it("strips an existing numeric suffix before counting, so duplicating a duplicate does not nest", () => {
    const withDuplicate = documentWith([cover, { ...cover, id: "sec-cover-2" }]);
    expect(mintSectionId(withDuplicate, "sec-cover-2")).toBe("sec-cover-3");
  });

  it("returns the bare root when nothing is using it, even though that should not normally happen", () => {
    expect(mintSectionId(documentWith([location]), "sec-cover")).toBe("sec-cover");
  });
});

describe("duplicateSection", () => {
  it("inserts a copy directly after the original, with a freshly minted id", () => {
    const edited = duplicateSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-cover",
      "sec-cover-2",
      "sec-location",
    ]);
  });

  it("keeps every element id and the layout verbatim in the clone", () => {
    const edited = duplicateSection(doc, "sec-cover");
    const clone = edited.pages[0]?.sections[1];
    expect(clone?.content.map((el) => el.id)).toEqual(cover.content.map((el) => el.id));
    expect(clone?.layout).toBe(cover.layout);
  });

  it("changes only the clone's id; its content is the original's, unchanged", () => {
    const edited = duplicateSection(doc, "sec-cover");
    const clone = edited.pages[0]?.sections[1];
    expect(clone?.content).toEqual(cover.content);
    expect(clone?.preset).toEqual(cover.preset);
  });

  it("leaves the original section completely untouched", () => {
    const edited = duplicateSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections[0]).toEqual(cover);
  });

  it("never mutates the document it started from", () => {
    const snapshot = JSON.stringify(doc);
    duplicateSection(doc, "sec-cover");
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it("throws on an id that does not exist", () => {
    expect(() => duplicateSection(doc, "no-such-section")).toThrow(/no section/);
  });

  it("produces a document that still parses", () => {
    expect(() => parseDocument(duplicateSection(doc, "sec-cover"))).not.toThrow();
  });

  it("duplicating a duplicate mints the next id in sequence, not a nested one", () => {
    const once = duplicateSection(doc, "sec-cover");
    const twice = duplicateSection(once, "sec-cover-2");
    expect(twice.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-cover",
      "sec-cover-2",
      "sec-cover-3",
      "sec-location",
    ]);
  });
});

describe("moveSection", () => {
  it("moves a section forward", () => {
    const edited = moveSection(doc3, "sec-cover", 2);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-location",
      "sec-contact",
      "sec-cover",
    ]);
  });

  it("moves a section backward", () => {
    const edited = moveSection(doc3, "sec-contact", 0);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-contact",
      "sec-cover",
      "sec-location",
    ]);
  });

  it("swaps with its neighbour for a move up by one", () => {
    const edited = moveSection(doc3, "sec-location", 0);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-location",
      "sec-cover",
      "sec-contact",
    ]);
  });

  it("clamps an index past the end to the last position, rather than rejecting it", () => {
    const edited = moveSection(doc3, "sec-cover", 99);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-location",
      "sec-contact",
      "sec-cover",
    ]);
  });

  it("clamps a negative index to the first position", () => {
    const edited = moveSection(doc3, "sec-contact", -5);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-contact",
      "sec-cover",
      "sec-location",
    ]);
  });

  it("is a genuine no-op back to the same order when the index does not change", () => {
    const edited = moveSection(doc3, "sec-location", 1);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-cover",
      "sec-location",
      "sec-contact",
    ]);
  });

  it("leaves every section's own content untouched", () => {
    const edited = moveSection(doc3, "sec-cover", 2);
    const moved = edited.pages[0]?.sections.find((s) => s.id === "sec-cover");
    expect(moved).toEqual(cover);
  });

  it("never mutates the document it started from", () => {
    const snapshot = JSON.stringify(doc3);
    moveSection(doc3, "sec-cover", 2);
    expect(JSON.stringify(doc3)).toBe(snapshot);
  });

  it("throws on an id that does not exist", () => {
    expect(() => moveSection(doc3, "no-such-section", 0)).toThrow(/no section/);
  });

  it("produces a document that still parses", () => {
    expect(() => parseDocument(moveSection(doc3, "sec-cover", 2))).not.toThrow();
  });
});

describe("insertSection", () => {
  const fresh: Section = {
    id: "sec-new",
    preset: { catalogId: "location", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Escribe aquí el título de esta sección" },
      },
      {
        id: "el-address",
        role: "body",
        hidden: false,
        slot: "address",
        value: { kind: "text", text: "Escribe aquí tu dirección" },
      },
    ],
  };

  it("puts the section exactly where it was asked to, shifting the rest down", () => {
    const next = insertSection(doc, "home", 1, fresh);
    expect(next.pages[0]?.sections.map((section) => section.id)).toEqual([
      "sec-cover",
      "sec-new",
      "sec-location",
    ]);
  });

  it("inserts at the very top when the index is 0", () => {
    const next = insertSection(doc, "home", 0, fresh);
    expect(next.pages[0]?.sections[0]?.id).toBe("sec-new");
  });

  it("clamps an index past the end rather than rejecting it", () => {
    // What "add below the last section" sends, with no special case at the caller.
    const next = insertSection(doc, "home", 99, fresh);
    expect(next.pages[0]?.sections.map((section) => section.id)).toEqual([
      "sec-cover",
      "sec-location",
      "sec-new",
    ]);
  });

  it("leaves the document it was given untouched", () => {
    insertSection(doc, "home", 1, fresh);
    expect(doc.pages[0]?.sections).toHaveLength(2);
  });

  it("leaves every other section's content as it was", () => {
    const next = insertSection(doc, "home", 0, fresh);
    expect(next.pages[0]?.sections[1]?.content).toEqual(cover.content);
  });

  it("refuses an id another section already holds", () => {
    // Section ids are unique document-wide, so a collision would break rule 5 — and the editor
    // would then have two sections answering to the same click.
    expect(() => insertSection(doc, "home", 0, { ...fresh, id: "sec-cover" })).toThrow(
      /already taken/,
    );
  });

  it("refuses a page that does not exist", () => {
    expect(() => insertSection(doc, "no-such-page", 0, fresh)).toThrow(/no page/);
  });

  it("refuses a section that would not survive parseDocument", () => {
    const broken = { ...fresh, content: [] } as unknown as Section;
    // Empty content is structurally fine; a layout referencing a missing element is not.
    const withBadLayout: Section = {
      ...broken,
      layout: {
        grid: { columns: 12 },
        placements: [{ elementId: "el-nowhere", column: 1, columnSpan: 12, row: 1, rowSpan: 1 }],
        breakpoints: {},
      },
    };
    expect(() => insertSection(doc, "home", 0, withBadLayout)).toThrow();
  });
});

describe("fillSlot and clearSlot", () => {
  const COVER_SLOTS = [
    "headline",
    "subheadline",
    "body",
    "image",
    "primaryAction",
    "secondaryAction",
  ];
  const text = (value: string) => ({ kind: "text" as const, text: value });

  function coverOf(next: RetorikaDocument) {
    const section = next.pages[0]?.sections.find((s) => s.id === "sec-cover");
    if (!section) throw new Error("no cover");
    return section;
  }
  function slots(next: RetorikaDocument): string[] {
    return coverOf(next).content.map((element) => element.slot);
  }

  it("creates an element for a slot the document does not have", () => {
    // The whole reason this exists: an optional slot nobody filled is absent, so it renders as
    // nothing, so there is nowhere on the page to click.
    const next = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "body",
      role: "body",
      value: text("Pásate a comer algo"),
      slotOrder: COVER_SLOTS,
    });
    const created = coverOf(next).content.find((element) => element.slot === "body");
    expect(created?.value).toEqual(text("Pásate a comer algo"));
    expect(created?.hidden).toBe(false);
    expect(created?.role).toBe("body");
  });

  it("puts the created element where the preset's slot order says, not at the end", () => {
    // Reading order is the one thing a grid layout does not decide.
    const next = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "subheadline",
      role: "subheading",
      value: text("Comer y beber"),
      slotOrder: COVER_SLOTS,
    });
    expect(slots(next)).toEqual(["headline", "subheadline", "image"]);
  });

  it("replaces the value when the slot is already there, keeping the element's id", () => {
    const before = coverOf(doc).content.find((element) => element.slot === "headline")?.id;
    const next = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "headline",
      role: "heading",
      value: text("Otro nombre"),
      slotOrder: COVER_SLOTS,
    });
    const headline = coverOf(next).content.find((element) => element.slot === "headline");
    expect(headline?.id).toBe(before);
    expect(headline?.value).toEqual(text("Otro nombre"));
  });

  it("mints an element id that is free inside the section", () => {
    const next = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "body",
      role: "body",
      value: text("Texto"),
      slotOrder: COVER_SLOTS,
    });
    const ids = coverOf(next).content.map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("el-body");
  });

  it("hides rather than removes when a field is emptied (rule 3)", () => {
    // The place to put it back has to survive, or someone who clears their phone number by
    // accident has no way to find where it was.
    const next = clearSlot(doc, { sectionId: "sec-cover", slot: "headline" });
    const headline = coverOf(next).content.find((element) => element.slot === "headline");
    expect(headline).toBeDefined();
    expect(headline?.hidden).toBe(true);
    expect(headline?.value).toEqual(text("Barbería El Corte"));
  });

  it("brings a hidden element back rather than creating a second one", () => {
    const hidden = clearSlot(doc, { sectionId: "sec-cover", slot: "headline" });
    const back = fillSlot(hidden, {
      sectionId: "sec-cover",
      slot: "headline",
      role: "heading",
      value: text("De vuelta"),
      slotOrder: COVER_SLOTS,
    });
    const matching = coverOf(back).content.filter((element) => element.slot === "headline");
    expect(matching).toHaveLength(1);
    expect(matching[0]?.hidden).toBe(false);
  });

  it("does nothing when clearing a slot that was never filled", () => {
    expect(clearSlot(doc, { sectionId: "sec-cover", slot: "body" })).toBe(doc);
  });

  it("refuses to create an occurrence out of order", () => {
    // Occurrences are positions in a sequence, not names: creating the second when there is no
    // first would silently make it the first, and the preset's geometry — which counts them the
    // same way — would place it where the first belongs.
    expect(() =>
      fillSlot(doc, {
        sectionId: "sec-cover",
        slot: "secondaryAction",
        occurrence: 1,
        role: "link",
        value: { kind: "link", text: "Cómo llegar", href: "#sec-location" },
        slotOrder: COVER_SLOTS,
      }),
    ).toThrow(/which has 0/);
  });

  it("creates the next occurrence of a slot that already has one", () => {
    const one = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "secondaryAction",
      role: "link",
      value: { kind: "link", text: "Primero", href: "#sec-location" },
      slotOrder: COVER_SLOTS,
    });
    const two = fillSlot(one, {
      sectionId: "sec-cover",
      slot: "secondaryAction",
      occurrence: 1,
      role: "link",
      value: { kind: "link", text: "Segundo", href: "#sec-location" },
      slotOrder: COVER_SLOTS,
    });
    const links = coverOf(two).content.filter((element) => element.slot === "secondaryAction");
    expect(links.map((element) => element.value?.kind === "link" && element.value.text)).toEqual([
      "Primero",
      "Segundo",
    ]);
    // And their ids do not collide.
    expect(new Set(links.map((element) => element.id)).size).toBe(2);
  });

  it("addresses the right occurrence when a slot holds several", () => {
    const one = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "secondaryAction",
      role: "link",
      value: { kind: "link", text: "Primero", href: "#sec-location" },
      slotOrder: COVER_SLOTS,
    });
    const twoIds = coverOf(one).content.filter((e) => e.slot === "secondaryAction");
    expect(twoIds).toHaveLength(1);
    const hiddenSecond = clearSlot(one, { sectionId: "sec-cover", slot: "secondaryAction" });
    expect(coverOf(hiddenSecond).content.find((e) => e.slot === "secondaryAction")?.hidden).toBe(
      true,
    );
  });

  it("leaves the document it was given untouched", () => {
    fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "body",
      role: "body",
      value: text("Texto"),
      slotOrder: COVER_SLOTS,
    });
    expect(coverOf(doc).content.some((element) => element.slot === "body")).toBe(false);
  });

  it("refuses a section that does not exist", () => {
    expect(() =>
      fillSlot(doc, {
        sectionId: "sec-nope",
        slot: "body",
        role: "body",
        value: text("Texto"),
        slotOrder: COVER_SLOTS,
      }),
    ).toThrow(/no section/);
    expect(() => clearSlot(doc, { sectionId: "sec-nope", slot: "body" })).toThrow(/no section/);
  });
});

describe("fillSlot and clearSlot inside a line", () => {
  // The two slots this exists for are real and named in the catalog: `SERVICES_ITEM_SLOTS` and
  // `PRICES_ITEM_SLOTS` each declare a `description` at 0..1, so a line nobody filled does not
  // carry one, nothing renders, and there is no text on the page to click. `prices.ts` names the
  // gap rather than widening it. This fixture is a carta with two lines and no description on
  // either — the state the questionnaire actually produces.
  const text = (value: string) => ({ kind: "text" as const, text: value });
  /** The order `PRICES_ITEM_SLOTS` declares: a description belongs between the name and the price. */
  const LINE_SLOTS = ["name", "description", "price"];

  const line = (n: number, dish: string) => ({
    id: `item-${n}`,
    elements: [
      {
        id: `el-item-${n}-name`,
        role: "heading" as const,
        hidden: false,
        slot: "name",
        value: text(dish),
      },
      {
        id: `el-item-${n}-price`,
        role: "body" as const,
        hidden: false,
        slot: "price",
        value: text("12 €"),
      },
    ],
  });

  const carta: Section = {
    id: "sec-prices",
    preset: { catalogId: "prices", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: text("Nuestra carta"),
      },
      {
        id: "el-lines",
        role: "list",
        hidden: false,
        slot: "lines",
        items: [line(1, "Ensaladilla"), line(2, "Solomillo")],
      },
    ],
  };

  const withCarta = documentWith([carta]);
  const at = { list: "lines", id: "item-1" };

  const linesOf = (next: RetorikaDocument) =>
    next.pages[0]?.sections[0]?.content.find((element) => element.role === "list")?.items ?? [];
  const lineSlots = (next: RetorikaDocument, index: number) =>
    linesOf(next)[index]?.elements.map((element) => element.slot) ?? [];
  /** The section's own slots. Every test below checks this too, because the failure worth catching
   * is not "nothing happened" — it is the slot landing on the **section** instead of in the line,
   * which is exactly what an ignored item address does and what reads as success from inside the
   * line. */
  const sectionSlots = (next: RetorikaDocument) =>
    (next.pages[0]?.sections[0]?.content ?? []).map((element) => element.slot);

  it("creates the description of a line that did not have one", () => {
    // Unreachable since sprint 1: this is the press that was missing, not a new capability.
    const next = fillSlot(withCarta, {
      sectionId: "sec-prices",
      slot: "description",
      item: at,
      role: "body",
      value: text("Con mayonesa de casa"),
      slotOrder: LINE_SLOTS,
    });
    const created = linesOf(next)[0]?.elements.find((element) => element.slot === "description");
    expect(created?.value).toEqual(text("Con mayonesa de casa"));
    expect(created?.hidden).toBe(false);
    expect(created?.role).toBe("body");
  });

  it("puts it between the name and the price, by the item's declared order", () => {
    const next = fillSlot(withCarta, {
      sectionId: "sec-prices",
      slot: "description",
      item: at,
      role: "body",
      value: text("Con mayonesa de casa"),
      slotOrder: LINE_SLOTS,
    });
    expect(lineSlots(next, 0)).toEqual(["name", "description", "price"]);
  });

  it("touches only the line it was given", () => {
    const next = fillSlot(withCarta, {
      sectionId: "sec-prices",
      slot: "description",
      item: at,
      role: "body",
      value: text("Con mayonesa de casa"),
      slotOrder: LINE_SLOTS,
    });
    expect(lineSlots(next, 1)).toEqual(["name", "price"]);
    expect(linesOf(next)[1]).toEqual(linesOf(withCarta)[1]);
    expect(sectionSlots(next)).toEqual(["headline", "lines"]);
  });

  it("mints an id free across the whole section, so two lines' descriptions cannot collide", () => {
    // Element ids are unique per section, items included (`checkSection`), which is why
    // `mintElementId` walks every level rather than one line.
    const one = fillSlot(withCarta, {
      sectionId: "sec-prices",
      slot: "description",
      item: at,
      role: "body",
      value: text("Con mayonesa de casa"),
      slotOrder: LINE_SLOTS,
    });
    const two = fillSlot(one, {
      sectionId: "sec-prices",
      slot: "description",
      item: { list: "lines", id: "item-2" },
      role: "body",
      value: text("Al punto"),
      slotOrder: LINE_SLOTS,
    });
    const ids = (two.pages[0]?.sections[0]?.content ?? []).flatMap((element) => [
      element.id,
      ...(element.items ?? []).flatMap((item) => item.elements.map((child) => child.id)),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    // Both descriptions are in their own line, and neither is on the section.
    expect(lineSlots(two, 0)).toContain("description");
    expect(lineSlots(two, 1)).toContain("description");
    expect(sectionSlots(two)).toEqual(["headline", "lines"]);
  });

  it("replaces the value when the line's slot is already there, keeping the element's id", () => {
    const next = fillSlot(withCarta, {
      sectionId: "sec-prices",
      slot: "name",
      item: at,
      role: "heading",
      value: text("Ensaladilla de la casa"),
      slotOrder: LINE_SLOTS,
    });
    const name = linesOf(next)[0]?.elements.find((element) => element.slot === "name");
    expect(name?.id).toBe("el-item-1-name");
    expect(name?.value).toEqual(text("Ensaladilla de la casa"));
    expect(lineSlots(next, 0)).toEqual(["name", "price"]);
  });

  it("hides rather than removes when a line's slot is emptied (rule 3)", () => {
    // A line's slot is a role, so rule 3 governs it. That is not in tension with `removeItem`
    // removing a whole line: a line is a repetition, not a role.
    const next = clearSlot(withCarta, { sectionId: "sec-prices", slot: "price", item: at });
    const price = linesOf(next)[0]?.elements.find((element) => element.slot === "price");
    expect(price).toBeDefined();
    expect(price?.hidden).toBe(true);
    expect(price?.value).toEqual(text("12 €"));
  });

  it("brings a hidden line slot back rather than creating a second one", () => {
    const hidden = clearSlot(withCarta, { sectionId: "sec-prices", slot: "price", item: at });
    const back = fillSlot(hidden, {
      sectionId: "sec-prices",
      slot: "price",
      item: at,
      role: "body",
      value: text("14 €"),
      slotOrder: LINE_SLOTS,
    });
    const matching = (linesOf(back)[0]?.elements ?? []).filter(
      (element) => element.slot === "price",
    );
    expect(matching).toHaveLength(1);
    expect(matching[0]?.hidden).toBe(false);
    expect(matching[0]?.value).toEqual(text("14 €"));
    expect(sectionSlots(back)).toEqual(["headline", "lines"]);
  });

  it("returns the document itself when clearing a line slot that was never filled", () => {
    // Reference equality, for the reason `setVariant`'s own test gives: it is what keeps the undo
    // arrow dark for a press that changed nothing.
    expect(clearSlot(withCarta, { sectionId: "sec-prices", slot: "description", item: at })).toBe(
      withCarta,
    );
  });

  it("refuses a list the section does not have, and a line the list does not have", () => {
    const fill = (item: { list: string; id: string }) => () =>
      fillSlot(withCarta, {
        sectionId: "sec-prices",
        slot: "description",
        item,
        role: "body",
        value: text("Texto"),
        slotOrder: LINE_SLOTS,
      });
    expect(fill({ list: "nope", id: "item-1" })).toThrow(/has no list in slot "nope"/);
    expect(fill({ list: "lines", id: "item-9" })).toThrow(/has no item "item-9"/);
    expect(() =>
      clearSlot(withCarta, {
        sectionId: "sec-prices",
        slot: "price",
        item: { list: "lines", id: "item-9" },
      }),
    ).toThrow(/has no item "item-9"/);
  });

  it("leaves a filled line valid against the document schema", () => {
    // Every verb in this file ends at `parseDocument`; reaching inside a line must not be the one
    // that produces something the gate would have refused.
    const next = fillSlot(withCarta, {
      sectionId: "sec-prices",
      slot: "description",
      item: at,
      role: "body",
      value: text("Con mayonesa de casa"),
      slotOrder: LINE_SLOTS,
    });
    const reparsed = parseDocument(next);
    expect(
      reparsed.pages[0]?.sections[0]?.content
        .find((element) => element.role === "list")
        ?.items?.[0]?.elements.map((element) => element.slot),
    ).toEqual(["name", "description", "price"]);
  });
});

describe("mintElementId", () => {
  it("uses the plain name when it is free", () => {
    expect(mintElementId(cover, "body")).toBe("el-body");
  });

  it("counts up when it is not", () => {
    expect(mintElementId(cover, "headline")).toBe("el-headline-2");
  });

  it("looks inside list items too, where ids also have to be unique", () => {
    const withList: Section = {
      ...cover,
      content: [
        ...cover.content,
        {
          id: "el-list",
          role: "list",
          hidden: false,
          slot: "services",
          items: [
            {
              id: "item-1",
              elements: [
                {
                  id: "el-body",
                  role: "body",
                  hidden: false,
                  slot: "description",
                  value: { kind: "text", text: "Dentro de una tarjeta" },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(mintElementId(withList, "body")).toBe("el-body-2");
  });
});

describe("setVariant", () => {
  it("swaps the composition and touches nothing else", () => {
    const edited = setVariant(doc, "sec-cover", "image-background");
    const section = edited.pages[0]?.sections.find((s) => s.id === "sec-cover");
    expect(section?.preset.variantId).toBe("image-background");
    expect(section?.preset.catalogId).toBe("cover");
    // The whole point of rule 1: geometry is declared per slot, so no element moves, none is
    // added and none is removed. Deep equality on the content array, not a spot check.
    expect(section?.content).toEqual(cover.content);
    expect(section?.source).toBe("catalog");
    expect(section?.layout).toBeNull();
  });

  it("leaves every other section alone", () => {
    const edited = setVariant(doc, "sec-cover", "image-background");
    expect(edited.pages[0]?.sections.find((s) => s.id === "sec-location")).toEqual(location);
  });

  it("hands back the very same document when the composition is already that one", () => {
    // What stops the undo arrow lighting up for a step that undoes to itself. Reference
    // equality, because that is what the editor's history checks.
    expect(setVariant(doc, "sec-cover", "image-right")).toBe(doc);
  });

  it("throws on a section id the document does not have", () => {
    expect(() => setVariant(doc, "no-such-section", "stacked")).toThrow(/no section/);
  });

  it("refuses a section carrying its own layout, rather than appearing to work", () => {
    // `build.ts` reads `section.layout ?? preset.layoutFor(variantId, …)`, so for a hand-designed
    // section the variant id decides nothing. Changing it would be a button that lights up and
    // moves not a pixel — and the error says what to do instead.
    const escalated: Section = {
      ...cover,
      source: "free",
      layout: {
        grid: { columns: 12 },
        placements: [{ elementId: "el-headline", column: 1, columnSpan: 12, row: 1, rowSpan: 1 }],
        breakpoints: { tablet: [], mobile: [] },
      },
    };
    expect(() => setVariant(documentWith([escalated]), "sec-cover", "image-background")).toThrow(
      /carries its own layout.*Revert it/s,
    );
  });

  it("accepts a variant id the catalog would reject, because schema cannot know the catalog", () => {
    // Deliberate, and the dependency arrow is why: schema must not import @retorika/catalog. The
    // editor only ever offers ids from `variantsFor`, and the catalog's own `unknownVariant`
    // throws at render if one ever slips through — loudly, rather than drawing a wrong layout.
    const edited = setVariant(doc, "sec-cover", "no-such-variant");
    expect(edited.pages[0]?.sections[0]?.preset.variantId).toBe("no-such-variant");
  });

  it("produces a document that still parses", () => {
    expect(() => parseDocument(setVariant(doc, "sec-location", "split"))).not.toThrow();
  });
});

describe("addItem and removeItem", () => {
  const listed: Section = {
    id: "sec-prices",
    preset: { catalogId: "prices", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Nuestra carta" },
      },
      {
        id: "el-lines",
        role: "list",
        hidden: false,
        slot: "lines",
        items: [
          {
            id: "item-1",
            elements: [
              {
                id: "el-item-1-name",
                role: "heading",
                hidden: false,
                slot: "name",
                value: { kind: "text", text: "Ensaladilla" },
              },
            ],
          },
        ],
      },
    ],
  };

  const withList = documentWith([listed]);
  /** What the catalog hands over: ids that are templates, not yet checked against a document. */
  const template = {
    id: "item",
    elements: [
      {
        id: "el-item-name",
        role: "heading" as const,
        hidden: false,
        slot: "name",
        value: { kind: "text" as const, text: "Escribe aquí el nombre" },
      },
    ],
  };

  const linesOf = (doc: RetorikaDocument) =>
    doc.pages[0]?.sections[0]?.content.find((element) => element.role === "list")?.items;

  it("appends a line at the end", () => {
    const edited = addItem(withList, "sec-prices", "lines", template);
    expect(linesOf(edited)).toHaveLength(2);
    expect(linesOf(edited)?.[0]?.id).toBe("item-1");
  });

  it("leaves the lines that were already there byte-for-byte alone", () => {
    const edited = addItem(withList, "sec-prices", "lines", template);
    expect(linesOf(edited)?.[0]).toEqual(linesOf(withList)?.[0]);
  });

  it("re-mints an element id the section already uses", () => {
    // Element ids are unique within a *section*, and a list item's elements are part of it — so
    // two lines built from the same catalog template would collide without this.
    const once = addItem(withList, "sec-prices", "lines", template);
    const twice = addItem(once, "sec-prices", "lines", template);
    const ids = twice.pages[0]?.sections[0]?.content
      .find((element) => element.role === "list")
      ?.items?.flatMap((item) => item.elements.map((element) => element.id));
    expect(new Set(ids).size).toBe(ids?.length);
  });

  it("re-mints an item id too", () => {
    const twice = addItem(
      addItem(withList, "sec-prices", "lines", { ...template, id: "item-1" }),
      "sec-prices",
      "lines",
      { ...template, id: "item-1" },
    );
    const itemIds = linesOf(twice)?.map((item) => item.id);
    expect(new Set(itemIds).size).toBe(3);
  });

  it("takes a named line away for good", () => {
    const two = addItem(withList, "sec-prices", "lines", template);
    const second = linesOf(two)?.[1]?.id;
    if (!second) throw new Error("no second line");
    const back = removeItem(two, "sec-prices", "lines", second);
    expect(linesOf(back)).toHaveLength(1);
    expect(linesOf(back)?.[0]?.id).toBe("item-1");
  });

  it("removes rather than hides, which is deliberate against rule 3", () => {
    // Rule 3 is about roles: a role hides so the place to put it back never disappears. A list
    // item is a repetition, not a slot, and a hidden line would sit in the document with nothing
    // able to show it again. ADR 0003 settled the same question for a whole section.
    const two = addItem(withList, "sec-prices", "lines", template);
    const second = linesOf(two)?.[1]?.id;
    if (!second) throw new Error("no second line");
    const back = removeItem(two, "sec-prices", "lines", second);
    expect(linesOf(back)?.some((item) => item.id === second)).toBe(false);
  });

  it("throws for a section that has no list in that slot", () => {
    expect(() => addItem(doc, "sec-cover", "lines", template)).toThrow(/no list in slot/);
  });

  it("throws for a section the document does not have", () => {
    expect(() => addItem(withList, "no-such", "lines", template)).toThrow(/no section/);
    expect(() => removeItem(withList, "no-such", "lines", "item-1")).toThrow(/no section/);
  });

  it("throws for a line that is not in the list", () => {
    expect(() => removeItem(withList, "sec-prices", "lines", "item-9")).toThrow(/no item/);
  });

  it("produces a document that still parses, both ways", () => {
    const two = addItem(withList, "sec-prices", "lines", template);
    expect(() => parseDocument(two)).not.toThrow();
    const second = linesOf(two)?.[1]?.id;
    if (!second) throw new Error("no second line");
    expect(() => parseDocument(removeItem(two, "sec-prices", "lines", second))).not.toThrow();
  });
});

describe("moveItem", () => {
  /**
   * A gallery of four photographs, which is the shape this verb exists for: the owner in the
   * second usability session asked to move images, and this is the half of that want document
   * rule 4 leaves open — the order of a list, never a position in pixels.
   */
  const gallery: Section = {
    id: "sec-gallery",
    preset: { catalogId: "gallery", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Nuestros platos" },
      },
      {
        id: "el-photos",
        role: "list",
        hidden: false,
        slot: "photos",
        items: ["a", "b", "c", "d"].map((key) => ({
          id: `item-${key}`,
          elements: [
            {
              id: `el-item-${key}-photo`,
              role: "image" as const,
              hidden: false,
              slot: "photo",
              value: { kind: "image" as const, src: `foto-${key}.jpg`, alt: `Foto ${key}` },
            },
          ],
        })),
      },
    ],
  };

  const withGallery = documentWith([gallery]);
  const order = (doc: RetorikaDocument) =>
    doc.pages[0]?.sections[0]?.content
      .find((element) => element.role === "list")
      ?.items?.map((item) => item.id);

  it("moves a photograph to the front, which is the whole point", () => {
    expect(order(moveItem(withGallery, "sec-gallery", "photos", "item-c", 0))).toEqual([
      "item-c",
      "item-a",
      "item-b",
      "item-d",
    ]);
  });

  it("moves one backwards by one, which is what an arrow on a line does", () => {
    expect(order(moveItem(withGallery, "sec-gallery", "photos", "item-b", 2))).toEqual([
      "item-a",
      "item-c",
      "item-b",
      "item-d",
    ]);
  });

  it("clamps past the end rather than refusing, exactly as moveSection does", () => {
    // A caller saying "to the end" passes the length or anything beyond it and does not have to
    // know which. The same courtesy `moveSection` already extends.
    expect(order(moveItem(withGallery, "sec-gallery", "photos", "item-a", 99))).toEqual([
      "item-b",
      "item-c",
      "item-d",
      "item-a",
    ]);
  });

  it("clamps below zero to the front, rather than counting back from the end", () => {
    // `-1` is the one input that tells the clamp apart from `splice`'s own behaviour, and it is
    // why the clamp is written rather than left to the array: `splice(-1, …)` inserts
    // second-to-last, which is not what anyone passing a negative index could possibly mean here.
    // Found by deleting the clamp and watching a `-5` case pass anyway — `splice` clamps that one
    // to zero by itself, so the test proved nothing.
    expect(order(moveItem(withGallery, "sec-gallery", "photos", "item-d", -1))).toEqual([
      "item-d",
      "item-a",
      "item-b",
      "item-c",
    ]);
  });

  it("moving a line to where it already is changes nothing, and does not throw", () => {
    // What lets the editor draw both arrows on every line without deciding, per line, whether
    // each one would do anything.
    expect(moveItem(withGallery, "sec-gallery", "photos", "item-b", 1)).toEqual(withGallery);
  });

  it("keeps every item whole — this reorders, it never rebuilds", () => {
    const moved = moveItem(withGallery, "sec-gallery", "photos", "item-c", 0);
    const first = moved.pages[0]?.sections[0]?.content.find((el) => el.role === "list")?.items?.[0];
    expect(first?.elements[0]?.value).toEqual({
      kind: "image",
      src: "foto-c.jpg",
      alt: "Foto c",
    });
  });

  it("leaves the section's own geometry alone", () => {
    // A list holds one placement whatever is inside it, so this is a change of content and not of
    // layout — which is the reason rule 4 has nothing to say about it.
    const moved = moveItem(withGallery, "sec-gallery", "photos", "item-d", 0);
    expect(moved.pages[0]?.sections[0]?.layout).toBeNull();
    expect(moved.pages[0]?.sections[0]?.content.map((el) => el.id)).toEqual([
      "el-headline",
      "el-photos",
    ]);
  });

  it("produces a document that still parses", () => {
    expect(() =>
      parseDocument(moveItem(withGallery, "sec-gallery", "photos", "item-c", 0)),
    ).not.toThrow();
  });

  it("refuses an unknown section, list or item, each by name", () => {
    expect(() => moveItem(withGallery, "no-such", "photos", "item-a", 0)).toThrow(/no section/);
    expect(() => moveItem(withGallery, "sec-gallery", "nope", "item-a", 0)).toThrow(
      /no list in slot/,
    );
    expect(() => moveItem(withGallery, "sec-gallery", "photos", "item-z", 0)).toThrow(/no item/);
  });
});
