import type { Collection, ContentElement, EntryField, RetorikaDocument } from "./document.ts";
import { collectionSchema } from "./document.ts";
import type { ElementAddress } from "./fields.ts";
// `flattenElements` lives beside the invariants, because that is what first needed to walk every
// element including a list's. Imported in this direction only: the invariants do their own walk
// rather than reaching back here, which is what keeps the two files from forming a cycle.
// `PresetLookup` is declared there too, and deliberately once: `preset.ts` would be its natural home
// but it already imports `Violation` from `invariants.ts`, so putting it there would make a cycle.
import { flattenElements, type PresetLookup } from "./invariants.ts";

/**
 * The verbs for «el contenido reutilizable» — a collection, its entries, and an element's binding to
 * one (ADR 0033).
 *
 * **Three verbs are deliberately not here**: `bindList`, `unbindList` and `collectionFromList`, the
 * ones that change a *section* rather than a collection. They arrive with the editor that calls them,
 * because each of them is only safe alongside the warning the ADR requires — and a verb that drops a
 * card has no business existing a sprint before the interface that says so first.
 *
 * Every verb here follows the rule `setElementStyle` and `setPlacement` already set: **the identical
 * document back when nothing changes**, so a control pressed twice opens one history step and not two.
 * And every refusal is a `throw` whose message names the thing the caller has to act on — a section,
 * a field, a number — because a refusal a caller cannot act on is a refusal that gets worked around.
 */

/** Where a collection is used: every section with a list bound to it, and the field names those
 * bindings read. The reader behind both the refusals below and the editor's «aparece en N sitios». */
export interface CollectionUse {
  pageId: string;
  sectionId: string;
  catalogId: string;
  /** The fields the template's leaves read from each entry, in document order, without repeats. */
  fields: string[];
}

/** Every place this collection is bound, in the order a person reads the site. */
export function usesOfCollection(doc: RetorikaDocument, collectionId: string): CollectionUse[] {
  const out: CollectionUse[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      const elements = flattenElements(section.content);
      const container = elements.find(
        (element) =>
          element.role === "list" &&
          element.binding?.collectionId === collectionId &&
          element.binding.field === undefined,
      );
      if (!container) continue;
      const fields: string[] = [];
      for (const element of elements) {
        const field = element.binding?.field;
        if (element.binding?.collectionId !== collectionId || field === undefined) continue;
        if (!fields.includes(field)) fields.push(field);
      }
      out.push({
        pageId: page.id,
        sectionId: section.id,
        catalogId: section.preset.catalogId,
        fields,
      });
    }
  }
  return out;
}

/** Every field name any binding anywhere reads from this collection — the set an entry has to carry
 * in full, because a card drawing a field the entry does not have is a hole on the page. */
function fieldsRead(doc: RetorikaDocument, collectionId: string): string[] {
  const fields = new Set<string>();
  for (const use of usesOfCollection(doc, collectionId)) {
    for (const field of use.fields) fields.add(field);
  }
  return [...fields].sort();
}

function findCollection(doc: RetorikaDocument, collectionId: string, verb: string): Collection {
  const found = doc.collections.find((collection) => collection.id === collectionId);
  if (!found) throw new Error(`${verb}: no collection "${collectionId}"`);
  return found;
}

function withCollections(doc: RetorikaDocument, collections: Collection[]): RetorikaDocument {
  return { ...doc, collections };
}

function replaceCollection(
  doc: RetorikaDocument,
  collectionId: string,
  next: (collection: Collection) => Collection,
): RetorikaDocument {
  return withCollections(
    doc,
    doc.collections.map((collection) =>
      collection.id === collectionId ? next(collection) : collection,
    ),
  );
}

/**
 * **The cardinality rule, in both directions** (ADR 0033 §8).
 *
 * A bound section shows one card per entry, so the entry count *is* the card count. The catalog
 * declares how many a section may hold — «Qué hago» is 1..6, ADR 0013 — and this is what stops a
 * collection and a section from disagreeing.
 *
 * **It is the first thing in this repository to validate `itemRange`, and that is on purpose rather
 * than by accident.** Until today the field was declared by five presets and read in one place, the
 * editor's own `canAdd` (`Editor.tsx:282`), which gates the «añadir línea» control. That gate cannot
 * reach this case: entries are added in the collections panel, which does not know which sections are
 * bound. So for a bound list the rule has to live where the document is judged rather than where a
 * button is drawn.
 *
 * An unbound list's item count is still not checked here, and that is unchanged by this sprint —
 * worth saying rather than leaving for somebody to discover as an inconsistency.
 */
/**
 * Why a collection could not have this many entries, as data rather than as a sentence.
 *
 * **Structured because the panel has to say it in Spanish** and a verb has to say it in an error, and
 * those are two renderings of one fact. A reader that returned a sentence would have forced the panel
 * to parse English back apart, or forced a second copy of the rule to exist for the interface — which
 * is how a message and a refusal end up disagreeing.
 */
export interface CardinalityBlock {
  sectionId: string;
  catalogId: string;
  /** Which end is in the way, so a caller can say «ya es el mínimo» rather than quoting both. */
  bound: "min" | "max";
  limit: number;
  /** What the entry count would become. */
  would: number;
}

/**
 * **The cardinality rule, in both directions** (ADR 0033 §8), asked as a question.
 *
 * A bound section shows one card per entry, so the entry count *is* the card count. The catalog
 * declares how many a section may hold — «Qué hago» is 1..6, ADR 0013 — and this is what stops a
 * collection and a section from disagreeing.
 *
 * **It is the first thing in this repository to validate `itemRange`, and that is on purpose rather
 * than by accident.** Until sprint 14 the field was declared by five presets and read in one place,
 * the editor's own `canAdd`, which gates the «añadir línea» control. That gate cannot reach this
 * case: entries are added in the collections panel, which does not know which sections are bound. So
 * for a bound list the rule has to live where the document is judged rather than where a button is
 * drawn.
 *
 * An unbound list's item count is still not checked here, and that is unchanged by this sprint —
 * worth saying rather than leaving for somebody to discover as an inconsistency.
 *
 * The first section in reading order that objects is the one returned: a panel showing «and two
 * others» would be a sentence nobody acts on differently.
 */
export function entryCountBlock(
  doc: RetorikaDocument,
  collectionId: string,
  would: number,
  lookup: PresetLookup,
): CardinalityBlock | undefined {
  for (const use of usesOfCollection(doc, collectionId)) {
    const range = lookup(use.catalogId)?.itemRange;
    if (!range) continue;
    if (would < range.min) {
      return {
        sectionId: use.sectionId,
        catalogId: use.catalogId,
        bound: "min",
        limit: range.min,
        would,
      };
    }
    if (would > range.max) {
      return {
        sectionId: use.sectionId,
        catalogId: use.catalogId,
        bound: "max",
        limit: range.max,
        would,
      };
    }
  }
  return undefined;
}

/** The same fact as a sentence, for a verb's refusal. English, like every other error in this
 * package; the Spanish the owner reads is composed in the panel from its own locale file. */
function cardinalityIssue(
  doc: RetorikaDocument,
  collectionId: string,
  would: number,
  lookup: PresetLookup,
): string | undefined {
  const block = entryCountBlock(doc, collectionId, would, lookup);
  if (!block) return undefined;
  return block.bound === "min"
    ? `section "${block.sectionId}" shows at least ${block.limit} and this would leave ${block.would}`
    : `section "${block.sectionId}" shows at most ${block.limit} and this would make ${block.would}`;
}

/** An id nothing else in this document is using, from a name. */
export function mintCollectionId(doc: RetorikaDocument, base: string): string {
  const used = new Set(doc.collections.map((collection) => collection.id));
  const root =
    `col-${base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}`.replace(/-+$/, "") || "col-lista";
  if (!used.has(root)) return root;
  let suffix = 2;
  while (used.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

/** A new, empty collection. Empty is a real state: a collection with no entries yet cannot be bound
 * to anything (`cardinalityIssue` refuses a count under the minimum), so there is nothing to guard. */
export function addCollection(doc: RetorikaDocument, name: string, id?: string): RetorikaDocument {
  const trimmed = name.trim();
  if (trimmed === "") throw new Error("addCollection: a collection needs a name");
  const minted = id ?? mintCollectionId(doc, trimmed);
  if (doc.collections.some((collection) => collection.id === minted)) {
    throw new Error(`addCollection: a collection "${minted}" already exists`);
  }
  return withCollections(doc, [
    ...doc.collections,
    collectionSchema.parse({ id: minted, name: trimmed, entries: [] }),
  ]);
}

export function renameCollection(
  doc: RetorikaDocument,
  collectionId: string,
  name: string,
): RetorikaDocument {
  const collection = findCollection(doc, collectionId, "renameCollection");
  const trimmed = name.trim();
  if (trimmed === "") throw new Error("renameCollection: a collection needs a name");
  if (trimmed === collection.name) return doc;
  return replaceCollection(doc, collectionId, (found) => ({ ...found, name: trimmed }));
}

/**
 * A collection gone — **and refused while anything is still bound to it.**
 *
 * **This is the clause ADR 0033 did not take, and building this is what found it missing.** The ADR
 * was signed with the question open; it is answered here and recorded in that file as an amendment,
 * because the alternative was a verb improvising a decision about somebody's content.
 *
 * It **refuses** rather than unbinding for the caller, and names what points at it. Unbinding is not a
 * neutral tidy-up: ADR 0033 §7's exit turns the entries into ordinary cards carrying their own text
 * and marks, which is a change to the *page* and belongs to a deliberate act with a warning in front
 * of it. Doing that silently, as a side effect of deleting a list the owner was thinking about rather
 * than the sections showing it, is how content disappears without anybody deciding it should.
 *
 * So the path is the honest one: unbind the sections that use it — keeping what they show — and then
 * the collection has nothing to take with it.
 */
export function deleteCollection(doc: RetorikaDocument, collectionId: string): RetorikaDocument {
  findCollection(doc, collectionId, "deleteCollection");
  const uses = usesOfCollection(doc, collectionId);
  if (uses.length > 0) {
    const named = uses.map((use) => `"${use.sectionId}"`).join(", ");
    throw new Error(
      `deleteCollection: ${uses.length} section(s) still show "${collectionId}" — ${named}. ` +
        "Unbind them first, which keeps the cards they are showing.",
    );
  }
  return withCollections(
    doc,
    doc.collections.filter((collection) => collection.id !== collectionId),
  );
}

/**
 * One entry added at the end.
 *
 * Two refusals, and both are the invalid state made unreachable rather than repaired later:
 *
 * - **Every field any binding reads has to be here.** An entry missing one would draw a card with a
 *   hole in it, and the message names the fields rather than saying the shape is wrong.
 * - **It may not push a bound section past its maximum** (§8).
 */
export function addEntry(
  doc: RetorikaDocument,
  collectionId: string,
  fields: Record<string, EntryField>,
  lookup?: PresetLookup,
  id?: string,
): RetorikaDocument {
  const collection = findCollection(doc, collectionId, "addEntry");

  const required = fieldsRead(doc, collectionId);
  const missing = required.filter((field) => fields[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `addEntry: "${collectionId}" is read for ${required.map((f) => `"${f}"`).join(", ")}, ` +
        `and this entry has no ${missing.map((f) => `"${f}"`).join(", ")}`,
    );
  }

  if (lookup) {
    const issue = cardinalityIssue(doc, collectionId, collection.entries.length + 1, lookup);
    if (issue) throw new Error(`addEntry: ${issue}`);
  }

  const used = new Set(collection.entries.map((entry) => entry.id));
  let minted = id ?? `entry-${collection.entries.length + 1}`;
  let suffix = collection.entries.length + 1;
  while (used.has(minted)) {
    suffix += 1;
    minted = `entry-${suffix}`;
  }

  return replaceCollection(doc, collectionId, (found) =>
    collectionSchema.parse({
      ...found,
      entries: [...found.entries, { id: minted, fields }],
    }),
  );
}

/** One field of one entry. The value is parsed rather than trusted, for the reason
 * `setElementStyle` parses its own: a `marks` array that arrived as JSON from a browser's storage
 * carries no guarantee that its offsets fit the text beside it. */
export function setEntryField(
  doc: RetorikaDocument,
  collectionId: string,
  entryId: string,
  field: string,
  value: EntryField,
): RetorikaDocument {
  const collection = findCollection(doc, collectionId, "setEntryField");
  const entry = collection.entries.find((candidate) => candidate.id === entryId);
  if (!entry) throw new Error(`setEntryField: no entry "${entryId}" in "${collectionId}"`);
  if (field.trim() === "") throw new Error("setEntryField: a field needs a name");
  if (JSON.stringify(entry.fields[field]) === JSON.stringify(value)) return doc;

  return replaceCollection(doc, collectionId, (found) =>
    collectionSchema.parse({
      ...found,
      entries: found.entries.map((candidate) =>
        candidate.id === entryId
          ? { ...candidate, fields: { ...candidate.fields, [field]: value } }
          : candidate,
      ),
    }),
  );
}

/** One entry gone — refused if it would leave a bound section under its minimum (§8). */
export function removeEntry(
  doc: RetorikaDocument,
  collectionId: string,
  entryId: string,
  lookup?: PresetLookup,
): RetorikaDocument {
  const collection = findCollection(doc, collectionId, "removeEntry");
  if (!collection.entries.some((entry) => entry.id === entryId)) {
    throw new Error(`removeEntry: no entry "${entryId}" in "${collectionId}"`);
  }
  if (lookup) {
    const issue = cardinalityIssue(doc, collectionId, collection.entries.length - 1, lookup);
    if (issue) throw new Error(`removeEntry: ${issue}`);
  }
  return replaceCollection(doc, collectionId, (found) => ({
    ...found,
    entries: found.entries.filter((entry) => entry.id !== entryId),
  }));
}

/** An entry at a new index. Entries draw in stored order and this is the only thing that changes it
 * — ADR 0033 decides there is no sorting by a field. */
export function moveEntry(
  doc: RetorikaDocument,
  collectionId: string,
  entryId: string,
  toIndex: number,
): RetorikaDocument {
  const collection = findCollection(doc, collectionId, "moveEntry");
  const from = collection.entries.findIndex((entry) => entry.id === entryId);
  if (from === -1) throw new Error(`moveEntry: no entry "${entryId}" in "${collectionId}"`);
  const to = Math.max(0, Math.min(toIndex, collection.entries.length - 1));
  if (to === from) return doc;

  const entries = [...collection.entries];
  const [moved] = entries.splice(from, 1);
  if (!moved) throw new Error(`moveEntry: entry "${entryId}" vanished between two reads`);
  entries.splice(to, 0, moved);
  return replaceCollection(doc, collectionId, (found) => ({ ...found, entries }));
}

function replaceElement(
  doc: RetorikaDocument,
  address: ElementAddress,
  verb: string,
  next: (element: ContentElement) => ContentElement,
): RetorikaDocument {
  // Two flags rather than one, the shape `setElementStyle` established: "nothing is there" throws
  // and "nothing changed" hands back the identical document, and collapsing them would make a typo
  // in an id look like a control that quietly did nothing.
  let found = false;
  let changed = false;
  const walk = (elements: readonly ContentElement[]): ContentElement[] =>
    elements.map((element) => {
      if (element.id === address.elementId) {
        found = true;
        const replaced = next(element);
        if (replaced !== element) changed = true;
        return replaced;
      }
      if (!element.items) return element;
      return {
        ...element,
        items: element.items.map((item) => ({ ...item, elements: walk(item.elements) })),
      };
    });

  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) =>
      section.id === address.sectionId ? { ...section, content: walk(section.content) } : section,
    ),
  }));
  if (!found) {
    throw new Error(`${verb}: no element "${address.elementId}" in section "${address.sectionId}"`);
  }
  return changed ? { ...doc, pages } : doc;
}

/**
 * One leaf inside a bound list's template reads one field of the entry being drawn.
 *
 * The collection has to exist and has to be the one the enclosing list is bound to — a leaf reading a
 * different collection than the cards it sits in is a shape the renderer could not resolve, and rule
 * 5 is what refuses a reference with nothing behind it. The field does not have to exist on the
 * entries *yet*, because the invariant is what judges a finished document; what this refuses is the
 * reference that could never resolve.
 */
export function bindElement(
  doc: RetorikaDocument,
  address: ElementAddress,
  collectionId: string,
  field: string,
): RetorikaDocument {
  findCollection(doc, collectionId, "bindElement");
  if (field.trim() === "") throw new Error("bindElement: a leaf's binding names a field");
  return replaceElement(doc, address, "bindElement", (element) => {
    if (element.binding?.collectionId === collectionId && element.binding.field === field) {
      return element;
    }
    return { ...element, binding: { collectionId, field } };
  });
}

/** The leaf keeps whatever text it was last drawn with — the caller writes that first if it wants
 * it kept, which is what ADR 0033 §7's section-level exit does for every card at once. */
export function unbindElement(doc: RetorikaDocument, address: ElementAddress): RetorikaDocument {
  return replaceElement(doc, address, "unbindElement", (element) => {
    if (!element.binding) return element;
    const { binding: _dropped, ...rest } = element;
    return rest;
  });
}
