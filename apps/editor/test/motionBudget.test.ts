import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHROME_SCALE } from "../src/editor/chromeScale.ts";
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

/**
 * **The ceiling every movement in the editor answers to** (sprint 35 día 1). Restated from the
 * stylesheet's own comment on `--ui-fast` and `--ui-base`: the panel guard in
 * `e2e/critical-flows.e2e.test.ts` waits 350 ms for the canvas to settle, and an interaction that
 * outlasts a fifth of a second has stopped answering the hand and started making it wait.
 */
const INTERACTION_CAP_MS = 200;

/**
 * **The budget reaches the editor's own screens** (sprint 35 día 1, before any of them moves more).
 *
 * Sprint 22 wrote the restraint budget for the three screens it touched — the landing, the five
 * questions, the proposals — and the editor was left out because nothing in it moved but a panel
 * arriving. Sprint 35 is the sprint that gives the editor exits, dialogs that arrive and leave,
 * popups that grow from where they were pressed and drops that settle; this is the ceiling those
 * days land under, written the day before the first of them so that a breach is a red test and not
 * a judgement somebody has to remember to make.
 *
 * **What counts as the editor**: the shell, the panel kit, the canvas's own component (and the
 * stylesheet it injects into the frame, below), every `*Panel.tsx` and every dialog. **Found by
 * name, not listed**, so the ninth panel is in the budget the day it is written. The building
 * screen is not: its mark is one of the three animations allowed to loop, for exactly as long as a
 * ZIP is being written, and `BuildingMark.tsx` carries it.
 */
describe("the budget in the editor", () => {
  const QUESTIONNAIRE = join(EDITOR_SRC, "questionnaire");
  const panels = readdirSync(QUESTIONNAIRE).filter((file) => /Panel\.tsx$/.test(file));
  const dialogs = readdirSync(QUESTIONNAIRE).filter((file) => /Dialogs?\.tsx$/.test(file));
  const EDITOR_FILES: string[][] = [
    [EDITOR_SRC, "editor", "EditorShell.tsx"],
    [EDITOR_SRC, "editor", "panelKit.tsx"],
    [QUESTIONNAIRE, "Editor.tsx"],
    ...panels.map((file) => [QUESTIONNAIRE, file]),
    ...dialogs.map((file) => [QUESTIONNAIRE, file]),
    [EDITOR_SRC, "account", "SaveToAccountDialog.tsx"],
  ];

  /**
   * **The one movement allowed to take longer, by file and by name.** Pressing «Ver en móvil»
   * animates the canvas card's width over `--ui-slow` (260 ms) with the shape curve, because the
   * largest thing on the screen changing shape is meant to be followed, not acknowledged — and the
   * shell restricts it to that one press (`changeDevice` in `EditorShell.tsx`). Anything else that
   * wants longer than the cap is a decision, and it goes through this list.
   */
  const SLOWER: Record<string, string[]> = { "EditorShell.tsx": ["ui-reflow"] };

  it("reads every panel and every dialog the editor draws", () => {
    // A guard on the glob: if the files are renamed, the budget stops reading them in silence.
    expect(panels.length, `panels found: ${panels.join(", ")}`).toBeGreaterThanOrEqual(8);
    for (const name of ["StylePanel.tsx", "MenuPanel.tsx", "DesignPanel.tsx", "FieldsPanel.tsx"]) {
      expect(panels).toContain(name);
    }
    expect(dialogs, `dialogs found: ${dialogs.join(", ")}`).toEqual(
      expect.arrayContaining([
        "DownloadGateDialogs.tsx",
        "RevertDialog.tsx",
        "FontChooserDialog.tsx",
        "ImportFontDialog.tsx",
      ]),
    );
  });

  it("keeps its one slower movement where it is written, and nowhere else", () => {
    // An exception that no longer applies is removed rather than left to excuse the next one.
    for (const [file, names] of Object.entries(SLOWER)) {
      const parts = EDITOR_FILES.find((p) => p[p.length - 1] === file);
      expect(parts, `${file} is no longer read by this budget`).toBeDefined();
      const source = readStripped(...(parts as string[]));
      for (const name of names) expect(utilitiesIn(source), `${file} ${name}`).toContain(name);
    }
  });

  for (const parts of EDITOR_FILES) {
    const where = parts[parts.length - 1] as string;

    it(`${where} loops nothing`, () => {
      const source = readStripped(...parts);
      for (const loop of ["ui-drift", "ui-hammer", "ui-block"]) {
        expect(utilitiesIn(source), `${where} loops ${loop}`).not.toContain(loop);
      }
      // Tailwind's own four loop for ever; this application has never used them and must not
      // start in the editor, where somebody is working.
      expect(source, `${where} uses a looping Tailwind animation`).not.toMatch(
        /(?<![\w-])animate-(spin|ping|pulse|bounce)(?![\w-])/,
      );
      expect(source, `${where} declares an infinite animation`).not.toMatch(/\binfinite\b/);
    });

    it(`${where} moves nothing for longer than ${INTERACTION_CAP_MS} ms`, () => {
      const source = readStripped(...parts);
      const slower = SLOWER[where] ?? [];
      // This is also the budget's pulse rule, and the reason it has no test of its own: the one
      // pulse the application has, `ui-ring-once`, takes 1.2 s to come to rest and is out of the
      // editor by its length alone. Sabotaged with two of them in a panel, a separate «at most one
      // pulse» check never got to fail — this one always failed first. The canvas's own pulse
      // (sprint 35 día 3, the zone that receives a drop) answers to the frame's ceiling below.
      for (const name of utilitiesIn(source)) {
        if (slower.includes(name)) continue;
        const rest = restOf(name);
        expect(
          rest,
          `${where} uses ${name}, which takes ${rest} ms to come to rest`,
        ).toBeLessThanOrEqual(INTERACTION_CAP_MS);
      }
      // Durations written by hand — an inline style, an injected stylesheet, a Tailwind class —
      // are read where they are written, with the chrome scale's and the stylesheet's names
      // resolved to the numbers they stand for.
      for (const { declaration, ms: time } of timesIn(source)) {
        expect(time, `${where}: «${declaration}»`).toBeLessThanOrEqual(INTERACTION_CAP_MS);
      }
      for (const match of source.matchAll(/(?<![\w-])(duration|delay)-(\d+)(?![\w-])/g)) {
        expect(Number(match[2]), `${where}: ${match[0]}`).toBeLessThanOrEqual(INTERACTION_CAP_MS);
      }
      expect(source, `${where}: an arbitrary Tailwind duration`).not.toMatch(
        /(?<![\w-])(duration|delay)-\[/,
      );
      // `transition-all` names width, height and every margin among everything else.
      expect(source, `${where}: transition-all animates the layout`).not.toMatch(
        /(?<![\w-])transition-all(?![\w-])/,
      );
      /*
       * **One press, the one `ui-interactive` gives** (sprint 35 día 7). A Tailwind `active:scale-*`
       * is a second press beside it: it writes `scale`, which `ui-interactive` does not transition,
       * so it jumps — and it stays under reduced motion, where the day-2 press gives nothing. Undo,
       * redo and «Descargar» wore one each until this day.
       */
      expect(source, `${where}: a second press beside ui-interactive's`).not.toMatch(
        /(?<![\w-])active:scale-/,
      );
    });
  }

  it("draws the saved tick once, and shades a scrolled panel without a movement", () => {
    const shell = readStripped(EDITOR_SRC, "editor", "EditorShell.tsx");
    expect(utilitiesIn(shell)).toContain("ui-draw");
    expect(UTILITIES.get("ui-draw")).toMatch(/animation:[^;]*backwards/);
    expect(restOf("ui-draw")).toBeLessThanOrEqual(INTERACTION_CAP_MS);
    // The shade is two backgrounds, one that scrolls with the content: no time in it at all.
    const shade = UTILITIES.get("ui-scroll-shade") ?? "";
    expect(shade).toMatch(/background-attachment:\s*local,\s*scroll/);
    expect(timesIn(shade)).toEqual([]);
    expect(readStripped(EDITOR_SRC, "editor", "panelKit.tsx")).toMatch(/ui-scroll-shade/);
  });
});

/**
 * **The canvas's own stylesheet, read as CSS** (sprint 35 día 1).
 *
 * The chrome drawn inside the preview — the verbs, their words, the insertion pill, the «Diseñada
 * a mano» bar, the text bar, the zones — is styled by one stylesheet `wireInteractions` injects into
 * the frame, written in `Editor.tsx` as an array of strings. `globals.css` cannot reach it: the
 * frame is another document, and the application's one `prefers-reduced-motion` block, the one that
 * flattens everything with `!important`, stops at its border. So the canvas keeps its own block,
 * selector by selector, and **a selector can be forgotten in it, or flattened before it is
 * declared** — a later rule of the same weight wins the cascade, and the media query adds none.
 * Both had happened by the day this was written.
 *
 * Read from the source's string literals with the chrome scale's values put back, which is what the
 * browser receives, so the durations below are numbers and not names.
 */
describe("the budget inside the canvas", () => {
  const SHEET = canvasSheet();
  const RULES = cssRules(SHEET);
  const reduced = (rule: CssRule) =>
    rule.at.some((query) => query.includes("prefers-reduced-motion: reduce"));

  it("finds the stylesheet the canvas is given, whole", () => {
    // A guard on the extraction: a reader that stopped at a quote would pass everything below.
    // 151 rules the day this was written; the floor is far enough under that to survive the
    // sheet losing a few, and far above what a reader stopped at its first quote would find.
    expect(RULES.length).toBeGreaterThan(100);
    expect(SHEET).toContain(".rb-pill {");
    expect(SHEET).toContain(".rb-toolbar-exact {");
    expect(SHEET).not.toContain("${");
    expect(RULES.filter(reduced).length).toBeGreaterThan(0);
  });

  it("loops nothing", () => {
    expect(SHEET).not.toMatch(/\binfinite\b/);
  });

  it(`moves nothing for longer than ${INTERACTION_CAP_MS} ms`, () => {
    const times = timesIn(SHEET);
    expect(times.length, "no duration found: the reader has stopped reading").toBeGreaterThan(0);
    for (const { declaration, ms: time } of times) {
      expect(time, `«${declaration}»`).toBeLessThanOrEqual(INTERACTION_CAP_MS);
    }
  });

  /**
   * **Nothing in the frame animates its layout**, with the one exemption `globals.css` already has
   * and for the same reason: `rb-handmade-in` is `ui-enter-up` carried into the frame, the bar that
   * appears over a section the owner has just escalated, and its negative margin is what makes the
   * section below travel down instead of jumping (the comment where it is declared).
   */
  it("animates no layout, but for the bar that opens room over an escalated section", () => {
    const exempt = ["rb-handmade-in"];
    const keyframes = RULES.filter((rule) => rule.prelude.startsWith("@keyframes"));
    expect(keyframes.map((rule) => rule.prelude)).toContain("@keyframes rb-handmade-in");
    for (const rule of keyframes) {
      const name = rule.prelude.replace("@keyframes", "").trim();
      if (exempt.includes(name)) continue;
      expect(rule.body, `${name} animates a layout property`).not.toMatch(LAYOUT_PROPERTY);
    }
    for (const rule of RULES) {
      for (const property of transitionedProperties(rule.body)) {
        expect(
          LAYOUT_NAMES.includes(property) || /^(margin|padding|inset)/.test(property),
          `«${rule.prelude}» transitions ${property}`,
        ).toBe(false);
      }
    }
  });

  it("flattens every movement for somebody who asked for less, after it is declared", () => {
    const reduce = RULES.map((rule, index) => ({ rule, index })).filter(({ rule }) =>
      reduced(rule),
    );
    let checked = 0;
    RULES.forEach((rule, index) => {
      if (reduced(rule) || rule.prelude.startsWith("@")) return;
      for (const kind of movementsOf(rule.body)) {
        for (const selector of selectorsOf(rule.prelude)) {
          checked += 1;
          const cover = reduce.find(
            ({ rule: flat }) =>
              selectorsOf(flat.prelude).includes(selector) &&
              new RegExp(`(^|[;\\s])${kind}(-duration)?\\s*:`).test(flat.body),
          );
          expect(
            cover,
            `«${selector}» declares a ${kind} the reduced-motion block never flattens`,
          ).toBeDefined();
          expect(
            cover?.index,
            `«${selector}» is flattened before its ${kind} is declared, so the declaration wins`,
          ).toBeGreaterThan(index);
        }
      }
    });
    // The verbs, their word, the pill, the escalated bar and the line's «Añadir» at least.
    expect(checked).toBeGreaterThanOrEqual(5);
  });
});

/**
 * **The vocabulary of sprint 36, and the second register** (día 2). Every piece declared here is
 * held to its ceiling before any screen wears it, and the two scenes that may take `--ui-scene`
 * are the only readers of it. David's four conditions of 11 November 2026 are the four assertions
 * that read like rules: a scene no longer than 400 ms and a fade under less movement; the ripple on
 * `::before` and no two pieces that can meet on one element sharing a pseudo-element; the magnet on
 * at most one control; nothing new that loops.
 */
describe("the vocabulary of sprint 36 and the second register", () => {
  const PIECES = [
    "ui-words",
    "ui-ripple",
    "ui-magnet",
    "ui-underline",
    "ui-blur-in",
    "ui-shake",
    "ui-tilt",
    "ui-count",
    "ui-skeleton",
    "ui-scene-build",
  ];
  /** The two names that may read `--ui-scene`: a utility and a view-transition name. */
  const SCENES = ["ui-scene-build", "rb-scene-canvas"];
  const SCENE_CAP_MS = 400;

  it("declares every piece, each at rest inside the interaction cap but the scene", () => {
    for (const name of PIECES) {
      expect(UTILITIES.get(name), `globals.css declares no ${name}`).toBeDefined();
      if (SCENES.includes(name)) continue;
      expect(restOf(name), `${name} takes longer than the cap`).toBeLessThanOrEqual(
        INTERACTION_CAP_MS,
      );
    }
  });

  it("gives the second register 400 ms, and lets only the two scenes read it", () => {
    expect(ms("scene")).toBeLessThanOrEqual(SCENE_CAP_MS);
    expect(ms("scene")).toBeLessThanOrEqual(600); // at rest with no stagger before it
    const readers = cssRules(CSS)
      .filter((rule) => /var\(--ui-scene\)/.test(rule.body))
      .map((rule) => rule.prelude);
    expect(readers.length, "nothing reads --ui-scene: the register has no scene").toBeGreaterThan(
      0,
    );
    for (const prelude of readers) {
      expect(
        SCENES.some((scene) => prelude.includes(scene)),
        `«${prelude}» reads --ui-scene, and only ${SCENES.join(" and ")} may: a third scene is a decision for the budget`,
      ).toBe(true);
    }
  });

  it("fades the two scenes under less movement, in --ui-fast and never in 0.01 ms", () => {
    const reduce = cssRules(CSS).filter((rule) =>
      rule.at.some((query) => query.includes("prefers-reduced-motion: reduce")),
    );
    for (const scene of SCENES) {
      const rules = reduce.filter((rule) => rule.prelude.includes(scene));
      expect(rules.length, `${scene} has no rule under reduced motion`).toBeGreaterThan(0);
      const fades = rules.some((rule) => /animation-duration:\s*var\(--ui-fast\)/.test(rule.body));
      expect(fades, `${scene} under reduced motion is a cut, not a --ui-fast fade`).toBe(true);
      for (const rule of rules) expect(rule.body).not.toMatch(/0\.01ms/);
    }
    // And the scenes' reduced rules come after the global flattening, which they have to beat.
    const global = CSS.indexOf("animation-duration: 0.01ms !important");
    const scenes = CSS.indexOf("::view-transition-group(rb-scene-canvas) {\n    animation: none");
    expect(scenes).toBeGreaterThan(global);
  });

  it("springs with a curve that ends at rest and overshoots by a tenth at most", () => {
    const spring = CSS.match(/--ui-spring:\s*linear\(([^)]+)\)/)?.[1];
    expect(spring, "globals.css declares no linear() spring").toBeDefined();
    const stops = (spring ?? "").split(",").map((stop) => Number(stop.trim().split(/\s+/)[0]));
    expect(stops.at(-1)).toBe(1);
    expect(Math.max(...stops)).toBeLessThanOrEqual(1.1);
    expect(Math.max(...stops), "a spring without an overshoot is a curve").toBeGreaterThan(1);
    // Where linear() is not understood, the fallback is the shape curve and nothing faster.
    expect(CSS).toMatch(/@supports not \(animation-timing-function: linear\(0, 1\)\)/);
  });

  it("keeps filter to the blur-in alone, and the blur-in to opacity and filter", () => {
    const outside = cssRules(CSS).filter(
      (rule) => /(^|[\s;{])filter\s*:/.test(rule.body) && !rule.prelude.includes("ui-blur-in"),
    );
    expect(
      outside.map((rule) => rule.prelude),
      "a filter outside ui-blur-in",
    ).toEqual([]);
    const blur = KEYFRAMES.get("ui-blur-in") ?? "";
    expect(blur).toMatch(/filter:\s*blur\(var\(--ui-blur\)\)/);
    expect(blur).not.toMatch(/transform/);
  });

  it("rings on ::before, and no two pieces that can meet on one control share a pseudo-element", () => {
    const pseudosOf = (name: string): string[] => {
      const body = UTILITIES.get(name) ?? "";
      return [...body.matchAll(/::(before|after)/g)].map((m) => m[1] as string);
    };
    expect(pseudosOf("ui-ripple")).toEqual(["before", "before"]);
    expect(pseudosOf("ui-ring-once")).toEqual(["after"]);
    // The pairs the application combines on one element, or will: the landing's call to action
    // wears the ring and will ripple; a page tab underlines and will ripple; a counted number
    // may ripple when it is a button. A new pair goes here the day it is written.
    const MAY_MEET: [string, string][] = [
      ["ui-ripple", "ui-ring-once"],
      ["ui-ripple", "ui-underline"],
      ["ui-ripple", "ui-count"],
    ];
    // Not in the list, by design: `ui-count` and `ui-underline` both draw on `::after`, and a
    // counted number is never a tab. The scan of the source below is what would say otherwise.
    for (const [a, b] of MAY_MEET) {
      const shared = pseudosOf(a).filter((pseudo) => pseudosOf(b).includes(pseudo));
      expect(shared, `${a} and ${b} both draw on ::${shared[0]}: one overwrites the other`).toEqual(
        [],
      );
    }
    // And the pairs that actually meet in the source, found by their class lists.
    const withPseudo = [...UTILITIES.keys()].filter((name) => pseudosOf(name).length > 0);
    for (const file of allSourceFiles()) {
      for (const list of classListsOf(file)) {
        const pieces = withPseudo.filter((name) => list.includes(name));
        for (let i = 0; i < pieces.length; i += 1) {
          for (let j = i + 1; j < pieces.length; j += 1) {
            const a = pieces[i] as string;
            const b = pieces[j] as string;
            const shared = pseudosOf(a).filter((pseudo) => pseudosOf(b).includes(pseudo));
            expect(
              shared,
              `${file}: ${a} and ${b} meet on one element and share ::${shared[0]}`,
            ).toEqual([]);
          }
        }
      }
    }
  });

  it("leans at most one control toward the pointer, and shakes only a questionnaire field", () => {
    const magnets = allSourceFiles().flatMap((file) =>
      classListsOf(file)
        .filter((list) => list.includes("ui-magnet"))
        .map(() => file),
    );
    expect(
      magnets.length,
      `ui-magnet on ${magnets.join(", ")}: the plan allows one`,
    ).toBeLessThanOrEqual(1);
    expect(UTILITIES.get("ui-shake")).toMatch(/animation:[^;]*\s1\s/);
    for (const file of allSourceFiles()) {
      if (file.endsWith("questionnaire/ui.tsx")) continue;
      expect(
        classListsOf(file).some((list) => list.includes("ui-shake")),
        `${file} shakes something that is not a questionnaire field`,
      ).toBe(false);
    }
  });

  it("has no time in the skeleton and no loop in anything new", () => {
    expect(timesIn(UTILITIES.get("ui-skeleton") ?? "")).toEqual([]);
    for (const name of PIECES) {
      expect(UTILITIES.get(name), name).not.toMatch(/\binfinite\b/);
      expect(KEYFRAMES.get(name) ?? "", name).not.toMatch(/\binfinite\b/);
    }
  });

  it("spends a staggered line inside 600 ms with the proposals' own cap", () => {
    // The caller writes `--ui-word-delay` from `--ui-stagger` and the same cap of seven.
    expect(ms("fast") + REVEAL_STAGGER_CAP * ms("stagger")).toBeLessThanOrEqual(600);
    expect(UTILITIES.get("ui-words")).toMatch(/animation-delay:\s*var\(--ui-word-delay, 0ms\)/);
  });
});

/**
 * **A screen hands over to the next** (sprint 36 día 3): the questions slide, the fifth gives way to
 * the proposals, the landing fades before it asks for the questions. Read off the stylesheet, which
 * is where each of these can be broken by one line.
 */
describe("a screen hands over to the next", () => {
  const RULES_ALL = cssRules(CSS);
  const underReduce = (rule: CssRule) =>
    rule.at.some((query) => query.includes("prefers-reduced-motion: reduce"));
  const VT_NAME = /::view-transition-(?:group|old|new|image-pair)\(([\w-]+)\)/g;
  const namesIn = (prelude: string) => [...prelude.matchAll(VT_NAME)].map((m) => m[1] as string);
  const SCENES = ["rb-scene-canvas"];

  it("names what travels only while a screen transition is in flight", () => {
    const naming = RULES_ALL.filter((rule) => /view-transition-name\s*:/.test(rule.body));
    expect(naming.length, "nothing is named: the screens cannot hand over").toBeGreaterThan(0);
    for (const rule of naming) {
      expect(
        rule.prelude,
        `«${rule.prelude}» names an element at rest: a name is a stacking context nobody asked for`,
      ).toMatch(/^:root\[data-rb-screen\]/);
    }
  });

  it("never fades the page around what travels", () => {
    const rule = (prelude: string) => RULES_ALL.find((r) => r.prelude === prelude)?.body ?? "";
    expect(rule("::view-transition-old(root)")).toMatch(/display:\s*none/);
    expect(rule("::view-transition-new(root)")).toMatch(/animation:\s*none/);
    expect(rule("::view-transition-group(root)")).toMatch(/animation:\s*none/);
  });

  /**
   * **Each pseudo-element, not each name.** A name with a reduced-motion rule for its group and none
   * for its old capture still cuts that capture: under `reduce` the travel rule does not apply, the
   * group's `animation: none` leaves a duration of 0 s, and the old capture inherits it. Found by
   * sabotage on the day this was written — the first version asked only that the name had a rule.
   */
  it("fades in --ui-fast, in place, every part of everything that travels, for somebody who asked for less", () => {
    const PART = /::view-transition-(group|old|new|image-pair)\(([\w-]+)\)/g;
    const partsIn = (prelude: string) => [...prelude.matchAll(PART)].map((m) => `${m[1]}(${m[2]})`);
    const travelling = new Set(
      RULES_ALL.filter((rule) => !underReduce(rule) && /animation/.test(rule.body))
        .flatMap((rule) => partsIn(rule.prelude))
        .filter((part) => !part.endsWith("(root)")),
    );
    expect([...travelling]).toEqual(
      expect.arrayContaining(["group(rb-question)", "old(rb-progress)", "new(rb-question)"]),
    );
    const reduced = RULES_ALL.filter(underReduce);
    for (const part of travelling) {
      const rules = reduced.filter((rule) => partsIn(rule.prelude).includes(part));
      expect(
        rules.length,
        `::view-transition-${part} has no rule under reduced motion: it is cut`,
      ).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(rule.body, `${part} under reduced motion is a cut`).not.toMatch(/0\.01ms/);
        expect(
          /animation:\s*none/.test(rule.body) || /var\(--ui-fast\)/.test(rule.body),
          `«${rule.prelude}» under reduced motion is neither still nor a --ui-fast fade`,
        ).toBe(true);
        expect(rule.body, `«${rule.prelude}» still travels under reduced motion`).not.toMatch(
          /ui-question-/,
        );
      }
    }
  });

  it(`moves no screen for longer than ${INTERACTION_CAP_MS} ms but the named scenes`, () => {
    const transitions = RULES_ALL.filter(
      (rule) =>
        namesIn(rule.prelude).length > 0 && !namesIn(rule.prelude).some((n) => SCENES.includes(n)),
    );
    const times = transitions.flatMap((rule) => timesIn(rule.body));
    expect(times.length, "no duration found in the screen transition").toBeGreaterThan(0);
    for (const { declaration, ms: time } of times) {
      expect(time, `«${declaration}»`).toBeLessThanOrEqual(INTERACTION_CAP_MS);
    }
  });

  it("moves the question sideways only as a pseudo-element, never as a box on the page", () => {
    // The overflow walk at 320/390/768 measures every box on the page; a box that arrived sideways
    // would be briefly outside the screen. A view transition's capture is not a box on the page.
    const sideways = [...KEYFRAMES.entries()]
      .filter(([, body]) => /translateX/.test(body))
      .map(([name]) => name)
      .filter((name) => name.startsWith("ui-question"));
    expect(sideways.length).toBe(4);
    for (const name of sideways) {
      const users = RULES_ALL.filter(
        (rule) =>
          !rule.prelude.startsWith("@keyframes") && new RegExp(`\\b${name}\\b`).test(rule.body),
      );
      expect(users.length, `${name} is used nowhere`).toBeGreaterThan(0);
      for (const rule of users) {
        expect(rule.prelude, `${name} moves a box on the page`).toMatch(/::view-transition-/);
      }
    }
  });

  it("lets the landing leave in --ui-fast, taking no pointer while it goes", () => {
    const leaving =
      RULES_ALL.find((rule) => rule.prelude === '[data-leaving="screen"]')?.body ?? "";
    expect(leaving).toMatch(/animation:\s*ui-fade-out var\(--ui-fast\)/);
    expect(leaving).toMatch(/pointer-events:\s*none/);
  });

  it("does not let a question arrive twice", () => {
    const chained =
      RULES_ALL.find((rule) => rule.prelude.includes("[data-rb-chained]"))?.body ?? "";
    expect(chained).toMatch(/animation:\s*none/);
  });
});

/** Every `.ts`/`.tsx` under `src`, by path. */
function allSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) out.push(path);
    }
  };
  walk(EDITOR_SRC);
  return out;
}

/** Every class list a file writes, each as its words. */
function classListsOf(file: string): string[][] {
  const source = readStripped(file);
  return [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})|class="([^"]*)"/g)].map((m) =>
    (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/).filter(Boolean),
  );
}

// ——— Readers ——————————————————————————————————————————————————————————————————————————————

/** Every `ui-*` utility the stylesheet declares that the source names, once each. */
function utilitiesIn(source: string): string[] {
  return [...UTILITIES.keys()].filter((name) =>
    new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(source),
  );
}

/**
 * How long a utility takes to come to rest: every time it declares, durations and delays summed,
 * with the stylesheet's names resolved. `ui-ring-once` is 700 ms after 500; `ui-lift` declares none
 * of its own and rides on `ui-interactive`'s.
 */
function restOf(name: string): number {
  const body = UTILITIES.get(name);
  if (body === undefined) throw new Error(`globals.css declares no ${name}`);
  return timesIn(body).reduce((total, { ms: time }) => total + time, 0);
}

/** Every time inside a `transition` or `animation` declaration, in milliseconds, with the chrome
 * scale and the `--ui-*` durations put back. A JavaScript style object writes the same property
 * name, so an inline `style={{ transition: "…" }}` is read by the same expression. */
function timesIn(source: string): { declaration: string; ms: number }[] {
  const resolved = source
    .replace(/\$\{CHROME_SCALE\.(\w+)\}/g, (_, key: string) =>
      String((CHROME_SCALE as Record<string, string | number>)[key] ?? "?"),
    )
    .replace(/var\(--ui-(fast|base|slow|stagger|scene)\)/g, (_, name: string) => `${ms(name)}ms`);
  const out: { declaration: string; ms: number }[] = [];
  for (const declaration of resolved.matchAll(
    /(?<![\w-])(transition|animation)(-duration|-delay|Duration|Delay)?\s*:\s*([^;}\n]+)/g,
  )) {
    for (const time of (declaration[3] ?? "").matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
      const value = Number(time[1]) * (time[2] === "s" ? 1000 : 1);
      out.push({ declaration: declaration[0].trim(), ms: value });
    }
  }
  return out;
}

const LAYOUT_NAMES = ["width", "height", "top", "left", "right", "bottom", "all"];
const LAYOUT_PROPERTY =
  /(^|[\s;{])(width|height|top|left|right|bottom|inset|margin[\w-]*|padding[\w-]*)\s*:/;

/** The properties a rule's `transition` or `transition-property` names. */
function transitionedProperties(body: string): string[] {
  const out: string[] = [];
  for (const match of body.matchAll(/(?<![\w-])transition(-property)?\s*:\s*([^;]+)/g)) {
    for (const item of (match[2] ?? "").split(",")) {
      const first = item.trim().split(/\s+/)[0] ?? "";
      if (first !== "" && first !== "none" && !/^\d/.test(first)) out.push(first);
    }
  }
  return out;
}

/** Which kinds of movement a rule declares: a transition with a duration, an animation by name. */
function movementsOf(body: string): ("transition" | "animation")[] {
  const kinds: ("transition" | "animation")[] = [];
  // `:(?!\s*none)` and not `:\s*(?!none)`: the second lets `\s*` give back its space, and the
  // look-ahead then reads « none», which is not «none» — so `animation: none` counted as a movement
  // (found on sprint 35 día 3, the day a rule in the frame first said `animation: none`).
  if (/(?<![\w-])transition(-property|-duration)?\s*:(?!\s*none)/.test(body))
    kinds.push("transition");
  if (/(?<![\w-])animation(-name)?\s*:(?!\s*none)/.test(body)) kinds.push("animation");
  return kinds;
}

function selectorsOf(prelude: string): string[] {
  return prelude
    .split(",")
    .map((selector) => selector.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

interface CssRule {
  prelude: string;
  body: string;
  /** The `@media`/`@supports` preludes it sits inside, outermost first. */
  at: string[];
}

/** A stylesheet's rules in source order, `@media` and `@supports` opened, `@keyframes` kept whole.
 * Brace-matched, because there is no CSS parser in this package and the sheet needs none. */
function cssRules(css: string, at: string[] = []): CssRule[] {
  const out: CssRule[] = [];
  let from = 0;
  while (from < css.length) {
    const open = css.indexOf("{", from);
    if (open < 0) break;
    const prelude = css.slice(from, open).trim();
    const body = bodyAt(css, open);
    if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
      out.push(...cssRules(body, [...at, prelude]));
    } else {
      out.push({ prelude, body, at });
    }
    from = open + body.length + 2;
  }
  return out;
}

/**
 * The stylesheet `wireInteractions` injects into the canvas, as the browser receives it: the
 * array's string literals, joined as the source joins them, with `CHROME_SCALE`'s values put back
 * and every other expression — sizes in the frame's pixels, which no rule here reads — set to 0.
 */
function canvasSheet(): string {
  const source = readStripped(EDITOR_SRC, "questionnaire", "Editor.tsx");
  const wire = source.indexOf("function wireInteractions(");
  const open = source.indexOf("style.textContent = [", wire);
  const close = source.indexOf('].join("\\n")', open);
  if (wire < 0 || open < 0 || close < 0) {
    throw new Error("Editor.tsx no longer builds the canvas stylesheet in wireInteractions");
  }
  const literals = [
    ...source
      .slice(open, close)
      .matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g),
  ].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
  return literals
    .join("\n")
    .replace(/\$\{CHROME_SCALE\.(\w+)\}/g, (_, key: string) =>
      String((CHROME_SCALE as Record<string, string | number>)[key] ?? "?"),
    )
    .replace(/\$\{[^}]*\}/g, "0");
}
