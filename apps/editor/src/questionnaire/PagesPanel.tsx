"use client";

import { type Collection, MAX_PAGES, type RetorikaDocument } from "@retorika/schema";
import { type PointerEvent as ReactPointerEvent, useEffect, useId, useRef, useState } from "react";
import { headerStateFor, menuLineFor } from "../editor/headerState.ts";
import { Note, PanelHeader, panelFrame, panelRow, SmallButton } from "../editor/panelKit.tsx";
import {
  dropOf,
  gapAt,
  outlineOf,
  type RowBox,
  type SectionDrop,
} from "../editor/sectionOutline.ts";
import es from "../locales/es.json" with { type: "json" };
import type { MenuFocusBlock } from "./MenuPanel.tsx";

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
 * **It reads whether a page is in the menu, and no longer decides it** (sprint 39 día 1, ADR 0078).
 * From sprint 23 to 38 each row carried its own «En el menú», the same `setPageInMenu` as the row in
 * «Menú»: two visible controls writing one key. The one switch lives in «Menú» now, beside «Se lee
 * como…»; here each row says its state in a line — «En el menú», «Fuera del menú», or why it has no
 * switch — and «Cambiar» opens «Menú» with the keyboard on that page's switch (`onOpenMenuFor`), so
 * the second step is one press that lands exactly where the decision is made. The line is read from
 * `headerStateFor`, the same object «Menú» draws its rows from, so the two cannot disagree.
 */
export function PagesPanel({
  document: doc,
  currentPageId,
  onSelectPage,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onPageToSection,
  onMoveSection,
  onMoveSectionToPage,
  onOpenMenuFor,
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
  /** A section to another place on its page (`moveSection`), from its row. */
  onMoveSection: (sectionId: string, toIndex: number) => void;
  /** A section to another page, at a gap or last before its footer (ADR 0087). */
  onMoveSectionToPage: (sectionId: string, pageId: string, index?: number) => void;
  /** Open «Menú» at this page's row, with the keyboard on its switch — or on the row itself when it
   * has none (Inicio, a page drawn per entry), whose note says why. */
  onOpenMenuFor: (target: MenuFocusBlock) => void;
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

  /*
   * **The sections' rows** (sprint 41 día 10a). Which pages are unfolded, which row's «A otra página»
   * is open, and the row being carried — a ref for the pointer's handlers, which run between renders,
   * and state for what is drawn: the carried row dimmed and the line at the gap it would land in.
   */
  const outline = outlineOf(doc);
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const [choosing, setChoosing] = useState<string | null>(null);
  const [carrying, setCarrying] = useState<{ sectionId: string; line: number | null } | null>(null);
  const carry = useRef<{ sectionId: string; drop: SectionDrop | null } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** The row the keyboard goes back to once the document has moved it, and the verb it pressed. */
  const focusAfter = useRef<{ sectionId: string; verb: "up" | "down" | "row" } | null>(null);

  const toggleUnfolded = (pageId: string) =>
    setUnfolded((open) => {
      const next = new Set(open);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });

  function moveWithin(sectionId: string, toIndex: number, verb: "up" | "down" | "row") {
    focusAfter.current = { sectionId, verb };
    onMoveSection(sectionId, toIndex);
  }

  function moveAcross(sectionId: string, pageId: string, index: number | undefined) {
    focusAfter.current = { sectionId, verb: "row" };
    setChoosing(null);
    // The page it went to unfolds, so the row is still in sight and the keyboard has somewhere to go.
    setUnfolded((open) => new Set(open).add(pageId));
    onMoveSectionToPage(sectionId, pageId, index);
  }

  // The keyboard back on the row the document just moved: on the verb pressed while it still applies,
  // otherwise on the row's first verb that does — a row moved to the top has no «Subir» to return to.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the document has changed.
  useEffect(() => {
    const wanted = focusAfter.current;
    if (!wanted) return;
    focusAfter.current = null;
    const row = listRef.current?.querySelector(`[data-outline-row="${wanted.sectionId}"]`);
    if (!row) return;
    const verbs = [...row.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    const said =
      wanted.verb === "row"
        ? undefined
        : es[wanted.verb === "up" ? "editor.pages.section.up" : "editor.pages.section.down"].split(
            "{name}",
          )[0];
    const pressed = said
      ? verbs.find((button) => button.getAttribute("aria-label")?.startsWith(said))
      : undefined;
    (pressed ?? verbs[0])?.focus();
  }, [doc]);

  function measure(): RowBox[] {
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-outline-row]") ?? [];
    return [...rows].map((row) => {
      const box = row.getBoundingClientRect();
      return {
        pageId: row.dataset.outlinePage ?? "",
        sectionId: row.dataset.outlineRow ?? "",
        top: box.top,
        bottom: box.bottom,
      };
    });
  }

  function beginCarry(event: ReactPointerEvent<HTMLElement>, sectionId: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    carry.current = { sectionId, drop: null };
    setChoosing(null);
    setCarrying({ sectionId, line: null });
  }

  function moveCarry(event: ReactPointerEvent<HTMLElement>) {
    const held = carry.current;
    if (!held) return;
    const gap = gapAt(measure(), event.clientY);
    held.drop = gap ? dropOf(doc, held.sectionId, gap) : null;
    const top = listRef.current?.getBoundingClientRect().top ?? 0;
    setCarrying({ sectionId: held.sectionId, line: gap && held.drop ? gap.y - top : null });
  }

  function endCarry(write: boolean) {
    const held = carry.current;
    carry.current = null;
    setCarrying(null);
    if (!write || !held?.drop) return;
    if (held.drop.kind === "within") moveWithin(held.sectionId, held.drop.toIndex, "row");
    else moveAcross(held.sectionId, held.drop.pageId, held.drop.index);
  }

  // Escape lets go without writing, wherever the keyboard is while the hand carries.
  useEffect(() => {
    if (!carrying) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      carry.current = null;
      setCarrying(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [carrying]);

  const full = doc.pages.length >= MAX_PAGES;
  // The rows as «Menú» sees them: what each line below says, and whether its door opens on a switch.
  const menuRows = headerStateFor(doc, currentPageId).pageRows;

  function commitRename(pageId: string) {
    const title = draft.trim();
    // An empty title is not a rename: it would leave a page with no name in the tabs and no words
    // in the menu, which is derived from exactly this. The field simply closes unchanged.
    if (title !== "") onRenamePage(pageId, title);
    setEditing(null);
  }

  return (
    <section aria-labelledby={headingId} className={panelFrame}>
      <PanelHeader
        id={headingId}
        title={es["editor.pages.title"]}
        close={{ label: es["editor.pages.close"], onClick: onClose }}
      />

      <ul ref={listRef} className="relative flex flex-col gap-1.5">
        {carrying?.line != null && (
          <li
            aria-hidden="true"
            data-testid="outline-gap"
            className="pointer-events-none absolute inset-x-1 h-0.5 -translate-y-px rounded-full bg-ui-brand"
            style={{ top: carrying.line }}
          />
        )}
        {doc.pages.map((page, index) => {
          const isEntry = index === 0;
          const current = page.id === (currentPageId ?? doc.pages[0]?.id);
          const pointing = linksTo(page.id);
          const perEntry = perEntryOf(doc, page);
          const menuRow = menuRows.find((row) => row.pageId === page.id);
          const line = menuRow ? menuLineFor(menuRow) : undefined;
          const outlined = outline.find((entry) => entry.pageId === page.id);

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

              {/* **The menu's line and its door** (sprint 39 día 1, ADR 0078): what «Menú» holds
                  for this page, read and not switched here, and the one press that lands on it.
                  The verb is «Cambiar» where a switch waits, «Ver en «Menú»» where only the reason
                  does — a verb that promised a change the row cannot make would be a dead button. */}
              {line ? (
                <div className="flex items-center gap-1 border-t border-ui-border px-2.5 py-1">
                  <Note as="span" className="min-w-0 flex-1">
                    {line.text}
                  </Note>
                  <button
                    type="button"
                    onClick={() => onOpenMenuFor({ block: "page", pageId: page.id })}
                    aria-label={es[
                      line.door === "change"
                        ? "editor.menu.door.changeLabel"
                        : "editor.menu.door.seeLabel"
                    ].replace("{name}", page.title)}
                    className="ui-interactive shrink-0 cursor-pointer rounded-ui-sm px-2 py-1 text-[12px] font-semibold text-ui-brand-deep hover:bg-ui-brand-surface"
                  >
                    {
                      es[
                        line.door === "change" ? "editor.menu.door.change" : "editor.menu.door.see"
                      ]
                    }
                  </button>
                </div>
              ) : null}

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
                  <Note>
                    {pointing > 0
                      ? pointing === 1
                        ? es["editor.pages.deleteWithLink"]
                        : es["editor.pages.deleteWithLinks"].replace("{n}", String(pointing))
                      : es["editor.pages.deleteConfirm"]}
                  </Note>
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
              {/* **The page's sections** (ADR 0087's día 10a amendment, sprint 41): folded until
                  asked, so the panel stays a list of pages. Unfolded, each row is carried by its
                  dots to a gap — in this page or another — and the keyboard has the same answers in
                  «Subir», «Bajar» and «A otra página». What a row offers is what the verbs accept. */}
              <div className="border-t border-ui-border px-1.5 py-1">
                <SmallButton
                  label={es["editor.pages.sections"].replace(
                    "{n}",
                    String(outlined?.rows.length ?? 0),
                  )}
                  expanded={unfolded.has(page.id)}
                  onClick={() => toggleUnfolded(page.id)}
                />
              </div>
              {unfolded.has(page.id) && outlined && (
                <ul
                  aria-label={es["editor.pages.sectionsOf"].replace("{page}", page.title)}
                  className="flex flex-col gap-0.5 px-1.5 pb-1.5"
                >
                  {outlined.rows.map((row, at) => (
                    <li
                      key={row.sectionId}
                      data-outline-row={row.sectionId}
                      data-outline-page={page.id}
                      className={`rounded-ui-sm bg-white ${
                        carrying?.sectionId === row.sectionId ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1 px-1 py-0.5">
                        <span
                          aria-hidden="true"
                          data-outline-grip=""
                          onPointerDown={(event) => beginCarry(event, row.sectionId)}
                          onPointerMove={moveCarry}
                          onPointerUp={() => endCarry(true)}
                          onPointerCancel={() => endCarry(false)}
                          className={`flex h-7 w-6 shrink-0 touch-none items-center justify-center rounded-ui-sm text-ui-muted hover:bg-ui-bg ${
                            carrying?.sectionId === row.sectionId
                              ? "cursor-grabbing"
                              : "cursor-grab"
                          }`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <circle cx="9" cy="5" r="1.8" />
                            <circle cx="15" cy="5" r="1.8" />
                            <circle cx="9" cy="12" r="1.8" />
                            <circle cx="15" cy="12" r="1.8" />
                            <circle cx="9" cy="19" r="1.8" />
                            <circle cx="15" cy="19" r="1.8" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ui-ink">
                          {row.name}
                        </span>
                        <SmallButton
                          label={es["editor.pages.moveUp"]}
                          name={es["editor.pages.section.up"].replace("{name}", row.name)}
                          disabled={at === 0}
                          onClick={() => moveWithin(row.sectionId, at - 1, "up")}
                        />
                        <SmallButton
                          label={es["editor.pages.moveDown"]}
                          name={es["editor.pages.section.down"].replace("{name}", row.name)}
                          disabled={at === outlined.rows.length - 1}
                          onClick={() => moveWithin(row.sectionId, at + 1, "down")}
                        />
                        {row.pages.length > 0 && (
                          <SmallButton
                            label={es["editor.pages.section.toPage"]}
                            name={es["editor.pages.section.toPageLabel"].replace(
                              "{name}",
                              row.name,
                            )}
                            expanded={choosing === row.sectionId}
                            onClick={() =>
                              setChoosing(choosing === row.sectionId ? null : row.sectionId)
                            }
                          />
                        )}
                      </div>
                      {choosing === row.sectionId && (
                        <div className="flex flex-wrap gap-1 border-t border-ui-border px-1 py-0.5">
                          {row.pages.map((to) => (
                            <SmallButton
                              key={to.id}
                              label={es["editor.toPage.existing"].replace("{page}", to.title)}
                              onClick={() => moveAcross(row.sectionId, to.id, undefined)}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* **Two counts, never one under the other's label** (David, approving sprint 19). The pages
          the document stores are what the cap of five limits; the files a download writes can be
          more, because a page drawn per entry is one stored page and N files (ADR 0040). */}
      <Note>
        {es["editor.pages.stored"]
          .replace("{n}", String(doc.pages.length))
          .replace("{max}", String(MAX_PAGES))}
      </Note>
      {doc.pages
        .map((page) => perEntryOf(doc, page))
        .filter((perEntry) => perEntry !== undefined)
        .map((perEntry) => (
          <Note key={perEntry.collection.id}>
            {es["editor.pages.downloaded"]
              .replace("{n}", String(filesWritten(doc)))
              .replace("{list}", perEntry.collection.name)}
          </Note>
        ))}
      {/* Said rather than shown as a disabled control: there is nothing here to disable, because
          pages are made in the canvas. The number is the download route's and the schema's. How a
          page is made is an instruction, and the help line says it while this panel is open and has
          room for one (sprint 39 día 3, ADR 0071). */}
      {full ? <Note>{es["editor.pages.full"].replace("{n}", String(MAX_PAGES))}</Note> : null}
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
