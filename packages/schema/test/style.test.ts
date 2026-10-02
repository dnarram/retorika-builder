import { describe, expect, it } from "vitest";
import {
  contentElementSchema,
  type RetorikaDocument,
  SCHEMA_VERSION,
  type Section,
} from "../src/document.ts";
import { parseDocument } from "../src/parse.ts";
import { listStyleExceptions, setElementStyle, styleFor } from "../src/style.ts";
import {
  admitsExact,
  type ElementStyle,
  elementStyleSchema,
  STYLE_PROPERTIES,
  STYLE_REFS,
  type StyleProperty,
  type Theme,
  TOKEN_KEYS,
} from "../src/tokens.ts";

/**
 * Rule 6 as something a test can fail on.
 *
 * Every refusal here is provoked on purpose, because the value of closing a vocabulary is entirely
 * in what it refuses — a closed enum nobody ever tries to break is indistinguishable from the open
 * `z.string()` it replaced.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

const section: Section = {
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
    {
      id: "el-image",
      role: "image",
      hidden: false,
      slot: "image",
      value: { kind: "image", src: "a.svg", alt: "El local por dentro" },
    },
    {
      id: "el-lines",
      role: "list",
      hidden: false,
      slot: "lines",
      items: [
        {
          id: "item-1",
          elements: [
            {
              id: "el-line-name",
              role: "heading",
              hidden: false,
              slot: "name",
              value: { kind: "text", text: "Corte de caballero" },
            },
          ],
        },
      ],
    },
  ],
};

function documentWith(only: Section): RetorikaDocument {
  return parseDocument({
    schemaVersion: SCHEMA_VERSION,
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections: [only] }],
    collections: [],
  });
}

const base = (): RetorikaDocument => documentWith(section);
const HEADLINE = { sectionId: "sec-cover", elementId: "el-headline" };

describe("the closed vocabulary", () => {
  it("admits the five properties and nothing else", () => {
    expect([...STYLE_PROPERTIES]).toEqual([
      "color",
      "fontSize",
      "fontFamily",
      "padding",
      "borderRadius",
    ]);
    expect(() => elementStyleSchema.parse({ wobble: { ref: "color.primary" } })).toThrow();
  });

  it("admits a font family by reference and refuses one by name (ADR 0032)", () => {
    // **The asymmetry is the decision.** Four properties take a reference *or* an exact value marked
    // as an exception; this one takes a reference and nothing else, because an exact family is a
    // name the owner types, a face the ZIP does not ship and a letter the visitor may never see —
    // the promise mockup 17 refused. `EXACT_PATTERNS` leaves it out, so there is no shape to write.
    expect(() => elementStyleSchema.parse({ fontFamily: { ref: "font.heading" } })).not.toThrow();
    expect(() => elementStyleSchema.parse({ fontFamily: { ref: "font.body" } })).not.toThrow();

    for (const named of ["Bodoni", "Georgia, serif", '"Comic Sans"', "inherit"]) {
      expect(
        () => elementStyleSchema.parse({ fontFamily: { exact: named, exception: true } }),
        named,
      ).toThrow();
    }
    // Not even a family the product does ship, which is the point: the arm does not exist.
    expect(() =>
      elementStyleSchema.parse({ fontFamily: { exact: "Inter", exception: true } }),
    ).toThrow();
  });

  it("refuses an exact family at build time too, which is where ADR 0032 §2 said it would", () => {
    /**
     * **This is the assertion the ADR's own words promised and the code did not yet keep.** §2 says
     * the decision is «written into the type rather than into a rule somebody has to remember», and
     * for one day it was written only into the runtime: `styleValueFor` returned
     * `reference | union`, so TypeScript inferred the same broad value type for all five properties
     * and an exact family compiled while `parse` refused it. The compiler found it the next morning,
     * on the first line of the editor that read `current?.fontFamily?.ref`.
     *
     * `@ts-expect-error` is the whole test: it fails the build if this line ever *stops* being an
     * error, which is the only way to catch the arm coming back. `referenceFor` is what keeps it so.
     */
    // @ts-expect-error — an exact family has no type to be, and that is the decision.
    const unwritable: NonNullable<ElementStyle["fontFamily"]> = { exact: "Inter", exception: true };
    // Read, so the constant is not merely declared — and refused at runtime as well, which is the
    // same decision from the other side.
    expect(() => elementStyleSchema.parse({ fontFamily: unwritable })).toThrow();

    // And the arm that does exist is typed as narrowly as it validates: two references, no third.
    const writable: NonNullable<ElementStyle["fontFamily"]> = { ref: "font.heading" };
    expect(writable.ref).toBe("font.heading");
  });

  it("names which properties admit an exact value, and fontFamily is not one", () => {
    expect(STYLE_PROPERTIES.filter((p) => admitsExact(p))).toEqual([
      "color",
      "fontSize",
      "padding",
      "borderRadius",
    ]);
    expect(admitsExact("fontFamily")).toBe(false);
  });

  it("says so in the refusal, rather than describing an exact value it has none of", () => {
    const doc = base();
    expect(() =>
      setElementStyle(doc, HEADLINE, "fontFamily", {
        exact: "Bodoni",
        exception: true,
      } as never),
    ).toThrow(/admits no exact value/);
  });

  it("refuses a reference to the wrong family of tokens", () => {
    // The case a flat enum of property names would have let through, and the one that publishes
    // `color: 16px` onto a client's site.
    expect(() => elementStyleSchema.parse({ color: { ref: "space.md" } })).toThrow();
    expect(() => elementStyleSchema.parse({ padding: { ref: "color.ink" } })).toThrow();
    expect(() => elementStyleSchema.parse({ fontSize: { ref: "radius.lg" } })).toThrow();
    expect(() => elementStyleSchema.parse({ borderRadius: { ref: "size.body" } })).toThrow();
  });

  it("admits every reference it declares, for every property", () => {
    // The other half, and the one that catches a typo in STYLE_REFS itself: a list that admits
    // nothing would pass the four refusals above and fail here.
    for (const property of STYLE_PROPERTIES) {
      for (const ref of STYLE_REFS[property]) {
        expect(
          () => elementStyleSchema.parse({ [property]: { ref } }),
          `${property} ${ref}`,
        ).not.toThrow();
      }
    }
  });

  it("names only real tokens, so a reference can never be dead", () => {
    for (const property of STYLE_PROPERTIES) {
      for (const ref of STYLE_REFS[property]) expect(TOKEN_KEYS, ref).toContain(ref);
    }
  });

  it("admits color.accent nowhere", () => {
    // Measured rather than preferred: no renderer rule reads var(--color-accent), and it is the one
    // colour whose contrast is asserted in no palette (3.19:1 on surface in classic-blue).
    for (const property of STYLE_PROPERTIES) {
      expect(STYLE_REFS[property] as readonly string[], property).not.toContain("color.accent");
    }
    expect(() => elementStyleSchema.parse({ color: { ref: "color.accent" } })).toThrow();
  });

  it("refuses an exact value that does not declare itself an exception", () => {
    // The whole of rule 6's second arm: an exact value is allowed, unmarked is not.
    expect(() => elementStyleSchema.parse({ color: { exact: "#1D4ED8" } })).toThrow();
    expect(() =>
      elementStyleSchema.parse({ color: { exact: "#1D4ED8", exception: true } }),
    ).not.toThrow();
    expect(() =>
      elementStyleSchema.parse({ color: { exact: "#1D4ED8", exception: false } }),
    ).toThrow();
  });

  it("refuses a value that is both a reference and an exception", () => {
    expect(() =>
      elementStyleSchema.parse({ color: { ref: "color.ink", exact: "#000", exception: true } }),
    ).toThrow();
  });

  it("refuses an exact colour the renderer could never emit", () => {
    // The state that is made unreachable rather than repairable: if these parsed, somebody could
    // save a site that cannot be published, and the fix would have to be an interface for it.
    for (const bad of ["rgb(0 0 0)", "var(--color-ink)", "red", "#12", "#1234567", "url(x)", ""]) {
      expect(
        () => elementStyleSchema.parse({ color: { exact: bad, exception: true } }),
        bad,
      ).toThrow();
    }
    for (const good of ["#000", "#1D4ED8", "#abc"]) {
      expect(
        () => elementStyleSchema.parse({ color: { exact: good, exception: true } }),
        good,
      ).not.toThrow();
    }
  });

  it("refuses an exact measurement that is not a plain length in pixels", () => {
    for (const bad of ["calc(1rem + 2px)", "16", "16 px", "auto", "-4px", "1e3px"]) {
      expect(
        () => elementStyleSchema.parse({ padding: { exact: bad, exception: true } }),
        bad,
      ).toThrow();
    }
    for (const good of ["0", "16px", "8.5px"]) {
      expect(
        () => elementStyleSchema.parse({ padding: { exact: good, exception: true } }),
        good,
      ).not.toThrow();
    }
  });

  it("refuses every unit but the pixel, which it used to admit (migration 0007)", () => {
    // `rem`, `em` and `%` parsed until 2 October 2026 and nothing could write one: the floating
    // toolbar is the only producer of an exact length and it writes pixels — and **reads** them, so
    // a stored `2rem` came back as an empty field wearing the highlight that means «there is an
    // exception here». Narrowed when the affected set was counted and found empty.
    for (const unit of ["1.5rem", "0.5em", "50%", "2vh", "3ch"]) {
      expect(
        () => elementStyleSchema.parse({ padding: { exact: unit, exception: true } }),
        unit,
      ).toThrow();
      expect(
        () => elementStyleSchema.parse({ fontSize: { exact: unit, exception: true } }),
        unit,
      ).toThrow();
    }
  });

  it("is disjoint from what rule 7 and rule 4 own, which is not tidiness", () => {
    // A media query adds no specificity, so a per-element style rule outranks a mobile patch. If
    // `display` were in this vocabulary, an element hidden by its own patch would reappear on the
    // phone and rule 7 would lose in silence. Same for `order` and the grid columns, which rule 4's
    // placements own. Asserted here because the day somebody adds a fifth property, this is the
    // question they have to have answered.
    const ownedElsewhere = ["display", "order", "width", "gridColumn", "grid-column", "columnSpan"];
    for (const property of STYLE_PROPERTIES) {
      expect(ownedElsewhere, property).not.toContain(property);
    }
  });

  it("still lets an element carry no style at all", () => {
    const element = { id: "el-1", role: "heading", hidden: false, slot: "headline" };
    expect(() => contentElementSchema.parse(element)).not.toThrow();
  });
});

describe("setElementStyle", () => {
  it("writes a reference, and reads back through styleFor", () => {
    const doc = base();
    const address = HEADLINE;
    const next = setElementStyle(doc, address, "color", { ref: "color.primary" });
    expect(styleFor(next, address)).toEqual({ color: { ref: "color.primary" } });
    // And the document it came from is untouched, which is what undo rests on.
    expect(styleFor(doc, address)).toBeUndefined();
  });

  it("keeps the other properties when one changes", () => {
    const doc = base();
    const address = HEADLINE;
    const withColor = setElementStyle(doc, address, "color", { ref: "color.ink" });
    const withBoth = setElementStyle(withColor, address, "fontSize", { ref: "size.heading" });
    expect(styleFor(withBoth, address)).toEqual({
      color: { ref: "color.ink" },
      fontSize: { ref: "size.heading" },
    });
  });

  it("takes a property away with undefined", () => {
    const doc = base();
    const address = HEADLINE;
    const two = setElementStyle(
      setElementStyle(doc, address, "color", { ref: "color.ink" }),
      address,
      "padding",
      { ref: "space.md" },
    );
    const one = setElementStyle(two, address, "color", undefined);
    expect(styleFor(one, address)).toEqual({ padding: { ref: "space.md" } });
  });

  it("removes the field entirely when the last property goes, rather than leaving {}", () => {
    // «Un parche que no dice nada no es un parche», applied to style: an empty object would be an
    // entry the renderer has to skip and a reviewer has to wonder about.
    const doc = base();
    const address = HEADLINE;
    const withStyle = setElementStyle(doc, address, "color", { ref: "color.ink" });
    const without = setElementStyle(withStyle, address, "color", undefined);
    expect(styleFor(without, address)).toBeUndefined();
    const section = without.pages[0]?.sections[0];
    const element = section?.content[0];
    expect(element && "style" in element).toBe(false);
  });

  it("gives the identical document back when nothing changes, so history opens no step", () => {
    const doc = base();
    const address = HEADLINE;
    const once = setElementStyle(doc, address, "color", { ref: "color.ink" });
    expect(setElementStyle(once, address, "color", { ref: "color.ink" })).toBe(once);
    // And removing something that was never there.
    expect(setElementStyle(doc, address, "padding", undefined)).toBe(doc);
  });

  it("refuses a reference to the wrong family, and the message says what would be admitted", () => {
    const doc = base();
    const address = HEADLINE;
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: the call a browser's stored JSON can make.
      setElementStyle(doc, address, "color", { ref: "space.md" } as any),
    ).toThrow(/color\.primary, color\.secondary, color\.surface, color\.ink or color\.muted/);
  });

  it("refuses an exact value the renderer could not emit, with the shape in the message", () => {
    const doc = base();
    const address = HEADLINE;
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: same, deliberately.
      setElementStyle(doc, address, "color", { exact: "rgb(0 0 0)", exception: true } as any),
    ).toThrow(/hex colour such as #1D4ED8/);
  });

  it("throws for an element that is not there, rather than quietly doing nothing", () => {
    const doc = base();
    const address = HEADLINE;
    expect(() =>
      setElementStyle(doc, { ...address, elementId: "el-nope" }, "color", { ref: "color.ink" }),
    ).toThrow(/no element "el-nope"/);
    expect(() =>
      setElementStyle(doc, { ...address, sectionId: "sec-nope" }, "color", { ref: "color.ink" }),
    ).toThrow(/section "sec-nope"/);
  });

  it("reaches an element inside a list item", () => {
    // A price line's name is an element like any other. Without recursing, colouring one is
    // answered with "no element", which is a lie about a thing that is on the screen. Proved by
    // deleting the `items` branch of `replaceById`: this is the only test that goes red.
    const address = { sectionId: "sec-cover", elementId: "el-line-name" };
    const next = setElementStyle(base(), address, "color", { ref: "color.muted" });
    expect(styleFor(next, address)).toEqual({ color: { ref: "color.muted" } });
    expect(listStyleExceptions(next)).toEqual([]);
  });

  it("finds an exception inside a list item too, which is a separate walk", () => {
    const address = { sectionId: "sec-cover", elementId: "el-line-name" };
    const next = setElementStyle(base(), address, "color", { exact: "#654321", exception: true });
    expect(listStyleExceptions(next)).toMatchObject([
      { elementId: "el-line-name", slot: "name", label: "Corte de caballero" },
    ]);
  });

  it("names an image by its alt text, since it has no words of its own", () => {
    const address = { sectionId: "sec-cover", elementId: "el-image" };
    const next = setElementStyle(base(), address, "borderRadius", {
      exact: "20px",
      exception: true,
    });
    expect(listStyleExceptions(next)[0]?.label).toBe("El local por dentro");
  });

  it("produces a document that still parses", () => {
    const doc = base();
    const address = HEADLINE;
    const next = setElementStyle(doc, address, "borderRadius", {
      exact: "12px",
      exception: true,
    });
    expect(() => parseDocument(next)).not.toThrow();
    expect(next.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("listStyleExceptions", () => {
  it("is empty for a document that uses only references", () => {
    const doc = base();
    const address = HEADLINE;
    const next = setElementStyle(doc, address, "color", { ref: "color.ink" });
    expect(listStyleExceptions(next)).toEqual([]);
  });

  it("finds an exact value and says which element carries it", () => {
    const doc = base();
    const address = HEADLINE;
    const next = setElementStyle(doc, address, "color", { exact: "#123456", exception: true });
    const [found, ...rest] = listStyleExceptions(next);
    expect(rest).toEqual([]);
    expect(found).toMatchObject({
      sectionId: address.sectionId,
      elementId: address.elementId,
      property: "color",
      exact: "#123456",
      hidden: false,
    });
    expect(found?.pageId).toBe(doc.pages[0]?.id);
  });

  it("names the element in words a person recognises", () => {
    // An audit that says «el-body-3» is an audit nobody can act on: the repair is a click on a row.
    const doc = base();
    const address = HEADLINE;
    const element = doc.pages[0]?.sections[0]?.content[0];
    const text = element?.value?.kind === "text" ? element.value.text : undefined;
    const next = setElementStyle(doc, address, "color", { exact: "#123456", exception: true });
    expect(listStyleExceptions(next)[0]?.label).toBe(text);
  });

  it("reports a hidden element's exception, and marks it hidden", () => {
    // Both readers come off this one list. The panel's audit shows it — rule 3 keeps a hidden
    // element precisely so the place to fill it in still exists, and an exception that vanishes
    // when somebody hides its element is one that comes back unannounced. The download gate skips
    // it, because the renderer drops a hidden element and blocking over an invisible colour is the
    // mistake `listDeadDestinations` already refuses to make.
    const hiddenDoc = documentWith({
      ...section,
      content: [{ ...section.content[0], hidden: true } as (typeof section.content)[number]],
    });
    const next = setElementStyle(hiddenDoc, HEADLINE, "color", {
      exact: "#123456",
      exception: true,
    });
    const found = listStyleExceptions(next);
    expect(found).toHaveLength(1);
    expect(found[0]?.hidden).toBe(true);
    expect(found.filter((exception) => !exception.hidden)).toEqual([]);
  });

  it("is ordered by the document, and by property within an element", () => {
    // The download gate prints this list, and a gate whose message reorders itself between two
    // presses is a gate nobody trusts.
    const doc = base();
    const address = HEADLINE;
    const next = setElementStyle(
      setElementStyle(doc, address, "borderRadius", { exact: "12px", exception: true }),
      address,
      "color",
      { exact: "#123456", exception: true },
    );
    expect(listStyleExceptions(next).map((exception) => exception.property)).toEqual([
      "color",
      "borderRadius",
    ]);
  });

  it("lists a reference and an exact value on the same element only once", () => {
    const doc = base();
    const address = HEADLINE;
    const next = setElementStyle(
      setElementStyle(doc, address, "color", { ref: "color.ink" }),
      address,
      "padding",
      { exact: "20px", exception: true },
    );
    expect(listStyleExceptions(next).map((e) => e.property satisfies StyleProperty)).toEqual([
      "padding",
    ]);
  });
});
