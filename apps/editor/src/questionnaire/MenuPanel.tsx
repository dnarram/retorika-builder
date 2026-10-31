"use client";

import {
  HEADER_ALIGNMENTS,
  HEADER_BACKGROUNDS,
  HEADER_GAPS,
  HEADER_SIZES,
  type Header,
  type HeaderAction,
  type HeaderLayout,
  type HeaderPart,
  MENU_LABEL_MAX,
  MENU_LABEL_MIN,
  type MenuLabelTarget,
  menuLabelIssue,
  type RetorikaDocument,
} from "@retorika/schema";
import { useEffect, useId, useRef, useState } from "react";
import {
  brandNamePatch,
  headerColorInForce,
  headerExact,
  headerStateFor,
  headerStylePatch,
  lookPatch,
  type MenuBlock,
  type MenuMode,
  menuModePatch,
  menuStatusText,
  type PageRow,
  type SectionRow,
  schemeSwatch,
  sectionsMobilePatch,
  sectionsPositionPatch,
} from "../editor/headerState.ts";
import {
  PANEL_WIDTH,
  PanelClose,
  panelCard,
  panelRow,
  panelRowSelected,
  SmallButton,
} from "../editor/panelKit.tsx";
import es from "../locales/es.json" with { type: "json" };

/**
 * «Menú» — the site's header (ADR 0057): which menus it draws, what each entry says, which
 * destination is the button, and how the bar sits. Opened from the rail and by pressing the header
 * in the canvas (sprint 30 día 3); its controls arrived on día 4.
 *
 * **Six blocks, top to bottom, in the order an owner decides them**: the brand (name and logo,
 * ADR 0059, día 5), the pages menu, the sections menu of the page being edited, the button, the
 * layout, and the look (día 6) — and under the look, with the design tools on, the exact colour
 * and size of each part, rule 6's marked exceptions behind the same switch the text toolbar's are.
 *
 * **Every sentence is asked of the renderer** through `headerStateFor` — the counts, whether a menu
 * is drawn, what an empty «Se lee como…» falls back to, whether a fixed bar lets go on a phone. The
 * panel describes the header the published page has, never one it might have.
 *
 * **Two places, one verb, one state.** A page's switch here is the same `setPageInMenu` as its
 * row's in «Páginas», and a section's the same `setSectionInMenu` as its block in «Campos»: what
 * the owner switches in one is what the other shows, because both read the document.
 */
export interface MenuPanelProps {
  doc: RetorikaDocument;
  /** The page the canvas is drawing; its sections are the sections menu shown. */
  pageId: string | undefined;
  /** The object URL of the logo's bytes, when the document names a logo and this browser holds
   * it — the same map the canvas draws from. */
  logoUrl: string | undefined;
  /** The logo is hard to see on the bar it sits on (`reviewLogo`, ADR 0059): said here, where the
   * owner is looking at it, and again before the download. */
  logoFaint: boolean;
  /** The design switch (ADR 0025): with it on, each part of the header takes an exact colour and
   * size, as a text does from its toolbar. Off, the look is the closed choices and nothing else. */
  designTools: boolean;
  /** Open the picker for the logo. `Editor` owns the one hidden input, as it does for photographs. */
  onChangeLogo: () => void;
  onRemoveLogo: () => void;
  onSetHeader: (patch: Partial<Header>) => void;
  onSetHeaderAction: (action: HeaderAction | null) => void;
  /** `null` goes back to the derived label. Called only with a label the schema accepts. */
  onSetMenuLabel: (target: MenuLabelTarget, label: string | null) => void;
  onSetPageInMenu: (pageId: string, inMenu: boolean) => void;
  onSetSectionInMenu: (sectionId: string, inMenu: boolean) => void;
  onClose: () => void;
}

const LAYOUTS: readonly HeaderLayout[] = ["brand-left", "centered", "stacked"];
const MODES: readonly MenuMode[] = ["auto", "always", "never"];
/** The exact controls a part takes: a colour for all five, a size in pixels for the four with words
 * — the bar has none of its own, and its colour is its background. */
const SIZED_PARTS: ReadonlySet<HeaderPart> = new Set([
  "brand",
  "pagesLinks",
  "sectionsLinks",
  "action",
]);

const blockClass = "m-0 flex min-w-0 flex-col gap-2 rounded-ui border border-ui-border p-3";
const legendClass = "float-left mb-1 w-full p-0 text-[13px] font-bold text-ui-ink";
const noteClass = "m-0 text-[12px] leading-snug text-ui-muted";
const checkboxClass = "h-[16px] w-[16px] shrink-0 accent-[var(--ui-brand)]";

export function MenuPanel({
  doc,
  pageId,
  logoUrl,
  logoFaint,
  designTools,
  onChangeLogo,
  onRemoveLogo,
  onSetHeader,
  onSetHeaderAction,
  onSetMenuLabel,
  onSetPageInMenu,
  onSetSectionInMenu,
  onClose,
}: MenuPanelProps) {
  const headingId = useId();
  const groupId = useId();
  const state = headerStateFor(doc, pageId);
  const chosenAction = state.actionChoices.find((choice) => choice.key === state.actionKey);

  return (
    <aside aria-labelledby={headingId} className={`${PANEL_WIDTH} gap-4 p-5 ${panelCard}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[15px] font-bold text-ui-ink">
            {es["editor.menuPanel.title"]}
          </h2>
          <p className={noteClass}>{es["editor.menuPanel.help"]}</p>
        </div>
        <PanelClose onClick={onClose} label={es["editor.menuPanel.close"]} />
      </div>

      {state.drawn ? null : (
        <p className="m-0 text-[13px] leading-snug text-ui-ink">
          {es["editor.menuPanel.noHeader"]}
        </p>
      )}
      {/* 0. The brand: the business name, and the logo on the bar it will sit on (ADR 0059). */}
      <fieldset className={blockClass}>
        <legend className={legendClass}>{es["editor.menuPanel.brandBlock"]}</legend>
        <Check
          label={es["editor.menuPanel.brand"]}
          checked={state.brandName}
          onChange={(name) => onSetHeader(brandNamePatch(doc, name))}
          notes={[]}
        />
        <div className="flex items-center gap-3">
          {state.logoSrc === undefined ? null : (
            // The logo on the bar's own colour, at the height the page draws it: what the owner
            // sees here is what the visitor sees, dark bar or light. Decorative — the words beside
            // it say what it is.
            <span
              data-testid="logo-swatch"
              style={{ background: state.barBackground }}
              className="flex h-14 w-20 shrink-0 items-center justify-center rounded-ui-sm border border-ui-border"
            >
              {logoUrl === undefined ? null : (
                <img src={logoUrl} alt="" className="max-h-10 max-w-[64px] object-contain" />
              )}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] font-semibold text-ui-ink">
              {es["editor.menuPanel.logo"]}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {state.logoSrc === undefined ? (
                <SmallButton label={es["editor.menuPanel.logoUpload"]} onClick={onChangeLogo} />
              ) : (
                <>
                  <SmallButton label={es["editor.menuPanel.logoChange"]} onClick={onChangeLogo} />
                  <SmallButton
                    label={es["editor.menuPanel.logoRemove"]}
                    onClick={onRemoveLogo}
                    danger
                  />
                </>
              )}
            </div>
          </div>
        </div>
        <p className={noteClass}>
          {state.logoSrc === undefined
            ? es["editor.menuPanel.logoNone"]
            : es["editor.menuPanel.logoShown"]}
        </p>
        {logoFaint ? (
          <p className="m-0 text-[12px] leading-snug text-[#92400E]">
            {es["editor.menuPanel.logoFaint"]}
          </p>
        ) : null}
        <p className={noteClass}>
          {state.brandName || state.logoSrc !== undefined
            ? es["editor.menuPanel.brandNote"]
            : es["editor.menuPanel.brandNothing"]}
        </p>
      </fieldset>

      {/* 1. The pages menu — its switch, then every page in the order of «Páginas», which is the
          order the menu publishes (ADR 0057, David's decision 2). */}
      <fieldset className={blockClass}>
        <legend className={legendClass}>{es["editor.menuPanel.pages"]}</legend>
        <ModeSwitch
          name={`${groupId}-pages`}
          label={es["editor.menuPanel.pages"]}
          block={state.pagesMenu}
          menu="pages"
          onChange={(mode) => onSetHeader(menuModePatch(doc, "pages", mode))}
        />
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {state.pageRows.map((row) => (
            <PageEntryRow
              key={row.pageId}
              row={row}
              onSetInMenu={onSetPageInMenu}
              onSetLabel={onSetMenuLabel}
            />
          ))}
        </ul>
      </fieldset>

      {/* 2. The sections menu of the page being edited — the same switch, its sections, and what
          becomes of it on a phone. */}
      <fieldset className={blockClass}>
        <legend className={legendClass}>{es["editor.menuPanel.sections"]}</legend>
        <ModeSwitch
          name={`${groupId}-sections`}
          label={es["editor.menuPanel.sections"]}
          block={state.sectionsMenu}
          menu="sections"
          onChange={(mode) => onSetHeader(menuModePatch(doc, "sections", mode))}
        />
        <p className="m-0 text-[12px] font-semibold text-ui-ink">
          {es["editor.menuPanel.sectionsOf"].replace("{page}", state.pageTitle)}
        </p>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {state.sectionRows.map((row) => (
            <SectionEntryRow
              key={row.sectionId}
              row={row}
              onSetInMenu={onSetSectionInMenu}
              onSetLabel={onSetMenuLabel}
            />
          ))}
        </ul>
        <div role="radiogroup" aria-label={es["editor.menuPanel.sectionsMobile"]}>
          <p className="m-0 mb-1 text-[12px] font-semibold text-ui-ink" aria-hidden="true">
            {es["editor.menuPanel.sectionsMobile"]}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["row", "hidden"] as const).map((mobile) => (
              <Segment
                key={mobile}
                name={`${groupId}-mobile`}
                label={
                  mobile === "row"
                    ? es["editor.menuPanel.mobileRow"]
                    : es["editor.menuPanel.mobileHidden"]
                }
                checked={state.sectionsMobile === mobile}
                onSelect={() => onSetHeader(sectionsMobilePatch(doc, mobile))}
              />
            ))}
          </div>
        </div>
      </fieldset>

      {/* 3. The button: none, or one destination among the pages and the sections of this page. */}
      <fieldset className={blockClass}>
        <legend className={legendClass}>{es["editor.menuPanel.action"]}</legend>
        <div className="flex flex-col gap-1.5">
          <Choice
            name={`${groupId}-action`}
            label={es["editor.menuPanel.actionNone"]}
            checked={state.actionKey === null}
            onSelect={() => onSetHeaderAction(null)}
          />
          {(["page", "section"] as const).map((kind) => {
            const choices = state.actionChoices.filter((choice) => choice.kind === kind);
            if (choices.length === 0) return null;
            return (
              <fieldset key={kind} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
                <legend className="float-left mt-1 mb-1.5 w-full p-0 text-[12px] font-semibold text-ui-muted">
                  {kind === "page"
                    ? es["editor.menuPanel.actionPages"]
                    : es["editor.menuPanel.actionSections"]}
                </legend>
                {choices.map((choice) => (
                  <Choice
                    key={choice.key}
                    name={`${groupId}-action`}
                    label={
                      choice.where === undefined
                        ? choice.label
                        : es["editor.menuPanel.actionWhere"]
                            .replace("{label}", choice.label)
                            .replace("{page}", choice.where)
                    }
                    checked={state.actionKey === choice.key}
                    onSelect={() => onSetHeaderAction(choice.action)}
                  />
                ))}
              </fieldset>
            );
          })}
        </div>
        {chosenAction === undefined ? null : (
          <p className={noteClass}>
            {(state.actionLeavesMenu
              ? es["editor.menuPanel.actionNote"]
              : es["editor.menuPanel.actionNoteAlone"]
            ).replace("{label}", chosenAction.label)}
          </p>
        )}
      </fieldset>

      {/* 4. How the bar sits: three layouts drawn as what they are, fixed or not, a line or not. */}
      <fieldset className={blockClass}>
        <legend className={legendClass}>{es["editor.menuPanel.layout"]}</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {LAYOUTS.map((layout) => (
            <label
              key={layout}
              className={`relative flex cursor-pointer flex-col items-center gap-1.5 px-1.5 py-2 ${
                state.layout === layout ? panelRowSelected : panelRow
              }`}
            >
              <input
                type="radio"
                name={`${groupId}-layout`}
                checked={state.layout === layout}
                onChange={() => onSetHeader({ layout })}
                className="absolute h-px w-px opacity-0"
              />
              <LayoutSketch layout={layout} />
              <span className="text-center text-[12px] leading-tight font-medium text-ui-ink">
                {es[`editor.menuPanel.layout.${layout}`]}
              </span>
            </label>
          ))}
        </div>
        <Check
          label={es["editor.menuPanel.sticky"]}
          checked={state.sticky}
          onChange={(sticky) => onSetHeader({ sticky })}
          notes={[
            state.phoneRow
              ? es["editor.menuPanel.stickyPhoneRow"]
              : es["editor.menuPanel.stickyPhone"],
            ...(state.transparent ? [es["editor.menuPanel.stickyTransparent"]] : []),
          ]}
        />
        <Check
          label={es["editor.menuPanel.hairline"]}
          checked={state.hairline}
          onChange={(hairline) => onSetHeader({ hairline })}
          notes={state.transparent ? [es["editor.menuPanel.hairlineTransparent"]] : []}
        />
      </fieldset>

      {/* 5. The look (día 6): the bar's colour from the palette, where the links go, how far apart,
          in capitals or not, underlined on hover, and the size of the letter. Every option a token,
          every pair one the palettes are proved against — except a bar over a photograph. */}
      <fieldset className={blockClass}>
        <legend className={legendClass}>{es["editor.menuPanel.look"]}</legend>
        <div role="radiogroup" aria-label={es["editor.menuPanel.background"]}>
          <p className="m-0 mb-1 text-[12px] font-semibold text-ui-ink" aria-hidden="true">
            {es["editor.menuPanel.background"]}
          </p>
          <div className="grid grid-cols-3 gap-1.5 phone:grid-cols-2">
            {HEADER_BACKGROUNDS.map((background) => {
              const swatch = schemeSwatch(doc, background);
              const checked = state.look.background === background;
              return (
                <label
                  key={background}
                  className={`relative flex cursor-pointer flex-col items-stretch gap-1 p-1.5 ${
                    checked ? panelRowSelected : panelRow
                  }`}
                >
                  <input
                    type="radio"
                    name={`${groupId}-background`}
                    checked={checked}
                    onChange={() => onSetHeader(lookPatch(doc, { background }))}
                    className="absolute h-px w-px opacity-0"
                  />
                  {/* The bar's colour with a word in the colour its words take, from this site's
                      palette. A transparent bar shows the page through it: dashed, over the
                      page's own colour, since what is really under it is the cover. */}
                  <span
                    aria-hidden="true"
                    style={{ background: swatch.bar, color: swatch.text }}
                    className={`flex h-7 items-center justify-center rounded-ui-sm text-[13px] font-bold ${
                      background === "transparent"
                        ? "border border-dashed border-ui-border-strong"
                        : "border border-black/10"
                    }`}
                  >
                    Aa
                  </span>
                  <span
                    className={`text-center text-[12px] leading-tight ${
                      checked ? "font-semibold text-ui-brand-deep" : "text-ui-ink"
                    }`}
                  >
                    {es[`editor.menuPanel.background.${background}`]}
                  </span>
                </label>
              );
            })}
          </div>
          {state.transparent ? (
            <p className={`${noteClass} mt-1.5`}>{es["editor.menuPanel.backgroundTransparent"]}</p>
          ) : null}
        </div>
        <Segments
          name={`${groupId}-align`}
          label={es["editor.menuPanel.align"]}
          options={HEADER_ALIGNMENTS}
          value={state.look.align}
          labelOf={(align) => es[`editor.menuPanel.align.${align}`]}
          onSelect={(align) => onSetHeader(lookPatch(doc, { align }))}
        />
        <Segments
          name={`${groupId}-gap`}
          label={es["editor.menuPanel.gap"]}
          options={HEADER_GAPS}
          value={state.look.gap}
          labelOf={(gap) => es[`editor.menuPanel.gap.${gap}`]}
          onSelect={(gap) => onSetHeader(lookPatch(doc, { gap }))}
        />
        <Segments
          name={`${groupId}-size`}
          label={es["editor.menuPanel.size"]}
          options={HEADER_SIZES}
          value={state.look.size}
          labelOf={(size) => es[`editor.menuPanel.size.${size}`]}
          onSelect={(size) => onSetHeader(lookPatch(doc, { size }))}
        />
        <Check
          label={es["editor.menuPanel.uppercase"]}
          checked={state.look.uppercase}
          onChange={(uppercase) => onSetHeader(lookPatch(doc, { uppercase }))}
          notes={[]}
        />
        <Check
          label={es["editor.menuPanel.hoverUnderline"]}
          checked={state.look.hoverUnderline}
          onChange={(hoverUnderline) => onSetHeader(lookPatch(doc, { hoverUnderline }))}
          notes={[es["editor.menuPanel.hoverUnderlineNote"]]}
        />
        {state.sectionsMenu.drawn ? (
          <Check
            label={es["editor.menuPanel.sectionsRow"]}
            checked={state.sectionsPosition === "row"}
            onChange={(own) => onSetHeader(sectionsPositionPatch(doc, own ? "row" : "bar"))}
            notes={[es["editor.menuPanel.sectionsRowNote"]]}
          />
        ) : null}

        {designTools ? (
          <fieldset className="m-0 mt-1 flex min-w-0 flex-col gap-2 border-0 border-t border-ui-border p-0 pt-3">
            <legend className="float-left mb-1 w-full p-0 text-[12px] font-semibold text-ui-ink">
              {es["editor.menuPanel.exact"]}
            </legend>
            <p className={noteClass}>{es["editor.menuPanel.exactHelp"]}</p>
            {state.parts.map((part) => (
              <ExactPart
                key={part}
                part={part}
                color={headerColorInForce(doc, part)}
                colorExact={headerExact(doc, part, "color")}
                sizeExact={SIZED_PARTS.has(part) ? headerExact(doc, part, "fontSize") : null}
                onSet={(property, exact) =>
                  onSetHeader(headerStylePatch(doc, part, property, exact))
                }
                onClear={() => onSetHeader(headerStylePatch(doc, part, undefined, undefined))}
              />
            ))}
          </fieldset>
        ) : null}
      </fieldset>
    </aside>
  );
}

/**
 * «Automático / Siempre / Nunca» — `shown` absent, `true`, `false` — and under it what that does to
 * this page right now. The sentence is outside the group's name for the reason «Campos» keeps its
 * count outside its label: it changes as other switches move, and a name should not.
 */
function ModeSwitch({
  name,
  label,
  block,
  menu,
  onChange,
}: {
  name: string;
  label: string;
  block: MenuBlock;
  menu: "pages" | "sections";
  onChange: (mode: MenuMode) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1.5">
        {MODES.map((mode) => (
          <Segment
            key={mode}
            name={name}
            label={es[`editor.menuPanel.mode.${mode}`]}
            checked={block.mode === mode}
            onSelect={() => onChange(mode)}
          />
        ))}
      </div>
      <p className={noteClass}>{menuStatusText(block, menu)}</p>
    </div>
  );
}

/** A short row of radios with its name above it — alignment, gap, size. */
function Segments<T extends string>({
  name,
  label,
  options,
  value,
  labelOf,
  onSelect,
}: {
  name: string;
  label: string;
  options: readonly T[];
  value: T;
  labelOf: (option: T) => string;
  onSelect: (option: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="m-0 mb-1 text-[12px] font-semibold text-ui-ink" aria-hidden="true">
        {label}
      </p>
      <div className={`grid gap-1.5 ${options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((option) => (
          <Segment
            key={option}
            name={name}
            label={labelOf(option)}
            checked={value === option}
            onSelect={() => onSelect(option)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One part's exact colour and size — the text toolbar's two exact controls, the same platform
 * `<input type="color">` (it can only produce `#rrggbb`, which is what the schema admits) and the
 * same whole pixels from 8 to 200. Both commit on the **native** `change` — the picker closing, the
 * field left or Enter pressed — and not on React's `onChange`, which is the `input` event: dragging
 * across the colour wheel would open a step of history per pixel, and typing «120» would publish a
 * 12px bar on the way. «Volver al sistema» appears once the part holds anything of its own, and
 * drops both in one step.
 */
function ExactPart({
  part,
  color,
  colorExact,
  sizeExact,
  onSet,
  onClear,
}: {
  part: HeaderPart;
  /** The colour in force, exact or the scheme's: what the input starts from. */
  color: string;
  colorExact: string | undefined;
  /** The exact size, `undefined` when none, `null` for the bar, which takes no size. */
  sizeExact: string | undefined | null;
  onSet: (property: "color" | "fontSize", exact: string | undefined) => void;
  onClear: () => void;
}) {
  const name = es[`editor.menuPanel.exact.part.${part}`];
  const onSetNow = useRef(onSet);
  onSetNow.current = onSet;
  const colorInput = useRef<HTMLInputElement>(null);
  const sizeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const colorNode = colorInput.current;
    const sizeNode = sizeInput.current;
    const onColor = () => {
      if (colorNode) onSetNow.current("color", colorNode.value);
    };
    const onSize = () => {
      if (!sizeNode) return;
      const raw = sizeNode.value.trim();
      if (raw === "") return onSetNow.current("fontSize", undefined);
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 8 || number > 200) return;
      onSetNow.current("fontSize", `${Math.round(number)}px`);
    };
    colorNode?.addEventListener("change", onColor);
    sizeNode?.addEventListener("change", onSize);
    return () => {
      colorNode?.removeEventListener("change", onColor);
      sizeNode?.removeEventListener("change", onSize);
    };
  }, []);
  // Uncontrolled, so a value the owner is still choosing is never overwritten mid-gesture; what the
  // document holds is written in whenever it changes — a new scheme, or «Volver al sistema».
  useEffect(() => {
    if (colorInput.current) colorInput.current.value = color;
  }, [color]);
  const sizeShown =
    typeof sizeExact === "string" && sizeExact.endsWith("px") ? sizeExact.slice(0, -2) : "";
  useEffect(() => {
    if (sizeInput.current) sizeInput.current.value = sizeShown;
  }, [sizeShown]);
  const own = colorExact !== undefined || (sizeExact !== null && sizeExact !== undefined);
  return (
    <div
      data-part={part}
      className="flex flex-wrap items-center gap-2 rounded-ui border border-ui-border bg-ui-surface p-2"
    >
      {/* The name on a line of its own: beside the two inputs and «Volver al sistema», «Botón»
          was cut to «Bot» at the panel's width (seen on día 6). */}
      <span className="w-full min-w-0 text-[13px] font-semibold text-ui-ink">{name}</span>
      <input
        ref={colorInput}
        type="color"
        defaultValue={color}
        aria-label={es[
          part === "bar" ? "editor.menuPanel.exactBarColor" : "editor.menuPanel.exactColor"
        ].replace("{part}", name)}
        className={`h-8 w-10 shrink-0 cursor-pointer rounded-ui-sm border bg-white p-0.5 ${
          colorExact === undefined ? "border-ui-border" : "border-ui-brand"
        }`}
      />
      {sizeExact === null ? null : (
        <input
          ref={sizeInput}
          type="number"
          min={8}
          max={200}
          placeholder="px"
          defaultValue={sizeShown}
          aria-label={es["editor.menuPanel.exactSize"].replace("{part}", name)}
          className={`w-16 shrink-0 rounded-ui-sm border bg-white px-2 py-1 text-[13px] phone:text-base text-ui-ink ${
            sizeExact === undefined ? "border-ui-border" : "border-ui-brand"
          }`}
        />
      )}
      {own ? (
        <span className="ml-auto">
          <SmallButton label={es["editor.design.exceptionBack"]} onClick={onClear} />
        </span>
      ) : null}
    </div>
  );
}

/** One option of a short row of radios, drawn as a segment. */
function Segment({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`relative flex min-h-9 cursor-pointer items-center justify-center px-1.5 py-1 text-center text-[12px] leading-tight ${
        checked ? `${panelRowSelected} font-semibold text-ui-brand-deep` : `${panelRow} text-ui-ink`
      }`}
    >
      {/* Visually hidden rather than `display: none`, so the arrows still move along the group. */}
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="absolute h-px w-px opacity-0"
      />
      {label}
    </label>
  );
}

/** One option of a list of radios: the button's destinations. */
function Choice({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] ${
        checked ? `${panelRowSelected} font-semibold text-ui-brand-deep` : `${panelRow} text-ui-ink`
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className={checkboxClass}
      />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
  notes,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  notes: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="ui-interactive flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ui-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className={checkboxClass}
        />
        {label}
      </label>
      {/* Outside the label, like every note in these panels: they are about the site, and a
          checkbox's accessible name should not be three sentences long. */}
      {notes.map((note) => (
        <p key={note} className={`${noteClass} pl-6`}>
          {note}
        </p>
      ))}
    </div>
  );
}

function PageEntryRow({
  row,
  onSetInMenu,
  onSetLabel,
}: {
  row: PageRow;
  onSetInMenu: (pageId: string, inMenu: boolean) => void;
  onSetLabel: (target: MenuLabelTarget, label: string | null) => void;
}) {
  const reason =
    row.reason === "home"
      ? es["editor.menuPanel.reason.home"]
      : row.reason === "perEntry"
        ? es["editor.menuPanel.reason.perEntry"]
        : undefined;
  return (
    <EntryRow
      name={row.title}
      inMenu={row.inMenu}
      onSetInMenu={(inMenu) => onSetInMenu(row.pageId, inMenu)}
      reason={reason}
      inButton={row.inButton}
      // A page drawn per entry is in no menu, so a word for it would be read by nobody; the first
      // page's word is read wherever the way back to it is drawn.
      label={
        row.reason === "perEntry"
          ? undefined
          : {
              derived: row.derived,
              own: row.own,
              onCommit: (label) => onSetLabel({ kind: "page", pageId: row.pageId }, label),
            }
      }
    />
  );
}

function SectionEntryRow({
  row,
  onSetInMenu,
  onSetLabel,
}: {
  row: SectionRow;
  onSetInMenu: (sectionId: string, inMenu: boolean) => void;
  onSetLabel: (target: MenuLabelTarget, label: string | null) => void;
}) {
  const derived = row.derived;
  return (
    <EntryRow
      name={row.name}
      inMenu={row.inMenu}
      onSetInMenu={(inMenu) => onSetInMenu(row.sectionId, inMenu)}
      reason={row.reason === undefined ? undefined : es[`editor.menuPanel.reason.${row.reason}`]}
      inButton={row.inButton}
      label={
        derived === undefined
          ? undefined
          : {
              derived,
              own: row.own,
              onCommit: (label) => onSetLabel({ kind: "section", sectionId: row.sectionId }, label),
            }
      }
    />
  );
}

/**
 * One destination: its switch (or the reason it has none), and «Se lee como…».
 *
 * An entry that cannot be in the menu is **shown in grey with its reason** rather than left out:
 * the owner is looking at a page of six sections and a list of four, and the two missing ones are
 * exactly the ones they will wonder about.
 */
function EntryRow({
  name,
  inMenu,
  onSetInMenu,
  reason,
  inButton,
  label,
}: {
  name: string;
  inMenu: boolean | null;
  onSetInMenu: (inMenu: boolean) => void;
  reason: string | undefined;
  inButton: boolean;
  label:
    | { derived: string; own: string | undefined; onCommit: (label: string | null) => void }
    | undefined;
}) {
  return (
    <li className="flex flex-col gap-1.5 rounded-ui border border-ui-border bg-ui-surface p-2">
      {inMenu === null ? (
        <span className="text-[13px] font-semibold text-ui-muted">{name}</span>
      ) : (
        <label className="ui-interactive flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ui-ink">
          <input
            type="checkbox"
            checked={inMenu}
            onChange={(event) => onSetInMenu(event.target.checked)}
            className={checkboxClass}
          />
          <span className="min-w-0 truncate">{name}</span>
        </label>
      )}
      {reason === undefined ? null : <p className={noteClass}>{reason}</p>}
      {inButton ? <p className={noteClass}>{es["editor.menuPanel.inButton"]}</p> : null}
      {label === undefined ? null : (
        <LabelField name={name} derived={label.derived} own={label.own} onCommit={label.onCommit} />
      )}
    </li>
  );
}

/**
 * «Se lee como…» — the entry's own words, with the derived ones as the placeholder.
 *
 * **Committed as the owner types, whenever what is in the box is a label the schema accepts** —
 * two to twenty letters, or nothing, which goes back to the derived word — so the canvas's header
 * says «Carta» while «Carta» is being typed, and the history amends one step for the whole word
 * (`documentHistory.ts`, `setMenuLabel`). A box holding one letter, or twenty-one, writes nothing:
 * the warning says why, and the last valid label stands. Leaving the field puts the box back to
 * what the document holds, so nothing the canvas does not show is left looking saved.
 */
function LabelField({
  name,
  derived,
  own,
  onCommit,
}: {
  name: string;
  derived: string;
  own: string | undefined;
  onCommit: (label: string | null) => void;
}) {
  const id = useId();
  const warningId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? own ?? "";
  const issue = value.trim() === "" ? undefined : menuLabelIssue(value);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] text-ui-muted">
        <span aria-hidden="true">{es["editor.menuPanel.readsAs"]}</span>
        <span className="sr-only">{es["editor.menuPanel.readsAsFor"].replace("{name}", name)}</span>
      </label>
      <input
        id={id}
        value={value}
        placeholder={derived}
        maxLength={MENU_LABEL_MAX + 10}
        aria-invalid={issue === undefined ? undefined : true}
        aria-describedby={issue === undefined ? undefined : warningId}
        onFocus={() => setDraft(own ?? "")}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next.trim() === "") onCommit(null);
          else if (menuLabelIssue(next) === undefined) onCommit(next.trim());
        }}
        onBlur={() => setDraft(null)}
        className={`min-w-0 rounded-ui-sm border bg-white px-2 py-1 text-[13px] phone:text-base text-ui-ink ${
          issue === undefined ? "border-ui-border" : "border-ui-danger-deep"
        }`}
      />
      {issue === undefined ? null : (
        <p id={warningId} className="m-0 text-[12px] leading-snug text-ui-danger-deep">
          {es["editor.menuPanel.labelBounds"]
            .replace("{min}", String(MENU_LABEL_MIN))
            .replace("{max}", String(MENU_LABEL_MAX))}
        </p>
      )}
    </div>
  );
}

/** The three layouts drawn as what they are: where the brand sits and where the links go. */
function LayoutSketch({ layout }: { layout: HeaderLayout }) {
  const brand = "var(--ui-brand)";
  const link = "var(--ui-muted)";
  return (
    <svg width="64" height="32" viewBox="0 0 64 32" aria-hidden="true">
      <rect x="0.5" y="0.5" width="63" height="31" rx="3" fill="white" stroke="#E3E8F0" />
      {layout === "brand-left" ? (
        <>
          <rect x="6" y="13" width="16" height="6" rx="1.5" fill={brand} />
          <rect x="34" y="14.5" width="7" height="3" rx="1" fill={link} />
          <rect x="44" y="14.5" width="7" height="3" rx="1" fill={link} />
          <rect x="54" y="14.5" width="5" height="3" rx="1" fill={link} />
        </>
      ) : layout === "centered" ? (
        <>
          <rect x="9" y="13" width="14" height="6" rx="1.5" fill={brand} />
          <rect x="27" y="14.5" width="8" height="3" rx="1" fill={link} />
          <rect x="38" y="14.5" width="8" height="3" rx="1" fill={link} />
          <rect x="49" y="14.5" width="6" height="3" rx="1" fill={link} />
        </>
      ) : (
        <>
          <rect x="24" y="6" width="16" height="6" rx="1.5" fill={brand} />
          <rect x="15" y="20" width="9" height="3" rx="1" fill={link} />
          <rect x="27" y="20" width="9" height="3" rx="1" fill={link} />
          <rect x="39" y="20" width="9" height="3" rx="1" fill={link} />
        </>
      )}
    </svg>
  );
}
