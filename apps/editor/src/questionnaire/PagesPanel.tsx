"use client";

import { MAX_PAGES, type RetorikaDocument } from "@retorika/schema";
import { useEffect, useId, useRef, useState } from "react";
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
 */
export function PagesPanel({
  document: doc,
  currentPageId,
  onSelectPage,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onPageToSection,
  canFold,
  linksTo,
}: {
  document: RetorikaDocument;
  currentPageId: string | undefined;
  onSelectPage: (pageId: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onMovePage: (pageId: string, toIndex: number) => void;
  onDeletePage: (pageId: string) => void;
  /** Fold the page back into the section it came from — ADR 0022's conversion, undone. */
  onPageToSection: (pageId: string) => void;
  /** Whether that page can be folded at all, answered by the schema's own `canFoldPage` so the
   * button and the verb cannot drift apart. */
  canFold: (pageId: string) => boolean;
  /** How many visible links point at a page, counted from the document. Read *before* a delete,
   * which is the only moment it is worth saying — afterwards those links are merely dead. */
  linksTo: (pageId: string) => number;
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

  function commitRename(pageId: string) {
    const title = draft.trim();
    // An empty title is not a rename: it would leave a page with no name in the tabs and no words
    // in the menu, which is derived from exactly this. The field simply closes unchanged.
    if (title !== "") onRenamePage(pageId, title);
    setEditing(null);
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 p-4">
      <h2 id={headingId} className="text-[13px] font-bold text-ui-ink">
        {es["editor.pages.title"]}
      </h2>

      <ul className="flex flex-col gap-1.5">
        {doc.pages.map((page, index) => {
          const isEntry = index === 0;
          const current = page.id === (currentPageId ?? doc.pages[0]?.id);
          const pointing = linksTo(page.id);

          return (
            <li key={page.id} className="rounded-[10px] border border-ui-border bg-white">
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
                    className="min-w-0 flex-1 rounded-md border border-ui-brand px-2 py-1 text-[13px] text-ui-ink"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectPage(page.id)}
                    {...(current ? { "aria-current": "page" as const } : {})}
                    className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-[13px] ${
                      current ? "font-bold text-ui-brand" : "text-ui-ink"
                    }`}
                  >
                    {page.title}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1 border-t border-ui-border px-1.5 py-1">
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

function SmallButton({
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-1 text-[12px] font-semibold ${
        danger ? "text-ui-danger" : "text-ui-muted"
      } ${disabled ? "opacity-40" : "hover:bg-ui-bg"}`}
    >
      {label}
    </button>
  );
}
