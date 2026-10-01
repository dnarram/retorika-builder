import { type BreakpointPatch, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * Document rule 7's per-element patches, read by the renderer for the first time.
 *
 * The rule has been written down since phase 0 and the renderer ignored it: `physio-free-cover` asks
 * for its photograph at `order: 2` and its headline at `order: 1`, and the corpus published
 * `img { order: -1 }` — the opposite — with every test green for seven sprints.
 *
 * **The shared `@media` block is not touched, and `mobile.test.ts` is what enforces that**: it
 * asserts that block verbatim against every fixture in the corpus. These tests are about the block
 * that comes after it, which exists only for sections that carry patches.
 */

const corpus = loadCorpus();

function styleOf(html: string): string {
  const start = html.indexOf("<style>");
  const end = html.indexOf("</style>");
  if (start === -1 || end === -1) throw new Error("rendered page has no <style> block");
  return html.slice(start + "<style>".length, end);
}

/** Only the patch block — everything after the last `@media` the shared stylesheet writes. Needed
 * because `display: none` and `width:` both appear in the shared rules too, so a bare `not.toContain`
 * would pass or fail for the wrong reason.
 *
 * **Rule 6's block is excluded, and that is the second time this helper has had to get narrower.**
 * Since sprint 9 day 3 the stylesheet has another per-element block, and it addresses elements the
 * same way — so `[data-section="` alone stopped meaning "a mobile patch". The two are told apart by
 * the third attribute: rule 6's selector always ends `[data-role]` and rule 7's never does, which is
 * the same distinction that makes rule 6's rules outrank everything else. */
function patchBlock(css: string): string {
  return css
    .split("\n")
    .filter((line) => line.includes('[data-section="') && !line.includes("[data-role]"))
    .join("\n");
}

const found = corpus.find((entry) => entry.name === "physio-free-cover");
if (!found) throw new Error("the corpus has no physio-free-cover fixture");
const physio = found;

/** The fixture, with its mobile patches replaced by the caller's. */
function documentWith(mobile: BreakpointPatch[]): RetorikaDocument {
  const base = JSON.parse(JSON.stringify(physio.document)) as RetorikaDocument;
  const section = base.pages[0]?.sections[0];
  if (!section?.layout) throw new Error("fixture lost its layout");
  section.layout.breakpoints = { mobile };
  return parseDocument(base);
}

describe("the patches the renderer now reads", () => {
  it("publishes the fixture's own order, which the corpus contradicted until today", () => {
    const css = styleOf(render(physio.document, "html").html);
    expect(css).toContain('[data-section="sec-cover"] [data-id="el-headline"] { order: 1; }');
    expect(css).toContain('[data-section="sec-cover"] [data-id="el-image"] { order: 2; }');
  });

  it("numbers every element of a patched section, not only the patched ones", () => {
    // The correction a real browser made to a rule that looked right on paper. Emitting `order` only
    // where a patch named one put the **body first** at 390px: no patch means CSS's default `0`,
    // which is ahead of a headline patched to `1`. The document said headline first and the page
    // said body first.
    const css = styleOf(render(physio.document, "html").html);
    expect(css).toContain(String.raw`[data-section="sec-cover"] [data-id="el-body"] { order: 3; }`);
  });

  it("puts them in their own media block, after the shared one", () => {
    const css = styleOf(render(physio.document, "html").html);
    const shared = css.indexOf(".rb-section > img { order: -1; }");
    const patch = css.indexOf('[data-id="el-headline"] { order: 1; }');
    expect(shared).toBeGreaterThan(-1);
    expect(patch).toBeGreaterThan(shared);
  });

  it("scopes every rule to its section, so two sections cannot collide", () => {
    // Element ids are unique within a section, not within a document (rule 5). A bare
    // `[data-id="el-headline"]` would restyle every section's headline on a multi-section page.
    const css = styleOf(render(physio.document, "html").html);
    for (const line of css.split("\n").filter((row) => row.includes('[data-id="el-'))) {
      expect(line, line).toContain('[data-section="sec-cover"] ');
    }
  });

  it("emits nothing at all for a section with no patches", () => {
    expect(patchBlock(styleOf(render(documentWith([]), "html").html))).toBe("");
  });

  it("leaves every fixture without patches exactly as it was", () => {
    // The condition sprint 8 day 6 was accepted on: one golden file moves, and only one. Asked of
    // the patch block alone since day 3 of this sprint, because `estilo-por-elemento` carries rule
    // 6 rules and no patches — a fixture that would have failed this for being about the other rule.
    for (const entry of corpus) {
      if (entry.name === "physio-free-cover") continue;
      expect(patchBlock(styleOf(render(entry.document, "html").html)), entry.name).toBe("");
    }
  });
});

describe("a patch changes only what it patches", () => {
  /**
   * The defect the day-6 walk found by pressing a button.
   *
   * Base positions used to come from **content order**, and the automatic derivation does not: the
   * shared block puts the photograph first (`.rb-section > img { order: -1 }`, option A). So adding a
   * width patch — nothing to do with sequence — emitted numbers for every element and **moved the
   * photograph from first to fourth**. Somebody asked for a smaller photo and the section reordered
   * itself.
   *
   * Rule 7 says mobile is a patch over the automatic derivation, so the base has to *be* the
   * derivation. `mobileSequence` in `packages/schema` is that rule, shared with the editor.
   */
  it("a width-only patch leaves the photograph where the derivation put it: first", () => {
    const css = styleOf(
      render(documentWith([{ elementId: "el-image", columnSpan: 6 }]), "html").html,
    );
    const orders = css
      .split("\n")
      .filter((line) => line.includes("order:"))
      .map((line) => line.trim());
    expect(orders).toContain('[data-section="sec-cover"] [data-id="el-image"] { order: 1; }');
    expect(orders).toContain('[data-section="sec-cover"] [data-id="el-headline"] { order: 2; }');
    expect(orders).toContain('[data-section="sec-cover"] [data-id="el-body"] { order: 3; }');
  });

  it("a hide-only patch does not reorder anything either", () => {
    const css = styleOf(
      render(documentWith([{ elementId: "el-body", hidden: true }]), "html").html,
    );
    expect(css).toContain('[data-id="el-image"] { order: 1; }');
    expect(css).toContain('[data-id="el-body"] { order: 3; }');
  });
});

describe("the three adjustments, and no fourth", () => {
  it("hides with display, which nothing in the shared block contests", () => {
    const css = styleOf(
      render(documentWith([{ elementId: "el-body", hidden: true }]), "html").html,
    );
    expect(css).toContain('[data-section="sec-cover"] [data-id="el-body"] { display: none; }');
  });

  it("emits nothing for `hidden: false`, which asks for the derivation's own behaviour", () => {
    const css = styleOf(
      render(documentWith([{ elementId: "el-body", hidden: false }]), "html").html,
    );
    expect(patchBlock(css)).not.toContain("display: none");
  });

  it("narrows with a width, because on mobile the section is one column wide", () => {
    // `grid-column: span 6` would not narrow anything here: the mobile grid is `1fr`, so a span of
    // six asks for columns that do not exist and the grid invents them, pushing the page sideways.
    // A span of the document's twelve read as a fraction is what the adjustment means on a
    // one-column page — «Foto menor» in mockup 14.
    const css = styleOf(
      render(documentWith([{ elementId: "el-image", columnSpan: 6 }]), "html").html,
    );
    expect(css).toContain('[data-section="sec-cover"] [data-id="el-image"] { width: 50%; }');
    expect(css).not.toContain("grid-column: 1 / span 6");
  });

  it("emits nothing for a span of twelve, which is the derivation's own width", () => {
    // Why the fixture's `columnSpan: 12` on its photograph produces no declaration: rule 7 says
    // mobile is a patch, and a patch that changes nothing should not be published.
    const css = styleOf(
      render(documentWith([{ elementId: "el-image", columnSpan: 12 }]), "html").html,
    );
    expect(patchBlock(css)).not.toContain("width:");
  });

  it("has nowhere left to put a tablet patch, because no document can carry one", () => {
    // **This used to assert the renderer's own refusal, and that refusal moved** (ADR 0030, schema
    // 1.4.0). A tablet patch was a *valid* document the renderer had nowhere to put, so it threw;
    // now `parseDocument` refuses it at the gate — which is tested where that gate lives, in
    // `packages/schema/test/rules.test.ts`. What is left to check here is the half this file owns:
    // the renderer reads one bucket, and a document's mobile patches are all of it.
    const base = JSON.parse(JSON.stringify(physio.document)) as RetorikaDocument;
    const section = base.pages[0]?.sections[0];
    if (!section?.layout) throw new Error("fixture lost its layout");
    expect(Object.keys(section.layout.breakpoints)).toEqual(["mobile"]);
  });

  it("has no fourth adjustment, because the schema refuses one", () => {
    // `breakpointPatchSchema` is a strict object of exactly three optional properties, which is what
    // stops the mobile view from quietly growing into the second design rule 7 exists to prevent.
    const base = JSON.parse(JSON.stringify(physio.document)) as RetorikaDocument;
    const section = base.pages[0]?.sections[0];
    if (!section?.layout) throw new Error("fixture lost its layout");
    section.layout.breakpoints = {
      mobile: [{ elementId: "el-body", padding: "8px" } as never],
    };
    expect(() => parseDocument(base)).toThrow();
  });
});

describe("determinism, which INV_5 and the corpus both rest on", () => {
  it("emits the same bytes twice", () => {
    const once = render(physio.document, "html");
    const twice = render(physio.document, "html");
    expect(twice.css).toBe(once.css);
  });

  it("walks patches in the order the document stores them", () => {
    const css = styleOf(
      render(
        documentWith([
          { elementId: "el-image", order: 3 },
          { elementId: "el-body", order: 1 },
        ]),
        "html",
      ).html,
    );
    const image = css.indexOf('[data-id="el-image"] { order: 3; }');
    const body = css.indexOf('[data-id="el-body"] { order: 1; }');
    expect(image).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(image);
  });
});
