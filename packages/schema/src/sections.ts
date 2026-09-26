import type { ContentValue, Page, RetorikaDocument, Section } from "./document.ts";
import { flattenElements } from "./invariants.ts";
import { parseDocument } from "./parse.ts";
import type { Role } from "./roles.ts";

/**
 * Structural mutations on a document — add, remove, move, duplicate a section — as opposed to
 * `fields.ts`, which only ever replaces a value already there. Deliberately kept apart: the
 * comment on `applyTextEdits` promises it "cannot add, remove or move an element", and that
 * promise only stays true if verbs that do exactly that live somewhere else.
 *
 * Every function here is pure (document in, document out) and ends by handing its result to
 * `parseDocument`, the same validation gate everything that writes a document in this
 * repository goes through — never assumed safe just because the change was structural.
 */

export function findSection(
  doc: RetorikaDocument,
  sectionId: string,
): { page: Page; section: Section } | undefined {
  for (const page of doc.pages) {
    const section = page.sections.find((candidate) => candidate.id === sectionId);
    if (section) return { page, section };
  }
  return undefined;
}

/**
 * Real deletion, not a hide: ADR 0003 settled that there is no trash inside the document, and
 * ADR 0014 settled that this runs immediately, with no confirmation — the undo history the
 * editor already keeps (day 2) is the safety net, not a dialog. Throws on an unknown id rather
 * than doing nothing: every id the editor sends came from a section it just showed the user,
 * so a miss is a bug, and silently doing nothing would look like a delete that did not work.
 */
export function deleteSection(doc: RetorikaDocument, sectionId: string): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`deleteSection: no section "${sectionId}"`);

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === found.page.id
        ? { ...page, sections: page.sections.filter((section) => section.id !== sectionId) }
        : page,
    ),
  });
}

/**
 * A section id not already used anywhere in the document, deterministic and derived from
 * `base` — no clock, no random suffix, so two builds of the same sequence of edits produce the
 * same ids and the golden corpus stays meaningful. `base` is normally the id being duplicated
 * from, already taken by definition, so this always looks past it: `sec-cover` first tries
 * `sec-cover-2`, and duplicating that tries `sec-cover-3` rather than `sec-cover-2-2` — the
 * existing `-2` is stripped before counting up, so duplicating a duplicate does not nest.
 */
export function mintSectionId(doc: RetorikaDocument, base: string): string {
  const used = new Set(doc.pages.flatMap((page) => page.sections.map((section) => section.id)));
  const root = base.replace(/-\d+$/, "");
  if (!used.has(root)) return root;
  let suffix = 2;
  while (used.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

/**
 * A copy of a section, right after the original on the same page, with a freshly minted id.
 *
 * Everything else about the clone — every element id, every layout placement, every
 * breakpoint patch — is copied verbatim, deliberately. Element ids are unique only *within* a
 * section (`checkSection` in invariants.ts), so keeping them means the clone's own layout
 * (which references those same ids in its placements) stays valid without rewriting a single
 * one; re-minting them would mean rebuilding the layout too, for no benefit the user would ever
 * see. What must not collide is the one id that is unique document-wide: the section's own.
 */
export function duplicateSection(doc: RetorikaDocument, sectionId: string): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`duplicateSection: no section "${sectionId}"`);
  const clone: Section = { ...found.section, id: mintSectionId(doc, sectionId) };

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== found.page.id) return page;
      const index = page.sections.findIndex((section) => section.id === sectionId);
      const sections = [...page.sections];
      sections.splice(index + 1, 0, clone);
      return { ...page, sections };
    }),
  });
}

/**
 * A section moved to `toIndex` on its own page, the rest kept in their relative order.
 * `toIndex` is clamped to the page's bounds rather than rejected: a caller building this from
 * "move up" / "move down" on the section nearest an edge can just decrement or increment past
 * the end without special-casing it, and clamping is exactly what should happen there.
 */
export function moveSection(
  doc: RetorikaDocument,
  sectionId: string,
  toIndex: number,
): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`moveSection: no section "${sectionId}"`);

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== found.page.id) return page;
      const sections = [...page.sections];
      const fromIndex = sections.findIndex((section) => section.id === sectionId);
      const [moved] = sections.splice(fromIndex, 1);
      if (!moved) throw new Error(`moveSection: no section "${sectionId}"`);
      const clamped = Math.max(0, Math.min(toIndex, sections.length));
      sections.splice(clamped, 0, moved);
      return { ...page, sections };
    }),
  });
}

/**
 * A section placed at `toIndex` on a given page, the rest shifted down.
 *
 * The section arrives fully built — the catalog's `blankSection` or the generator's own
 * `contactSectionFor` makes it — because what a valid empty section of a given kind looks like
 * is the catalog's business, and this package must not depend on it (the dependency arrow runs
 * catalog → schema, never back). All that is enforced here is what only the document can know:
 * that the page exists and that the id is free. `mintSectionId` is how a caller gets a free one.
 *
 * `toIndex` is clamped, like `moveSection`: a caller inserting "after the last section" can pass
 * `sections.length` or anything beyond it without special-casing the end.
 */
export function insertSection(
  doc: RetorikaDocument,
  pageId: string,
  toIndex: number,
  section: Section,
): RetorikaDocument {
  const page = doc.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`insertSection: no page "${pageId}"`);
  if (findSection(doc, section.id)) {
    throw new Error(`insertSection: section id "${section.id}" is already taken`);
  }

  return parseDocument({
    ...doc,
    pages: doc.pages.map((candidate) => {
      if (candidate.id !== pageId) return candidate;
      const sections = [...candidate.sections];
      sections.splice(Math.max(0, Math.min(toIndex, sections.length)), 0, section);
      return { ...candidate, sections };
    }),
  });
}

/** Which occurrence of which slot, in which section. Occurrences are counted in `content` order,
 * the same way `resolvePlacements` counts them, so the two never disagree about which element a
 * preset's geometry belongs to. */
export interface SlotAddress {
  sectionId: string;
  slot: string;
  /** Default 0. Only a slot the preset lets hold more than one ever needs another. */
  occurrence?: number;
}

export interface SlotFill extends SlotAddress {
  role: Role;
  value: ContentValue;
  /**
   * The preset's slots, in the order it declares them.
   *
   * Passed in rather than looked up, because the dependency arrow runs catalog → schema and this
   * package must not learn what a catalog is. It is what lets a created element land where the
   * section's own shape says it belongs instead of at the end — which matters for reading order,
   * the one thing a grid layout does not decide.
   */
  slotOrder: readonly string[];
}

/** An element id free within this section. Uniqueness is scoped to the section, items included
 * (`checkSection`), so this looks at every level rather than only the top. */
export function mintElementId(section: Section, slot: string): string {
  const used = new Set(flattenElements(section.content).map((element) => element.id));
  const root = `el-${slot}`;
  if (!used.has(root)) return root;
  let suffix = 2;
  while (used.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

function indexOfOccurrence(section: Section, slot: string, occurrence: number): number {
  let seen = 0;
  for (const [index, element] of section.content.entries()) {
    if (element.slot !== slot) continue;
    if (seen === occurrence) return index;
    seen += 1;
  }
  return -1;
}

/**
 * A slot given a value — created if it was not there, and shown again if it was hidden.
 *
 * This is the verb the editor's field panel commits through, and it is here rather than in
 * `fields.ts` for one reason: **it can add an element**, and that file's comment promises it
 * never adds, removes or moves one. An optional slot nobody filled does not exist in the
 * document, so it renders as nothing, so there is nowhere to click — which is exactly the case
 * the panel exists for.
 *
 * Filling always unhides. An empty field and a hidden element are the same thing to the person
 * looking at the page, so typing into one is what brings it back.
 */
export function fillSlot(doc: RetorikaDocument, fill: SlotFill): RetorikaDocument {
  const found = findSection(doc, fill.sectionId);
  if (!found) throw new Error(`fillSlot: no section "${fill.sectionId}"`);
  const occurrence = fill.occurrence ?? 0;
  const at = indexOfOccurrence(found.section, fill.slot, occurrence);

  const content = [...found.section.content];
  if (at >= 0) {
    const element = content[at];
    if (!element) throw new Error(`fillSlot: no element at ${at}`);
    content[at] = { ...element, hidden: false, value: fill.value };
  } else {
    // Occurrences are positions in a sequence, not names, so the only one that can be created is
    // the next one. Creating the third of something when there is no second would silently make
    // it the second — and the preset's geometry, which counts occurrences the same way, would
    // then place it where the second belongs.
    const existing = found.section.content.filter((element) => element.slot === fill.slot).length;
    if (occurrence !== existing) {
      throw new Error(
        `fillSlot: cannot create occurrence ${occurrence} of "${fill.slot}", which has ${existing}`,
      );
    }
    const created: Section["content"][number] = {
      id: mintElementId(found.section, fill.slot),
      role: fill.role,
      hidden: false,
      slot: fill.slot,
      value: fill.value,
    };
    // Placed by the preset's own slot order, so the document reads the way the section is
    // declared rather than the order someone happened to fill it in.
    const rank = (slot: string) => {
      const index = fill.slotOrder.indexOf(slot);
      return index === -1 ? fill.slotOrder.length : index;
    };
    const mine = rank(fill.slot);
    const before = content.findIndex((element) => rank(element.slot) > mine);
    content.splice(before === -1 ? content.length : before, 0, created);
  }

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id !== found.page.id
        ? page
        : {
            ...page,
            sections: page.sections.map((section) =>
              section.id === fill.sectionId ? { ...section, content } : section,
            ),
          },
    ),
  });
}

/**
 * A slot emptied — which means **hidden, never removed** (document rule 3, and ADR 0003's
 * scoping of it). The place to put it back has to survive, or the owner who clears their phone
 * number by accident has no way to find where it was.
 *
 * Doing nothing when the slot is already empty is right rather than lenient: there is no element
 * to hide, and the person sees the same empty field either way.
 */
export function clearSlot(doc: RetorikaDocument, address: SlotAddress): RetorikaDocument {
  const found = findSection(doc, address.sectionId);
  if (!found) throw new Error(`clearSlot: no section "${address.sectionId}"`);
  const at = indexOfOccurrence(found.section, address.slot, address.occurrence ?? 0);
  if (at < 0) return doc;

  const content = [...found.section.content];
  const element = content[at];
  if (!element) throw new Error(`clearSlot: no element at ${at}`);
  content[at] = { ...element, hidden: true };

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id !== found.page.id
        ? page
        : {
            ...page,
            sections: page.sections.map((section) =>
              section.id === address.sectionId ? { ...section, content } : section,
            ),
          },
    ),
  });
}
