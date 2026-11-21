import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { hexToOklch } from "@retorika/tokens";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { colourDistance, dominantColours, parseHex, toHex } from "../src/editor/logoPalette.ts";
import { sampleInChromium } from "../test/chromiumSample.ts";

/**
 * **The logo David reported, read the way the editor reads it** (sprint 40 día 3, encargo 1).
 *
 * «He probado con el logo DNR y el editor no capta ningún naranja.» Measured on 20 November 2026: the
 * orange was 29.5 % of the counted pixels, split across 35 buckets, the largest 8.2 % — under the
 * tenth the old rule asked of one bucket — and the site came out navy and brown. These two files are
 * his and never enter the repository (his adjustment 5): this suite exists only when
 * `RETORIKA_BRAND_LOGOS` names the folder that holds them, and the PR pastes what it printed.
 *
 * His conditions for the assertions: the flat export's second tint is **its own colour** — the most
 * populous bucket of the orange family, `#944C23` — within ΔE 5 (neither file contains the reference
 * `#B95319`: the nearest opaque pixel is ΔE 11.2 from it, the family's bucket 18.8, and the ADR note
 * says so); the «Medio» finish, with its metallic ramps, asserts only that a second tint exists in the
 * orange family, because a client's logo carries gradients too.
 */

const FOLDER = process.env["RETORIKA_BRAND_LOGOS"] ?? "";
const ROOT = join(import.meta.dirname, "..", "..", "..");
const folder = isAbsolute(FOLDER) ? FOLDER : join(ROOT, FOLDER);
/** The flat export and the «Medio» finish, by the names they were handed over with. */
const FLAT = join(folder, "SimpleClaro.png");
const MEDIO = join(folder, "logo-ac53db85.png");

/** The navy of the letters and the orange of the line, as the flat export reads. */
const NAVY = "#162642";
const ORANGE = "#944C23";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  // An explicit error, never a skip: the variable was set to measure these two files.
  for (const file of [FLAT, MEDIO]) {
    if (!existsSync(file)) throw new Error(`RETORIKA_BRAND_LOGOS: ${file} is not there`);
  }
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.goto("about:blank");
});

afterAll(async () => {
  await browser?.close();
});

const read = async (file: string) =>
  dominantColours(await sampleInChromium(page, readFileSync(file)));

describe("David's DNR logo, sampled as the editor samples it", () => {
  it("reads the flat export's navy and its orange, the orange its own flat colour within ΔE 5", async () => {
    const [brand, second] = await read(FLAT);
    console.log(`SimpleClaro.png → ${JSON.stringify([brand, second].map((c) => c && toHex(c)))}`);
    expect(brand && colourDistance(brand, parseHex(NAVY))).toBeLessThanOrEqual(5);
    expect(second, "no second tint: the orange is lost again").toBeDefined();
    const distance = second ? colourDistance(second, parseHex(ORANGE)) : Number.POSITIVE_INFINITY;
    console.log(`  second tint ΔE to ${ORANGE}: ${distance.toFixed(2)}`);
    expect(distance).toBeLessThanOrEqual(5);
  });

  it("finds a second tint in the orange family on the «Medio» finish, ramps and all", async () => {
    const [brand, second] = await read(MEDIO);
    console.log(`logo-ac53db85.png → ${JSON.stringify([brand, second].map((c) => c && toHex(c)))}`);
    expect(brand && colourDistance(brand, parseHex(NAVY))).toBeLessThanOrEqual(5);
    expect(second, "no second tint: the orange is lost again").toBeDefined();
    const hue = second ? hexToOklch(toHex(second)).h : Number.NaN;
    console.log(`  second tint hue: ${hue.toFixed(1)}°`);
    expect(hue).toBeGreaterThanOrEqual(20);
    expect(hue).toBeLessThanOrEqual(70);
  });
});
