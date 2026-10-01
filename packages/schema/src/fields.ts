import type { ContentElement, RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";
import {
  type MarkRun,
  markTextIssue,
  normaliseMarks,
  shiftMarks,
  textEditBetween,
} from "./marks.ts";
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

/**
 * Anchored marks, normalised and refused if they do not fit the text they came with.
 *
 * **Checked here because this is where they enter the document**, and the same reason `applyMark`
 * checks its own range: a refusal at the verb names what caused it, where the same mistake caught
 * later surfaces as a document that will not parse, or — worse, and the whole point of §4b — one
 * that parses and publishes a mark over the wrong words.
 *
 * It is a tripwire and not a routine path. The caller reconciles its captured offsets with the text
 * it is committing before calling, so this throwing means that reconciliation has a bug, and a loud
 * failure on a blur is better than a silent corruption of the owner's own carta.
 */
function checkedAnchored(text: string, anchored: readonly MarkRun[]): MarkRun[] {
  const issue = markTextIssue(text, anchored);
  if (issue) throw new Error(`setElementText: ${issue}.`);
  // Normalised rather than trusted: merging, sorting and dropping empties is what makes two
  // documents meaning the same thing publish the same bytes (INV_5, and the golden corpus).
  return normaliseMarks(anchored);
}

/**
 * The write side of textOf: the same field each value kind carries, replaced.
 *
 * **This is also where marks move with the text under them**, and it is the right place rather
 * than a convenient one: every text write in the product funnels through here — `setElementText`,
 * which the canvas commits a click-to-edit through **and which the fields panel now commits a
 * words-only change through too**, and `applyTextEdits`, which is the download route. Putting the
 * shift in the editor would have covered one and quietly not the others, and a mark that survives
 * the canvas but not the fields panel is worse than one that never survived at all.
 *
 * > **That sentence used to name the fields panel as `applyTextEdits`' caller, and it was wrong in a
 * > way that cost a mark.** Until 1 October 2026 the panel reached neither of these: it rebuilt the
 * > element's whole `ContentValue` and sent it through `fillSlot`, which carries no marks at all — so
 * > the warning one line above was describing a split that already existed, in the file that was
 * > supposed to prevent it. Measured, then routed through `setElementText` (`fieldCommitFor`). Worth
 * > keeping as a note: the comment was accurate about the danger and wrong about the code, which is
 * > the combination that reads as reassuring.
 *
 * `textEditBetween` turns the two strings into the edit ADR 0027 §4 defines, and `shiftMarks`
 * applies it. A text that did not change produces an empty edit and the marks do not move.
 *
 * **`anchored` is ADR 0027 §4b, and it is the better of two paths rather than a second one.** Given,
 * it is used as the answer: the caller watched the edit happen and knows where it was, which two
 * strings cannot say — `"pan y pan y aceite"` losing its second `pan y ` reads to the diff as the
 * *first* one going, and a bold on the first `pan` is destroyed although its own word was never
 * touched. Absent, the diff derives it exactly as before, which is what an IME, the browser's own
 * undo, and any engine that reports no target range all fall back to.
 *
 * One parameter rather than a second verb, so this stays the only place a text write can happen.
 */
function withText(
  element: ContentElement,
  text: string,
  anchored?: readonly MarkRun[],
): ContentElement {
  const value = element.value;
  if (!value) return element;
  switch (value.kind) {
    case "text":
    case "link": {
      const marks =
        anchored === undefined
          ? shiftMarks(value.marks ?? [], textEditBetween(value.text, text))
          : checkedAnchored(text, anchored);
      if (marks.length === 0) {
        // Rebuilt without the key rather than set to undefined: an absent `marks` and an empty one
        // have to publish the same bytes, and only the absent one round-trips through the strict
        // schema with `exactOptionalPropertyTypes` on.
        const { marks: _gone, ...bare } = value;
        return { ...element, value: { ...bare, text } };
      }
      return { ...element, value: { ...value, text, marks } };
    }
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
  anchored?: readonly MarkRun[],
): ContentElement[] | undefined {
  let found = false;
  const next = elements.map((element) => {
    if (element.id === elementId) {
      found = true;
      return withText(element, text, anchored);
    }
    if (!element.items) return element;
    let changedItems = false;
    const items = element.items.map((item) => {
      const replaced = replaceById(item.elements, elementId, text, anchored);
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
 *
 * **`marks` are the ones the caller already shifted**, in the coordinates of the `text` beside them
 * (ADR 0027 §4b). Omitting them is not a lesser call: it is the documented fallback, and it is what
 * every caller that did not watch the edit happen — the download route, an undo, a composition —
 * must do.
 */
export function setElementText(
  doc: RetorikaDocument,
  address: ElementAddress,
  text: string,
  marks?: readonly MarkRun[],
): RetorikaDocument {
  let found = false;
  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== address.sectionId) return section;
      const content = replaceById(section.content, address.elementId, text, marks);
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
      // **Replacing the photo removes `sample`** — ADR 0011 states it in one line, and this is the
      // only place that can keep it true. A new src is by definition the owner's own photo, and a
      // document still claiming it is a sample would make the editor label it «Foto de ejemplo»,
      // count it as missing and warn about it before a download, all of them wrong and all of them
      // in the direction that makes the warning untrustworthy. Destructured out rather than set to
      // undefined: the strict schema and `exactOptionalPropertyTypes` both treat an absent key and
      // a present-but-undefined one as different things.
      const { sample: _replaced, ...value } = element.value;
      return { ...element, value: { ...value, src } };
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
