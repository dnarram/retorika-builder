import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AA_NORMAL_TEXT, contrastRatio } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { CHROME_SCALE, PILL_REST_BORDER, screenPx, VERB_SCALE } from "../src/editor/chromeScale.ts";

/**
 * The interface's own colours, measured.
 *
 * **Nothing checked this before.** `pnpm test:a11y` runs axe over the *renderer's* output — every
 * preset × variant × palette a client's site can be — and `editor/styleReview.ts` reviews the
 * colours an owner types into their own document. Neither looks at the application's chrome, so
 * the only thing standing behind «#5B6B82 clears 4.5:1» was a comment somebody wrote once.
 *
 * It was not enough. Sprint 1 day 2 found `--ui-muted` shipping at 2.56:1 — the mockups' own
 * value, failing AA — and fixing it in the components still left the failing value declared in
 * this stylesheet for fourteen sprints, because nothing read it and nothing measured it.
 *
 * **The arithmetic is `packages/tokens`', not a second copy.** `contrastRatio` and `AA_NORMAL_TEXT`
 * are the same functions the client-site palettes are proved with, which is the point: one
 * definition of «readable», used for the tool and for what the tool makes.
 *
 * Thresholds are WCAG's own: **4.5:1** for normal text, **3:1** for large text and for anything
 * that is the visible identity of a control or a state (1.4.11). They are not product preferences
 * and are not negotiable downward.
 */

const CSS = readFileSync(join(import.meta.dirname, "..", "src", "app", "globals.css"), "utf8");

/**
 * The stylesheet injected into the preview iframe, which lives as strings inside `Editor.tsx`.
 *
 * **Comments stripped, and that is not tidiness.** The first version of this read the file whole
 * and found `@media (hover: hover)` in the *prose explaining the rule* rather than in the rule,
 * then failed looking for `.rb-pill:hover` 400 characters later. A guard that can be satisfied by
 * a sentence about the code is the same defect `scripts/secrets-scope.ts` was caught by in sprint
 * 15: it passes while the thing it describes is absent.
 */
const CANVAS = readFileSync(
  join(import.meta.dirname, "..", "src", "questionnaire", "Editor.tsx"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("//"))
  .join("\n");

/** The `--ui-*` colour tokens, read from the stylesheet that actually ships rather than restated
 * here — a table typed into a test is a table that can agree with itself while the app disagrees. */
function token(name: string): string {
  const found = CSS.match(new RegExp(`--ui-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!found?.[1]) throw new Error(`globals.css declares no --ui-${name}`);
  return found[1];
}

const BG = token("bg");
const SURFACE = token("surface");
const INK = token("ink");
const MUTED = token("muted");
const BRAND = token("brand");
const BRAND_SURFACE = token("brand-surface");
const BRAND_DEEP = token("brand-deep");
const DANGER = token("danger");
const DANGER_DEEP = token("danger-deep");
const BORDER_STRONG = token("border-strong");

/** WCAG 1.4.11: a boundary or a graphic that carries meaning. */
const UI_COMPONENT = 3;

/**
 * Is this rule inside one of the canvas's `@media (hover: hover)` blocks?
 *
 * **It used to be «inside the first one», and that was a trap with a fuse in it.** The check read
 * `indexOf("@media (hover: hover)")` and then looked 400 characters ahead for `.rb-pill:hover`, so
 * it depended on the pill's block being the first such query in a 1500-line stylesheet built as an
 * array of strings. The day a second control earned its own hover emphasis — the section verbs, 14
 * October 2026 — the guard would have failed on the pill, which had not changed, and sent whoever
 * was holding it looking in the wrong place. A test that breaks over the order of unrelated rules
 * is a test that teaches people to move code to please it.
 *
 * Still positional within each block, because there is no CSS parser here and the stylesheet is a
 * list of strings: every block is read whole, and a rule is behind the query if it is in one.
 */
/**
 * A reference to the scale, written the way the stylesheet's source writes it.
 *
 * The canvas's CSS is built from template literals, so what these assertions match is the text
 * `${CHROME_SCALE.brand}` a reader sees in `Editor.tsx` rather than the colour it stands for —
 * which is the point: the guard is «this rule asks the scale», not «this rule is currently blue».
 * Composed rather than typed, because a `${` inside a plain string is exactly what
 * `noTemplateCurlyInString` exists to catch, and everywhere else in this repository it would be
 * catching a real mistake.
 */
function reads(expression: string): string {
  return `\${${expression}}`;
}

function behindHoverQuery(rule: string): boolean {
  return [...CANVAS.matchAll(/@media \(hover: hover\)/g)].some((match) =>
    CANVAS.slice(match.index ?? 0, (match.index ?? 0) + 400).includes(rule),
  );
}

describe("the chrome's text", () => {
  const readable: [string, string, string][] = [
    ["ink on a panel", INK, SURFACE],
    ["ink on the app background", INK, BG],
    ["muted on a panel", MUTED, SURFACE],
    ["muted on the app background", MUTED, BG],
    ["danger on a panel", DANGER, SURFACE],
    // The palette's own secondary, which is the brand's blue *as text*: it has to be readable on
    // all three surfaces the interface uses, which is the entire reason it is a token (sprint 22).
    ["brand-deep on a panel", BRAND_DEEP, SURFACE],
    ["brand-deep on the app background", BRAND_DEEP, BG],
    ["brand-deep on the tinted surface", BRAND_DEEP, BRAND_SURFACE],
    ["danger-deep on a panel", DANGER_DEEP, SURFACE],
    ["danger-deep on the app background", DANGER_DEEP, BG],
  ];

  for (const [what, fg, bg] of readable) {
    it(`${what} clears AA`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }

  /**
   * **The one the chrome was getting wrong, and the reason this file exists.**
   *
   * The brand blue is a 4.71:1 ink on white and only **4.39:1** on the app background — so brand
   * text belongs on a panel, never straight onto the grey. And on its own tinted surface it is
   * **4.14:1**, which is how the selected page tab came to fail AA while looking deliberate.
   *
   * Asserted as the fact it is, rather than as a pass: the number is fixed by two colours ADR 0015
   * owns, so the fix is never to change them — it is to stop pairing them for normal text, which
   * is what the top bar does from day 2 of this work.
   */
  it("brand blue is not a normal-text colour on the tinted surface, which is why nothing uses it that way", () => {
    expect(contrastRatio(BRAND, BRAND_SURFACE)).toBeLessThan(AA_NORMAL_TEXT);
    // It is fine for large text and for a graphic, which is all it is ever used for.
    expect(contrastRatio(BRAND, BRAND_SURFACE)).toBeGreaterThanOrEqual(UI_COMPONENT);
  });

  it("brand blue on a white panel is readable, which is where it is allowed", () => {
    expect(contrastRatio(BRAND, SURFACE)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  /**
   * **And the token that exists because of the line above.**
   *
   * `--ui-brand-deep` is what brand text uses where `--ui-brand` cannot be used: the landing's
   * «Ya tengo cuenta» on the grey, the proposals' «Elegida» pill on its own tint. Each of those
   * was a `#105CB1` typed beside the thing that needed it until sprint 22; the point of measuring
   * it here is that it is now *one* colour with three ratios on record rather than three hexes
   * that happened to agree.
   *
   * Measured, not hoped for: 6.59:1 on a panel, 6.14:1 on the app background, 5.79:1 on the tint —
   * where the brand blue is 4.71, 4.39 and 4.14. The three `readable` rows above are the gate;
   * this one records the margin, so a future adjustment that erodes it is visible as a number.
   */
  it("the deep blue is readable where the brand blue is not, and by how much", () => {
    expect(contrastRatio(BRAND_DEEP, BG)).toBeGreaterThan(contrastRatio(BRAND, BG));
    expect(contrastRatio(BRAND_DEEP, BRAND_SURFACE)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrastRatio(BRAND, BRAND_SURFACE)).toBeLessThan(AA_NORMAL_TEXT);
  });
});

/**
 * **Brand and danger text are the deep pair, and the bright pair is for the rest** (sprint 28 day
 * 3, David's decision of 26 October 2026).
 *
 * The bright two clear 4.5:1 on a panel by a hair — 4.71 and 4.83 — and at 0.90 opacity, which is
 * where a panel's entrance fade spends part of its 180 ms, they are 4.03 and 4.30. The deep two keep
 * their margin there. Measured as a mix over the panel, which is what opacity paints.
 */
describe("brand and danger as text", () => {
  /** `fg` drawn at `alpha` over `bg`, channel by channel — what the screen shows mid-fade. */
  function over(fg: string, bg: string, alpha: number): string {
    const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
    return `#${[1, 3, 5]
      .map((at) =>
        Math.round(channel(fg, at) * alpha + channel(bg, at) * (1 - alpha))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  }

  it("the deep pair still reads at 0.90 opacity on a panel, where the bright pair does not", () => {
    for (const deep of [BRAND_DEEP, DANGER_DEEP]) {
      expect(contrastRatio(over(deep, SURFACE, 0.9), SURFACE)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      );
    }
    for (const bright of [BRAND, DANGER]) {
      expect(contrastRatio(over(bright, SURFACE, 0.9), SURFACE)).toBeLessThan(AA_NORMAL_TEXT);
    }
  });

  /**
   * **And no text reaches for the bright pair.** Read off the components, the way the canvas
   * guards above read `Editor.tsx`. `text-ui-danger` has no use left. `text-ui-brand` keeps three,
   * and all three colour an *icon* on its own tint — the rail's chip and the two device buttons —
   * which is a graphic and asks 3:1, so each must sit beside `bg-ui-brand-surface`; a fourth that
   * colours words would not.
   */
  it("no component colours its words with the bright brand or danger", () => {
    const sources = ["editor", "questionnaire", "account", "auth", "app"].flatMap((dir) =>
      readdirSync(join(import.meta.dirname, "..", "src", dir), { recursive: true })
        .map(String)
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => ({
          file: `${dir}/${file}`,
          text: readFileSync(join(import.meta.dirname, "..", "src", dir, file), "utf8"),
        })),
    );
    const offenders: string[] = [];
    for (const { file, text } of sources) {
      text.split("\n").forEach((line, index) => {
        const where = `${file}:${index + 1}`;
        if (/text-ui-danger(?![-\w])/.test(line)) offenders.push(where);
        if (/color:\s*[^,;]*var\(--ui-(brand|danger)\)/.test(line)) offenders.push(where);
        if (/text-ui-brand(?![-\w])/.test(line) && !line.includes("bg-ui-brand-surface")) {
          offenders.push(where);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * The chrome drawn inside the preview, which is the half no stylesheet governs.
 *
 * Direction set this floor explicitly after reading the plan for it: «las píldoras no pueden ser
 * casi invisibles en reposo. Deben ser sutiles pero visibles, con al menos 3:1 de contraste contra
 * el fondo (WCAG 1.4.11), y la guarda chromeContrast.test.ts debe comprobarlo.»
 *
 * The plan it refused would have made a control that only exists while a pointer is on it. What
 * measuring first showed is that the state was **already** below the floor before any of this
 * work: `#A9C9F4` on the white the gap paints is 1.70:1, and the rule beside it 1.62:1.
 */
describe("«Añadir sección aquí», at rest", () => {
  it("clears 3:1 against the white the gap paints behind it", () => {
    expect(contrastRatio(PILL_REST_BORDER, CHROME_SCALE.surface)).toBeGreaterThanOrEqual(
      UI_COMPONENT,
    );
  });

  it("is not the tint it used to be, which measured 1.70:1", () => {
    // Pinned as a number rather than a colour name: whatever the resting border becomes, it may
    // not go back under the floor, and this says what «under» was.
    expect(contrastRatio("#A9C9F4", CHROME_SCALE.surface)).toBeLessThan(UI_COMPONENT);
    expect(contrastRatio(PILL_REST_BORDER, CHROME_SCALE.surface)).toBeGreaterThan(
      contrastRatio("#A9C9F4", CHROME_SCALE.surface),
    );
  });

  it("has its emphasis behind `hover: hover`, so a touch screen gets the visible version", () => {
    // The other half of direction's instruction, and it cannot be measured as a ratio: a device
    // with no pointer must never be shown the quieter of two states. The hover rule is therefore
    // inside the query, and the resting rule outside it — which is what this reads.
    expect(
      behindHoverQuery(".rb-pill:hover"),
      "the pill's emphasis is not inside `@media (hover: hover)`",
    ).toBe(true);
    // And a keyboard, which has no pointer either, gets the same emphasis.
    expect(CANVAS).toContain(".rb-pill:focus-visible");
  });
});

/**
 * The eight round buttons on a chosen section, which nothing had ever measured.
 *
 * They are the oldest chrome in the canvas — sprint 2 — and the chrome redesign of sprint 15 went
 * past them without touching them: the pills, the gap and the rule were rebuilt on the scale and
 * these kept a size nobody chose, two blues typed by hand, and no focus ring at all.
 *
 * David, 14 October 2026: «los iconos se ven muy pequeños y no consigo diferenciarlos fácilmente y
 * además es difícil saber qué hacen exactamente.» What follows is the three halves of that — big
 * enough to tell apart, named, and visible before a pointer arrives.
 */
describe("the section's verbs", () => {
  it("take their blue and their red from the scale, not from hexes typed beside them", () => {
    expect(CANVAS).toContain(`.rb-action-move { background: ${reads("CHROME_SCALE.brand")}`);
    expect(CANVAS).toContain(`.rb-action-delete { background: ${reads("CHROME_SCALE.danger")}`);
    // And the two darker hover hexes are gone from the cluster, rather than left unused: they
    // belonged to no scale, and the emphasis is size and depth now.
    const cluster = CANVAS.slice(CANVAS.indexOf(".rb-actions {"), CANVAS.indexOf(".rb-hole {"));
    expect(cluster, "the cluster still carries a hand-typed hover blue").not.toContain("#0E5BC4");
    expect(cluster, "the cluster still carries a hand-typed hover red").not.toContain("#B91C1C");
  });

  it("are drawn from the one place their size is written down, in the screen's pixels", () => {
    // The CSS, the eight icons and the walks all read `VERB_SCALE`; a number typed twice is a
    // number that will disagree with itself, which is the whole argument of `chromeScale.ts`.
    // Since sprint 27 día 7 through `screenPx`/`screenIcon` (ADR 0053): the same numbers, divided
    // by the zoom the canvas is drawn at, so that at three quarters a verb is still 32 on screen.
    expect(CANVAS).toContain(`width: ${reads("screenPx(VERB_SCALE.size)")}`);
    expect(CANVAS).toContain(`transform: scale(${reads("VERB_SCALE.grow")})`);
    expect(CANVAS, "an icon is drawn at a size of its own").toContain(
      `<svg ${reads("screenIcon(VERB_SCALE.icon)")}`,
    );
    expect(CANVAS, "a verb's size is still written in the frame's pixels").not.toContain(
      `width: ${reads("VERB_SCALE.size")}px`,
    );
    expect(screenPx(VERB_SCALE.size)).toBe("calc(32px / var(--rb-zoom, 1))");
    expect(VERB_SCALE.size * VERB_SCALE.grow).toBe(36);
    // Big enough for a pointer by WCAG 2.5.8, which the 26px they were cleared only by two.
    expect(VERB_SCALE.size).toBeGreaterThanOrEqual(24);
  });

  it("have the focus ring they never had, and it is ink so it shows on the blue", () => {
    expect(CANVAS).toContain(".rb-action:focus-visible");
    // 2:1 would be invisible on the disc it rings. Ink on the brand blue is the one that shows.
    expect(contrastRatio(CHROME_SCALE.ink, BRAND)).toBeGreaterThanOrEqual(UI_COMPONENT);
    expect(contrastRatio(CHROME_SCALE.ink, DANGER)).toBeGreaterThanOrEqual(UI_COMPONENT);
  });

  it("grow behind `hover: hover` for a pointer, and outright for a keyboard", () => {
    expect(
      behindHoverQuery(".rb-action:hover"),
      "the verbs' growth is not inside `@media (hover: hover)`",
    ).toBe(true);
    expect(behindHoverQuery(".rb-verb:hover .rb-tip")).toBe(true);
    // The keyboard's half, outside the query: focus gets the same size and the same word.
    expect(CANVAS).toContain(".rb-action:focus-visible + .rb-tip");
  });

  it("say their word in white on ink, which is readable text rather than a decoration", () => {
    expect(contrastRatio("#FFFFFF", CHROME_SCALE.ink)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  /**
   * **A word hidden by opacity alone is still the page's text**, which is a defect CI found rather
   * than a nicety: `innerText` of a cover came back with all seven words in front of the business
   * name, and a reader's own Ctrl+F would have found «Duplicar» inside their restaurant. Measured
   * in Chromium: `opacity: 0` is collected, `visibility: hidden` is not.
   */
  it("take their word out of the page while it is not being shown", () => {
    const tip = CANVAS.slice(CANVAS.indexOf(".rb-tip {"));
    expect(tip.slice(0, 400), "the word is hidden by opacity alone").toContain(
      "visibility: hidden",
    );
    expect(CANVAS).toContain("visibility: visible");
  });

  it("are flattened for somebody who asked for less movement", () => {
    const reduced = CANVAS.indexOf("prefers-reduced-motion");
    const block = CANVAS.slice(reduced, reduced + 400);
    expect(block, "the verbs still animate under reduced motion").toContain(".rb-action");
    expect(block, "the word still fades under reduced motion").toContain(".rb-tip");
  });
});

describe("the chrome's boundaries and states", () => {
  /**
   * `--ui-border` is a hairline between two things and is **not** held to 3:1 — it carries no
   * information, and a 3:1 hairline everywhere would be a heavier interface, not a clearer one.
   * `--ui-border-strong` is the one for when the boundary *is* the information, and it has to
   * clear 3:1 on **both** surfaces, because a token that only works on white is a trap for
   * whoever reaches for it next.
   */
  it("the strong border clears 3:1 on a panel and on the app background", () => {
    expect(contrastRatio(BORDER_STRONG, SURFACE)).toBeGreaterThanOrEqual(UI_COMPONENT);
    expect(contrastRatio(BORDER_STRONG, BG)).toBeGreaterThanOrEqual(UI_COMPONENT);
  });

  it("the brand blue clears 3:1 as a state marker on both surfaces", () => {
    // The rail's indicator, the selected row's border: a graphic that says «this one».
    expect(contrastRatio(BRAND, SURFACE)).toBeGreaterThanOrEqual(UI_COMPONENT);
    expect(contrastRatio(BRAND, BG)).toBeGreaterThanOrEqual(UI_COMPONENT);
  });
});

/**
 * **The two greys the mockups use and this product does not** — `#94A3B8` and `#A3AEC0`.
 *
 * Sprint 1 day 2 measured them at **2.56:1** and **2.08:1** and replaced both with `#5B6B82`,
 * «one tone instead of two thresholds to track». That substitution happened in the questionnaire's
 * components and was written down as a note in `ui.tsx`. **It never reached the stylesheet injected
 * into the preview iframe**, where `#94A3B8` sat on two text rules for fourteen sprints, nor a
 * dialog's close icon on white.
 *
 * Nothing found it because nothing was looking in those places: this file checks named selectors,
 * `pnpm test:a11y` checks the renderer's output rather than the application's chrome, and axe's
 * contrast rule **only measures text**, so an icon-only button is invisible to it. The one that
 * did surface — a toolbar caption — surfaced by luck: a bar the walk had dragged happened to land
 * over white, and over a photograph axe reports «not measured» and says nothing at all.
 *
 * So the note becomes a refusal. The exception it describes survives in exactly one place, and it
 * is proved here rather than asserted in prose.
 */
describe("the greys the mockups use and the product refuses", () => {
  const MOCKUP_GREYS = ["#94A3B8", "#A3AEC0"] as const;

  it("measures why they are refused, on both surfaces the canvas paints", () => {
    for (const grey of MOCKUP_GREYS) {
      for (const surface of [CHROME_SCALE.surface, CHROME_SCALE.bg]) {
        expect(contrastRatio(grey, surface), `${grey} on ${surface}`).toBeLessThan(AA_NORMAL_TEXT);
      }
    }
    // And the tone that replaced them clears it on both, which is the whole of sprint 1's claim.
    expect(contrastRatio(MUTED, CHROME_SCALE.surface)).toBeGreaterThan(AA_NORMAL_TEXT);
    expect(contrastRatio(MUTED, CHROME_SCALE.bg)).toBeGreaterThan(AA_NORMAL_TEXT);
  });

  it("carries neither as a text colour anywhere in the canvas stylesheet", () => {
    // A refusal rather than a convention: this is the assertion that would have caught both rules
    // the day they were written, and the one that catches the next.
    for (const grey of MOCKUP_GREYS) {
      const found = [...CANVAS.matchAll(/color:\s*(#[0-9a-fA-F]{3,8})/g)]
        .map((match) => (match[1] ?? "").toUpperCase())
        .filter((value) => value === grey);
      expect(found, `${grey} is a text colour in the injected stylesheet`).toEqual([]);
    }
  });

  it("keeps the one exception on the one surface where it clears 3:1, and nowhere else", () => {
    // The persistent toast's dismiss icon, on `#0F172A`. A non-text graphic answers to 1.4.11's
    // 3:1, and the same stroke on white measures 2.56 — which is why «icon strokes are untouched»
    // was true of this one and false as a general claim.
    expect(contrastRatio("#94A3B8", INK)).toBeGreaterThan(UI_COMPONENT);
    expect(contrastRatio("#94A3B8", SURFACE)).toBeLessThan(UI_COMPONENT);

    const toast = readFileSync(
      join(import.meta.dirname, "..", "src", "questionnaire", "Editor.tsx"),
      "utf8",
    );
    expect(
      [...toast.matchAll(/text-\[#94A3B8\]/g)],
      "`#94A3B8` is used as a colour class more than once; only the dark toast may",
    ).toHaveLength(1);

    // **The class syntax and not the bare hex**, because both files now explain the refusal in
    // prose and a guard that reads prose is a guard that fails on its own documentation. The
    // header above makes the opposite mistake's case; this is the same lesson from the other side.
    const dialogs = readFileSync(
      join(import.meta.dirname, "..", "src", "questionnaire", "DownloadGateDialogs.tsx"),
      "utf8",
    );
    expect(
      [...dialogs.matchAll(/text-\[#94A3B8\]/g)],
      "a dialog paints white, so it cannot carry that grey",
    ).toEqual([]);
  });
});

/**
 * **«Foto de ejemplo», over a photograph nobody has seen yet** (sprint 27 día 6).
 *
 * axe could not measure this one, and said so from its first scan of the editor on 10 October
 * 2026: `color-contrast`, one node, `.rb-sample` — white words on a translucent dark pill drawn over
 * a photograph, and axe does not compute contrast against an image. The plan for the day asked for
 * a solid background measured or the reason written; this is the reason, and it is a measurement.
 *
 * **The worst photograph is white.** CSS composites a translucent background in sRGB, channel by
 * channel — `alpha × pill + (1 − alpha) × beneath` — so every channel of what ends up behind the
 * words is at most what it is over pure white, whatever the picture is; and relative luminance
 * rises with every channel. So the pill composited over `#FFFFFF` is the lightest it can ever be,
 * and the contrast measured there is the floor for every photograph. The `backdrop-filter` blur
 * only averages the pixels beneath, which keeps each of them inside the same range.
 *
 * Read from the injected stylesheet rather than restated, at rest and under the pointer.
 */
describe("the sample badge over a photograph", () => {
  /** `rgba(r,g,b,a)` over an opaque base, as the browser composites it, as `#rrggbb`. */
  function over(rgba: string, base: string): string {
    const parts = rgba.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
    if (!parts) throw new Error(`not an rgba(): ${rgba}`);
    const [r, g, b, a] = [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4])];
    const under = [1, 3, 5].map((at) => Number.parseInt(base.slice(at, at + 2), 16));
    return `#${[r, g, b]
      .map((channel, index) => Math.round(a * channel + (1 - a) * (under[index] ?? 0)))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  /** The declaration of one property inside the first rule for `selector`, comments stripped. */
  function declared(selector: string, property: string): string {
    // The stylesheet is built from template strings, and a `${UI_FONT}` carries a `}` of its own
    // that would end the rule early; the expressions go before the closing brace is looked for.
    const sheet = CANVAS.replace(/\$\{[^}]*\}/g, "…");
    const rule = sheet.indexOf(`${selector} {`);
    if (rule < 0) throw new Error(`the canvas stylesheet has no «${selector}» rule`);
    const body = sheet.slice(rule, sheet.indexOf("}", rule));
    const found = body.match(new RegExp(`(?:^|[;\\s"])${property}:\\s*([^;]+);`));
    if (!found?.[1]) throw new Error(`«${selector}» declares no ${property}`);
    return found[1].trim();
  }

  it("composites correctly — the arithmetic, before it is trusted with the badge", () => {
    expect(over("rgba(0,0,0,0.5)", "#FFFFFF")).toBe("#808080");
    expect(over("rgba(15,23,42,1)", "#FFFFFF")).toBe("#0f172a");
    expect(over("rgba(15,23,42,0)", "#FFFFFF")).toBe("#ffffff");
  });

  it("clears 4.5:1 over the lightest photograph there can be, at rest and under the pointer", () => {
    const words = declared(".rb-sample", "color");
    const rest = declared(".rb-sample", "background");
    const hover = declared(".rb-sample:hover", "background");
    expect(words.toUpperCase()).toBe("#FFFFFF");
    for (const [state, pill] of [
      ["at rest", rest],
      ["under the pointer", hover],
    ] as const) {
      const floor = contrastRatio(words, over(pill, "#FFFFFF"));
      expect(
        floor,
        `«Foto de ejemplo» ${state}, over white: ${floor.toFixed(2)}:1`,
      ).toBeGreaterThan(AA_NORMAL_TEXT);
    }
  });
});
