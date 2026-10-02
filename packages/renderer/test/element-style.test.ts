import { parseDocument, type RetorikaDocument, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { buildCss } from "../src/build.ts";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * What the stylesheet says about rule 6. Whether the browser obeys it is
 * `element-style.browser.test.ts`; this is the half a string comparison can answer — which rules
 * exist, in which order, and for which elements.
 */

const corpus = loadCorpus();
const styled = corpus.find((entry) => entry.name === "estilo-por-elemento");
if (!styled) throw new Error("the estilo-por-elemento fixture is missing from the corpus");

/** The rule 6 block only, so a change to the shared stylesheet cannot make these pass or fail. */
function styleRules(doc: RetorikaDocument): string[] {
  const lines = buildCss(doc).split("\n");
  const start = lines.indexOf("/* rule 6: an element's own style */");
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line === "");
  return (end === -1 ? rest : rest.slice(0, end)).map((line) => line.trim());
}

describe("rule 6 in the stylesheet", () => {
  it("emits a reference as var(--token), which is what makes the rule true", () => {
    // «Cambiar la paleta sigue funcionando en toda la web»: it is the custom property that does
    // that, so an emitted literal here would quietly break the promise for every referenced value.
    expect(styleRules(styled.document)).toContain(
      '[data-section="sec-cover"] [data-id="el-subheadline"][data-role] { color: var(--color-muted); font-family: var(--font-heading); }',
    );
  });

  it("emits an exact value literally, which is what makes it an exception", () => {
    expect(styleRules(styled.document)).toContain(
      '[data-section="sec-cover"] [data-id="el-image"][data-role] { border-radius: 28px; }',
    );
  });

  it("puts several properties in one rule, in the vocabulary's own order", () => {
    // Deterministic by construction rather than by luck: `STYLE_PROPERTIES` is walked, not
    // `Object.keys(style)`, so a document whose JSON happened to list them the other way round
    // publishes the same bytes. INV_5 depends on that.
    expect(styleRules(styled.document)).toContain(
      '[data-section="sec-cover"] [data-id="el-headline"][data-role] { color: var(--color-ink); font-size: var(--size-subheading); }',
    );
    const reordered = parseDocument(
      JSON.parse(
        JSON.stringify(styled.document).replace(
          '"color":{"ref":"color.ink"},"fontSize":{"ref":"size.subheading"}',
          '"fontSize":{"ref":"size.subheading"},"color":{"ref":"color.ink"}',
        ),
      ),
    );
    expect(buildCss(reordered)).toBe(buildCss(styled.document));
  });

  it("reaches an element inside a list item", () => {
    expect(styleRules(styled.document)).toContain(
      '[data-section="sec-services"] [data-id="el-card-1-title"][data-role] { color: #7A1F1F; font-family: var(--font-body); padding: var(--space-sm); }',
    );
  });

  it("emits nothing for a hidden element, whose rule would match nothing anyway", () => {
    const rules = styleRules(styled.document).join("\n");
    expect(rules).not.toContain("el-oculto");
    expect(rules).not.toContain("#FF00FF");
  });

  it("emits no block at all for a document that carries no style", () => {
    // The condition the whole golden corpus rests on: a site that uses none of this publishes
    // exactly the bytes it always did, down to the absence of a comment line.
    for (const entry of corpus) {
      if (entry.name === "estilo-por-elemento") continue;
      expect(buildCss(entry.document), entry.name).not.toContain("rule 6");
    }
  });

  it("carries no !important, which is the reason it is a rule block and not an attribute", () => {
    // `placementStyle` writes the grid inline, which is why the shared mobile block needs
    // `grid-column: … !important`. Style written inline would have forced the same arms race.
    expect(styleRules(styled.document).join("\n")).not.toContain("!important");
  });

  it("leaves the element's own style attribute to the placement, untouched", () => {
    const { html } = render(styled.document, "html");
    // The cover is a catalog section, so its elements carry the preset's placement inline and
    // nothing else. A `color:` in there would mean the emission went to the wrong place.
    const line = html.split("\n").find((l) => l.trimStart().startsWith("<h1 "));
    expect(line, "the rendered h1").toBeDefined();
    expect(line).toContain('data-id="el-headline"');
    expect(line).toMatch(/style="grid-column:/);
    expect(line).not.toContain("color:");
    expect(line).not.toContain("font-size:");
  });
});

describe("INV_5 — the same document publishes the same bytes, with exceptions in it", () => {
  it("renders byte-identically twice", () => {
    // Determinism with the new branch exercised: the walk is over `STYLE_PROPERTIES` and the
    // document's own order, with nothing derived from a clock or a map iteration order.
    expect(render(styled.document, "html").html).toBe(render(styled.document, "html").html);
  });

  it("does not depend on anything outside the document", () => {
    // The §11 guarantee the studio mode rests on: whether the design tools are on is a fact about
    // the person looking, it lives in their browser (`INV_4`, ADR 0025), and the renderer has no
    // way to read it. So a professional's exact value publishes the same bytes as anybody else's.
    // Asserted by rendering the same parsed document from two independent parses.
    const one = parseDocument(JSON.parse(JSON.stringify(styled.document)));
    const two = parseDocument(JSON.parse(JSON.stringify(styled.document)));
    expect(render(one, "html").html).toBe(render(two, "html").html);
  });

  it("changes the bytes when, and only when, the style changes", () => {
    const section = styled.document.pages[0]?.sections[0];
    if (!section) throw new Error("no section");
    const withoutStyle: Section = {
      ...section,
      content: section.content.map(({ style: _dropped, ...rest }) => rest),
    };
    const stripped = parseDocument({
      ...styled.document,
      pages: [
        {
          ...styled.document.pages[0],
          sections: [withoutStyle, ...(styled.document.pages[0]?.sections.slice(1) ?? [])],
        },
      ],
    });
    expect(render(stripped, "html").html).not.toBe(render(styled.document, "html").html);
  });
});
