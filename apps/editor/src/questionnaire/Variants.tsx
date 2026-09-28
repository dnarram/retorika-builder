"use client";

import {
  blankSection,
  CATALOG,
  CONTACT_ID,
  FOOTER_ID,
  TEASER_ID,
  variantsFor,
} from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { GENERIC_SECTOR, textFor } from "@retorika/copybank";
import {
  type Answers,
  contactSectionFor,
  footerSectionFor,
  generateVariants,
} from "@retorika/generator";
import { render } from "@retorika/renderer";
import {
  type ElementAddress,
  findSection,
  listAnchorsTo,
  type RetorikaDocument,
  type Section,
} from "@retorika/schema";
import { withPalette, withTypePair } from "@retorika/tokens";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { saveSession } from "../editor/autosave.ts";
import {
  type History,
  historiesReducer,
  initHistories,
  wasSectionEverEdited,
} from "../editor/documentHistory.ts";
import {
  clearPhotos,
  loadPhotos,
  photoBlob,
  photoSrcFor,
  preparePhoto,
  savePhoto,
} from "../editor/photos.ts";
import es from "../locales/es.json" with { type: "json" };
import { type DeleteToast, Editor, type SectionOffer } from "./Editor.tsx";
import { Brand } from "./ui.tsx";

/** The catalog's own Spanish name for a section, e.g. `section.cover.name` → "Portada" —
 * what the delete toast (ADR 0014) names, since "Has borrado la sección «sec-cover»" would not
 * mean anything to the person reading it. */
function catalogSectionName(catalogId: string): string {
  const key = `section.${catalogId}.name` as keyof typeof catalogEs;
  return catalogEs[key] ?? catalogId;
}

/** The catalog's one-line description, e.g. `section.services.description` — what the
 * "Añadir sección aquí" menu shows under each name so the choice is made by what the section
 * does, not by its catalog id. */
function catalogSectionDescription(catalogId: string): string {
  const key = `section.${catalogId}.description` as keyof typeof catalogEs;
  return catalogEs[key] ?? "";
}

/**
 * The composition an inserted section is born with: the one the sections of that kind already
 * in this document use, and the catalog's first otherwise.
 *
 * Matching matters because the three variant cards are three compositions, not three colour
 * schemes — adding a second cover drawn "foto a la derecha" into the card whose covers are all
 * "foto de fondo" would look like a rendering fault rather than a choice.
 */
function variantForInsertion(doc: RetorikaDocument, catalogId: string): string {
  for (const page of doc.pages) {
    for (const section of page.sections) {
      if (section.preset.catalogId === catalogId) return section.preset.variantId;
    }
  }
  const first = variantsFor(catalogId)[0];
  if (!first) throw new Error(`variantForInsertion: "${catalogId}" declares no variant`);
  return first;
}

/** How long a delete's undo toast stays for a section the user never touched (ADR 0014). A
 * section they had edited does not get a timer at all — it waits until dismissed or undone. */
const TOAST_DURATION_MS = 6000;

/**
 * "Elige por dónde empezar" (mockup 07), with real sites instead of drawings: each card is a
 * live `<iframe>` of what `@retorika/generator` actually produced for these five answers, not a
 * screenshot. That was only a screenshot in `docs/design/prototype/`, because those files sit on
 * disk and Chrome will not render a `file://` page inside an `iframe` of another `file://` page
 * — this app is served over HTTP, same origin, so the live frame works.
 *
 * No "volver a generar otras tres": the generator is deterministic (no clock, no randomness),
 * so clicking it would produce the exact same three sites again. Offering it would be a button
 * that lies about what it does.
 *
 * Each variant is a document in state with its own undo history (day 2). It replaced an overlay
 * of text edits kept beside an unchanging `generateVariants` output, which could not survive
 * what the rest of this sprint adds: two sources of truth cannot be undone in one order, and
 * the overlay's bare-element-id key stops identifying anything once a section can be duplicated.
 * `generateVariants` is now only the starting value — or, when `Questionnaire` found a saved
 * session, `initialDocuments` is (day 3's `localStorage` autosave, debounced 500ms after every
 * change to any variant's document or to which one is open, so a reload can put the whole grid
 * back, not just the card that happened to be open).
 */
const CAPTIONS: readonly { titleKey: keyof typeof es; captionKey: keyof typeof es }[] = [
  { titleKey: "variants.v1.title", captionKey: "variants.v1.caption" },
  { titleKey: "variants.v2.title", captionKey: "variants.v2.caption" },
  { titleKey: "variants.v3.title", captionKey: "variants.v3.caption" },
];

function ThumbnailFrame({ html, title }: { html: string; title: string }) {
  const width = 1280;
  const height = 900;
  const scale = 0.28;
  return (
    <div
      style={{
        width: "100%",
        height: height * scale,
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid #EDF1F6",
        background: "#FFFFFF",
      }}
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <iframe
          title={title}
          srcDoc={html}
          scrolling="no"
          style={{ width, height, border: 0, pointerEvents: "none" }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/** Autosaves 500ms after the last change, not on every keystroke's underlying document update. */
const SAVE_DEBOUNCE_MS = 500;

/** One shared empty map, so a variant with no photos does not hand the editor a new object on
 * every render and re-run the preview's `useMemo` for nothing. */
const EMPTY_PHOTOS: ReadonlyMap<string, string> = new Map();

export function Variants({
  answers,
  initialDocuments,
  initialOpenIndex = null,
  initialPageId,
  onRestart,
}: {
  answers: Answers;
  /** Present when `Questionnaire` restored a session; absent for a freshly generated one. */
  initialDocuments?: RetorikaDocument[];
  initialOpenIndex?: number | null;
  /** Which page of the open variant was showing, restored from the saved session. */
  initialPageId?: string;
  onRestart: () => void;
}) {
  // The histories outlive "Volver": edits and what can be undone survive going back to the grid
  // and reopening the same card, which is the one piece of continuity this in-memory-only slice
  // owes the user within a single session.
  const [histories, dispatch] = useReducer(historiesReducer, answers, (initial) =>
    initHistories(initialDocuments ?? generateVariants(initial).map((site) => site.document)),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpenIndex);

  /**
   * Which page of the open variant the canvas is showing.
   *
   * Kept here beside `openIndex` rather than inside `Editor`, for the same two reasons: it has to
   * survive «Volver» and reopening the card, and the saved session stores it. `undefined` means the
   * document's first page, which is what `render` already means by an absent `pageId` — so a
   * document with one page needs no value at all and nothing had to change for it.
   */
  const [pageId, setPageId] = useState<string | undefined>(initialPageId);

  // A page can stop existing under the editor's feet — undoing a conversion removes the page it
  // made, and so does deleting one — and rendering a `pageId` the document no longer has throws.
  // Falling back to the first page is the only answer that keeps the canvas showing something.
  const openDocument = openIndex === null ? undefined : histories[openIndex]?.present.document;
  const currentPageId =
    pageId !== undefined && openDocument?.pages.some((page) => page.id === pageId)
      ? pageId
      : undefined;

  // `null` until the first save attempt resolves: showing "Guardado" before anything has
  // actually been written would be exactly the false claim ADR 0012's note warns against.
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    saveTimer.current = setTimeout(() => {
      const ok = saveSession({
        answers,
        documents: histories.map((history) => history.present.document),
        openIndex,
        ...(currentPageId === undefined ? {} : { pageId: currentPageId }),
      });
      setSaveStatus(ok ? "saved" : "unsaved");
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [answers, histories, openIndex, currentPageId]);

  /**
   * The owner's uploaded photos, as object URLs the preview and the download can both use, keyed
   * by the src the document carries. Held per variant because the three cards are three
   * documents and all three have a section called `sec-cover`.
   */
  const [photoUrls, setPhotoUrls] = useState<Map<number, Map<string, string>>>(new Map());
  const [photoError, setPhotoError] = useState<string | null>(null);

  // What survived the last reload. Put back once, on mount: the documents came from
  // `localStorage`, the bytes from IndexedDB, and only together do they show the site the owner
  // left behind. A store that will not open yields nothing and the covers show the placeholder
  // again, which is the honest fallback — the document still says what it says.
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    void loadPhotos().then((stored) => {
      if (cancelled || stored.length === 0) return;
      const next = new Map<number, Map<string, string>>();
      for (const photo of stored) {
        const url = URL.createObjectURL(photoBlob(photo.bytes));
        created.push(url);
        const forVariant = next.get(photo.variant) ?? new Map<string, string>();
        forVariant.set(photo.src, url);
        next.set(photo.variant, forVariant);
      }
      setPhotoUrls(next);
    });
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, []);

  async function handlePickPhoto(variant: number, address: ElementAddress, file: File) {
    setPhotoError(null);
    const result = await preparePhoto(file);
    if (!result.ok) {
      setPhotoError(es[`editor.photo.${result.error.reason}` as keyof typeof es]);
      return;
    }

    const src = photoSrcFor(address.sectionId, address.elementId);
    const url = URL.createObjectURL(photoBlob(result.photo.bytes, result.photo.type));
    setPhotoUrls((current) => {
      const next = new Map(current);
      const forVariant = new Map(next.get(variant) ?? []);
      const previous = forVariant.get(src);
      if (previous) URL.revokeObjectURL(previous);
      forVariant.set(src, url);
      next.set(variant, forVariant);
      return next;
    });

    // The alt the placeholder carried says "aquí irá tu foto", which stops being true the moment
    // one arrives. Replaced with something true and unhelpful rather than something invented:
    // nothing here knows what is in the photograph, and a guess in an alt attribute is a lie
    // read aloud to the one person who cannot check it.
    const alt = `Foto de ${histories[variant]?.present.document.siteName ?? answers.businessName}`;
    dispatch({ type: "setImage", variant, address, src, alt });

    // A photo that was not stored must never show a tick. Same rule as a full `localStorage`.
    if (!(await savePhoto(variant, src, result.photo.bytes))) setSaveStatus("unsaved");
  }

  const [toast, setToast] = useState<DeleteToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function dismissToast() {
    clearTimeout(toastTimer.current);
    setToast(null);
  }

  /**
   * The contact section these answers justify, if any — the one section that cannot be born
   * blank, because its `primaryAction` is required and is a destination, and no marker text can
   * honestly stand in for one. Built from question 5 instead, exactly as the generator built the
   * original. When question 5 named no destination ("que vengan al local", or a field left
   * empty) there is nothing to build, and the menu says so rather than offering a section that
   * would arrive with a dead button in it.
   */
  const contactSection = useMemo(() => contactSectionFor(answers), [answers]);

  /**
   * How a section of this kind gets built when the pill inserts one.
   *
   * Two of the six are not born blank, for two different reasons, and both come from the
   * questionnaire instead. "Contacto y reservas" needs a destination and there is no honest
   * marker for one. "Pie de página" needs the business name, and a page reading «Escribe aquí tu
   * NIF» in its footer is exactly what ADR 0019 refuses. Everything else the catalog can make on
   * its own.
   *
   * `undefined` means the section cannot be offered at all right now, which is how «que vengan
   * al local» ends up with no contact section to add.
   */
  function sectionToInsert(catalogId: string, doc: RetorikaDocument): Section | undefined {
    if (catalogId === CONTACT_ID) return contactSection;
    if (catalogId === FOOTER_ID) return footerSectionFor(answers);
    const section = blankSection(
      catalogId,
      variantForInsertion(doc, catalogId),
      `sec-${catalogId}`,
    );
    return withBankHeadline(catalogId, section);
  }

  /**
   * The heading a newly added section arrives with, taken from the text bank when the bank has
   * one for this sector.
   *
   * **The name in the menu and the heading on the page are two different things**, and this is
   * where they part. The menu says «Precios» to everyone, because that is what the section is;
   * the page says «Nuestra carta» to a restaurant and «Tarifas» to a gym, because that is what
   * the owner would have written. Only the bank knows the second, and it knows it per sector.
   *
   * Falls back to the marker `blankSection` already put there, which is what happens for every
   * section the bank has no heading for — and, until those entries are read and approved, for
   * this one too (`packages/copybank/drafts/`). ADR 0009's binding half is that a person reads a
   * text before it ships, so an unapproved heading is simply not served and the marker stands.
   */
  function withBankHeadline(catalogId: string, section: Section): Section {
    // `ciudad` is left undefined, exactly as the generator leaves it: question 4 collects one
    // free-text address, not a municipality, and `packages/generator/src/sections.ts` says so —
    // "`ciudad` stays undefined until a real source exists". Passing the address here would put a
    // street where a city belongs. Every bank text using {ciudad} has a sibling that does not.
    // `sector` is null until question 2 is answered, which cannot be the case by the time a
    // section is being inserted — but the type is right to insist, and the generic file is what
    // the cascade would fall through to anyway.
    const text = textFor(answers.sector ?? GENERIC_SECTOR, catalogId, "headline", {
      negocio: answers.businessName,
    });
    if (!text) return section;
    return {
      ...section,
      content: section.content.map((element) =>
        element.slot === "headline" && element.value?.kind === "text"
          ? { ...element, value: { ...element.value, text } }
          : element,
      ),
    };
  }

  const offers = useMemo<SectionOffer[]>(
    () =>
      Object.keys(CATALOG)
        // «Avance» is never added by hand: `blankSection` refuses it, because its one slot is a
        // destination and no marker fills a destination honestly. One is made by converting a
        // section into a page, which is the only moment anything knows where it should point.
        .filter((catalogId) => catalogId !== TEASER_ID)
        .filter((catalogId) => catalogId !== CONTACT_ID || contactSection !== undefined)
        .map((catalogId) => ({
          catalogId,
          name: catalogSectionName(catalogId),
          description: catalogSectionDescription(catalogId),
        })),
    [contactSection],
  );

  function handleInsertSection(
    variant: number,
    history: History,
    catalogId: string,
    index: number,
  ) {
    dismissToast();
    const section = sectionToInsert(catalogId, history.present.document);
    // Only reachable for a contact section the menu would not have offered in the first place.
    if (!section) throw new Error(`handleInsertSection: nothing to build for "${catalogId}"`);
    dispatch({ type: "insertSection", variant, section, index });
  }

  function handleDeleteSection(variant: number, history: History, sectionId: string) {
    const found = findSection(history.present.document, sectionId);
    const persistent = wasSectionEverEdited(history, sectionId);
    // Counted before the delete, because afterwards the section is gone and the buttons that
    // named it are simply dead — `/api/download` would say so, but only once the person tried to
    // download. The moment worth telling them about is this one, while "Deshacer" is on screen.
    const brokenAnchors = listAnchorsTo(history.present.document, sectionId).length;
    dispatch({ type: "deleteSection", variant, sectionId });

    clearTimeout(toastTimer.current);
    setToast({
      sectionName: found ? catalogSectionName(found.section.preset.catalogId) : sectionId,
      persistent,
      brokenAnchors,
    });
    if (!persistent) toastTimer.current = setTimeout(dismissToast, TOAST_DURATION_MS);
  }

  if (openIndex !== null) {
    const history = histories[openIndex];
    const caption = CAPTIONS[openIndex];
    if (!history || !caption) return null;
    return (
      <Editor
        title={es[caption.titleKey]}
        document={history.present.document}
        onEditText={(address, text) => {
          // Any of these makes "Deshacer" on a showing toast undo the wrong thing — the most
          // recent action, not the delete the toast still names — so the toast stops being
          // accurate the moment something else lands on top of it.
          dismissToast();
          dispatch({ type: "editText", variant: openIndex, address, text });
        }}
        onDeleteSection={(sectionId) => handleDeleteSection(openIndex, history, sectionId)}
        onDuplicateSection={(sectionId) => {
          dismissToast();
          dispatch({ type: "duplicateSection", variant: openIndex, sectionId });
        }}
        onMoveSection={(sectionId, toIndex) => {
          dismissToast();
          dispatch({ type: "moveSection", variant: openIndex, sectionId, toIndex });
        }}
        onInsertSection={(catalogId, index) =>
          handleInsertSection(openIndex, history, catalogId, index)
        }
        onPickPhoto={(address, file) => {
          dismissToast();
          void handlePickPhoto(openIndex, address, file);
        }}
        onFillSlot={(fill) => {
          dismissToast();
          dispatch({ type: "fillSlot", variant: openIndex, fill });
        }}
        onClearSlot={(address) => {
          dismissToast();
          dispatch({ type: "clearSlot", variant: openIndex, address });
        }}
        onSetVariant={(sectionId, variantId) => {
          dismissToast();
          dispatch({ type: "setVariant", variant: openIndex, sectionId, variantId });
        }}
        onAddItem={(sectionId, slot, item) => {
          dismissToast();
          dispatch({ type: "addItem", variant: openIndex, sectionId, slot, item });
        }}
        onRemoveItem={(sectionId, slot, itemId) => {
          dismissToast();
          dispatch({ type: "removeItem", variant: openIndex, sectionId, slot, itemId });
        }}
        // The new theme is assembled here, from the theme the open document is carrying — never
        // from scratch. `withPalette` replaces the six colours and leaves the scale alone, which
        // is what keeps a palette change from quietly resetting sizes and spacing to the default.
        // And it is the open document only: the three variants are three documents, and
        // recolouring one has no more business touching the others than editing its text does.
        onPickPalette={(paletteId) => {
          dismissToast();
          dispatch({
            type: "setTheme",
            variant: openIndex,
            theme: withPalette(history.present.document.theme, paletteId),
          });
        }}
        onPickTypePair={(typePairId) => {
          dismissToast();
          dispatch({
            type: "setTheme",
            variant: openIndex,
            theme: withTypePair(history.present.document.theme, typePairId),
          });
        }}
        pageId={currentPageId}
        onSelectPage={(next) => {
          dismissToast();
          setPageId(next);
        }}
        // Converting leaves the canvas where it is: the section it was just showing has become an
        // avance in that same place, which is the visible proof that it worked, and a new tab has
        // appeared. Jumping to the page would take the owner away from the thing they just changed.
        onSectionToPage={(sectionId) => {
          dismissToast();
          dispatch({ type: "sectionToPage", variant: openIndex, sectionId });
        }}
        onRenamePage={(id, title) => {
          dismissToast();
          dispatch({ type: "renamePage", variant: openIndex, pageId: id, title });
        }}
        onMovePage={(id, toIndex) => {
          dismissToast();
          dispatch({ type: "movePage", variant: openIndex, pageId: id, toIndex });
        }}
        // The canvas may be showing the page that is about to go. `currentPageId` already falls
        // back to the first page for an id the document no longer has, so nothing has to be reset
        // here — and undo puts both the page and the canvas back together.
        onDeletePage={(id) => {
          dismissToast();
          dispatch({ type: "deletePage", variant: openIndex, pageId: id });
        }}
        photoUrls={photoUrls.get(openIndex) ?? EMPTY_PHOTOS}
        photoError={photoError}
        offers={offers}
        contactUnavailable={contactSection === undefined}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={() => {
          dismissToast();
          dispatch({ type: "undo", variant: openIndex });
        }}
        onRedo={() => {
          dismissToast();
          dispatch({ type: "redo", variant: openIndex });
        }}
        saveStatus={saveStatus}
        toast={toast}
        onDismissToast={dismissToast}
        onBack={() => {
          dismissToast();
          setOpenIndex(null);
        }}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "#F5F7FA",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Brand />
      <div
        style={{
          flexGrow: 1,
          boxSizing: "border-box",
          padding: "0 40px 40px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            maxWidth: 640,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#0F172A",
              textAlign: "center",
            }}
          >
            {es["variants.title"]}
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "#64748B", textAlign: "center" }}>
            {es["variants.subtitle"]}
          </p>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 1180,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          {histories.map((history, index) => {
            const caption = CAPTIONS[index];
            if (!caption) return null;
            const highlighted = index === 1;
            const html = render(history.present.document, "html").html;
            return (
              <div
                // By position: the three variants are a fixed list that never reorders, and
                // all three carry the same document id, so that would not distinguish them.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, never reordered
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 14,
                  background: "#FFFFFF",
                  border: highlighted ? "2px solid #156FE7" : "1px solid #E5E9F0",
                  boxShadow: highlighted ? "0 0 0 3px #E8F1FE" : undefined,
                  borderRadius: 14,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
                    {es[caption.titleKey]}
                  </span>
                  {highlighted ? (
                    <span
                      style={{
                        padding: "3px 9px",
                        background: "#E8F1FE",
                        color: "#156FE7",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                      }}
                    >
                      {es["variants.recommended"]}
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  style={{
                    padding: 0,
                    border: 0,
                    background: "none",
                    cursor: "pointer",
                    display: "block",
                  }}
                  aria-label={`${es["variants.viewFull"]}: ${es[caption.titleKey]}`}
                >
                  <ThumbnailFrame html={html} title={es[caption.titleKey]} />
                </button>

                <span style={{ fontSize: 12, lineHeight: 1.4, color: "#64748B" }}>
                  {es[caption.captionKey]}
                </span>

                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#156FE7",
                    background: "none",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {es["variants.viewFull"]} →
                </button>

                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 46,
                    background: highlighted ? "#156FE7" : "#FFFFFF",
                    color: highlighted ? "#FFFFFF" : "#334155",
                    fontSize: 14,
                    fontWeight: 600,
                    border: highlighted ? 0 : "1px solid #E5E9F0",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  {es["variants.use"]}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            // Day 3 of sprint 2 settled that starting over really starts over. The bytes live
            // somewhere `clearSession` cannot reach, so they are cleared here as well.
            void clearPhotos();
            onRestart();
          }}
          style={{
            font: "inherit",
            fontSize: 14,
            fontWeight: 600,
            color: "#156FE7",
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {es["variants.restart"]}
        </button>
      </div>
    </div>
  );
}
