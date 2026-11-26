import { describe, expect, it } from "vitest";
import { boundOrderSentence, cardDropIndex, cardKeyIndex } from "../src/editor/listReorder.ts";
import es from "../src/locales/es.json" with { type: "json" };

const box = (left: number, top: number, size = 100) => ({
  left,
  top,
  right: left + size,
  bottom: top + size,
});
const press = (key: string) => ({ key, altKey: false, ctrlKey: false, metaKey: false });

describe("cardDropIndex", () => {
  it("lands on the card whose middle is nearest, in one column", () => {
    const column = [box(0, 0), box(0, 120), box(0, 240)];
    expect(cardDropIndex(column, { x: 50, y: 10 })).toBe(0);
    expect(cardDropIndex(column, { x: 50, y: 175 })).toBe(1);
    expect(cardDropIndex(column, { x: 50, y: 900 })).toBe(2);
  });

  it("lands in two dimensions in a grid that wraps", () => {
    // Two across, two down: the fourth card is down and to the right.
    const grid = [box(0, 0), box(120, 0), box(0, 120), box(120, 120)];
    expect(cardDropIndex(grid, { x: 170, y: 170 })).toBe(3);
    expect(cardDropIndex(grid, { x: 40, y: 160 })).toBe(2);
    expect(cardDropIndex(grid, { x: 175, y: 30 })).toBe(1);
  });
});

describe("cardKeyIndex", () => {
  it("moves one card before or after with either pair of arrows, held inside the list", () => {
    expect(cardKeyIndex(1, 3, press("ArrowLeft"))).toBe(0);
    expect(cardKeyIndex(1, 3, press("ArrowUp"))).toBe(0);
    expect(cardKeyIndex(1, 3, press("ArrowRight"))).toBe(2);
    expect(cardKeyIndex(1, 3, press("ArrowDown"))).toBe(2);
    expect(cardKeyIndex(0, 3, press("ArrowLeft"))).toBeNull();
    expect(cardKeyIndex(2, 3, press("ArrowDown"))).toBeNull();
  });

  it("leaves every other key and every platform modifier alone", () => {
    expect(cardKeyIndex(1, 3, press("Enter"))).toBeNull();
    expect(cardKeyIndex(1, 3, { ...press("ArrowLeft"), metaKey: true })).toBeNull();
  });
});

describe("boundOrderSentence — true for every number (David's adjustment 3)", () => {
  it("names the list alone for one section, and the count for several", () => {
    expect(boundOrderSentence(1, "Qué hago")).toBe(
      es["editor.help.grip.boundOne"].replace("{list}", "Qué hago"),
    );
    expect(boundOrderSentence(2, "Qué hago")).toBe(
      "Cambias el orden de la lista «Qué hago», que se ve en 2 secciones",
    );
    expect(boundOrderSentence(5, "Qué hago")).toContain("en 5 secciones");
  });
});
