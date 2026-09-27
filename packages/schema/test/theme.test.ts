import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { RetorikaDocument } from "../src/document.ts";
import { parseDocument } from "../src/parse.ts";
import { arbitraryTheme } from "../src/testing.ts";
import { setTheme } from "../src/theme.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * `setTheme` — the verb behind the Estilo panel.
 *
 * The real palettes and type pairs are `@retorika/tokens`' business and are tested there; the
 * dependency runs tokens → schema, so themes here are built by hand. What is being tested is
 * narrower and does not need them: that a theme goes in whole, that nothing else moves, and that
 * an incomplete one is refused rather than written.
 */

function themeOf(suffix: string): Theme {
  return Object.fromEntries(TOKEN_KEYS.map((key) => [key, `${key}-${suffix}`])) as Theme;
}

const before = themeOf("before");
const after = themeOf("after");

function documentWith(theme: Theme): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    collections: [],
    pages: [
      {
        id: "page-home",
        slug: "inicio",
        title: "Inicio",
        sections: [
          {
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
            ],
          },
        ],
      },
    ],
  };
}

describe("setTheme", () => {
  it("replaces every value at once", () => {
    const next = setTheme(documentWith(before), after);
    for (const key of TOKEN_KEYS) expect(next.theme[key], key).toBe(`${key}-after`);
  });

  it("leaves the page untouched, which is rule 6 in one assertion", () => {
    // Style is references to the system, so restyling the whole site moves no section, no element
    // and no placement. Reference equality is the strongest way to say that: not "the pages are
    // equal" but "they are the same array", which is also why the preview can re-render from a
    // theme change without the golden corpus having anything to say about it.
    const doc = documentWith(before);
    const next = setTheme(doc, after);
    expect(next.pages).toBe(doc.pages);
    expect(next.siteName).toBe(doc.siteName);
    expect(next.collections).toBe(doc.collections);
  });

  it("hands back the very same document when the theme is already that one", () => {
    // What stops the undo arrow lighting up for a step that undoes to itself: pressing the
    // palette a site already uses. Reference equality, because that is what the editor's history
    // checks.
    const doc = documentWith(before);
    expect(setTheme(doc, before)).toBe(doc);
    expect(setTheme(doc, themeOf("before"))).toBe(doc);
  });

  it("produces a document that still parses", () => {
    expect(() => parseDocument(setTheme(documentWith(before), after))).not.toThrow();
  });

  it("refuses a theme missing a key instead of writing a hole", () => {
    // A missing key is a CSS custom property the renderer emits with no value, in a page that
    // gets published. There is no useful half-theme.
    const { "color.primary": _dropped, ...partial } = after;
    expect(() => setTheme(documentWith(before), partial as Theme)).toThrow(
      /not a complete theme.*color\.primary/s,
    );
  });

  it("refuses an empty value", () => {
    expect(() => setTheme(documentWith(before), { ...after, "color.ink": "" })).toThrow(
      /not a complete theme/,
    );
  });

  it("refuses a key that is not in the namespace", () => {
    const extra = { ...after, "color.brand": "#FF0000" } as unknown as Theme;
    expect(() => setTheme(documentWith(before), extra)).toThrow(/not a complete theme/);
  });

  it("does not write anything when it refuses", () => {
    const doc = documentWith(before);
    const { "font.body": _dropped, ...partial } = after;
    expect(() => setTheme(doc, partial as Theme)).toThrow();
    expect(doc.theme["font.body"]).toBe("font.body-before");
  });
});

describe("setTheme, for any theme", () => {
  it("lands whole, and is undone by putting the old one back", () => {
    // The property the editor's undo rests on: a theme swap carries no information away with it,
    // so the inverse of one swap is the other swap. That is why the history can store snapshots
    // and never needs an inverse verb.
    fc.assert(
      fc.property(arbitraryTheme, arbitraryTheme, (first, second) => {
        const doc = documentWith(first);
        const swapped = setTheme(doc, second);
        for (const key of TOKEN_KEYS) expect(swapped.theme[key]).toBe(second[key]);
        expect(setTheme(swapped, first).theme).toEqual(doc.theme);
      }),
    );
  });
});
