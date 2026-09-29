"use client";

import {
  blankItem,
  COVER_ID,
  FOOTER_ID,
  FOOTER_IDENTITY_SLOTS,
  isPlaceholderText,
  presetFor,
  TEASER_ID,
  variantsFor,
} from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { render } from "@retorika/renderer";
import {
  type ContentElement,
  type ElementAddress,
  findSection,
  flattenElements,
  type ListItem,
  listEditableFields,
  listLinksTo,
  MAX_PAGES,
  type PresetShape,
  type RetorikaDocument,
  type SlotAddress,
  type SlotFill,
} from "@retorika/schema";
import { useMemo, useRef, useState } from "react";
import { type DownloadGate, downloadGateFor } from "../editor/downloadGate.ts";
import { EditorShell, type RailItemId, type SaveStatus } from "../editor/EditorShell.tsx";
import { ACCEPTED_IMAGE_ACCEPT } from "../editor/imageBytes.ts";
import { countPhotos, listPhotos, type PhotoState } from "../editor/photoInventory.ts";
import { withPhotoUrls } from "../editor/previewDocument.ts";
import { sectionFields } from "../editor/sectionFields.ts";
import es from "../locales/es.json" with { type: "json" };
import { DownloadWarningDialog, TooManyPhotosDialog } from "./DownloadGateDialogs.tsx";
import { FieldsPanel } from "./FieldsPanel.tsx";
import { PagesPanel } from "./PagesPanel.tsx";
import { PhotosPanel } from "./PhotosPanel.tsx";
import { StylePanel } from "./StylePanel.tsx";
import { FieldError } from "./ui.tsx";

type DownloadState = "idle" | "downloading" | "error";

/** One key for a (section, element) pair. A `Map` keyed by an object would compare by identity and
 * never hit, and the two ids together are what makes an address unique — element ids are unique
 * only within their section (document rule 5). `\u0000` cannot occur in either. */
function addressKey(sectionId: string, elementId: string): string {
  return `${sectionId}\u0000${elementId}`;
}

/**
 * What the delete toast (ADR 0014) shows: a name and whether it stays until dismissed. `Variants`
 * decides `persistent` — it is the one holding the undo history `wasSectionEverEdited` reads —
 * and owns the timer that clears a non-persistent toast, since that has to survive this
 * component unmounting if the user leaves the editor mid-toast.
 */
export interface DeleteToast {
  sectionName: string;
  persistent: boolean;
  /** How many visible buttons pointed at the deleted section by its anchor, counted before the
   * delete. Zero for a section nothing linked to, which is every section until this sprint. */
  brokenAnchors: number;
}

/**
 * The tags `packages/renderer/src/build.ts` emits for a `text` or `link` value: headings,
 * body copy, and a button or link's label. Everything else in the tree (`img`, the `<ul>`
 * a list renders as) carries `data-id` too but is not click-to-edit — there is no text on an
 * image to click, and a list's own children get their own `data-id` individually.
 */
const EDITABLE_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "A"]);

const HANDLE_CORNERS = ["tl", "tr", "bl", "br"] as const;

/** The interface's typeface, for chrome injected into the preview frame. Spelled out rather
 * than inherited: inside that frame, "inherit" means the client's own site font. */
const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * One entry of the "Añadir sección aquí" menu: a catalog section the editor may offer at this
 * moment, already named in Spanish by the caller — `Variants` holds the catalog's locale, and
 * which sections are offerable at all is the application's decision, not this component's.
 */
export interface SectionOffer {
  catalogId: string;
  name: string;
  description: string;
}

/** The catalog's Spanish name for the section the panel is showing, e.g. "Portada". */
function sectionDisplayName(doc: RetorikaDocument, sectionId: string): string {
  const found = findSection(doc, sectionId);
  if (!found) return sectionId;
  const key = `section.${found.section.preset.catalogId}.name` as keyof typeof catalogEs;
  return catalogEs[key] ?? sectionId;
}

/** The preset's slots in the order it declares them, which is where a newly created element
 * gets placed. Empty for a section the catalog does not recognise, which the panel treats as
 * having no fields at all. */
function slotOrderOf(doc: RetorikaDocument, sectionId: string): string[] {
  const found = findSection(doc, sectionId);
  if (!found) return [];
  try {
    return presetFor(found.section.preset.catalogId).slots.map((slot) => slot.slot);
  } catch {
    return [];
  }
}

/**
 * One composition this section could be drawn with — its id, its Spanish name, and whether it is
 * the one in use.
 */
interface Composition {
  variantId: string;
  name: string;
  current: boolean;
}

/**
 * The compositions to offer for a section, **or an empty list when the choice does not exist**, in
 * which case no button is drawn for it at all.
 *
 * Three reasons a section gets none, and each is a case where a button would light up and do
 * nothing — the dead-button mistake `EditorShell` has refused since sprint 1:
 *
 * - **It carries its own layout.** `build.ts` reads `section.layout ?? preset.layoutFor(variantId,
 *   …)`, so for a hand-designed section the variant id decides nothing; `setVariant` in the schema
 *   refuses outright, and this is what stops anyone reaching that refusal.
 * - **The catalog gives it only one composition.** Every section ships two or three today (asserted
 *   in `packages/catalog/test/variants.test.ts`), so this is a guard against a future section
 *   rather than a live case — cheap, and it fails to a missing button rather than a useless one.
 * - **It is not a catalog section at all**, so there is no preset to ask.
 */
function compositionsFor(doc: RetorikaDocument, sectionId: string): Composition[] {
  const found = findSection(doc, sectionId);
  if (!found || found.section.layout !== null) return [];
  let variantIds: readonly string[];
  try {
    variantIds = variantsFor(found.section.preset.catalogId);
  } catch {
    return [];
  }
  if (variantIds.length < 2) return [];
  return variantIds.map((variantId) => {
    const key =
      `section.${found.section.preset.catalogId}.variant.${variantId}` as keyof typeof catalogEs;
    return {
      variantId,
      name: catalogEs[key] ?? variantId,
      current: variantId === found.section.preset.variantId,
    };
  });
}

/**
 * Whether «Convertir esta sección en página» should be offered for this section.
 *
 * The three kinds `sectionToPage` refuses outright (ADR 0022), plus the page cap the download route
 * has always enforced and `sectionToPage` now enforces too. Asking the same questions the verb asks
 * is duplication of a kind worth having: the verb throwing is the guarantee, and this is what keeps
 * anybody from reaching it — a button that lights up and refuses is worse than no button, which is
 * the rule `compositionsFor` already follows.
 */
function canConvert(doc: RetorikaDocument, sectionId: string): boolean {
  if (doc.pages.length >= MAX_PAGES) return false;
  const found = findSection(doc, sectionId);
  if (!found) return false;
  return !UNCONVERTIBLE.has(found.section.preset.catalogId);
}

const UNCONVERTIBLE: ReadonlySet<string> = new Set([COVER_ID, FOOTER_ID, TEASER_ID]);

/**
 * The list a section holds, if it holds one: which slot it is in, the lines in it, and whether
 * another would fit.
 *
 * Empty for a section with no list, which is most of them. The cap comes from the preset
 * (`itemRange`) rather than from this component, so "Qué hago" stops at six and a price list at
 * twelve without the editor knowing either number.
 */
interface ListLines {
  slot: string;
  /** Which section this is, so the controls can call its items by their own name. */
  catalogId: string;
  itemIds: string[];
  canAdd: boolean;
  canRemove: boolean;
}

/**
 * The words on the two list controls, which depend on what a section's items actually are.
 *
 * One generic label served every list until sprint 5 day 3, and «Añadir línea» read acceptably
 * under a carta and passably under cards. Under a grid of photographs it does not: a photograph is
 * not a line, and the browser walk that day is where that became obvious rather than arguable.
 *
 * A section only needs a key here when the generic word is wrong for it, so «Qué hago» and
 * «Opiniones» keep the shared label — both have shipped through two usability sessions with it,
 * and changing words those sessions saw is a product decision rather than a tidy-up.
 */
function lineLabel(action: "add" | "remove", catalogId: string): string {
  const table = es as Record<string, string | undefined>;
  return table[`editor.line.${action}.${catalogId}`] ?? es[`editor.line.${action}`];
}

function linesFor(doc: RetorikaDocument, sectionId: string): ListLines | undefined {
  const found = findSection(doc, sectionId);
  if (!found) return undefined;
  let preset: PresetShape;
  try {
    preset = presetFor(found.section.preset.catalogId);
  } catch {
    return undefined;
  }
  const range = preset.itemRange;
  if (!preset.itemSlots || !range) return undefined;
  const list = found.section.content.find((element) => element.role === "list");
  if (!list) return undefined;
  const itemIds = (list.items ?? []).map((item) => item.id);
  return {
    slot: list.slot,
    catalogId: found.section.preset.catalogId,
    itemIds,
    canAdd: itemIds.length < range.max,
    canRemove: itemIds.length > range.min,
  };
}

/** From `Content-Disposition: attachment; filename="doc-taberna.zip"`. */
function filenameFrom(response: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  return match?.[1] ?? fallback;
}

/**
 * The chosen variant, editable inside the real editor chrome: every heading, paragraph and
 * button/link label the renderer marks with `data-id` becomes a native `contentEditable` region
 * directly inside the same-origin iframe — reached through `iframe.contentDocument`, no
 * postMessage needed. An edit commits on blur, reported up as `onEditText(address, text)`, which
 * `Variants` applies to the document it holds; the iframe then reloads from that new document,
 * which is why nothing is written mid-keystroke — only once the user leaves the field.
 *
 * **An edit names the section as well as the element** (day 2). Element ids are unique only
 * within a section, so a bare id stops identifying anything the moment a section can be
 * duplicated — which is this sprint's day 5. Fixing the addressing before that arrives is why
 * the document became state today rather than then.
 *
 * "Descargar" sends `document` exactly as this component holds it (day 3): now that the document
 * is the state a blur already commits to, there is no round trip left to distrust — the prop is
 * always the current one, not something read back out of the DOM to work around a stale closure.
 * `/api/download` re-validates it independently; see that route for why sending the whole
 * document, not answers plus a diff, is also what a section that can be added, deleted or
 * reordered requires.
 *
 * Section selection marks a section with a 2px outline and four corner handles injected into the
 * iframe's own DOM, mirroring mockup 08's per-element selection at section granularity — and,
 * since sprint 2 day 4, a small cluster of action buttons drawn at the selected section's corner:
 * move up, move down, its composition, duplicate, the section's fields, delete. Six as of sprint 4
 * day 4, and the composition one is the first that is drawn conditionally: a section whose layout
 * is its own, or one the catalog gives a single composition, gets no button rather than a dead one.
 * No floating toolbar — one action,
 * one button, the same self-contained-in-the-iframe pattern click-to-edit already uses. None of
 * them asks for confirmation: ADR 0014 is explicit that a delete runs immediately, with the undo
 * it offers afterwards as the only safety net, and the same directness applies to the rest, which
 * are no more destructive than a delete and get the identical net.
 *
 * Adding a section (day 6) is the same pattern once more: a dashed rule broken by an "Añadir
 * sección aquí" pill in each gap between sections, injected into the frame because only the
 * frame knows where the gaps fall. What the pill may offer is decided outside this component and
 * arrives as `offers` — "Contacto y reservas" is the one section that cannot be born blank, its
 * button being a destination rather than text, so it is offered only when question 5 gave one,
 * and its absence is explained rather than left as a hole in the list.
 */
export function Editor({
  title,
  document: doc,
  onEditText,
  onDeleteSection,
  onDuplicateSection,
  onMoveSection,
  onInsertSection,
  onPickPhoto,
  onFillSlot,
  onClearSlot,
  onSetVariant,
  pageId,
  onSelectPage,
  onSectionToPage,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onAddItem,
  onRemoveItem,
  onPickPalette,
  onPickTypePair,
  photoUrls,
  photoError,
  offers,
  contactUnavailable,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  toast,
  onDismissToast,
  onBack,
}: {
  title: string;
  document: RetorikaDocument;
  onEditText: (address: ElementAddress, text: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, toIndex: number) => void;
  onInsertSection: (catalogId: string, index: number) => void;
  /** The owner chose a file for this image element. Preparing and storing it is `Variants`'
   * business; this component only reports which element was clicked. */
  onPickPhoto: (address: ElementAddress, file: File) => void;
  onFillSlot: (fill: SlotFill) => void;
  onClearSlot: (address: SlotAddress) => void;
  /** A different composition for one section, chosen from its own menu. */
  onSetVariant: (sectionId: string, variantId: string) => void;
  /** Which page the canvas is showing. Undefined means the document's first, which is what
   * `render` already means by an absent `pageId`. */
  pageId: string | undefined;
  onSelectPage: (pageId: string | undefined) => void;
  /** This section becomes a page of its own (ADR 0022). One history step, so one «Deshacer»
   * takes back the page, the move and the avance together. */
  onSectionToPage: (sectionId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onMovePage: (pageId: string, toIndex: number) => void;
  onDeletePage: (pageId: string) => void;
  /** One more line in a section's list, or one gone. The line is built by the catalog here and
   * re-minted by the schema, so neither end has to know what a valid one is made of. */
  onAddItem: (sectionId: string, slot: string, item: ListItem) => void;
  onRemoveItem: (sectionId: string, slot: string, itemId: string) => void;
  /** A palette or a pair of typefaces chosen in the Estilo panel. This component says which
   * one was picked; assembling the new theme and putting it in the document is `Variants`'
   * business, the same division as every other verb here. */
  onPickPalette: (paletteId: string) => void;
  onPickTypePair: (typePairId: string) => void;
  /** Object URLs for photos already uploaded, keyed by the `src` the document carries. The
   * preview needs them because a bundle-relative path resolves against the parent page inside a
   * `srcDoc` iframe and 404s — the same trap `placeholder-image.ts` documents. */
  photoUrls: ReadonlyMap<string, string>;
  photoError: string | null;
  offers: readonly SectionOffer[];
  /** Whether to explain the absence of "Contacto y reservas" from `offers`. */
  contactUnavailable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: SaveStatus;
  toast: DeleteToast | null;
  onDismissToast: () => void;
  onBack: () => void;
}) {
  const [state, setState] = useState<DownloadState>("idle");
  // What `requestDownload` found the last time «Descargar» was pressed — `null` means neither
  // dialog is open. Recomputed fresh on every press rather than kept in sync with `doc`, because
  // a dialog open while the owner keeps editing behind it would go stale the moment they change
  // the one photograph it is about.
  const [downloadDialog, setDownloadDialog] = useState<DownloadGate | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // One input, reused: the picker is opened from inside the frame, and the element that asked
  // for it is remembered here until a file comes back.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<ElementAddress | null>(null);
  // Which section's fields are open, if any. Not tied to selection: clicking a word to edit it
  // selects the section too, and a form sliding in every time someone touches a sentence would
  // be in the way rather than at hand.
  const [fieldsFor, setFieldsFor] = useState<string | null>(null);
  const [rail, setRail] = useState<RailItemId>("sections");
  /**
   * Which section is selected, and whether its composition menu is open — remembered across the
   * preview's re-renders, which is what makes trying compositions usable at all.
   *
   * Every action in this editor replaces the iframe's whole `srcDoc`, so the selection outline, the
   * handles and the action cluster are all destroyed and rebuilt on each one. Until now that cost
   * one click to get back, which nobody noticed because you rarely delete the same section twice.
   * Composition is the first action anyone will repeat deliberately — the whole point is to look at
   * two and keep one — and re-selecting between each try would be a click and a hunt every time.
   *
   * Refs, not state: nothing React renders depends on them. They are read by `wireSelection` when
   * the frame finishes loading, which is outside React's render pass entirely.
   */
  const selectedSection = useRef<string | null>(null);
  const compositionMenuOpen = useRef(false);

  /**
   * At most one side surface at a time.
   *
   * The two are not variations of each other — the fields panel is fixed over the right edge and
   * the style panel sits beside the canvas — so with both open the fixed one covers the other. The
   * rule is enforced in both directions here rather than by stacking them, because there is no
   * reading in which having both open is what the person asked for: opening one is a statement
   * about what they are doing now.
   */
  function showRail(item: RailItemId) {
    setRail(item);
    // Any rail item that opens a panel closes the fields panel: both are fixed over the right edge
    // and the second would cover the first. It used to name `style` alone, which was complete when
    // `style` was the only panel — `pages` arrived in sprint 5 and could already be covered, and
    // `photos` would have made three. `sections` is the one that does not, because the fields panel
    // *is* its panel.
    if (item !== "sections") setFieldsFor(null);
  }

  /**
   * Open the file picker for one image, from outside the canvas.
   *
   * The same three lines `wirePhotos` runs when the owner clicks the photograph itself, so the
   * «Fotos» panel is a second *way in* and not a second uploader: `preparePhoto`'s sniff, the
   * resize, the EXIF-stripping re-encode, the IndexedDB write and the `setImage` history step are
   * all the ones that already existed. Sprint 5 day 3 found three separate defects in that path;
   * a parallel one would be three more waiting.
   */
  function replacePhoto(address: ElementAddress) {
    pendingImage.current = address;
    const input = fileInputRef.current;
    if (!input) return;
    // Cleared first, so picking the same file twice in a row still fires a change.
    input.value = "";
    input.click();
  }

  function showFields(sectionId: string | null) {
    setFieldsFor(sectionId);
    if (sectionId !== null) setRail("sections");
  }

  // `render` is deterministic, so an unchanged document yields the identical string and the
  // iframe's `srcDoc` does not change — which is what keeps a device toggle or a download from
  // reloading the preview and throwing away the current selection.
  // Rendered from a display copy: every image whose src names an uploaded file gets the object
  // URL for its bytes instead. The document itself keeps the bundle-relative name, which is what
  // the ZIP needs — a relative path inside a `srcDoc` iframe resolves against the parent page's
  // URL and 404s, which is exactly why the placeholder is a data: URI and not a file.
  const html = useMemo(() => {
    const options = pageId === undefined ? {} : { pageId };
    // `withPhotoUrls` since sprint 6 day 4, when this logic moved out of here and became shared.
    // It had been inline, and the three "elige por dónde empezar" cards rendered the raw document
    // instead — invisible for as long as a generated site's only image was the placeholder, and a
    // broken image on all three cards the moment the generator started asking the bank.
    return render(withPhotoUrls(doc, photoUrls), "html", options).html;
  }, [doc, photoUrls, pageId]);

  /**
   * Where each photograph stands, by address, so the canvas can label the ones that came from the
   * bank.
   *
   * Read from the document rather than from the markup, because the markup deliberately does not
   * say: the renderer never emits `sample`, which is what keeps «Foto de ejemplo» from being
   * something a published page could ever carry. `listPhotos` is the same function the «Fotos»
   * panel and the pre-download warning read, so all three agree by construction about which
   * photographs are not the owner's.
   */
  const photoStates = useMemo(() => {
    const states = new Map<string, PhotoState>();
    for (const photo of listPhotos(doc)) {
      states.set(addressKey(photo.sectionId, photo.elementId), photo.state);
    }
    return states;
  }, [doc]);

  // Marker text warns, it never blocks: what an added section says is a matter of taste the
  // owner can see and fix in a second, unlike a button pointing nowhere, which the download
  // route refuses outright. Counted by value against the catalog's own markers — the document
  // has no flag saying "still a placeholder", and adding one would be a schema change to record
  // something the text already says.
  /**
   * Whether the footer is on the page with none of the owner's details filled in.
   *
   * ADR 0019: this warns and never blocks, and it warns **once**, only when every one of them is
   * empty. Somebody who filled two and left two made a decision; nagging about the rest would be
   * exactly the ruling on what is enough that the decision refuses to make. A hidden element
   * counts as empty, because on the page it is.
   */
  const footerNeedsIdentity = useMemo(() => {
    const footer = doc.pages
      .flatMap((page) => page.sections)
      .find((section) => section.preset.catalogId === FOOTER_ID);
    if (!footer) return false;
    return !footer.content.some(
      (element) =>
        FOOTER_IDENTITY_SLOTS.includes(element.slot) &&
        !element.hidden &&
        element.value?.kind === "text" &&
        element.value.text.trim() !== "",
    );
  }, [doc]);

  const placeholders = useMemo(
    () =>
      listEditableFields(doc).filter(
        (field) => field.text !== undefined && isPlaceholderText(field.text),
      ).length,
    [doc],
  );

  /**
   * **No link inside the preview ever navigates.** The canvas is a picture of the site, not a copy
   * of it that can be browsed.
   *
   * The bug this fixes was reported from the deployed app and is worth writing down in full,
   * because the cause is not where anybody would look. The preview is fed through `srcDoc`, so the
   * frame has no URL of its own and **every relative href resolves against the parent's URL — the
   * editor**. A menu entry written `href="#sec-services"`, which is correct in the published file
   * and works from `file://`, resolves inside this frame to `http://…/#sec-services`: the editor's
   * own address. Clicking it loaded the editor into its own preview, that copy restored the same
   * session from `localStorage` and drew its own preview, and a second click nested again —
   * an editor inside an editor, without end.
   *
   * One delegated listener in the capture phase rather than a handler per anchor: it covers the
   * links the renderer *derives* — the menu (ADR 0023) has no `data-id`, so `wireEditing` never
   * saw it — as well as every link in the document and anything added later. Only the default
   * action is cancelled; focus happens on `mousedown`, so click-to-edit on a button's label still
   * places the cursor exactly as before.
   *
   * Doing nothing is deliberate for now, and it is what every other control in the preview already
   * does: «Reservar mesa» does not dial a telephone either. Making a menu entry move the editor to
   * that page belongs with the page tabs, which is the next day's work.
   */
  function wireLinks(iframeDoc: Document) {
    iframeDoc.addEventListener(
      "click",
      (event) => {
        // Duck-typed rather than `instanceof Element`: the node belongs to the frame's realm, and
        // an `instanceof` against this document's `Element` is false for every one of them.
        const target = event.target as { closest?: (selector: string) => unknown } | null;
        if (typeof target?.closest !== "function") return;
        const anchor = target.closest("a") as {
          getAttribute?: (n: string) => string | null;
        } | null;
        if (!anchor) return;
        event.preventDefault();

        // A menu entry moves the editor to that page, which is the one thing in the preview that
        // now *does* something. It is navigation the owner means, and the tabs do the same job;
        // what it must never be is a real navigation of the frame, which is what nested an editor
        // inside the editor. `./<slug>.html` is the published form, and the slug is the only part
        // of it anybody here needs.
        const href = anchor.getAttribute?.("href") ?? "";
        const slug = /^\.\/([^#]+)\.html(?:#.*)?$/.exec(href.trim())?.[1];
        if (slug === undefined) return;
        const page = doc.pages.find((candidate) => candidate.slug === slug);
        if (page) onSelectPage(doc.pages[0]?.id === page.id ? undefined : page.id);
      },
      true,
    );
  }

  function wireSelection(iframeDoc: Document) {
    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];

    function action(
      label: string,
      variant: "move" | "delete",
      disabled: boolean,
      svg: string,
      onClick: () => void,
    ): HTMLButtonElement {
      const button = iframeDoc.createElement("button");
      button.type = "button";
      button.className = `rb-action rb-action-${variant}`;
      button.setAttribute("aria-label", label);
      button.disabled = disabled;
      button.innerHTML = svg;
      // Stopped here so the click does not also bubble to the section's own listener and
      // re-run select() on a section a move or a delete is about to displace or remove.
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      });
      return button;
    }

    /**
     * The list of compositions, hung under the action cluster.
     *
     * Same visual language as the "Añadir sección aquí" menu and built the same way — inside the
     * frame, because it is anchored to a section only the frame knows the position of. The choices
     * are a toggle group rather than a list of commands: one of them is always the one in use, so
     * each carries `aria-pressed` and the current one is marked rather than hidden.
     */
    function compositionMenu(sectionId: string, compositions: readonly Composition[]): HTMLElement {
      const panel = iframeDoc.createElement("div");
      panel.className = "rb-compositions";

      const title = iframeDoc.createElement("p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.composition.title"];
      panel.appendChild(title);

      for (const composition of compositions) {
        const choice = iframeDoc.createElement("button");
        choice.type = "button";
        choice.className = "rb-menu-choice rb-composition-choice";
        choice.setAttribute("aria-pressed", String(composition.current));
        const name = iframeDoc.createElement("span");
        name.className = "rb-menu-name";
        name.textContent = composition.name;
        choice.appendChild(name);
        choice.addEventListener("click", (event) => {
          event.stopPropagation();
          // Left open on purpose. Picking the composition already in use is a no-op all the way
          // down (`setVariant` hands back the same document), so the frame does not reload and
          // the menu would otherwise vanish for nothing; picking a different one reloads it, and
          // `compositionMenuOpen` is what brings the menu back so the next try is one click.
          onSetVariant(sectionId, composition.variantId);
        });
        panel.appendChild(choice);
      }

      const note = iframeDoc.createElement("p");
      note.className = "rb-menu-note";
      note.textContent = es["editor.composition.note"];
      panel.appendChild(note);

      return panel;
    }

    function select(target: HTMLElement) {
      for (const section of sections) {
        section.classList.remove("rb-selected");
        for (const el of section.querySelectorAll(".rb-handle, .rb-actions, .rb-compositions")) {
          el.remove();
        }
      }
      target.classList.add("rb-selected");
      for (const corner of HANDLE_CORNERS) {
        const handle = iframeDoc.createElement("span");
        handle.className = `rb-handle rb-handle-${corner}`;
        target.appendChild(handle);
      }

      const sectionId = target.dataset.section;
      if (!sectionId) return;
      selectedSection.current = sectionId;
      const index = sections.indexOf(target);

      const actions = iframeDoc.createElement("div");
      actions.className = "rb-actions";
      actions.appendChild(
        action(
          es["editor.moveSectionUp"],
          "move",
          index <= 0,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
          () => onMoveSection(sectionId, index - 1),
        ),
      );
      actions.appendChild(
        action(
          es["editor.moveSectionDown"],
          "move",
          index < 0 || index >= sections.length - 1,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>',
          () => onMoveSection(sectionId, index + 1),
        ),
      );
      // Sixth button, and it only appears when there is a choice to make: a section carrying its
      // own layout, or one the catalog gives a single composition, gets no button rather than a
      // dead one. Placed after the two moves because it answers the same kind of question — where
      // this section's parts sit — and before duplicate, fields and delete, which are about the
      // section as a thing.
      const compositions = compositionsFor(doc, sectionId);
      if (compositions.length > 0) {
        actions.appendChild(
          action(
            es["editor.composition.open"],
            "move",
            false,
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg>',
            () => {
              const open = target.querySelector(".rb-compositions");
              if (open) {
                open.remove();
                compositionMenuOpen.current = false;
                return;
              }
              target.appendChild(compositionMenu(sectionId, compositions));
              compositionMenuOpen.current = true;
            },
          ),
        );
      }

      actions.appendChild(
        action(
          es["editor.duplicateSection"],
          "move",
          false,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
          () => onDuplicateSection(sectionId),
        ),
      );
      // Seventh button, and the one this sprint exists for: «Convertir esta sección en página»
      // (ADR 0022). Drawn only when the conversion would actually work, which is the same rule the
      // composition button follows — a button that lights up and refuses is worse than no button.
      // Three kinds of section are never offered it (the cover is the page's h1 and its promise,
      // the footer is chrome, an avance is already a reference to a page), and neither is anything
      // once the site has the five pages the download route accepts.
      if (canConvert(doc, sectionId)) {
        actions.appendChild(
          action(
            es["editor.sectionToPage"],
            "move",
            false,
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M14 3v6h6"/><path d="M14 3l6 6"/><path d="M11 13h9"/><path d="M17 10l3 3-3 3"/></svg>',
            () => onSectionToPage(sectionId),
          ),
        );
      }

      actions.appendChild(
        action(
          es["editor.fields.open"],
          "move",
          false,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10"/><path d="M4 12h16"/><path d="M4 17h7"/><circle cx="18" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>',
          () => showFields(sectionId),
        ),
      );
      actions.appendChild(
        action(
          es["editor.deleteSection"],
          "delete",
          false,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>',
          () => onDeleteSection(sectionId),
        ),
      );
      target.appendChild(actions);
    }

    for (const section of sections) {
      section.addEventListener("click", () => select(section));
    }

    // Anywhere else in the page closes the composition menu, the same way the insertion menu
    // closes. Registered on the frame's document rather than the body so a click on the padding
    // around the sections counts too.
    iframeDoc.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".rb-compositions, .rb-actions")) return;
      for (const menu of iframeDoc.querySelectorAll(".rb-compositions")) menu.remove();
      compositionMenuOpen.current = false;
    });

    // Put the selection back where it was before this render replaced the whole frame. A section
    // that is gone — deleted, and this is the render that removed it — simply does not come back,
    // which is the right answer without a special case for it.
    const remembered = selectedSection.current;
    if (remembered) {
      const target = sections.find((section) => section.dataset.section === remembered);
      if (target) {
        select(target);
        if (compositionMenuOpen.current) {
          const compositions = compositionsFor(doc, remembered);
          if (compositions.length > 0) {
            target.appendChild(compositionMenu(remembered, compositions));
          } else {
            compositionMenuOpen.current = false;
          }
        }
      } else {
        selectedSection.current = null;
        compositionMenuOpen.current = false;
      }
    }
  }

  /**
   * The insertion pill, in the gap between sections: a dashed rule broken by "Añadir sección
   * aquí", which is where `docs/design/HANDOFF.md` puts it — "never from a list in a side panel",
   * because a list in a panel makes you choose a position after choosing a section, and the gap
   * you clicked already said the position.
   *
   * Injected into the iframe like the selection chrome, for the same reason: the gaps only exist
   * between the real rendered sections, and nothing outside the frame knows where those fall.
   * None of it reaches the published HTML — this runs against the live DOM only, never the
   * document.
   */
  function wireInsertion(iframeDoc: Document) {
    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];
    if (sections.length === 0) return;

    function closeMenus() {
      for (const menu of iframeDoc.querySelectorAll(".rb-menu")) menu.remove();
    }

    function menu(index: number): HTMLElement {
      const panel = iframeDoc.createElement("div");
      panel.className = "rb-menu";

      const title = iframeDoc.createElement("p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.addSection.title"];
      panel.appendChild(title);

      for (const offer of offers) {
        const choice = iframeDoc.createElement("button");
        choice.type = "button";
        choice.className = "rb-menu-choice";
        const name = iframeDoc.createElement("span");
        name.className = "rb-menu-name";
        name.textContent = offer.name;
        const description = iframeDoc.createElement("span");
        description.className = "rb-menu-description";
        description.textContent = offer.description;
        choice.append(name, description);
        choice.addEventListener("click", (event) => {
          event.stopPropagation();
          closeMenus();
          onInsertSection(offer.catalogId, index);
        });
        panel.appendChild(choice);
      }

      if (contactUnavailable) {
        const note = iframeDoc.createElement("p");
        note.className = "rb-menu-note";
        note.textContent = es["editor.addSection.contactUnavailable"];
        panel.appendChild(note);
      }

      return panel;
    }

    function gap(index: number): HTMLElement {
      const row = iframeDoc.createElement("div");
      row.className = "rb-gap";

      const pill = iframeDoc.createElement("button");
      pill.type = "button";
      pill.className = "rb-pill";
      pill.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#156FE7" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
      pill.appendChild(iframeDoc.createTextNode(es["editor.addSectionHere"]));
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = row.querySelector(".rb-menu");
        closeMenus();
        if (!open) row.appendChild(menu(index));
      });

      const before = iframeDoc.createElement("span");
      before.className = "rb-rule";
      const after = iframeDoc.createElement("span");
      after.className = "rb-rule";
      row.append(before, pill, after);
      return row;
    }

    for (const [index, section] of sections.entries()) section.before(gap(index));
    sections[sections.length - 1]?.after(gap(sections.length));

    // Anywhere else closes an open menu, the same as any menu on the web. Not `capture`, so a
    // choice's own handler runs first and its `stopPropagation` keeps this from firing twice.
    iframeDoc.addEventListener("click", closeMenus);
  }

  /**
   * Clicking a photo replaces it.
   *
   * The placeholder already says "Tu foto aquí", so the affordance the page needs is the one it
   * already promises — no button of its own in the action cluster, no panel. `EDITABLE_TAGS`
   * leaves `img` out because there is no text on an image to click into; this is the other half
   * of that sentence, which had been missing.
   */
  /**
   * The line controls, on any section whose preset holds a list.
   *
   * **The gap this closes is older than the section that revealed it.** Until now nothing
   * anywhere could add a line to a list: the questionnaire's answers decided how many cards "Qué
   * hago" had, and a section added from the pill got exactly the one line `blankSection` gives
   * it, for ever. That was invisible while the only list sections were generated ones; a price
   * list that can hold twelve lines and can only ever show one is the same bug with the lid off.
   *
   * Injected into the frame like every other piece of section chrome, and for the same reason —
   * the lines only exist in the rendered page. `data-item` is already on each `li` (the renderer
   * puts it there beside `data-id`), so a line needs no new identity scheme to be addressed.
   *
   * Both controls are drawn only where they would do something: no "add" once the preset's
   * maximum is reached, and no "remove" on the last line, since a list with nothing in it renders
   * as nothing and would leave a heading with a hole under it.
   */
  function wireLines(iframeDoc: Document) {
    for (const section of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      const sectionId = section.dataset.section;
      if (!sectionId) continue;
      const lines = linesFor(doc, sectionId);
      if (!lines) continue;

      const list = section.querySelector<HTMLElement>(".rb-list");
      if (!list) continue;

      if (lines.canRemove) {
        for (const li of list.querySelectorAll<HTMLElement>("[data-item]")) {
          const itemId = li.dataset.item;
          if (!itemId) continue;
          li.classList.add("rb-line");
          const remove = iframeDoc.createElement("button");
          remove.type = "button";
          remove.className = "rb-line-remove";
          remove.setAttribute("aria-label", lineLabel("remove", lines.catalogId));
          remove.innerHTML =
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            onRemoveItem(sectionId, lines.slot, itemId);
          });
          li.appendChild(remove);
        }
      }

      if (!lines.canAdd) continue;
      const add = iframeDoc.createElement("button");
      add.type = "button";
      add.className = "rb-line-add";
      add.textContent = `+ ${lineLabel("add", lines.catalogId)}`;
      add.addEventListener("click", (event) => {
        event.stopPropagation();
        // Built here from the catalog, because what a valid line is made of is the catalog's
        // business; the schema re-mints its ids against the document it lands in.
        const found = findSection(doc, sectionId);
        if (!found) return;
        onAddItem(sectionId, lines.slot, blankItem(found.section.preset.catalogId));
      });
      list.insertAdjacentElement("afterend", add);
    }
  }

  function wirePhotos(iframeDoc: Document) {
    for (const image of iframeDoc.querySelectorAll<HTMLImageElement>('img[data-role="image"]')) {
      const elementId = image.dataset.id;
      const sectionId = image.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!elementId || !sectionId) continue;

      image.classList.add("rb-photo");
      image.setAttribute("title", es["editor.changePhoto"]);
      image.addEventListener("click", (event) => {
        // Not the section's click too: choosing a photo is not choosing a section.
        event.stopPropagation();
        replacePhoto({ sectionId, elementId });
      });

      if (photoStates.get(addressKey(sectionId, elementId)) !== "sample") continue;

      // The badge is absolutely positioned, so it needs a positioned ancestor to anchor to, and
      // the nearest one it would otherwise find is the section — which, for a gallery card, is the
      // wrong box by the height of the whole section. Positioning the image's own parent is a
      // no-op wherever that parent is already positioned, and never reaches the published page:
      // this runs on the iframe's DOM, not on the document.
      const parent = image.parentElement;
      if (parent && iframeDoc.defaultView?.getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
      image.insertAdjacentElement(
        "afterend",
        sampleBadge(iframeDoc, image, { sectionId, elementId }),
      );
    }
  }

  /**
   * «Foto de ejemplo», over a photograph that came from the bank.
   *
   * **Drawn here and never by the renderer**, which is the guarantee that it cannot reach a
   * published page: `render` emits no `sample` attribute at all, so this label exists only inside
   * the editor's own iframe, alongside the selection outlines and the insertion pills. ADR 0011
   * asks for exactly this, and it is the same reason the marker's «Tu foto aquí» is baked into an
   * image while this is not.
   *
   * **Only for `"sample"`, never for `"empty"`.** The catalog's marker already says «Tu foto aquí»
   * in the picture itself; a label on top of it would be a label on a label. The distinction is
   * `photoInventory.ts`'s three states, and it is the same distinction the warning before a
   * download uses — one source, so the two surfaces cannot come to disagree.
   */
  function sampleBadge(
    iframeDoc: Document,
    image: HTMLImageElement,
    address: ElementAddress,
  ): HTMLButtonElement {
    const badge = iframeDoc.createElement("button");
    badge.type = "button";
    badge.className = "rb-sample";
    badge.textContent = es["editor.photos.state.sample"];
    badge.title = es["editor.changePhoto"];

    // The renderer places a cover's image by inline `grid-column` / `grid-row` (see the golden
    // corpus). Copied onto the badge so that, inside a grid, it is positioned against the
    // photograph's own grid area instead of the section's padding box — which is what puts it on
    // the photograph rather than in the section's top-left corner. An image with no grid placement
    // — a gallery card's, for one — simply anchors to its parent, which the stylesheet positions.
    if (image.style.gridColumn) badge.style.gridColumn = image.style.gridColumn;
    if (image.style.gridRow) badge.style.gridRow = image.style.gridRow;

    badge.addEventListener("click", (event) => {
      event.stopPropagation();
      replacePhoto(address);
    });
    return badge;
  }

  function wireEditing(iframeDoc: Document) {
    for (const el of iframeDoc.querySelectorAll<HTMLElement>("[data-id]")) {
      if (!EDITABLE_TAGS.has(el.tagName)) continue;
      const elementId = el.dataset.id;
      // The section this field lives in, read off the same markup: `data-section` is what makes
      // the address unambiguous once two sections can carry the same element id.
      const sectionId = el.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!elementId || !sectionId) continue;
      const address: ElementAddress = { sectionId, elementId };

      el.contentEditable = "true";
      const original = (el.textContent ?? "").trim();

      // Select the whole field the moment it gains focus, the same as clicking into a
      // pre-filled name field: the first keystroke replaces the placeholder text rather
      // than landing mid-word wherever the click happened to fall.
      el.addEventListener("focus", () => {
        const selection = iframeDoc.getSelection();
        if (!selection) return;
        const range = iframeDoc.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      });

      // These are real hrefs (a "Reservar mesa" button, say): clicking one to place a
      // cursor must not also navigate the preview away.
      if (el.tagName === "A") el.addEventListener("click", (event) => event.preventDefault());

      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          el.blur();
        } else if (event.key === "Escape") {
          el.textContent = original;
          el.blur();
        }
      });

      el.addEventListener("blur", () => {
        const next = (el.textContent ?? "").trim();
        // **Emptying a text is a real edit**, and used to be silently undone here. The comment
        // that guarded it said "nothing here offers a real way to hide the element instead", and
        // that stopped being true twice: the fields panel clears a section's slot (sprint 3
        // day 4), and an empty text now renders as nothing rather than as an empty tag (day 6).
        // Nothing is lost either way — a section slot comes back through that panel, a list line
        // through remove-and-add, and both through undo, which is the same net ADR 0014 gives a
        // deleted section.
        //
        // Found by building a carta: a dish with no price could not be given one, so the line
        // published «Escribe aquí el precio» — a marker on a real restaurant's page — and made
        // "the price is optional per line" false in practice.
        //
        // **A link or a button is the exception, and the original reasoning holds for it word for
        // word.** Its value is a destination, so emptying the label leaves an anchor that still
        // points somewhere with no words in it: invisible on the page and nameless to a screen
        // reader. The download refuses a button that goes nowhere; this refuses one that says
        // nothing.
        if (next === "" && (el.dataset["role"] === "link" || el.dataset["role"] === "button")) {
          el.textContent = original;
          return;
        }
        if (next !== original) onEditText(address, next);
      });
    }
  }

  function wireInteractions() {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    const style = iframeDoc.createElement("style");
    style.textContent = [
      '[contenteditable="true"] { cursor: text; border-radius: 3px;',
      "  outline: 2px dashed transparent; outline-offset: 3px; }",
      '[contenteditable="true"]:hover, [contenteditable="true"]:focus { outline-color: #156FE7; }',
      "[data-section] { position: relative; cursor: pointer; }",
      "[data-section].rb-selected { outline: 2px solid #156FE7; outline-offset: -2px; }",
      ".rb-handle { position: absolute; width: 7px; height: 7px; background: #FFFFFF;",
      "  border: 2px solid #156FE7; border-radius: 2px; pointer-events: none; }",
      ".rb-handle-tl { top: -4px; left: -4px; } .rb-handle-tr { top: -4px; right: -4px; }",
      ".rb-handle-bl { bottom: -4px; left: -4px; } .rb-handle-br { bottom: -4px; right: -4px; }",
      // Inset within the section, not hung outside it like the corner handles: the cover is
      // the first section, with no room above it, and a button hanging above the top of the
      // page there would sit outside the iframe's own visible area — covered by whatever the
      // parent page draws above the iframe, and unclickable. Every section has room inside it.
      ".rb-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }",
      ".rb-action { width: 26px; height: 26px; display: flex; align-items: center;",
      "  justify-content: center; border: 2px solid #FFFFFF; border-radius: 999px;",
      "  cursor: pointer; box-shadow: 0 2px 6px rgba(15,23,42,0.28); }",
      ".rb-action-move { background: #156FE7; } .rb-action-move:hover { background: #0E5BC4; }",
      ".rb-action-delete { background: #DC2626; } .rb-action-delete:hover { background: #B91C1C; }",
      ".rb-action:disabled { background: #B9CDEA; cursor: not-allowed; }",
      // The gap between sections, drawn as mockup 08 draws it: a dashed rule broken by a pill.
      ".rb-gap { position: relative; box-sizing: border-box; height: 76px; padding: 0 40px;",
      "  display: flex; align-items: center; gap: 0; background: #FFFFFF; }",
      ".rb-rule { flex-grow: 1; height: 0; border-top: 2px dashed #B9CDEA; }",
      // The interface's own typeface, never the site's. Everything else injected here is an
      // icon, so this is the first piece of chrome with words in it, and `font: inherit` would
      // have drawn them in whatever face the client picked for their own headings — ADR 0015's
      // separation, showing up as a menu set in a display serif.
      `.rb-pill, .rb-menu, .rb-menu button { font-family: ${UI_FONT}; }`,
      ".rb-pill { display: inline-flex; align-items: center; gap: 8px; height: 40px;",
      "  padding: 0 20px; font-size: 14px; font-weight: 600; color: #156FE7;",
      "  background: #FFFFFF; border: 1px solid #A9C9F4; border-radius: 999px; cursor: pointer; }",
      ".rb-pill:hover { background: #F2F7FE; border-color: #156FE7; }",
      ".rb-menu { position: absolute; top: 60px; left: 50%; transform: translateX(-50%);",
      "  z-index: 20; width: 340px; max-width: calc(100% - 80px); box-sizing: border-box;",
      "  padding: 14px; background: #FFFFFF; border: 1px solid #E5E9F0; border-radius: 13px;",
      "  box-shadow: 0 14px 38px rgba(15,23,42,0.18); display: flex; flex-direction: column;",
      "  gap: 4px; text-align: left; }",
      ".rb-menu-title { margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0F172A; }",
      ".rb-menu-choice { display: flex; flex-direction: column; gap: 2px; padding: 9px 10px;",
      "  text-align: left; background: none; border: 0; border-radius: 9px; cursor: pointer; }",
      ".rb-menu-choice:hover { background: #F2F7FE; }",
      ".rb-menu-name { font-size: 14px; font-weight: 600; color: #0F172A; }",
      ".rb-menu-description { font-size: 12px; line-height: 1.35; color: #5B6B82; }",
      ".rb-menu-note { margin: 8px 0 0 0; padding-top: 10px; border-top: 1px solid #EDF1F6;",
      "  font-size: 12px; line-height: 1.4; color: #5B6B82; }",
      // The composition menu: the insertion menu's card, anchored under the action cluster
      // instead of centred in a gap, because this one belongs to a section rather than to a
      // space between two. Narrower, since every choice is a short name with no description.
      `.rb-compositions { font-family: ${UI_FONT}; position: absolute; top: 40px; right: 8px;`,
      "  z-index: 20; width: 240px; max-width: calc(100% - 16px); box-sizing: border-box;",
      "  padding: 12px; text-align: left; background: #FFFFFF; border: 1px solid #E5E9F0;",
      "  border-radius: 13px; box-shadow: 0 14px 38px rgba(15,23,42,0.18); display: flex;",
      "  flex-direction: column; gap: 2px; }",
      ".rb-composition-choice { font-family: inherit; }",
      // The one in use is marked, not hidden: a toggle group where something is always chosen.
      '.rb-composition-choice[aria-pressed="true"] { background: #EAF2FE; }',
      '.rb-composition-choice[aria-pressed="true"] .rb-menu-name { color: #156FE7; }',
      // A photo reads as replaceable the same way an editable text does: the dashed outline on
      // hover, and nothing until then.
      ".rb-photo { cursor: pointer; outline: 2px dashed transparent; outline-offset: 3px; }",
      ".rb-photo:hover { outline-color: #156FE7; }",
      // «Foto de ejemplo», over a photograph the bank supplied. Dark and slightly translucent
      // rather than the blue of the editor's own controls: it is a statement about the picture,
      // not a control belonging to the chrome — though pressing it does open "Cambiar foto", since
      // the label is exactly where someone who disagrees with it is already looking.
      `.rb-sample { font-family: ${UI_FONT}; position: absolute; top: 10px; left: 10px; z-index: 6;`,
      "  align-self: start; justify-self: start; margin: 0; padding: 5px 11px; font-size: 12px;",
      "  font-weight: 600; line-height: 1.2; color: #FFFFFF; background: rgba(15,23,42,0.78);",
      "  border: 0; border-radius: 999px; cursor: pointer; backdrop-filter: blur(3px); }",
      ".rb-sample:hover { background: rgba(15,23,42,0.92); }",
      // The line controls. The pill echoes the section one, smaller and left-aligned under the
      // list it belongs to rather than centred in a gap, because it adds to a thing rather than
      // between two things.
      `.rb-line-add { font-family: ${UI_FONT}; margin-top: 10px; display: inline-flex;`,
      "  align-items: center; height: 30px; padding: 0 14px; font-size: 13px; font-weight: 600;",
      "  color: #156FE7; background: #FFFFFF; border: 1px solid #A9C9F4; border-radius: 999px;",
      "  cursor: pointer; }",
      ".rb-line-add:hover { background: #F2F7FE; border-color: #156FE7; }",
      // On the line itself, and only visible while the pointer is over it: a cross on every row
      // at all times would draw the eye away from the words, which are the thing being written.
      ".rb-line { position: relative; }",
      ".rb-line-remove { position: absolute; top: 2px; right: 0; width: 20px; height: 20px;",
      "  display: flex; align-items: center; justify-content: center; background: #DC2626;",
      "  border: 2px solid #FFFFFF; border-radius: 999px; cursor: pointer; opacity: 0;",
      "  box-shadow: 0 2px 6px rgba(15,23,42,0.28); }",
      ".rb-line:hover .rb-line-remove, .rb-line-remove:focus { opacity: 1; }",
    ].join("\n");
    iframeDoc.head.appendChild(style);

    wireLinks(iframeDoc);
    wireSelection(iframeDoc);
    wireInsertion(iframeDoc);
    wireLines(iframeDoc);
    wirePhotos(iframeDoc);
    wireEditing(iframeDoc);
  }

  /**
   * The photo srcs this document actually names. An upload that has since been undone still has
   * its bytes in memory, and the route refuses a photo the document does not reference.
   *
   * `flattenElements` since sprint 5 day 3, for the reason `collectAssets` in the renderer already
   * uses it: a gallery's photographs live inside list items, and walking `section.content` alone
   * left every one of them out of the multipart body. The page would then be published referencing
   * files the route never received — the worst shape of this bug, because it only shows up in the
   * downloaded ZIP, after the owner has gone.
   */
  function referencedPhotos(): string[] {
    const srcs = new Set<string>();
    for (const page of doc.pages) {
      for (const section of page.sections) {
        for (const element of flattenElements(section.content)) {
          if (element.value?.kind === "image" && photoUrls.has(element.value.src)) {
            srcs.add(element.value.src);
          }
        }
      }
    }
    return [...srcs];
  }

  async function download() {
    setState("downloading");
    try {
      // Multipart since ADR 0018: the document as a field, each photo as a file named by the
      // src the document carries. The object URL is the handle to the bytes already in memory,
      // so nothing is re-read from storage to build this.
      const form = new FormData();
      form.set("document", JSON.stringify(doc));
      for (const src of referencedPhotos()) {
        const url = photoUrls.get(src);
        if (!url) continue;
        const blob = await (await fetch(url)).blob();
        form.append("photo", new File([blob], src, { type: blob.type }));
      }
      const response = await fetch("/api/download", { method: "POST", body: form });
      if (!response.ok) throw new Error(`download failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(response, "mi-web.zip");
      link.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  /**
   * What «Descargar» actually does — `downloadGateFor` decides, from the same counts the «Fotos»
   * panel reads, whether that is downloading immediately, stopping to ask, or refusing outright.
   *
   * Recomputed on every press rather than kept as derived state watching `doc`: the two dialogs
   * this can open are meant to reflect the document *as it stood the moment «Descargar» was
   * pressed*, and computing fresh here is what makes closing one and pressing «Descargar» again
   * — after fixing the one photograph the dialog was about — re-evaluate rather than reopen the
   * same stale verdict.
   */
  function requestDownload() {
    const gate = downloadGateFor(countPhotos(doc));
    if (gate.kind === "ready") {
      void download();
      return;
    }
    setDownloadDialog(gate);
  }

  return (
    <EditorShell
      // The business name, not the variant's. The bar said «Clásica» — the caption of whichever of
      // the three cards was opened — where mockup 08 shows «Barbería El Corte», and it had said so
      // since the editor existed. Found by walking the editor on sprint 4 day 2 and recorded in
      // `docs/design/REVIEW.md` as direction's to settle, which it did. `title` still names the
      // preview frame, where "which of the three am I in" is exactly the useful thing to say.
      siteName={doc.siteName}
      pages={doc.pages.map((page) => ({ id: page.id, title: page.title }))}
      currentPageId={pageId ?? doc.pages[0]?.id}
      onSelectPage={(id) => onSelectPage(doc.pages[0]?.id === id ? undefined : id)}
      onBack={onBack}
      downloadState={state}
      onDownload={requestDownload}
      device={device}
      onDeviceChange={setDevice}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
      saveStatus={saveStatus}
      rail={rail}
      onRailChange={showRail}
      panel={
        rail === "photos" ? (
          <PhotosPanel
            document={doc}
            photoUrls={photoUrls}
            onReplacePhoto={replacePhoto}
            onGoToPhoto={(photo) => {
              // The panel is also a way of finding a photograph: show the page it is on and select
              // its section, which scrolls the canvas to it.
              onSelectPage(doc.pages[0]?.id === photo.pageId ? undefined : photo.pageId);
              selectedSection.current = photo.sectionId;
            }}
          />
        ) : rail === "pages" ? (
          <PagesPanel
            document={doc}
            currentPageId={pageId}
            onSelectPage={(id) => onSelectPage(doc.pages[0]?.id === id ? undefined : id)}
            onRenamePage={onRenamePage}
            onMovePage={onMovePage}
            onDeletePage={onDeletePage}
            linksTo={(id) => listLinksTo(doc, id).length}
          />
        ) : rail === "style" ? (
          <StylePanel
            theme={doc.theme}
            onPickPalette={onPickPalette}
            onPickTypePair={onPickTypePair}
            onClose={() => showRail("sections")}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 border-b border-ui-border px-4 py-3">
        {state === "error" ? <FieldError>{es["editor.downloadError"]}</FieldError> : null}
        {photoError ? <FieldError>{photoError}</FieldError> : null}
        {footerNeedsIdentity ? (
          <p className="m-0 text-[13px] text-ui-muted">{es["editor.footerIdentity"]}</p>
        ) : null}
        {placeholders > 0 ? (
          <p className="m-0 text-[13px] font-medium text-[#92400E]">
            {placeholders === 1
              ? es["editor.placeholder.one"]
              : es["editor.placeholder.many"].replace("{count}", String(placeholders))}
          </p>
        ) : null}
        <p className="m-0 text-[13px] text-ui-muted">{es["editor.editHint"]}</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const address = pendingImage.current;
          pendingImage.current = null;
          if (file && address) onPickPhoto(address, file);
        }}
      />
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={html}
        onLoad={wireInteractions}
        className="w-full flex-grow border-0 bg-ui-surface"
        style={{ minHeight: "60vh" }}
      />
      {fieldsFor && findSection(doc, fieldsFor) ? (
        <FieldsPanel
          sectionId={fieldsFor}
          sectionName={sectionDisplayName(doc, fieldsFor)}
          rows={sectionFields(doc, fieldsFor)}
          slotOrder={slotOrderOf(doc, fieldsFor)}
          onFill={onFillSlot}
          onClear={onClearSlot}
          onClose={() => showFields(null)}
        />
      ) : null}
      {toast ? (
        <div className="fixed bottom-[34px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-5 rounded-[13px] bg-[#0F172A] py-3.5 pr-3.5 pl-5 shadow-[0_10px_30px_rgba(15,23,42,0.28)]">
          <span className="inline-flex items-center gap-2.5 text-[15px] font-medium text-white">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94A3B8"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16" />
              <path d="M9 7V5h6v2" />
              <path d="M6 7l1 13h10l1-13" />
            </svg>
            {es["editor.toast.deleted"].replace("{name}", toast.sectionName)}
          </span>
          {toast.brokenAnchors > 0 ? (
            <span className="max-w-[26ch] text-[13px] leading-snug text-[#FCA5A5]">
              {toast.brokenAnchors === 1
                ? es["editor.toast.deletedAnchors.one"]
                : es["editor.toast.deletedAnchors.many"].replace(
                    "{count}",
                    String(toast.brokenAnchors),
                  )}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onUndo}
            className="h-9 cursor-pointer rounded-[9px] border-0 bg-white px-[18px] text-sm font-semibold text-ui-ink"
          >
            {es["editor.toast.undo"]}
          </button>
          {toast.persistent ? (
            <button
              type="button"
              onClick={onDismissToast}
              aria-label={es["editor.toast.dismiss"]}
              className="cursor-pointer border-0 bg-transparent text-[#94A3B8]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
      {downloadDialog?.kind === "tooManyPhotos" ? (
        <TooManyPhotosDialog
          count={downloadDialog.count}
          max={downloadDialog.max}
          onClose={() => setDownloadDialog(null)}
        />
      ) : null}
      {downloadDialog?.kind === "warn" ? (
        <DownloadWarningDialog
          document={doc}
          photoUrls={photoUrls}
          onReplacePhoto={(address) => {
            setDownloadDialog(null);
            replacePhoto(address);
          }}
          onDownloadAnyway={() => {
            setDownloadDialog(null);
            void download();
          }}
          onCancel={() => setDownloadDialog(null)}
        />
      ) : null}
    </EditorShell>
  );
}
