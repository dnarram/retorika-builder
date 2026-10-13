/**
 * The Retorika mark, drawn to be animated: the «R» whose leg is a hammer, and the three blocks it
 * strikes.
 *
 * **A tracing of `docs/design/brand/LogoOficialRetorikaBuilder.png`, by eye, until the official
 * vector arrives.** David asked Retorika for the original SVG on 13 October 2026; until it is in
 * `docs/design/brand/`, this is the mark, and `REVIEW.md` says it will be replaced. Whoever swaps it
 * keeps the five groups below by their `data-part` — the animation is written against them, not
 * against these paths:
 *
 * | `data-part` | What it is | Moves? |
 * |---|---|---|
 * | `letter` | the bowl of the «R» with its counter, and the stem | no |
 * | `hammer` | the diagonal leg: handle, head and claw | rotates about its head |
 * | `block-sky` | the light-blue block, top left | settles |
 * | `block-blue` | the blue block, bottom left | settles |
 * | `block-rose` | the rose block, bottom right | settles |
 *
 * Colours are the logotype's own, read off the PNG (`#2962F2` → `#51B1F8`, rose `#DB436B`), not
 * the interface tokens: this is the brand drawn, which ADR 0015 allows for the mark on its own.
 * The rose block is small, which is the «accents only» that ADR asks of the pink.
 *
 * The classes `ui-hammer` and `ui-block` carry the keyframes (`globals.css`); under
 * `prefers-reduced-motion` the global rule leaves each animation at one 0.01 ms iteration, so the
 * mark rests in its final state — which is the logo, still.
 */
export function BuildingMark({ size = 120 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 244 252"
      width={size}
      height={size}
      aria-hidden="true"
      data-testid="building-mark"
      className="block"
    >
      <defs>
        <linearGradient id="rb-mark-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2962F2" />
          <stop offset="1" stopColor="#51B1F8" />
        </linearGradient>
      </defs>

      {/* The letter: bowl with its counter (even-odd), and the stem hanging from it. */}
      <g data-part="letter" fill="url(#rb-mark-blue)">
        <path
          fillRule="evenodd"
          d="M25 18 H167 A48 48 0 0 1 215 66 A48 48 0 0 1 167 114 H25 Z M80 64 V112 H155 V64 Z"
        />
        <rect x="36" y="110" width="57" height="58" rx="10" />
      </g>

      {/* The hammer, pivoting about its head where the leg meets the bowl. */}
      <g
        data-part="hammer"
        className="ui-hammer"
        fill="url(#rb-mark-blue)"
        style={{ transformOrigin: "110px 130px", transformBox: "view-box" }}
      >
        <g transform="translate(110 130) rotate(45)">
          {/* The handle, running down-right to the bottom corner. */}
          <rect x="-4" y="-16" width="150" height="32" rx="16" />
          {/* The head, across the top of the handle. */}
          <rect x="-26" y="-42" width="46" height="50" rx="11" />
          {/* The claw, curling back towards the bowl. */}
          <path d="M-26 -34 C-44 -40 -52 -22 -40 -10 C-34 -16 -30 -24 -26 -34 Z" />
        </g>
      </g>

      {/* The three blocks, each settling from its own base. */}
      <rect
        data-part="block-sky"
        className="ui-block"
        x="15"
        y="124"
        width="57"
        height="46"
        rx="10"
        fill="#4EABF7"
        style={{ transformOrigin: "50% 100%", transformBox: "fill-box", animationDelay: "0ms" }}
      />
      <rect
        data-part="block-blue"
        className="ui-block"
        x="15"
        y="178"
        width="57"
        height="46"
        rx="10"
        fill="#2962F2"
        style={{ transformOrigin: "50% 100%", transformBox: "fill-box", animationDelay: "90ms" }}
      />
      <rect
        data-part="block-rose"
        className="ui-block"
        x="81"
        y="178"
        width="54"
        height="46"
        rx="10"
        fill="#DB436B"
        style={{ transformOrigin: "50% 100%", transformBox: "fill-box", animationDelay: "180ms" }}
      />
    </svg>
  );
}
