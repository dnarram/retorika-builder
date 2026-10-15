import { describe, expect, it } from "vitest";
import {
  CAROUSEL_CARD_SHARE,
  carouselGutter,
  centredScrollLeft,
  DESKTOP_THUMBNAIL_SCALE,
  nearestCard,
  THREE_COLUMNS_FROM,
  THUMBNAIL_PAGE,
  thumbnailHeight,
  thumbnailScale,
} from "../src/questionnaire/proposalsRow.ts";

/**
 * The proposals row's numbers (sprint 21 day 2). The browser walk «nada sobresale en un móvil»
 * is what proves the screen; this pins the arithmetic it relies on, so a wrong constant fails in
 * milliseconds rather than after a four-minute suite.
 */
describe("the thumbnail's scale", () => {
  it("shows the whole page in whatever width the card has", () => {
    // The three widths measured on 15 October 2026, when the constant 0.28 showed 10 %, 17 % and
    // 52 % of the page: with the measured scale each shows all of it.
    for (const width of [37, 60, 186, 358, 1180 / 3]) {
      expect(thumbnailScale(width) * THUMBNAIL_PAGE.width).toBeCloseTo(width, 6);
    }
  });

  it("is the mockup's own 0.28 for the mockup's own card, so the desktop does not move", () => {
    // 1180px row, 20px gaps, 14px of card padding each side: the mockup's thumbnail is 358 wide.
    expect(thumbnailScale(358)).toBeCloseTo(DESKTOP_THUMBNAIL_SCALE, 2);
  });

  it("falls back to the mockup's scale before anything is measured", () => {
    expect(thumbnailScale(0)).toBe(DESKTOP_THUMBNAIL_SCALE);
  });

  it("gives the box exactly the shrunk page's height plus its hairlines, so nothing is cut", () => {
    const scale = thumbnailScale(300);
    expect(thumbnailHeight(scale)).toBeCloseTo(THUMBNAIL_PAGE.height * scale + 2, 9);
  });
});

describe("the carousel", () => {
  it("starts where three cards stop being readable", () => {
    // Below 900 each of three columns in an 820px row is under 273px; ADR 0042 §2.
    expect(THREE_COLUMNS_FROM).toBe(900);
  });

  it("leaves room for the next card to peek, and a gutter that centres the first and the last", () => {
    expect(CAROUSEL_CARD_SHARE).toBeGreaterThan(0.75);
    expect(CAROUSEL_CARD_SHARE).toBeLessThan(0.95);
    // Two gutters and a card make the row: the gutter is what the card leaves, halved.
    expect(carouselGutter()).toBe("10%");
  });

  it("centres a card, and never asks the row to scroll to a negative position", () => {
    // Row 343 wide (a 390 phone less its padding), cards 274 (80 %), 12px apart, gutter 34:
    // the second card starts at 320 and is centred with the row scrolled 285.5.
    expect(centredScrollLeft(320, 274, 343)).toBeCloseTo(285.5, 6);
    expect(centredScrollLeft(34, 274, 343)).toBe(0);
  });

  it("names the nearest card for a scroll position, clamped to the three there are", () => {
    const stride = 343;
    expect(nearestCard(0, stride, 3)).toBe(0);
    expect(nearestCard(170, stride, 3)).toBe(0);
    expect(nearestCard(172, stride, 3)).toBe(1);
    expect(nearestCard(686, stride, 3)).toBe(2);
    expect(nearestCard(5000, stride, 3)).toBe(2);
    expect(nearestCard(100, 0, 3)).toBe(0);
  });
});
