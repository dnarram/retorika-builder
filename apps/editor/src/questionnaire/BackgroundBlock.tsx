"use client";

import {
  BACKGROUND_PAINTS,
  type Background,
  type BackgroundPaint,
  type Theme,
  veilFor,
} from "@retorika/schema";
import { useEffect, useId, useRef, useState } from "react";
import {
  PREVIEW_TILE_MAX,
  veilColoursOf,
  veilNoteText,
  veilReason,
} from "../editor/backgroundMotif.ts";
import { ACCEPTED_IMAGE_ACCEPT } from "../editor/imageBytes.ts";
import { Note, PanelSection, Segments, SmallButton } from "../editor/panelKit.tsx";
import { type PreparedBackground, photoBlob, prepareBackground } from "../editor/photos.ts";
import es from "../locales/es.json" with { type: "json" };

/**
 * **A background with motifs, chosen where the owner can see it veiled** (ADR 0081, sprint 40 día 6):
 * one block, drawn in «Estilo» for the whole site and at the foot of «Campos» for one section.
 *
 * David's condition: «el panel enseña el motivo ya con su velo antes de guardar, y si el velo sale por
 * encima de un umbral, una nota en palabras llanas dice por qué». So a picture chosen is **prepared
 * and shown first** — its tile, the veil `veilFor` derives for it under the theme as it is now, a line
 * of the theme's text over both — and only «Usar este fondo» writes the document. The note says the
 * cause that is true (`veilReason`): a motif too dark for a light page, too light for a dark one, or
 * colours whose text barely reads on the plain surface, under which even a soft motif shows little.
 *
 * Its own file input, so the block is the same in both panels and needs nothing of the canvas.
 */

export interface BackgroundBlockProps {
  /** The panel's name for it: «Fondo de la web», «Fondo de esta sección». */
  legend: string;
  /** Which block, for its file input's test id. */
  scope: "site" | "section";
  theme: Theme;
  current: Background | undefined;
  /** The object URL the current picture is drawn from in this browser, when its bytes are here. */
  currentUrl: string | undefined;
  onUse: (prepared: PreparedBackground, paint: BackgroundPaint) => void;
  onSet: (background: Background | null) => void;
  /**
   * A count that rises each time the section's «Fondo» verb is pressed (sprint 40 día 7): the block
   * then comes into view and its first control takes the keyboard. On the next frame, because «Campos»
   * gives the keyboard to its own head when it opens, in an effect that runs after this one.
   */
  arrival?: number;
}

interface Pending {
  prepared: PreparedBackground;
  url: string;
  paint: BackgroundPaint;
}

export function BackgroundBlock({
  legend,
  scope,
  theme,
  current,
  currentUrl,
  onUse,
  onSet,
  arrival = 0,
}: BackgroundBlockProps) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  /** A later choice wins over a slower earlier one, as with the logo (`logoTurn`). */
  const turn = useRef(0);
  const paintName = useId();

  // The preview's object URL goes with the preview: replaced, used, cancelled or unmounted.
  useEffect(() => {
    if (!pending) return;
    const url = pending.url;
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  useEffect(() => {
    if (arrival === 0) return;
    const frame = requestAnimationFrame(() => {
      const host = document.querySelector<HTMLElement>(`[data-background="${scope}"]`);
      host?.scrollIntoView({ block: "nearest" });
      host?.querySelector<HTMLElement>("button, input:not([type=file])")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [arrival, scope]);

  async function choose(file: File) {
    turn.current += 1;
    const mine = turn.current;
    setError(null);
    setReading(true);
    const result = await prepareBackground(file);
    if (mine !== turn.current) return;
    setReading(false);
    if (!result.ok) {
      setError(es[`editor.background.${result.error.reason}` as keyof typeof es]);
      return;
    }
    const prepared = result.background;
    setPending({
      prepared,
      url: URL.createObjectURL(photoBlob(prepared.bytes, prepared.type)),
      paint: current?.paint ?? "tile",
    });
  }

  const shown = pending
    ? {
        url: pending.url,
        paint: pending.paint,
        width: pending.prepared.width,
        height: pending.prepared.height,
        extremes: pending.prepared.extremes,
      }
    : current
      ? { url: currentUrl, ...current }
      : null;
  const alpha = shown ? veilFor(veilColoursOf(theme), shown.extremes) : 0;
  const reason = shown ? veilReason(theme, shown.extremes) : null;

  return (
    <PanelSection legend={legend} data-background={scope}>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        className="hidden"
        data-testid={`background-input-${scope}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void choose(file);
        }}
      />
      {shown ? (
        <>
          <div
            role="img"
            aria-label={es["editor.background.previewLabel"]}
            data-background-preview={pending ? "pending" : "current"}
            data-veil={alpha}
            className="relative h-[120px] overflow-hidden rounded-ui border border-ui-border"
            style={{
              backgroundColor: theme["color.surface"],
              ...(shown.url ? { backgroundImage: `url("${shown.url}")` } : {}),
              backgroundRepeat: shown.paint === "tile" ? "repeat" : "no-repeat",
              backgroundPosition: shown.paint === "tile" ? "center top" : "center",
              backgroundSize:
                shown.paint === "tile"
                  ? `${Math.min(shown.width, PREVIEW_TILE_MAX)}px auto`
                  : "cover",
            }}
          >
            {/* The veil the page will draw, at the opacity the page will compute (`veilFor`). */}
            <span
              aria-hidden="true"
              data-background-veil=""
              className="absolute inset-0"
              style={{ backgroundColor: theme["color.surface"], opacity: alpha / 100 }}
            />
            <span
              aria-hidden="true"
              className="relative flex h-full items-center justify-center px-3 text-center text-[15px] font-semibold"
              style={{ color: theme["color.ink"], fontFamily: theme["font.body"] }}
            >
              {es["editor.background.sample"]}
            </span>
          </div>
          {reason ? <Note tone="warn">{veilNoteText(reason)}</Note> : null}
          {pending?.prepared.heavy ? (
            <Note tone="warn">
              {es["editor.background.heavy"].replace(
                "{kb}",
                String(Math.round(pending.prepared.bytes.byteLength / 1024)),
              )}
            </Note>
          ) : null}
          <Segments
            name={paintName}
            label={es["editor.background.paint"]}
            options={BACKGROUND_PAINTS}
            value={shown.paint}
            labelOf={(paint) => es[`editor.background.paint.${paint}`]}
            onSelect={(paint) => {
              if (pending) setPending({ ...pending, paint });
              else if (current) onSet({ ...current, paint });
            }}
          />
          {pending ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUse(pending.prepared, pending.paint);
                  setPending(null);
                }}
                className="ui-interactive h-9 cursor-pointer rounded-ui-sm bg-ui-brand px-3.5 text-[13px] font-semibold text-ui-surface"
              >
                {es["editor.background.use"]}
              </button>
              <SmallButton
                label={es["editor.background.cancel"]}
                onClick={() => {
                  turn.current += 1;
                  setPending(null);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <SmallButton
                label={es["editor.background.change"]}
                onClick={() => input.current?.click()}
              />
              <SmallButton
                label={es["editor.background.remove"]}
                danger
                onClick={() => onSet(null)}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <Note>{es["editor.background.none"]}</Note>
          <div>
            <SmallButton
              label={es["editor.background.upload"]}
              disabled={reading}
              onClick={() => input.current?.click()}
            />
          </div>
        </>
      )}
      {error ? <Note tone="warn">{error}</Note> : null}
    </PanelSection>
  );
}
