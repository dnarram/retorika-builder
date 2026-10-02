import type { ContentElement, RetorikaDocument } from "./document.ts";
import type { ElementAddress } from "./fields.ts";
import type { Role } from "./roles.ts";
import {
  type ElementStyle,
  elementStyleSchema,
  STYLE_PROPERTIES,
  type StyleProperty,
  type StyleValue,
} from "./tokens.ts";

/**
 * Rule 6's two arms, as verbs: writing an element's style, and finding every place that left the
 * system.
 *
 * `styleValueSchema` has been in `tokens.ts` since phase 0 and nothing has ever read it — not the
 * renderer, not the publisher, not the catalogue, not the editor. Its own comment promised «what
 * lets a **future** audit list every place that opted out of the system». `listStyleExceptions` is
 * that audit, and `setElementStyle` is what finally writes the field.
 */

/** The element with this id among these, with `next` applied; `undefined` when it is not here.
 *
 * Recurses into list items for the same reason `setElementText` does: a price line's name is an
 * element like any other, and an owner colouring it would otherwise be told it does not exist. */
function replaceById(
  elements: readonly ContentElement[],
  elementId: string,
  next: (element: ContentElement) => ContentElement,
): ContentElement[] | undefined {
  let found = false;
  const mapped = elements.map((element) => {
    if (element.id === elementId) {
      found = true;
      return next(element);
    }
    if (!element.items) return element;
    let changedItems = false;
    const items = element.items.map((item) => {
      const replaced = replaceById(item.elements, elementId, next);
      if (!replaced) return item;
      changedItems = true;
      return { ...item, elements: replaced };
    });
    if (!changedItems) return element;
    found = true;
    return { ...element, items };
  });
  return found ? mapped : undefined;
}

/**
 * One property of one element's style set, or taken away again with `undefined`.
 *
 * Three contracts, each of them borrowed from a verb that already earned it:
 *
 * - **A style that says nothing is not a style.** Removing the last property removes the field,
 *   rather than leaving `{}` behind for the renderer to skip and a reviewer to wonder about. The
 *   rule `setMobilePatch` states as «un parche que no dice nada no es un parche».
 * - **The identical document back when nothing changes**, so a control pressed twice opens one
 *   history step and not two (`setPlacement`, `moveUpOnMobile`).
 * - **The value is parsed, never trusted.** TypeScript cannot vouch for a `StyleValue` that arrived
 *   as JSON from a browser's storage, and a reference to the wrong family of tokens publishes
 *   `color: 16px`. The error names the property and what it would admit, because a refusal a caller
 *   cannot act on is a refusal that gets worked around.
 */
export function setElementStyle(
  doc: RetorikaDocument,
  address: ElementAddress,
  property: StyleProperty,
  value: StyleValue | undefined,
): RetorikaDocument {
  if (value !== undefined) {
    const check = elementStyleSchema.safeParse({ [property]: value });
    if (!check.success) {
      const exact = EXACT_TEXT[property];
      throw new Error(
        `setElementStyle: "${property}" does not admit ${JSON.stringify(value)}. ` +
          `A reference must be one of ${STYLE_REFS_TEXT[property]}` +
          // A property with no exact arm says so rather than describing one. `fontFamily` is the
          // first, and the sentence is what tells a caller that the omission is the decision.
          (exact === undefined
            ? ", and it admits no exact value."
            : `, and an exact value ${exact} carrying exception: true.`),
      );
    }
  }

  // Two flags rather than one, because "nothing changed" and "nothing is there" are different
  // answers: the first returns the document untouched, the second throws. Collapsing them would
  // make a typo in an element id look like a control that simply did nothing.
  let addressed = false;
  let changed = false;

  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== address.sectionId) return section;
      const content = replaceById(section.content, address.elementId, (element) => {
        const merged: Record<string, unknown> = { ...element.style };
        if (value === undefined) delete merged[property];
        else merged[property] = value;

        // Parsed rather than cast: it is the only way to get an `ElementStyle` out of a computed
        // key, and it re-checks the merged whole rather than only the property that moved.
        const style = elementStyleSchema.parse(merged);
        if (JSON.stringify(style) === JSON.stringify(element.style ?? {})) return element;
        changed = true;
        if (Object.keys(style).length === 0) {
          // Rebuilt without the key rather than set to undefined: `exactOptionalPropertyTypes`
          // and the strict schema both treat "absent" and "present and undefined" as different
          // things, and only the first of them round-trips.
          const { style: _dropped, ...rest } = element;
          return rest;
        }
        return { ...element, style };
      });
      if (!content) return section;
      addressed = true;
      return { ...section, content };
    }),
  }));

  if (!addressed) {
    throw new Error(
      `setElementStyle: no element "${address.elementId}" in section "${address.sectionId}"`,
    );
  }
  return changed ? { ...doc, pages } : doc;
}

/** The style this element carries, if it carries one — the reader beside the writer, so a panel
 * does not have to walk the document itself to draw which reference is current. */
export function styleFor(doc: RetorikaDocument, address: ElementAddress): ElementStyle | undefined {
  for (const page of doc.pages) {
    for (const section of page.sections) {
      if (section.id !== address.sectionId) continue;
      const element = findElement(section.content, address.elementId);
      if (element) return element.style;
    }
  }
  return undefined;
}

function findElement(
  elements: readonly ContentElement[],
  elementId: string,
): ContentElement | undefined {
  for (const element of elements) {
    if (element.id === elementId) return element;
    for (const item of element.items ?? []) {
      const inside = findElement(item.elements, elementId);
      if (inside) return inside;
    }
  }
  return undefined;
}

export interface StyleException {
  pageId: string;
  sectionId: string;
  elementId: string;
  slot: string;
  role: Role;
  property: StyleProperty;
  /** The value somebody wrote in place of a reference. */
  exact: string;
  /**
   * The words the person recognises this element by, when it has any — a text's text, a link's
   * label, an image's alt, a map's label. An audit that says «el-body-3» is an audit nobody can act
   * on; the repair is a click on a row, and the row has to name a thing on the screen.
   */
  label?: string;
  /**
   * Whether the element is hidden, which is the difference between the two readers of this list.
   *
   * The audit in the `Diseño` panel shows every exception the document carries, hidden ones
   * included: rule 3 keeps a hidden element precisely so the place to fill it in still exists, and
   * an exception that disappears from the list when somebody hides its element is an exception that
   * comes back unannounced. The pre-publish contrast review reads the same list and **skips the
   * hidden ones**, because the renderer drops a hidden element entirely and blocking a download over
   * a colour nobody can see is the mistake `listDeadDestinations` already refuses to make.
   *
   * One rule, two readers — the shape `mobileSequence` established.
   */
  hidden: boolean;
}

function labelOf(element: ContentElement): string | undefined {
  const value = element.value;
  switch (value?.kind) {
    case "text":
      return value.text;
    case "link":
      return value.text;
    case "image":
      return value.alt;
    case "map":
      return value.label;
    default:
      return undefined;
  }
}

/**
 * Every exact value in the document, in the order a person reads the site.
 *
 * Deterministic by construction — page order, then section order, then document order within the
 * section, then `STYLE_PROPERTIES` order within the element — because the download gate prints this
 * list, and a gate whose message reorders itself between two presses is a gate nobody trusts.
 */
export function listStyleExceptions(doc: RetorikaDocument): StyleException[] {
  const out: StyleException[] = [];

  const walk = (pageId: string, sectionId: string, elements: readonly ContentElement[]): void => {
    for (const element of elements) {
      for (const property of STYLE_PROPERTIES) {
        const value = element.style?.[property];
        if (value === undefined || !("exact" in value)) continue;
        const label = labelOf(element);
        out.push({
          pageId,
          sectionId,
          elementId: element.id,
          slot: element.slot,
          role: element.role,
          property,
          exact: value.exact,
          ...(label === undefined ? {} : { label }),
          hidden: element.hidden,
        });
      }
      for (const item of element.items ?? []) walk(pageId, sectionId, item.elements);
    }
  };

  for (const page of doc.pages) {
    for (const section of page.sections) walk(page.id, section.id, section.content);
  }
  return out;
}

/** Written out for the error message rather than derived from the schema, because a Zod issue for a
 * union reads as four failed branches and says nothing a caller can act on. Kept beside the schema
 * it describes and asserted against it in `style.test.ts`, so the two cannot drift. */
const STYLE_REFS_TEXT: Record<StyleProperty, string> = {
  color: "color.primary, color.secondary, color.surface, color.ink or color.muted",
  fontSize: "size.heading, size.subheading or size.body",
  fontFamily: "font.heading or font.body",
  padding: "space.xs, space.sm, space.md, space.lg or space.xl",
  borderRadius: "radius.sm, radius.md or radius.lg",
};

/** Partial for the reason `EXACT_PATTERNS` is partial: `fontFamily` admits no exact value at all
 * (ADR 0032), so there is no sentence to write for it and the refusal below says so instead. */
const EXACT_TEXT: Partial<Record<StyleProperty, string>> = {
  color: "must be a hex colour such as #1D4ED8",
  fontSize: "must be a length in pixels such as 24px",
  padding: "must be a length such as 16px",
  borderRadius: "must be a length such as 8px",
};
