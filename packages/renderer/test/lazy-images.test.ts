import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { DOCUMENTS_DIR } from "./corpus.ts";

/**
 * `loading="lazy"` below the first section, and never on it — sprint 18 day 4.
 *
 * Measured before it was written: the bank's gallery of four (ADR 0039) under the cover took the
 * sample site's Lighthouse performance from 100 to 96–97 on simulated slow 4G, because the four
 * competed with the cover for the wire and the cover is the LCP. With the hint, 100 / 99 / 99.
 *
 * `equipo` is the one golden page with photographs in a later section — a team's — which is why
 * it is the fixture here rather than a document written for the test: the golden diff that landed
 * with this rule was these two images and one more, and this reads the same file.
 */
describe("photographs below the first section load lazily", () => {
  const doc = parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, "equipo.json"), "utf8")));
  const { html } = render(doc, "html");
  const images = html.match(/<img\b[^>]*>/g) ?? [];

  it("has a photograph above the fold and photographs below it, or it proves nothing", () => {
    expect(images.length).toBeGreaterThan(1);
  });

  it("leaves the first section's photograph eager: it is the largest contentful paint", () => {
    const [first] = images;
    expect(first).toBeDefined();
    expect(first).not.toContain("loading=");
  });

  it("marks every later photograph lazy, inside list items included", () => {
    for (const image of images.slice(1)) expect(image).toContain('loading="lazy"');
  });

  it("is a hint and not a dependency: the DOM target carries the same attribute", () => {
    // One node tree, two targets (CLAUDE.md): the preview must not differ from the file.
    const nodes = [...render(doc, "dom").querySelectorAll("img")];
    expect(nodes.length).toBe(images.length);
    expect(nodes[0]?.getAttribute("loading")).toBeNull();
    for (const node of nodes.slice(1)) expect(node.getAttribute("loading")).toBe("lazy");
  });
});
