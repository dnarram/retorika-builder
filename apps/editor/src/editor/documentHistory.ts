import { presetFor, teaserSection } from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import type {
  ElementAddress,
  ListItem,
  Mark,
  MarkRange,
  MarkRun,
  MobilePatchEdit,
  PlacementEdit,
  RetorikaDocument,
  Section,
  SlotAddress,
  SlotFill,
  StyleProperty,
  StyleValue,
  SurplusDecision,
  Theme,
} from "@retorika/schema";
import {
  addItem as addItemToDoc,
  applyMark as applyMarkInDoc,
  clearSlot as clearSlotInDoc,
  deletePage as deletePageFromDoc,
  deleteSection as deleteSectionFromDoc,
  duplicateSection as duplicateSectionFromDoc,
  escalateSection as escalateSectionInDoc,
  fillSlot as fillSlotInDoc,
  findSection,
  insertSection as insertSectionIntoDoc,
  mintSectionId,
  moveItem as moveItemInDoc,
  movePage as movePageInDoc,
  moveSection as moveSectionFromDoc,
  moveUpOnMobile as moveUpOnMobileInDoc,
  pageToSection as pageToSectionInDoc,
  removeItem as removeItemFromDoc,
  removeMark as removeMarkInDoc,
  renamePage as renamePageInDoc,
  revertSection as revertSectionInDoc,
  sectionToPage as sectionToPageInDoc,
  setElementImageSrc,
  setElementStyle as setElementStyleInDoc,
  setElementText,
  setMobilePatch as setMobilePatchInDoc,
  setPlacement as setPlacementInDoc,
  setTheme as setThemeInDoc,
  setVariant as setVariantInDoc,
} from "@retorika/schema";

/**
 * Undo and redo, as a stack of whole documents rather than a log of commands with inverses.
 *
 * A document here is one page of a handful of sections — low single-digit kilobytes of plain
 * JSON — so keeping fifty of them costs far less than re-rendering the preview iframe once. A
 * command log would need a correct inverse for every verb this sprint is about to add, including
 * `applyRevert`, whose inverse has to carry the layout and breakpoint patches it dropped: that
 * inverse *is* a snapshot, wearing a costume. Replaying commands would also re-run the id
 * minting that duplicate needs, and any drift there lands in a `data-section` attribute the
 * golden corpus compares byte for byte.
 *
 * One history per variant. They never merge: the three variants are three different documents,
 * and undoing in one has no business touching another.
 */

/** What produced a snapshot, and which section it touched if it touched one — day 4 reads this to
 * decide whether a delete's undo toast fades: ADR 0014 keeps it on screen only for a section the
 * user edited. Not every cause is about a section; see `sectionOf`. */
export type SnapshotCause =
  | { type: "editText"; address: ElementAddress }
  | { type: "deleteSection"; sectionId: string }
  | { type: "duplicateSection"; sectionId: string; newSectionId: string }
  | { type: "moveSection"; sectionId: string }
  | { type: "insertSection"; sectionId: string }
  | { type: "setImage"; address: ElementAddress }
  | { type: "fillSlot"; sectionId: string }
  | { type: "clearSlot"; sectionId: string }
  | { type: "setVariant"; sectionId: string }
  /** The two halves of the escalation (ADR 0025). Both name a section and neither is a content
   * cause: the first copies the catalog's layout into it, the second puts it back, and no element
   * moves either way. */
  | { type: "escalateSection"; sectionId: string }
  | { type: "revertSection"; sectionId: string }
  /** One element moved or resized in its section's grid. Names the section rather than the element:
   * the toast and `wasSectionEverEdited` both ask about sections, and a placement is not content. */
  | { type: "setPlacement"; sectionId: string }
  /** One element's own style, written from the floating toolbar. Names the section for the same
   * reason `setPlacement` does — the toast and `wasSectionEverEdited` both ask about sections — and
   * it is **not** a content cause: a colour writes no word. */
  | { type: "setElementStyle"; sectionId: string }
  /**
   * Bold or italic over a run of characters, from the floating toolbar (ADR 0024, ADR 0027).
   *
   * **A content cause, and it lands on the opposite side of that line from `setElementStyle`** —
   * which is a judgement, so here is the reasoning rather than the verdict. A colour is excluded
   * above because «a colour writes no word», and a mark writes no word either. What separates them
   * is why ADR 0024 chose these two marks in the first place: `strong` and `em` are «the two that
   * mean **emphasis** rather than decoration, and that a screen reader can convey». So a mark
   * changes what the section *says* to somebody listening to it, and a colour does not.
   */
  | { type: "setMark"; sectionId: string }
  /** Any of rule 7's three mobile adjustments. One cause for all three: it answers "which section
   * was adjusted", and hiding, reordering and narrowing are the same kind of act. */
  | { type: "mobilePatch"; sectionId: string }
  | { type: "addItem"; sectionId: string }
  | { type: "removeItem"; sectionId: string }
  | { type: "moveItem"; sectionId: string }
  /** The three page causes name a page rather than a section, so `sectionOf` answers
   * `undefined` for them and no delete toast is kept alive by renaming a page. */
  /** The conversion (ADR 0022) is **one** cause, not three: the page, the move and the avance
   * happen together, so one «Deshacer» takes back all three. `sectionId` is the section that
   * left, which is what the toast names. */
  | { type: "sectionToPage"; sectionId: string; pageId: string }
  /** Undoing the conversion, from the «Páginas» panel. It names the page that folded away rather
   * than the sections that came back: there may be several of them, and the page is what the
   * person pressed. */
  | { type: "pageToSection"; pageId: string }
  | { type: "renamePage"; pageId: string }
  | { type: "movePage"; pageId: string }
  | { type: "deletePage"; pageId: string }
  /** The first cause that names no section, because a theme belongs to none of them: it restyles
   * every section at once, hand-designed ones included. `sectionOf` is what keeps that honest. */
  | { type: "setTheme" }
  | null;

export interface Snapshot {
  document: RetorikaDocument;
  cause: SnapshotCause;
}

export interface History {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
  /**
   * Whether the present snapshot is still open to being amended — true only while the last thing
   * that happened was a text edit, so that further typing into the same field joins that step
   * instead of opening a new one.
   *
   * It exists because two different questions were riding on `present.cause` and pulling it in
   * opposite directions. "Should the next keystroke merge?" wants the cause cleared after an
   * undo; "did the user ever put content in this section?" wants every cause kept. Clearing won,
   * silently, and `wasSectionEverEdited` went blind: edit, undo, redo, and the edit is back in
   * the document with no record that anyone made it — so a delete's toast faded on a section the
   * owner had written into, or uploaded a photo to. Splitting the flag out lets both be true.
   */
  amendable: boolean;
}

export type Histories = readonly History[];

export type HistoryAction =
  | {
      type: "editText";
      variant: number;
      address: ElementAddress;
      text: string;
      /** The marks the editor already shifted, when it watched the edit happen (ADR 0027 §4b).
       * Absent means "derive them from the two strings", which is the documented fallback. */
      marks?: readonly MarkRun[];
    }
  | { type: "deleteSection"; variant: number; sectionId: string }
  | { type: "duplicateSection"; variant: number; sectionId: string }
  | { type: "moveSection"; variant: number; sectionId: string; toIndex: number }
  | { type: "insertSection"; variant: number; section: Section; index: number; pageId: string }
  | { type: "setImage"; variant: number; address: ElementAddress; src: string; alt: string }
  | { type: "fillSlot"; variant: number; fill: SlotFill }
  | { type: "clearSlot"; variant: number; address: SlotAddress }
  | { type: "setTheme"; variant: number; theme: Theme }
  | { type: "setVariant"; variant: number; sectionId: string; variantId: string }
  | { type: "escalateSection"; variant: number; sectionId: string }
  | {
      type: "setPlacement";
      variant: number;
      sectionId: string;
      elementId: string;
      edit: PlacementEdit;
    }
  | {
      type: "setMobilePatch";
      variant: number;
      sectionId: string;
      elementId: string;
      edit: MobilePatchEdit;
    }
  | { type: "moveUpOnMobile"; variant: number; sectionId: string; elementId: string }
  | {
      type: "setElementStyle";
      variant: number;
      address: ElementAddress;
      property: StyleProperty;
      /** `undefined` takes the property away again, which is how the toolbar's «quitar» works and
       * how day 6's one-click fix will drop an exception. */
      value: StyleValue | undefined;
    }
  | {
      type: "setMark";
      variant: number;
      address: ElementAddress;
      range: MarkRange;
      mark: Mark;
      /** `true` marks the range, `false` unmarks it. One action rather than two, because `B` is one
       * button whose meaning is "this selection is bold, or it is not" — and the editor already
       * knows which, from `rangeHasMark`. */
      on: boolean;
    }
  | {
      type: "revertSection";
      variant: number;
      sectionId: string;
      /** One decision per element the preset cannot place. Day 4's dialog fills it; left out,
       * every surplus element is hidden rather than deleted. */
      decisions?: Readonly<Record<string, SurplusDecision>>;
    }
  | { type: "addItem"; variant: number; sectionId: string; slot: string; item: ListItem }
  | { type: "removeItem"; variant: number; sectionId: string; slot: string; itemId: string }
  | {
      type: "moveItem";
      variant: number;
      sectionId: string;
      slot: string;
      itemId: string;
      toIndex: number;
    }
  | { type: "sectionToPage"; variant: number; sectionId: string }
  | { type: "pageToSection"; variant: number; pageId: string }
  | { type: "renamePage"; variant: number; pageId: string; title: string }
  | { type: "movePage"; variant: number; pageId: string; toIndex: number }
  | { type: "deletePage"; variant: number; pageId: string }
  | { type: "undo"; variant: number }
  | { type: "redo"; variant: number };

/**
 * Fifty steps back. Not a memory limit — fifty of these documents is well under a megabyte —
 * but a limit on how far back a stack that is lost on reload is worth promising to reach.
 */
const LIMIT = 50;

export function initHistories(documents: readonly RetorikaDocument[]): History[] {
  return documents.map((document) => ({
    past: [],
    present: { document, cause: null },
    future: [],
    amendable: false,
  }));
}

function sameField(cause: SnapshotCause, address: ElementAddress): boolean {
  return (
    cause?.type === "editText" &&
    cause.address.sectionId === address.sectionId &&
    cause.address.elementId === address.elementId
  );
}

/**
 * `marks` passes straight through to the schema and changes nothing about the stack itself.
 *
 * **Undo is unaffected by §4b, and that is worth saying rather than leaving to be noticed.** This is
 * a stack of whole documents, so going back restores one that already has its marks where they
 * belong — there is nothing to re-derive and no inverse edit to compute. The amendment made the
 * forward step accurate; it did not give the stack a new kind of state to keep.
 */
function editText(
  history: History,
  address: ElementAddress,
  text: string,
  marks?: readonly MarkRun[],
): History {
  const document = setElementText(history.present.document, address, text, marks);
  const present: Snapshot = { document, cause: { type: "editText", address } };
  // Still typing into the field the last edit touched: amend that step rather than adding one.
  // `amendable` is what an undo or a redo turns off — a restored snapshot may well carry an
  // editText cause for this very field, and typing after going back should open a new step.
  if (history.amendable && sameField(history.present.cause, address)) {
    return { ...history, present, future: [], amendable: true };
  }
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: true,
  };
}

function deleteSection(history: History, sectionId: string): History {
  const document = deleteSectionFromDoc(history.present.document, sectionId);
  const present: Snapshot = { document, cause: { type: "deleteSection", sectionId } };
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: false,
  };
}

function duplicateSection(history: History, sectionId: string): History {
  // Minted separately from the call that actually duplicates, but from the same document with
  // the same deterministic rule (mintSectionId), so the two agree without needing the section
  // package to hand its choice back out of band.
  const newSectionId = mintSectionId(history.present.document, sectionId);
  const document = duplicateSectionFromDoc(history.present.document, sectionId);
  const present: Snapshot = {
    document,
    cause: { type: "duplicateSection", sectionId, newSectionId },
  };
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: false,
  };
}

function moveSection(history: History, sectionId: string, toIndex: number): History {
  const document = moveSectionFromDoc(history.present.document, sectionId, toIndex);
  const present: Snapshot = { document, cause: { type: "moveSection", sectionId } };
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: false,
  };
}

/**
 * A section built elsewhere, dropped into the page at `index`.
 *
 * The section arrives fully formed because what a valid one looks like belongs to the catalog
 * (`blankSection`) or to the questionnaire's answers (`contactSectionFor`), neither of which this
 * module should know about. What it does own is the id: the caller's is a template's, so it is
 * re-minted here against the very document being written, which is the only place that knows
 * what is free — and which keeps inserting two of the same section in a row from colliding.
 *
 * **The page is the one the canvas is drawing, and it arrives in the action.** It used to be
 * `doc.pages[0]` with a comment saying that was a placeholder until `Páginas` arrived; `Páginas`
 * arrived in sprint 5 and this did not come back, so from a converted page every «Añadir sección
 * aquí» put its section on the home page instead.
 *
 * It was worse than the wrong page. `wireInsertion` computes `index` from the sections it can see —
 * the ones on the *rendered* page — so clicking the third gap of a converted page sent `index: 2`
 * to be applied against the home page's own list: the wrong page *and* a meaningless position in
 * it. Both are cured by getting the page right, because the index was always page-local.
 *
 * `pageId` is required rather than optional, and that is the fix rather than a detail of it. The
 * `never` check at the bottom of `apply` catches an action *type* nobody handled; it cannot catch a
 * field nobody passed. A required field is the only thing that makes the compiler ask every caller
 * which page it means — an optional one falling back to `pages[0]` would rebuild this bug the next
 * time somebody adds a call site.
 */
function insertSection(history: History, section: Section, index: number, pageId: string): History {
  const page = history.present.document.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`insertSection: no page "${pageId}"`);

  const sectionId = mintSectionId(history.present.document, section.id);
  const document = insertSectionIntoDoc(history.present.document, page.id, index, {
    ...section,
    id: sectionId,
  });
  const present: Snapshot = { document, cause: { type: "insertSection", sectionId } };
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: false,
  };
}

/**
 * The owner's own photo in place of the placeholder (ADR 0018).
 *
 * Two fields of one element move together and make one step: the src, and the alt text, which
 * would otherwise still read "Marcador de foto: aquí irá tu foto" about a real photograph. Undone
 * as one, because to the person it was one action.
 *
 * The bytes are not here. They live in IndexedDB, keyed by variant and src, and this stack holds
 * only what the document says — which means undoing an upload restores the placeholder without
 * throwing anything away, and redoing it finds the file still there.
 */
function setImage(history: History, address: ElementAddress, src: string, alt: string): History {
  const document = setElementText(
    setElementImageSrc(history.present.document, address, src),
    address,
    alt,
  );
  const present: Snapshot = { document, cause: { type: "setImage", address } };
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: false,
  };
}

/**
 * One field of the selected section, given a value or emptied.
 *
 * Both go through the schema's own verbs, which is where the interesting half lives: filling a
 * slot the document does not have **creates an element**, and emptying one **hides it rather
 * than removing it** (document rule 3). This module only decides that each is one step.
 */
function fillSlot(history: History, fill: SlotFill): History {
  const document = fillSlotInDoc(history.present.document, fill);
  const present: Snapshot = { document, cause: { type: "fillSlot", sectionId: fill.sectionId } };
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: false,
  };
}

function clearSlot(history: History, address: SlotAddress): History {
  const document = clearSlotInDoc(history.present.document, address);
  // Clearing a slot that was never filled changes nothing, and a step that undoes to itself is
  // worse than no step: the arrow lights up and pressing it appears to do nothing.
  if (document === history.present.document) return history;
  const present: Snapshot = {
    document,
    cause: { type: "clearSlot", sectionId: address.sectionId },
  };
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present,
    future: [],
    amendable: false,
  };
}

/**
 * A different palette, or a different pair of typefaces — one step, for the whole site.
 *
 * The widest-reaching step in this stack and the cheapest to store: nineteen strings, replacing
 * nineteen strings. Nothing about the page changes, which is the point of rule 6 — style is
 * references to the system, so restyling everything touches no section, no element and no
 * placement, and a section somebody hand-designed is restyled along with the rest.
 *
 * `setTheme` in the schema hands back the very same document when the theme is already the one
 * asked for, so pressing the palette this site already uses is caught here and adds no step. The
 * undo arrow does not light up for a step that would undo to itself.
 */
function setTheme(history: History, theme: Theme): History {
  const document = setThemeInDoc(history.present.document, theme);
  if (document === history.present.document) return history;
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: { document, cause: { type: "setTheme" } },
    future: [],
    amendable: false,
  };
}

/**
 * One section drawn a different way — same content, different composition.
 *
 * The narrowest step in this stack: it replaces one string, `section.preset.variantId`, and the
 * renderer resolves the preset's other geometry table against the very same elements. No content
 * moves, which is why this is not a content cause below even though it names a section.
 *
 * `setVariant` in the schema hands back the same document when the composition is already the one
 * asked for, and refuses outright for a section carrying its own layout — for which a variant id
 * decides nothing. The editor does not offer the button in that case, so the refusal is a
 * backstop rather than a path anyone walks.
 */
function setVariant(history: History, sectionId: string, variantId: string): History {
  const document = setVariantInDoc(history.present.document, sectionId, variantId);
  if (document === history.present.document) return history;
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: { document, cause: { type: "setVariant", sectionId } },
    future: [],
    amendable: false,
  };
}

/**
 * The preset a layout verb needs, resolved from the section itself.
 *
 * `packages/schema` cannot ask what a `cover` is — the dependency arrow runs catalog → schema — so
 * `escalateSection` and `revertSection` take the preset as an argument. This module is the layer
 * that may look it up, which is the same division `convertSection` makes for the avance.
 */
function presetOf(document: RetorikaDocument, sectionId: string) {
  const found = findSection(document, sectionId);
  if (!found) throw new Error(`documentHistory: no section "${sectionId}"`);
  return presetFor(found.section.preset.catalogId);
}

/**
 * A section starts being designed by hand, and goes back — the advanced dossier §5, ADR 0025.
 *
 * **One step each, and the step is the whole point.** The dossier's own answer for the first
 * minutes is the ordinary undo — «Deshacer, si acaba de pasar. Los primeros minutos no necesitan
 * nada especial: el deshacer normal cubre la escalada como cualquier otro cambio» — and it only
 * works if escalating pushes a snapshot like everything else here. The durable return is day 4's
 * dialog, not a second mechanism for the same minute.
 *
 * **Neither is a content cause below.** Escalating copies the catalog's layout into the section and
 * moves no element; reverting puts every element back in the slot it was already in. Same line
 * `setVariant` falls on: a delete's toast should not stop fading because somebody tried designing a
 * section by hand and changed their mind about a section they never wrote a word into.
 *
 * Both hand back the same document when the section is already in the state asked for, so pressing
 * an action that decides nothing opens no step.
 */
function escalateSection(history: History, sectionId: string): History {
  const document = escalateSectionInDoc(
    history.present.document,
    sectionId,
    presetOf(history.present.document, sectionId),
  );
  if (document === history.present.document) return history;
  return step(history, document, { type: "escalateSection", sectionId });
}

/**
 * `decisions` is what the day-4 dialog will fill in, one entry per element the preset cannot place.
 * Left out, `revertSection` hides every surplus element rather than throwing — rule 3, and the
 * default the interface is committed to either way. Today nothing in the product can produce a
 * surplus element, so the argument has no caller yet; it is on the signature because the verb it
 * wraps refuses without it, and hiding that refusal behind a silent default *inside the schema*
 * would be the wrong place to keep the honesty.
 */
function revertSection(
  history: History,
  sectionId: string,
  decisions?: Readonly<Record<string, SurplusDecision>>,
): History {
  const document = revertSectionInDoc(
    history.present.document,
    sectionId,
    presetOf(history.present.document, sectionId),
    decisions,
  );
  if (document === history.present.document) return history;
  return step(history, document, { type: "revertSection", sectionId });
}

/**
 * One element moved or resized inside its section's grid (day 3, advanced dossier §6).
 *
 * **Not amendable**, like every other structural verb here and unlike typing. Two presses of the
 * same arrow are two moves somebody would expect to take back one at a time — the reason `moveItem`
 * gives at more length, and it applies harder here: laying out by hand is a sequence of small
 * deliberate adjustments, and an amalgamated step would undo a whole minute of them at once.
 *
 * **Not a content cause below.** A placement says where an element sits, never what it says.
 *
 * No preset is needed: a placement belongs to the section's own layout, which is what having one
 * means. `setPlacement` refuses a section the catalog still draws, and the panel does not offer the
 * control in that case, so that refusal is a backstop rather than a path anyone walks.
 */
function setPlacement(
  history: History,
  sectionId: string,
  elementId: string,
  edit: PlacementEdit,
): History {
  const document = setPlacementInDoc(history.present.document, sectionId, elementId, edit);
  if (document === history.present.document) return history;
  return step(history, document, { type: "setPlacement", sectionId });
}

/**
 * One property of one element's own style (rule 6), from the floating toolbar.
 *
 * **Its own step, like every other small deliberate adjustment.** Choosing a colour and then a size
 * is two acts, and one «Deshacer» should take back one of them — the argument `setPlacement` makes
 * at more length.
 *
 * **Not a content cause.** A colour writes no word, so a toolbar press must not keep a delete toast
 * alive or make a section count as edited in the sense `wasSectionEverEdited` asks about.
 *
 * **No preset and no layout needed, which is what separates this from the two below.** A style
 * belongs to the element, not to the section's grid, so it works on a catalog section exactly as it
 * does on a hand-designed one — and it must, because the "Apagado" row of the advanced dossier §4
 * gives the colour control to everybody, switch or no switch.
 *
 * `setElementStyle` in the schema returns the identical document when nothing changes, so pressing
 * the swatch that is already chosen opens no step at all.
 */
function setElementStyle(
  history: History,
  address: ElementAddress,
  property: StyleProperty,
  value: StyleValue | undefined,
): History {
  const document = setElementStyleInDoc(history.present.document, address, property, value);
  if (document === history.present.document) return history;
  return step(history, document, { type: "setElementStyle", sectionId: address.sectionId });
}

/**
 * Bold or italic over a selection, and its undo (ADR 0024, ADR 0027).
 *
 * **No inverse is recorded and none is needed**, which is the whole reason ADR 0024 insisted the
 * field stays a plain string: this is a document in, a document out, and the history is a stack of
 * documents. «Deshacer» costs nothing extra here, exactly as it costs nothing for a text edit.
 *
 * `applyMark` and `removeMark` return the identical document when nothing changes — marking the
 * same words twice, or unmarking what was never marked — so a press that means nothing opens no
 * step. The same contract the swatch above keeps.
 */
function setMark(
  history: History,
  address: ElementAddress,
  range: MarkRange,
  mark: Mark,
  on: boolean,
): History {
  const verb = on ? applyMarkInDoc : removeMarkInDoc;
  const document = verb(history.present.document, address, range, mark);
  if (document === history.present.document) return history;
  return step(history, document, { type: "setMark", sectionId: address.sectionId });
}

/**
 * Rule 7's three mobile adjustments, as two verbs and one cause.
 *
 * **One cause for both**, unlike every other pair in this file, because the question the cause
 * answers is "which section was adjusted for mobile" and a swap is not a different kind of act from
 * a hide. `sectionOf` is what reads it, and it asks about sections.
 *
 * **Not a content cause.** A mobile patch says where an element sits, whether it shows on a small
 * screen, and how wide it is there. It writes no word, and the desktop page does not change at all.
 *
 * Neither takes a preset: patches live inside the section's own layout, which is what having one
 * means. Both refuse a section the catalog draws, and the panel does not offer them there.
 */
function setMobilePatch(
  history: History,
  sectionId: string,
  elementId: string,
  edit: MobilePatchEdit,
): History {
  const document = setMobilePatchInDoc(history.present.document, sectionId, elementId, edit);
  if (document === history.present.document) return history;
  return step(history, document, { type: "mobilePatch", sectionId });
}

function moveUpOnMobile(history: History, sectionId: string, elementId: string): History {
  const document = moveUpOnMobileInDoc(history.present.document, sectionId, elementId);
  if (document === history.present.document) return history;
  return step(history, document, { type: "mobilePatch", sectionId });
}

/**
 * One more line in a list, or one line gone.
 *
 * Two verbs rather than one, and a pair rather than a toggle: adding appends a line of markers at
 * the end, removing takes a named one away for good. Neither is a content cause below — a new
 * line carries the catalog's markers and not a word the owner wrote, and taking a line away is
 * not writing either. Whatever the owner did type into it is already recorded by the `editText`
 * that put it there, which is what keeps a delete's toast honest.
 *
 * The line itself is built by the catalog and re-minted by the schema, so neither this module nor
 * the component that draws the control has to know what a valid line is made of.
 */
function addItem(history: History, sectionId: string, slot: string, item: ListItem): History {
  const document = addItemToDoc(history.present.document, sectionId, slot, item);
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: { document, cause: { type: "addItem", sectionId } },
    future: [],
    amendable: false,
  };
}

function removeItem(history: History, sectionId: string, slot: string, itemId: string): History {
  const document = removeItemFromDoc(history.present.document, sectionId, slot, itemId);
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: { document, cause: { type: "removeItem", sectionId } },
    future: [],
    amendable: false,
  };
}

/**
 * One line moved within its list, as one history entry.
 *
 * **Not amendable**, like every other structural verb here and unlike typing: two presses of the
 * same arrow are two moves an owner would expect to take back one at a time, not one amalgamated
 * step that jumps a photograph three places back.
 */
function moveItem(
  history: History,
  sectionId: string,
  slot: string,
  itemId: string,
  toIndex: number,
): History {
  const document = moveItemInDoc(history.present.document, sectionId, slot, itemId, toIndex);
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: { document, cause: { type: "moveItem", sectionId } },
    future: [],
    amendable: false,
  };
}

/**
 * The pages of a site — renamed, reordered, removed.
 *
 * None of the three is a content cause: renaming a page writes no word into any section, and the
 * words a deleted page took with it were recorded by the `editText` that put them there. What a
 * delete owes the person is the count of what pointed at that page, and that is the editor's to
 * ask before dispatching, while «Deshacer» is still on screen.
 *
 * `renamePage` and `movePage` hand back the same document when nothing would change, so pressing
 * a name that is already the name opens no step.
 */
/**
 * A section becomes a page, in one step.
 *
 * The avance is built here rather than in `@retorika/schema`, which may not import the catalog —
 * the same division `insertSection` makes. Its label comes from the catalog's own locale file,
 * because it is interface text that ends up on the published page.
 *
 * The new page's id is read back off the result rather than predicted: only `sectionToPage` knows
 * what it minted, and the cause needs it so the editor can open the page it just made.
 */
function convertSection(history: History, sectionId: string): History {
  const document = sectionToPageInDoc(
    history.present.document,
    sectionId,
    ({ sectionId: id, href }) => teaserSection(id, href, catalogEs["section.teaser.label"]),
  );
  const pageId = document.pages.at(-1)?.id;
  if (!pageId) throw new Error("sectionToPage: the conversion produced no page");
  return step(history, document, { type: "sectionToPage", sectionId, pageId });
}

/**
 * The conversion folded away, in one step — the other half of ADR 0022's «se puede deshacer».
 *
 * Symmetrical with `convertSection` and deliberately so: the sections come back, the avance goes,
 * the page goes, and one «Deshacer» puts all three back. No catalog factory is needed on the way
 * in, because folding builds nothing — it only puts back what the conversion moved.
 *
 * It does not check whether the page is foldable. `canFoldPage` is what the panel asks before it
 * draws the button, and it is the same code this verb refuses on, so a throw here means something
 * dispatched an action the interface never offered.
 */
function foldPage(history: History, pageId: string): History {
  return step(history, pageToSectionInDoc(history.present.document, pageId), {
    type: "pageToSection",
    pageId,
  });
}

function renamePage(history: History, pageId: string, title: string): History {
  const document = renamePageInDoc(history.present.document, pageId, title);
  if (document === history.present.document) return history;
  return step(history, document, { type: "renamePage", pageId });
}

function movePage(history: History, pageId: string, toIndex: number): History {
  const document = movePageInDoc(history.present.document, pageId, toIndex);
  if (document === history.present.document) return history;
  return step(history, document, { type: "movePage", pageId });
}

function deletePage(history: History, pageId: string): History {
  return step(history, deletePageFromDoc(history.present.document, pageId), {
    type: "deletePage",
    pageId,
  });
}

/** One snapshot pushed onto the stack, which every verb above does identically. */
function step(history: History, document: RetorikaDocument, cause: SnapshotCause): History {
  return {
    past: [...history.past, history.present].slice(-LIMIT),
    present: { document, cause },
    future: [],
    amendable: false,
  };
}

function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    // The snapshot goes back exactly as it was, cause included. It used to be restored with a
    // null cause to stop the next keystroke merging into the step just undone; `amendable` does
    // that now, and keeping the cause is what lets `wasSectionEverEdited` still see that someone
    // wrote here — which it could not, once the only record of an edit was a step undone and
    // redone.
    present: previous,
    future: [history.present, ...history.future],
    amendable: false,
  };
}

function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
    amendable: false,
  };
}

/**
 * One action against one variant's history.
 *
 * A `switch` that returns from every arm, and not the chain of ternaries this replaced. That chain
 * ended in `: redo(history)`, which made it the default: a verb added to `HistoryAction` without
 * its own branch type-checked perfectly and **performed a redo** — silently, on an action that
 * looks nothing like one. The `never` below is what turns that into a compile error naming the
 * type that was forgotten, which is the only place this can be caught for free. Two verbs arrive
 * this sprint, which is what made a latent trap worth defusing rather than testing around.
 */
function apply(history: History, action: HistoryAction): History {
  switch (action.type) {
    case "editText":
      return editText(history, action.address, action.text, action.marks);
    case "deleteSection":
      return deleteSection(history, action.sectionId);
    case "duplicateSection":
      return duplicateSection(history, action.sectionId);
    case "moveSection":
      return moveSection(history, action.sectionId, action.toIndex);
    case "insertSection":
      return insertSection(history, action.section, action.index, action.pageId);
    case "setImage":
      return setImage(history, action.address, action.src, action.alt);
    case "fillSlot":
      return fillSlot(history, action.fill);
    case "clearSlot":
      return clearSlot(history, action.address);
    case "setTheme":
      return setTheme(history, action.theme);
    case "setVariant":
      return setVariant(history, action.sectionId, action.variantId);
    case "escalateSection":
      return escalateSection(history, action.sectionId);
    case "setPlacement":
      return setPlacement(history, action.sectionId, action.elementId, action.edit);
    case "setMobilePatch":
      return setMobilePatch(history, action.sectionId, action.elementId, action.edit);
    case "setElementStyle":
      return setElementStyle(history, action.address, action.property, action.value);
    case "setMark":
      return setMark(history, action.address, action.range, action.mark, action.on);
    case "moveUpOnMobile":
      return moveUpOnMobile(history, action.sectionId, action.elementId);
    case "revertSection":
      return revertSection(history, action.sectionId, action.decisions);
    case "addItem":
      return addItem(history, action.sectionId, action.slot, action.item);
    case "removeItem":
      return removeItem(history, action.sectionId, action.slot, action.itemId);
    case "moveItem":
      return moveItem(history, action.sectionId, action.slot, action.itemId, action.toIndex);
    case "sectionToPage":
      return convertSection(history, action.sectionId);
    case "pageToSection":
      return foldPage(history, action.pageId);
    case "renamePage":
      return renamePage(history, action.pageId, action.title);
    case "movePage":
      return movePage(history, action.pageId, action.toIndex);
    case "deletePage":
      return deletePage(history, action.pageId);
    case "undo":
      return undo(history);
    case "redo":
      return redo(history);
  }
  const unhandled: never = action;
  throw new Error(`documentHistory: unhandled action ${JSON.stringify(unhandled)}`);
}

export function historiesReducer(state: Histories, action: HistoryAction): Histories {
  const history = state[action.variant];
  if (!history) throw new Error(`documentHistory: no variant ${action.variant}`);

  const next = apply(history, action);

  // Undo with nothing to undo changes nothing, and must not make React re-render the preview.
  if (next === history) return state;
  return state.map((entry, index) => (index === action.variant ? next : entry));
}

/**
 * Whether a section's content was ever edited by the user in this session — ADR 0014's own
 * condition for a delete's undo toast to stay put instead of fading, moved unchanged from the
 * confirmation dialog it used to gate. Not a new field: it is exactly what the history already
 * tracks, walked through every step still reachable by undo or redo. `future` is included on
 * purpose: undoing an edit moves its cause there, not out of existence, and the edit still
 * happened this session even while its step is the one a redo would restore. A section deleted
 * more than fifty steps after its last edit reports as untouched — the same horizon the
 * fifty-step cap already draws for everything else — and so does one whose only edit was undone
 * and then overwritten by a later action, which clears `future` the same way it always has.
 *
 * Only the causes that put *content* there count — deliberately narrower than "any cause naming
 * this section". ADR 0014 asks about what the user contributed, not any structural action the
 * section was ever subject to: being deleted-and-undone, moved, or the original side of a
 * duplicate does not write anything. That distinction stopped being academic the moment
 * duplicateSection arrived — its cause names the *original* section's id too, and that original's
 * own content never changed just because it was copied, so a looser check would have marked it
 * edited for no reason.
 *
 * `setImage` counts alongside `editText`: uploading a photo is the most deliberate thing anyone
 * does in this editor, and losing one to a toast that faded after six seconds would be worse
 * than losing a sentence. `fillSlot` and `clearSlot` count for the same reason — both are the
 * owner deciding what this section says, one by writing and one by taking something off the
 * page, and the writing they took off is still in the document behind it.
 *
 * **`setVariant` does not count**, and it is the first cause that names a section without being
 * about its content. Choosing a different composition rewrites one string, `preset.variantId`, and
 * moves no element — it is the same kind of act as moving the section up the page, which has never
 * counted either. A delete toast should not stop fading because someone tried two layouts on a
 * section they never wrote a word into.
 */
/** The causes that mean the owner worked on a section's content, as opposed to moving, copying
 * or removing the section itself. Kept as a list rather than a growing chain of `||`, so adding
 * a verb is a decision about which side of that line it falls on. */
const CONTENT_CAUSES = ["editText", "setImage", "fillSlot", "clearSlot", "setMark"] as const;

/**
 * Which section a cause is about, or `undefined` when it is about none.
 *
 * Every cause used to name a section one of two ways — an `address` or a bare `sectionId` — and
 * the check below read that as an either/or. `setTheme` is the first that names neither, because
 * it is about the document, so the either/or had to become a three-way answer rather than a
 * narrowing that happens to still compile. Written as one function so the next document-level
 * verb needs no change here at all: it lands in the third case by default, and the default is
 * "belongs to no section", which is the safe answer for a question about one section's content.
 */
function sectionOf(cause: NonNullable<SnapshotCause>): string | undefined {
  if ("address" in cause) return cause.address.sectionId;
  if ("sectionId" in cause) return cause.sectionId;
  return undefined;
}

export function wasSectionEverEdited(history: History, sectionId: string): boolean {
  const steps = [...history.past, history.present, ...history.future];
  return steps.some((step) => {
    const cause = step.cause;
    if (!cause) return false;
    if (!(CONTENT_CAUSES as readonly string[]).includes(cause.type)) return false;
    return sectionOf(cause) === sectionId;
  });
}
