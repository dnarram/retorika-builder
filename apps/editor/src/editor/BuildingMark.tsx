import {
  BLOCKS,
  HAMMER_PATH,
  HAMMER_PIVOT,
  LETTER_PATH,
  MARK_COLOUR,
  MARK_HEIGHT,
  MARK_WIDTH,
} from "./buildingMarkPaths.ts";

/**
 * The Retorika mark, drawn to be animated: the «R» whose leg is a hammer, and the three blocks it
 * strikes.
 *
 * **Traced from `docs/design/brand/LogoOficialRetorikaBuilder.png` by `pnpm brand:vector`**, on 13
 * October 2026, at David's request, rather than drawn by eye or waited for: the outlines are
 * vectors to a tenth of a pixel, the colour of the «R» is the PNG's own, sampled, under a clip (see
 * `scripts/brand-vector.ts` for why no gradient would do), and `docs/design/brand/README.md` carries
 * the measured distance from the pixels. Everything here comes from `buildingMarkPaths.ts`, which
 * that script writes; nothing is edited by hand. The five groups below, by `data-part`, are what the
 * animation is written against — a future official vector replaces what is inside them:
 *
 * | `data-part` | What it is | Moves? |
 * |---|---|---|
 * | `letter` | the bowl of the «R» and the stem | no |
 * | `hammer` | the diagonal leg: handle, head and claw | turns about where the handle leaves the bowl |
 * | `block-sky` | the light-blue block, top left | settles |
 * | `block-blue` | the blue block, bottom left | settles |
 * | `block-rose` | the rose block, bottom right | settles |
 *
 * The letter and the hammer are two clips over one colour raster placed in the mark's own
 * coordinates, so at rest they draw exactly the traced logo; the letter reaches a few pixels under
 * the hammer along the cut, so nothing opens between them while the hammer turns. The colours are
 * the logotype's, as a browser shows the delivered PNG, not the interface tokens: this is the brand
 * drawn, which ADR 0015 allows for the mark on its own. The rose block is small, which is the
 * «accents only» that ADR asks of the pink.
 *
 * The classes `ui-hammer` and `ui-block` carry the keyframes (`globals.css`); under
 * `prefers-reduced-motion` the global rule leaves each animation at one 0.01 ms iteration, so the
 * mark rests in its final state — which is the logo, still.
 *
 * **`once` builds the mark a single time and leaves it built** (sprint 22 day 3), which is what the
 * landing needs: the logo assembling itself as the page arrives, not a loop. On the building screen
 * the cycle repeats because something is genuinely still being written; on a landing a repeating
 * hammer would be an ornament tapping for attention, which the restraint budget spends elsewhere.
 *
 * **It is two inline properties rather than a `ui-once` utility, and that is deliberate.** A
 * utility would have to beat `ui-hammer`'s own `animation` shorthand, and which of two custom
 * utilities wins depends on the order Tailwind happens to emit them in — a thing that works until
 * somebody reorders this file's blocks. An inline style beats both, always, and says so where it
 * is read. `both` holds the final keyframe: the hammer at rest and the three blocks in place,
 * which is the logo.
 */
export function BuildingMark({ size = 120, once = false }: { size?: number; once?: boolean }) {
  const single = once ? { animationIterationCount: 1, animationFillMode: "both" as const } : {};
  return (
    <svg
      viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      width={size}
      height={(size * MARK_HEIGHT) / MARK_WIDTH}
      aria-hidden="true"
      data-testid="building-mark"
      className="block"
    >
      <defs>
        <clipPath id="rb-mark-letter">
          <path d={LETTER_PATH} />
        </clipPath>
        <clipPath id="rb-mark-hammer">
          <path d={HAMMER_PATH} />
        </clipPath>
        {Object.entries(BLOCKS).map(([id, block]) => (
          <linearGradient
            key={id}
            id={`rb-mark-${id}`}
            gradientUnits="userSpaceOnUse"
            x1={block.gradient.x1}
            y1={block.gradient.y1}
            x2={block.gradient.x2}
            y2={block.gradient.y2}
          >
            {block.gradient.stops.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* The letter: still. */}
      <g data-part="letter">
        <image {...MARK_COLOUR} preserveAspectRatio="none" clipPath="url(#rb-mark-letter)" />
      </g>

      {/* The hammer, turning about the point where its handle leaves the bowl. */}
      <g
        data-part="hammer"
        className="ui-hammer"
        style={{
          transformOrigin: `${HAMMER_PIVOT.x}px ${HAMMER_PIVOT.y}px`,
          transformBox: "view-box",
          ...single,
        }}
      >
        <image {...MARK_COLOUR} preserveAspectRatio="none" clipPath="url(#rb-mark-hammer)" />
      </g>

      {/* The three blocks, each settling from its own base. */}
      {Object.entries(BLOCKS).map(([id, block], index) => (
        <path
          key={id}
          data-part={id}
          className="ui-block"
          d={block.d}
          fill={`url(#rb-mark-${id})`}
          style={{
            transformOrigin: "50% 100%",
            transformBox: "fill-box",
            animationDelay: `${index * 90}ms`,
            ...single,
          }}
        />
      ))}
    </svg>
  );
}
