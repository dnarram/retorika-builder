import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { blankSection } from "../src/blank.ts";
import { presetFor, SEARCH_ALIASES } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };
import {
  TEAM_ID,
  TEAM_ITEM_SLOTS,
  TEAM_MEMBERS,
  TEAM_SLOTS,
  TEAM_VARIANTS,
  teamPreset,
} from "../src/team.ts";

const headline: ContentElement = {
  id: "el-headline",
  role: "heading",
  hidden: false,
  slot: "headline",
  value: { kind: "text", text: "Quién somos" },
};
const intro: ContentElement = {
  id: "el-intro",
  role: "body",
  hidden: false,
  slot: "intro",
  value: { kind: "text", text: "Las personas detrás del mostrador." },
};

function member(n: number): { id: string; elements: ContentElement[] } {
  return {
    id: `item-${n}`,
    elements: [
      {
        id: `el-member-${n}-photo`,
        role: "image",
        hidden: false,
        slot: "photo",
        value: { kind: "image", src: `persona-${n}.jpg`, alt: `Foto de la persona ${n}` },
      },
      {
        id: `el-member-${n}-name`,
        role: "heading",
        hidden: false,
        slot: "name",
        value: { kind: "text", text: `Persona ${n}` },
      },
      {
        id: `el-member-${n}-job`,
        role: "body",
        hidden: false,
        slot: "job",
        value: { kind: "text", text: `Puesto ${n}` },
      },
    ],
  };
}

const list: ContentElement = {
  id: "el-members",
  role: "list",
  hidden: false,
  slot: "members",
  items: [member(1), member(2)],
};

function section(content: ContentElement[], variantId = "stacked"): Section {
  return {
    id: "sec-team",
    preset: { catalogId: TEAM_ID, variantId },
    source: "catalog",
    content,
    layout: null,
  };
}

describe("the Equipo preset", () => {
  it("declares its slots with cardinality: a title, an optional intro, and one list", () => {
    expect(TEAM_SLOTS).toEqual([
      { slot: "headline", role: "heading", min: 1, max: 1 },
      { slot: "intro", role: "body", min: 0, max: 1 },
      { slot: "members", role: "list", min: 1, max: 1 },
    ]);
  });

  it("declares the shape of one person: a photo, a name and a job, all required", () => {
    // All three required, unlike a name-only card: a list item's optional slot cannot be reached
    // from this editor (`blank.ts`'s own comment says so), so an optional job would be a field
    // nobody could ever fill in.
    expect(TEAM_ITEM_SLOTS).toEqual([
      { slot: "photo", role: "image", min: 1, max: 1 },
      { slot: "name", role: "heading", min: 1, max: 1 },
      { slot: "job", role: "body", min: 1, max: 1 },
    ]);
  });

  it("stops at six people, the same bound Qué hago and Opiniones already draw", () => {
    expect(TEAM_MEMBERS).toEqual({ min: 1, max: 6 });
  });

  it("is registered in the catalog", () => {
    expect(presetFor(TEAM_ID)).toBe(teamPreset);
  });

  it("accepts a section with a title, an intro and a list of people", () => {
    expect(checkAgainstPreset(section([headline, intro, list]), teamPreset)).toEqual([]);
  });

  it("accepts a section with no intro, which is optional", () => {
    expect(checkAgainstPreset(section([headline, list]), teamPreset)).toEqual([]);
  });

  it("reports a missing list rather than tolerating it", () => {
    const violations = checkAgainstPreset(section([headline]), teamPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/at least 1/);
  });

  it("counts a hidden job towards the minimum, so a card without one stays valid", () => {
    // Rule 3: hidden, never removed. An owner who leaves a job title off a card hides the
    // element instead of deleting it, and `checkAgainstPreset` judges top-level slots only — the
    // item's own rule is TEAM_ITEM_SLOTS, and this fixture honours it.
    const noJob: ContentElement = {
      ...list,
      items: [
        {
          id: "item-1",
          elements: member(1).elements.map((element) =>
            element.slot === "job" ? { ...element, hidden: true } : element,
          ),
        },
      ],
    };
    expect(checkAgainstPreset(section([headline, noJob]), teamPreset)).toEqual([]);
  });
});

describe("compositions", () => {
  it("are the two this section ships with", () => {
    expect(TEAM_VARIANTS).toEqual(["stacked", "side"]);
  });

  it.each(TEAM_VARIANTS)("%s places every element the document provides", (variantId) => {
    const layout = teamPreset.layoutFor(variantId, [headline, intro, list]);
    expect(layout.placements.map((p) => p.elementId).sort()).toEqual([
      "el-headline",
      "el-intro",
      "el-members",
    ]);
  });

  it.each(TEAM_VARIANTS)("%s keeps every placement inside the twelve columns", (id) => {
    for (const placement of teamPreset.layoutFor(id, [headline, intro, list]).placements) {
      expect(placement.column + placement.columnSpan - 1).toBeLessThanOrEqual(12);
    }
  });

  it("differ in geometry", () => {
    const [first, second] = TEAM_VARIANTS.map(
      (variantId) => teamPreset.layoutFor(variantId, [headline, intro, list]).placements,
    );
    expect(first).not.toEqual(second);
  });

  it("place the list only, never the elements inside its items", () => {
    const ids = teamPreset
      .layoutFor("stacked", [headline, intro, list])
      .placements.map((p) => p.elementId);
    expect(ids.some((id) => id.startsWith("el-member-"))).toBe(false);
  });

  it("refuse an unknown variant instead of falling back to a default", () => {
    expect(() => teamPreset.layoutFor("split", [headline, list])).toThrow(/Unknown variant/);
  });
});

describe("added, never generated", () => {
  it("can be born blank, which is the only way it ever appears", () => {
    // None of the five questions can ask who works here — a name and a face belong to the
    // people themselves — so the generator never produces this section, exactly like Opiniones.
    const blank = blankSection(TEAM_ID, "stacked", "sec-new");
    expect(checkAgainstPreset(blank, teamPreset)).toEqual([]);
  });

  it("is born with one person, carrying all three of a card's required slots", () => {
    const blank = blankSection(TEAM_ID, "stacked", "sec-new");
    const members = blank.content.find((element) => element.role === "list");
    expect(members?.items).toHaveLength(1);
    expect(members?.items?.[0]?.elements.map((element) => element.slot)).toEqual([
      "photo",
      "name",
      "job",
    ]);
  });

  it("never invents a person who does not exist", () => {
    // The whole point of the section, and the reason it is added and never generated: a marker
    // reading "Encargada de sala" under a stock photo would be a fabricated employee on a real
    // business's page, published unedited. Every marker here is an instruction, and says so.
    for (const key of ["item.name", "item.job", "headline"] as const) {
      const text = es[`section.team.placeholder.${key}` as keyof typeof es];
      expect(text).toMatch(/^Escribe aquí /);
    }
  });
});

describe("search", () => {
  it("finds Equipo from the words a business owner would type", () => {
    expect(SEARCH_ALIASES["team"]).toEqual(
      expect.arrayContaining(["equipo", "quién soy", "sobre nosotros"]),
    );
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.team.name"]).toBe("Equipo");
    expect(es["section.team.description"]).toBeTruthy();
    for (const slot of TEAM_SLOTS) {
      expect(es).toHaveProperty([`section.team.slot.${slot.slot}`]);
    }
    for (const slot of TEAM_ITEM_SLOTS) {
      expect(es).toHaveProperty([`section.team.item.${slot.slot}`]);
    }
    for (const variant of TEAM_VARIANTS) {
      expect(es).toHaveProperty([`section.team.variant.${variant}`]);
    }
  });
});
