import type { ContentElement, RetorikaDocument, Section } from "./document.ts";
import { isContainerRole } from "./roles.ts";

/**
 * The referential rules Zod cannot express, because they are about how parts of the
 * document relate to each other rather than about the shape of any one part.
 */

export interface Violation {
  rule: number;
  path: string;
  message: string;
}

/** Every element in a section, including those nested inside list items. */
export function flattenElements(elements: readonly ContentElement[]): ContentElement[] {
  const out: ContentElement[] = [];
  for (const element of elements) {
    out.push(element);
    if (isContainerRole(element.role) && element.items) {
      for (const item of element.items) {
        out.push(...flattenElements(item.elements));
      }
    }
  }
  return out;
}

function checkSection(section: Section, path: string, violations: Violation[]): void {
  const elements = flattenElements(section.content);
  const ids = new Set(elements.map((element) => element.id));

  const duplicates = elements.length - ids.size;
  if (duplicates > 0) {
    violations.push({
      rule: 5,
      path,
      message: `${duplicates} duplicate element id(s) within the section`,
    });
  }

  const layout = section.layout;
  if (layout === null) return;

  const placed = new Set<string>();
  for (const [index, placement] of layout.placements.entries()) {
    const at = `${path}.layout.placements[${index}]`;

    // Rules 1 and 5: a placement references an element, and that element must live in
    // this very section. Anything else is a layout owning content, or an orphan.
    if (!ids.has(placement.elementId)) {
      violations.push({
        rule: 1,
        path: at,
        message: `placement references "${placement.elementId}", which is not an element of this section`,
      });
    }
    if (placed.has(placement.elementId)) {
      violations.push({
        rule: 4,
        path: at,
        message: `element "${placement.elementId}" is placed more than once`,
      });
    }
    placed.add(placement.elementId);

    // Rule 4: positions are relative to the section's grid. A span that runs off the last
    // unit is an absolute position wearing a disguise. Against the layout's own grid — the
    // ninety-six units of a free section (ADR 0050) — and not a constant, so this file cannot
    // disagree with the schema about how wide a section is.
    const columns = layout.grid.columns;
    if (placement.column + placement.columnSpan - 1 > columns) {
      violations.push({
        rule: 4,
        path: at,
        message: `column ${placement.column} + span ${placement.columnSpan} overflows the ${columns}-unit grid`,
      });
    }
  }

  // Rule 7: a patch is a difference against the desktop, so it can only refer to
  // something the desktop actually places. A patch for an unplaced element is the
  // beginning of a second, parallel design.
  for (const [breakpoint, patches] of Object.entries(layout.breakpoints)) {
    for (const [index, patch] of (patches ?? []).entries()) {
      if (!placed.has(patch.elementId)) {
        violations.push({
          rule: 7,
          path: `${path}.layout.breakpoints.${breakpoint}[${index}]`,
          message: `patch targets "${patch.elementId}", which has no placement on the desktop layout`,
        });
      }
    }
  }
}

/**
 * How to look a preset up, so the bound-cardinality rule can run here (ADR 0033 §8).
 *
 * **Optional, and handed in rather than imported.** `packages/schema` must not depend on
 * `packages/catalog` — the dependency runs the other way — and `checkAgainstPreset` already settled
 * the shape by taking the preset as an argument. Given no lookup, every other invariant runs exactly
 * as it did before this sprint, which is what keeps the existing callers unchanged.
 */
export type PresetLookup = (
  catalogId: string,
) => { itemRange?: { min: number; max: number } } | undefined;

export function checkInvariants(doc: RetorikaDocument, lookup?: PresetLookup): Violation[] {
  const violations: Violation[] = [];
  const sectionIds = new Set<string>();
  const pageIds = new Set<string>();
  const slugs = new Set<string>();

  for (const [pageIndex, page] of doc.pages.entries()) {
    // Rule 5 again, one level up. Two pages sharing an id make `insertSection(doc, pageId, …)`
    // ambiguous about which one it wrote to; two sharing a slug make one of them unreachable,
    // because the publisher names a file after it. Neither was checked anywhere until pages could
    // be created (ADR 0022) — with exactly one page, neither could happen.
    if (pageIds.has(page.id)) {
      violations.push({
        rule: 5,
        path: `pages[${pageIndex}]`,
        message: `page id "${page.id}" appears more than once in the document`,
      });
    }
    pageIds.add(page.id);
    if (slugs.has(page.slug)) {
      violations.push({
        rule: 5,
        path: `pages[${pageIndex}]`,
        message: `page slug "${page.slug}" appears more than once in the document`,
      });
    }
    slugs.add(page.slug);

    for (const [sectionIndex, section] of page.sections.entries()) {
      const path = `pages[${pageIndex}].sections[${sectionIndex}]`;

      // Rule 5: no orphan elements. A section belonging to two pages would make
      // "every element belongs to a section, every section to a page" ambiguous.
      if (sectionIds.has(section.id)) {
        violations.push({
          rule: 5,
          path,
          message: `section id "${section.id}" appears more than once in the document`,
        });
      }
      sectionIds.add(section.id);

      checkSection(section, path, violations);
    }
  }

  /**
   * Rule 5, for a binding — **both halves of it now** (ADR 0033 §9).
   *
   * The collection check has been here since phase 0 and had never had a non-trivial case to judge,
   * because nothing could write a collection. The **field** check is new, and it closes the half that
   * was missing: until today a binding naming a field no entry carried was perfectly legal, and it is
   * exactly the dead reference rule 5 exists to forbid — a card drawing a field that is not there is
   * a hole on a published page.
   */
  const byId = new Map(doc.collections.map((collection) => [collection.id, collection]));
  for (const [pageIndex, page] of doc.pages.entries()) {
    for (const [sectionIndex, section] of page.sections.entries()) {
      const at = `pages[${pageIndex}].sections[${sectionIndex}]`;
      const elements = flattenElements(section.content);

      for (const element of elements) {
        const binding = element.binding;
        if (!binding) continue;
        const collection = byId.get(binding.collectionId);
        if (!collection) {
          violations.push({
            rule: 5,
            path: `${at}.content#${element.id}`,
            message: `binding references unknown collection "${binding.collectionId}"`,
          });
          continue;
        }
        /**
         * **A bound leaf has to be inside a list bound to the same collection** (ADR 0033 §4), and
         * **this invariant is day 4's, not day 3's** — writing the renderer is what found it missing.
         * `boundValue` in `packages/renderer/src/build.ts` throws on this document, and a document
         * the schema accepts and the renderer refuses is the shape of failure ADR 0030 closed for the
         * tablet bucket: it could be built, stored and autosaved, and then fail at the download.
         */
        if (binding.field !== undefined && page.binding?.collectionId !== binding.collectionId) {
          const container = elements.find(
            (candidate) =>
              candidate.role === "list" &&
              candidate.binding?.collectionId === binding.collectionId &&
              candidate.binding.field === undefined &&
              (candidate.items ?? []).some((item) =>
                item.elements.some((leaf) => leaf.id === element.id),
              ),
          );
          if (!container) {
            violations.push({
              rule: 5,
              path: `${at}.content#${element.id}`,
              message:
                `reads "${binding.field}" of "${binding.collectionId}" but sits in no list ` +
                "bound to it and on no page drawn per its entry, so there is no entry to read it from",
            });
            continue;
          }
        }

        if (binding.field === undefined) continue;
        const without = collection.entries.filter(
          (entry) => entry.fields[binding.field as string] === undefined,
        );
        if (without.length > 0) {
          violations.push({
            rule: 5,
            path: `${at}.content#${element.id}`,
            message:
              `binding reads "${binding.field}" of "${binding.collectionId}", ` +
              `which ${without.length} of its ${collection.entries.length} entries do not carry`,
          });
        }
      }

      /**
       * **A bound list stores exactly one item** (ADR 0033 §2).
       *
       * The elements inside a card are one shared template and the renderer draws one card per
       * entry, so a second stored item is ambiguous — a second template, or a card that was there
       * before the binding? An ambiguity the schema admits is an invalid state waiting for somebody
       * else to find, which is why this is a violation rather than a convention.
       */
      for (const element of elements) {
        const binding = element.binding;
        if (!binding || binding.field !== undefined || element.role !== "list") continue;
        const items = element.items ?? [];
        if (items.length !== 1) {
          violations.push({
            rule: 1,
            path: `${at}.content#${element.id}`,
            message: `a list bound to "${binding.collectionId}" stores one template item, not ${items.length}`,
          });
        }

        /**
         * **And the entries have to fit the section that shows them** (ADR 0033 §8), which only a
         * caller holding the catalog can judge — so it only runs when one hands a lookup in.
         */
        const range = lookup?.(section.preset.catalogId)?.itemRange;
        const collection = byId.get(binding.collectionId);
        if (!range || !collection) continue;
        const count = collection.entries.length;
        if (count < range.min || count > range.max) {
          violations.push({
            rule: 1,
            path: `${at}.content#${element.id}`,
            message:
              `"${binding.collectionId}" has ${count} entries and this section shows ` +
              `${range.min} to ${range.max}`,
          });
        }
      }
    }
  }

  /**
   * **A page per entry** (ADR 0040): the page's binding, read like a leaf's.
   *
   * Rule 5 for the collection and the title field — a page titled by a field some entry lacks is a
   * hole in a `<title>`; rule 1 for «one page per collection», the ambiguity `one template item`
   * refuses, at page scale; and the first page is the site's entry (`index.html`) and is drawn
   * exactly once, so it may not be the template. The entries' slugs are the other half: every
   * entry of a collection with a page needs one, because the publisher names a file after it, and
   * no slug may repeat another page's or entry's, because two files cannot share a name.
   */
  const pagesPerCollection = new Map<string, number>();
  for (const [pageIndex, page] of doc.pages.entries()) {
    const binding = page.binding;
    if (!binding) continue;
    const path = `pages[${pageIndex}]`;
    if (pageIndex === 0) {
      violations.push({
        rule: 5,
        path,
        message: `the first page is the site's entry and cannot be drawn once per entry of "${binding.collectionId}"`,
      });
    }
    const collection = byId.get(binding.collectionId);
    if (!collection) {
      violations.push({
        rule: 5,
        path,
        message: `page binding references unknown collection "${binding.collectionId}"`,
      });
      continue;
    }
    const seen = (pagesPerCollection.get(binding.collectionId) ?? 0) + 1;
    pagesPerCollection.set(binding.collectionId, seen);
    if (seen === 2) {
      violations.push({
        rule: 1,
        path,
        message: `"${binding.collectionId}" is drawn per entry by more than one page`,
      });
    }
    const untitled = collection.entries.filter(
      (entry) => entry.fields[binding.titleField] === undefined,
    );
    if (untitled.length > 0) {
      violations.push({
        rule: 5,
        path,
        message:
          `page "${page.id}" titles its entries by "${binding.titleField}", ` +
          `which ${untitled.length} of the ${collection.entries.length} entries of "${binding.collectionId}" do not carry`,
      });
    }
    const unslugged = collection.entries.filter((entry) => entry.slug === undefined);
    if (unslugged.length > 0) {
      violations.push({
        rule: 5,
        path,
        message:
          `"${binding.collectionId}" is drawn once per entry and ${unslugged.length} of its ` +
          `${collection.entries.length} entries have no slug to be drawn under`,
      });
    }
  }
  for (const [collectionIndex, collection] of doc.collections.entries()) {
    for (const [entryIndex, entry] of collection.entries.entries()) {
      if (entry.slug === undefined) continue;
      if (slugs.has(entry.slug)) {
        violations.push({
          rule: 5,
          path: `collections[${collectionIndex}].entries[${entryIndex}]`,
          message: `entry slug "${entry.slug}" is already another page's or entry's`,
        });
      }
      slugs.add(entry.slug);
    }
  }

  return violations;
}
