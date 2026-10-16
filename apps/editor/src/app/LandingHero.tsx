"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "../editor/viewport.ts";
import es from "../locales/es.json" with { type: "json" };
import {
  HERO_BAR,
  HERO_DEMO,
  HERO_FRAME_WIDTH,
  HERO_IN_VIEW,
  HERO_RESERVED_ASPECT,
  HERO_WINDOW,
  heroFrameHeight,
  heroInnerWidth,
  heroReservedHeight,
  heroScale,
  REDUCED_MOTION_MEDIA,
} from "./landingHero.ts";

/**
 * The landing's hero: the product's own output, in a frame that goes from a desktop to a phone and
 * back once, and then waits to be asked.
 *
 * **Why a client component on an otherwise inert page.** `page.tsx` reads nothing and is
 * prerendered, and that property is load-bearing (`docs/tasks/arranque-en-frio.md`). This island
 * does not change it: the page is still built without reading a session, and what crosses into the
 * browser is one string — the finished HTML from `landingSample.ts`, computed on the server. The
 * generator and the renderer stay where they are.
 *
 * **The iframe is mounted after the first paint, and that is David's own adjustment to the plan:**
 * «monta el iframe del héroe después de la primera pintura, para que el texto y "Empezar" no
 * esperen a la web de muestra». Two things follow from it, and the second is the one worth
 * noticing. The headline and the button paint without a sample site in the way — and the sample's
 * 13 KB never appear in the server-rendered HTML at all, because the element that would carry them
 * does not exist yet. The string travels once, in the data React already sends, instead of twice:
 * once escaped into a `srcDoc` attribute and once in the payload.
 *
 * Nothing jumps while that wait happens: the frame's height is reserved by `aspect-ratio` before
 * any JavaScript runs, and the empty frame wears the page's own background, so there is no white
 * to flash to — the same reasoning as `ui-fade-in` on the editor's canvas.
 */
export function LandingHero({ html }: { html: string }) {
  const slot = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [scale, setScale] = useState(0);
  const [painted, setPainted] = useState(false);
  const [seen, setSeen] = useState(false);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [demonstrating, setDemonstrating] = useState(false);
  /** Whether the visitor has asked for a state themselves — see the slot's own comment. */
  const [chosen, setChosen] = useState(false);
  const reduced = useMediaQuery(REDUCED_MOTION_MEDIA);

  // The slot's width, which is the page's scale. A `ResizeObserver` rather than one reading of
  // `offsetWidth`, like `ThumbnailFrame`: the slot is fluid, and a window resized after load would
  // otherwise leave the page drawn at the old size inside the new frame.
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      /**
       * **A width of zero is not a measurement, and taking it as one is what left «el marco
       * ampliado sin contenido»** (David, 16 October 2026). `heroScale(0)` is 0, the render gate
       * below is `scale > 0`, and a `ResizeObserver` reports zero whenever the slot is momentarily
       * unlaid-out — a device-emulation toggle, an ancestor hidden and shown. One such entry
       * unmounted the iframe while the slot kept its full reserved height, and nothing remounted it
       * until another resize happened to arrive. The last good scale is kept instead: before the
       * first real measurement there is nothing to draw anyway, and after it there is always
       * something better than nothing.
       */
      if (width !== undefined && width > 0) setScale(heroScale(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * After the first paint — two frames, or the browser's own idle moment where it exists.
   *
   * `requestIdleCallback` is the honest version of «when there is nothing better to do», and the
   * double `requestAnimationFrame` is the fallback that every browser has: the first callback runs
   * before the coming paint, the second after it. Safari has no `requestIdleCallback`, which is
   * exactly the browser this page's visitors are most likely to be holding.
   */
  useEffect(() => {
    const idle = (window as { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    if (idle) {
      idle(() => setPainted(true));
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPainted(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  /**
   * **Nothing happens here until somebody is actually looking at the frame.**
   *
   * Two jobs for one `IntersectionObserver`: the page is not fetched, and the demonstration is not
   * played, until a third of the frame is on screen. On a phone the hero sits below the fold, so
   * the demonstration used to finish before a visitor had scrolled far enough to see any of it —
   * the movement was spent on nobody — and the 344 KB of photographs were fetched for somebody who
   * read the headline and left, on the page that already has a cold start to apologise for.
   *
   * **What this does not fix is the layout shift, and that is worth saying plainly here rather than
   * leaving the next reader to infer it.** Measured on 15 October 2026, Lighthouse mobile on `/`,
   * four builds of the same commit:
   *
   * | | rendimiento | CLS | bytes | peticiones |
   * |---|---|---|---|---|
   * | sin héroe | 0,95 | 0 | 784 KB | 25 |
   * | héroe, demostración al cargar | 0,90–0,93 | **0,144** | 1128 KB | 32 |
   * | héroe, sin demostración | 0,98 | 0,008 | 1128 KB | 32 |
   * | héroe, demostración al entrar en vista | 0,90 | **0,145** | 1128 KB | 32 |
   *
   * The last row is this code, and it is the same as the second: Lighthouse emulates a phone
   * **823 pixels tall**, where the whole hero is on screen at load, so the observer fires at once
   * and the audit sees the demonstration. The gate is right for a real phone and changes nothing
   * for the audit.
   *
   * The whole of that 0,144 is the demonstration, and most of it is not the frame moving: it is the
   * sample page's own sections re-laying-out inside it, which **is** the effect. A metric cannot
   * tell a rearrangement somebody asked to watch from a page jumping under their thumb. Nothing
   * else on the landing moves — the frame's height never changes, so the caption and the button
   * below it stay where they are — but 0,144 is well over the 0,1 that counts as good, and the
   * lever is written down in `docs/design/REVIEW.md`: dropping the automatic demonstration and
   * leaving the toggle buys back 0,136 of CLS and some seven points of performance. That is a
   * product decision about the public front door, so it is David's, with the numbers next to it.
   *
   * **The demonstration is not run under `prefers-reduced-motion`**, where the frame stays on the
   * desktop and the toggle below is the only thing that moves it. Flattening the transition to
   * 0.01ms would not have been enough: the frame would still change shape unasked, just instantly,
   * and that is the thing the preference is asking us not to do.
   */
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio >= HERO_IN_VIEW)) return;
        observer.disconnect();
        setSeen(true);
      },
      { threshold: HERO_IN_VIEW },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || reduced) return;
    setDemonstrating(true);
    timers.current = [
      setTimeout(() => setDevice("phone"), HERO_DEMO.toPhoneMs),
      setTimeout(() => setDevice("desktop"), HERO_DEMO.toDesktopMs),
      setTimeout(() => setDemonstrating(false), HERO_DEMO.restMs),
    ];
    const scheduled = timers.current;
    return () => {
      for (const timer of scheduled) clearTimeout(timer);
    };
  }, [seen, reduced]);

  /**
   * A press hands the frame over, which means cancelling what was about to happen to it.
   *
   * Without this, somebody who presses «Ver en móvil» at 800ms gets their choice undone at 4500 by
   * a timer they never saw — the interface overruling a person because a script had plans. The
   * demonstration exists to be interrupted.
   */
  const choose = (next: "desktop" | "phone") => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
    setDemonstrating(false);
    setChosen(true);
    // A press is attention, which is the same thing the observer above waits for: somebody who
    // reaches the button before the frame has been judged «in view» gets the page, not an
    // empty box changing width.
    setSeen(true);
    setDevice(next);
  };

  const phone = device === "phone";
  /**
   * **The frame always hugs what it is showing; the slot around it reserves until somebody asks.**
   *
   * David's rule, on approving this sprint: «el marco se ajusta siempre a la maqueta, pero durante
   * la demostración automática el hueco reserva el alto mayor de los dos estados, para que el
   * contenido de debajo no salte sin que el visitante haya hecho nada. Cuando el visitante pulsa
   * el conmutador, el hueco puede ajustarse.»
   *
   * It is the distinction the metric itself makes: a layout shift within half a second of an
   * interaction is not counted as an unexpected one, because the person watching asked for it.
   * Before anybody asks, the page below the hero must not move for a demonstration it did not
   * request; after they press, the frame and its slot may fit the state they chose.
   *
   * **Measured, both ways, on 16 October 2026**, at three widths where the section below the hero
   * is on screen — the unprompted layout shift across one whole demonstration:
   *
   * | | hueco reservado | hueco siempre ajustado |
   * |---|---|---|
   * | 1280 × 900 | **0,0747** | 0,1530 |
   * | 900 × 1300 | **0,1313** | 0,1698 |
   * | 768 × 1400 | **0,1324** | 0,1724 |
   *
   * Traced at 900 × 1300: reserved, the slot holds 574 and «Cómo funciona» holds 1212 through the
   * whole trip; fitted, they go 574 → 470 → 574 and 1212 → 1108 → 1212. A hundred and four pixels,
   * twice, for a demonstration nobody asked for.
   *
   * `undefined` until the slot has been measured — the aspect ratio below reserves the space in
   * the meantime, with no JavaScript at all.
   */
  const frameHeight = scale > 0 ? heroFrameHeight(scale, device) : undefined;
  const slotHeight = chosen ? frameHeight : scale > 0 ? heroReservedHeight(scale) : undefined;

  return (
    <section
      aria-labelledby="hero-caption"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        ref={slot}
        /**
         * **«rest» means the frame is not about to move on its own** — before the demonstration
         * starts, and after it has finished. It is read by the phone walk in
         * `e2e/critical-flows.e2e.test.ts`, which measures every box on this page and would
         * otherwise be measuring a frame mid-journey: the ADR 0042 lesson, in the one place this
         * sprint animates a width on purpose. On a phone the hero is below the fold and the
         * demonstration never starts, so this says `rest` from the first frame — which is the
         * truth, and the reason the walk does not have to wait five seconds for it.
         */
        data-hero-state={demonstrating ? "demo" : "rest"}
        data-hero-device={device}
        data-hero-slot={chosen ? "fitted" : "reserved"}
        style={
          slotHeight === undefined
            ? // Before the first measurement: the tallest state's proportion, which CSS can reserve
              // against a width it already knows.
              { width: "100%", aspectRatio: HERO_RESERVED_ASPECT }
            : { width: "100%", height: slotHeight }
        }
      >
        <div
          /**
           * `ui-reflow` rather than a transition of its own: it is already «width and transform, on
           * the symmetric curve, 260ms», written for the editor's canvas doing this exact thing —
           * and its comment there is the argument for why animating `width` is the point here
           * rather than a mistake. One motion system, and nothing new to keep in step.
           */
          className="ui-reflow"
          style={{
            width: HERO_FRAME_WIDTH[device],
            // The frame is exactly the bar plus the window this state shows, shrunk — never the
            // slot's height, which is what used to leave it standing empty.
            height: frameHeight ?? "100%",
            margin: "0 auto",
            overflow: "hidden",
            borderRadius: "var(--ui-radius-lg)",
            /**
             * **The frame's edge is an inset shadow, not a border, and that is arithmetic rather
             * than taste.** Every box here is `border-box`, so a 1px border on each side leaves the
             * content box 2px narrower — and the page inside, which is `calc(100% / scale)` of that
             * content box, then lays out at 1276 of its own pixels instead of 1280 and at 386
             * instead of 390. Measured in Chromium on 15 October 2026, which is how it was found:
             * the e2e asked for exactly 1280 and got 1276. An inset shadow paints inside the box
             * without taking any of it, so the page's viewport is exactly the number the hero
             * claims it is — and «390» is worth being exactly 390, because it is the width an
             * iPhone has and the width the whole application was measured at in sprint 21.
             */
            boxShadow: "inset 0 0 0 1px var(--ui-border), var(--ui-shadow-3)",
            background: "var(--ui-bg)",
          }}
        >
          {/* The browser bar, which is what makes the box read as a device rather than as a
              screenshot with a border. Three dots, in the one border colour that clears 3:1, at a
              fixed size: the page inside scales, the chrome around it does not. */}
          <div
            aria-hidden="true"
            style={{
              height: scale > 0 ? HERO_BAR * scale : undefined,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0 10px",
              background: "var(--ui-surface)",
              borderBottom: "1px solid var(--ui-border)",
            }}
          >
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--ui-border-strong)",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          <div style={{ height: HERO_WINDOW[device] * scale, overflow: "hidden" }}>
            {painted && seen && scale > 0 ? (
              <div
                style={{
                  width: heroInnerWidth(scale),
                  // The window this state shows, in the page's own pixels. Drawn at `scale`, it is
                  // exactly the box above — the box and the drawing from the same two numbers.
                  height: HERO_WINDOW[device],
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <iframe
                  title={es["landing.hero.frameTitle"]}
                  srcDoc={html}
                  scrolling="no"
                  // Decorative, and inert: the real headline is this page's own `h1`, and a page
                  // inside a page must not be tabbable or clickable — a click here would navigate
                  // the frame to a sample business's booking link.
                  aria-hidden="true"
                  tabIndex={-1}
                  className="ui-fade-in"
                  style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => choose(phone ? "desktop" : "phone")}
          aria-pressed={phone}
          className="ui-interactive ui-lift"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 40,
            padding: "9px 18px",
            borderRadius: "var(--ui-radius)",
            background: "var(--ui-surface)",
            color: "var(--ui-brand-deep)",
            border: "1px solid var(--ui-border-strong)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {phone ? es["landing.hero.desktop"] : es["landing.hero.phone"]}
        </button>
        {/* **The caption is what makes the frame honest.** It is a sample business, and the
            photographs come from Retorika's bank rather than from a client — so the sentence says
            both, and says whose the photographs would be instead. */}
        <p
          id="hero-caption"
          style={{
            margin: 0,
            maxWidth: 440,
            fontSize: 13,
            lineHeight: 1.5,
            color: "var(--ui-muted)",
            textAlign: "center",
          }}
        >
          {es["landing.hero.caption"]}
        </p>
      </div>
    </section>
  );
}
