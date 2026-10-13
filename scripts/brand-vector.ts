import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, chromium } from "@playwright/test";
import { encode, type Image } from "./png.ts";

/**
 * Traces the two delivered logos (`docs/design/brand/*.png`) into vectors, and measures how far
 * the vectors are from the pixels they came from.
 *
 * **Why a tracer of our own.** Retorika delivered the logo as two PNGs on an opaque white
 * background and nothing else; the vector original was asked for on 13 October 2026 and David
 * asked the same day for the SVG to be taken from the PNGs themselves, faithfully. The usual tool
 * for that is potrace; its JavaScript port drags a 2020 `jimp` behind it, five audit findings
 * deep, and `pnpm security:audit` blocks the build on exactly that. So the tracing is written
 * here, in a few hundred lines that need nothing the repository does not already have:
 *
 * 1. **Coverage.** Each pixel of a shape gets a value in 0..1 for how much of it the shape covers,
 *    read off the antialiased edge: a pixel between the shape's own colour and the white paper is
 *    partly covered, in proportion. Flat shapes use their one colour; the gradient of the «R»
 *    uses the colour of the nearest fully-covered pixel.
 * 2. **The outline at half coverage**, found by marching squares on that field sampled at an
 *    eighth of a pixel with bilinear interpolation. The 0.5 contour of the interpolated coverage
 *    is the edge the pixels describe, to well under a tenth of a pixel; tracing the binary mask
 *    at whole pixels, which is what potrace does, would be eight times coarser.
 * 3. **Cubic Béziers** fitted to that polyline by Schneider's algorithm (Graphics Gems, 1990),
 *    to a tenth of a pixel, splitting at the worst point until it fits. Corners sharper than
 *    `CORNER_DEGREES` are kept as corners rather than rounded through.
 * 4. **Colour.** A flat shape takes the mean of its interior. The «R» and «Builder» are
 *    gradients: for every angle the interior is binned along that direction and the angle with
 *    the smallest residual wins, and the bin means become the stops. One linear gradient at one
 *    angle explains the whole «R», letter and hammer, to under five levels per channel; two
 *    gradients would fit a little better and leave a seam where the pieces meet.
 *
 * **What it writes.** `docs/design/brand/retorika-mark.svg` and `retorika-lockup.svg` next to
 * the originals they were traced from, and `apps/editor/src/editor/buildingMarkPaths.ts` for the
 * building screen's animated mark, where the «R» is split into the letter and the hammer along
 * `HAMMER_CUT`, a polygon drawn by hand through the white notches that separate the claw from
 * the bowl. Both pieces are filled with the same gradient in the mark's coordinates, so at rest
 * they draw exactly what the single path draws.
 *
 * **How it checks itself.** Each SVG is rasterised by Chromium, the engine that will draw it in
 * the product, at the original's size, and compared pixel by pixel with the PNG. The numbers are
 * printed and belong in `docs/design/brand/README.md`; the side-by-side images land in
 * `.scratch/brand-vector/` for an eye to confirm what the numbers say.
 *
 * Re-runnable on purpose, like `brand:assets`: a new logo means replacing the originals and
 * running `pnpm brand:vector`, never editing an SVG by hand.
 */

const ROOT = join(import.meta.dirname, "..");
const SOURCE = join(ROOT, "docs", "design", "brand");
const SCRATCH = join(ROOT, ".scratch", "brand-vector");
const EDITOR_PATHS = join(ROOT, "apps", "editor", "src", "editor", "buildingMarkPaths.ts");

/** Samples per pixel along each axis for the contour. Eight puts the outline within 1/16 px. */
const SUBDIVISION = 8;
/** Largest distance, in pixels of the original, between the fitted curve and the contour. */
const FIT_TOLERANCE = 0.1;
/** Vertices turning more sharply than this are corners, kept rather than smoothed. */
const CORNER_DEGREES = 60;
/** A pixel this close to white is paper, not ink — the same threshold `brand-assets.ts` uses. */
const PAPER = 249;
/** Bins along the gradient axis; each becomes a stop. */
const GRADIENT_STOPS = 16;

interface Point {
  x: number;
  y: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Component extends Box {
  /** Pixel indices (y * width + x) belonging to the shape, antialiased edge included. */
  pixels: number[];
}

// ---------------------------------------------------------------------------------------------
// 1. Components and coverage

function isInk(image: Image, i: number): boolean {
  const { data } = image;
  return !(
    (data[i * 4] as number) >= PAPER &&
    (data[i * 4 + 1] as number) >= PAPER &&
    (data[i * 4 + 2] as number) >= PAPER
  );
}

const neighbours = (x: number, y: number): [number, number][] => [
  [x - 1, y],
  [x + 1, y],
  [x, y - 1],
  [x, y + 1],
];

/** Four-connected components of ink, largest first. Specks under four pixels are reported and
 * dropped: the lockup carries one stray near-white pixel at (306, 59) that is nobody's letter. */
function components(image: Image): Component[] {
  const { width, height } = image;
  const label = new Int32Array(width * height).fill(-1);
  const out: Component[] = [];
  for (let seed = 0; seed < width * height; seed += 1) {
    if (!isInk(image, seed) || label[seed] !== -1) continue;
    const id = out.length;
    const c: Component = { pixels: [], x0: width, y0: height, x1: 0, y1: 0 };
    out.push(c);
    const stack = [seed];
    label[seed] = id;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const x = p % width;
      const y = Math.floor(p / width);
      c.pixels.push(p);
      c.x0 = Math.min(c.x0, x);
      c.y0 = Math.min(c.y0, y);
      c.x1 = Math.max(c.x1, x);
      c.y1 = Math.max(c.y1, y);
      for (const [nx, ny] of neighbours(x, y)) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (label[q] === -1 && isInk(image, q)) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
  }
  for (const speck of out.filter((c) => c.pixels.length < 4)) {
    console.log(`  (dropped a speck of ${speck.pixels.length} px at ${speck.x0},${speck.y0})`);
  }
  return out.filter((c) => c.pixels.length >= 4).sort((a, b) => b.pixels.length - a.pixels.length);
}

function rgb(image: Image, i: number): [number, number, number] {
  const { data } = image;
  return [data[i * 4] as number, data[i * 4 + 1] as number, data[i * 4 + 2] as number];
}

/** Pixels with two pixels of the component around them on every side: the shape's own colour,
 * no paper. Two rather than one because the delivered edges are soft over two or three pixels —
 * a resampled export — and a one-pixel ring still held pixels a quarter of the way to white,
 * which lifted every mean and gradient stop towards grey. */
function interior(image: Image, c: Component): number[] {
  const { width } = image;
  const member = new Set(c.pixels);
  return c.pixels.filter((p) => {
    const x = p % width;
    const y = Math.floor(p / width);
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (!member.has((y + dy) * width + x + dx)) return false;
      }
    }
    return true;
  });
}

/**
 * How much of each pixel the shape covers, from 0 to 1, over the whole image (zero outside the
 * component). On white paper a partly covered pixel is a blend of the shape's colour and white,
 * so the darkest channel says how much: `(255 - darkest) / (255 - darkestOfShape)`. The shape's
 * own darkest channel comes from the nearest interior pixel, which is what makes this right for a
 * gradient as well as for a flat colour.
 */
function coverage(image: Image, c: Component): Float32Array {
  const { width, height } = image;
  const field = new Float32Array(width * height);
  // Nearest interior pixel's darkest channel, by breadth-first growth from the interior.
  const darkest = new Float32Array(width * height).fill(-1);
  let frontier: number[] = [];
  for (const p of interior(image, c)) {
    darkest[p] = Math.min(...rgb(image, p));
    frontier.push(p);
  }
  const member = new Set(c.pixels);
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const p of frontier) {
      for (const [nx, ny] of neighbours(p % width, Math.floor(p / width))) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (member.has(q) && darkest[q] === -1) {
          darkest[q] = darkest[p] as number;
          next.push(q);
        }
      }
    }
    frontier = next;
  }
  for (const p of c.pixels) {
    const shapeDarkest = darkest[p] as number;
    const pixelDarkest = Math.min(...rgb(image, p));
    field[p] = Math.max(0, Math.min(1, (255 - pixelDarkest) / (255 - shapeDarkest)));
  }
  return field;
}

// ---------------------------------------------------------------------------------------------
// 2. The outline: marching squares at half coverage on the bilinearly interpolated field

function bilinear(field: Float32Array, width: number, height: number, x: number, y: number) {
  // Pixel centres sit at (i + 0.5, j + 0.5); outside the image the field is zero.
  const fx = x - 0.5;
  const fy = y - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (i: number, j: number) =>
    i < 0 || j < 0 || i >= width || j >= height ? 0 : (field[j * width + i] as number);
  return (
    at(x0, y0) * (1 - tx) * (1 - ty) +
    at(x0 + 1, y0) * tx * (1 - ty) +
    at(x0, y0 + 1) * (1 - tx) * ty +
    at(x0 + 1, y0 + 1) * tx * ty
  );
}

/** Closed polylines, in pixel coordinates of the original, along the 0.5 contour of `field`
 * within `box` (plus a margin, so every outline closes on paper). */
function contours(field: Float32Array, width: number, height: number, box: Box): Point[][] {
  const S = SUBDIVISION;
  const ox = Math.max(0, box.x0 - 2);
  const oy = Math.max(0, box.y0 - 2);
  const gw = (Math.min(width, box.x1 + 3) - ox) * S;
  const gh = (Math.min(height, box.y1 + 3) - oy) * S;
  const node = new Float32Array((gw + 1) * (gh + 1));
  for (let j = 0; j <= gh; j += 1) {
    for (let i = 0; i <= gw; i += 1) {
      node[j * (gw + 1) + i] = bilinear(field, width, height, ox + i / S, oy + j / S);
    }
  }
  const value = (i: number, j: number) => node[j * (gw + 1) + i] as number;
  // An edge of the grid is named by its first node and its direction; a contour vertex lies on
  // exactly one edge, which is what lets segments from neighbouring cells be joined exactly.
  const horizontal = (i: number, j: number) => (j * (gw + 1) + i) * 2;
  const vertical = (i: number, j: number) => (j * (gw + 1) + i) * 2 + 1;
  const cross = (a: number, b: number) => (0.5 - a) / (b - a);
  const position = new Map<number, Point>();
  const next = new Map<number, number>();

  for (let j = 0; j < gh; j += 1) {
    for (let i = 0; i < gw; i += 1) {
      const a = value(i, j);
      const b = value(i + 1, j);
      const c = value(i + 1, j + 1);
      const d = value(i, j + 1);
      const corners = [a, b, c, d];
      // Walking the cell clockwise (top, right, bottom, left), note each edge the contour crosses
      // and whether the walk enters or leaves the covered side there.
      const edges = [horizontal(i, j), vertical(i + 1, j), horizontal(i, j + 1), vertical(i, j)];
      const points: Point[] = [
        { x: ox + (i + cross(a, b)) / S, y: oy + j / S },
        { x: ox + (i + 1) / S, y: oy + (j + cross(b, c)) / S },
        { x: ox + (i + cross(d, c)) / S, y: oy + (j + 1) / S },
        { x: ox + i / S, y: oy + (j + cross(a, d)) / S },
      ];
      const crossing: { edge: number; entering: boolean }[] = [];
      for (let k = 0; k < 4; k += 1) {
        const fromIn = (corners[k] as number) >= 0.5;
        const toIn = (corners[(k + 1) % 4] as number) >= 0.5;
        if (fromIn === toIn) continue;
        const edge = edges[k] as number;
        crossing.push({ edge, entering: toIn });
        position.set(edge, points[k] as Point);
      }
      if (crossing.length === 0) continue;
      const entries = crossing.filter((x) => x.entering);
      if (crossing.length === 2) {
        const exit = crossing.find((x) => !x.entering) as { edge: number };
        next.set((entries[0] as { edge: number }).edge, exit.edge);
        continue;
      }
      // The saddle: two covered corners on a diagonal. The centre decides whether they join.
      const centreIn = (a + b + c + d) / 4 >= 0.5;
      for (const entry of entries) {
        const k = crossing.indexOf(entry);
        const following = crossing[(k + 1) % 4] as { edge: number };
        const preceding = crossing[(k + 3) % 4] as { edge: number };
        next.set(entry.edge, centreIn ? preceding.edge : following.edge);
      }
    }
  }

  const loops: Point[][] = [];
  const seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: Point[] = [];
    let edge = start;
    while (!seen.has(edge)) {
      seen.add(edge);
      loop.push(position.get(edge) as Point);
      edge = next.get(edge) as number;
    }
    loops.push(loop);
  }
  return loops;
}

// ---------------------------------------------------------------------------------------------
// 3. Curve fitting — Schneider, "An Algorithm for Automatically Fitting Digitized Curves"

type Cubic = [Point, Point, Point, Point];

const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p: Point, k: number): Point => ({ x: p.x * k, y: p.y * k });
const dot = (p: Point, q: Point) => p.x * q.x + p.y * q.y;
const len = (p: Point) => Math.hypot(p.x, p.y);
const unit = (p: Point): Point => {
  const l = len(p);
  return l === 0 ? { x: 0, y: 0 } : mul(p, 1 / l);
};

function bezierAt([p0, p1, p2, p3]: Cubic, t: number): Point {
  const u = 1 - t;
  return add(
    add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)),
    add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)),
  );
}

/** Drop vertices within `epsilon` of the line between their neighbours (Douglas–Peucker). */
function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0] as Point;
  const last = points[points.length - 1] as Point;
  const dir = sub(last, first);
  const l = len(dir);
  let worst = 0;
  let at = -1;
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i] as Point;
    const distance =
      l === 0
        ? len(sub(p, first))
        : Math.abs(dir.x * (first.y - p.y) - (first.x - p.x) * dir.y) / l;
    if (distance > worst) {
      worst = distance;
      at = i;
    }
  }
  if (worst <= epsilon) return [first, last];
  const left = simplify(points.slice(0, at + 1), epsilon);
  const right = simplify(points.slice(at), epsilon);
  return [...left.slice(0, -1), ...right];
}

function chordLengths(points: Point[]): number[] {
  const u = [0];
  for (let i = 1; i < points.length; i += 1) {
    u.push((u[i - 1] as number) + len(sub(points[i] as Point, points[i - 1] as Point)));
  }
  const total = u[u.length - 1] as number;
  return u.map((v) => (total === 0 ? 0 : v / total));
}

function generateBezier(points: Point[], u: number[], t0: Point, t3: Point): Cubic {
  const p0 = points[0] as Point;
  const p3 = points[points.length - 1] as Point;
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  for (let i = 0; i < points.length; i += 1) {
    const t = u[i] as number;
    const s = 1 - t;
    const b1 = 3 * s * s * t;
    const b2 = 3 * s * t * t;
    const a0 = mul(t0, b1);
    const a1 = mul(t3, b2);
    c00 += dot(a0, a0);
    c01 += dot(a0, a1);
    c11 += dot(a1, a1);
    const base = add(mul(p0, s * s * s + b1), mul(p3, b2 + t * t * t));
    const residual = sub(points[i] as Point, base);
    x0 += dot(a0, residual);
    x1 += dot(a1, residual);
  }
  const det = c00 * c11 - c01 * c01;
  let alpha0 = det === 0 ? 0 : (x0 * c11 - x1 * c01) / det;
  let alpha1 = det === 0 ? 0 : (c00 * x1 - c01 * x0) / det;
  const segment = len(sub(p3, p0));
  // The Wu–Barsky heuristic when the least squares turn degenerate: a handle that is not
  // positive, or longer than the chord. The second case is what a straight run of points
  // produces — with both tangents along the line every handle length fits the samples
  // equally, the normal equations are singular, and the solution can be enormous, which draws
  // a curve that shoots past the endpoints and comes back. Measured at the samples it looks
  // exact; drawn, it is a spike.
  if (
    !(alpha0 > 1e-6 * segment) ||
    !(alpha1 > 1e-6 * segment) ||
    alpha0 > segment ||
    alpha1 > segment
  ) {
    alpha0 = segment / 3;
    alpha1 = segment / 3;
  }
  return [p0, add(p0, mul(t0, alpha0)), add(p3, mul(t3, alpha1)), p3];
}

function distanceToPolyline(p: Point, line: Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < line.length; i += 1) {
    const a = line[i] as Point;
    const b = line[i + 1] as Point;
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
    best = Math.min(best, len(sub(p, add(a, mul(ab, t)))));
  }
  return best;
}

/** The worst distance between the curve and the points — at each point's own parameter, as
 * Schneider has it, and also from the curve sampled between parameters back to the polyline,
 * which is what catches a curve that passes through every sample and bulges between them. */
function worstFit(points: Point[], curve: Cubic, u: number[]): { error: number; at: number } {
  let error = 0;
  let at = Math.floor(points.length / 2);
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = len(sub(bezierAt(curve, u[i] as number), points[i] as Point));
    if (d > error) {
      error = d;
      at = i;
    }
  }
  for (let k = 1; k < 24; k += 1) {
    const d = distanceToPolyline(bezierAt(curve, k / 24), points);
    if (d > error) error = d;
  }
  return { error, at };
}

function reparameterise(points: Point[], curve: Cubic, u: number[]): number[] {
  const [p0, p1, p2, p3] = curve;
  const d1 = [mul(sub(p1, p0), 3), mul(sub(p2, p1), 3), mul(sub(p3, p2), 3)] as const;
  const d2 = [mul(sub(d1[1], d1[0]), 2), mul(sub(d1[2], d1[1]), 2)] as const;
  return u.map((t, i) => {
    const q = bezierAt(curve, t);
    const s = 1 - t;
    const q1 = add(add(mul(d1[0], s * s), mul(d1[1], 2 * s * t)), mul(d1[2], t * t));
    const q2 = add(mul(d2[0], s), mul(d2[1], t));
    const diff = sub(q, points[i] as Point);
    const numerator = dot(diff, q1);
    const denominator = dot(q1, q1) + dot(diff, q2);
    return denominator === 0 ? t : t - numerator / denominator;
  });
}

function fitCubics(points: Point[], t0: Point, t3: Point, tolerance: number): Cubic[] {
  if (points.length === 2) {
    const p0 = points[0] as Point;
    const p3 = points[1] as Point;
    const third = len(sub(p3, p0)) / 3;
    return [[p0, add(p0, mul(t0, third)), add(p3, mul(t3, third)), p3]];
  }
  let u = chordLengths(points);
  let curve = generateBezier(points, u, t0, t3);
  let { error, at } = worstFit(points, curve, u);
  if (error < tolerance) return [curve];
  if (error < tolerance * 4) {
    for (let i = 0; i < 8; i += 1) {
      u = reparameterise(points, curve, u);
      curve = generateBezier(points, u, t0, t3);
      ({ error, at } = worstFit(points, curve, u));
      if (error < tolerance) return [curve];
    }
  }
  // Split at the worst point, with a tangent through it, and fit each side.
  const centre = unit(sub(points[at - 1] as Point, points[at + 1] as Point));
  return [
    ...fitCubics(points.slice(0, at + 1), t0, centre, tolerance),
    ...fitCubics(points.slice(at), mul(centre, -1), t3, tolerance),
  ];
}

/** Indices of the vertices of a closed polyline that are corners. */
function corners(points: Point[]): number[] {
  const n = points.length;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i - 1 + n) % n] as Point;
    const here = points[i] as Point;
    const next = points[(i + 1) % n] as Point;
    const a = unit(sub(here, prev));
    const b = unit(sub(next, here));
    const turn = (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;
    if (turn > CORNER_DEGREES) out.push(i);
  }
  return out;
}

/** A closed polyline as a run of cubics: smooth through the seam unless the seam is a corner. */
function fitLoop(loop: Point[]): Cubic[] {
  const points = simplify([...loop, loop[0] as Point], 0.02).slice(0, -1);
  const n = points.length;
  if (n < 3) return [];
  const sharp = corners(points);
  if (sharp.length === 0) {
    const ring = [...points, points[0] as Point];
    const t0 = unit(sub(points[1] as Point, points[n - 1] as Point));
    return fitCubics(ring, t0, mul(t0, -1), FIT_TOLERANCE);
  }
  // Open the loop at each corner and fit the pieces between them, one-sided tangents at corners.
  const out: Cubic[] = [];
  for (let k = 0; k < sharp.length; k += 1) {
    const from = sharp[k] as number;
    const to = sharp[(k + 1) % sharp.length] as number;
    const piece: Point[] = [points[from] as Point];
    for (let i = (from + 1) % n; ; i = (i + 1) % n) {
      piece.push(points[i] as Point);
      if (i === to) break;
    }
    const t0 = unit(sub(piece[1] as Point, piece[0] as Point));
    const t3 = unit(sub(piece[piece.length - 2] as Point, piece[piece.length - 1] as Point));
    out.push(...fitCubics(piece, t0, t3, FIT_TOLERANCE));
  }
  return out;
}

const fmt = (v: number) => {
  const s = v.toFixed(2);
  return s.includes(".") ? s.replace(/\.?0+$/, "") || "0" : s;
};

function pathData(loops: Cubic[][], offset: Point = { x: 0, y: 0 }): string {
  const parts: string[] = [];
  const at = (p: Point) => `${fmt(p.x + offset.x)} ${fmt(p.y + offset.y)}`;
  for (const cubics of loops) {
    if (cubics.length === 0) continue;
    parts.push(`M${at((cubics[0] as Cubic)[0])}`);
    for (const [, p1, p2, p3] of cubics) parts.push(`C${at(p1)} ${at(p2)} ${at(p3)}`);
    parts.push("Z");
  }
  return parts.join("");
}

const curveCount = (loops: Cubic[][]) => loops.reduce((a, l) => a + l.length, 0);

function trace(image: Image, c: Component, field = coverage(image, c)): Cubic[][] {
  return contours(field, image.width, image.height, c).map(fitLoop);
}

// ---------------------------------------------------------------------------------------------
// 4. Colour

const hex = (c: [number, number, number]) =>
  `#${c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

function meanColour(image: Image, pixels: number[]): [number, number, number] {
  const sum = [0, 0, 0];
  for (const p of pixels) {
    const c = rgb(image, p);
    sum[0] += c[0];
    sum[1] += c[1];
    sum[2] += c[2];
  }
  return sum.map((v) => v / pixels.length) as [number, number, number];
}

interface Gradient {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: { offset: number; color: string }[];
  /** Mean absolute error per channel of the fit, over the interior. */
  residual: number;
  degrees: number;
}

/** The linear gradient, at whichever of `angles`, that best explains the interior pixels. */
function fitGradient(image: Image, pixels: number[], angles: number[]): Gradient {
  const { width } = image;
  const samples = pixels.map((p) => ({
    x: (p % width) + 0.5,
    y: Math.floor(p / width) + 0.5,
    c: rgb(image, p),
  }));
  let best: Gradient | undefined;
  for (const degrees of angles) {
    const theta = (degrees * Math.PI) / 180;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const u = samples.map((s) => s.x * dx + s.y * dy);
    const lo = Math.min(...u);
    const hi = Math.max(...u);
    const bins = Array.from({ length: GRADIENT_STOPS }, () => ({ n: 0, c: [0, 0, 0] }));
    const binOf = (v: number) =>
      Math.min(GRADIENT_STOPS - 1, Math.floor(((v - lo) / (hi - lo + 1e-9)) * GRADIENT_STOPS));
    samples.forEach((s, i) => {
      const b = bins[binOf(u[i] as number)] as { n: number; c: number[] };
      b.n += 1;
      for (let k = 0; k < 3; k += 1) b.c[k] = (b.c[k] as number) + (s.c[k] as number);
    });
    let residual = 0;
    samples.forEach((s, i) => {
      const b = bins[binOf(u[i] as number)] as { n: number; c: number[] };
      for (let k = 0; k < 3; k += 1) {
        residual += Math.abs((s.c[k] as number) - (b.c[k] as number) / b.n);
      }
    });
    residual /= samples.length * 3;
    if (best && residual >= best.residual) continue;
    const stops = bins
      .map((b, i) => ({
        offset: (i + 0.5) / GRADIENT_STOPS,
        color: b.n === 0 ? "" : hex(b.c.map((v) => v / b.n) as [number, number, number]),
      }))
      .filter((s) => s.color !== "");
    best = { x1: lo * dx, y1: lo * dy, x2: hi * dx, y2: hi * dy, stops, residual, degrees };
  }
  if (!best) throw new Error("fitGradient: no angles to try");
  return best;
}

function shifted(g: Gradient, offset: Point): Gradient {
  return {
    ...g,
    x1: g.x1 + offset.x,
    y1: g.y1 + offset.y,
    x2: g.x2 + offset.x,
    y2: g.y2 + offset.y,
  };
}

function gradientMarkup(id: string, g: Gradient): string {
  const stops = g.stops
    .map((s) => `<stop offset="${fmt(s.offset)}" stop-color="${s.color}"/>`)
    .join("");
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(g.x1)}" y1="${fmt(g.y1)}" x2="${fmt(g.x2)}" y2="${fmt(g.y2)}">${stops}</linearGradient>`;
}

/** One colour sample every this many pixels of the original. */
const RASTER_STEP = 4;
/** How far past the shape the colour raster reaches, filled with the nearest colour inside. */
const RASTER_MARGIN = 8;

interface Raster {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: number;
}

/**
 * The colour of a shape as a small raster, for the one shape no gradient explains.
 *
 * The «R» is coloured in two dimensions: cyan in the top-left corner, a lighter blue across the
 * bowl's arm and the hammer's head, the deepest blue down the stem and along the handle. The best
 * linear gradient at any angle leaves a mean error of four and a half levels per channel and
 * bands of twenty to thirty where it is wrong; a radial overlay or a second veil on top brings
 * that to four. Measured on 13 October 2026, each in turn. So the colour is kept as what it is: a
 * field that varies slowly, sampled every `RASTER_STEP` pixels — the «R» becomes 65 × 61 samples,
 * three kilobytes — and drawn under the vector outline as a clip. Between samples the browser
 * interpolates, and the colour field has nothing sharper than that to lose; the **shape** stays a
 * vector at every size. When Retorika's own vector arrives with the gradients it was drawn with,
 * this is the part that goes.
 *
 * Only pixels well inside the shape contribute, so no white from the antialiased edge bleeds in;
 * every other sample in the raster's box takes the colour of the nearest such pixel, which is
 * what the clip then shows along the edge.
 */
function colourRaster(image: Image, c: Component): Raster {
  const { width, height } = image;
  const x0 = Math.max(0, c.x0 - RASTER_MARGIN);
  const y0 = Math.max(0, c.y0 - RASTER_MARGIN);
  const cols = Math.ceil((Math.min(width, c.x1 + RASTER_MARGIN + 1) - x0) / RASTER_STEP);
  const rows = Math.ceil((Math.min(height, c.y1 + RASTER_MARGIN + 1) - y0) / RASTER_STEP);
  const bw = cols * RASTER_STEP;
  const bh = rows * RASTER_STEP;
  // Each pixel of the box takes the colour of the nearest interior pixel, by breadth-first growth.
  const source = new Int32Array(bw * bh).fill(-1);
  let frontier: number[] = [];
  for (const p of interior(image, c)) {
    const bx = (p % width) - x0;
    const by = Math.floor(p / width) - y0;
    if (bx < 0 || by < 0 || bx >= bw || by >= bh) continue;
    source[by * bw + bx] = p;
    frontier.push(by * bw + bx);
  }
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const q of frontier) {
      for (const [nx, ny] of neighbours(q % bw, Math.floor(q / bw))) {
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const r = ny * bw + nx;
        if (source[r] === -1) {
          source[r] = source[q] as number;
          next.push(r);
        }
      }
    }
    frontier = next;
  }
  const data = Buffer.alloc(cols * rows * 4);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const sum = [0, 0, 0];
      for (let dy = 0; dy < RASTER_STEP; dy += 1) {
        for (let dx = 0; dx < RASTER_STEP; dx += 1) {
          const p = source[(row * RASTER_STEP + dy) * bw + col * RASTER_STEP + dx] as number;
          const colour = rgb(image, p);
          for (let k = 0; k < 3; k += 1) sum[k] = (sum[k] as number) + (colour[k] as number);
        }
      }
      const i = (row * cols + col) * 4;
      for (let k = 0; k < 3; k += 1)
        data[i + k] = Math.round((sum[k] as number) / RASTER_STEP ** 2);
      data[i + 3] = 255;
    }
  }
  const png = encode({ width: cols, height: rows, data, profile: [] });
  return {
    href: `data:image/png;base64,${png.toString("base64")}`,
    x: x0,
    y: y0,
    width: bw,
    height: bh,
    bytes: png.length,
  };
}

function imageMarkup(id: string, clip: string, r: Raster, offset: Point): string {
  return `<image id="${id}" clip-path="url(#${clip})" href="${r.href}" x="${r.x + offset.x}" y="${r.y + offset.y}" width="${r.width}" height="${r.height}" preserveAspectRatio="none"/>`;
}

// ---------------------------------------------------------------------------------------------
// 5. The hammer, cut out of the «R» for the animation

/**
 * Where the hammer ends and the letter begins, in pixels of the mark, drawn by hand on the 8×
 * enlargement on 13 October 2026. The hammer and the bowl of the «R» are one colour and meet
 * along the claw: the only places the PNG itself separates them are the white notch above the
 * claw's tip and the open paper around everything else. `SEAM` is the stretch of this polygon
 * that actually crosses ink, from the corner of the counter down to where the handle's upper
 * edge comes clear of the bowl; between its two ends the line is a judgement. At rest the cut
 * is invisible: both pieces take the same gradient in the mark's coordinates and the hammer is
 * drawn on top. The rest of the polygon is generous open paper.
 */
const SEAM: Point[] = [
  { x: 150, y: 96 },
  { x: 158, y: 102 },
  { x: 166, y: 107 },
  { x: 174, y: 110 },
  { x: 178, y: 113 },
  { x: 187, y: 113 },
  { x: 189, y: 122 },
  { x: 184, y: 133 },
  { x: 179, y: 142 },
  { x: 177, y: 150 },
];
const HAMMER_CUT: Point[] = [
  { x: 80, y: 128 },
  { x: 100, y: 112 },
  { x: 120, y: 100 },
  ...SEAM,
  { x: 245, y: 218 },
  { x: 245, y: 252 },
  { x: 200, y: 252 },
  { x: 110, y: 175 },
  { x: 80, y: 160 },
];

/** How far the letter reaches under the hammer along the seam, so no hairline opens between them. */
const UNDERLAP = 2.5;

function insidePolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i] as Point;
    const b = poly[j] as Point;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** The hammer's field is the «R»'s inside the cut; the letter's is the rest, reaching `UNDERLAP`
 * under the hammer along the seam. A pixel the cut crosses is weighted by how much of it lies on
 * each side. */
function split(field: Float32Array, width: number, height: number) {
  const hammer = new Float32Array(width * height);
  const letter = new Float32Array(width * height);
  const N = 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const v = field[y * width + x] as number;
      if (v === 0) continue;
      let inHammer = 0;
      let inLetter = 0;
      for (let sy = 0; sy < N; sy += 1) {
        for (let sx = 0; sx < N; sx += 1) {
          const p = { x: x + (sx + 0.5) / N, y: y + (sy + 0.5) / N };
          const inside = insidePolygon(p, HAMMER_CUT);
          if (inside) inHammer += 1;
          if (!inside || distanceToPolyline(p, SEAM) < UNDERLAP) inLetter += 1;
        }
      }
      hammer[y * width + x] = (v * inHammer) / (N * N);
      letter[y * width + x] = (v * inLetter) / (N * N);
    }
  }
  return { hammer, letter };
}

/** The handle's centreline where it leaves the bowl: the point the animation turns the hammer
 * about. Found on the handle itself — rows near the bottom of the hammer, where the «R» is only
 * the handle — as the line through the row midpoints, carried up to the first row that is wider
 * than the handle, which is where the claw begins. */
function hammerPivot(field: Float32Array, width: number, height: number): Point {
  const rows: { y: number; mid: number; span: number }[] = [];
  for (let y = 0; y < height; y += 1) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < width; x += 1) {
      if ((field[y * width + x] as number) >= 0.5) {
        if (x0 === -1) x0 = x;
        x1 = x;
      }
    }
    if (x0 !== -1) rows.push({ y: y + 0.5, mid: (x0 + x1 + 1) / 2, span: x1 - x0 + 1 });
  }
  const bottom = (rows[rows.length - 1] as { y: number }).y;
  const handle = rows.filter((r) => r.y < bottom - 12 && r.y > bottom - 50);
  const n = handle.length;
  const my = handle.reduce((a, r) => a + r.y, 0) / n;
  const mx = handle.reduce((a, r) => a + r.mid, 0) / n;
  const slope =
    handle.reduce((a, r) => a + (r.y - my) * (r.mid - mx), 0) /
    handle.reduce((a, r) => a + (r.y - my) ** 2, 0);
  // The handle widens a little towards the tip, so «wider than the handle» is measured against
  // the widest of its own rows, with room to spare: the claw adds thirty pixels, not three.
  const handleSpan = Math.max(...handle.map((r) => r.span));
  let junction = handle[0] as { y: number };
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const r = rows[i] as { y: number; span: number };
    if (r.span > handleSpan * 1.3) break;
    junction = r;
  }
  return { x: mx + slope * (junction.y - my), y: junction.y };
}

// ---------------------------------------------------------------------------------------------
// 6. Checking against the pixels, in Chromium

interface Fidelity {
  meanAbs: number;
  p99: number;
  over48: number;
  total: number;
}

async function rasterise(
  browser: Browser,
  svg: string,
  width: number,
  height: number,
): Promise<Uint8ClampedArray> {
  const page = await browser.newPage();
  try {
    const data = await page.evaluate(
      async ({ svg, width, height }) => {
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d") as CanvasRenderingContext2D;
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        return Array.from(context.getImageData(0, 0, width, height).data);
      },
      { svg, width, height },
    );
    return new Uint8ClampedArray(data);
  } finally {
    await page.close();
  }
}

function compare(original: Image, drawn: Uint8ClampedArray): Fidelity {
  const total = original.width * original.height;
  const worst = new Uint8Array(total);
  let over48 = 0;
  let sum = 0;
  for (let i = 0; i < total; i += 1) {
    let w = 0;
    for (let k = 0; k < 3; k += 1) {
      const d = Math.abs((original.data[i * 4 + k] as number) - (drawn[i * 4 + k] as number));
      sum += d;
      w = Math.max(w, d);
    }
    worst[i] = w;
    if (w > 48) over48 += 1;
  }
  const sorted = Array.from(worst).sort((a, b) => a - b);
  return {
    meanAbs: sum / (total * 3),
    p99: sorted[Math.floor(total * 0.99)] as number,
    over48,
    total,
  };
}

/** Original, vector and their difference side by side at 3×, for the eye. */
async function sideBySide(
  browser: Browser,
  name: string,
  original: Image,
  originalPng: Buffer,
  svg: string,
): Promise<void> {
  const { width, height } = original;
  const page = await browser.newPage({
    viewport: { width: width * 9 + 40, height: height * 3 + 20 },
  });
  try {
    const png = `data:image/png;base64,${originalPng.toString("base64")}`;
    const vector = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const size = `width="${width * 3}" height="${height * 3}"`;
    await page.setContent(
      `<body style="margin:10px;background:#888;display:flex;gap:10px">
        <img id="p" src="${png}" ${size} style="image-rendering:pixelated;background:#fff">
        <img id="v" src="${vector}" ${size} style="background:#fff">
        <canvas id="d" width="${width}" height="${height}" style="width:${width * 3}px;height:${height * 3}px;image-rendering:pixelated;background:#fff"></canvas>
      </body>`,
    );
    await page.evaluate(
      async ({ width, height }) => {
        const p = document.getElementById("p") as HTMLImageElement;
        const v = document.getElementById("v") as HTMLImageElement;
        await Promise.all([p.decode(), v.decode()]);
        const pixels = (img: HTMLImageElement) => {
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          const x = c.getContext("2d") as CanvasRenderingContext2D;
          x.fillStyle = "#fff";
          x.fillRect(0, 0, width, height);
          x.drawImage(img, 0, 0, width, height);
          return x.getImageData(0, 0, width, height).data;
        };
        const a = pixels(p);
        const b = pixels(v);
        const out = new ImageData(width, height);
        for (let i = 0; i < width * height; i += 1) {
          let d = 0;
          for (let k = 0; k < 3; k += 1) {
            d = Math.max(d, Math.abs((a[i * 4 + k] as number) - (b[i * 4 + k] as number)));
          }
          const shade = 255 - Math.min(255, d * 4);
          out.data[i * 4] = 255;
          out.data[i * 4 + 1] = shade;
          out.data[i * 4 + 2] = shade;
          out.data[i * 4 + 3] = 255;
        }
        const canvas = document.getElementById("d") as HTMLCanvasElement;
        (canvas.getContext("2d") as CanvasRenderingContext2D).putImageData(out, 0, 0);
      },
      { width, height },
    );
    mkdirSync(SCRATCH, { recursive: true });
    await page.screenshot({ path: join(SCRATCH, `${name}.png`) });
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------------------------
// The two logos

/**
 * The PNG's pixels **as a browser shows them**. The delivered files are tagged Display P3
 * (`iCCP` «kCGColorSpaceDisplayP3», `cICP` 12/13/0/1) — a wide-gamut export from a Mac — and a
 * browser converts them to sRGB on display, so the stored bytes are not the colours anyone sees:
 * the brand blue is stored as (81, 177, 244) and shown as (6, 180, 250). An SVG's colours are
 * sRGB, so the vectors must take their colours from the shown pixels, and Chromium is asked for
 * them through a canvas rather than this script learning colour management. The same decode is
 * the reference the vectors are measured against below.
 */
async function load(browser: Browser, name: string): Promise<{ image: Image; bytes: Buffer }> {
  const bytes = readFileSync(join(SOURCE, name));
  const page = await browser.newPage();
  try {
    const shown = await page.evaluate(async (png) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d") as CanvasRenderingContext2D;
      context.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data),
      };
    }, bytes.toString("base64"));
    return {
      image: {
        width: shown.width,
        height: shown.height,
        data: Buffer.from(shown.data),
        profile: [],
      },
      bytes,
    };
  } finally {
    await page.close();
  }
}

/** The opening tag, with the title a screen reader gets where the file is used as an image. */
const svgOpen = (width: number, height: number, title = "Retorika Builder") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>${title}</title>`;

console.log("brand:vector — tracing the delivered logos\n");
const browser = await chromium.launch();

// --- The mark ------------------------------------------------------------------------------
const mark = await load(browser, "LogoOficialRetorikaBuilder.png");
const markParts = components(mark.image);
if (markParts.length !== 4) {
  throw new Error(
    `the mark should be four shapes, the R and three blocks; found ${markParts.length}`,
  );
}
const [letterAndHammer, ...rest] = markParts as [Component, Component, Component, Component];
const everyAngle = Array.from({ length: 90 }, (_, i) => i * 2);
// The blocks by where they sit: light blue top left, blue bottom left, rose bottom right. Each
// is a flat colour to the eye and a shallow gradient to the pixels — twenty levels of green
// across the light one — so each gets its own.
const blocks = [
  { id: "block-sky", component: rest.find((b) => b.y0 < 150) },
  { id: "block-blue", component: rest.find((b) => b.y0 >= 150 && b.x0 < 75) },
  { id: "block-rose", component: rest.find((b) => b.y0 >= 150 && b.x0 >= 75) },
].map(({ id, component }) => {
  if (!component) throw new Error(`${id} is not where the mark puts it`);
  const loops = trace(mark.image, component);
  const gradient = fitGradient(mark.image, interior(mark.image, component), everyAngle);
  console.log(
    `${id}: ${curveCount(loops)} curves; gradient at ${gradient.degrees}°, residual ${gradient.residual.toFixed(2)}`,
  );
  return { id, loops, gradient };
});

const rField = coverage(mark.image, letterAndHammer);
const rLoops = trace(mark.image, letterAndHammer, rField);
const rColour = colourRaster(mark.image, letterAndHammer);
const rGradient = fitGradient(mark.image, interior(mark.image, letterAndHammer), everyAngle);
console.log(
  `the «R»: ${rLoops.length} outlines, ${curveCount(rLoops)} curves; colour as ${rColour.width / RASTER_STEP} × ` +
    `${rColour.height / RASTER_STEP} samples, ${(rColour.bytes / 1024).toFixed(1)} KB (the best linear ` +
    `gradient, at ${rGradient.degrees}°, would leave ${rGradient.residual.toFixed(2)} per channel)`,
);

const markDefs = (offset: Point) =>
  `<clipPath id="rb-r"><path d="${pathData(rLoops, offset)}"/></clipPath>` +
  blocks.map((b) => gradientMarkup(`rb-${b.id}`, shifted(b.gradient, offset))).join("");
const markBody = (offset: Point) =>
  imageMarkup("letter-and-hammer", "rb-r", rColour, offset) +
  blocks
    .map((b) => `<path id="${b.id}" fill="url(#rb-${b.id})" d="${pathData(b.loops, offset)}"/>`)
    .join("");

const markSvg = `${svgOpen(mark.image.width, mark.image.height, "Retorika")}<defs>${markDefs({ x: 0, y: 0 })}</defs>${markBody({ x: 0, y: 0 })}</svg>`;

// --- The lockup ----------------------------------------------------------------------------
const lockup = await load(browser, "LogoOficialRetorikaBuilderTexto.png");
// The mark inside the lockup is the mark, moved: checked pixel by pixel before the trace is reused.
const MARK_OFFSET: Point = { x: 10, y: 4 };
for (let y = 0; y < mark.image.height; y += 1) {
  for (let x = 0; x < mark.image.width; x += 1) {
    const ly = y + MARK_OFFSET.y;
    const lx = x + MARK_OFFSET.x;
    if (ly >= lockup.image.height || lx >= lockup.image.width) continue;
    for (let k = 0; k < 3; k += 1) {
      const a = mark.image.data[(y * mark.image.width + x) * 4 + k];
      const b = lockup.image.data[(ly * lockup.image.width + lx) * 4 + k];
      if (a !== b) throw new Error(`the lockup's mark differs from the mark at ${x},${y}`);
    }
  }
}
const textParts = components(lockup.image).filter((c) => c.x0 >= mark.image.width + MARK_OFFSET.x);
// «Retorika» is a dark navy, «Builder» the brand blue: the blue channel tells them apart.
const navy = textParts.filter(
  (c) => (meanColour(lockup.image, interior(lockup.image, c))[2] as number) < 150,
);
const builder = textParts.filter((c) => !navy.includes(c));
const navyFill = hex(
  meanColour(
    lockup.image,
    navy.flatMap((c) => interior(lockup.image, c)),
  ),
);
const builderGradient = fitGradient(
  lockup.image,
  builder.flatMap((c) => interior(lockup.image, c)),
  Array.from({ length: 41 }, (_, i) => i - 20),
);
const navyLoops = navy.flatMap((c) => trace(lockup.image, c));
const builderLoops = builder.flatMap((c) => trace(lockup.image, c));
console.log(
  `the lockup: «Retorika» ${navy.length} shapes, ${curveCount(navyLoops)} curves, ${navyFill}; ` +
    `«Builder» ${builder.length} shapes, ${curveCount(builderLoops)} curves, gradient at ` +
    `${builderGradient.degrees}°, residual ${builderGradient.residual.toFixed(2)}`,
);
const lockupSvg =
  `${svgOpen(lockup.image.width, lockup.image.height)}<defs>${markDefs(MARK_OFFSET)}${gradientMarkup("rb-builder", builderGradient)}</defs>` +
  `${markBody(MARK_OFFSET)}<path id="retorika" fill="${navyFill}" d="${pathData(navyLoops)}"/>` +
  `<path id="builder" fill="url(#rb-builder)" d="${pathData(builderLoops)}"/></svg>`;

// --- The animated mark's pieces -------------------------------------------------------------
const pieces = split(rField, mark.image.width, mark.image.height);
const letterLoops = trace(mark.image, letterAndHammer, pieces.letter);
const hammerLoops = trace(mark.image, letterAndHammer, pieces.hammer);
const pivot = hammerPivot(pieces.hammer, mark.image.width, mark.image.height);
console.log(
  `the pieces: letter ${curveCount(letterLoops)} curves, hammer ${curveCount(hammerLoops)} curves, ` +
    `pivot ${fmt(pivot.x)},${fmt(pivot.y)}`,
);
// Together the pieces must draw the «R» again; measured below like the two logos.
const piecesSvg =
  `${svgOpen(mark.image.width, mark.image.height)}<defs><clipPath id="rb-letter"><path d="${pathData(letterLoops)}"/></clipPath><clipPath id="rb-hammer"><path d="${pathData(hammerLoops)}"/></clipPath>` +
  blocks.map((b) => gradientMarkup(`rb-${b.id}`, b.gradient)).join("") +
  `</defs>${imageMarkup("letter", "rb-letter", rColour, { x: 0, y: 0 })}${imageMarkup("hammer", "rb-hammer", rColour, { x: 0, y: 0 })}` +
  blocks.map((b) => `<path fill="url(#rb-${b.id})" d="${pathData(b.loops)}"/>`).join("") +
  "</svg>";

// --- Write ---------------------------------------------------------------------------------
writeFileSync(join(SOURCE, "retorika-mark.svg"), `${markSvg}\n`);
writeFileSync(join(SOURCE, "retorika-lockup.svg"), `${lockupSvg}\n`);
const gradientLiteral = (g: Gradient, indent: string) =>
  `{\n${indent}  x1: ${fmt(g.x1)},\n${indent}  y1: ${fmt(g.y1)},\n${indent}  x2: ${fmt(g.x2)},\n${indent}  y2: ${fmt(g.y2)},\n${indent}  stops: [\n` +
  g.stops.map((s) => `${indent}    { offset: ${fmt(s.offset)}, color: "${s.color}" },`).join("\n") +
  `\n${indent}  ],\n${indent}}`;
writeFileSync(
  EDITOR_PATHS,
  `/**
 * The Retorika mark as vectors, for the building screen's animated mark (\`BuildingMark.tsx\`).
 *
 * **Generated by \`pnpm brand:vector\` from \`docs/design/brand/LogoOficialRetorikaBuilder.png\`;
 * do not edit.** The «R» is cut into the letter and the hammer along a line drawn through the
 * white notch that separates the claw from the bowl (\`SEAM\` in \`scripts/brand-vector.ts\`);
 * each is a clip over the same colour raster, \`MARK_COLOUR\`, placed in the mark's coordinates,
 * so together at rest they draw what \`retorika-mark.svg\` draws. The pivot is where the handle's
 * centreline leaves the bowl. The blocks are paths with their own gradients, in the same space.
 */

export const MARK_WIDTH = ${mark.image.width};
export const MARK_HEIGHT = ${mark.image.height};

/** The colour of the «R», ${rColour.width / RASTER_STEP} × ${rColour.height / RASTER_STEP} samples of the PNG as shown, to be drawn with \`preserveAspectRatio="none"\`. */
export const MARK_COLOUR = {
  href: "${rColour.href}",
  x: ${rColour.x},
  y: ${rColour.y},
  width: ${rColour.width},
  height: ${rColour.height},
} as const;

export const LETTER_PATH =
  "${pathData(letterLoops)}";

export const HAMMER_PATH =
  "${pathData(hammerLoops)}";

export const HAMMER_PIVOT = { x: ${fmt(pivot.x)}, y: ${fmt(pivot.y)} } as const;

/** Each block's outline and its gradient, for \`gradientUnits="userSpaceOnUse"\`. */
export const BLOCKS = {
${blocks.map((b) => `  "${b.id}": {\n    d: "${pathData(b.loops)}",\n    gradient: ${gradientLiteral(b.gradient, "    ")},\n  },`).join("\n")}
} as const;
`,
);

// --- Measure -------------------------------------------------------------------------------
console.log("\nagainst the pixels as shown, drawn by Chromium at the original size:");
try {
  for (const [name, source, svg] of [
    ["retorika-mark", mark, markSvg],
    ["retorika-lockup", lockup, lockupSvg],
    ["building-mark-pieces", mark, piecesSvg],
  ] as const) {
    const drawn = await rasterise(browser, svg, source.image.width, source.image.height);
    const f = compare(source.image, drawn);
    if (process.env["BRAND_VECTOR_DEBUG"]) {
      mkdirSync(SCRATCH, { recursive: true });
      writeFileSync(
        join(SCRATCH, `${name}-drawn.png`),
        encode({
          width: source.image.width,
          height: source.image.height,
          data: Buffer.from(drawn),
          profile: [],
        }),
      );
    }
    console.log(
      `  ${name}: mean |Δ| ${f.meanAbs.toFixed(2)} per channel; 99% of pixels within ${f.p99}; ` +
        `${f.over48} of ${f.total} pixels (${((f.over48 / f.total) * 100).toFixed(2)}%) off by more than 48; ` +
        `${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`,
    );
    await sideBySide(browser, name, source.image, source.bytes, svg);
  }
} finally {
  await browser.close();
}
console.log(`\nside-by-side images in ${SCRATCH.slice(ROOT.length + 1)}/`);
