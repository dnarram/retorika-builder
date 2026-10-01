import { describe, expect, it } from "vitest";
import { familiesOf, TYPE_PAIRS } from "../src/typography.ts";

/**
 * Option C of issue #9, as something a test can fail on: **what each pair is when its letter does
 * not arrive.**
 *
 * The three pairs keep their heading apart from their body in three different ways, each declared on
 * the pair itself. These assertions are the three ways, so that a later edit to a stack cannot
 * quietly move a pair from one kind to another — which is exactly how `classic-display` came to
 * render heading and body in the same face without anybody deciding that it should.
 *
 * What is **not** asserted here is which platform font a stack resolves to. That is not a property of
 * these strings, it belongs to whoever's machine renders them, and it is measured in
 * `packages/renderer/test/overflow.browser.test.ts` and recorded in ADR 0028.
 */

const GENERICS = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"];

const heading = (id: string) => {
  const pair = TYPE_PAIRS.find((p) => p.id === id);
  if (!pair) throw new Error(`no type pair ${id}`);
  return familiesOf(pair.fonts["font.heading"]);
};
const body = (id: string) => {
  const pair = TYPE_PAIRS.find((p) => p.id === id);
  if (!pair) throw new Error(`no type pair ${id}`);
  return familiesOf(pair.fonts["font.body"]);
};

describe("familiesOf", () => {
  it("splits a stack into unquoted families, in order", () => {
    expect(familiesOf("'Playfair Display', Didot, Georgia, serif")).toEqual([
      "Playfair Display",
      "Didot",
      "Georgia",
      "serif",
    ]);
  });

  it("handles double quotes and odd spacing the same way", () => {
    expect(familiesOf('  "Big Caslon" ,Georgia ,  serif ')).toEqual([
      "Big Caslon",
      "Georgia",
      "serif",
    ]);
  });
});

describe("every pair declares how it survives getting no font", () => {
  it("names one of the three kinds", () => {
    for (const pair of TYPE_PAIRS) {
      expect(["generic", "named", "weightAndSize"], pair.id).toContain(pair.contrast);
    }
  });

  it("ends both of its stacks in a generic keyword, so something always resolves", () => {
    // Without this a browser with none of the named families falls to its own default for one side
    // and possibly a different default for the other, which is a result nobody chose.
    for (const pair of TYPE_PAIRS) {
      for (const key of ["font.heading", "font.body"] as const) {
        const families = familiesOf(pair.fonts[key]);
        expect(GENERICS, `${pair.id} ${key}`).toContain(families[families.length - 1]);
      }
    }
  });

  it("never declares the same family twice in one stack", () => {
    for (const pair of TYPE_PAIRS) {
      for (const key of ["font.heading", "font.body"] as const) {
        const families = familiesOf(pair.fonts[key]);
        expect(new Set(families).size, `${pair.id} ${key}: ${families.join(", ")}`).toBe(
          families.length,
        );
      }
    }
  });
});

describe("a `generic` pair holds on a platform nobody has measured", () => {
  it("ends its two stacks in different generic keywords", () => {
    // The strongest guarantee available without shipping a file: `serif` and `sans-serif` resolve
    // everywhere, so the serif-against-sans reading cannot collapse.
    for (const pair of TYPE_PAIRS.filter((p) => p.contrast === "generic")) {
      const h = familiesOf(pair.fonts["font.heading"]);
      const b = familiesOf(pair.fonts["font.body"]);
      expect(h[h.length - 1], pair.id).not.toBe(b[b.length - 1]);
    }
  });

  it("is what editorial-serif is, specifically", () => {
    expect(heading("editorial-serif").at(-1)).toBe("serif");
    expect(body("editorial-serif").at(-1)).toBe("sans-serif");
  });
});

describe("a `named` pair keeps two different faces for two different jobs", () => {
  it("names a different family first, and a different one second", () => {
    // Second as well as first: if only the first differed, one missing face would collapse the pair,
    // which is precisely the state `classic-display` was in — Playfair absent, both sides Georgia.
    for (const pair of TYPE_PAIRS.filter((p) => p.contrast === "named")) {
      const h = familiesOf(pair.fonts["font.heading"]);
      const b = familiesOf(pair.fonts["font.body"]);
      expect(h[0], pair.id).not.toBe(b[0]);
      expect(h[1], `${pair.id}: one missing face must not collapse it`).not.toBe(b[1]);
    }
  });

  it("is what classic-display is, with a display serif over a text serif", () => {
    expect(heading("classic-display")[0]).toBe("Playfair Display");
    expect(heading("classic-display")[1]).toBe("Didot");
    expect(body("classic-display")[0]).toBe("Charter");
    expect(body("classic-display")[1]).toBe("Iowan Old Style");
  });

  it("does not let the body fall to the heading's own first fallback before its own", () => {
    // Georgia is in both stacks and has to be: it is the one text serif nearly every platform has.
    // What matters is that the body reaches its own named faces first, so the two only meet at the
    // bottom of both lists rather than at the top of one.
    const b = body("classic-display");
    const h = heading("classic-display");
    const shared = b.filter((family) => h.includes(family));
    expect(shared).toEqual(["Georgia", "Times New Roman", "serif"]);
    for (const family of shared) {
      expect(b.indexOf(family), `body reaches ${family} too early`).toBeGreaterThan(1);
    }
  });
});

describe("a `weightAndSize` pair is one family on purpose", () => {
  it("starts its body where its heading's fallback starts", () => {
    // The property that makes the sameness deliberate rather than accidental: the moment the heading's
    // own face is missing, both sides begin from the same family. Anything else would be a family
    // contrast arrived at by chance on some platforms and not others.
    for (const pair of TYPE_PAIRS.filter((p) => p.contrast === "weightAndSize")) {
      const h = familiesOf(pair.fonts["font.heading"]);
      const b = familiesOf(pair.fonts["font.body"]);
      expect(h[1], pair.id).toBe(b[0]);
    }
  });

  it("is what modern-sans is, and it is the only one", () => {
    expect(TYPE_PAIRS.filter((p) => p.contrast === "weightAndSize").map((p) => p.id)).toEqual([
      "modern-sans",
    ]);
    expect(heading("modern-sans")[0]).toBe("Inter");
    expect(heading("modern-sans")[1]).toBe("system-ui");
    expect(body("modern-sans")[0]).toBe("system-ui");
  });
});
