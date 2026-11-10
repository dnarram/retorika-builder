// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { headerPreviewer } from "../src/editor/headerPreview.ts";

/**
 * **Previsualizar al pasar** (sprint 35 día 5, David's adjustment 3): the attribute is written on the
 * canvas's bar as chrome and put back, a patch that arrived meanwhile wins, and a press keeps it.
 */
function canvas(attributes: Record<string, string> = {}): Document {
  const doc = document.implementation.createHTMLDocument("canvas");
  const header = doc.createElement("header");
  header.className = "rb-header";
  for (const [name, value] of Object.entries(attributes)) header.setAttribute(name, value);
  doc.body.append(header);
  return doc;
}
const bar = (doc: Document) => doc.querySelector("header.rb-header") as Element;

describe("the header's preview on the canvas", () => {
  it("writes the attribute while it shows, and puts the bar back as it was", () => {
    const doc = canvas({ "data-size": "body" });
    const preview = headerPreviewer(() => doc);
    preview.show({ attribute: "data-logo-size", value: "lg" });
    expect(bar(doc).getAttribute("data-logo-size")).toBe("lg");
    preview.end("restore");
    expect(bar(doc).hasAttribute("data-logo-size")).toBe(false);
    // A value the bar already has is replaced and put back the same.
    preview.show({ attribute: "data-size", value: "small" });
    expect(bar(doc).getAttribute("data-size")).toBe("small");
    preview.end("restore");
    expect(bar(doc).getAttribute("data-size")).toBe("body");
  });

  it("shows an absence, a default the renderer omits, and puts the word back", () => {
    const doc = canvas({ "data-logo-size": "lg" });
    const preview = headerPreviewer(() => doc);
    preview.show({ attribute: "data-logo-size", value: null });
    expect(bar(doc).hasAttribute("data-logo-size")).toBe(false);
    preview.end("restore");
    expect(bar(doc).getAttribute("data-logo-size")).toBe("lg");
  });

  it("keeps what a press wrote: forgetting is not putting back", () => {
    const doc = canvas();
    const preview = headerPreviewer(() => doc);
    preview.show({ attribute: "data-logo-size", value: "lg" });
    preview.end("keep");
    // The pointer leaves a moment after the press: nothing is left to put back.
    preview.end("restore");
    expect(bar(doc).getAttribute("data-logo-size")).toBe("lg");
  });

  it("lets a patch that arrived meanwhile win", () => {
    const doc = canvas();
    const preview = headerPreviewer(() => doc);
    preview.show({ attribute: "data-logo-size", value: "lg" });
    // «Deshacer» pressed while hovering: the patch brings the bar to the document's word.
    bar(doc).setAttribute("data-logo-size", "sm");
    preview.end("restore");
    expect(bar(doc).getAttribute("data-logo-size")).toBe("sm");
    // And a bar the patch replaced altogether is left alone.
    preview.show({ attribute: "data-name-size", value: "heading" });
    bar(doc).replaceWith(doc.createElement("header"));
    expect(() => preview.end("restore")).not.toThrow();
  });

  it("shows one preview at a time, putting the first back before the second", () => {
    const doc = canvas({ "data-align": "end" });
    const preview = headerPreviewer(() => doc);
    preview.show({ attribute: "data-align", value: "start" });
    preview.show({ attribute: "data-logo-size", value: "sm" });
    expect(bar(doc).getAttribute("data-align")).toBe("end");
    expect(bar(doc).getAttribute("data-logo-size")).toBe("sm");
    preview.end("restore");
    expect(bar(doc).hasAttribute("data-logo-size")).toBe(false);
  });

  it("does nothing where the canvas has no bar, or no document yet", () => {
    expect(() =>
      headerPreviewer(() => undefined).show({ attribute: "data-size", value: "small" }),
    ).not.toThrow();
    const empty = document.implementation.createHTMLDocument("canvas");
    const preview = headerPreviewer(() => empty);
    preview.show({ attribute: "data-size", value: "small" });
    expect(() => preview.end("restore")).not.toThrow();
  });
});
