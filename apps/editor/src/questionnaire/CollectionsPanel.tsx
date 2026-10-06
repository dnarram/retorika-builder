"use client";

import { blankItem } from "@retorika/catalog";
import {
  type CardinalityBlock,
  type Collection,
  type EntryField,
  type MarkRun,
  type RetorikaDocument,
  shiftMarks,
  textEditBetween,
  usesOfCollection,
} from "@retorika/schema";
import { useEffect, useId, useRef, useState } from "react";
import { PANEL_WIDTH, panelCard, panelRow, SmallButton } from "../editor/panelKit.tsx";
import { itemSlotLabel } from "../editor/sectionFields.ts";
import es from "../locales/es.json" with { type: "json" };

/**
 * «Listas» — the rail's seventh item, and the fourth pillar of «el modo estudio» (ADR 0033).
 *
 * **It is called «Listas» and not «Colecciones», which is a vocabulary decision and not a
 * translation.** The dossier's word is «colecciones»; that is the word for the people who wrote the
 * dossier. «Colección» in Spanish is a CMS word, and this panel is read by somebody who runs a
 * workshop in Ronda and has a list of services. The `Estilo` panel settled the same question the
 * same way when issue #9 made it name typefaces by character and never by font.
 *
 * **What it does not do, and why that is not an omission:**
 *
 * - **It does not create a list.** A list gets its shape from the cards it is made of — which fields
 *   a ficha has is decided by the template it comes from, not typed in here — so the verb that makes
 *   one is «convertir estas tarjetas en una lista», on the section, in the canvas, where the owner
 *   can see what is about to happen. Day 6 builds it. A `+` here would have to ask somebody to invent
 *   field names, which is the CMS this product is not.
 * - **It does not add a ficha.** Same reason, one level down: a new ficha needs a field for every
 *   field the sections showing it read, and the words that go in them are the catalog's own marker
 *   text for those slots. That arrives with the verb that establishes what a ficha is made of.
 *
 * It renames, deletes, edits a ficha's words, reorders them and removes one — which is the whole of
 * «el cliente que mantiene la web añade fichas sin tocar el diseño» except the adding, and the
 * adding is a day away.
 *
 * **Every refusal is a message here and never a thrown error.** `deleteCollection`, `addEntry` and
 * `removeEntry` all throw, and the owner must never meet one: the panel asks the same readers the
 * verbs ask — `usesOfCollection` and `entryCountBlock` — *before* drawing the control, and says what
 * is in the way instead. A pressable button that refuses is the dead button this editor has refused
 * since sprint 1.
 */
export function CollectionsPanel({
  document: doc,
  sectionName,
  blockFor,
  candidates,
  onMakeList,
  onBindList,
  canBind,
  onAddEntry,
  onRenameCollection,
  onDeleteCollection,
  onSetEntryField,
  onRemoveEntry,
  onMoveEntry,
  onClose,
}: {
  document: RetorikaDocument;
  /** The catalog's Spanish name for a section, so «sec-services» is never what the owner reads. */
  sectionName: (sectionId: string) => string;
  /** What would be in the way if this collection had `would` entries — the schema's own
   * `entryCountBlock`, so the message and the refusal cannot drift apart. */
  blockFor: (collectionId: string, would: number) => CardinalityBlock | undefined;
  /**
   * The sections that have cards and no list yet — the subject of «hacer una lista con estas
   * tarjetas», which is the **lossless** way in and therefore the only one offered.
   *
   * **The offer lives here rather than in the canvas's action cluster**, and that follows ADR 0025's
   * amendment: when the `Diseño` panel was found naming its own exit in a paragraph that did not
   * offer it, the fix was a button beside the sentence. This panel's empty state is that sentence.
   * The cluster is also eight buttons already, and mouse-only.
   */
  candidates: readonly { sectionId: string; slot: string; suggestedName: string }[];
  onMakeList: (sectionId: string, slot: string, name: string) => void;
  /**
   * Show an existing list here instead of making a new one — §7's «las secciones del catálogo pueden
   * alimentarse de una colección», which is the half that makes «cambiarla cambia las cuarenta
   * páginas» true *across* sections rather than inside one.
   *
   * **Offered only where it would be accepted.** `bindList` refuses a collection that has no field
   * this section's cards read, and one that does not fit the section — so `canBind` asks before the
   * button is drawn rather than after it is pressed.
   */
  onBindList: (sectionId: string, slot: string, collectionId: string) => void;
  canBind: (sectionId: string, slot: string, collectionId: string) => boolean;
  /** `undefined` when this panel cannot know what a ficha is made of — see `addableFields`. */
  onAddEntry: (collectionId: string, fields: Record<string, EntryField>) => void;
  onRenameCollection: (collectionId: string, name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onSetEntryField: (
    collectionId: string,
    entryId: string,
    field: string,
    value: EntryField,
  ) => void;
  onRemoveEntry: (collectionId: string, entryId: string) => void;
  onMoveEntry: (collectionId: string, entryId: string, toIndex: number) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  /**
   * Which list is expanded — **derived with a fallback rather than initialised**, which a test found
   * the hard way.
   *
   * `useState(doc.collections[0]?.id)` reads the document **once**, and the ordinary journey opens
   * this panel while there are no lists at all: the offer to make one is in here. So the state
   * initialised to `null`, the owner pressed «Hacer una lista», the list appeared — collapsed, with
   * its fichas hidden behind a second click nobody was told about.
   *
   * `undefined` means «has not chosen yet» and falls through to the first list; `null` means
   * «collapsed it on purpose». Three states, because two of them were being asked to mean the same
   * thing and could not.
   */
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const open = chosen === undefined ? (doc.collections[0]?.id ?? null) : chosen;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // The caret in the rename field, once, when it opens — keyed on `renaming` for the reason
  // `PagesPanel` records: a callback ref re-ran on every keystroke and ate what was typed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the field appears, not
  // when the draft changes.
  useEffect(() => {
    if (renaming !== null) nameRef.current?.select();
  }, [renaming]);

  function commitRename(collectionId: string) {
    const name = draft.trim();
    // An empty name is not a rename: a list with no name is unfindable in this very panel. The
    // field closes unchanged, which is what `PagesPanel` does with a page's title.
    if (name !== "") onRenameCollection(collectionId, name);
    setRenaming(null);
  }

  return (
    <section aria-labelledby={headingId} className={`${PANEL_WIDTH} gap-4 p-5 ${panelCard}`}>
      <h2 id={headingId} className="text-[13px] font-bold text-ui-ink">
        {es["editor.collections.title"]}
      </h2>

      {doc.collections.length === 0 ? (
        <p className="text-xs leading-normal text-ui-muted">{es["editor.collections.none"]}</p>
      ) : null}

      {/* The way in, offered wherever there is something to offer it for — above the lists when
          there are none, below them when there are. */}
      {candidates.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-ui border border-ui-border bg-ui-bg p-2">
          <span className="text-[11px] leading-normal text-ui-muted">
            {es["editor.collections.makeHelp"]}
          </span>
          {candidates.map((candidate) => (
            <div
              key={`${candidate.sectionId}:${candidate.slot}`}
              className="flex flex-col items-start gap-1"
            >
              <button
                type="button"
                onClick={() =>
                  onMakeList(candidate.sectionId, candidate.slot, candidate.suggestedName)
                }
                className="rounded-md border border-ui-border bg-white px-2 py-1 text-left text-[12px] font-medium text-ui-ink"
              >
                {es["editor.collections.make"].replace(
                  "{section}",
                  sectionName(candidate.sectionId),
                )}
              </button>
              {doc.collections
                .filter((collection) => canBind(candidate.sectionId, candidate.slot, collection.id))
                .map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => onBindList(candidate.sectionId, candidate.slot, collection.id)}
                    className="rounded-md border border-ui-border bg-white px-2 py-1 text-left text-[12px] font-medium text-ui-ink"
                  >
                    {es["editor.collections.useHere"]
                      .replace("{list}", collection.name)
                      .replace("{section}", sectionName(candidate.sectionId))}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {doc.collections.length > 0 && (
        <>
          <p className="text-xs leading-normal text-ui-muted">{es["editor.collections.help"]}</p>
          <ul className="flex flex-col gap-1.5">
            {doc.collections.map((collection) => (
              <li key={collection.id} className={panelRow}>
                <CollectionRow
                  collection={collection}
                  doc={doc}
                  sectionName={sectionName}
                  onAddEntry={onAddEntry}
                  open={open === collection.id}
                  renaming={renaming === collection.id}
                  draft={draft}
                  nameRef={nameRef}
                  blockFor={blockFor}
                  onToggle={() => setChosen(open === collection.id ? null : collection.id)}
                  onStartRename={() => {
                    setDraft(collection.name);
                    setRenaming(collection.id);
                  }}
                  onDraft={setDraft}
                  onCommitRename={() => commitRename(collection.id)}
                  onCancelRename={() => setRenaming(null)}
                  onDelete={() => onDeleteCollection(collection.id)}
                  onSetEntryField={onSetEntryField}
                  onRemoveEntry={onRemoveEntry}
                  onMoveEntry={onMoveEntry}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="self-start rounded-md px-2 py-1 text-xs font-medium text-ui-muted"
      >
        {es["editor.collections.close"]}
      </button>
    </section>
  );
}

function CollectionRow({
  collection,
  doc,
  sectionName,
  onAddEntry,
  open,
  renaming,
  draft,
  nameRef,
  blockFor,
  onToggle,
  onStartRename,
  onDraft,
  onCommitRename,
  onCancelRename,
  onDelete,
  onSetEntryField,
  onRemoveEntry,
  onMoveEntry,
}: {
  collection: Collection;
  doc: RetorikaDocument;
  sectionName: (sectionId: string) => string;
  onAddEntry: (collectionId: string, fields: Record<string, EntryField>) => void;
  open: boolean;
  renaming: boolean;
  draft: string;
  nameRef: React.RefObject<HTMLInputElement | null>;
  blockFor: (collectionId: string, would: number) => CardinalityBlock | undefined;
  onToggle: () => void;
  onStartRename: () => void;
  onDraft: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onSetEntryField: (
    collectionId: string,
    entryId: string,
    field: string,
    value: EntryField,
  ) => void;
  onRemoveEntry: (collectionId: string, entryId: string) => void;
  onMoveEntry: (collectionId: string, entryId: string, toIndex: number) => void;
}) {
  const uses = usesOfCollection(doc, collection.id);

  /**
   * Removing one entry, asked **before** the control is drawn.
   *
   * `removeEntry` throws when a bound section would be left under its minimum, and this is what
   * keeps the owner from reaching that throw. One answer for the whole list, because the minimum is
   * about the count and not about which ficha: taking any one away leaves the same number.
   */
  const removalBlock = blockFor(collection.id, collection.entries.length - 1);

  /**
   * Adding one, asked the same way **before** the control is drawn — and with a second question
   * this one needs and removal does not: **what would go in the new ficha?**
   *
   * The words come from the catalog's own marker text for the slots the fields are named after
   * (`blankItem`), which is what every other new line in this editor is filled with and what
   * `isPlaceholderText` recognises before a download. Where a field is not one of those slots — a
   * list somebody wrote by hand — this panel genuinely does not know what to put, and says so rather
   * than inventing a word or writing an empty one, which would draw no card at all.
   */
  const additionBlock = blockFor(collection.id, collection.entries.length + 1);
  const newFields = addableFields(collection, uses);

  return (
    <>
      <div className="flex items-center gap-1 p-1.5">
        {renaming ? (
          <input
            ref={nameRef}
            value={draft}
            aria-label={es["editor.collections.rename"]}
            onChange={(event) => onDraft(event.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") onCommitRename();
              if (event.key === "Escape") onCancelRename();
            }}
            className="min-w-0 flex-1 rounded-ui-sm border border-ui-brand px-2 py-1 text-[13px] text-ui-ink"
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-[13px] font-semibold text-ui-ink"
          >
            {collection.name}
            <span className="ml-1.5 font-normal text-ui-muted">
              {es["editor.collections.count"].replace("{n}", String(collection.entries.length))}
            </span>
          </button>
        )}
      </div>

      {/* Where it is shown, named by the catalog rather than by its section id — and this is also
          what makes the delete refusal below legible instead of technical. */}
      <p className="px-3 pb-1.5 text-[11px] leading-normal text-ui-muted">
        {uses.length === 0
          ? es["editor.collections.unused"]
          : es["editor.collections.shownIn"].replace(
              "{sections}",
              uses.map((use) => sectionName(use.sectionId)).join(", "),
            )}
      </p>

      <div className="flex flex-wrap items-center gap-1 border-t border-ui-border px-1.5 py-1">
        <SmallButton label={es["editor.collections.rename"]} onClick={onStartRename} />
        {/* **The delete refusal, said instead of pressed.** `deleteCollection` throws while anything
            is bound to it (ADR 0033's amendment), so the control is not drawn at all and the reason
            takes its place — naming the sections, which is what the owner has to act on. */}
        {uses.length === 0 ? (
          <SmallButton label={es["editor.collections.delete"]} onClick={onDelete} danger />
        ) : (
          <span className="px-1.5 py-1 text-[11px] leading-normal text-ui-muted">
            {es["editor.collections.cannotDelete"]}
          </span>
        )}
      </div>

      {open && (
        <>
          <ul className="flex flex-col gap-1.5 border-t border-ui-border p-1.5">
            {collection.entries.map((entry, index) => (
              <li key={entry.id} className={`p-1.5 ${panelRow}`}>
                <div className="flex flex-col gap-1">
                  {Object.entries(entry.fields).map(([field, value]) => (
                    <EntryFieldRow
                      key={field}
                      field={field}
                      value={value}
                      uses={uses}
                      onCommit={(text) =>
                        onSetEntryField(collection.id, entry.id, field, {
                          text,
                          ...marksAfterEdit(value, text),
                        })
                      }
                    />
                  ))}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {index > 0 && (
                    <SmallButton
                      label={es["editor.collections.up"]}
                      onClick={() => onMoveEntry(collection.id, entry.id, index - 1)}
                    />
                  )}
                  {index < collection.entries.length - 1 && (
                    <SmallButton
                      label={es["editor.collections.down"]}
                      onClick={() => onMoveEntry(collection.id, entry.id, index + 1)}
                    />
                  )}
                  {removalBlock === undefined ? (
                    <SmallButton
                      label={es["editor.collections.removeEntry"]}
                      onClick={() => onRemoveEntry(collection.id, entry.id)}
                      danger
                    />
                  ) : (
                    <span className="px-1.5 py-1 text-[11px] leading-normal text-ui-muted">
                      {es["editor.collections.cannotRemove"]
                        .replace("{section}", sectionName(removalBlock.sectionId))
                        .replace("{n}", String(removalBlock.limit))}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-1 border-t border-ui-border px-1.5 py-1">
            {newFields === undefined ? (
              <span className="px-1.5 py-1 text-[11px] leading-normal text-ui-muted">
                {es["editor.collections.cannotAddShape"]}
              </span>
            ) : additionBlock ? (
              <span className="px-1.5 py-1 text-[11px] leading-normal text-ui-muted">
                {es["editor.collections.cannotAdd"]
                  .replace("{section}", sectionName(additionBlock.sectionId))
                  .replace("{n}", String(additionBlock.limit))}
              </span>
            ) : (
              <SmallButton
                label={es["editor.collections.addEntry"]}
                onClick={() => onAddEntry(collection.id, newFields)}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

/**
 * What a new ficha would be filled with, or `undefined` when this panel cannot know.
 *
 * Every field the entries carry has to be covered, because `addEntry` refuses an entry short of a
 * field some binding reads — and that refusal must never reach the owner. `blankItem` is the catalog's
 * own answer for «a new card of this kind», so the marker text here is the same text a new line gets
 * anywhere else in this editor.
 */
function addableFields(
  collection: Collection,
  uses: readonly { catalogId: string }[],
): Record<string, EntryField> | undefined {
  const catalogId = uses[0]?.catalogId;
  if (!catalogId) return undefined;
  const wanted = new Set(collection.entries.flatMap((entry) => Object.keys(entry.fields)));
  if (wanted.size === 0) return undefined;

  let markers: { slot: string; text: string }[];
  try {
    markers = blankItem(catalogId)
      .elements.filter((element) => element.value && "text" in element.value)
      .map((element) => ({
        slot: element.slot,
        text: element.value && "text" in element.value ? element.value.text : "",
      }));
  } catch {
    // `blankItem` throws for a preset with no marker text for a slot, which is a catalog gap rather
    // than something to paper over here.
    return undefined;
  }

  /**
   * **A field `blankItem` has nothing for gets an empty text, not a refusal**, and that is right
   * rather than lenient — found by a test that went looking for a button that was not there.
   *
   * `blankItem` fills the preset's item slots, and `elementsForSlot` leaves out the ones whose `min`
   * is 0. So `description` on a «Qué hago» card has no marker, because a card with no description is
   * a card the preset already allows. An empty text renders as nothing — which is exactly what that
   * card looks like today — so the new ficha arrives with its required words marked and its optional
   * ones blank, and the owner fills in whichever they want.
   *
   * The only case left where this panel genuinely cannot know is a list nothing is bound to, which is
   * the `catalogId` check above.
   */
  const bySlot = new Map(markers.map((marker) => [marker.slot, marker.text]));
  const fields: Record<string, EntryField> = {};
  for (const field of wanted) fields[field] = { text: bySlot.get(field) ?? "" };
  return fields;
}

/**
 * One field of one ficha, as a text box that commits when it is left.
 *
 * **Labelled by the catalog's own words for the slot where there is one.** A field's key is what the
 * template's leaf binds to, and once day 6 names those after the slots they fill, `section.<catalog>.
 * slot.<field>` is the Spanish the fields panel already shows for the same thing. Where there is no
 * such key — a collection somebody wrote by hand — the key itself is shown rather than a guess.
 */
function EntryFieldRow({
  field,
  value,
  uses,
  onCommit,
}: {
  field: string;
  value: EntryField;
  uses: readonly { catalogId: string }[];
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(value.text);
  const labelId = useId();

  // The document is the source of truth: when it changes underneath — an undo, another panel —
  // the box follows it rather than holding a draft nobody asked to keep.
  useEffect(() => setDraft(value.text), [value.text]);

  const label = slotLabel(field, uses);

  return (
    <label className="flex flex-col gap-0.5" htmlFor={labelId}>
      <span className="text-[11px] font-medium text-ui-muted">{label}</span>
      <input
        id={labelId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit(draft);
          if (event.key === "Escape") setDraft(value.text);
        }}
        className="w-full rounded-ui-sm border border-ui-border px-2 py-1 text-[13px] text-ui-ink"
      />
    </label>
  );
}

/**
 * The catalog's own Spanish for the slot a field is named after, through the **same** function the
 * fields panel uses — `itemSlotLabel`, keyed `section.<catalog>.item.<slot>`.
 *
 * **It was a second copy of that lookup for about ten minutes and the key was wrong**: I wrote
 * `section.<catalog>.slot.<field>`, which is the form for a *section's* slots. A collection's fields
 * are named after an **item's** slots — a card's title, a line's price — and those live under
 * `.item.`. The e2e caught it, and the fix is to call the one that already existed rather than to
 * correct a copy of it: `sectionFields.ts`'s own comment says these keys «already existed… so
 * nothing here invents a word for a screen in Spanish».
 *
 * Where no key matches, the field's own name shows rather than a guess — which is what a collection
 * written by hand, with fields named after nothing, will read as.
 */
/**
 * **A mark moves with the text under it** (ADR 0027), which is this panel's business too.
 *
 * **Carrying the marks verbatim was the first version of this and it was a bug waiting**, found by
 * sabotaging the line that carried them: nothing in the suite noticed, because the seeded entry had
 * none. Thinking about why there was nothing to notice is what found the real defect — a mark over
 * «Presupuesto cerrado» carried onto a *shorter* text no longer fits it, `withinText` refuses the
 * value, and `setEntryField` throws **at the owner**, which is the one thing this panel promises
 * never to do.
 *
 * So it does what the canvas has done since sprint 10: work out the edit between the two strings and
 * shift the marks through it. Same two functions, same reason — `textEditBetween`'s own comment
 * records the overlapping-prefix case it took a browser walk to find, and a second implementation
 * here would have had to find it again.
 */
function marksAfterEdit(value: EntryField, text: string): { marks?: MarkRun[] } {
  if (!value.marks || value.marks.length === 0) return {};
  const shifted = shiftMarks(value.marks, textEditBetween(value.text, text));
  // An edit that swallowed every marked character leaves nothing to carry, and an empty array is
  // not the same as an absent one for a strict schema that has to round-trip.
  return shifted.length === 0 ? {} : { marks: shifted };
}

function slotLabel(field: string, uses: readonly { catalogId: string }[]): string {
  for (const use of uses) {
    const label = itemSlotLabel(use.catalogId, field);
    if (label !== field) return label;
  }
  return field;
}
