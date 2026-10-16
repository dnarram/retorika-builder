import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REVEAL_STAGGER_CAP } from "../src/questionnaire/ui.tsx";

/**
 * **The restraint budget, as a test rather than as good intentions** (sprint 22).
 *
 * David's brief for this sprint was «dar apariencia de movimiento y modernidad con los colores de
 * Retorika **pero sin abusar para no distraer al usuario**», and the second half of that sentence
 * is the half that decays. Movement is added one element at a time, each addition defensible on
 * its own, and the screen that results is nobody's decision. So the ceiling is written down here,
 * next to the stylesheet, where crossing it fails the build instead of being noticed by whoever
 * happens to look at the landing in three sprints.
 *
 * The budget itself is in `docs/design/REVIEW.md`, sprint 22. In one line: **one looping animation
 * on the landing, none in the questionnaire, none on the proposals; one single-shot pulse per
 * screen at most, and never in the questionnaire; nothing animates layout; everything is at rest
 * inside 600ms of arriving.**
 *
 * **Comments stripped before anything is matched**, the technique and the reason
 * `chromeContrast.test.ts` records: its first version found `@media (hover: hover)` in the prose
 * explaining a rule rather than in the rule, and a guard that a sentence can satisfy is a guard
 * that is already broken.
 */

const EDITOR_SRC = join(import.meta.dirname, "..", "src");

function readStripped(...parts: string[]): string {
  return readFileSync(join(...parts), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

const CSS = readStripped(EDITOR_SRC, "app", "globals.css");

/** The `{ … }` body that opens at `from`, brace-matched because there is no CSS parser here. */
function bodyAt(source: string, from: number): string {
  const open = source.indexOf("{", from);
  if (open < 0) throw new Error(`no block opens after index ${from}`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces after index ${from}`);
}

/** Every `@keyframes`/`@utility` block in the stylesheet, by name. */
function blocks(kind: "keyframes" | "utility"): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of CSS.matchAll(new RegExp(`@${kind}\\s+([\\w-]+)\\s*\\{`, "g"))) {
    found.set(match[1] as string, bodyAt(CSS, match.index ?? 0));
  }
  return found;
}

const KEYFRAMES = blocks("keyframes");
const UTILITIES = blocks("utility");

function ms(name: string): number {
  const found = CSS.match(new RegExp(`--ui-${name}:\\s*([0-9.]+)ms\\s*;`));
  if (!found?.[1]) throw new Error(`globals.css declares no --ui-${name} in milliseconds`);
  return Number(found[1]);
}

/**
 * The three animations allowed to run for ever, by the name of their keyframes.
 *
 * `ui-hammer` and `ui-block-settle` are the building screen's mark, which exists for as long as a
 * ZIP is being written and no longer. `ui-drift` is the landing's background. Nothing else: a
 * fourth entry here is a decision about how distracting this application is, and it goes through
 * the budget in `REVIEW.md` rather than through a pull request that adds a keyframe.
 */
const MAY_LOOP = ["ui-hammer", "ui-block-settle", "ui-drift"];

/** The entrances written for sprint 22, which must not hold their properties after they end. */
const SPRINT_22_ENTRANCES = ["ui-reveal", "ui-ring-once"];

describe("the stylesheet's motion budget", () => {
  it("lets nothing loop but the mark at work and the landing's background", () => {
    const looping = [...CSS.matchAll(/animation:\s*([\w-]+)[^;]*infinite/g)].map((m) => m[1]);
    expect(looping.length).toBeGreaterThan(0); // the mark, or this regex has stopped matching
    for (const name of looping) {
      expect(
        MAY_LOOP,
        `«${name}» loops for ever, and the budget allows ${MAY_LOOP.length} animations to: ` +
          `${MAY_LOOP.join(", ")}. A fourth is a decision about how distracting this application ` +
          "is, and it belongs in the budget in docs/design/REVIEW.md, sprint 22 — not in a pull " +
          "request that adds a keyframe.",
      ).toContain(name);
    }
  });

  it("declares no infinite iteration count anywhere outside those", () => {
    // The long-hand route to the same thing, which the shorthand check above cannot see.
    expect(CSS).not.toMatch(/animation-iteration-count:\s*infinite/);
  });

  /**
   * **A single-shot pulse must say `1`, and the count must be in the shorthand.**
   *
   * The global `prefers-reduced-motion` block already forces every animation to one iteration, so
   * a ring that forgot its count would look correct to anybody testing with that preference on and
   * pulse for ever for everybody else — the worst shape a defect can have.
   */
  it("gives the one-shot ring exactly one iteration", () => {
    const ring = UTILITIES.get("ui-ring-once");
    expect(ring, "globals.css declares no ui-ring-once utility").toBeDefined();
    expect(ring).toMatch(/animation:[^;]*\s1\s/);
  });

  /**
   * **`backwards`, never `forwards` or `both`, for everything this sprint adds.**
   *
   * A filling animation keeps the properties it names under animation control after it ends, and
   * animations outrank ordinary declarations. An entrance that fills forwards therefore owns
   * `transform` for the life of the page — so the card reveals itself correctly and then refuses
   * to lift under the pointer, with no error anywhere. That is the defect this assertion exists
   * for, and it is invisible in a screenshot.
   *
   * The three older entrances (`ui-enter-right`, `ui-enter-up`, `ui-fade-in`) keep `both` on
   * purpose: they are the editor's panels and rail, where nothing hovers to move afterwards.
   */
  it("fills its entrances backwards, so a finished entrance owns nothing", () => {
    for (const name of SPRINT_22_ENTRANCES) {
      const utility = UTILITIES.get(name);
      expect(utility, `globals.css declares no ${name} utility`).toBeDefined();
      expect(utility, `${name} must fill backwards`).toMatch(/animation:[^;]*backwards/);
      expect(utility, `${name} must not fill forwards`).not.toMatch(
        /animation:[^;]*(forwards|both)/,
      );
    }
  });

  /**
   * **Nothing new animates the layout.** `opacity` and `transform` are composited; `width`,
   * `height` and `margin` are a reflow a frame, which is how a hover ends up stuttering a page.
   *
   * Two exemptions, both older than this sprint and both argued in the stylesheet where they live:
   * `ui-enter-right` has none (it is `translateX`, which is not a reflow but is excluded from the
   * three screens for a different reason — the overflow harness measures where things are), and
   * `ui-enter-up` animates `margin-top` deliberately, because a rail item has no space waiting
   * for it and the thing below it has to come down with it.
   */
  it("keeps layout out of its keyframes", () => {
    const exempt = ["ui-enter-up"];
    for (const [name, body] of KEYFRAMES) {
      if (exempt.includes(name)) continue;
      expect(body, `${name} animates a layout property`).not.toMatch(
        /(^|[\s;{])(width|height|margin[\w-]*|top|left|right|bottom|padding[\w-]*)\s*:/,
      );
    }
  });

  it("keeps translateX out of the keyframes the three screens before the editor use", () => {
    // The overflow walk at 320/390/768 measures where every box is; a thing that arrives
    // sideways is a thing that is briefly outside the viewport it will end up inside.
    for (const name of SPRINT_22_ENTRANCES) {
      const body = KEYFRAMES.get(name);
      if (body === undefined) continue;
      expect(body, `${name} moves horizontally`).not.toMatch(/translateX|translate3d\(\s*[^0]/);
    }
  });

  it("holds the two interaction durations under the panel guard's 200ms", () => {
    // Restated from the stylesheet's own comment: `e2e/critical-flows.e2e.test.ts` waits 350ms for
    // the canvas to settle, so these two are not a matter of taste.
    expect(ms("fast")).toBeLessThanOrEqual(200);
    expect(ms("base")).toBeLessThanOrEqual(200);
  });

  /**
   * **A screen is at rest inside 600ms of arriving**, which is the number that keeps a stagger
   * from becoming a queue. The worst case is the last card in a staggered grid: its delay is the
   * cap in `ui.tsx` (`REVEAL_STAGGER_CAP`) times the stagger, and then it still has to play.
   */
  it("spends its whole entrance budget inside 600ms", () => {
    expect(ms("stagger")).toBeLessThanOrEqual(60);
    expect(ms("slow") + REVEAL_STAGGER_CAP * ms("stagger")).toBeLessThanOrEqual(600);
  });

  it("still flattens everything for somebody who asked for less movement", () => {
    // Added in sprint 16 and the thing most easily lost while adding animations: a guard here
    // rather than only in the e2e, because this is the file that would lose it.
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(CSS).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(CSS).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });
});

/**
 * The budget per screen, read off the components rather than off the stylesheet.
 *
 * The stylesheet says what *may* loop; these say what *does*, on each of the three screens the
 * sprint touches. They are the half that catches the realistic mistake — not a new keyframe, but
 * the fourth place somebody reaches for an existing one.
 */
describe("the budget on each screen", () => {
  const LOOPS = ["ui-drift", "ui-hammer", "ui-block"];

  /** Every class named in a `className="…"` in one file. */
  function classesOf(...parts: string[]): string[] {
    const source = readStripped(...parts);
    return [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
      .flatMap((m) => (m[1] ?? m[2] ?? "").split(/\s+/))
      .filter(Boolean);
  }

  const questionnaireFiles = [
    [EDITOR_SRC, "questionnaire", "ui.tsx"],
    [EDITOR_SRC, "questionnaire", "Questionnaire.tsx"],
    ...readdirSync(join(EDITOR_SRC, "questionnaire", "steps"))
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => [EDITOR_SRC, "questionnaire", "steps", file]),
  ];

  for (const parts of questionnaireFiles) {
    const where = parts[parts.length - 1] as string;

    it(`${where} has nothing looping and nothing pulsing while somebody is answering`, () => {
      const classes = classesOf(...parts);
      for (const loop of LOOPS) expect(classes, `${where} loops`).not.toContain(loop);
      // The questionnaire is the one screen with a task on it. A ring on «Siguiente» would be
      // pointing at the answer somebody has not given yet.
      expect(classes, `${where} pulses`).not.toContain("ui-ring-once");
    });
  }

  it("the landing loops at most one animation, and pulses at most one element", () => {
    const classes = classesOf(EDITOR_SRC, "app", "page.tsx");
    expect(new Set(classes.filter((name) => LOOPS.includes(name))).size).toBeLessThanOrEqual(1);
    expect(classes.filter((name) => name === "ui-ring-once").length).toBeLessThanOrEqual(1);
  });

  /**
   * **The hole the test above had, and the reason a class scan is not enough** (sprint 22 day 3).
   *
   * The landing's logo animates through a component: `BuildingMark` carries `ui-hammer` and
   * `ui-block`, which are two of the three names allowed to loop, and the class names are in *that*
   * file rather than in `page.tsx`. So the scan above reads a landing with no loops in it while the
   * page renders two — finite only because `once` is passed. Drop that one word and the landing
   * hammers for ever, with every assertion in this file still green.
   *
   * The browser walk measures the real iteration count (`e2e`, sprint 22 day 3). This is the cheap
   * half that runs on every pull request without one.
   */
  it("builds the landing's mark once, never in a loop", () => {
    const source = readStripped(EDITOR_SRC, "app", "page.tsx");
    if (!source.includes("<BuildingMark")) return; // the landing may stop drawing it at all
    const tag = source.slice(source.indexOf("<BuildingMark"));
    expect(
      tag.slice(0, tag.indexOf("/>")),
      "the landing renders BuildingMark without `once`, so its mark loops for ever",
    ).toContain("once");
  });

  it("the three proposals loop nothing, and pulse only the one that was chosen", () => {
    const classes = classesOf(EDITOR_SRC, "questionnaire", "Variants.tsx");
    for (const loop of LOOPS) expect(classes).not.toContain(loop);
    expect(classes.filter((name) => name === "ui-ring-once").length).toBeLessThanOrEqual(1);
  });
});
