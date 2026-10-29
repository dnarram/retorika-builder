"use client";

import type { RetorikaDocument } from "@retorika/schema";
import { useId } from "react";
import { headerStateFor } from "../editor/headerState.ts";
import { PANEL_WIDTH, PanelClose, panelCard } from "../editor/panelKit.tsx";
import es from "../locales/es.json" with { type: "json" };

/**
 * The site's header (ADR 0057): which menus it draws, what their entries say, the button and the
 * brand — opened from the rail and by pressing the header in the canvas (sprint 30 día 3).
 *
 * **Read-only on día 3, and it says only what is true.** The day delivers the canvas model — the
 * header can be chosen, an entry takes the canvas to its section — and a panel that opened onto
 * nothing would be a dead end on the deployed site tonight. So it shows what the header holds,
 * every word of it asked of the renderer through `headerStateFor`, and promises nothing: día 4
 * replaces each line with the control that changes it.
 */
export interface MenuPanelProps {
  doc: RetorikaDocument;
  /** The page the canvas is drawing; its sections are the sections menu shown. */
  pageId: string | undefined;
  onClose: () => void;
}

export function MenuPanel({ doc, pageId, onClose }: MenuPanelProps) {
  const headingId = useId();
  const state = headerStateFor(doc, pageId);

  return (
    <aside aria-labelledby={headingId} className={`${PANEL_WIDTH} gap-4 p-5 ${panelCard}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[15px] font-bold text-ui-ink">
            {es["editor.menuPanel.title"]}
          </h2>
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.menuPanel.help"]}
          </p>
        </div>
        <PanelClose onClick={onClose} label={es["editor.menuPanel.close"]} />
      </div>

      {state.drawn ? (
        <dl className="m-0 flex flex-col gap-3">
          <Row term={es["editor.menuPanel.brand"]}>
            {state.brandName
              ? es["editor.menuPanel.brandShown"]
              : es["editor.menuPanel.brandHidden"]}
          </Row>
          <Row term={es["editor.menuPanel.pages"]}>
            <Entries entries={state.pages} />
          </Row>
          <Row
            term={es["editor.menuPanel.sections"]}
            note={es["editor.menuPanel.sectionsOf"].replace("{page}", state.pageTitle)}
          >
            <Entries entries={state.sections} />
          </Row>
          <Row term={es["editor.menuPanel.action"]}>
            {state.action ?? es["editor.menuPanel.noAction"]}
          </Row>
        </dl>
      ) : (
        <p className="m-0 text-[13px] leading-snug text-ui-ink">
          {es["editor.menuPanel.noHeader"]}
        </p>
      )}
    </aside>
  );
}

function Row({ term, note, children }: { term: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-ui border border-ui-border bg-ui-bg p-3">
      <dt className="text-[12px] font-semibold text-ui-ink">{term}</dt>
      {note === undefined ? null : <dd className="m-0 text-[12px] text-ui-muted">{note}</dd>}
      <dd className="m-0 text-[13px] leading-snug text-ui-ink">{children}</dd>
    </div>
  );
}

/** The entries as the visitor reads them, in order — or the sentence that says none is drawn. */
function Entries({ entries }: { entries: string[] | null }) {
  if (entries === null) return <>{es["editor.menuPanel.notDrawn"]}</>;
  return (
    <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {entries.map((label, index) => (
        // Two entries can carry the same words (two pages the owner titled alike), so the position
        // is part of the key; the list is redrawn whole on every change and never reordered in place.
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: the list is read-only and redrawn whole
          key={`${index}:${label}`}
          className="rounded-ui-sm border border-ui-border bg-ui-surface px-2 py-0.5 text-[12px]"
        >
          {label}
        </li>
      ))}
    </ol>
  );
}
