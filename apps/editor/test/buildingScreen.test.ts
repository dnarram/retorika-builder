import { describe, expect, it } from "vitest";
import { holdFor, MIN_BUILDING_MS } from "../src/editor/buildingScreen.ts";

describe("holdFor — the building screen's minimum, as arithmetic", () => {
  it("is two seconds, David's decision of 13 October 2026", () => {
    expect(MIN_BUILDING_MS).toBe(2000);
  });

  it("waits what is left of the minimum after quick work", () => {
    expect(holdFor(1000, 1300)).toBe(1700);
  });

  it("waits nothing once the work itself took longer than the minimum", () => {
    expect(holdFor(1000, 3500)).toBe(0);
    expect(holdFor(1000, 3000)).toBe(0);
  });

  it("takes the whole minimum if the clock went backwards, rather than a negative wait", () => {
    expect(holdFor(5000, 4000)).toBe(2000);
  });

  it("honours a different minimum when handed one", () => {
    expect(holdFor(0, 100, 500)).toBe(400);
  });
});
