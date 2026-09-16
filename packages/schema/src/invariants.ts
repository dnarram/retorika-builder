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

export function checkInvariants(doc: RetorikaDocument): Violation[] {
  const violations: Violation[] = [];
  const sectionIds = new Set<string>();

  for (const [pageIndex, page] of doc.pages.entries()) {
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

  const collectionIds = new Set(doc.collections.map((collection) => collection.id));
  for (const [pageIndex, page] of doc.pages.entries()) {
    for (const [sectionIndex, section] of page.sections.entries()) {
      for (const element of flattenElements(section.content)) {
        if (element.binding && !collectionIds.has(element.binding.collectionId)) {
          violations.push({
            rule: 5,
            path: `pages[${pageIndex}].sections[${sectionIndex}].content#${element.id}`,
            message: `binding references unknown collection "${element.binding.collectionId}"`,
          });
        }
      }
    }
  }

  return violations;
}
