import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { blankItem, blankSection } from "../src/blank.ts";
import { presetFor, SEARCH_ALIASES, sectionsMatching } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };
import {
  PRICES_ID,
  PRICES_ITEM_SLOTS,
  PRICES_LINES,
  PRICES_SLOTS,
  PRICES_VARIANTS,
  pricesPreset,
} from "../src/prices.ts";

/**
 * "Precios" — the seventh catalog section, and the one both usability sessions asked for.
 *
 * What is being pinned here is mostly the shape of one line, because that is where the decisions
 * are: a price that is free text, present in the structure and optional on the page.
 */

const line = (
  id: string,
  slot: string,
  role: "heading" | "body",
  text: string,
): ContentElement => ({
  id,
  role,
  hidden: false,
  slot,
  value: { kind: "text", text },
});

function section(items: { id: string; elements: ContentElement[] }[]): Section {
  return {
    id: "sec-prices",
    preset: { catalogId: PRICES_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      line("el-headline", "headline", "heading", "Nuestra carta"),
      { id: "el-lines", role: "list", hidden: false, slot: "lines", items },
    ],
  };
}

const ensaladilla = {
  id: "item-1",
  elements: [
    line("el-1-name", "name", "heading", "Ensaladilla"),
    line("el-1-price", "price", "body", "6,50 €"),
  ],
};

describe("the shape of a price list", () => {
  it("is a title, an optional introduction and a list", () => {
    expect(PRICES_SLOTS).toEqual([
      { slot: "headline", role: "heading", min: 1, max: 1 },
      { slot: "intro", role: "body", min: 0, max: 1 },
      { slot: "lines", role: "list", min: 1, max: 1 },
    ]);
  });

  it("gives a line a name, an optional description and a price", () => {
    expect(PRICES_ITEM_SLOTS).toEqual([
      { slot: "name", role: "heading", min: 1, max: 1 },
      { slot: "description", role: "body", min: 0, max: 1 },
      { slot: "price", role: "body", min: 1, max: 1 },
    ]);
  });

  it("makes the price free text rather than a number", () => {
    // «según mercado» and «desde 12 €» are real prices on real cartas, and a number would have to
    // carry a currency and a format this product has no standing to decide.
    const price = PRICES_ITEM_SLOTS.find((slot) => slot.slot === "price");
    expect(price?.role).toBe("body");
  });

  it("keeps the price in the structure so a new line has somewhere to type one", () => {
    // The fields panel does not reach into list items, so a `min: 0` price would exist in no new
    // line and nothing in the editor could create it. Required here, optional on the page: an
    // emptied price renders nothing at all.
    expect(PRICES_ITEM_SLOTS.find((slot) => slot.slot === "price")?.min).toBe(1);
  });

  it("holds twelve lines where «Qué hago» holds six", () => {
    expect(PRICES_LINES).toEqual({ min: 1, max: 12 });
  });

  it("is registered in the catalog", () => {
    expect(presetFor(PRICES_ID)).toBe(pricesPreset);
    expect(pricesPreset.itemRange).toEqual(PRICES_LINES);
  });

  it("accepts a list with one line, which is how one is born", () => {
    expect(checkAgainstPreset(section([ensaladilla]), pricesPreset)).toEqual([]);
  });
});

describe("a blank price list", () => {
  const blank = blankSection(PRICES_ID, "stacked", "sec-prices");

  it("arrives valid against its own preset", () => {
    expect(checkAgainstPreset(blank, pricesPreset)).toEqual([]);
  });

  it("arrives with exactly one line", () => {
    const list = blank.content.find((element) => element.role === "list");
    expect(list?.items).toHaveLength(1);
  });

  it("gives that line a name and a price to type over", () => {
    const list = blank.content.find((element) => element.role === "list");
    const slots = list?.items?.[0]?.elements.map((element) => element.slot);
    expect(slots).toEqual(["name", "price"]);
  });

  it("marks the price with an instruction that could never be mistaken for a price", () => {
    // The condition this section shipped under: a marker that reads like a real figure would be a
    // published page quoting «0,00 €» for a dish. No digits, no currency sign.
    const marker = es["section.prices.placeholder.item.price"];
    expect(marker).toBe("Escribe aquí el precio");
    expect(marker).not.toMatch(/[0-9]/);
    expect(marker).not.toMatch(/[€$£]/);
  });

  it("marks every other placeholder as an instruction too", () => {
    for (const [key, text] of Object.entries(es)) {
      if (!key.startsWith("section.prices.placeholder.")) continue;
      expect(text, key).toMatch(/^Escribe aquí/);
    }
  });
});

describe("blankItem", () => {
  it("builds one more line of the same shape", () => {
    expect(blankItem(PRICES_ID).elements.map((element) => element.slot)).toEqual(["name", "price"]);
  });

  it("refuses a section that holds no lines at all", () => {
    expect(() => blankItem("cover")).toThrow(/declares no itemSlots/);
  });
});

describe("compositions", () => {
  it("are the two this section ships with", () => {
    expect(PRICES_VARIANTS).toEqual(["stacked", "side"]);
  });

  it.each(PRICES_VARIANTS)("%s refuses an unknown variant rather than defaulting", (variantId) => {
    expect(variantId).toBeTruthy();
    expect(() => pricesPreset.layoutFor("carta", [])).toThrow(/Unknown variant/);
  });
});

describe("search", () => {
  it("answers the words a restaurant owner would actually type", () => {
    expect(SEARCH_ALIASES["prices"]).toEqual(
      expect.arrayContaining(["carta", "menú", "platos", "tarifas", "precios"]),
    );
  });

  it("puts «carta» on Precios first and «Qué hago» behind it", () => {
    // The condition this section shipped under, and the one thing about the naming that is
    // testable: both sections legitimately answer to the word, and the order is the decision.
    // `services` has claimed «carta» since sprint 1 and keeps it — an owner listing dishes with
    // no prices should still find the section that does that.
    expect(sectionsMatching("carta")).toEqual(["prices", "services"]);
  });

  it("sends «menú» and «platos» to Precios and nowhere else", () => {
    expect(sectionsMatching("menú")).toEqual(["prices"]);
    expect(sectionsMatching("platos")).toEqual(["prices"]);
  });

  it("ignores accents and case, because nobody types «Menú» the same way twice", () => {
    expect(sectionsMatching("MENU")).toEqual(["prices"]);
    expect(sectionsMatching("  Carta ")).toEqual(["prices", "services"]);
  });

  it("still does what the dossier asked of it first", () => {
    // «si busca "hero" encuentra Portada» — the sentence this whole mechanism comes from.
    expect(sectionsMatching("hero")).toEqual(["cover"]);
  });

  it("answers nothing rather than guessing for a word no section claims", () => {
    expect(sectionsMatching("newsletter")).toEqual([]);
    expect(sectionsMatching("   ")).toEqual([]);
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.prices.name"]).toBe("Precios");
    expect(es["section.prices.description"]).toBeTruthy();
    for (const slot of PRICES_SLOTS) {
      expect(es).toHaveProperty([`section.prices.slot.${slot.slot}`]);
    }
    for (const variant of PRICES_VARIANTS) {
      expect(es).toHaveProperty([`section.prices.variant.${variant}`]);
    }
  });

  it("names the section «Precios» and says in its description that a carta is one", () => {
    // The naming decision, in the one place an owner reads it. The menu name is the same for
    // everyone; what changes by sector is the heading on the page, which comes from the bank.
    expect(es["section.prices.name"]).toBe("Precios");
    expect(es["section.prices.description"]).toContain("carta");
  });
});
