import type { ContentElement, RetorikaDocument, Section } from "./document.ts";
import { GRID_COLUMNS } from "./document.ts";
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

    // Rule 4: positions are relative to the section's grid. A span that runs off the
    // twelfth column is an absolute position wearing a disguise.
    if (placement.column + placement.columnSpan - 1 > GRID_COLUMNS) {
      violations.push({
        rule: 4,
        path: at,
        message: `column ${placement.column} + span ${placement.columnSpan} overflows the ${GRID_COLUMNS}-column grid`,
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

  return violations;
}
