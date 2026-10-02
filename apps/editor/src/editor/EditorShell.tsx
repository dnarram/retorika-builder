"use client";

import es from "../locales/es.json" with { type: "json" };
import { NARROWEST_WIDTH } from "./overflowCheck.ts";

/**
 * The editor's chrome (mockup 08): a 58px top bar, an 80px left rail, and the canvas in
 * between. Built with Tailwind against the `--ui-*` tokens of ADR 0015 (`globals.css`'s
 * `@theme inline` block), not a palette of Tailwind's own — the same rule the rest of this
 * app's inline styles already followed, now expressed as utility classes instead.
 *
 * Two things the mockup draws that this does not, and why:
 * - **No second page tab, no "+" button.** The mockup shows `Inicio`, `Servicios` and an add-page
 *   control next to a `PÁGINAS: FASE 2` badge — but this document has exactly one page, and a
 *   button that adds a page nothing can hold yet is the same dead-button mistake sprint 1 kept
 *   refusing. `Inicio` is drawn alone, as the one real tab.
 * - **No site-preview nav bar inside the canvas card.** The mockup's `Inicio Servicios Galería
 *   Contacto Reserva` strip is what a real multi-page site's own navigation would show — ours
 *   does not generate one, so drawing it would be furniture advertising links that go nowhere.
 *
 * **`Estilo` is live as of sprint 4, and the rail is interactive for the first time.** It was
 * dimmed here through phase 1 on purpose — protocol Part 14 puts "Estilo global" in phase 2, and
 * the badge existed so nobody implemented it early by reading the screen. What changed is that
 * phase 1's acceptance criterion has been measured (`docs/sessions/2026-09-27-conchi.md`: eight
 * minutes to the ZIP, unaided) and the same session named the gap: «necesita trabajo visual…
 * colores». This is phase 2's own list in its own order, so it needs no phase-boundary ADR the way
 * the cover photo did (ADR 0018) — that one overtook phase 1 while phase 1 was unfinished.
 *
 * `Páginas` and `Fotos` stay as they were, and stay **non-interactive elements rather than disabled
 * buttons**. A disabled button says "not right now"; these are not buttons at all yet, and the
 * `Fase 2` badge under them is what says so. Drawing them as buttons would be the dead-button
 * mistake with an attribute over it.
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
  /** The grid, because that is the whole of what this panel is about (rule 4). Drawn from mockup
   * 16's own icon rather than invented. */
  design: (
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M3 9h18" />
    </svg>
  ),
  share: (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
} as const;

/**
 * What the rail can select.
 *
 * The comment this replaces said «`Páginas` and `Fotos` are not here: a value the rail cannot take
 * is not a state the app has to handle» — which stopped being true when both shipped, and stayed in
 * the file regardless. The rule it was stating is still the right one and now applies to `design`:
 * it is a value the rail can take **only while the design tools are on**, which `EditorShell` is
 * what enforces, and `Editor` falls back to `sections` if the tools go off while it is open.
 */
export type RailItemId = "sections" | "style" | "pages" | "photos" | "share" | "design";

function RailIcon({ icon, active }: { icon: keyof typeof RAIL_ICONS; active: boolean }) {
  return (
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
  );
}

/** `phase2` went with `RailPhase2` on sprint 6 day 2. It was the dimmed grey a rail item wore
 * while its feature did not exist, and every one of the four now does — so the shade had no
 * caller left, and a prop nothing passes is the dead-button mistake wearing a different costume. */
function RailLabel({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={
        "text-[11px] font-medium " + (active ? "font-semibold text-ui-brand" : "text-ui-muted")
      }
    >
      {label}
    </span>
  );
}

/**
 * One of the two rail items that does something.
 *
 * `aria-pressed` rather than a tab role: these two are mutually exclusive modes, and the toggle
 * pattern is already what `DeviceToggle` below uses for exactly the same shape of choice. A real
 * `tablist` would need `tabpanel` ids and roving tabindex to be correct, and `Secciones` has no
 * panel of its own to point at — it is the canvas.
 */
function RailButton({
  icon,
  label,
  active,
  onSelect,
}: {
  icon: keyof typeof RAIL_ICONS;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className="flex cursor-pointer flex-col items-center gap-[5px] border-0 bg-transparent p-0"
    >
      <RailIcon icon={icon} active={active} />
      <RailLabel label={label} active={active} />
    </button>
  );
}

/**
 * The design-tools switch, at the foot of the rail (ADR 0025 §4, mockup 16 band 1).
 *
 * **Turning them on asks what the tools do, not who the person is** — «¿Quieres colocar tú cada
 * elemento?» — and it is asked by the switch itself rather than sprung on anyone. An owner who never
 * presses it is never asked anything: ADR 0025 §1 promises they meet no control they did not ask
 * for, and a first-run dialog would break that promise on the way to keeping another one.
 *
 * > **This asked the trade until 1 October 2026, and that was wrong on its own terms.** The question
 * > was «¿Montas webs para otros?», from the dossier §4's point that «ante "básico o avanzado" mucha
 * > gente miente hacia arriba» — true about *levels*, and the fix it suggested does not follow.
 * > Asking who somebody is and granting the capability for the answer means **anyone who wants the
 * > capability says yes**, so the question filtered nobody while looking as though it did. Session 3
 * > watched a car workshop's owner read it and answer «Sí, enciéndelas»; nothing about that was a
 * > misunderstanding, and nothing was lost by it — §1 is kept by the press, not by the wording.
 * > Describing the tools makes the answer accurate rather than aspirational, and gives the person
 * > deciding the information instead of a label. ADR 0025's amendment, accepted by David.
 *
 * Turning them **off** asks nothing. Nobody needs talking out of a setting.
 *
 * The rail is not where this belongs by aesthetics: `EditorShell`'s top bar is the row sprint 7 day
 * 7 measured overflowing, and a labelled switch would add about 110px to it.
 */
function DesignToolsSwitch({
  on,
  asking,
  onAsk,
  onDismiss,
  onChange,
}: {
  on: boolean;
  /** Whether the trade question is open. Held by the caller so that pressing a rail item, or
   * anything else that moves the person along, can close it. */
  asking: boolean;
  onAsk: () => void;
  onDismiss: () => void;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="relative flex flex-col items-center gap-[5px] pt-1.5">
      {/* Directly under the four items, divided from them — not pushed to the bottom of the rail
          with `mt-auto`, which is what «al pie del raíl» first suggested and what walking it in a
          browser ruled out. The rail is full height, so the bottom is 842px down at 1440×900: the
          switch ended up alone in a corner 600px from anything else, which is not separation but
          concealment. It is also the corner the dev overlay occupies, which is only a nuisance for
          a test — but browser chrome tends to gather there too, and that is not. The mockup draws
          it here, and the mockup's rail card is content-height, so this is the reading its picture
          actually shows. */}
      <span className="mb-1 h-px w-[52px] bg-ui-border" />
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={es["editor.designTools.label"]}
        onClick={() => (on ? onChange(false) : onAsk())}
        className={
          "flex h-[19px] w-[34px] shrink-0 cursor-pointer items-center rounded-[10px] border-0 px-0.5 " +
          (on ? "justify-end bg-ui-brand" : "justify-start bg-ui-border")
        }
      >
        <span className="h-[15px] w-[15px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.2)]" />
      </button>
      <span
        className={
          "text-center text-[9px] leading-[1.25] " +
          (on ? "font-semibold text-ui-brand" : "font-medium text-ui-muted")
        }
      >
        {es["editor.designTools.label"]}
      </span>

      {asking ? (
        <div className="absolute bottom-full left-full z-20 mb-1 ml-1 flex w-[300px] flex-col gap-3 rounded-xl border border-ui-border bg-ui-surface p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.15)]">
          <span className="text-[15px] font-bold text-ui-ink">
            {es["editor.designTools.ask.title"]}
          </span>
          <span className="text-[13px] leading-snug text-ui-muted">
            {es["editor.designTools.ask.body"]}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange(true)}
              className="h-[38px] flex-grow rounded-[9px] bg-ui-brand text-[13px] font-semibold text-white"
            >
              {es["editor.designTools.ask.yes"]}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="h-[38px] flex-grow rounded-[9px] border border-ui-border bg-ui-surface text-[13px] font-medium text-ui-ink"
            >
              {es["editor.designTools.ask.no"]}
            </button>
          </div>
          {/* The same honesty as «Guardado en este navegador», and for the same reason: there are no
              accounts, so saying «tu cuenta» would claim a guarantee this does not have. */}
          <span className="border-t border-ui-border pt-2.5 text-xs leading-normal text-ui-muted">
            {es["editor.designTools.ask.note"]}
          </span>
        </div>
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
  pages,
  currentPageId,
  onSelectPage,
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
  rail,
  onRailChange,
  designTools,
  askingDesignTools,
  onAskDesignTools,
  onDismissDesignTools,
  onDesignToolsChange,
  panel,
  children,
}: {
  siteName: string;
  /** Every page of the open document, in document order, for the tabs. */
  pages: readonly { id: string; title: string }[];
  currentPageId: string | undefined;
  onSelectPage: (pageId: string) => void;
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
  rail: RailItemId;
  onRailChange: (item: RailItemId) => void;
  /**
   * Whether the design tools are on **for this viewport** — the stored preference already narrowed
   * by `effectiveDesignTools`. `undefined` means the window is too narrow to offer them at all, and
   * then no switch is drawn: ADR 0025 §5 chose "absent" over "disabled", because a disabled control
   * invites someone to work out how to enable it and the honest answer is «use a bigger screen».
   */
  designTools: boolean | undefined;
  askingDesignTools: boolean;
  onAskDesignTools: () => void;
  onDismissDesignTools: () => void;
  onDesignToolsChange: (on: boolean) => void;
  /** The side panel the current rail item opens, if it has one. Rendered beside the canvas rather
   * than over it, which is how mockup 13 draws the style panel: the preview narrows and stays
   * visible while a choice is being made about how it looks. */
  panel?: React.ReactNode;
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

        {/* The page tabs of mockup 08, reading from the document instead of naming «Inicio» in the
            markup, which is what stood here while a site could only have one page. A single tab is
            still drawn: it is the mockup's shape, it says which page the canvas is showing, and it
            is where a second one appears the moment a section is converted — which is exactly the
            feedback that the conversion worked. `aria-current="page"` rather than a pressed toggle:
            these name places, not states. */}
        <div className="flex min-w-0 shrink items-center justify-center gap-1.5 overflow-x-auto">
          {pages.map((page) => {
            const current = page.id === currentPageId;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelectPage(page.id)}
                {...(current ? { "aria-current": "page" as const } : {})}
                className={`flex h-9 max-w-[180px] shrink items-center rounded-[9px] px-5 text-sm font-semibold ${
                  current
                    ? "bg-ui-brand-surface text-ui-brand"
                    : "text-ui-muted hover:bg-ui-brand-surface/60"
                }`}
              >
                {/* The label truncates, not the button: `truncate` on a flex container does
                    nothing to its text child, which cut «Taberna Santo Domingo» mid-letter with no
                    ellipsis. A page title is the owner's own words and can be any length. */}
                <span className="truncate">{page.title}</span>
              </button>
            );
          })}
        </div>

        {/* `shrink-0`, not `min-w-0`: this row has nothing in it that can honestly get smaller.
            ADR 0012 chose "Guardado en este navegador" over a bare "Guardado" so nobody reads a
            cross-device guarantee into it, and hiding or truncating that sentence to save room
            would be exactly the promise the ADR refused to make. So it is the tab strip's own
            `overflow-x-auto` that has to give first (sprint 7 day 7's own walk), the way it
            already does for a gallery of eight photographs pushed into two columns — flex-shrink
            was splitting the leftover space evenly between this row and the tabs instead of
            letting the tabs give way to it, which at three pages left it 30px short of its own
            content and the undo/redo buttons visibly compressed to two thirds their size. */}
        <div className="flex shrink-0 items-center justify-end gap-2.5">
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
          <RailButton
            icon="sections"
            label={es["editor.rail.sections"]}
            active={rail === "sections"}
            onSelect={() => onRailChange("sections")}
          />
          <RailButton
            icon="style"
            label={es["editor.rail.style"]}
            active={rail === "style"}
            onSelect={() => onRailChange("style")}
          />
          <RailButton
            icon="pages"
            label={es["editor.rail.pages"]}
            active={rail === "pages"}
            onSelect={() => onRailChange("pages")}
          />
          <RailButton
            icon="share"
            label={es["editor.rail.share"]}
            active={rail === "share"}
            onSelect={() => onRailChange("share")}
          />
          <RailButton
            icon="photos"
            label={es["editor.rail.photos"]}
            active={rail === "photos"}
            onSelect={() => onRailChange("photos")}
          />
          {/* The fifth item, and the only one the switch adds (ADR 0025 §6). **Absent** rather than
              dimmed while the tools are off: `RailLabel`'s own note records that the grey shade for
              "this exists but not yet" lost its last caller in sprint 6, and it is not coming back
              for a panel that is a setting away rather than a sprint away. */}
          {designTools ? (
            <RailButton
              icon="design"
              label={es["editor.rail.design"]}
              active={rail === "design"}
              onSelect={() => onRailChange("design")}
            />
          ) : null}
          {designTools === undefined ? null : (
            <DesignToolsSwitch
              on={designTools}
              asking={askingDesignTools}
              onAsk={onAskDesignTools}
              onDismiss={onDismissDesignTools}
              onChange={onDesignToolsChange}
            />
          )}
        </div>

        {/* The wide side gutters centre the canvas when it is alone; with a panel open they would
            only squeeze the preview, so they go. */}
        <div
          className={`flex flex-grow gap-6 overflow-hidden pt-6 ${panel ? "px-6" : "px-6 sm:px-24"}`}
        >
          <div className="flex flex-grow justify-center overflow-hidden">
            <div
              className="flex flex-col overflow-hidden rounded-[10px] bg-ui-surface shadow-[0_1px_4px_rgba(15,23,42,0.1)] transition-[max-width] duration-200"
              // **The width the pre-download gate measures, imported rather than written again.**
              // This was 400 from the day the chrome was built — a number with no recorded reason,
              // chosen because it is narrow enough for the renderer's own responsive CSS to take
              // over, which 720 already decides. Meanwhile `overflowCheck` warns about what sticks
              // out **at 320**, and its own words are «Míralo en la vista de móvil» — sending the
              // owner to a canvas where the thing it just measured does not happen. Mockup 14 draws
              // the phone frame at 330px with 12px of padding, so the page inside it is about 304:
              // the drawing was never 400 either. One number, and it lives where the gate is.
              style={{ width: "100%", maxWidth: device === "mobile" ? NARROWEST_WIDTH : "100%" }}
            >
              {children}
            </div>
          </div>
          {panel}
        </div>
      </div>
    </div>
  );
}
