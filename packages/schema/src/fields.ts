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

/** The write side of textOf: the same field each value kind carries, replaced. */
function withText(element: ContentElement, text: string): ContentElement {
  const value = element.value;
  if (!value) return element;
  switch (value.kind) {
    case "text":
    case "link":
      return { ...element, value: { ...value, text } };
    case "image":
      return { ...element, value: { ...value, alt: text } };
    case "map":
    case "embed":
    case "field":
      return { ...element, value: { ...value, label: text } };
  }
}

function mapElements(
  elements: readonly ContentElement[],
  edits: Readonly<Record<string, string>>,
): ContentElement[] {
  return elements.map((element) => {
    const replacement = edits[element.id];
    const edited = replacement === undefined ? element : withText(element, replacement);
    if (!edited.items) return edited;
    return {
      ...edited,
      items: edited.items.map((item) => ({
        ...item,
        elements: mapElements(item.elements, edits),
      })),
    };
  });
}

/**
 * The write side of listEditableFields: the same elementId addressing, applied back onto
 * the document. Only ever replaces a value already there — never adds, removes or moves an
 * element — so it cannot break rules 1-5, which are all about structure, never content.
 *
 * An id with no matching field is left untouched rather than rejected: the caller (day 6's
 * download route) already treats an unknown id as harmless, and this is the one place both
 * the live preview and the ZIP apply the same edits, so it stays permissive here too.
 */
export function applyTextEdits(
  doc: RetorikaDocument,
  edits: Readonly<Record<string, string>>,
): RetorikaDocument {
  if (Object.keys(edits).length === 0) return doc;
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        content: mapElements(section.content, edits),
      })),
    })),
  };
}
