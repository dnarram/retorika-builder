import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **The face rises and the box does not; the mark's shadow follows** (sprint 39 día 6, David's P3
 * and P4 with his adjustment 2). What the walk measures in Chromium — the box still under a press 20
 * ms after the pointer arrives, the shadow writing nothing — rests on what is written here: where the
 * movement is declared, what it may touch, and who wears it.
 */

const SRC = join(import.meta.dirname, "..", "src");
const CSS = readFileSync(join(SRC, "app", "globals.css"), "utf8");
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");
const KIT = read("editor", "panelKit.tsx");
const STYLE = read("questionnaire", "StylePanel.tsx");
const MENU = read("questionnaire", "MenuPanel.tsx");
const PHOTOS = read("questionnaire", "PhotosPanel.tsx");

/** The body of `@utility name { … }`, braces balanced. */
function utility(name: string): string {
  const start = CSS.indexOf(`@utility ${name} {`);
  expect(start, `globals.css declares no ${name}`).toBeGreaterThan(-1);
  let depth = 0;
  for (let at = CSS.indexOf("{", start); at < CSS.length; at += 1) {
    if (CSS[at] === "{") depth += 1;
    if (CSS[at] === "}") depth -= 1;
    if (depth === 0) return CSS.slice(start, at + 1);
  }
  throw new Error(`${name} never closes`);
}

const LAYOUT =
  /(^|[\s;{])(width|height|top|left|right|bottom|inset|margin[\w-]*|padding[\w-]*)\s*:/;

describe("ui-face", () => {
  const face = utility("ui-face");

  it("moves the face by translate and its shadow, in --ui-fast, and no layout", () => {
    expect(face).toMatch(/transition-property:\s*[^;]*\btranslate\b/);
    expect(face).toMatch(/transition-property:\s*[^;]*\bbox-shadow\b/);
    expect(face).toMatch(/transition-duration:\s*var\(--ui-fast\)/);
    expect(face).not.toMatch(/transition-property:\s*[^;]*\b(all|width|height|margin|padding)\b/);
    expect(face, "the face moves nothing that reflows").not.toMatch(LAYOUT);
    expect(face, "a spring is for what arrives").not.toMatch(/--ui-spring/);
  });

  it("rises only under a mouse, never under less movement, and never when chosen", () => {
    const hover = face.slice(face.indexOf("@media (hover: hover)"));
    expect(face.indexOf("@media (hover: hover)")).toBeGreaterThan(-1);
    const rise = /translate:\s*0 -1px/.exec(face);
    expect(rise, "the face rises a pixel").not.toBeNull();
    // The rise sits inside `no-preference`, which sits inside `(hover: hover)`.
    const noPreference = hover.indexOf("prefers-reduced-motion: no-preference");
    expect(noPreference).toBeGreaterThan(-1);
    expect(hover.indexOf("translate: 0 -1px")).toBeGreaterThan(noPreference);
    for (const rule of face.matchAll(/:hover > &([^{]*)\{/g)) {
      expect(rule[1], "a chosen face is already the answer").toContain(":not([data-chosen])");
    }
  });
});

describe("ui-follow", () => {
  it("follows on --ui-fast with the plain curve, transform and opacity alone", () => {
    const follow = utility("ui-follow");
    expect(follow).toMatch(/transition-property:\s*transform,\s*opacity;/);
    expect(follow).toMatch(/transition-duration:\s*var\(--ui-fast\)/);
    expect(follow).toMatch(/transition-timing-function:\s*var\(--ui-ease\)/);
  });
});

describe("who wears the face", () => {
  it("is the Face of the kit, which carries the frame, the chosen ring and the ripple", () => {
    const face = KIT.slice(KIT.indexOf("export function Face("));
    const body = face.slice(0, face.indexOf("\n}\n"));
    expect(body).toMatch(/ui-face ui-ripple rounded-ui border/);
    expect(body).toContain("ring-[3px] ring-ui-brand-surface");
    expect(body).toContain('"data-chosen"');
  });

  it("dresses the seven cards: three in «Estilo», four in «Menú»", () => {
    const faces = (source: string) => source.match(/<Face\b/g)?.length ?? 0;
    // The type pairs, the scales and the palette cards.
    expect(faces(STYLE)).toBe(3);
    // The layouts, the bar's backgrounds, the places and the button's destinations.
    expect(faces(MENU)).toBe(4);
    // And the box they are pressed by keeps nothing of the frame.
    for (const source of [STYLE, MENU]) {
      expect(source).not.toMatch(/panelChoice|panelRowSelected/);
    }
  });

  it("leaves the segment out: its answer to the mouse is the mark's shadow", () => {
    const segment = KIT.slice(KIT.indexOf("export function Segment("));
    expect(segment).not.toMatch(/<Face\b|ui-face/);
    expect(KIT).toMatch(/data-testid="segment-ghost"[\s\S]{0,120}ui-follow/);
  });

  it("previews a segment on a move of the hand, never on an entry", () => {
    const segment = KIT.slice(KIT.indexOf("export function Segment("));
    expect(segment).toContain("onPointerMove");
    expect(segment).not.toContain("onPointerEnter");
  });

  it("keeps the press box still and transparent, with the ring on it for a hidden radio", () => {
    const box = /export const pressBox = "([^"]*)"/.exec(KIT)?.[1] ?? "";
    expect(box).not.toMatch(/\b(ui-interactive|ui-ripple|ui-face|border|bg-|shadow)\b/);
    expect(KIT).toMatch(/export const pressLabel = `\$\{pressBox\} ui-choice`/);
  });
});

describe("a picture comes into focus as it arrives", () => {
  it("takes ui-blur-in on load, in the thumbnails of «Fotos» and the logo's swatch of «Menú»", () => {
    const arrive = KIT.slice(KIT.indexOf("export function arriveSharp("));
    expect(arrive.slice(0, arrive.indexOf("\n}\n"))).toContain('classList.add("ui-blur-in")');
    // On `load`, never on mounting: a class in the markup would run the arrival on an empty image.
    for (const source of [PHOTOS, MENU]) {
      expect(source.match(/onLoad=\{arriveSharp\}/g)).toHaveLength(1);
      expect(source).not.toMatch(/className="[^"]*ui-blur-in/);
    }
  });
});

describe("the focus ring on the transparent box", () => {
  /** Relative luminance of a `#rrggbb`. */
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((at) => {
      const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const token = (name: string) => {
    const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)?.[1];
    if (!value) throw new Error(`no --${name}`);
    return value;
  };

  it("is the brand on the panel's own background, at 3:1 or more (WCAG 1.4.11)", () => {
    // The box draws nothing of its own, so the ring is read against what is behind the box: the panel.
    const ring = luminance(token("ui-brand"));
    for (const ground of ["ui-surface", "ui-bg"]) {
      const behind = luminance(token(ground));
      const ratio = (Math.max(ring, behind) + 0.05) / (Math.min(ring, behind) + 0.05);
      expect(ratio, `the ring on --${ground}`).toBeGreaterThanOrEqual(3);
    }
  });
});
