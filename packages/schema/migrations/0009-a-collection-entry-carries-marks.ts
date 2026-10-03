/**
 * A collection entry's field carries text **and its marks**, and a container's binding stops having
 * to name a field (ADR 0033 §3 and §5).
 *
 * Two widenings in one version, because they are one decision: the interface the advanced dossier
 * §11 said the document had to be ready for, five sprints after it was made ready.
 *
 * **The affected set is counted and it is zero.** Every stored document carries `collections: []` —
 * counted across `fixtures/` while planning sprint 14, and true by construction, because until today
 * nothing in this product could write a collection: `packages/generator/src/index.ts` emits `[]` and
 * no verb existed to add to it. So this moves no data, which is why a *shape* change takes a minor
 * rather than a major. It is the precedent of `0005`, which closed the tablet bucket nothing could
 * publish, and of `0007`, which narrowed exact lengths to the pixels that were the only ones written.
 *
 * **`up` is written as a real transform anyway, and that is deliberate.** It will never find anything
 * to convert in a document this product produced; it would find something in one hand-written against
 * 1.7.0, and a migration whose body is a version stamp *because the author checked* reads exactly like
 * one whose body is a version stamp because the author forgot. The round-trip test feeds it a 1.7.0
 * document with a collection in it for that reason.
 *
 * **`down` drops the marks**, for the reason `0004` could not carry them down either: 1.7.0's
 * `fields` is `Record<string, string>` and there is nowhere in it for an offset to live. A text that
 * had a bold word comes back as the same text without it — the words survive, the emphasis does not.
 * The optional `field` needs nothing on the way down: 1.7.0 required it, and a document whose
 * container binding omits it could not have existed at 1.7.0 in the first place, so there is nothing
 * to restore. A container binding that reaches `down` is dropped entirely rather than given an
 * invented field name, because a field nobody chose is a dead reference and rule 5 refuses those.
 */

interface Entry {
  id?: string;
  fields?: Record<string, unknown>;
}
interface Collection {
  entries?: Entry[];
}
interface Element {
  binding?: { collectionId?: string; field?: string };
  items?: { elements?: Element[] }[];
}
interface Section {
  content?: Element[];
}
interface Page {
  sections?: Section[];
}

/** `"Corte de pelo"` → `{text: "Corte de pelo"}`, and anything already shaped that way left alone,
 * so running this twice cannot wrap a value twice. */
function withMarkableFields(collections: Collection[]): Collection[] {
  return collections.map((collection) => ({
    ...collection,
    entries: (collection.entries ?? []).map((entry) => ({
      ...entry,
      fields: Object.fromEntries(
        Object.entries(entry.fields ?? {}).map(([key, value]) => [
          key,
          typeof value === "string" ? { text: value } : value,
        ]),
      ),
    })),
  }));
}

/** And back: `{text, marks}` → `"…"`. A value that is already a string is left alone for the same
 * reason, so `down` after `down` is not a crash. */
function withPlainFields(collections: Collection[]): Collection[] {
  return collections.map((collection) => ({
    ...collection,
    entries: (collection.entries ?? []).map((entry) => ({
      ...entry,
      fields: Object.fromEntries(
        Object.entries(entry.fields ?? {}).map(([key, value]) => [
          key,
          typeof value === "string" ? value : ((value as { text?: unknown } | null)?.text ?? ""),
        ]),
      ),
    })),
  }));
}

/** Every element, items included — the walk `flattenElements` makes, written out here because a
 * migration reads raw JSON and may not import the schema it is migrating. */
function withoutFieldlessBindings(elements: Element[]): Element[] {
  return elements.map((element) => {
    const next: Element = { ...element };
    if (next.binding && next.binding.field === undefined) delete next.binding;
    if (next.items) {
      next.items = next.items.map((item) => ({
        ...item,
        elements: withoutFieldlessBindings(item.elements ?? []),
      }));
    }
    return next;
  });
}

export const migration = {
  version: "1.8.0",
  description:
    "A collection entry's field carries text and marks, and a container's binding needs no field (ADR 0033).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    const collections = (input["collections"] as Collection[] | undefined) ?? [];
    return {
      ...input,
      collections: withMarkableFields(collections),
      schemaVersion: "1.8.0",
    };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const collections = (input["collections"] as Collection[] | undefined) ?? [];
    const pages = (input["pages"] as Page[] | undefined) ?? [];
    return {
      ...input,
      collections: withPlainFields(collections),
      pages: pages.map((page) => ({
        ...page,
        sections: (page.sections ?? []).map((section) => ({
          ...section,
          content: withoutFieldlessBindings(section.content ?? []),
        })),
      })),
      schemaVersion: "1.7.0",
    };
  },
} as const;

export default migration;
