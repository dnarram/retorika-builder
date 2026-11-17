"use client";

import type { LegibleAxis, PaletteColors, UnreadablePair } from "@retorika/tokens";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import es from "../locales/es.json" with { type: "json" };
import {
  colourOf,
  type EditableKey,
  legibleExtremes,
  nearestValid,
  nextValid,
  parseTypedHex,
  reachable,
  stepsFor,
  unreadableFor,
  unreadableSentence,
  withColour,
  zonesOf,
} from "./colourField.ts";
import { Note, type Previewer } from "./panelKit.tsx";

/**
 * **The colour field** (sprint 38 día 7, ADR 0077, David's P6): one colour of the chosen palette, moved
 * by two sliders that cannot reach what breaks a pair, or asked for outright with the wheel or the hex
 * and judged before it is written.
 *
 * - **A drag is one step.** While the hand is on a slider the canvas shows each step by the theme's
 *   previewer — as chrome, the document untouched — and the native `change` on release writes once:
 *   «Deshacer» brings back the colour from before the gesture. A step the hand drags into the
 *   unreachable is not taken: the slider stays on the last one it could reach.
 * - **The arrows walk the legible steps**, one at a time, skipping the unreachable; Home and End go to
 *   the legible extremes; an arrow on the last legible step changes nothing. Each press writes (the
 *   canvas has to show where the keyboard is) and the run is one step of history, closed after 300 ms
 *   of quiet or when the slider loses the focus.
 * - **The track shows the unreachable before the hand gets there**: striped, under the native track,
 *   and over it a transparent strip per run that carries the `title` — «Por aquí deja de leerse sobre
 *   el fondo» — and takes the press, so a click there moves nothing. The thumb and the focus ring are
 *   the platform's: no `appearance: none`, no vendor pseudo-elements.
 * - **The wheel and the hex are judged on their `change`**: written if every pair this colour is part
 *   of reads, refused otherwise with the pair and its figure, and «Ajustar» moves the lightness to the
 *   legible step nearest the colour asked for and writes that.
 */

const QUIET_MS = 300;
/** Half the platform thumb's width: the strip a step's centre runs along is the input's width less
 * one thumb, which is where the zones are laid. */
const THUMB_HALF = 8;

export interface ColourFieldProps {
  colors: PaletteColors;
  colourKey: EditableKey;
  /** The role's name, for the field's labels: «Principal», «Fondo». */
  role: string;
  previewer?: Previewer<PaletteColors> | undefined;
  /** One step: a drag released, the wheel or the hex accepted, «Ajustar». */
  onCommit: (next: PaletteColors) => void;
  /** One press of a run of arrows; `field` tells one run from the next. */
  onAdjust: (next: PaletteColors, field: string) => void;
  onSettle: () => void;
}

export function ColourField({
  colors,
  colourKey,
  role,
  previewer,
  onCommit,
  onAdjust,
  onSettle,
}: ColourFieldProps) {
  const current = colourOf(colors, colourKey);
  return (
    <div className="flex flex-col gap-3 pt-1">
      {(["lightness", "hue"] as const).map((axis) => (
        <AxisSlider
          key={axis}
          axis={axis}
          colors={colors}
          colourKey={colourKey}
          role={role}
          previewer={previewer}
          onCommit={onCommit}
          onAdjust={onAdjust}
          onSettle={onSettle}
        />
      ))}
      <AskedColour
        current={current}
        role={role}
        judge={(hex) => unreadableFor(colors, colourKey, hex)}
        sentence={(pair) => unreadableSentence(colourKey, pair)}
        adjust={(hex) => {
          const steps = stepsFor(colors, colourKey, "lightness", hex);
          const at = nearestValid(steps, steps.at);
          return at === null ? null : (steps.hexes[at] ?? null);
        }}
        onAccept={(hex) => onCommit(withColour(colors, colourKey, hex))}
      />
    </div>
  );
}

/**
 * «Tu paleta» before it has colours: the brand's colour alone, by the wheel or the hex. Any colour is
 * accepted — the palette is derived from it, and `derivePalette` proves every pair or throws — so
 * there is nothing to refuse and no slider to stop.
 */
export function BrandField({ onAccept }: { onAccept: (hex: string) => void }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <Note>{es["editor.style.ownPalette.help"]}</Note>
      <AskedColour
        current="#156FE7"
        role={es["editor.style.role.brand"]}
        judge={() => []}
        sentence={() => ""}
        adjust={() => null}
        onAccept={onAccept}
      />
    </div>
  );
}

function AxisSlider({
  axis,
  colors,
  colourKey,
  role,
  previewer,
  onCommit,
  onAdjust,
  onSettle,
}: { axis: LegibleAxis } & Omit<ColourFieldProps, "colors"> & { colors: PaletteColors }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  // The colour a gesture or a run of arrows started from: the steps are that colour's for as long as
  // the gesture lasts, so a lightness taken to the top and back does not come back greyer.
  const [base, setBase] = useState<string | null>(null);
  // Where the hand or the keyboard stands while a gesture lasts.
  const [standing, setStanding] = useState<number | null>(null);
  const lastValid = useRef<number | null>(null);
  // A run of arrows is open: what the quiet timer and the blur close. A ref, because the timer set
  // by a press reads it after that press's render has gone.
  const running = useRef(false);
  const quiet = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = colourOf(colors, colourKey);
  const steps = useMemo(
    () => stepsFor(colors, colourKey, axis, base ?? current),
    [colors, colourKey, axis, base, current],
  );
  const zones = useMemo(() => zonesOf(steps, colors, colourKey), [steps, colors, colourKey]);
  const at = standing ?? steps.at;
  const value = steps.values[at] ?? 0;
  const indexOf = (raw: number) => (axis === "lightness" ? raw : Math.round(raw / 5));

  // The drag's release: the native `change`, once per gesture — React's `onChange` is the `input`
  // event, every pixel of the drag. Kept in a ref so the listener reads this render's steps.
  const release = useRef<() => void>(() => {});
  release.current = () => {
    const reached = lastValid.current;
    lastValid.current = null;
    setBase(null);
    setStanding(null);
    if (reached === null || reached === steps.at) {
      previewer?.end("restore");
      return;
    }
    previewer?.end("keep");
    onCommit(withColour(colors, colourKey, steps.hexes[reached] as string));
  };
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    const onChange = () => release.current();
    node.addEventListener("change", onChange);
    return () => node.removeEventListener("change", onChange);
  }, []);
  useEffect(
    () => () => {
      if (quiet.current) clearTimeout(quiet.current);
    },
    [],
  );

  const onSettleNow = useRef(onSettle);
  onSettleNow.current = onSettle;
  const settle = () => {
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = null;
    if (!running.current) return;
    running.current = false;
    setBase(null);
    setStanding(null);
    onSettleNow.current();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const from = standing ?? steps.at;
    const by: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 10,
      PageDown: -10,
    };
    let to: number | undefined;
    if (event.key in by) {
      const count = by[event.key] as number;
      to = from;
      for (let i = 0; i < Math.abs(count); i += 1) to = nextValid(steps, to, count > 0 ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      const edges = legibleExtremes(steps);
      to = edges ? (event.key === "Home" ? edges.first : edges.last) : from;
    } else {
      return;
    }
    // The platform's own step would land on what cannot be reached: the field takes the key.
    event.preventDefault();
    if (!running.current) {
      running.current = true;
      setBase(colourOf(colors, colourKey));
    }
    if (quiet.current) clearTimeout(quiet.current);
    quiet.current = setTimeout(settle, QUIET_MS);
    if (to === from) return;
    setStanding(to);
    onAdjust(withColour(colors, colourKey, steps.hexes[to] as string), `${colourKey}:${axis}`);
  };

  const onPointerDown = (event: PointerEvent<HTMLInputElement>) => {
    if (event.button !== 0) return;
    settle();
    setBase(current);
    lastValid.current = steps.at;
  };
  // A press released without a move brings no `change`: the gesture is closed here instead, once the
  // release has had its turn to deliver one (the platform dispatches it from the same mouseup).
  const onPointerUp = () => {
    setTimeout(() => {
      if (lastValid.current === null) return;
      lastValid.current = null;
      setBase(null);
      setStanding(null);
      previewer?.end("restore");
    }, 0);
  };

  const onInput = (raw: number) => {
    // An assistive technology's increment arrives as `input` and `change` without a pointer: it is
    // judged as a drag of one step, which is what it is.
    const from = lastValid.current ?? steps.at;
    if (lastValid.current === null) {
      setBase(current);
      lastValid.current = from;
    }
    const to = reachable(steps, indexOf(raw), from);
    lastValid.current = to;
    setStanding(to);
    previewer?.show(withColour(colors, colourKey, steps.hexes[to] as string));
  };

  const label =
    axis === "lightness" ? es["editor.style.field.lightness"] : es["editor.style.field.hue"];
  const valueText = (
    axis === "lightness"
      ? es["editor.style.field.lightnessValue"]
      : es["editor.style.field.hueValue"]
  ).replace("{n}", String(value));
  const last = steps.values.length - 1;
  const left = (index: number) =>
    `calc(${THUMB_HALF}px + (100% - ${THUMB_HALF * 2}px) * ${index / last})`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex justify-between text-[12px] font-semibold text-ui-ink">
        <span>{label}</span>
        <span aria-hidden="true" className="font-normal text-ui-muted">
          {valueText}
        </span>
      </label>
      <div className="relative h-6" data-axis={axis}>
        {/* The unreachable, striped, under the native track. */}
        {zones.map((zone) => (
          <span
            key={`paint-${zone.from}`}
            aria-hidden="true"
            data-unreachable={`${zone.from}-${zone.to}`}
            className="ui-unreachable absolute top-1/2 h-3 -translate-y-1/2 rounded-full"
            style={{
              left:
                zone.from === 0
                  ? 0
                  : `calc(${left(zone.from)} - (100% - ${THUMB_HALF * 2}px) / ${last * 2})`,
              right:
                zone.to === last
                  ? 0
                  : `calc(100% - ${left(zone.to)} - (100% - ${THUMB_HALF * 2}px) / ${last * 2})`,
            }}
          />
        ))}
        <input
          ref={input}
          id={id}
          type="range"
          min={0}
          max={axis === "lightness" ? 100 : 355}
          step={axis === "lightness" ? 1 : 5}
          value={value}
          aria-valuetext={valueText}
          aria-describedby={`${id}-role`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onChange={(event) => onInput(Number(event.currentTarget.value))}
          onKeyDown={onKeyDown}
          onBlur={settle}
          className="absolute inset-0 m-0 h-6 w-full cursor-pointer bg-transparent accent-[var(--ui-brand)]"
        />
        {/* Over the input, transparent, one per run: the sentence a mouse finds there, and the press
            that would otherwise move the slider where it cannot go. */}
        {zones.map((zone) => (
          <span
            key={`title-${zone.from}`}
            title={zone.title}
            data-unreachable-title={zone.title}
            className="absolute top-0 bottom-0 z-[2] cursor-not-allowed"
            style={{
              left:
                zone.from === 0
                  ? 0
                  : `calc(${left(zone.from)} - (100% - ${THUMB_HALF * 2}px) / ${last * 2})`,
              right:
                zone.to === last
                  ? 0
                  : `calc(100% - ${left(zone.to)} - (100% - ${THUMB_HALF * 2}px) / ${last * 2})`,
            }}
          />
        ))}
      </div>
      <span id={`${id}-role`} className="sr-only">
        {role}
      </span>
    </div>
  );
}

/**
 * The wheel and the hex: the two ways to ask for a colour outright, judged on their `change` — the
 * wheel's when its picker closes, the hex's on Enter or on leaving the field.
 */
function AskedColour({
  current,
  role,
  judge,
  sentence,
  adjust,
  onAccept,
}: {
  current: string;
  role: string;
  judge: (hex: string) => UnreadablePair[];
  sentence: (pair: UnreadablePair) => string;
  adjust: (hex: string) => string | null;
  onAccept: (hex: string) => void;
}) {
  const id = useId();
  const wheel = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState<string | null>(null);
  // What the wheel holds while its picker is open: a controlled input put back to the old colour on
  // every `input` would hand its `change` the colour it started from.
  const [picked, setPicked] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ hex: string; sentence: string } | null>(null);
  const [badHex, setBadHex] = useState(false);

  const ask = (hex: string) => {
    setBadHex(false);
    setPicked(null);
    if (hex.toUpperCase() === current.toUpperCase()) {
      setRefused(null);
      return;
    }
    const pairs = judge(hex);
    if (pairs.length === 0) {
      setRefused(null);
      setTyped(null);
      onAccept(hex);
      return;
    }
    setRefused({ hex, sentence: sentence(pairs[0] as UnreadablePair) });
  };
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    const node = wheel.current;
    if (!node) return;
    const onChange = () => askRef.current(node.value.toUpperCase());
    node.addEventListener("change", onChange);
    return () => node.removeEventListener("change", onChange);
  }, []);

  const commitTyped = () => {
    if (typed === null) return;
    const hex = parseTypedHex(typed);
    if (hex === null) {
      setBadHex(true);
      return;
    }
    ask(hex);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-ui-ink">
          <span>{es["editor.style.field.wheel"]}</span>
          <input
            ref={wheel}
            type="color"
            aria-label={`${es["editor.style.field.wheel"]}: ${role}`}
            // Lower case: the platform's own form for a colour input's value.
            value={(picked ?? refused?.hex ?? current).toLowerCase()}
            onChange={(event) => setPicked(event.currentTarget.value)}
            className="h-9 w-12 cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface p-0.5"
          />
        </label>
        <label
          htmlFor={id}
          className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] font-semibold text-ui-ink"
        >
          <span>{es["editor.style.field.hex"]}</span>
          <input
            id={id}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-label={`${es["editor.style.field.hex"]}: ${role}`}
            value={typed ?? current}
            onChange={(event) => setTyped(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTyped();
              }
            }}
            onBlur={commitTyped}
            className="h-9 w-full rounded-ui-sm border border-ui-border bg-ui-surface px-2 font-mono text-[13px] text-ui-ink"
          />
        </label>
      </div>
      {badHex ? (
        <Note tone="warn" role="status">
          {es["editor.style.field.badHex"]}
        </Note>
      ) : null}
      {refused ? (
        <div className="flex items-center gap-2" data-testid="colour-refused">
          <Note tone="warn" role="status" className="flex-1">
            {refused.sentence}
          </Note>
          <button
            type="button"
            aria-label={es["editor.style.adjustLabel"]}
            onClick={() => {
              const fixed = adjust(refused.hex);
              if (fixed === null) return;
              setRefused(null);
              setTyped(null);
              onAccept(fixed);
            }}
            className="ui-interactive h-8 shrink-0 cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface px-3 text-[13px] font-semibold text-ui-ink hover:border-ui-border-strong"
          >
            {es["editor.style.adjust"]}
          </button>
        </div>
      ) : null}
    </div>
  );
}
