import type { ContentElement, RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";
import type { Role } from "./roles.ts";

/**
 * Rule 2 in action: the simple view builds its form by walking roles, not positions,
 * which is why it can offer "change the title" no matter where the element sits or
 * whether the section was hand-designed.
 */

export interface EditableField {
  elementId: string;
  role: Role;
  slot: string;
  pageId: string;
  sectionId: string;
  hidden: boolean;
  /** The text a simple-view form would edit, when the value carries one. */
  text?: string;
}

function textOf(element: ContentElement): string | undefined {
  const value = element.value;
  if (!value) return undefined;
  switch (value.kind) {
    case "text":
      return value.text;
    case "link":
      return value.text;
    case "image":
      return value.alt;
    case "map":
      return value.label;
    case "embed":
      return value.label;
    case "field":
      return value.label;
  }
}

/**
 * Every content field in the document, hidden ones included.
 *
 * Hidden elements are listed deliberately: rule 3 exists so the client always finds
 * where to change their phone number, and a listing that skipped hidden elements would
 * make the rule true in storage and false in practice.
 */
export function listEditableFields(doc: RetorikaDocument): EditableField[] {
  const fields: EditableField[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        const text = textOf(element);
        fields.push({
          elementId: element.id,
          role: element.role,
          slot: element.slot,
          pageId: page.id,
          sectionId: section.id,
          hidden: element.hidden,
          ...(text === undefined ? {} : { text }),
        });
      }
    }
  }
  return fields;
}
