import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What the application serves of the brand, and what it asks for.
 *
 * **Nothing checked this, and the day it changed is exactly when something should have.** The three
 * `<img>` tags that draw the logo are in three different files, the files they name are written by a
 * script, and between them there was only the habit of keeping the two in step. On 15 October 2026
 * the pair changed from PNG to SVG; a fourth placement written next month against the old name
 * would 404 in production and nothing would say so — the overflow walk measures rectangles, and a
 * missing image still has the one its `width` and `height` reserve.
 *
 * Read from the source and from `public/`, never from a running server: the question is «do these
 * two agree», and a browser is not needed to answer it.
 */

const EDITOR = join(import.meta.dirname, "..");
const SERVED = join(EDITOR, "public", "brand");
const SOURCE = join(import.meta.dirname, "..", "..", "..", "docs", "design", "brand");

/** Every file under `apps/editor/src` that names a brand file, and what it names. */
const PLACEMENTS = [
  "src/app/page.tsx",
  "src/questionnaire/ui.tsx",
  "src/editor/EditorShell.tsx",
].flatMap((file) => {
  const text = readFileSync(join(EDITOR, file), "utf8");
  return [...text.matchAll(/src="\/brand\/([^"]+)"/g)].map((found) => ({
    file,
    asset: found[1] as string,
  }));
});

describe("the brand files the application asks for", () => {
  it("names three, which is the lockup twice and the mark once", () => {
    // Pinned as a count so a fourth placement has to come through this file, where it will be
    // told which names exist. The rule for which goes where is in `docs/design/brand/README.md`.
    expect(PLACEMENTS.map((at) => at.asset)).toEqual([
      "retorika-lockup.svg",
      "retorika-lockup.svg",
      "retorika-mark.svg",
    ]);
  });

  for (const { file, asset } of PLACEMENTS) {
    it(`${file} asks for a file that is served`, () => {
      expect(existsSync(join(SERVED, asset)), `public/brand/${asset} does not exist`).toBe(true);
    });
  }

  /**
   * The favicon is the one piece of this logo the application still serves as pixels, and it is a
   * decision rather than an oversight: Safari renders no SVG favicon, and 32 pixels is not a size a
   * vector wins at. Next serves `app/icon.png` by convention, with no markup anywhere to grep for
   * — which is why it is asserted here rather than left to be noticed.
   */
  it("still serves the tab icon as a PNG, which is the one place pixels win", () => {
    expect(existsSync(join(EDITOR, "src", "app", "icon.png"))).toBe(true);
  });

  it("serves no pixels of the logo anywhere else", () => {
    const pixels = readdirSync(SERVED).filter((name) => !name.endsWith(".svg"));
    expect(pixels, "public/brand still carries a raster").toEqual([]);
  });
});

describe("the vectors themselves", () => {
  for (const name of ["retorika-mark.svg", "retorika-lockup.svg"]) {
    const svg = readFileSync(join(SERVED, name), "utf8");

    /**
     * An `<img>` reserves its space from the intrinsic size, and an SVG's intrinsic size is its
     * `width`/`height` attributes. Without them the browser falls back to 300 × 150 until the file
     * arrives, and every layout that names only a `width` would reflow when it does — which is the
     * one thing the overflow walk would catch late and loudly.
     */
    it(`${name} carries the size an \`<img>\` reserves its box from`, () => {
      expect(svg).toMatch(/<svg[^>]*\bviewBox="/);
      expect(svg).toMatch(/<svg[^>]*\bwidth="\d/);
      expect(svg).toMatch(/<svg[^>]*\bheight="\d/);
    });

    it(`${name} says what it is, for anything that reads it on its own`, () => {
      expect(svg).toMatch(/<title>[^<]+<\/title>/);
    });

    /**
     * **The «R»'s colour is a raster inside the vector**, and it has to travel inside it: an SVG
     * loaded through `<img>` is a closed document that fetches nothing — no external image, no
     * stylesheet, no font. An `href` pointing anywhere else would draw a hole in the logo on every
     * screen but the one it was tested on.
     */
    it(`${name} fetches nothing of its own`, () => {
      for (const href of [...svg.matchAll(/href="([^"]*)"/g)].map((found) => found[1] ?? "")) {
        expect(href.startsWith("data:"), `${name} points at «${href}»`).toBe(true);
      }
    });

    it(`${name} is the file \`pnpm brand:vector\` wrote, copied and not edited`, () => {
      expect(readFileSync(join(SERVED, name), "utf8")).toBe(
        readFileSync(join(SOURCE, name), "utf8"),
      );
    });
  }
});

describe("the one script that writes what is served", () => {
  const script = readFileSync(
    join(import.meta.dirname, "..", "..", "..", "scripts", "brand-assets.ts"),
    "utf8",
  );

  it("copies both vectors and writes the favicon", () => {
    expect(script).toContain("retorika-mark.svg");
    expect(script).toContain("retorika-lockup.svg");
    expect(script).toContain("icon.png");
  });

  /**
   * **It may name the tracer and must not run it.** Two scripts writing one logo is the drift the
   * README warns about; two writing one directory is worse. The first version of this forbade the
   * string «brand-vector» outright and failed on the sentence explaining the division of labour —
   * a guard that cannot tell a reference from a dependency forbids writing things down.
   */
  it("reaches for nothing of its own but the PNG codec", () => {
    const local = [...script.matchAll(/from "([^"]+)"/g)]
      .map((found) => found[1] ?? "")
      .filter((from) => from.startsWith("."));
    expect(local).toEqual(["./png.ts"]);
  });
});
