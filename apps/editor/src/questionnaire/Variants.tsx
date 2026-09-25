"use client";

import { blankSection, CATALOG, CONTACT_ID, canBeBlank, variantsFor } from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { type Answers, contactSectionFor, generateVariants } from "@retorika/generator";
import { render } from "@retorika/renderer";
import { findSection, type RetorikaDocument, type Section } from "@retorika/schema";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { saveSession } from "../editor/autosave.ts";
import {
  type History,
  historiesReducer,
  initHistories,
  wasSectionEverEdited,
} from "../editor/documentHistory.ts";
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

export function Variants({
  answers,
  initialDocuments,
  initialOpenIndex = null,
  onRestart,
}: {
  answers: Answers;
  /** Present when `Questionnaire` restored a session; absent for a freshly generated one. */
  initialDocuments?: RetorikaDocument[];
  initialOpenIndex?: number | null;
  onRestart: () => void;
}) {
  // The histories outlive "Volver": edits and what can be undone survive going back to the grid
  // and reopening the same card, which is the one piece of continuity this in-memory-only slice
  // owes the user within a single session.
  const [histories, dispatch] = useReducer(historiesReducer, answers, (initial) =>
    initHistories(initialDocuments ?? generateVariants(initial).map((site) => site.document)),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(initialOpenIndex);

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
      });
      setSaveStatus(ok ? "saved" : "unsaved");
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [answers, histories, openIndex]);

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

  const offers = useMemo<SectionOffer[]>(
    () =>
      Object.keys(CATALOG)
        .filter((catalogId) =>
          canBeBlank(catalogId) ? true : catalogId === CONTACT_ID && contactSection !== undefined,
        )
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
    const doc = history.present.document;
    const section: Section | undefined =
      catalogId === CONTACT_ID
        ? contactSection
        : blankSection(catalogId, variantForInsertion(doc, catalogId), `sec-${catalogId}`);
    // Only reachable for a contact section the menu would not have offered in the first place.
    if (!section) throw new Error(`handleInsertSection: nothing to build for "${catalogId}"`);
    dispatch({ type: "insertSection", variant, section, index });
  }

  function handleDeleteSection(variant: number, history: History, sectionId: string) {
    const found = findSection(history.present.document, sectionId);
    const persistent = wasSectionEverEdited(history, sectionId);
    dispatch({ type: "deleteSection", variant, sectionId });

    clearTimeout(toastTimer.current);
    setToast({
      sectionName: found ? catalogSectionName(found.section.preset.catalogId) : sectionId,
      persistent,
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
          onClick={onRestart}
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
