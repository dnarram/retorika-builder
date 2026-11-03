import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { buildCss, render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

const corpus = loadCorpus();

/**
 * **The page's motion, and the header's, under one rule** (ADR 0062, sprint 32 día 2; the header's
 * part since sprint 31 día 3): every `animation` and `transition` of the published stylesheet —
 * shorthand or longhand — sits inside `prefers-reduced-motion: no-preference`. Walked over the whole
 * sheet rather than spot-checked: a movement written one block too far out runs for everybody.
 *
 * And the vocabulary is closed: the exact list of declarations is asserted, so a new movement is a
 * deliberate change to this file and never a rule that slipped in.
 */

/** Every `transition*` and `animation*` declaration of a sheet, with the @-rules around it. */
export function motionIn(sheet: string): { declaration: string; within: string[] }[] {
  const text = sheet.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: { declaration: string; within: string[] }[] = [];
  const preludes: string[] = [];
  let start = 0;
  const take = (end: number) => {
    const segment = text.slice(start, end).trim().replace(/\s+/g, " ");
    if (/^(transition|animation)(-[a-z]+)?\s*:/.test(segment)) {
      found.push({ declaration: segment, within: preludes.filter((p) => p.startsWith("@")) });
    }
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      preludes.push(text.slice(start, i).trim());
      start = i + 1;
    } else if (ch === "}" || ch === ";") {
      take(i);
      if (ch === "}") preludes.pop();
      start = i + 1;
    }
  }
  return found;
}

const QUERY = "@media (prefers-reduced-motion: no-preference)";

function fixture(name: string): RetorikaDocument {
  const entry = corpus.find((c) => c.name === name);
  if (!entry) throw new Error(`no fixture ${name}`);
  return entry.document;
}

/** A site with everything that moves: a rail, «Ir a…», the bar's button, and sections to reveal. */
function everything(): RetorikaDocument {
  const doc = fixture("cabecera-con-marca");
  return parseDocument({
    ...doc,
    header: {
      ...doc.header,
      pages: { shown: true, position: "left" },
      sections: { shown: true, position: "fold", mobile: "fold" },
    },
  });
}

describe("the published page's motion", () => {
  it("finds every transition and animation inside the no-preference query, on every corpus site", () => {
    for (const entry of corpus) {
      const motion = motionIn(render(entry.document, "html").css);
      expect(motion.length, entry.name).toBeGreaterThan(0);
      for (const { declaration, within } of motion) {
        expect(within, `${entry.name}: ${declaration}`).toContain(QUERY);
      }
    }
  });

  it("is the closed vocabulary, and nothing else", () => {
    const declarations = motionIn(render(everything(), "html").css).map((m) => m.declaration);
    expect(declarations).toEqual([
      // The page's own (ADR 0062): the reveal, the cover's entrance, the page transition, the lift.
      "animation: rb-reveal linear none",
      "animation-timeline: view()",
      "animation-range: entry 0% entry 160px",
      "animation: rb-rise var(--rb-base) var(--rb-ease) backwards",
      "animation-delay: var(--rb-delay, 0ms)",
      "animation-duration: var(--rb-fast)",
      "transition: transform var(--rb-fast) var(--rb-ease), box-shadow var(--rb-fast) var(--rb-ease)",
      // The header's (ADR 0063): the entry's rule, the indicator, the button, the bar, the rail's
      // mark, «Ir a…»'s panel.
      "transition: text-decoration-color var(--rb-fast) var(--rb-ease)",
      "transition: left var(--rb-fast) var(--rb-ease), width var(--rb-fast) var(--rb-ease)",
      "transition: transform var(--rb-fast) var(--rb-ease), box-shadow var(--rb-fast) var(--rb-ease)",
      "transition: padding var(--rb-fast) var(--rb-ease), margin var(--rb-fast) var(--rb-ease), background-color var(--rb-fast) var(--rb-ease), box-shadow var(--rb-fast) var(--rb-ease)",
      "transition: text-decoration-color var(--rb-fast) var(--rb-ease), box-shadow var(--rb-fast) var(--rb-ease), background-color var(--rb-fast) var(--rb-ease)",
      "animation: rb-fold-in var(--rb-base) var(--rb-ease) backwards",
    ]);
    // The numbers every one of them reads, outside the query: they are not movement. For every site,
    // with or without a header.
    for (const entry of corpus) {
      expect(render(entry.document, "html").css, entry.name).toContain(
        "html { --rb-ease: cubic-bezier(0.2, 0, 0, 1); --rb-fast: 200ms; --rb-base: 400ms; }",
      );
    }
  });

  it("reveals every section after the first on a view timeline, inside @supports, the shorthand first (adjustments 3 and 6)", () => {
    const sheet = render(fixture("menu-y-paginas"), "html").css;
    const rule =
      "    main > .rb-section:not(:first-child) > * { animation: rb-reveal linear none;\n" +
      "      animation-timeline: view(); animation-range: entry 0% entry 160px;\n" +
      "      overflow-anchor: none; }";
    expect(sheet).toContain(rule);
    // Inside both the media query and the feature query, in that order.
    const motion = motionIn(sheet).find((m) => m.declaration === "animation-timeline: view()");
    expect(motion?.within).toEqual([QUERY, "@supports (animation-timeline: view())"]);
    // Every `animation-timeline` and `animation-range` of the sheet comes after an `animation:` in
    // the same rule: written before it, the shorthand would reset both.
    for (const block of sheet.match(/\{[^{}]*animation-(?:timeline|range)[^{}]*\}/g) ?? []) {
      const shorthand = block.indexOf("animation:");
      expect(shorthand, block).toBeGreaterThan(-1);
      expect(block.indexOf("animation-timeline"), block).toBeGreaterThan(shorthand);
      expect(block.indexOf("animation-range"), block).toBeGreaterThan(shorthand);
    }
    // No fill on the reveal (axe reads a child waiting at opacity 0 as a 1:1 contrast), `backwards`
    // on the cover's entrance, never `both`; and nothing but opacity and a vertical translate.
    expect(sheet).toContain(
      "@keyframes rb-rise { from { opacity: 0; transform: translateY(16px); } }",
    );
    expect(sheet).toContain(
      "@keyframes rb-reveal { from { opacity: 0; transform: translateY(16px); } 15% { opacity: 1; } }",
    );
    expect(sheet).not.toMatch(/rb-(rise|reveal)[^;]* both/);
  });

  it("brings the cover's words in once, 80 ms apart, and never its photograph or its panel", () => {
    const sheet = render(fixture("menu-y-paginas"), "html").css;
    expect(sheet).toContain(
      "  main > .rb-cover:first-child > :is(h1, p, a[role=button]) {\n    animation: rb-rise var(--rb-base) var(--rb-ease) backwards;\n    animation-delay: var(--rb-delay, 0ms); overflow-anchor: none; }",
    );
    // The delays ride a custom property, which no shorthand resets (measured: a plain
    // `animation-delay` on `p` lost to the heavier shorthand rule and read 0).
    expect(sheet).toContain("  main > .rb-cover:first-child > p { --rb-delay: 80ms; }");
    expect(sheet).toContain(
      "  main > .rb-cover:first-child > a[role=button] { --rb-delay: 160ms; }",
    );
    // No selector that animates names an image or the panel; the first section is out of the reveal.
    for (const block of sheet.match(/[^{}]*\{[^{}]*rb-rise[^{}]*\}/g) ?? []) {
      expect(block).not.toMatch(/\bimg\b|rb-panel/);
    }
    expect(sheet).not.toMatch(/\.rb-section:first-child > \*/);
  });

  it("fades between pages and keeps the bar still, inside the query, and never from the canvas", () => {
    const sheet = render(fixture("menu-y-paginas"), "html").css;
    const at = sheet.indexOf("  @view-transition { navigation: auto; }");
    expect(at).toBeGreaterThan(sheet.indexOf(QUERY));
    expect(sheet).toContain("  .rb-header { view-transition-name: rb-header; }");
    expect(sheet).toContain(
      "  ::view-transition-old(root), ::view-transition-new(root) { animation-duration: var(--rb-fast); }",
    );
    const canvas = buildCss(fixture("menu-y-paginas"), "dom");
    expect(canvas).not.toMatch(/view-transition|rb-rise|animation-timeline|animation-range/);
  });

  it("gives the canvas the numbers and none of the movement: the two sheets differ in two blocks alone", () => {
    for (const name of ["menu-y-paginas", "cover-and-services"]) {
      const doc = fixture(name);
      const published = buildCss(doc, "html");
      const canvas = buildCss(doc, "dom");
      // The page's motion block: from the keyframes to the end of the lift's hover block.
      const from = published.indexOf("@keyframes rb-rise");
      const hover = published.indexOf("@media (hover: hover) {", from);
      const to = published.indexOf("\n}\n", hover) + "\n}\n".length;
      expect(from, name).toBeGreaterThan(-1);
      let trimmed = published.slice(0, from) + published.slice(to);
      // The header's anchored indicator (ADR 0063), when there is a header.
      const anchors = trimmed.indexOf("@supports (anchor-name: --rb-x) {");
      if (anchors !== -1) {
        trimmed = trimmed.slice(0, anchors) + trimmed.slice(trimmed.indexOf("\n}\n", anchors) + 3);
      }
      expect(trimmed, name).toBe(canvas);
      expect(canvas, name).toContain("--rb-fast: 200ms");
    }
  });

  it("would catch a longhand or a transition written outside the query", () => {
    const sheet = render(fixture("menu-y-paginas"), "html").css;
    expect(
      motionIn(`${sheet}\n.rb-x { animation-timeline: view(); }`).some(
        ({ declaration, within }) =>
          declaration.startsWith("animation-timeline") && !within.includes(QUERY),
      ),
    ).toBe(true);
    const moved = sheet.replace(
      "@media (prefers-reduced-motion: no-preference) {\n  html { scroll-behavior: smooth; }",
      "@media all {\n  html { scroll-behavior: smooth; }",
    );
    expect(motionIn(moved).some(({ within }) => !within.includes(QUERY))).toBe(true);
  });
});
