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
import { render } from "@retorika/renderer";
import {
  type ElementAddress,
  findSection,
  foldsInto,
  listAnchorsTo,
  type RetorikaDocument,
  type Section,
} from "@retorika/schema";
import { withPalette, withScale, withTypePair } from "@retorika/tokens";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
} from "../editor/designTools.ts";
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
import { withPhotoUrls } from "../editor/previewDocument.ts";
import { listSampleRefs } from "../editor/samplePhotos.ts";
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
  initialAccountSite?: { id: string; version: number };
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
  /** The site this editor pushes to, once there is one, with the version it last wrote. */
  const [accountSite, setAccountSite] = useState<{ id: string; version: number } | null>(
    initialAccountSite ?? null,
  );
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
        const result = await saveSite(browserClient(), {
          id: accountSite.id,
          version: accountSite.version,
          document,
        });
        if (result.ok) {
          setAccountSite({ id: accountSite.id, version: result.version });
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
  }, [accountSite, histories, openIndex, openedFromAccount]);

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
  const [toolsRemembered, setToolsRemembered] = useState(true);

  useEffect(() => {
    setDesignTools(loadDesignTools());
    const measure = () => setViewportWidth(window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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
      // Merged into whatever is already there rather than replacing it. The bank fetch below runs
      // on the same mount and writes into this same map, and two effects that each assumed they
      // were the only writer would race: whichever resolved second would erase the other's URLs.
      setPhotoUrls((current) => {
        const next = new Map(current);
        for (const photo of stored) {
          const forVariant = new Map(next.get(photo.variant) ?? []);
          if (forVariant.has(photo.src)) continue;
          const url = URL.createObjectURL(photoBlob(photo.bytes));
          created.push(url);
          forVariant.set(photo.src, url);
          next.set(photo.variant, forVariant);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, []);

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
   */
  const fetched = useRef(new Set<string>());
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      for (const [variant, history] of histories.entries()) {
        for (const ref of listSampleRefs(history.present.document)) {
          // Checked here and nowhere else: `cancelled` stops this run from *starting* more work,
          // and never stops it from finishing what it already started. See the note below.
          if (cancelled) return;

          const key = `${variant}:${ref.src}`;
          if (fetched.current.has(key)) continue;
          // Marked before the await, so two overlapping runs cannot both fetch the same photograph.
          fetched.current.add(key);

          try {
            const response = await fetch(`/api/muestras/${encodeURIComponent(ref.id)}`);
            // A failure stays marked: the route answered and said no, and asking again on every
            // render would be a request loop over a photograph that is not coming.
            if (!response.ok) continue;
            const bytes = new Uint8Array(await response.arrayBuffer());

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
            const url = URL.createObjectURL(photoBlob(bytes, "image/webp"));
            setPhotoUrls((current) => {
              const next = new Map(current);
              const forVariant = new Map(next.get(variant) ?? []);
              forVariant.set(ref.src, url);
              next.set(variant, forVariant);
              return next;
            });
            // Stored so a reload puts it back without asking the server again — and so that a
            // session that goes offline still downloads a complete site.
            if (!(await savePhoto(variant, ref.src, bytes))) setSaveStatus("unsaved");
          } catch {
            // Offline, or the route is not there. The marker stands in; see the note above.
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [histories]);

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
            if (!saveDesignTools(on)) setToolsRemembered(false);
          }}
          toolsRemembered={toolsRemembered}
          onEscalateSection={(sectionId) => {
            dismissToast();
            dispatch({ type: "escalateSection", variant: openIndex, sectionId });
          }}
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
          savedWhere={savedWhere}
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
            configured={accountAvailable}
            onSaved={(site) => {
              // The document just stored is, by definition, the one already pushed.
              pushedDocument.current = history.present.document;
              setAccountSite(site);
              setSavedWhere("account");
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
            // Through `withPhotoUrls`, like the editor's own preview. Without it the bank's
            // photographs keep their bundle-relative name here, which an `iframe srcDoc` resolves
            // against this page's URL — so the one screen whose entire job is to show three
            // attractive compositions showed three broken images. Found in the browser on the day
            // the generator first asked the bank; nothing before then had a photograph to break.
            const html = render(
              withPhotoUrls(history.present.document, photoUrls.get(index) ?? EMPTY_PHOTOS),
              "html",
            ).html;
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
