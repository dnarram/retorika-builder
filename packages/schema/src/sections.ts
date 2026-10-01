import type { ContentElement, ContentValue, Page, RetorikaDocument, Section } from "./document.ts";
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

/**
 * Which line of which list, when the slot being addressed lives inside one.
 *
 * **The line is named by its id and never by its position.** A position would be read against a
 * list the owner can reorder and delete from (`moveItem`, `removeItem`), so an address held across
 * either of those would quietly come to mean a different line — and a silently wrong line is the
 * failure this package exists to refuse. The id is also what the canvas already carries as
 * `data-item`, so the editor has it in hand and never has to count.
 */
export interface ItemAddress {
  /** The slot of the `list` element holding the line, named the way `addItem` names it. */
  list: string;
  /** The line's own id. */
  id: string;
}

/** Which occurrence of which slot, in which section — or, with `item`, in which line of which
 * list. Occurrences are counted in `content` order, the same way `resolvePlacements` counts them,
 * so the two never disagree about which element a preset's geometry belongs to. */
export interface SlotAddress {
  sectionId: string;
  slot: string;
  /** Default 0. Only a slot the preset lets hold more than one ever needs another. */
  occurrence?: number;
  /**
   * Present when `slot` names a slot **of a line** rather than of the section.
   *
   * Absent is the default and the common case — a section's own slots. What it buys is the two
   * slots nothing in this product could reach: a card's `description` in «Qué hago» and a line's
   * in a carta, both `0..1` and therefore absent from a line nobody filled. Absent means nothing
   * renders, so there is no text on the page to click, and the fields panel offers section rows
   * only («a list holds items rather than a value»). Those two have been unreachable since
   * sprint 1 and `prices.ts` names the gap rather than widening it.
   */
  item?: ItemAddress;
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

function indexOfOccurrence(
  elements: readonly ContentElement[],
  slot: string,
  occurrence: number,
): number {
  let seen = 0;
  for (const [index, element] of elements.entries()) {
    if (element.slot !== slot) continue;
    if (seen === occurrence) return index;
    seen += 1;
  }
  return -1;
}

/**
 * The `list` element in a slot, or a refusal naming the section.
 *
 * **Extracted rather than written a fourth time.** `addItem`, `removeItem` and `moveItem` each
 * carried this lookup already, so there were three copies of "which element is the list" before
 * this file needed a fourth — and three is where CLAUDE.md's rule says an abstraction has earned
 * itself. The error text is the one those three already produced, word for word, because a
 * refusal an owner's bug report quotes is not free to change.
 */
function findList(section: Section, slot: string, verb: string): ContentElement {
  const list = section.content.find((element) => element.slot === slot && element.role === "list");
  if (!list) throw new Error(`${verb}: section "${section.id}" has no list in slot "${slot}"`);
  return list;
}

/** The line an `ItemAddress` names, and the list holding it. */
function findItem(
  section: Section,
  address: ItemAddress,
  verb: string,
): { list: ContentElement; item: ListItem } {
  const list = findList(section, address.list, verb);
  const item = (list.items ?? []).find((candidate) => candidate.id === address.id);
  if (!item) throw new Error(`${verb}: list "${address.list}" has no item "${address.id}"`);
  return { list, item };
}

/**
 * A section's content with one line's elements put through `change`.
 *
 * The shared tail of reaching inside a line, so the two verbs that do it cannot come to disagree
 * about where the line goes back — which is the same reason `resolvePlacements` and
 * `indexOfOccurrence` count occurrences in one place.
 */
function withItemElements(
  section: Section,
  address: ItemAddress,
  verb: string,
  change: (elements: readonly ContentElement[]) => ContentElement[],
): ContentElement[] {
  const { list, item } = findItem(section, address, verb);
  const items = (list.items ?? []).map((candidate) =>
    candidate.id === item.id ? { ...candidate, elements: change(candidate.elements) } : candidate,
  );
  return section.content.map((element) => (element === list ? { ...element, items } : element));
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
  const section = found.section;
  const occurrence = fill.occurrence ?? 0;

  // One body for both depths. A line's slots are slots: the occurrence arithmetic, the unhiding
  // and the placement by declared order all mean the same thing inside a line as outside one, and
  // `fill.slotOrder` is the item's order when `fill.item` is set — which the caller already has to
  // know, for the reason the field's own comment gives.
  const filled = (elements: readonly ContentElement[]): ContentElement[] => {
    const at = indexOfOccurrence(elements, fill.slot, occurrence);
    const next = [...elements];
    if (at >= 0) {
      const element = next[at];
      if (!element) throw new Error(`fillSlot: no element at ${at}`);
      next[at] = { ...element, hidden: false, value: fill.value };
      return next;
    }
    // Occurrences are positions in a sequence, not names, so the only one that can be created is
    // the next one. Creating the third of something when there is no second would silently make
    // it the second — and the preset's geometry, which counts occurrences the same way, would
    // then place it where the second belongs.
    const existing = elements.filter((element) => element.slot === fill.slot).length;
    if (occurrence !== existing) {
      throw new Error(
        `fillSlot: cannot create occurrence ${occurrence} of "${fill.slot}", which has ${existing}`,
      );
    }
    const created: ContentElement = {
      // Free across the whole section even when the element is going inside a line: `checkSection`
      // scopes element ids to the section, items included, and `mintElementId` already walks every
      // level — so one line's new element cannot collide with another line's.
      id: mintElementId(section, fill.slot),
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
    const before = next.findIndex((element) => rank(element.slot) > mine);
    next.splice(before === -1 ? next.length : before, 0, created);
    return next;
  };

  const content = fill.item
    ? withItemElements(section, fill.item, "fillSlot", filled)
    : filled(section.content);

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

  // Hiding, inside a line exactly as outside one. **A line's slot is a role, so rule 3 governs
  // it** — which is not in tension with `removeItem` removing a whole line: that comment's own
  // argument is that a line is a repetition rather than a role. The place to put a card's
  // description back has to survive emptying it, or the owner who clears it by accident has
  // nowhere to find it again.
  let emptied = false;
  const hidden = (elements: readonly ContentElement[]): ContentElement[] => {
    const at = indexOfOccurrence(elements, address.slot, address.occurrence ?? 0);
    if (at < 0) return [...elements];
    const next = [...elements];
    const element = next[at];
    if (!element) throw new Error(`clearSlot: no element at ${at}`);
    next[at] = { ...element, hidden: true };
    emptied = true;
    return next;
  };

  const content = address.item
    ? withItemElements(found.section, address.item, "clearSlot", hidden)
    : hidden(found.section.content);

  // Nothing to hide: the document itself comes back, not an equal copy. Reference equality is what
  // the editor's history checks to keep the undo arrow dark for a press that changed nothing —
  // `setVariant`'s test says so in as many words — and a line address must not quietly lose it.
  if (!emptied) return doc;

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

/**
 * A different composition for one section: same content, drawn differently.
 *
 * The cheapest real change in this editor, and the reason is `resolvePlacements`. A preset's
 * geometry is declared per slot occurrence, never per element id (rule 1), so a variant is nothing
 * but a different table of where each slot sits on the twelve-column grid. Swapping the id the
 * section names is the whole operation: no element moves, none is added or removed, and
 * `packages/renderer` resolves the new table against the same content on its next render. Thirteen
 * compositions were built, tested and unreachable until this verb existed.
 *
 * **This cannot validate the variant, and that is deliberate.** Which variants a section has
 * belongs to `@retorika/catalog`, and schema must not import it — that would reverse the
 * dependency arrow the whole package rests on (`testing.ts` says the same thing about why
 * `arbitraryDocument` takes a variant as a parameter). The editor offers only ids that came out of
 * `variantsFor`, and `unknownVariant` in the catalog is the loud backstop if one ever does not:
 * a wrong id throws at render rather than quietly drawing the wrong layout.
 *
 * **It refuses a section carrying its own layout**, which is the one case where it would look like
 * it worked and change nothing. `build.ts` reads `section.layout ?? preset.layoutFor(variantId,
 * …)`, so for a hand-designed section the variant id decides nothing at all — it would only decide
 * what the section becomes if someone later reverted it (`applyRevert` sets `layout: null` and
 * keeps the variant). Changing a setting with no effect now, to alter the outcome of an action
 * nobody has taken yet, is not something a caller can have meant. The error names the order
 * instead: revert first, then choose a composition.
 */
export function setVariant(
  doc: RetorikaDocument,
  sectionId: string,
  variantId: string,
): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`setVariant: no section "${sectionId}"`);
  if (found.section.layout !== null) {
    throw new Error(
      `setVariant: section "${sectionId}" carries its own layout, so a variant id would change ` +
        "nothing. Revert it to the catalog layout first.",
    );
  }
  // The same composition back is not a change, and the caller gets the very same document so a
  // history built on reference equality opens no step. Pressing the composition a section already
  // uses should leave the undo arrow exactly as it was.
  if (found.section.preset.variantId === variantId) return doc;

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id !== found.page.id
        ? page
        : {
            ...page,
            sections: page.sections.map((section) =>
              section.id === sectionId
                ? { ...section, preset: { ...section.preset, variantId } }
                : section,
            ),
          },
    ),
  });
}

/** One line of a list, as `contentElementSchema` declares it: an id and the elements inside. */
export interface ListItem {
  id: string;
  elements: ContentElement[];
}

/**
 * A free item id for a list, and free element ids for what goes inside it.
 *
 * Element ids are unique **within a section** (`mintElementId`), and a list item's elements are
 * part of that section, so a second line cannot simply reuse the first line's ids. The catalog
 * builds a line without knowing what is already there — it has never seen the document — so the
 * ids it produces are templates, and this is what makes them free, exactly as `insertSection`
 * re-mints a section id for the same reason.
 *
 * Free across the whole section rather than within one list: element ids are unique per section
 * (`mintElementId` says so), and the editor addresses a line by its `data-item` inside a section
 * that may hold more than one list. Which list a line is going into therefore does not come into
 * it, which is why no slot is named here.
 */
function mintItem(section: Section, item: ListItem): ListItem {
  const usedItems = new Set(
    section.content.flatMap((element) => (element.items ?? []).map((existing) => existing.id)),
  );
  let itemId = item.id;
  let suffix = 2;
  while (usedItems.has(itemId)) {
    itemId = `${item.id}-${suffix}`;
    suffix += 1;
  }

  const used = new Set(flattenElements(section.content).map((element) => element.id));
  const elements = item.elements.map((element) => {
    let id = element.id;
    let n = 2;
    while (used.has(id)) {
      id = `${element.id}-${n}`;
      n += 1;
    }
    used.add(id);
    return { ...element, id };
  });

  return { id: itemId, elements };
}

/**
 * One more line at the end of a list — a dish on a carta, a row on a tariff.
 *
 * **The first verb in this file that reaches inside a list.** Until it existed, a list had
 * exactly as many items as whatever produced the section gave it: the questionnaire's answers for
 * "Qué hago", and a single marker line for anything added from the pill. Nothing in the editor
 * could reach the second line, which made a twelve-line price list a twelve-line price list in
 * name only.
 *
 * The line arrives fully formed, because what a valid one looks like belongs to the catalog
 * (`blankItem`), which this package must not import — the same division `insertSection` makes and
 * for the same reason. What this owns is the ids: the catalog's are templates, and they are
 * re-minted here against the very section being written, which is the only place that knows what
 * is free.
 *
 * **It cannot enforce the maximum**, because how many lines a section admits is the catalog's
 * (`PRICES_LINES`), and schema may not ask. The editor stops offering the control at the cap, the
 * same way it stops offering a composition to a section that has only one.
 */
export function addItem(
  doc: RetorikaDocument,
  sectionId: string,
  slot: string,
  item: ListItem,
): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`addItem: no section "${sectionId}"`);
  const list = findList(found.section, slot, "addItem");

  const minted = mintItem(found.section, item);
  const content = found.section.content.map((element) =>
    element === list ? { ...element, items: [...(element.items ?? []), minted] } : element,
  );

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id !== found.page.id
        ? page
        : {
            ...page,
            sections: page.sections.map((section) =>
              section.id === sectionId ? { ...section, content } : section,
            ),
          },
    ),
  });
}

/**
 * One line gone, and gone for real.
 *
 * **This removes rather than hides, and that is deliberate against rule 3.** The rule is about
 * *roles*: a role hides so the place to put it back never disappears, and the fields panel is
 * what shows an owner an empty slot they can fill again. A list item is not a role — it is a
 * repetition, closer to a section than to a slot — and a hidden line would sit in the document
 * with nothing anywhere able to show it again. ADR 0003 settled the same question for a section
 * ("there is no trash inside the document") and ADR 0014 settled the net: the undo history, not a
 * dialog.
 *
 * **It cannot enforce the minimum** either. The editor is what stops offering the control on the
 * last line; a list with no items renders as nothing at all (`build.ts` drops a `ul` with no
 * `li`), which would be a section with a heading and an invisible hole under it.
 */
export function removeItem(
  doc: RetorikaDocument,
  sectionId: string,
  slot: string,
  itemId: string,
): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`removeItem: no section "${sectionId}"`);
  const list = findList(found.section, slot, "removeItem");
  if (!(list.items ?? []).some((item) => item.id === itemId)) {
    throw new Error(`removeItem: list "${slot}" has no item "${itemId}"`);
  }

  const content = found.section.content.map((element) =>
    element === list
      ? { ...element, items: (element.items ?? []).filter((item) => item.id !== itemId) }
      : element,
  );

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id !== found.page.id
        ? page
        : {
            ...page,
            sections: page.sections.map((section) =>
              section.id === sectionId ? { ...section, content } : section,
            ),
          },
    ),
  });
}

/**
 * One line moved within its own list — the third photograph made first.
 *
 * **The verb an owner asked for, arrived by the only road document rule 4 leaves open.** The
 * second usability session asked for «mover libremente las imágenes» and rule 4 refuses free
 * positioning; the rule stands and `docs/document-rules.md` carries the request on the record. But
 * «mover una imagen» and «colocar una imagen en píxeles» are not the same want, and this is the
 * half of it the rules allow: somebody who has uploaded eight photographs of their dishes wants
 * the best one first, not the fourth one nudged eleven pixels left.
 *
 * Nothing about the section's geometry changes. A list occupies one placement whatever it holds,
 * and its items render in array order inside it — so reordering them is a change of content, not
 * of layout, and `layoutFor` recomputes the same placements it did before.
 *
 * `toIndex` is clamped exactly as `moveSection` clamps it: a caller saying "to the end" can pass
 * the length or anything past it and does not have to special-case either edge. Moving an item to
 * where it already is produces an equal document rather than an error, which is what lets the
 * editor draw both arrows on every line and disable neither.
 */
export function moveItem(
  doc: RetorikaDocument,
  sectionId: string,
  slot: string,
  itemId: string,
  toIndex: number,
): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`moveItem: no section "${sectionId}"`);
  const list = findList(found.section, slot, "moveItem");

  const items = [...(list.items ?? [])];
  const fromIndex = items.findIndex((item) => item.id === itemId);
  if (fromIndex < 0) throw new Error(`moveItem: list "${slot}" has no item "${itemId}"`);

  const [moved] = items.splice(fromIndex, 1);
  if (!moved) throw new Error(`moveItem: list "${slot}" has no item "${itemId}"`);
  items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, moved);

  const content = found.section.content.map((element) =>
    element === list ? { ...element, items } : element,
  );

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id !== found.page.id
        ? page
        : {
            ...page,
            sections: page.sections.map((section) =>
              section.id === sectionId ? { ...section, content } : section,
            ),
          },
    ),
  });
}
