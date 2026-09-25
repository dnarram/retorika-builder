"use client";

import es from "../locales/es.json" with { type: "json" };

/**
 * The editor's chrome (mockup 08): a 58px top bar, an 80px left rail, and the canvas in
 * between. Built with Tailwind against the `--ui-*` tokens of ADR 0015 (`globals.css`'s
 * `@theme inline` block), not a palette of Tailwind's own — the same rule the rest of this
 * app's inline styles already followed, now expressed as utility classes instead.
 *
 * Three things the mockup draws that this does not, and why:
 * - **No second page tab, no "+" button.** The mockup shows `Inicio`, `Servicios` and an add-page
 *   control next to a `PÁGINAS: FASE 2` badge — but this document has exactly one page, and a
 *   button that adds a page nothing can hold yet is the same dead-button mistake sprint 1 kept
 *   refusing. `Inicio` is drawn alone, as the one real tab.
 * - **`Estilo` is dimmed too**, though the mockup only dims `Fotos` and `Páginas`. Protocol Part
 *   14 puts "Estilo global" in phase 2 same as the other two; the mockup predates that being
 *   pinned down. Consistency with the written phase boundary wins over the pixel reference.
 * - **No site-preview nav bar inside the canvas card.** The mockup's `Inicio Servicios Galería
 *   Contacto Reserva` strip is what a real multi-page site's own navigation would show — ours
 *   does not generate one, so drawing it would be furniture advertising links that go nowhere.
 *
 * Undo and redo are live from day 2; they grey out when there is nothing to go back or forward
 * to, which is the honest state and not a placeholder. The `Guardado` tick is live from day 3
 * too, and says `Guardado en este navegador` rather than the mockup's bare `Guardado` — a name
 * this specific, so nobody reads a guarantee across devices or accounts into a `localStorage`
 * autosave that has neither (the trade-off, and why it is acceptable for this phase, is written
 * up in ADR 0012). Before the first save attempt resolves the slot is empty, never a claim not
 * yet earned; if a save fails — a full or disabled store — it says `No guardado` instead of
 * continuing to show green.
 */

export type SaveStatus = "saved" | "unsaved" | null;

const RAIL_ICONS = {
  sections: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  ),
  style: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1.2" />
      <circle cx="15" cy="10" r="1.2" />
      <circle cx="12" cy="15" r="1.2" />
    </svg>
  ),
  pages: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </svg>
  ),
  photos: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5L6 20" />
    </svg>
  ),
} as const;

function RailItem({
  icon,
  label,
  active = false,
  phase2 = false,
}: {
  icon: keyof typeof RAIL_ICONS;
  label: string;
  active?: boolean;
  phase2?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-[5px]">
      <span
        className={
          "flex h-[46px] w-[46px] items-center justify-center rounded-[13px] border " +
          (active
            ? "border-ui-brand bg-ui-brand-surface text-ui-brand"
            : "border-ui-border bg-ui-surface text-ui-muted")
        }
      >
        {RAIL_ICONS[icon]}
      </span>
      <span
        className={
          "text-[11px] font-medium " +
          (active ? "font-semibold text-ui-brand" : phase2 ? "text-[#A3AEC0]" : "text-ui-muted")
        }
      >
        {label}
      </span>
      {phase2 ? (
        <span className="text-[9px] font-bold tracking-[0.04em] text-[#A3AEC0]">
          {es["editor.rail.phase2"].toUpperCase()}
        </span>
      ) : null}
    </div>
  );
}

function DeviceToggle({
  device,
  onChange,
}: {
  device: "desktop" | "mobile";
  onChange: (device: "desktop" | "mobile") => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-[9px] border border-ui-border p-[3px]">
      <button
        type="button"
        aria-label={es["editor.device.desktop"]}
        aria-pressed={device === "desktop"}
        onClick={() => onChange("desktop")}
        className={
          "flex h-7 w-8 items-center justify-center rounded-[6px] " +
          (device === "desktop" ? "bg-ui-brand-surface text-ui-brand" : "text-ui-muted")
        }
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <path d="M8 21h8" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={es["editor.device.mobile"]}
        aria-pressed={device === "mobile"}
        onClick={() => onChange("mobile")}
        className={
          "flex h-7 w-8 items-center justify-center rounded-[6px] " +
          (device === "mobile" ? "bg-ui-brand-surface text-ui-brand" : "text-ui-muted")
        }
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </svg>
      </button>
    </div>
  );
}

export function EditorShell({
  siteName,
  onBack,
  downloadState,
  onDownload,
  device,
  onDeviceChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  children,
}: {
  siteName: string;
  onBack: () => void;
  downloadState: "idle" | "downloading" | "error";
  onDownload: () => void;
  device: "desktop" | "mobile";
  onDeviceChange: (device: "desktop" | "mobile") => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: SaveStatus;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-ui-bg">
      <div className="flex h-[58px] shrink-0 items-center border-b border-ui-border bg-ui-surface px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={es["editor.backToVariants"]}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left"
        >
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-linear-to-br from-[#2B9BF4] to-[#1554D8] text-[16px] font-extrabold leading-none text-white">
            R
          </span>
          <span className="truncate text-[16px] font-bold tracking-[-0.01em] text-ui-ink">
            {siteName}
          </span>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94A3B8"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        <div className="flex shrink-0 items-center justify-center gap-1.5">
          <span className="flex h-9 items-center rounded-[9px] bg-ui-brand-surface px-5 text-sm font-semibold text-ui-brand">
            {es["editor.page.home"]}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
          <DeviceToggle device={device} onChange={onDeviceChange} />

          <button
            type="button"
            aria-label={es["editor.undo"]}
            disabled={!canUndo}
            onClick={onUndo}
            className={
              "flex h-[30px] w-[30px] items-center justify-center " +
              (canUndo ? "cursor-pointer text-ui-ink" : "text-ui-muted opacity-40")
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8h11a5 5 0 0 1 0 10H8" />
              <path d="M7 4L3 8l4 4" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={es["editor.redo"]}
            disabled={!canRedo}
            onClick={onRedo}
            className={
              "flex h-[30px] w-[30px] items-center justify-center " +
              (canRedo ? "cursor-pointer text-ui-ink" : "text-ui-muted opacity-40")
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 8H10a5 5 0 0 0 0 10h6" />
              <path d="M17 4l4 4-4 4" />
            </svg>
          </button>

          {saveStatus ? (
            <span
              className={
                "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium " +
                (saveStatus === "saved" ? "text-ui-muted" : "text-[#BE123C]")
              }
            >
              {saveStatus === "saved" ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#03D26E"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : null}
              {saveStatus === "saved" ? es["editor.saved"] : es["editor.unsaved"]}
            </span>
          ) : null}

          <button
            type="button"
            onClick={onDownload}
            disabled={downloadState === "downloading"}
            className={
              "flex h-9 items-center justify-center rounded-[9px] px-[18px] text-sm font-semibold text-white " +
              (downloadState === "downloading" ? "bg-[#8FB4E9]" : "bg-ui-brand")
            }
          >
            {downloadState === "downloading" ? es["editor.downloading"] : es["editor.download"]}
          </button>
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden">
        <div className="flex w-20 shrink-0 flex-col items-center gap-3.5 border-r border-ui-border bg-ui-surface py-3.5">
          <RailItem icon="sections" label={es["editor.rail.sections"]} active />
          <RailItem icon="style" label={es["editor.rail.style"]} phase2 />
          <RailItem icon="pages" label={es["editor.rail.pages"]} phase2 />
          <RailItem icon="photos" label={es["editor.rail.photos"]} phase2 />
        </div>

        <div className="flex flex-grow justify-center overflow-hidden px-6 pt-6 sm:px-24">
          <div
            className="flex flex-col overflow-hidden rounded-[10px] bg-ui-surface shadow-[0_1px_4px_rgba(15,23,42,0.1)] transition-[max-width] duration-200"
            style={{ width: "100%", maxWidth: device === "mobile" ? 400 : "100%" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
