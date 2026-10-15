import Link from "next/link";
import es from "@/locales/es.json" with { type: "json" };
import { BuildingMark } from "../editor/BuildingMark.tsx";
import { reveal } from "../questionnaire/ui.tsx";
import { LandingHero } from "./LandingHero.tsx";
import { LANDING_LOCKUP_WIDTH, markHeight, markOverlay } from "./landingMark.ts";
import { landingSampleHtml } from "./landingSample.ts";

/**
 * The landing. Minimal, which is what David asked for, and deliberately **inert**.
 *
 * **It reads nothing.** No session, no database, no `cookies()`, no `authConfigured()` — so Next
 * prerenders it at build time and a cold visit paints without waiting on anything but the server
 * itself. That is not tidiness: it is what makes David's adjustment 5 possible to evaluate at all.
 * A page that touched the session could not be moved to a Render static site, and a Render static
 * site is the only thing in this stack that does not sleep. `docs/tasks/arranque-en-frio.md` has
 * the evaluation and the measurement; this file's job is to not foreclose it.
 *
 * **«Empezar» goes to the questionnaire and asks for nothing**, because the account is created at
 * the end, when there is a web worth keeping (ADR 0034 §2). «Ya tengo cuenta» is for coming back,
 * and it is the second button rather than the first for the same reason.
 *
 * There is no mockup for this screen — `protocolo.md:971` makes the mockups the interface
 * specification and none was ever drawn for a landing — so ADR 0034 §20 makes the ADR and this
 * file the specification instead. The Spanish lives in `locales/es.json` like everything else.
 *
 * **The hero, since sprint 22 day 2, does not change any of that.** `landingSampleHtml()` is the
 * generator and the renderer run at build time on a sample business, which reads no session and no
 * database — so this page is still prerendered, and still movable to a static site. `LandingHero`
 * is a client island that receives the finished string and mounts it after the first paint, so the
 * headline and «Empezar» never wait for a sample site to arrive.
 */
export const metadata = {
  title: es["landing.title"],
  description: es["landing.lede"],
};

/**
 * The two discs of brand colour drifting behind the page (sprint 22 day 3).
 *
 * **Placed so they cannot leave `<main>` at any point of the 24-second loop**, which is a
 * constraint from the overflow walk rather than from taste: it reports every box that leaves the
 * screen or is cut by an `overflow: hidden` ancestor, and a disc drifting past the edge would be a
 * real finding about something nobody can see. The keyframe travels 24px right and 18px up, so the
 * right-hand disc is anchored 32px clear of the right edge and both start well below the top.
 *
 * `min(58vw, 520px)` keeps them proportionate rather than enormous on a phone and from growing
 * without limit on a wide screen. The second one is twelve seconds into the same loop, so the two
 * are never together.
 *
 * The colours: the brand blue at a tenth, and the sky blue of the mark's own top-left block —
 * `#06b4fa`, the colour the delivered logotype has in a browser, which is written here as a literal
 * with this sentence rather than promoted to a token, because this is its one use and a token
 * nothing else reads is a decision looking for somewhere to drift to.
 */
function Orbs() {
  /**
   * **Four stops, not two, and that is a defect that was looked at rather than reasoned about.**
   *
   * The first version was `radial-gradient(circle, <tint>, transparent 70%)`, which fades linearly
   * and then stops. A constant slope meeting a flat one is where the eye invents an edge — Mach
   * banding — and a screenshot of the landing at four times size showed exactly that: a faint but
   * perfectly circular ring across the headline, which reads as a rendering artefact rather than
   * as colour. The tail now eases towards nothing, so there is no point where the slope changes
   * abruptly, and the circle has no edge to find.
   */
  const disc = (base: string) =>
    [
      "radial-gradient(circle,",
      `color-mix(in srgb, ${base} 10%, transparent) 0%,`,
      `color-mix(in srgb, ${base} 5%, transparent) 42%,`,
      `color-mix(in srgb, ${base} 1.5%, transparent) 66%,`,
      "transparent 86%)",
    ].join(" ");

  const discs = [
    { left: 0, top: 150, tint: disc("var(--ui-brand)"), delay: "0s" },
    { right: 32, top: 760, tint: disc("#06b4fa"), delay: "-12s" },
  ];
  return (
    <>
      {discs.map((item) => (
        <div
          key={item.delay}
          aria-hidden="true"
          className="ui-drift"
          style={{
            position: "absolute",
            left: item.left,
            right: item.right,
            top: item.top,
            width: "min(58vw, 520px)",
            height: "min(58vw, 520px)",
            borderRadius: 999,
            background: item.tint,
            pointerEvents: "none",
            animationDelay: item.delay,
          }}
        />
      ))}
    </>
  );
}

/**
 * Retorika naming itself, with the mark building itself once as the page arrives.
 *
 * **The delivered lockup is still the thing on screen** — same file, same width, same `alt`, which
 * is what `test/brandAssets.test.ts` knows about this placement. What changes is that its left half,
 * the mark, is hidden and `BuildingMark` is drawn in exactly that place: the two traced vectors are
 * the same drawing ten pixels and four pixels apart (`landingMark.ts` has the proof and
 * `test/landingMark.test.ts` holds it). The seam is the right edge of the mark, where there is
 * whitespace before «Retorika».
 *
 * **Measured, because «it should line up» is not a measurement.** In Chromium at 232 across: the
 * mark lands at 63.03 × 65.09 against an arithmetic 63.04 × 65.10, offset 2.58, 1.03 against an
 * expected 2.58, 1.03 — exact to a hundredth of a pixel. Compared with the plain lockup at four
 * times size, **2.15 % of the box differs by more than 16/255**, all of it inside the mark and all
 * of it the anti-aliasing of two different rasterisations of the same curves: one raster under a
 * clip inside an `<img>`, the same raster under a clip inline. Side by side the two are
 * indistinguishable, which is the claim that matters and the one that was checked by looking.
 *
 * **Hidden with `clip-path`, which costs the overflow walk this one element**: that walk skips
 * anything with a clip path, because being outside your own box is the visually-hidden technique.
 * The lockup's geometry is not left unmeasured — the brand-vector walk asserts it loads and is
 * drawn at 232 — and the box itself is a fixed `width`/`height` pair that reserves its space before
 * the file arrives, which is the property the walk would have been checking.
 */
function Brand() {
  const overlay = markOverlay(LANDING_LOCKUP_WIDTH);
  return (
    <div
      style={{
        position: "relative",
        width: LANDING_LOCKUP_WIDTH,
        height: overlay.lockupHeight,
        marginBottom: 4,
      }}
    >
      <img
        src="/brand/retorika-lockup.svg"
        alt={es["brand.name"]}
        width={LANDING_LOCKUP_WIDTH}
        height={66}
        loading="eager"
        fetchPriority="high"
        style={{
          display: "block",
          height: "auto",
          clipPath: `inset(0 0 0 ${overlay.hideLeft}px)`,
        }}
      />
      {/* Absolute, at the drawn mark's own offset, so it sits on the hidden half rather than
          after it. `aria-hidden` is `BuildingMark`'s own: the accessible name of this logo is the
          `alt` on the image above, and two names for one logo is one too many. */}
      <div
        style={{
          position: "absolute",
          left: overlay.left,
          top: overlay.top,
          width: overlay.markWidth,
          height: markHeight(overlay.markWidth),
        }}
      >
        <BuildingMark size={overlay.markWidth} once />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "var(--ui-bg)",
        color: "var(--ui-ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 48,
        padding: "72px 24px 64px",
      }}
    >
      <Orbs />
      <div
        style={{
          position: "relative",
          maxWidth: 680,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* The lockup, because this is the one page whose whole job is to say who this is — and
            it had no logo at all until the official one arrived. `eager`, since it is the first
            thing above the fold on a page that already has a cold start to apologise for, and
            `fetchPriority` for the same reason: it is the thing this page is for.

            **The vector since 15 October 2026.** The PNG was 137 KB to be drawn 232 across — four
            times the pixels of the box — on the page with the least patience to spare. The SVG is
            21 KB on the wire and is drawn from shapes, so it is also the first logo here that is
            sharp on a dense screen. `width` and `height` stay: they are what reserves the space
            before it loads, which is the whole of what the overflow walk measures.

            **Since sprint 22 day 3 its mark half builds itself, once** — see `Brand` above. */}
        <div className="ui-reveal">
          <Brand />
        </div>
        <h1
          className="ui-reveal"
          style={{
            ...reveal(1),
            margin: 0,
            // Fluid between a phone and the mockup's 44px: the landing already fit at 320, but a
            // 44px «Tu web, hecha en diez minutos» broke mid-word there (sprint 21 day 1).
            fontSize: "clamp(30px, 9vw, 44px)",
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          {es["landing.title"]}
        </h1>
        <p
          className="ui-reveal"
          style={{
            ...reveal(2),
            margin: 0,
            fontSize: 19,
            lineHeight: 1.5,
            color: "#475569",
            textAlign: "center",
          }}
        >
          {es["landing.lede"]}
        </p>

        <div
          className="ui-reveal"
          style={{
            ...reveal(3),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
          }}
        >
          <Link
            href="/empezar"
            /**
             * `minHeight` and real padding, like every other button in the application — see
             * `primaryButton` in `questionnaire/ui.tsx`. Not that style itself, because this one
             * is sized to its own text rather than stretched across a card, and it is the one
             * button on a page that has no card.
             *
             * **The one ring on this screen** (sprint 22 day 3). It fires at 500ms, after the
             * entrance above it has landed, says «this is the button» once, and never repeats —
             * the restraint budget allows one per screen and `test/motionBudget.test.ts` counts
             * them. The lift and the press come from the same two utilities every control in the
             * five questions wears.
             */
            className="ui-interactive ui-lift ui-ring-once"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              minHeight: 56,
              padding: "14px 40px",
              borderRadius: 12,
              background: "var(--ui-brand)",
              color: "var(--ui-surface)",
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.25,
              textDecoration: "none",
            }}
          >
            {es["landing.start"]}
          </Link>
          {/* `#5B6B82`, not the mockups' `#64748B`: on this page's `#F5F7FA` the latter is 4.43:1
              and the former 5.06, the same correction `questionnaire/ui.tsx` made on sprint 1 day
              2 and this page missed — found by sprint 21 day 5, the first time axe ran on the
              landing at all. */}
          <span style={{ fontSize: 14, color: "var(--ui-muted)", textAlign: "center" }}>
            {es["landing.startHint"]}
          </span>
          {/* The brand blue is for white text on it and for black-ink pages; as 15px text on this
              grey it measures 4.39:1. `#105CB1` is the palette's own secondary (ADR 0041 §3), 6.14
              here. Same day, same first run of axe on this page. */}
          <Link
            href="/entrar"
            className="ui-interactive"
            style={{ fontSize: 15, color: "var(--ui-brand-deep)", marginTop: 8 }}
          >
            {es["landing.enter"]}
          </Link>
        </div>
      </div>

      {/* **A real web, built by the thing this page is selling.** It goes here, under the sentence
          that promises a finished site and above the list that explains how, because this is the
          one place on the page where «te devuelve una web terminada» can be shown instead of
          claimed. Its own `maxWidth` matches the text above it, so the page keeps one column. */}
      <div className="ui-reveal" style={{ ...reveal(4), width: "100%", maxWidth: 680 }}>
        <LandingHero html={landingSampleHtml()} />
      </div>

      <section className="ui-reveal" style={{ ...reveal(5), maxWidth: 680, width: "100%" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 700 }}>
          {es["landing.how.title"]}
        </h2>
        <ol
          /* `ui-steps` is what lets the numerals be the palette's secondary: `::marker` is a
             pseudo-element and an inline `style` cannot reach one (`globals.css`). */
          className="ui-steps"
          style={{
            margin: 0,
            paddingLeft: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 16,
            lineHeight: 1.5,
            color: "#334155",
          }}
        >
          <li>{es["landing.how.one"]}</li>
          <li>{es["landing.how.two"]}</li>
          <li>{es["landing.how.three"]}</li>
          <li>{es["landing.how.four"]}</li>
        </ol>
      </section>

      {/* The download promise, which is ADR 0001 said in the owner's own terms rather than ours.
          It belongs on the landing because it is the thing that makes Retorika different from the
          products this one is competing with, and because it is true. */}
      <section className="ui-reveal" style={{ ...reveal(6), maxWidth: 680, width: "100%" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>
          {es["landing.yours.title"]}
        </h2>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#334155" }}>
          {es["landing.yours.body"]}
        </p>
      </section>
    </main>
  );
}
