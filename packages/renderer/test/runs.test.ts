import type { MarkRun } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { nodeToHtml } from "../src/html.ts";
import { element } from "../src/nodes.ts";
import { textChildren, textElement } from "../src/runs.ts";

/**
 * The split, and the escaping that survives it.
 *
 * ADR 0024 called this «the delicate part» and said why: the guarantee against
 * `fixtures/documents/xss-attempt` used to be one `escapeHtml` over a whole string, and with runs
 * the string is cut into pieces first. Every refusal below is provoked on purpose, because an
 * escaping rule nobody tries to break is indistinguishable from one that is not there.
 */

const html = (text: string, marks?: MarkRun[]) =>
  nodeToHtml(textElement("p", { "data-id": "el" }, text, marks));

describe("a text with no marks is exactly what it was", () => {
  it("produces one string child", () => {
    expect(textChildren("Solomillo", undefined)).toEqual(["Solomillo"]);
    expect(textChildren("Solomillo", [])).toEqual(["Solomillo"]);
  });

  it("serialises identically to a plain element — which is what keeps the corpus still", () => {
    const text = "Solomillo al whisky";
    expect(html(text)).toBe(nodeToHtml(element("p", { "data-id": "el" }, [text])));
    expect(html(text, [])).toBe(nodeToHtml(element("p", { "data-id": "el" }, [text])));
  });

  it("is pretty-printed, as every unmarked text has been since sprint 1", () => {
    expect(html("Solomillo")).toBe('<p data-id="el">\n  Solomillo\n</p>');
  });
});

describe("a marked text is laid end to end", () => {
  it("puts nothing between the pieces", () => {
    expect(html("Solomillo al whisky", [{ from: 0, to: 9, mark: "strong" }])).toBe(
      '<p data-id="el"><strong>Solomillo</strong> al whisky</p>',
    );
  });

  it("does not inject a space into the middle of a word", () => {
    // The measurement this whole flag exists for. Pretty-printed, `Solo` + <strong>millo</strong>
    // renders as «Solo millo», because HTML collapses the newline and the indentation into a space
    // the document does not contain.
    const out = html("Solomillo", [{ from: 4, to: 9, mark: "strong" }]);
    expect(out).toBe('<p data-id="el">Solo<strong>millo</strong></p>');
    expect(out).not.toContain("\n");
  });

  it("nests strong outside em, whichever order the marks arrive in", () => {
    const both: MarkRun[] = [
      { from: 0, to: 4, mark: "strong" },
      { from: 0, to: 4, mark: "em" },
    ];
    expect(html("14 €", both)).toBe('<p data-id="el"><strong><em>14 €</em></strong></p>');
    expect(html("14 €", [...both].reverse())).toBe(html("14 €", both));
  });

  it("cuts at every boundary when two marks only partly overlap", () => {
    expect(
      html("Cocina casera de siempre", [
        { from: 0, to: 13, mark: "strong" },
        { from: 7, to: 24, mark: "em" },
      ]),
    ).toBe(
      '<p data-id="el"><strong>Cocina </strong><strong><em>casera</em></strong>' +
        "<em> de siempre</em></p>",
    );
  });

  it("joins neighbouring pieces that carry the same marks", () => {
    // Two runs of different marks over the same range leave one segment, not two.
    const children = textChildren("Solomillo", [
      { from: 0, to: 9, mark: "strong" },
      { from: 0, to: 9, mark: "em" },
    ]);
    expect(children).toHaveLength(1);
  });

  it("marks the whole text without leaving an empty piece either side", () => {
    expect(html("Entero", [{ from: 0, to: 6, mark: "strong" }])).toBe(
      '<p data-id="el"><strong>Entero</strong></p>',
    );
  });
});

describe("every piece is escaped, separately", () => {
  it("escapes a script inside a marked run", () => {
    const out = html("Mira esto: <script>alert(1)</script> y ya", [
      { from: 11, to: 36, mark: "strong" },
    ]);
    expect(out).toContain("<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>");
    expect(out).not.toContain("<script>");
  });

  it("escapes a script that straddles a mark boundary", () => {
    // The nastiest shape: the opening tag inside the run and the rest outside, so neither piece is
    // a whole script on its own and a naive "escape the unmarked parts" would let it through.
    const out = html("<script>alert(1)</script>", [{ from: 0, to: 8, mark: "strong" }]);
    expect(out).toBe('<p data-id="el"><strong>&lt;script&gt;</strong>alert(1)&lt;/script&gt;</p>');
    expect(out).not.toContain("<script>");
  });

  it("escapes the characters a boundary sits next to, on both sides of it", () => {
    expect(
      html('Pan & aceite <del bueno> "de verdad"', [{ from: 4, to: 24, mark: "strong" }]),
    ).toBe(
      '<p data-id="el">Pan <strong>&amp; aceite &lt;del bueno&gt;</strong>' +
        " &quot;de verdad&quot;</p>",
    );
  });

  it("escapes an ampersand that is the first character of a run", () => {
    expect(html("a&b", [{ from: 1, to: 2, mark: "em" }])).toBe(
      '<p data-id="el">a<em>&amp;</em>b</p>',
    );
  });

  it("escapes a quote inside a run", () => {
    expect(html(`di "hola"`, [{ from: 3, to: 9, mark: "strong" }])).toBe(
      '<p data-id="el">di <strong>&quot;hola&quot;</strong></p>',
    );
  });

  it("keeps accents inside a run intact", () => {
    expect(html("la degustación va", [{ from: 3, to: 14, mark: "em" }])).toBe(
      '<p data-id="el">la <em>degustación</em> va</p>',
    );
  });

  it("never lets a mark name come from the document", () => {
    // The tags are a closed pair in this file; nothing in the document chooses them. Asserted by
    // what comes out rather than by reading the source.
    const out = html("x", [{ from: 0, to: 1, mark: "strong" }]);
    expect(out).toBe('<p data-id="el"><strong>x</strong></p>');
  });
});
