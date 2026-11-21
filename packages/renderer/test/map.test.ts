import type { RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * «Cómo llegar» on the published page (ADR 0080, sprint 40 día 4): one `<a>`, its href read from the
 * address the section shows when the page is drawn — never stored — and nothing fetched or embedded.
 */

const corpus = loadCorpus();
const fixture = (name: string): RetorikaDocument => {
  const found = corpus.find((entry) => entry.name === name);
  if (!found) throw new Error(`no corpus fixture ${name}`);
  return found.document;
};

/** The same document with the location section's address replaced, or hidden. */
function withAddress(doc: RetorikaDocument, text: string, hidden = false): RetorikaDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id !== "sec-location"
          ? section
          : {
              ...section,
              content: section.content.map((element) =>
                element.slot === "address"
                  ? { ...element, hidden, value: { kind: "text" as const, text } }
                  : element,
              ),
            },
      ),
    })),
  };
}

const mapTag = (html: string) => html.match(/<a data-id="el-map"[^>]*>/)?.[0] ?? "";

describe("«Cómo llegar» in the published page", () => {
  it("leads to the address the section shows, encoded and escaped for the attribute", () => {
    const { html } = render(fixture("donde-estamos-con-mapa"), "html");
    expect(mapTag(html)).toContain(
      'href="https://www.google.com/maps/search/?api=1&amp;query=Calle%20%C3%81nimas%2C%207%20%26%20Plaza%20%C2%ABEl%20Socorro%C2%BB%2C%20Ronda"',
    );
    expect(html).toMatch(/data-id="el-map"[^>]*>\s*Cómo llegar\s*<\/a>/);
  });

  it("follows the address: a corrected address is a corrected link, with nothing else stored", () => {
    const moved = withAddress(fixture("donde-estamos-con-mapa"), "Muelle 5, Ronda");
    expect(mapTag(render(moved, "html").html)).toContain("query=Muelle%205%2C%20Ronda");
  });

  it("cannot be turned into a script by the address, which only ever travels as a query value", () => {
    const hostile = withAddress(
      fixture("donde-estamos-con-mapa"),
      `javascript:alert(1)" onmouseover="alert(2)`,
    );
    const tag = mapTag(render(hostile, "html").html);
    expect(tag).toContain("query=javascript%3Aalert(1)%22%20onmouseover%3D%22alert(2)");
    expect(tag).not.toContain("onmouseover=");
  });

  it("is `#` where it leads nowhere, which the download refuses as a dead link", () => {
    const gone = withAddress(fixture("donde-estamos-con-mapa"), "Muelle 3", true);
    expect(mapTag(render(gone, "html").html)).toContain('href="#"');
  });

  it("draws the same href in the canvas as on the published page", () => {
    const doc = fixture("donde-estamos-con-mapa");
    const { html } = render(doc, "html");
    const href = mapTag(html)
      .match(/href="([^"]*)"/)?.[1]
      ?.replaceAll("&amp;", "&");
    const fragment = render(doc, "dom");
    expect(fragment.querySelector('[data-id="el-map"]')?.getAttribute("href")).toBe(href);
  });

  it("keeps a map with a point where it always went, byte for byte", () => {
    expect(mapTag(render(fixture("contacto-y-horario"), "html").html)).toContain(
      'href="https://www.openstreetmap.org/?mlat=36.7419&amp;mlon=-5.1673"',
    );
  });
});
