"use client";

import {
  blankSection,
  CATALOG,
  CONTACT_ID,
  canBeBlank,
  FOOTER_ID,
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
import { hasSamplePhotos } from "@retorika/photobank";
import { render } from "@retorika/renderer";
import {
  type ElementAddress,
  findSection,
  foldsInto,
  listAnchorsTo,
  mintSectionId,
  type OwnFont,
  type RetorikaDocument,
  type Section,
} from "@retorika/schema";
import { withFamily, withOwnFont, withPalette, withScale, withTypePair } from "@retorika/tokens";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { loadAccountDesignTools, saveAccountDesignTools } from "../account/designTools.ts";
import { fetchSiteFonts, reconcileSiteFonts, siteFontFiles } from "../account/fontStorage.ts";
import {
  downloadPhoto,
  listPhotoObjects,
  photoObjectPath,
  removePhotos,
  uploadPhoto,
} from "../account/photoStorage.ts";
import { afterAcceptedSave, photoSyncPlan } from "../account/photoSync.ts";
import { SaveToAccountDialog } from "../account/SaveToAccountDialog.tsx";
import { saveSite } from "../account/sites.ts";
import { browserClient } from "../auth/clients.ts";
import { authConfigured } from "../auth/env.ts";
import { saveSession } from "../editor/autosave.ts";
import {
  designToolsFor,
  loadDesignTools,
  MIN_STUDIO_WIDTH,
  saveDesignTools,
  switchNotice,
} from "../editor/designTools.ts";
import {
  type History,
  historiesReducer,
  initHistories,
  wasPlacementEverMoved,
  wasSectionEverEdited,
} from "../editor/documentHistory.ts";
import { PHOTO_CONTENT_TYPE } from "../editor/downloadGate.ts";
import {
  clearFontFiles,
  type FontFileHandle,
  fontFileBlob,
  loadFontFiles,
  type StoredFontFile,
  saveFontFiles,
} from "../editor/ownFonts.ts";
import { listOwnPhotoSrcs } from "../editor/ownPhotos.ts";
import { photoSources } from "../editor/photoSources.ts";
import {
  clearPhotos,
  loadPhotos,
  type PhotoScope,
  photoBlob,
  photoSrcFor,
  preparePhoto,
  savePhoto,
  scopeKey,
} from "../editor/photos.ts";
import { withFontUrls, withPhotoUrls } from "../editor/previewDocument.ts";
import { record } from "../editor/probe.ts";
import { useMediaQuery } from "../editor/viewport.ts";
import es from "../locales/es.json" with { type: "json" };
import { type DeleteToast, Editor, type SectionOffer } from "./Editor.tsx";
import {
  carouselGutter,
  centredScrollLeft,
  DESKTOP_THUMBNAIL_SCALE,
  nearestCard,
  RECOMMENDED_INDEX,
  THREE_COLUMNS_FROM,
  THUMBNAIL_BORDER,
  THUMBNAIL_PAGE,
  thumbnailHeight,
  thumbnailScale,
} from "./proposalsRow.ts";
import { Brand, reveal } from "./ui.tsx";

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

/**
 * The real page, drawn small enough to fit the card it is in — **measured, not assumed**.
 *
 * The scale was a constant, 0.28, which is what a 358px card in the mockup's 1180px row needs and
 * what every other width got too: on a 390px phone the card was 60px wide and the box, with a
 * fixed height and `overflow: hidden`, showed the top-left 17 % of the proposal (sprint 21 day 2;
 * ADR 0042). A `ResizeObserver` on the box, as the editor's canvas already does, gives the width
 * the card actually has, and the height follows from it — so the box is always exactly the shrunk
 * page, whatever the row around it is doing. `srcDoc` never changes with the scale, so the frame
 * is not reloaded when the window is resized.
 */
function ThumbnailFrame({ html, title }: { html: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(DESKTOP_THUMBNAIL_SCALE);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setScale(thumbnailScale(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={box}
      /**
       * **The border is what answers the pointer here, and that is a decision rather than a
       * preference.** A scale on the thumbnail would be a `transform` on the ancestor of a live
       * `<iframe>`, which makes Chromium re-raster that frame's layer every frame — three real
       * documents, sixty times a second, on the screen the dossier calls the most important in
       * the product. The card lifts, the edge lights up, and nothing above the frame moves.
       */
      className="ui-interactive ui-thumb"
      style={{
        width: "100%",
        height: thumbnailHeight(scale),
        overflow: "hidden",
        borderRadius: 8,
        /* The width stays here, because `thumbnailHeight` adds exactly these two hairlines back.
           The **colour** lives in `.ui-thumb` (`globals.css`): an inline `border` would win over
           the hover rule and the edge would never light up — measured, in the first version of
           this, as a border that stayed `#EDF1F6` under the pointer. */
        borderWidth: THUMBNAIL_BORDER,
        borderStyle: "solid",
        background: "var(--ui-surface)",
      }}
    >
      <div
        style={{
          width: THUMBNAIL_PAGE.width,
          height: THUMBNAIL_PAGE.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <iframe
          title={title}
          srcDoc={html}
          scrolling="no"
          style={{
            width: THUMBNAIL_PAGE.width,
            height: THUMBNAIL_PAGE.height,
            border: 0,
            pointerEvents: "none",
          }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * The three cards side by side, or — under `THREE_COLUMNS_FROM` — one at a time with the next
 * peeking, snapping card to card (David's choice of 15 October 2026 over a vertical stack; ADR
 * 0042 §6). The row opens on the recommended one and three dots below say which is in view; the
 * dots are decoration, because the list itself is still the structure a reader walks.
 */
function ProposalsRow({ count, children }: { count: number; children: React.ReactNode }) {
  const carousel = !useMediaQuery(`(min-width: ${THREE_COLUMNS_FROM}px)`);
  const row = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(RECOMMENDED_INDEX);

  // `offsetLeft` against the row, which is `position: relative` for exactly this reading, and
  // set directly rather than with `scrollIntoView`, which would also scroll the page vertically.
  useEffect(() => {
    const el = row.current;
    if (!carousel || !el) return;
    const card = el.children.item(RECOMMENDED_INDEX);
    if (!(card instanceof HTMLElement)) return;
    el.scrollLeft = centredScrollLeft(card.offsetLeft, card.offsetWidth, el.clientWidth);
  }, [carousel]);

  const onScroll = () => {
    const el = row.current;
    const first = el?.children.item(0);
    const second = el?.children.item(1);
    if (!el || !(first instanceof HTMLElement) || !(second instanceof HTMLElement)) return;
    setCurrent(nearestCard(el.scrollLeft, second.offsetLeft - first.offsetLeft, count));
  };

  return (
    <>
      <div
        ref={row}
        className={carousel ? "ui-carousel" : undefined}
        onScroll={carousel ? onScroll : undefined}
        style={
          carousel
            ? {
                width: "100%",
                position: "relative",
                display: "grid",
                gridAutoFlow: "column",
                // The whole content box, which the gutters below have already brought down to
                // `CAROUSEL_CARD_SHARE` of the row; a percentage here would shrink it twice.
                gridAutoColumns: "100%",
                gap: 12,
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                // The gutter is what lets the first and the last card be centred like the one
                // between them, and the block padding is room for the chosen card's ring.
                padding: `4px ${carouselGutter()}`,
              }
            : {
                width: "100%",
                maxWidth: 1180,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 20,
              }
        }
      >
        {children}
      </div>
      {carousel ? (
        <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {Array.from({ length: count }, (_, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, never reordered
              key={index}
              style={{
                width: index === current ? 22 : 8,
                height: 8,
                borderRadius: 4,
                background: index === current ? "#156FE7" : "#CBD5E1",
                transition: "width var(--ui-base) var(--ui-ease)",
              }}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

/** Autosaves 500ms after the last change, not on every keystroke's underlying document update. */
const SAVE_DEBOUNCE_MS = 500;

/** One shared empty map, so a variant with no photos does not hand the editor a new object on
 * every render and re-run the preview's `useMemo` for nothing. */
const EMPTY_PHOTOS: ReadonlyMap<string, string> = new Map();
const NO_FONT_URLS: ReadonlyMap<string, string> = new Map();

export function Variants({
  answers,
  initialDocuments,
  initialOpenIndex = null,
  initialPageId,
  initialAccountSite,
  onRestart,
}: {
  answers: Answers;
  /** Present when `Questionnaire` restored a session; absent for a freshly generated one. */
  initialDocuments?: RetorikaDocument[];
  initialOpenIndex?: number | null;
  /** Which page of the open variant was showing, restored from the saved session. */
  initialPageId?: string;
  /**
   * Present when this editor was opened from the account — `/mis-webs/[id]` — rather than from
   * this browser's session. It carries the id and the version the document was read at, so edits
   * push back to the right row and a stale write is still refused (ADR 0034 §8).
   */
  /**
   * The site this editor is editing in the account, when it was opened from there.
   *
   * `ownerId` joined it with ADR 0037: a photograph's object is `<owner>/<site>/<src>`, so fetching
   * one back needs both halves. It is the signed-in person's id, which `OpenFromAccount` has
   * already asked for before it renders this.
   */
  initialAccountSite?: { id: string; version: number; ownerId: string };
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

  /**
   * The account offer, which ADR 0034 §2 puts here and not at the front door.
   *
   * **`savedWhere` only becomes "account" once a save has actually landed**, for the same reason
   * `saveStatus` starts null: the indicator may not claim a guarantee before it has one. And it
   * stays "account" afterwards while `localStorage` keeps running underneath — the browser copy
   * is a cache now, not the truth, and both are true at once, which is why the label names both
   * (§5, §10).
   */
  const [accountOpen, setAccountOpen] = useState(false);
  const [savedWhere, setSavedWhere] = useState<"browser" | "account">(
    initialAccountSite === undefined ? "browser" : "account",
  );
  // Read once rather than per render: it is build-time configuration, not state.
  const [accountAvailable] = useState(() => authConfigured());
  /**
   * The site this editor pushes to, once there is one, with the version it last wrote — and whose
   * it is, which every stored file's path begins with.
   *
   * **`ownerId` became required on 28 October 2026 (sprint 29 día 6)**, and that closed a gap the
   * photographs had had since ADR 0037 day 4: a site saved *from* this session arrived here with
   * no owner, the reconciliation read the owner from `initialAccountSite` — which only a site
   * opened *from* the account has — and so a photograph added after the first save was never
   * uploaded, while the indicator said «Guardado en tu cuenta». The font day needed the same path
   * to work, because the likeliest moment to bring a brand's letter is after the web exists.
   */
  const [accountSite, setAccountSite] = useState<{
    id: string;
    version: number;
    ownerId: string;
  } | null>(initialAccountSite ?? null);
  /**
   * Whether this editor was opened from the account rather than from this browser.
   *
   * **It decides whether `localStorage` is written at all, and that prevents a real loss.** The
   * session key is one per browser, so autosaving a site fetched from the account would overwrite
   * whatever anonymous web was sitting there — the exact mirror of the rule David asked for in
   * the other direction, and a worse version of it, because nobody would have been asked. A site
   * opened from the account has its truth in the account; this browser is not its cache.
   */
  const openedFromAccount = initialAccountSite !== undefined;
  /**
   * The document last pushed, by reference.
   *
   * Documents are immutable here, so identity is the cheapest honest answer to "has this changed
   * since the last push". It also breaks a loop that is otherwise invisible: a successful push
   * sets a new version, which re-runs the effect below, which would push the same document again
   * for ever.
   */
  const pushedDocument = useRef<RetorikaDocument | null>(null);

  /**
   * **These photograph declarations sit here, above the push effect, since ADR 0037 day 4.** They
   * used to live further down with the rest of the photograph machinery, and the reconciliation a
   * push now triggers reads all of them — in a function component the order of declaration is the
   * order of the hooks, so a push effect above them could not see them. The effects that use them
   * stayed where they were: what moved is state, whose relative order among `useState` calls is
   * nothing but stable.
   */
  /**
   * The owner's uploaded photos, as object URLs the preview and the download can both use, keyed
   * by the src the document carries. Held per variant because the three cards are three
   * documents and all three have a section called `sec-cover`.
   */
  const [photoUrls, setPhotoUrls] = useState<Map<number, Map<string, string>>>(new Map());
  const [photoError, setPhotoError] = useState<string | null>(null);
  /**
   * The files of the fonts the owner brought, by the name the renderer mints, with the object URL
   * of their bytes (sprint 29 día 5). **One map for the three cards**, not one per card as the
   * photographs need: a face's name carries its font's random id, so it is one file in the whole
   * browser (`ownFonts.ts` says why).
   */
  const [fontFiles, setFontFiles] = useState<ReadonlyMap<string, FontFileHandle>>(new Map());
  const fontUrls = useMemo(
    () => new Map([...fontFiles].map(([file, handle]) => [file, handle.url])),
    [fontFiles],
  );

  /**
   * The site's id as a primitive, so everything below can depend on it honestly.
   *
   * `initialAccountSite` is an object literal built by the caller on every render, so an effect
   * that listed it would re-run whenever the parent re-rendered — and the mount effect's cleanup
   * revokes object URLs, which would blank every photograph on screen. A string changes when the
   * site changes and not before.
   */
  const accountSiteId = initialAccountSite?.id ?? null;
  /**
   * How many of this site's own photographs are not in the account.
   *
   * `null` until a reconciliation has run, which is not the same as zero: «we have not looked» and
   * «we looked and everything is up there» are different claims, and the indicator may only make
   * the second one after looking. A site with no account has nothing to count and stays `null`.
   */
  const [photosMissing, setPhotosMissing] = useState<number | null>(null);
  /**
   * How many of this site's own fonts are not wholly in the account — by font, not by file — with
   * the same `null` for «not looked yet» (sprint 29 día 6).
   */
  const [fontsMissing, setFontsMissing] = useState<number | null>(null);
  const accountOwnerId = initialAccountSite?.ownerId ?? null;

  /**
   * Which set of stored photographs this editor owns, in IndexedDB.
   *
   * **A site opened from the account is its own scope** (ADR 0037, and `photos.ts` has the long
   * version): `photoSrcFor` names the cover of every site `foto-sec-cover-el-image.jpg`, so a
   * browser holding both an anonymous session and a saved site had one key for two photographs and
   * showed whichever was written last — in the editor and in the ZIP. The scope is what makes them
   * two.
   *
   * A site saved *from* this session keeps the variant scope. Its bytes are already here under that
   * key, nothing has changed about where they came from, and re-keying them would mean reading one
   * scope and writing another for no gain.
   */
  const photoScope = useCallback(
    (variant: number): PhotoScope =>
      accountSiteId === null
        ? { kind: "variant", variant }
        : { kind: "site", siteId: accountSiteId },
    [accountSiteId],
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // See `openedFromAccount`: this browser's single session slot is not this site's to take.
    if (openedFromAccount) return;
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
  }, [answers, histories, openIndex, currentPageId, openedFromAccount]);

  /**
   * Brings the account's photographs in line with the document that was just saved (ADR 0037 §5).
   *
   * **Only ever called from the `result.ok` branch of a push, and that is David's condition rather
   * than a convenience.** A tab holding a document somebody else has already replaced names
   * photographs the winning document may have changed; letting it reconcile would delete the
   * photographs of the version that won. A stale push is refused by the version check, so the one
   * place this is called from is the one place where the document up there is this document.
   *
   * The arithmetic is `photoSyncPlan`, which is pure and tested to the corner. What is here is the
   * three round trips around it and what to do when one of them says no.
   */
  const reconcilePhotos = useCallback(
    async (document: RetorikaDocument, site: { id: string; ownerId: string }) => {
      const client = browserClient();
      const plan = photoSyncPlan({
        wanted: listOwnPhotoSrcs(document),
        remote: (await listPhotoObjects(client, site.ownerId, site.id)).map((path) =>
          path.slice(`${site.ownerId}/${site.id}/`.length),
        ),
        local: [...(photoUrls.get(openIndex ?? 0)?.keys() ?? [])],
        pathFor: (src) => photoObjectPath(site.ownerId, site.id, src),
      });

      let failed = 0;
      for (const src of plan.upload) {
        const url = photoUrls.get(openIndex ?? 0)?.get(src);
        if (!url) {
          failed += 1;
          continue;
        }
        try {
          const blob = await (await fetch(url)).blob();
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const ok = await uploadPhoto(client, photoObjectPath(site.ownerId, site.id, src), bytes);
          if (!ok) failed += 1;
        } catch {
          // A revoked object URL, or the store refusing. Either way nothing was stored.
          failed += 1;
        }
      }

      // Deleting comes last, and a failure to delete is deliberately **not** counted as a
      // photograph missing: the document does not reference it, so an object left behind costs
      // storage and tells the owner nothing. It is picked up by the next reconciliation.
      if (plan.remove.length > 0) await removePhotos(client, plan.remove);

      /**
       * **A refused upload does not make the document unsaved**, and this is where ADR 0037 §6 was
       * written one way and built another — amended there, with the reason, rather than quietly.
       *
       * The ADR said a refused upload moves the indicator to «No guardado». Building it showed that
       * sentence to be false in the other direction: the document *is* in the account, the version
       * was accepted, and only a photograph did not make it. «No guardado» would tell somebody
       * their words were lost when their words are safe. The count is both true and something they
       * can act on, so the count is what the indicator says. ADR 0018's rule is untouched — no tick
       * claims more than it earned — because the tick now comes with «· N fotos sin subir» beside
       * it when that is the case.
       */
      setPhotosMissing(plan.missing.length + failed);
    },
    [photoUrls, openIndex],
  );

  /**
   * The same for the owner's own fonts (sprint 29 día 6), under the same rule: only after a save
   * the database accepted. `reconcileSiteFonts` holds the arithmetic and the reporting, and is
   * tested there; what is here is where the bytes are — the object URLs in `fontFiles`, one map for
   * the whole browser — and what the indicator is told.
   */
  const reconcileFonts = useCallback(
    async (document: RetorikaDocument, site: { id: string; ownerId: string }) => {
      const { short } = await reconcileSiteFonts(
        browserClient(),
        { ownerId: site.ownerId, siteId: site.id },
        document.fonts ?? [],
        [...fontFiles.keys()],
        async (file) => {
          const handle = fontFiles.get(file);
          return handle ? (await fetch(handle.url)).blob() : undefined;
        },
      );
      setFontsMissing(short.length);
    },
    [fontFiles],
  );

  /** Both reconciliations, photographs first, for one accepted save. */
  const reconcileAccount = useCallback(
    async (document: RetorikaDocument, site: { id: string; ownerId: string }) => {
      await reconcilePhotos(document, site);
      await reconcileFonts(document, site);
    },
    [reconcilePhotos, reconcileFonts],
  );

  /**
   * And the same edits to the account, once there is one.
   *
   * **This exists because without it the indicator would lie.** `savedWhere` becomes "account"
   * when the first save lands; every edit after that would have gone only to `localStorage` while
   * the label still read «Guardado en tu cuenta». ADR 0018 set the standard — never a tick it has
   * not earned — and a label that was true once is not the same as a label that is true.
   *
   * A push that comes back stale means somebody wrote since this version was read (ADR 0034 §8).
   * Nothing is overwritten, and **the label drops back to «Guardado en este navegador»**, which is
   * the honest sentence: the browser's copy is current and the account's is not ours to claim.
   */
  useEffect(() => {
    if (!accountSite || openIndex === null) return;
    const document = histories[openIndex]?.present.document;
    if (!document || pushedDocument.current === document) return;

    const timer = setTimeout(() => {
      pushedDocument.current = document;
      void (async () => {
        // `afterAcceptedSave` is the rule, not a convenience: the photographs are reconciled only
        // when the database accepted this version, because a tab that lost the race names
        // photographs the winning document may have replaced. It lives in `photoSync.ts` with a
        // test that asserts exactly that, at David's instruction.
        const result = await afterAcceptedSave(
          () =>
            saveSite(browserClient(), {
              id: accountSite.id,
              version: accountSite.version,
              document,
            }),
          () => reconcileAccount(document, accountSite),
        );
        if (result.ok) {
          setAccountSite({ ...accountSite, version: result.version });
          // When nothing writes to this browser, this push is the only thing that can honestly
          // light the indicator at all.
          if (openedFromAccount) setSaveStatus("saved");
          return;
        }
        // Nothing was overwritten. The label stops claiming the account — and when the account is
        // the only place this site lives, it stops claiming a save altogether.
        setSavedWhere("browser");
        if (openedFromAccount) setSaveStatus("unsaved");
      })();
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [accountSite, histories, openIndex, openedFromAccount, reconcileAccount]);

  /**
   * The design-tools switch (ADR 0025), and the window it is narrowed by.
   *
   * **It is deliberately outside the autosave effect above.** That effect depends on the answers,
   * the histories, the open variant and the page; the switch is none of those, so flipping it does
   * not even reach a save — which is what makes `INV_4` true by construction rather than by
   * vigilance. See `designTools.ts` for the whole argument.
   *
   * Read on mount rather than during render: `localStorage` does not exist while Next renders this
   * on the server, and starting from `false` and correcting on mount is the same shape the restored
   * session already uses. One flash of the switch being off is not a claim about anything.
   */
  const [designTools, setDesignTools] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(MIN_STUDIO_WIDTH);
  /**
   * Whether this browser agreed to remember the switch.
   *
   * **`saveDesignTools` has returned a boolean since sprint 8 and the only caller threw it away.**
   * Its own comment names the contract — «`false` when storage refuses, so a caller can tell the
   * difference between "off" and "we could not remember". Same contract as `saveSession`» — and
   * `saveSession`'s half of that sentence is honoured two effects above, where a refused write moves
   * the tick to «No guardado». This half was not: in a private window, or with site data blocked,
   * the switch went on, the panel said «Se guarda en este navegador», and the next visit had it off
   * with nobody having said a word.
   *
   * Starts `true` because nothing has been refused yet — not because anything has been written. The
   * switch is not saved until it is pressed, and claiming a failure before then would be the
   * mirror image of the mistake.
   *
   * **It only ever latches false, and the walk is what found the reason.** Turning the tools *off*
   * calls `removeItem`, which a browser that refuses `setItem` will happily do — so reading every
   * result would have set this back to `true` on the way down and told the person the preference was
   * safe between two presses that both proved it was not. What is being reported is a property of
   * the browser, not of one write.
   *
   * That is only honest because of where it is drawn: the notice appears when the tools are **on**
   * and this is false, and «off» needs no storage to survive — nothing stored *is* off. So turning
   * them off hides the notice by being true rather than by forgetting.
   */
  const [browserRefused, setBrowserRefused] = useState(false);
  /**
   * And the account's half, kept apart from the browser's.
   *
   * **Not latching, unlike the one above, and the asymmetry has a reason.** The browser flag only
   * ever latches because turning the tools *off* calls `removeItem`, which a browser that refuses
   * `setItem` will happily do — reading every result would have reported the preference safe
   * between two presses that both proved it was not. The account write has no such asymmetry: it is
   * the same `update` in both directions, so a success really does prove the row can be written and
   * is allowed to clear this.
   */
  const [accountRefused, setAccountRefused] = useState(false);

  /**
   * Who the switch belongs to, once there is somebody for it to belong to.
   *
   * `null` while unknown, and that is not the same as «nobody»: until the answer arrives the
   * browser's own preference is what is shown, because it is the only one there is.
   */
  const [switchOwner, setSwitchOwner] = useState<string | null>(null);

  useEffect(() => {
    setDesignTools(loadDesignTools());
    const measure = () => setViewportWidth(window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /**
   * And then the account's preference, which wins when there is one.
   *
   * The dossier puts the switch in the account, «del mismo rango que el idioma de la interfaz», so
   * a professional who turns the tools on at the office has them on at home. The browser value
   * above is what shows until this answers — one flash of the local preference is not a claim
   * about anything, which is the same argument the local read already made for itself.
   *
   * **`null` from the account does not overwrite anything.** It means the question could not be
   * asked, not that the answer was «off»; treating the two alike would wipe a stored preference
   * the first time the network hiccupped.
   */
  useEffect(() => {
    if (!accountAvailable) return;
    const client = browserClient();
    let cancelled = false;

    /**
     * **`readPreference` is the difference between arriving signed in and signing in just now.**
     *
     * On mount the account wins, which is the documented behaviour and what a returning
     * professional expects: the tools they turned on at the office are on at home.
     *
     * A session that begins *while the editor is open* is the other case, and letting the account
     * win there would be a worse bug than the one this fixes. Somebody who turns the tools on and
     * then presses «Guardar en mi cuenta» creates an account whose `design_tools` is the column's
     * `default false` — so reading it back would switch off the tools they are using, a second
     * after they signed up, for no reason they could see.
     */
    const adopt = async (userId: string | null, readPreference: boolean) => {
      setSwitchOwner(userId);
      if (!userId || !readPreference) return;
      const stored = await loadAccountDesignTools(client, userId);
      if (!cancelled && stored !== null) setDesignTools(stored);
    };

    void (async () => {
      const { data } = await client.auth.getUser();
      if (!cancelled) await adopt(data.user?.id ?? null, true);
    })();

    /**
     * **And then every session that starts or ends afterwards, which nothing watched before.**
     *
     * `switchOwner` was asked once, on mount, so a person who signed in from «Guardar en mi cuenta»
     * — the ordinary way an account comes into existence, at the end of the journey — kept a `null`
     * owner until they reloaded. Reproduced on 6 October 2026: after signing up from inside the
     * editor, turning the switch on made **no request to `accounts` at all**, and said nothing
     * about it. The preference silently stopped being «del mismo rango que el idioma de la
     * interfaz» while the panel went on promising it followed them.
     *
     * Signing out is the same gap in reverse, and the same line closes it: the owner becomes
     * `null`, so the editor stops writing to an account nobody is in.
     */
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      // `INITIAL_SESSION` is the subscription announcing what `getUser` above is already asking
      // for, from storage and without checking it. Taking both would race over the same answer.
      if (cancelled || event === "INITIAL_SESSION") return;
      void adopt(session?.user?.id ?? null, false);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [accountAvailable]);

  // What survived the last reload. Put back once, on mount: the documents came from
  // `localStorage`, the bytes from IndexedDB, and only together do they show the site the owner
  // left behind. A store that will not open yields nothing and the covers show the placeholder
  // again, which is the honest fallback — the document still says what it says.
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    void loadPhotos().then((stored) => {
      if (cancelled || stored.length === 0) return;
      /**
       * **Only this editor's own scope**, which is the other half of the collision `photoScope`
       * describes. Reading every record and keying it by a variant number put an anonymous
       * session's cover into a saved site's card, because both are `foto-sec-cover-el-image.jpg`
       * and the old record carried only the variant.
       *
       * So each card asks for its own scope by name. For a session that is `v0`, `v1`, `v2`; for a
       * site opened from the account it is the site's id for all three cards, of which only one
       * is ever open.
       */
      const siteScope =
        accountSiteId === null ? null : scopeKey({ kind: "site", siteId: accountSiteId });
      const variantOf = (scope: string): number | undefined => {
        // A site from the account has one document, shown in one card, so every record of its
        // scope belongs to the card that is open. A session's records name their own card.
        if (siteScope !== null) return scope === siteScope ? (initialOpenIndex ?? 0) : undefined;
        const match = /^v(\d+)$/.exec(scope);
        return match?.[1] === undefined ? undefined : Number(match[1]);
      };

      // Merged into whatever is already there rather than replacing it. The fetch below runs on the
      // same mount and writes into this same map, and two effects that each assumed they were the
      // only writer would race: whichever resolved second would erase the other's URLs.
      setPhotoUrls((current) => {
        const next = new Map(current);
        for (const photo of stored) {
          const variant = variantOf(photo.scope);
          if (variant === undefined) continue;
          const forVariant = new Map(next.get(variant) ?? []);
          if (forVariant.has(photo.src)) continue;
          const url = URL.createObjectURL(photoBlob(photo.bytes));
          created.push(url);
          forVariant.set(photo.src, url);
          next.set(variant, forVariant);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
    // The two primitives above, which are constant for the life of this editor: a session has no
    // site id and never gains one here, and `initialOpenIndex` is a prop. Listing them rather than
    // writing `[]` keeps this honest without re-running — and a re-run would revoke, in its cleanup,
    // the object URLs every photograph on screen is using.
  }, [accountSiteId, initialOpenIndex]);

  /**
   * The files a site opened from the account names, read once: what the opening has to make sure
   * this browser holds (sprint 29 día 6). Captured in a state initialiser rather than read from
   * the props in the effect below, because `OpenFromAccount` hands in a new array on every render
   * and an effect that listed it would re-run — and its cleanup revokes object URLs in use.
   */
  const [accountFontFiles] = useState(() =>
    initialAccountSite === undefined
      ? []
      : siteFontFiles(initialDocuments?.[initialOpenIndex ?? 0]?.fonts ?? []),
  );

  // The owner's own font files, put back once on mount the way the photographs are: every file the
  // browser kept, whichever document names it — a font that an undo brings back must still draw.
  // Merged into what is there, because a font added before this resolves is already in the map.
  //
  // **And for a site opened from the account, what this browser does not hold comes out of the
  // owner's folder in the `fuentes` bucket** (sprint 29 día 6) — the step that makes «abre su web
  // en otro ordenador y la letra de marca está» true. Only after the browser's own store answered,
  // so a file already here is never fetched again; and kept in that store afterwards, so a reload
  // does not ask the account twice. A file that does not arrive is left to the download gate's
  // `fontsMissing`, which blocks and says what to do; a store that will not keep one is not «No
  // guardado», because the bytes are in the account and a reload fetches them again.
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const keep = (files: readonly StoredFontFile[]) => {
      if (cancelled || files.length === 0) return;
      setFontFiles((current) => {
        const next = new Map(current);
        for (const { file, bytes } of files) {
          if (next.has(file)) continue;
          const url = URL.createObjectURL(fontFileBlob(file, bytes));
          created.push(url);
          next.set(file, { url, size: bytes.byteLength });
        }
        return next;
      });
    };
    void (async () => {
      const stored = await loadFontFiles();
      keep(stored);
      if (cancelled || accountSiteId === null || accountOwnerId === null) return;
      const held = new Set(stored.map((entry) => entry.file));
      const wanted = accountFontFiles.filter((file) => !held.has(file));
      if (wanted.length === 0) return;
      const { fetched, failed } = await fetchSiteFonts(
        browserClient(),
        { ownerId: accountOwnerId, siteId: accountSiteId },
        wanted,
      );
      record("fonts", { fetched: fetched.length, failed: failed.length });
      keep(fetched);
      if (fetched.length > 0) await saveFontFiles(fetched);
    })();
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
    // Three values that are constant for the life of this editor, listed for honesty rather than
    // for re-running: a re-run would revoke, in its cleanup, the URLs every face on screen uses.
  }, [accountSiteId, accountOwnerId, accountFontFiles]);

  /**
   * The bank's own photographs, fetched once each and then indistinguishable from an upload.
   *
   * A generated document names the photograph the bank chose but cannot carry its bytes —
   * `generateVariants` runs in the browser and cannot read a file. So the bytes are fetched from
   * `/api/muestras/<id>` and written into the same IndexedDB store, the same object URL map and
   * therefore the same multipart form the download already builds. Nothing downstream learns that
   * bank photographs exist.
   *
   * `fetched` is a ref, not state, and it is what keeps this from looping: the effect writes
   * `photoUrls`, so reading `photoUrls` to decide what is missing would re-run it on its own
   * output. Keyed by `variant:src` for the same reason the store is — the three cards are three
   * documents and all three have a `sec-cover`.
   *
   * A failed fetch is left alone rather than retried or reported. The cover falls back to the grey
   * marker the document would have carried anyway, which is the honest outcome and not one the
   * owner needs a message about; and the ref keeps the failure from being asked again every render.
   * What must never happen is a photograph appearing in the preview that is not in the ZIP, and
   * that cannot happen here: both read this one map.
   *
   * **No cleanup revokes what this creates**, unlike the mount effect above, and the difference is
   * the dependency list. That one runs once, so revoking on unmount is right; this one re-runs on
   * every edit, and a cleanup would revoke object URLs that are still the src of a photograph on
   * screen — the images would go blank on the next keystroke. These URLs live as long as the page,
   * which is exactly what `handlePickPhoto` already does with an upload's.
   *
   * **One `setPhotoUrls` per card, not one per photograph — since 12 October 2026 (ADR 0039).**
   * The preview's `srcDoc` depends on `photoUrls`, so every write here replaces the document the
   * owner is looking at. With one photograph per site that was one replacement; a generated
   * restaurante site now names five, and five replacements in a row is exactly the mechanism
   * `docs/tasks/backlog.md` has suspected since sprint 7 of eating a click or a keystroke — and
   * the day the gallery landed, twenty `e2e` walks lost the keyboard or the document between the
   * cover's arrival and the fourth gallery photograph's. So a card's photographs are fetched
   * together, written together, and the document is replaced once. A failure stays per
   * photograph: the four that arrived are written, the one that did not is reported.
   */
  const fetched = useRef(new Set<string>());
  /**
   * Bank photographs whose fetch failed, by the `src` the document carries.
   *
   * **Two silent `continue`s used to live here**, and between them they made a site permanently
   * undownloadable: the photograph never arrived, the marker below stood so nothing retried, the
   * preview showed a broken image, `/api/download` refused with «which was not sent», and the
   * editor said «Vuelve a intentarlo» — which produced the same 400 every time. Reported now, so
   * the gate can block with something the owner can actually do (`downloadGate.ts`).
   */
  const [failedSamples, setFailedSamples] = useState<string[]>([]);
  /**
   * Bumped by «Volver a cargar las fotos», and **part of the fetch key below**, which is what
   * makes a retry a retry.
   *
   * The marker has to stand on failure — the note further down is right that re-asking on every
   * render would be a request loop over a photograph that is not coming. So the retry has to
   * invalidate markers, and folding the attempt number into the key does that **without any
   * bookkeeping**: on attempt 1 every key is new, so nothing is marked and everything is asked
   * again.
   *
   * The first version kept a separate counter and deleted the markers of the photographs that had
   * failed, which is tidier in principle and worse in practice: the counter appeared in the
   * dependency list without appearing in the body, so it read as a needless dependency to anything
   * that checks — Biome said so — and a reader would have had to work out that it was load-bearing.
   * **The price of this version is that an explicit retry re-asks for the photographs that already
   * arrived too.** They are a handful, it only happens when somebody presses the button, and the
   * alternative was a dependency nobody could see the point of.
   */
  const [sampleAttempt, setSampleAttempt] = useState(0);

  const retrySamples = useCallback(() => {
    setFailedSamples([]);
    setSampleAttempt((attempt) => attempt + 1);
  }, []);

  /** Our bytes, by bank id. `null` for any answer that is not a photograph, which the caller
   * turns into the blocking gate rather than a broken image. */
  const bankBytes = useCallback(async (id: string): Promise<Uint8Array | null> => {
    const response = await fetch(`/api/muestras/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  }, []);

  /**
   * The owner's bytes, out of their own folder in the account's bucket (ADR 0037).
   *
   * `null` covers three different things on purpose, because the owner can act on all three the
   * same way: the object is not there (a site saved before the photographs travelled), the
   * policies refused, or what came back is not an image — `downloadPhoto` sniffs before anything
   * makes an `<img>` of it.
   */
  const accountBytes = useCallback(
    async (src: string): Promise<Uint8Array | null> => {
      // Two primitives rather than the prop object, so the effect that lists this callback does
      // not re-run every time the parent re-renders — and its cleanup would strand photographs.
      if (accountSiteId === null || accountOwnerId === null) return null;
      return downloadPhoto(browserClient(), photoObjectPath(accountOwnerId, accountSiteId, src));
    },
    [accountSiteId, accountOwnerId],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      for (const [variant, history] of histories.entries()) {
        // Checked here and nowhere else: `cancelled` stops this run from *starting* more work,
        // and never stops it from finishing what it already started. See the note below.
        if (cancelled) return;

        /**
         * **Two sources since ADR 0037, and the document says which.** A bank photograph comes
         * from `/api/muestras/<id>`, as it has since sprint 6. The owner's own comes from their
         * folder in the account's bucket, and only for a site that is in the account — for one
         * living in this browser those bytes are already here.
         *
         * A site from the account can need both at once: one saved before its owner replaced the
         * cover still names the bank photograph the generator chose, and that stays ours.
         */
        const wanted = photoSources(history.present.document, {
          fromAccount: accountSiteId !== null,
        }).filter((source) => {
          // The attempt number is part of the key, so «Volver a cargar las fotos» invalidates every
          // marker at once. See `sampleAttempt`.
          const key = `${sampleAttempt}:${variant}:${source.src}`;
          if (fetched.current.has(key)) return false;
          // Marked before the await, so two overlapping runs cannot both fetch the same photograph.
          fetched.current.add(key);
          return true;
        });
        if (wanted.length === 0) continue;

        const arrived = await Promise.all(
          wanted.map(async (source) => {
            try {
              const bytes =
                source.kind === "bank"
                  ? await bankBytes(source.id)
                  : await accountBytes(source.src);
              // A failure stays marked: the source answered and said no, and asking again on
              // every render would be a request loop over a photograph that is not coming.
              return bytes ? { source, bytes } : { source, bytes: null };
            } catch {
              // Offline, or the source is not there. The marker stands in; see the note above —
              // and this half was the other silent `continue`.
              return { source, bytes: null };
            }
          }),
        );

        const failed = arrived.filter((photo) => photo.bytes === null).map((p) => p.source.src);
        if (failed.length > 0) {
          setFailedSamples((current) => [
            ...current,
            ...failed.filter((src) => !current.includes(src)),
          ]);
        }

        // **An in-flight fetch always writes its result, even after this run was cancelled**,
        // and that is the fix for the defect the browser walk found. The first version dropped
        // the result on cancellation; combined with the ref, that permanently stranded the
        // photograph — the second run skipped it as already fetched, and the first run threw
        // its bytes away. React's development double-mount is exactly such a cancellation, and
        // the first variant is the one fetched first, so it was the one in flight when the
        // cleanup ran: two cards loaded, the first stayed broken, every single time.
        //
        // Writing anyway is safe because "cancelled" here does not mean unmounted — in the
        // double-mount it is the same live component — and a `setState` on a genuinely
        // unmounted one is a no-op in React 19, not a warning.
        // The content type is the source's: the bank stores WebP and an owner's photograph is
        // always the JPEG `preparePhoto` re-encoded. Neither is guessed from the name.
        const landed = arrived.flatMap((photo) =>
          photo.bytes === null
            ? []
            : [
                {
                  src: photo.source.src,
                  bytes: photo.bytes,
                  url: URL.createObjectURL(
                    photoBlob(
                      photo.bytes,
                      photo.source.kind === "bank" ? "image/webp" : PHOTO_CONTENT_TYPE,
                    ),
                  ),
                },
              ],
        );
        record("photos", { variant, landed: landed.length, failed: failed.length });
        if (landed.length === 0) continue;
        setPhotoUrls((current) => {
          const next = new Map(current);
          const forVariant = new Map(next.get(variant) ?? []);
          for (const photo of landed) forVariant.set(photo.src, photo.url);
          next.set(variant, forVariant);
          return next;
        });
        // Stored so a reload puts it back without asking the server again — and so that a
        // session that goes offline still downloads a complete site. Under this editor's own
        // scope, which for a site from the account is the site and not the card.
        for (const photo of landed) {
          if (!(await savePhoto(photoScope(variant), photo.src, photo.bytes))) {
            setSaveStatus("unsaved");
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [histories, sampleAttempt, accountSiteId, photoScope, bankBytes, accountBytes]);

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
    // Under this editor's own scope: a site from the account keeps its photographs apart from any
    // anonymous session in the same browser, which is the collision `photoScope` describes.
    if (!(await savePhoto(photoScope(variant), src, result.photo.bytes))) {
      setSaveStatus("unsaved");
    }
  }

  /**
   * «Añadir» in the import dialog: the files get object URLs at once, so the preview draws the new
   * letter in the same render that chooses it; the record and the stack go into the document as one
   * step; and the bytes go to the browser's store, which says «No guardado» if it will not take them
   * — the font is in the web either way, and the owner is told it will not survive a reload.
   */
  async function handleAddOwnFont(
    variant: number,
    key: "font.heading" | "font.body",
    font: OwnFont,
    files: readonly StoredFontFile[],
  ) {
    const theme = histories[variant]?.present.document.theme;
    if (!theme) return;
    setFontFiles((current) => {
      const next = new Map(current);
      for (const { file, bytes } of files) {
        const previous = next.get(file);
        if (previous) URL.revokeObjectURL(previous.url);
        next.set(file, {
          url: URL.createObjectURL(fontFileBlob(file, bytes)),
          size: bytes.byteLength,
        });
      }
      return next;
    });
    dispatch({ type: "addOwnFont", variant, font, theme: withOwnFont(theme, key, font) });
    // «Si recargas la página, tendrás que subirla otra vez» is true only of a web that lives in this
    // browser. One in the account sends the bytes held in memory on its next accepted save, and a
    // reload fetches them back (sprint 29 día 6); if that upload fails, the indicator counts the
    // font as «sin subir», which is the sentence that is true then.
    if (!(await saveFontFiles(files)) && accountSite === null) {
      setSaveStatus("unsaved");
      setPhotoError(es["editor.font.import.notSaved"]);
    }
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
    // Minted, not assumed free: a generated site of a sector with photographs already carries
    // `sec-gallery` (ADR 0039), and `insertSection` refuses a taken id. Found on 12 October 2026
    // by the generator's own tests, before any owner could — until then no generated section
    // shared an id with one the pill offers, so `sec-${catalogId}` happened to be free every time.
    const section = blankSection(
      catalogId,
      variantForInsertion(doc, catalogId),
      mintSectionId(doc, `sec-${catalogId}`),
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
        // The rule this used to encode by hand as `catalogId !== TEASER_ID`: whether the pill can
        // build one *at all*. `canBeBlank` is the catalog's own answer — it already refuses
        // «Avance», whose one slot is a destination no marker fills honestly, and it would refuse
        // any future section shaped the same way without this file needing to learn its id. The
        // ninth section, «Equipo», is offered because it asks nothing of `canBeBlank` this file
        // does not already grant to «Opiniones» and «Fotos de trabajos».
        //
        // «Contacto y reservas» is the one exception, in the other direction: `canBeBlank` is
        // correctly false for it — its button is a destination — but it is still offered whenever
        // question 5 gave it one to build with, from `contactSectionFor` rather than a marker.
        .filter((catalogId) => canBeBlank(catalogId) || catalogId === CONTACT_ID)
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

    // **The page the canvas is drawing**, which is this component's business: it is where
    // `openIndex` and `currentPageId` already live, and keeping it here is what lets the component
    // that draws the pill stay ignorant of pages entirely. `currentPageId` is `undefined` while the
    // canvas shows the first page — the same "unset means the first one" the renderer uses — so it
    // resolves to that page's id here rather than letting the reducer guess, which is the guess
    // that put a converted page's sections on the home page for a whole sprint.
    const pageId = currentPageId ?? history.present.document.pages[0]?.id;
    // Unreachable: `documentSchema` requires at least one page. Named rather than silently
    // defaulted, because the alternative to a throw here is inserting into nowhere.
    if (!pageId) throw new Error("handleInsertSection: the document has no page to insert into");
    dispatch({ type: "insertSection", variant, section, index, pageId });
  }

  function handleDeleteSection(variant: number, history: History, sectionId: string) {
    const found = findSection(history.present.document, sectionId);
    const persistent = wasSectionEverEdited(history, sectionId);
    // Counted before the delete, because afterwards the section is gone and the buttons that
    // named it are simply dead — `/api/download` would say so, but only once the person tried to
    // download. The moment worth telling them about is this one, while "Deshacer" is on screen.
    const brokenAnchors = listAnchorsTo(history.present.document, sectionId).length;
    // Where the hole goes, read before the delete for the same reason the anchors are counted
    // before it: afterwards the section is not there to ask. See `DeleteToast`.
    const pageId = found?.page.id;
    const index = found?.page.sections.findIndex((candidate) => candidate.id === sectionId) ?? -1;
    dispatch({ type: "deleteSection", variant, sectionId });

    clearTimeout(toastTimer.current);
    setToast({
      sectionName: found ? catalogSectionName(found.section.preset.catalogId) : sectionId,
      persistent,
      brokenAnchors,
      // `findSection` answers `undefined` for an id the document does not hold, which cannot happen
      // from the canvas — every id came from a section it had just drawn — and the fallbacks keep
      // the toast itself working rather than letting a notice take the undo down with it. An empty
      // `pageId` matches no page, so no hole is drawn, which is the right failure.
      pageId: pageId ?? "",
      index,
    });
    if (!persistent) toastTimer.current = setTimeout(dismissToast, TOAST_DURATION_MS);
  }

  if (openIndex !== null) {
    const history = histories[openIndex];
    const caption = CAPTIONS[openIndex];
    if (!history || !caption) return null;
    return (
      <>
        <Editor
          title={es[caption.titleKey]}
          document={history.present.document}
          onEditText={(address, text, marks) => {
            // Any of these makes "Deshacer" on a showing toast undo the wrong thing — the most
            // recent action, not the delete the toast still names — so the toast stops being
            // accurate the moment something else lands on top of it.
            dismissToast();
            // Spread rather than `marks` outright: `exactOptionalPropertyTypes` makes a present-but-
            // undefined key a different thing from an absent one, and "absent" is what means «derive
            // them by diff» all the way down to `withText`.
            dispatch({
              type: "editText",
              variant: openIndex,
              address,
              text,
              ...(marks === undefined ? {} : { marks }),
            });
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
          onSetSectionInMenu={(sectionId, inMenu) => {
            dismissToast();
            dispatch({ type: "setSectionInMenu", variant: openIndex, sectionId, inMenu });
          }}
          onSetPageInMenu={(pageId, inMenu) => {
            dismissToast();
            dispatch({ type: "setPageInMenu", variant: openIndex, pageId, inMenu });
          }}
          onSetSiteDescription={(text) => {
            dismissToast();
            dispatch({ type: "setSiteDescription", variant: openIndex, text });
          }}
          onSetSiteUrl={(url) => {
            dismissToast();
            dispatch({ type: "setSiteUrl", variant: openIndex, url });
          }}
          onSetVariant={(sectionId, variantId) => {
            dismissToast();
            dispatch({ type: "setVariant", variant: openIndex, sectionId, variantId });
          }}
          designTools={designToolsFor(designTools, viewportWidth)}
          onDesignToolsChange={(on) => {
            // The stored value and the state, and nothing else. No `dismissToast`: turning the tools
            // on is not an edit, and a delete's toast has six seconds that belong to the delete.
            setDesignTools(on);
            // **The answer is read, and only a refusal is recorded.** The switch still works for this
            // session either way — the state above is what the editor obeys — so a refusal costs the
            // person nothing now and everything on the next visit, which is what the notice says.
            // See `toolsRemembered` for why a success does not clear it.
            if (!saveDesignTools(on)) setBrowserRefused(true);
            // And to the account, when there is one, because that is where the dossier puts it —
            // «del mismo rango que el idioma de la interfaz», so it follows the person between
            // machines. Written *as well as* locally rather than instead: the browser copy is what
            // answers instantly on the next visit while the account is still being asked.
            if (switchOwner) {
              void saveAccountDesignTools(browserClient(), switchOwner, on).then((ok) => {
                setAccountRefused(!ok);
              });
            }
          }}
          switchNotice={switchNotice(browserRefused, accountRefused)}
          onEscalateSection={(sectionId, boxes) => {
            dismissToast();
            // The boxes the canvas measured the instant before the press (ADR 0050 §3): this
            // component never measures anything itself, it only carries what the canvas read.
            dispatch({ type: "escalateSection", variant: openIndex, sectionId, boxes });
          }}
          // Read from the history rather than from the document, which cannot answer it since
          // escalation started measuring the page (ADR 0050, día 2).
          placementWasMoved={(sectionId) => wasPlacementEverMoved(history, sectionId)}
          onRevertSection={(sectionId, decisions) => {
            dismissToast();
            dispatch({
              type: "revertSection",
              variant: openIndex,
              sectionId,
              ...(decisions === undefined ? {} : { decisions }),
            });
          }}
          onSetPlacement={(sectionId, elementId, edit) => {
            dismissToast();
            dispatch({ type: "setPlacement", variant: openIndex, sectionId, elementId, edit });
          }}
          onSetMobilePatch={(sectionId, elementId, edit) => {
            dismissToast();
            dispatch({ type: "setMobilePatch", variant: openIndex, sectionId, elementId, edit });
          }}
          onMoveUpOnMobile={(sectionId, elementId) => {
            dismissToast();
            dispatch({ type: "moveUpOnMobile", variant: openIndex, sectionId, elementId });
          }}
          onAddItem={(sectionId, slot, item) => {
            dismissToast();
            dispatch({ type: "addItem", variant: openIndex, sectionId, slot, item });
          }}
          onRemoveItem={(sectionId, slot, itemId) => {
            dismissToast();
            dispatch({ type: "removeItem", variant: openIndex, sectionId, slot, itemId });
          }}
          onMoveItem={(sectionId, slot, itemId, toIndex) => {
            dismissToast();
            dispatch({ type: "moveItem", variant: openIndex, sectionId, slot, itemId, toIndex });
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
          // One letter from the gallery (ADR 0046), chosen inside the chooser (sprint 29 día 1).
          // `withFamily` writes **one** font token and leaves the other, which is what lets an
          // owner set the headings without the product deciding the text for them. It travels
          // through `chooseFamily` rather than `setTheme` because a chooser session is one step:
          // forty rows under an arrow key amend the step they opened, «Hecho» settles it and Escape
          // discards it — the three verbs below, on the open document only.
          onPickFamily={(key, family) => {
            dismissToast();
            dispatch({
              type: "chooseFamily",
              variant: openIndex,
              key,
              theme: withFamily(history.present.document.theme, key, family),
            });
          }}
          onSettleChooser={() => dispatch({ type: "settleChooser", variant: openIndex })}
          onDiscardChooser={() => dispatch({ type: "discardChooser", variant: openIndex })}
          // The owner's own fonts (sprint 29 día 5): choosing one is the chooser's own session step,
          // like a gallery row; adding and removing are steps of their own.
          onPickOwnFont={(key, font) => {
            dismissToast();
            dispatch({
              type: "chooseFamily",
              variant: openIndex,
              key,
              theme: withOwnFont(history.present.document.theme, key, font),
            });
          }}
          onAddOwnFont={(key, font, files) => {
            dismissToast();
            void handleAddOwnFont(openIndex, key, font, files);
          }}
          onRemoveOwnFont={(fontId) => {
            dismissToast();
            dispatch({ type: "removeOwnFont", variant: openIndex, fontId });
          }}
          // The third choice of the Estilo panel, and the only one the panel hides until the design
          // tools are on — the "Encendido" column of the advanced dossier §4 begins «Añade **el
          // sistema**». It travels through `setTheme` like the other two, so it gets undo, redo and
          // autosave for nothing, and it writes to the open document only.
          onPickScale={(scaleId) => {
            dismissToast();
            dispatch({
              type: "setTheme",
              variant: openIndex,
              theme: withScale(history.present.document.theme, scaleId),
            });
          }}
          // Rule 6, from the floating toolbar. Unlike the three above it writes one element rather
          // than the whole theme, so it goes through its own action — and it needs no design tools:
          // a reference is what everybody gets (advanced dossier §4, "Apagado").
          onSetElementStyle={(address, property, value) => {
            dismissToast();
            dispatch({ type: "setElementStyle", variant: openIndex, address, property, value });
          }}
          // ADR 0024's bold and italic, from the same bar. Unlike the style write above this **is**
          // a content cause — `strong` and `em` were chosen because they mean emphasis and a screen
          // reader conveys them, so a mark changes what the section says.
          onSetMark={(address, range, mark, on) => {
            dismissToast();
            dispatch({ type: "setMark", variant: openIndex, address, range, mark, on });
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
          onAddEntry={(collectionId, fields) => {
            dismissToast();
            dispatch({ type: "addEntry", variant: openIndex, collectionId, fields });
          }}
          onCollectionFromList={(sectionId, slot, name) => {
            dismissToast();
            dispatch({ type: "collectionFromList", variant: openIndex, sectionId, slot, name });
          }}
          // Like converting, this leaves the canvas where it is: a new tab appears, which is the
          // visible proof, and «Ver sus páginas» in the panel is the way over.
          onAddEntryPage={(collectionId, titleField, title) => {
            dismissToast();
            dispatch({ type: "addEntryPage", variant: openIndex, collectionId, titleField, title });
          }}
          onBindList={(sectionId, slot, collectionId) => {
            dismissToast();
            dispatch({ type: "bindList", variant: openIndex, sectionId, slot, collectionId });
          }}
          onUnbindList={(sectionId, slot) => {
            dismissToast();
            dispatch({ type: "unbindList", variant: openIndex, sectionId, slot });
          }}
          onRenameCollection={(collectionId, name) => {
            dismissToast();
            dispatch({ type: "renameCollection", variant: openIndex, collectionId, name });
          }}
          onDeleteCollection={(collectionId) => {
            dismissToast();
            dispatch({ type: "deleteCollection", variant: openIndex, collectionId });
          }}
          onSetEntryField={(collectionId, entryId, field, value) => {
            dismissToast();
            dispatch({
              type: "setEntryField",
              variant: openIndex,
              collectionId,
              entryId,
              field,
              value,
            });
          }}
          onRemoveEntry={(collectionId, entryId) => {
            dismissToast();
            dispatch({ type: "removeEntry", variant: openIndex, collectionId, entryId });
          }}
          onMoveEntry={(collectionId, entryId, toIndex) => {
            dismissToast();
            dispatch({ type: "moveEntry", variant: openIndex, collectionId, entryId, toIndex });
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
          // The canvas follows the sections. Converting deliberately stays put — the avance appears
          // where the section was, which is the proof it worked — but folding removes the page the
          // canvas may be showing, and `currentPageId`'s fallback to the first page is only the
          // right destination when the avance was on the first page. `foldsInto` says where they
          // actually land, which for a page converted out of another page is not the first one.
          onPageToSection={(id) => {
            dismissToast();
            const into = foldsInto(history.present.document, id);
            dispatch({ type: "pageToSection", variant: openIndex, pageId: id });
            setPageId(into === history.present.document.pages[0]?.id ? undefined : into);
          }}
          photoUrls={photoUrls.get(openIndex) ?? EMPTY_PHOTOS}
          fontFiles={fontFiles}
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
          failedSamples={failedSamples}
          onRetrySamples={retrySamples}
          savedWhere={savedWhere}
          photosMissing={photosMissing}
          fontsMissing={fontsMissing}
          fontsFromAccount={openedFromAccount}
          onSaveToAccount={accountAvailable ? () => setAccountOpen(true) : undefined}
          toast={toast}
          onDismissToast={dismissToast}
          onBack={() => {
            dismissToast();
            setOpenIndex(null);
          }}
        />
        {accountOpen ? (
          <SaveToAccountDialog
            // The web that is open, which is what the dialog says it saves. The editor holds three
            // variants; a saved site is one document (ADR 0034 §6), and the other two stay in this
            // browser as the alternatives they always were.
            document={history.present.document}
            // The same map the preview is drawing from, for the same card. ADR 0037: what the owner
            // can see is what gets stored, so there is no second source that could disagree — and
            // the bytes behind these URLs are `preparePhoto`'s, which carry no EXIF and no GPS.
            photoUrls={photoUrls.get(openIndex) ?? EMPTY_PHOTOS}
            configured={accountAvailable}
            onSaved={(site) => {
              // The document just stored is, by definition, the one already pushed.
              pushedDocument.current = history.present.document;
              setAccountSite(site);
              setSavedWhere("account");
              // And its files, now that it has a folder. The insert is a save the database
              // accepted by definition, so this is the rule's own moment: the photographs the
              // dialog already sent are found there and left alone, and the owner's fonts — which
              // the dialog does not send — go up here, the same way every later save sends them.
              void reconcileAccount(history.present.document, site);
            }}
            onClose={() => setAccountOpen(false)}
          />
        ) : null}
      </>
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
          // Fluid, like `Shell`'s: a flat 40px each side left a 390px phone 310 for three cards.
          padding: "0 clamp(16px, 6vw, 40px) 40px",
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
              fontSize: "clamp(24px, 6.5vw, 32px)",
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#0F172A",
              textAlign: "center",
            }}
          >
            {es["variants.title"]}
          </h1>
          {/* `#5B6B82` on the page's grey (5.06:1) where `#64748B` measured 4.43 — found by the
              first axe run this screen ever had, sprint 21 day 5. The captions inside the white
              cards keep `#64748B`: on white it is 4.76. */}
          <p style={{ margin: 0, fontSize: 16, color: "#5B6B82", textAlign: "center" }}>
            {/* Two sentences because the screen shows two different things, and saying either one
                of them for both cases is a claim the cards disprove. Measured on 8 October 2026:
                a generated site carries exactly one photograph, on the cover, and the other four
                sections carry none — so a sector with a bank has every slot filled by a sample and
                a sector without has every slot empty. There is no mixed case to word around. */}
            {answers.sector !== null && hasSamplePhotos(answers.sector)
              ? es["variants.subtitle.sample"]
              : es["variants.subtitle"]}
          </p>
        </div>

        <ProposalsRow count={histories.length}>
          {histories.map((history, index) => {
            const caption = CAPTIONS[index];
            if (!caption) return null;
            const highlighted = index === 1;
            // Through `withPhotoUrls`, like the editor's own preview. Without it the bank's
            // photographs keep their bundle-relative name here, which an `iframe srcDoc` resolves
            // against this page's URL — so the one screen whose entire job is to show three
            // attractive compositions showed three broken images. Found in the browser on the day
            // the generator first asked the bank; nothing before then had a photograph to break.
            const html = withFontUrls(
              render(
                withPhotoUrls(history.present.document, photoUrls.get(index) ?? EMPTY_PHOTOS),
                "html",
              ).html,
              fontUrls.size === 0 ? NO_FONT_URLS : fontUrls,
            );
            return (
              <div
                // By position: the three variants are a fixed list that never reorders, and
                // all three carry the same document id, so that would not distinguish them.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, never reordered
                key={index}
                /**
                 * **The three arrive one after the other, and the chosen one says so once.**
                 *
                 * The dossier calls this «la pantalla más importante del producto: aquí es donde
                 * el usuario decide si sigue o se va a Canva», so the order they arrive in is the
                 * order they should be read in — left to right, 40ms apart, the last at rest
                 * inside 340ms. That is far enough under the 2000ms the mockup-06 guard allows
                 * between the fifth answer and three built sites that nothing here can turn the
                 * «nothing to wait for» claim into a wait.
                 *
                 * `ui-reveal` fills `backwards`, so a landed card owns nothing and `ui-lift` can
                 * still move it — the defect that rule exists to prevent, on exactly these cards.
                 */
                className={`ui-reveal ui-interactive ui-lift${highlighted ? " ui-ring-once" : ""}`}
                style={{
                  ...reveal(index),
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 14,
                  minWidth: 0,
                  scrollSnapAlign: "center",
                  background: "var(--ui-surface)",
                  border: highlighted ? "2px solid var(--ui-brand)" : "1px solid #E5E9F0",
                  boxShadow: highlighted ? "0 0 0 3px #E8F1FE" : undefined,
                  borderRadius: 14,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ui-ink)" }}>
                    {es[caption.titleKey]}
                  </span>
                  {highlighted ? (
                    <span
                      style={{
                        padding: "3px 9px",
                        background: "var(--ui-brand-surface)",
                        // The palette's secondary (ADR 0041 §3): the brand blue on this tint is
                        // 4.14:1 at 11px, the secondary 5.79. Same first axe run, same day — and
                        // a token rather than a hex since sprint 22 day 1.
                        color: "var(--ui-brand-deep)",
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
                  className="ui-interactive"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--ui-brand-deep)",
                    background: "none",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {es["variants.viewFull"]}{" "}
                  {/* The arrow leans out a couple of pixels while the card is under the pointer —
                      the smallest way to say «this opens something». It is inside the card and
                      inside no `overflow: hidden`, so two pixels of travel are invisible to the
                      walk that measures where boxes are. */}
                  <span className="ui-slide ui-arrow" aria-hidden="true">
                    →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  className="ui-interactive ui-lift"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 46,
                    padding: "10px 12px",
                    background: highlighted ? "var(--ui-brand)" : "var(--ui-surface)",
                    color: highlighted ? "var(--ui-surface)" : "#334155",
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
        </ProposalsRow>

        <button
          type="button"
          onClick={() => {
            // Day 3 of sprint 2 settled that starting over really starts over. The bytes live
            // somewhere `clearSession` cannot reach, so they are cleared here as well.
            void clearPhotos();
            void clearFontFiles();
            onRestart();
          }}
          className="ui-interactive"
          style={{
            font: "inherit",
            fontSize: 14,
            fontWeight: 600,
            // Secondary blue on the page's grey, 6.14:1; the brand blue measured 4.39 here.
            color: "var(--ui-brand-deep)",
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
