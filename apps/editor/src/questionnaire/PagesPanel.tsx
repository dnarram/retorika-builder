"use client";

import { type Collection, MAX_PAGES, type RetorikaDocument } from "@retorika/schema";
import { useEffect, useId, useRef, useState } from "react";
import { type MenuState, menuNoteText, pagesLeftText } from "../editor/menuState.ts";
import { PANEL_WIDTH, PanelClose, panelCard, panelRow, SmallButton } from "../editor/panelKit.tsx";
import es from "../locales/es.json" with { type: "json" };

/**
 * «Páginas» — the rail's third item, and the advanced module's «Páginas y conversión de secciones».
 *
 * It renames, reorders, deletes, and undoes a conversion. **It does not create**, and that is the
 * decision rather than an omission: ADR 0022 says a page is born by converting a section, so the
 * verb that makes one lives on the section, in the canvas, where the owner can see what is about to
 * move. A `+` here would be the «+ Añadir página» the dossier rules out, and it would make the one
 * thing this product has no answer for — an empty page.
 *
 * **Undoing that conversion belongs here rather than in the canvas**, which is the asymmetry the
 * two directions genuinely have. Converting starts from a section you are looking at; folding
 * starts from a page, and the page's own sections are the thing that disappears — there is nothing
 * in the canvas to press. Until this existed, `pageToSection` had been written and tested since
 * sprint 5 with nothing importing it, so converting was a one-way trip: a mistake could only be
 * deleted, losing whatever had been added to the page, or caught by Ctrl+Z before anything else
 * happened.
 *
 * **The first page is not the same kind of thing as the others.** It is the site's entry, published
 * as `index.html` whatever it is slugged, and the menu is derived from its sections; moving or
 * deleting it would silently rewrite both the file layout and the navigation of a site somebody has
 * already published. So it is listed, it can be renamed, and it offers neither of the other two —
 * rather than offering them and refusing, which is the dead-button mistake this editor avoids
 * everywhere else. `movePage` and `deletePage` throw for it; this is what keeps anybody from
 * reaching that.
 *
 * **Since sprint 23 it also decides whether a page appears in the menu** (ADR 0043 §3), which is
 * the other half of the switch that lives in a section's fields. The first page does not offer it
 * — it is «Inicio», and hiding the way home is a trap rather than a choice — and neither does a
 * page drawn per entry, which is in no menu at all (ADR 0040 §5). Absent rather than disabled, for
 * the reason the paragraph above gives, and `setPageInMenu` throws for both so nothing can reach
 * past the interface.
 */
export function PagesPanel({
  document: doc,
  currentPageId,
  onSelectPage,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onPageToSection,
  onSetPageInMenu,
  menu,
  canFold,
  linksTo,
  entryShown,
  onPreviewEntry,
  onClose,
}: {
  document: RetorikaDocument;
  currentPageId: string | undefined;
  onSelectPage: (pageId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onMovePage: (pageId: string, toIndex: number) => void;
  onDeletePage: (pageId: string) => void;
  /** Fold the page back into the section it came from — ADR 0022's conversion, undone. */
  onPageToSection: (pageId: string) => void;
  /** Whether this page appears in the pages menu. Never called for the first page or for a page
   * drawn per entry: neither offers the switch, and the schema's verb throws for both. */
  onSetPageInMenu: (pageId: string, inMenu: boolean) => void;
  /**
   * How much menu is left, said out loud (ADR 0043 §5) — the same object «Campos» reads, so the
   * two panels cannot tell the owner different numbers about one document.
   */
  menu: MenuState;
  /** Whether that page can be folded at all, answered by the schema's own `canFoldPage` so the
   * button and the verb cannot drift apart. */
  canFold: (pageId: string) => boolean;
  /** How many visible links point at a page, counted from the document. Read *before* a delete,
   * which is the only moment it is worth saying — afterwards those links are merely dead. */
  linksTo: (pageId: string) => number;
  /** Which entry a page drawn per entry is being shown for (ADR 0040), and the owner choosing
   * another. The editor resolves the choice against the document; this only draws it. */
  entryShown: (pageId: string) => string | undefined;
  onPreviewEntry: (pageId: string, entryId: string) => void;
  /**
   * Added on sprint 21 day 4: this panel sits beside the canvas on a desktop, where the rail
   * itself is always reachable to switch away from it, but below 720 it covers the canvas as a
   * sheet and the rail is the bar *underneath* it — so without its own close, there was no way
   * back to «Secciones» except a browser back button this product does not have. `PhotosPanel`
   * had the identical gap, for the identical reason.
   */
  onClose: () => void;
}) {
  const headingId = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Put the caret in the rename field and select what is there, **once**, when it opens.
   *
   * An inline `ref={(node) => node?.select()}` was the first attempt and it was wrong in a way the
   * browser walk caught immediately: a callback ref with a fresh identity re-runs on every render,
   * so every keystroke re-selected the whole field and the next character replaced it. Typing
   * «Nuestra carta» left the page called «a». Keyed on `editing`, this runs when the field appears
   * and not again.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the point is to run when the field
  // opens, not when the draft changes — selecting on every keystroke is the bug this replaced.
  useEffect(() => {
    if (editing !== null) inputRef.current?.select();
  }, [editing]);

  const full = doc.pages.length >= MAX_PAGES;
  const menuNote = menuNoteText(menu);

  function commitRename(pageId: string) {
    const title = draft.trim();
    // An empty title is not a rename: it would leave a page with no name in the tabs and no words
    // in the menu, which is derived from exactly this. The field simply closes unchanged.
    if (title !== "") onRenamePage(pageId, title);
    setEditing(null);
  }

  return (
    <section aria-labelledby={headingId} className={`${PANEL_WIDTH} gap-4 p-5 ${panelCard}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="text-[13px] font-bold text-ui-ink">
          {es["editor.pages.title"]}
        </h2>
        <PanelClose onClick={onClose} label={es["editor.pages.close"]} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {doc.pages.map((page, index) => {
          const isEntry = index === 0;
          const current = page.id === (currentPageId ?? doc.pages[0]?.id);
          const pointing = linksTo(page.id);
          const perEntry = perEntryOf(doc, page);

          return (
            <li key={page.id} className={panelRow}>
              <div className="flex items-center gap-1 p-1.5">
                {editing === page.id ? (
                  <input
                    ref={inputRef}
                    value={draft}
                    aria-label={es["editor.pages.rename"]}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => commitRename(page.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(page.id);
                      if (event.key === "Escape") setEditing(null);
                    }}
                    className="min-w-0 flex-1 rounded-ui-sm border border-ui-brand px-2 py-1 text-[13px] phone:text-base text-ui-ink"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectPage(page.id)}
                    {...(current ? { "aria-current": "page" as const } : {})}
                    className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-[13px] ${
                      current ? "font-bold text-ui-brand-deep" : "text-ui-ink"
                    }`}
                  >
                    {page.title}
                    {perEntry && (
                      <span className="ml-1.5 font-normal text-ui-muted">
                        {es["editor.pages.perEntry"].replace(
                          "{n}",
                          String(perEntry.collection.entries.length),
                        )}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* **Which entry the canvas draws this page for** (ADR 0040). The page is stored once;
                  the canvas can only show one drawing of it, and this is where the owner picks which.
                  The choice is the editor's, never the document's — nothing here is published. */}
              {perEntry && perEntry.collection.entries.length > 0 && (
                <label className="flex items-center gap-1.5 px-2.5 pb-1.5 text-[11px] text-ui-muted">
                  <span>{es["editor.pages.viewing"]}</span>
                  <select
                    aria-label={es["editor.pages.viewing"]}
                    value={entryShown(page.id) ?? ""}
                    onChange={(event) => onPreviewEntry(page.id, event.target.value)}
                    className="min-w-0 flex-1 rounded-ui-sm border border-ui-border bg-white px-1.5 py-0.5 text-[12px] phone:text-base text-ui-ink"
                  >
                    {perEntry.collection.entries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.fields[perEntry.titleField]?.text || entry.id}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-1 border-t border-ui-border px-1.5 py-1">
                {/* **State first, then the actions.** A checkbox says what is true now; the
                    buttons beside it do something. Absent for the first page and for a page drawn
                    per entry, which are the two the schema's verb refuses — see the note at the
                    top of this file. */}
                {!isEntry && !perEntry && (
                  <label className="ui-interactive flex cursor-pointer items-center gap-1.5 rounded-ui-sm px-2 py-1 text-[12px] font-semibold text-ui-muted hover:bg-ui-bg hover:text-ui-ink">
                    <input
                      type="checkbox"
                      checked={page.inMenu !== false}
                      onChange={(event) => onSetPageInMenu(page.id, event.target.checked)}
                      className="h-[14px] w-[14px] shrink-0 accent-[var(--ui-brand)]"
                    />
                    {es["editor.menu.pageToggle"]}
                  </label>
                )}
                <SmallButton
                  label={es["editor.pages.rename"]}
                  onClick={() => {
                    setDraft(page.title);
                    setEditing(page.id);
                    setConfirming(null);
                  }}
                />
                {!isEntry && (
                  <>
                    <SmallButton
                      label={es["editor.pages.moveUp"]}
                      disabled={index <= 1}
                      onClick={() => onMovePage(page.id, index - 1)}
                    />
                    <SmallButton
                      label={es["editor.pages.moveDown"]}
                      disabled={index >= doc.pages.length - 1}
                      onClick={() => onMovePage(page.id, index + 1)}
                    />
                    {/* Offered only where it would work, and the question is asked by the verb's
                        own `canFoldPage` rather than by conditions re-listed here. A page whose
                        avance the owner deleted is a state ADR 0022 allows and `pageToSection`
                        refuses, so the button is simply absent — «Borrar» is what that page has.

                        No confirmation, unlike the delete beside it: folding loses nothing. The
                        sections come back where the avance is and one «Deshacer» puts the page
                        back. A page the owner had added sections to brings all of them, which is
                        the only reading that loses none of their work — visible in the canvas the
                        moment it happens, and undone in one press if it was not what they meant. */}
                    {canFold(page.id) && (
                      <SmallButton
                        label={es["editor.pages.fold"]}
                        onClick={() => {
                          setConfirming(null);
                          onPageToSection(page.id);
                        }}
                      />
                    )}
                    <SmallButton
                      label={es["editor.pages.delete"]}
                      danger
                      onClick={() => setConfirming(confirming === page.id ? null : page.id)}
                    />
                  </>
                )}
              </div>

              {confirming === page.id && (
                <div className="border-t border-ui-border px-2.5 py-2">
                  {/* The count said **before** the delete, while it can still change the answer —
                      the same thing the delete-a-section toast does with anchors (sprint 3 day 2).
                      Afterwards those links are merely dead, and `/api/download` would say so only
                      once somebody pressed Descargar. */}
                  <p className="text-[12px] leading-snug text-ui-muted">
                    {pointing > 0
                      ? pointing === 1
                        ? es["editor.pages.deleteWithLink"]
                        : es["editor.pages.deleteWithLinks"].replace("{n}", String(pointing))
                      : es["editor.pages.deleteConfirm"]}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <SmallButton
                      label={es["editor.pages.deleteYes"]}
                      danger
                      onClick={() => {
                        setConfirming(null);
                        onDeletePage(page.id);
                      }}
                    />
                    <SmallButton
                      label={es["editor.pages.deleteNo"]}
                      onClick={() => setConfirming(null)}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* **What the menu has left, and whether the site shows one at all** (ADR 0043 §5). It sits
          right under the rows whose switches change it, and it is the same sentence «Campos» shows
          under the switch for a section — one object answers both, so they cannot disagree. */}
      <p className="text-[12px] leading-snug text-ui-muted">{pagesLeftText(menu)}</p>
      {menuNote === undefined ? null : (
        <p className="text-[12px] leading-snug text-ui-muted">{menuNote}</p>
      )}

      {/* **Two counts, never one under the other's label** (David, approving sprint 19). The pages
          the document stores are what the cap of five limits; the files a download writes can be
          more, because a page drawn per entry is one stored page and N files (ADR 0040). */}
      <p className="text-[12px] leading-snug text-ui-muted">
        {es["editor.pages.stored"]
          .replace("{n}", String(doc.pages.length))
          .replace("{max}", String(MAX_PAGES))}
      </p>
      {doc.pages
        .map((page) => perEntryOf(doc, page))
        .filter((perEntry) => perEntry !== undefined)
        .map((perEntry) => (
          <p key={perEntry.collection.id} className="text-[12px] leading-snug text-ui-muted">
            {es["editor.pages.downloaded"]
              .replace("{n}", String(filesWritten(doc)))
              .replace("{list}", perEntry.collection.name)}
          </p>
        ))}
      {/* Said rather than shown as a disabled control: there is nothing here to disable, because
          pages are made in the canvas. The number is the download route's and the schema's. */}
      <p className="text-[12px] leading-snug text-ui-muted">
        {full
          ? es["editor.pages.full"].replace("{n}", String(MAX_PAGES))
          : es["editor.pages.howToAdd"]}
      </p>
    </section>
  );
}

/** The collection a page is drawn per entry of, with the field that names each drawing. */
function perEntryOf(
  doc: RetorikaDocument,
  page: RetorikaDocument["pages"][number],
): { collection: Collection; titleField: string } | undefined {
  const binding = page.binding;
  if (!binding) return undefined;
  const collection = doc.collections.find((candidate) => candidate.id === binding.collectionId);
  return collection ? { collection, titleField: binding.titleField } : undefined;
}

/** How many `.html` files a download writes: every ordinary page once, a page per entry once per
 * entry — the publisher's own arithmetic, restated here so the sentence can say the number. */
function filesWritten(doc: RetorikaDocument): number {
  return doc.pages.reduce((count, page) => {
    const perEntry = perEntryOf(doc, page);
    return count + (perEntry ? perEntry.collection.entries.length : 1);
  }, 0);
}
