"use client";

import type { Theme } from "@retorika/schema";
import {
  identifyPalette,
  identifyScale,
  identifyTypePair,
  PALETTES,
  RENDERED_COLOR_KEYS,
  SCALES,
  TYPE_PAIRS,
} from "@retorika/tokens";
import tokensEs from "@retorika/tokens/locales/es" with { type: "json" };
import { useId } from "react";
import { panelCard, panelRow, panelRowSelected } from "../editor/panelKit.tsx";
import es from "../locales/es.json" with { type: "json" };

/**
 * "El estilo de toda la web" — mockup 13, reconciled with what the code can honestly offer.
 *
 * Four palettes and three typefaces, as radio groups. Real `<input type="radio">` inside the
 * `<label>`, visually hidden, which is the pattern the mockup itself draws and the one that gets
 * keyboard arrows, grouping and the announced choice for free. A `<div>` with an `onClick` would
 * have to reimplement all three, worse.
 *
 * **Three deliberate divergences from the mockup, each recorded in `docs/design/REVIEW.md`:**
 *
 * - **No "Avanzado: colores exactos y tamaños".** The mockup's last row opens a free colour
 *   picker. It is not implemented and not planned: `REVIEW.md` already ruled that "a palette that
 *   is not contrast-tested cannot ship", and the protocol puts it more strongly still — a palette
 *   with bad contrast cannot even be declared. A picker is a machine for producing exactly that.
 *   It is the same warn-or-block line the rest of the product draws, applied to colour.
 * - **The typefaces are named by character, never by font.** The mockup labels them `Inter`,
 *   `Poppins` and `Source Serif`. Issue #9: Inter and Playfair Display fall back to something else
 *   on a machine that lacks them, and ADR 0001 forbids downloading either — so a label saying
 *   "Inter" promises a font that may never arrive. "Moderna y neutra" is true whichever font
 *   resolves. The `Aa` specimen is rendered in the actual stack, so what it shows *is* what the
 *   owner will get, fallback included.
 * - **Five swatches, but not the mockup's five.** Ours are the five colours the stylesheet
 *   actually paints with; `color.accent` is left out because no rule reads it and its contrast is
 *   asserted nowhere. See `RENDERED_COLOR_KEYS`.
 *
 * **A third group, `MEDIDAS`, appears only with the design tools on** (sprint 9). That is the
 * advanced dossier §4's own line: apagado the panel offers «Paletas y parejas tipográficas»,
 * encendido it «Añade el sistema y tipografías propias». This delivers the first half of that
 * sentence and not the second — «tipografías propias» waits for issue #9, because a font the
 * visitor may never receive is a promise this product does not make, and ADR 0026 says so by name
 * rather than leaving the omission to be noticed later.
 *
 * **The dossier's word is «el sistema» and the legend says «MEDIDAS».** Not a divergence from an
 * approved screen — mockup 13 draws no such group at all, and mockup 17, which does, labels it
 * exactly this — so it is not in the list above and there is nothing for `REVIEW.md` to record.
 * It is a copy choice, for the same reason the typefaces are named by character and never by
 * font: «el sistema» is what the document calls the thing and «medidas» is what the owner sees
 * change. The help line under the legend says which three — el tamaño del texto, el aire entre
 * las cosas y las esquinas.
 *
 * Nothing here holds state. Which palette is ticked is *deduced* from the document's own theme,
 * because a theme keeps values and not identities — see `identifyPalette`. That is why the tick
 * cannot go stale: there is no second copy of the answer to drift.
 */

export interface StylePanelProps {
  theme: Theme;
  onPickPalette: (paletteId: string) => void;
  onPickTypePair: (typePairId: string) => void;
  onPickScale: (scaleId: string) => void;
  /**
   * Whether the design tools are on for the person looking — nothing about the site.
   *
   * It gates the `SISTEMA` group and nothing else, and it gates it by **not rendering it**: a
   * disabled fieldset would tell somebody who is not a professional that there is a door they
   * cannot open, which is the opposite of what the switch is for (ADR 0025). The same rule the
   * `Diseño` rail item already follows.
   */
  designTools: boolean;
  onClose: () => void;
}

function nameOf(nameKey: string): string {
  return tokensEs[nameKey as keyof typeof tokensEs] ?? nameKey;
}

export function StylePanel({
  theme,
  onPickPalette,
  onPickTypePair,
  onPickScale,
  designTools,
  onClose,
}: StylePanelProps) {
  const headingId = useId();
  const paletteGroup = useId();
  const typeGroup = useId();
  const scaleGroup = useId();
  const current = identifyPalette(theme);
  const currentType = identifyTypePair(theme);
  const currentScale = identifyScale(theme);

  return (
    <aside
      aria-labelledby={headingId}
      // In the flow to the right of the canvas, not fixed over it, which is how mockup 13 draws
      // it: the preview narrows and stays fully visible while the choice is being made. The
      // fields panel is fixed instead, because that one docks over a card that can itself be
      // 400px wide in the mobile view.
      className={`w-[372px] gap-[18px] p-6 ${panelCard}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[20px] font-bold tracking-[-0.02em] text-ui-ink">
            {es["editor.style.title"]}
          </h2>
          <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.style.help"]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={es["editor.style.close"]}
          className="shrink-0 cursor-pointer border-0 bg-transparent text-ui-muted"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <fieldset className="m-0 flex flex-col gap-[9px] border-0 p-0">
        <legend className="mb-1 p-0 text-[11px] font-bold tracking-[0.09em] text-ui-muted">
          {es["editor.style.colors"]}
        </legend>
        {current === undefined ? (
          // Not an error and not a blank space to wonder about: the honest state for a theme no
          // palette produced, which a restored document or a hand-edited one can be. Clicking any
          // palette resolves it.
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.style.noPalette"]}
          </p>
        ) : null}
        {PALETTES.map((palette) => {
          const selected = current?.id === palette.id;
          return (
            <label
              key={palette.id}
              className={
                "relative flex h-14 cursor-pointer items-center gap-3.5 px-4 " +
                (selected ? panelRowSelected : panelRow)
              }
            >
              <input
                type="radio"
                name={paletteGroup}
                checked={selected}
                onChange={() => onPickPalette(palette.id)}
                // Visually hidden rather than `display: none`: a hidden input is out of the tab
                // order and out of the group, so arrow keys would stop working.
                className="absolute h-px w-px opacity-0"
              />
              <span className="flex gap-1.5" aria-hidden="true">
                {RENDERED_COLOR_KEYS.map((key) => (
                  <span
                    key={key}
                    className="h-[17px] w-[17px] rounded-full border border-black/10"
                    style={{ background: palette.colors[key] }}
                  />
                ))}
              </span>
              <span
                className={
                  "text-[15px] " +
                  (selected ? "font-semibold text-ui-ink" : "font-medium text-ui-ink")
                }
              >
                {nameOf(palette.nameKey)}
              </span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-[9px] border-0 p-0">
        <legend className="mb-1 p-0 text-[11px] font-bold tracking-[0.09em] text-ui-muted">
          {es["editor.style.typography"]}
        </legend>
        {currentType === undefined ? (
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.style.noTypePair"]}
          </p>
        ) : null}
        {TYPE_PAIRS.map((pair) => {
          const selected = currentType?.id === pair.id;
          return (
            <label
              key={pair.id}
              className={
                "relative flex h-14 cursor-pointer items-center gap-3.5 px-4 " +
                (selected ? panelRowSelected : panelRow)
              }
            >
              <input
                type="radio"
                name={typeGroup}
                checked={selected}
                onChange={() => onPickTypePair(pair.id)}
                className="absolute h-px w-px opacity-0"
              />
              {/* The specimen is drawn in the pair's own heading stack, so it shows the font that
                  will actually resolve on this machine — which is the whole reason the label next
                  to it does not name one (issue #9). */}
              <span
                aria-hidden="true"
                className="w-8 shrink-0 text-center text-[22px] leading-none text-ui-ink"
                style={{ fontFamily: pair.fonts["font.heading"] }}
              >
                {es["editor.style.specimen"]}
              </span>
              <span
                className={
                  "text-[15px] " +
                  (selected ? "font-semibold text-ui-ink" : "font-medium text-ui-ink")
                }
              >
                {nameOf(pair.nameKey)}
              </span>
            </label>
          );
        })}
      </fieldset>

      {designTools ? (
        <fieldset className="m-0 flex flex-col gap-[9px] border-0 p-0">
          <legend className="p-0 text-[11px] font-bold tracking-[0.09em] text-ui-muted">
            {es["editor.style.system"]}
          </legend>
          {/* The one group of the three that needs saying out loud what it changes: a palette and a
              typeface announce themselves in their own swatches, and "medidas" does not. */}
          <p className="m-0 mb-1 text-[12px] leading-snug text-ui-muted">
            {es["editor.style.systemHelp"]}
          </p>
          {currentScale === undefined ? (
            <p className="m-0 text-[12px] leading-snug text-ui-muted">
              {es["editor.style.noScale"]}
            </p>
          ) : null}
          {SCALES.map((scale) => {
            const selected = currentScale?.id === scale.id;
            return (
              <label
                key={scale.id}
                className={
                  "relative flex h-14 cursor-pointer items-center gap-3.5 px-4 " +
                  (selected ? panelRowSelected : panelRow)
                }
              >
                <input
                  type="radio"
                  name={scaleGroup}
                  checked={selected}
                  onChange={() => onPickScale(scale.id)}
                  className="absolute h-px w-px opacity-0"
                />
                {/* Drawn from the scale's own eleven values, for the same reason the `Aa` above is
                    drawn in the pair's own font stack: what the specimen shows *is* what the site
                    will get. The corner is this scale's `radius.md` and the gap its `space.xs`,
                    both used literally; only the bar's height is scaled, and by `calc()` rather
                    than by parsing the string, so a value in `rem` and one in `px` both work
                    without this file knowing which it was given. */}
                <span
                  aria-hidden="true"
                  className="flex w-10 shrink-0 flex-col justify-center border border-ui-border bg-white px-1.5"
                  style={{
                    height: 38,
                    borderRadius: scale.radii["radius.md"],
                    gap: scale.spaces["space.xs"],
                  }}
                >
                  <span
                    style={{
                      height: `calc(${scale.sizes["size.heading"]} * 0.28)`,
                      borderRadius: 1,
                      background: "#334155",
                    }}
                  />
                  <span style={{ height: 2, borderRadius: 1, background: "#CBD5E1" }} />
                </span>
                <span
                  className={
                    "text-[15px] " +
                    (selected ? "font-semibold text-ui-ink" : "font-medium text-ui-ink")
                  }
                >
                  {nameOf(scale.nameKey)}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
    </aside>
  );
}
