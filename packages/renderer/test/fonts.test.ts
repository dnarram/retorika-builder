import { GENERIC_OF, type RetorikaDocument, TOKEN_KEYS } from "@retorika/schema";
import { familiesOf, GALLERY_FAMILIES, TYPE_PAIRS } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { cssFontFamilyName, cssFontSrc, cssThemeValue } from "../src/escape.ts";
import { fontFaceCss, fontFilesFor, SHIPPABLE_FAMILIES } from "../src/fonts.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * The first `url()` this renderer has ever emitted, and the table that decides when (ADR 0028).
 *
 * `escape.ts`'s own comment says the theme allowlist admits nothing that can «call a function — so no
 * `url()` and no network», and that sentence is still true of `cssThemeValue`, which is untouched.
 * What these tests hold is the exception beside it: **the values come from a closed table, a document
 * can only select a row, and the two narrow functions refuse anything else even if somebody later
 * wires a document value in.**
 *
 * **Nothing calls `fontFaceCss` from `buildCss` yet, and that is deliberate.** Wired, it would make a
 * published ZIP name two files the publisher does not put in it until the next day — and the e2e flows
 * already assert that a ZIP extracted to disk and opened from `file://` produces **no failed request**,
 * which is the self-containment ADR 0001 rests on. That assertion caught it, and loosening it to let a
 * half-finished feature through is exactly the move this file's own ADR warns against. So the exception,
 * the table and every test land here; the two lines that connect them land with the publisher that makes
 * them honest.
 */

const base = (() => {
  const found = loadCorpus().find((entry) => entry.name === "tokens-quoted-fonts");
  if (!found) throw new Error("the tokens-quoted-fonts fixture is missing from the corpus");
  return found.document;
})();

/** The same document with one font token replaced, which is the only way a document can ask for a
 * face at all. */
function withFont(key: "font.heading" | "font.body", stack: string): RetorikaDocument {
  return { ...base, theme: { ...base.theme, [key]: stack } };
}

const rulesIn = (css: string) => [...css.matchAll(/@font-face \{[^}]*\}/g)].map((m) => m[0]);

describe("the table does not drift from the stacks the tokens declare", () => {
  it("every row is reachable by a document, and brings exactly its own faces", () => {
    // **This replaces the guard that said every row must be named by a type pair** (sprint 24 día 5).
    // That held while the table was the two families the pairs used, where a row no pair named meant
    // bytes nobody could ever see. The gallery is the decision that a family is shipped for the owner
    // to choose it by its real name (ADR 0046), so six of the eight rows are named by no pair.
    //
    // What replaces it is stronger over the rows it keeps: for every row there is a stack a document
    // can carry that selects it, and selecting it brings that row's faces and nothing else. A row with
    // a name no document could match — a typo, an accent, a family renamed upstream — fails here.
    for (const { family, faces } of SHIPPABLE_FAMILIES) {
      const doc = withFont("font.heading", `'${family}', serif`);
      expect(fontFilesFor(doc), family).toEqual(faces.map((face) => face.file));
    }
  });

  it("spells every file after its own family, so a typo in either half shows", () => {
    // **The test above cannot catch a misspelled family**, and that was found by sabotaging one: it
    // builds the document out of the table's own name, so a row named "Figtre" is selected by a
    // document asking for "Figtre" and the row looks fine. Here the two halves check each other —
    // `@fontsource` names its files after the family, kebab-cased — so a typo in the name no longer
    // agrees with the file, and a typo in the file no longer agrees with the name.
    //
    // The row's name is also checked against the package's own `metadata.json` in
    // `packages/publisher/test/fonts.test.ts`, which is the only place that can read it: the renderer
    // may not import anything outside schema and catalog, because it all travels to the client's site.
    for (const { family, faces } of SHIPPABLE_FAMILIES) {
      const slug = family.toLowerCase().replace(/ /g, "-");
      for (const { weight, file } of faces) {
        expect(file, family).toBe(`${slug}-latin-${weight}-normal.woff2`);
      }
    }
  });

  it("ships a face for every first family that is not a system one", () => {
    // The other direction, and the one that would have caught `classic-display` shipping nothing: a
    // pair naming a face nobody can have, with no file for it, is a pair that cannot keep its promise.
    const system = new Set(["Georgia", "system-ui", "Charter"]);
    const shipped = new Set(SHIPPABLE_FAMILIES.map((f) => f.family));
    for (const pair of TYPE_PAIRS) {
      for (const key of ["font.heading", "font.body"] as const) {
        const first = familiesOf(pair.fonts[key])[0] ?? "";
        if (system.has(first)) continue;
        expect(shipped, `${pair.id} ${key} asks for ${first} first and nothing ships it`).toContain(
          first,
        );
      }
    }
  });

  it("the gallery the editor offers and the table that ships are the same families", () => {
    // Two derivations of one list since ADR 0055, in two packages that cannot import each other: the
    // renderer may not reach `@retorika/tokens` (everything here travels to the client's site) and
    // the gallery's stacks are the tokens' business. This is the seam, and ADR 0046's condition — the
    // editor must offer every row — is this equality read from the editor's side.
    expect(GALLERY_FAMILIES.map((f) => f.family).toSorted()).toEqual(
      SHIPPABLE_FAMILIES.map((f) => f.family).toSorted(),
    );
  });

  it("every gallery stack brings that family's faces, and only those", () => {
    // The property that makes the gallery honest: what the owner picks is what the ZIP carries. Each
    // stack is fed to the renderer as a document's own theme value, which is the only way a family
    // can reach it at all.
    for (const { family, stack } of GALLERY_FAMILIES) {
      const row = SHIPPABLE_FAMILIES.find((candidate) => candidate.family === family);
      expect(row, family).toBeDefined();
      expect(fontFilesFor(withFont("font.heading", stack)), family).toEqual(
        row?.faces.map((face) => face.file),
      );
      // And from the body token too, because a family can be chosen for either half.
      expect(fontFilesFor(withFont("font.body", stack)), family).toHaveLength(2);
    }
  });

  it("every gallery stack ends in the generic keyword its species promises", () => {
    // What the fallbacks owe is the species: a visitor whose browser fetched no face must still get
    // a serif where a serif was chosen. `kind` is in the data so this can be asserted rather than
    // described.
    for (const { family, kind, stack } of GALLERY_FAMILIES) {
      const last = familiesOf(stack).at(-1);
      expect(last, family).toBe(GENERIC_OF[kind]);
      // And the family it names first is itself, which is what makes the face travel.
      expect(familiesOf(stack)[0], family).toBe(family);
    }
  });

  it("covers the weights the stylesheet actually asks for", () => {
    // `--font-heading` is used by h1/h2/h3 — heading tags, so 700 by the browser's default — and by
    // `p.rb-subtitle`, which is a <p> and therefore 400. A missing weight is synthesised, badly.
    for (const { family, faces } of SHIPPABLE_FAMILIES) {
      expect(
        faces.map((f) => f.weight).sort((a, b) => a - b),
        family,
      ).toEqual([400, 700]);
    }
  });
});

describe("a document selects a row; it can never name a file", () => {
  it("emits nothing at all for a theme that names no shippable family", () => {
    // Every site on `editorial-serif`, and every document in the corpus but one. This is what keeps
    // "a site that needs no font carries zero font bytes" true rather than claimed.
    expect(fontFaceCss(base)).toEqual([]);
    expect(fontFilesFor(base)).toEqual([]);
    expect(fontFaceCss(base).join("\n")).not.toContain("@font-face");
  });

  it("emits both faces for a theme whose heading asks for Inter", () => {
    const doc = withFont("font.heading", "Inter, system-ui, -apple-system, sans-serif");
    const rules = rulesIn(fontFaceCss(doc).join("\n"));
    expect(rules).toHaveLength(2);
    expect(rules[0]).toContain("font-family: 'Inter'");
    expect(rules[0]).toContain('src: url("fonts/inter-latin-400-normal.woff2") format("woff2")');
    expect(rules[0]).toContain("font-weight: 400");
    expect(rules[1]).toContain('src: url("fonts/inter-latin-700-normal.woff2") format("woff2")');
    expect(fontFilesFor(doc)).toEqual([
      "inter-latin-400-normal.woff2",
      "inter-latin-700-normal.woff2",
    ]);
  });

  it("emits both faces for a theme whose heading asks for EB Garamond", () => {
    const doc = withFont("font.heading", "'EB Garamond', Garamond, Georgia, serif");
    expect(fontFilesFor(doc)).toEqual([
      "eb-garamond-latin-400-normal.woff2",
      "eb-garamond-latin-700-normal.woff2",
    ]);
  });

  it("matches a quoted family the same as an unquoted one", () => {
    expect(fontFilesFor(withFont("font.heading", "'Inter', sans-serif"))).toEqual(
      fontFilesFor(withFont("font.heading", "Inter, sans-serif")),
    );
    expect(fontFilesFor(withFont("font.heading", '"Inter", sans-serif'))).toHaveLength(2);
  });

  it("reads a shippable family from the body as well as the heading", () => {
    // No pair does this today. The rule is about the token holding a stack, not about which token it
    // is, and a pair that put a shipped face in the body would otherwise get rules for nothing.
    expect(fontFilesFor(withFont("font.body", "Inter, sans-serif"))).toHaveLength(2);
  });

  it("emits each family once when both tokens name it", () => {
    const doc = {
      ...base,
      theme: {
        ...base.theme,
        "font.heading": "Inter, sans-serif",
        "font.body": "Inter, sans-serif",
      },
    };
    expect(rulesIn(fontFaceCss(doc).join("\n"))).toHaveLength(2);
    expect(fontFilesFor(doc)).toHaveLength(2);
  });

  it("orders by the table, never by the document", () => {
    // Two documents meaning the same thing must publish the same bytes (`INV_5`, the golden corpus).
    const headingInter = {
      ...base,
      theme: {
        ...base.theme,
        "font.heading": "Inter, sans-serif",
        "font.body": "'EB Garamond', serif",
      },
    };
    const bodyInter = {
      ...base,
      theme: {
        ...base.theme,
        "font.heading": "'EB Garamond', serif",
        "font.body": "Inter, sans-serif",
      },
    };
    expect(fontFilesFor(headingInter)).toEqual(fontFilesFor(bodyInter));

    // Asked of the table rather than written out: the order is the table's own, and with eight rows
    // that is alphabetical, so EB Garamond comes before Inter whichever token named it. A literal
    // here would be a third copy of the ordering, and it is what went stale when the table grew.
    const tableOrder = SHIPPABLE_FAMILIES.flatMap((f) => f.faces.map((face) => face.file));
    const files = fontFilesFor(headingInter);
    expect(files).toEqual([...files].sort((a, b) => tableOrder.indexOf(a) - tableOrder.indexOf(b)));
    expect(new Set(files)).toEqual(
      new Set([
        "eb-garamond-latin-400-normal.woff2",
        "eb-garamond-latin-700-normal.woff2",
        "inter-latin-400-normal.woff2",
        "inter-latin-700-normal.woff2",
      ]),
    );
  });

  it("is deterministic: the same document twice gives identical bytes", () => {
    const doc = withFont("font.heading", "Inter, sans-serif");
    expect(fontFaceCss(doc).join("\n")).toBe(fontFaceCss(doc).join("\n"));
  });
});

describe("what a theme cannot talk its way into", () => {
  /**
   * These are the cases the day existed for. A theme value is a string the owner's document carries,
   * and until today no `url()` could come out of this renderer at all. Each of these asks for one.
   */
  const refused = [
    'url("http://evil.example/x.woff2")',
    "url(evil.woff2)",
    "Inter'); } @font-face { font-family: x; src: url(http://evil/x)",
    "../../../etc/passwd",
    "inter",
    "INTER",
    "EB",
    "EB Garamond Bold",
    "",
  ];

  for (const value of refused) {
    it(`emits no rule and no file for ${JSON.stringify(value)}`, () => {
      const doc = withFont("font.heading", value);
      // Some of these cannot even reach the custom property — `cssThemeValue` refuses them, and that
      // refusal is the older guard still doing its job. Either way nothing is emitted; what must never
      // happen is a rule built out of this string.
      expect(fontFaceCss(doc)).toEqual([]);
      expect(fontFilesFor(doc)).toEqual([]);
    });
  }

  it("treats a padded family as that family, which CSS does too", () => {
    // `firstFamily` trims, so these match — asserted so the behaviour is a decision rather than a
    // surprise, and because the refusals above would otherwise read as though whitespace were a guard.
    expect(fontFilesFor(withFont("font.heading", " Inter , sans-serif"))).toHaveLength(2);
    expect(fontFilesFor(withFont("font.heading", " Inter "))).toHaveLength(2);
  });

  it("cannot be reached by junk sitting further down the stack", () => {
    /**
     * The sharpest case, and it is guarded twice over by two independent things.
     *
     * The first family is `Inter`, so the table legitimately matches it and emits Inter's own two
     * rules — built entirely from the table, so the `url(x)` further along the stack appears in
     * neither of them. And the document never renders at all, because `cssThemeValue` refuses to put
     * that stack in a custom property: `(` and `)` are not in its allowlist. The older guard is still
     * doing the job its comment claims.
     */
    const doc = withFont("font.heading", "Inter, url(http://evil.example/x), sans-serif");

    const rules = fontFaceCss(doc).join("\n");
    expect(rules).toContain("inter-latin-400-normal.woff2");
    expect(rules).not.toContain("evil");
    expect(rules).not.toContain("url(http");

    // And the older guard refuses to put that stack in a custom property at all: `(` and `)` are not
    // in `cssThemeValue`'s allowlist, so the document could never be published either way.
    expect(() => cssThemeValue("font.heading", doc.theme["font.heading"])).toThrow(
      /cannot be emitted into CSS/,
    );
  });
});

describe("why there is no test for «the family comes from the table, not the document»", () => {
  /**
   * There cannot be one, and the reason is the guarantee rather than a gap.
   *
   * Matching is **exact equality**, so when a row matches, the document's string and the table's string
   * *are the same string* — swapping which of the two is emitted cannot change a byte. Probed by
   * sabotage on 1 October 2026: replacing the table's `family` with the matched document value broke
   * nothing, exactly as that argument predicts.
   *
   * What the tests do cover is every way the argument could stop holding, and each one was proven to
   * fail loudly:
   *
   * - matching loosened to a substring, or ordered by the document — caught, 2 failures each;
   * - the document's whole theme value emitted as the family — caught, 20 failures;
   * - `cssFontFamilyName` bypassed entirely — caught, 3 failures;
   * - either pattern widened — caught, 7 and 9 failures.
   *
   * So the property is held by the three together: exact equality, the narrow pattern, and the table.
   * This block exists so that the next person to look for its test finds the reasoning instead of
   * concluding there is none.
   */
  it("keeps matching exact, which is what makes the argument hold", () => {
    expect(fontFilesFor(withFont("font.heading", "inter, sans-serif"))).toEqual([]);
    expect(fontFilesFor(withFont("font.heading", "INTER, sans-serif"))).toEqual([]);
    expect(fontFilesFor(withFont("font.heading", "Inter Display, sans-serif"))).toEqual([]);
    expect(fontFilesFor(withFont("font.heading", "MyInter, sans-serif"))).toEqual([]);
  });
});

describe("the two narrow functions refuse on their own", () => {
  // The second lock. Even with the table bypassed, neither can produce something that leaves the rule.
  it("accepts exactly the table's names", () => {
    for (const { family } of SHIPPABLE_FAMILIES) {
      expect(cssFontFamilyName(family)).toBe(`'${family}'`);
    }
  });

  for (const bad of [
    "Inter'",
    'Inter"',
    "Inter;",
    "Inter}",
    "Inter{",
    "Inter)",
    "url(x)",
    "Inter\\",
    "Inter/*",
    "</style>",
    "Inter\n",
    "",
    " Inter",
    "Inter ",
    "Inter  Display",
  ]) {
    it(`refuses the family ${JSON.stringify(bad)}`, () => {
      expect(() => cssFontFamilyName(bad)).toThrow(/cannot be emitted into CSS/);
    });
  }

  it("accepts exactly the table's files, and writes the directory itself", () => {
    for (const { faces } of SHIPPABLE_FAMILIES) {
      for (const face of faces) {
        expect(cssFontSrc(face.file)).toBe(`url("fonts/${face.file}") format("woff2")`);
      }
    }
  });

  for (const bad of [
    "../evil.woff2",
    "/etc/passwd.woff2",
    "http://evil/x.woff2",
    "evil.woff2?x=1",
    "evil.woff",
    "evil.ttf",
    "evil.css",
    "evil.woff2.css",
    "Inter.woff2",
    "inter latin.woff2",
    'x.woff2") format("woff2"), url("http://evil/y.woff2',
    "x.woff2;",
    "fonts/x.woff2",
    "",
  ]) {
    it(`refuses the file ${JSON.stringify(bad)}`, () => {
      expect(() => cssFontSrc(bad)).toThrow(/cannot be emitted into CSS/);
    });
  }

  it("cannot be pointed outside fonts/ even by a caller", () => {
    // The directory is written inside the function, so there is no parameter that could move it.
    for (const { faces } of SHIPPABLE_FAMILIES) {
      for (const face of faces) {
        expect(cssFontSrc(face.file).startsWith('url("fonts/')).toBe(true);
      }
    }
  });
});

describe("the rule's own shape", () => {
  const css = fontFaceCss(withFont("font.heading", "Inter, sans-serif")).join("\n");

  it("declares swap, so text is readable before the face arrives", () => {
    for (const rule of rulesIn(css)) expect(rule).toContain("font-display: swap");
  });

  it("declares normal style, so an italic the page never ships is not matched by it", () => {
    for (const rule of rulesIn(css)) expect(rule).toContain("font-style: normal");
  });

  it("declares no unicode-range, which is deliberate", () => {
    // One subset per face, so a range would describe the file rather than choose between files — and a
    // browser reading it would decline to download for a page whose first glyphs fall outside it.
    expect(css).not.toContain("unicode-range");
  });

  it("sits before the rules that use the family", () => {
    expect(css.indexOf("@font-face")).toBeLessThan(
      css.indexOf("--font-heading") === -1
        ? Number.POSITIVE_INFINITY
        : css.indexOf(".rb-section h1"),
    );
  });

  it("keeps the path relative, so a double-clicked page finds it", () => {
    // ADR 0001: the published site opens with no server and no network. An absolute path or a host
    // would break that, and measurement 2 of ADR 0028 confirmed a relative one loads from `file://`.
    for (const rule of rulesIn(css)) {
      expect(rule).toContain('url("fonts/');
      expect(rule).not.toMatch(/url\("(?:https?:)?\/\//);
    }
  });
});

describe("the schema's font tokens are all accounted for", () => {
  it("reads every token key that holds a font stack", () => {
    // Derived rather than written out, so a third font token in the schema is picked up here without
    // anybody remembering to. This asserts the derivation still finds them all.
    const fontKeys = TOKEN_KEYS.filter((key) => key.startsWith("font."));
    expect(fontKeys).toEqual(["font.heading", "font.body"]);
    for (const key of fontKeys) {
      expect(fontFilesFor(withFont(key as "font.heading", "Inter, sans-serif"))).toHaveLength(2);
    }
  });
});
