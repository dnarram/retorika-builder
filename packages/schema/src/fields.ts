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
 *
 * **Addresses an element by id alone, which is only unambiguous while no two sections share
 * one.** `checkSection` scopes element-id uniqueness to a section, so the moment a section can
 * be duplicated there can be two `el-headline`s and this function would change both. Editing
 * inside the app goes through `setElementText` below for that reason; this one survives only
 * for the download route, which still speaks in bare ids, and goes away with it.
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

/** Which element, unambiguously: section ids are unique document-wide, element ids within one. */
export interface ElementAddress {
  sectionId: string;
  elementId: string;
}

/** The element with this id inside these, replaced; `undefined` when it is not among them. */
function replaceById(
  elements: readonly ContentElement[],
  elementId: string,
  text: string,
): ContentElement[] | undefined {
  let found = false;
  const next = elements.map((element) => {
    if (element.id === elementId) {
      found = true;
      return withText(element, text);
    }
    if (!element.items) return element;
    let changedItems = false;
    const items = element.items.map((item) => {
      const replaced = replaceById(item.elements, elementId, text);
      if (!replaced) return item;
      changedItems = true;
      return { ...item, elements: replaced };
    });
    if (!changedItems) return element;
    found = true;
    return { ...element, items };
  });
  return found ? next : undefined;
}

/**
 * One field, addressed by the section it lives in as well as its own id.
 *
 * This is what the editor commits a text edit through. It replaces exactly one value and, like
 * `applyTextEdits`, never touches structure — so the invariants, which are all structural, hold
 * by construction and the document is not re-parsed on every keystroke's blur.
 *
 * An address that matches nothing throws rather than passing quietly: every address the editor
 * sends was read off the very document it is editing, so a miss is a bug in that round trip, and
 * a silent no-op would show up as an edit that simply did not happen.
 */
export function setElementText(
  doc: RetorikaDocument,
  address: ElementAddress,
  text: string,
): RetorikaDocument {
  let found = false;
  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== address.sectionId) return section;
      const content = replaceById(section.content, address.elementId, text);
      if (!content) return section;
      found = true;
      return { ...section, content };
    }),
  }));
  if (!found) {
    throw new Error(
      `setElementText: no element "${address.elementId}" in section "${address.sectionId}"`,
    );
  }
  return { ...doc, pages };
}

/** The one element with this id inside these, given a new image src. */
function replaceImageSrc(
  elements: readonly ContentElement[],
  elementId: string,
  src: string,
): ContentElement[] | undefined {
  let found = false;
  const next = elements.map((element) => {
    if (element.id === elementId) {
      if (element.value?.kind !== "image") return element;
      found = true;
      return { ...element, value: { ...element.value, src } };
    }
    if (!element.items) return element;
    let changedItems = false;
    const items = element.items.map((item) => {
      const replaced = replaceImageSrc(item.elements, elementId, src);
      if (!replaced) return item;
      changedItems = true;
      return { ...item, elements: replaced };
    });
    if (!changedItems) return element;
    found = true;
    return { ...element, items };
  });
  return found ? next : undefined;
}

/**
 * One image's source, replaced. The alt text goes through `setElementText`, which already treats
 * an image's alt as its text — so this is the other half of the same element, not a second way
 * to edit the same thing.
 *
 * Structure is untouched, exactly as in `setElementText`: an image element that exists keeps
 * existing, in the same slot, in the same place. What changes is which file it names.
 *
 * Throws on a miss, including when the address names an element that is not an image at all.
 * Every address the editor sends was read off the markup it just rendered, so a miss is a bug in
 * that round trip and a silent no-op would look like an upload that simply did not happen.
 */
export function setElementImageSrc(
  doc: RetorikaDocument,
  address: ElementAddress,
  src: string,
): RetorikaDocument {
  let found = false;
  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== address.sectionId) return section;
      const content = replaceImageSrc(section.content, address.elementId, src);
      if (!content) return section;
      found = true;
      return { ...section, content };
    }),
  }));
  if (!found) {
    throw new Error(
      `setElementImageSrc: no image element "${address.elementId}" in section "${address.sectionId}"`,
    );
  }
  return { ...doc, pages };
}
